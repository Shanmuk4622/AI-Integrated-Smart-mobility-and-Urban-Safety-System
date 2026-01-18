import cv2
import numpy as np
import string
import easyocr
from collections import deque, defaultdict
from ultralytics import YOLO
import sys
import os
import time
import torch

# Add worker root to path so we can import 'sort' and 'services'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sort.sort import Sort
from .traffic_rules import TrafficController
# Import Supabase Service
from services.supabase_client import SupabaseService

# ==========================================
# SMART MOBILITY SYSTEM (WORKER VERSION)
# ==========================================

# Initialize EasyOCR
reader = easyocr.Reader(['en'], gpu=True)

dict_char_to_int = {'O': '0', 'I': '1', 'J': '3', 'A': '4', 'G': '6', 'S': '5'}
dict_int_to_char = {'0': 'O', '1': 'I', '3': 'J', '4': 'A', '6': 'G', '5': 'S'}

def license_complies_format(text):
    if len(text) != 7: return False
    if (text[0] in string.ascii_uppercase or text[0] in dict_int_to_char.keys()) and \
       (text[1] in string.ascii_uppercase or text[1] in dict_int_to_char.keys()) and \
       (text[2] in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] or text[2] in dict_char_to_int.keys()) and \
       (text[3] in ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] or text[3] in dict_char_to_int.keys()) and \
       (text[4] in string.ascii_uppercase or text[4] in dict_int_to_char.keys()) and \
       (text[5] in string.ascii_uppercase or text[5] in dict_int_to_char.keys()) and \
       (text[6] in string.ascii_uppercase or text[6] in dict_int_to_char.keys()):
        return True
    return False

def format_license(text):
    license_plate_ = ''
    mapping = {0: dict_int_to_char, 1: dict_int_to_char, 4: dict_int_to_char, 5: dict_int_to_char, 6: dict_int_to_char, 2: dict_char_to_int, 3: dict_char_to_int}
    for j in [0, 1, 2, 3, 4, 5, 6]:
        if text[j] in mapping[j].keys(): license_plate_ += mapping[j][text[j]]
        else: license_plate_ += text[j]
    return license_plate_

def read_license_plate(license_plate_crop):
    detections = reader.readtext(license_plate_crop)
    for detection in detections:
        bbox, text, score = detection
        text = text.upper().replace(' ', '')
        if license_complies_format(text):
            return format_license(text), score
    return None, None

class BoxSmoother:
    def __init__(self, window=30):
        self.window = window
        self.buffers = defaultdict(lambda: deque(maxlen=self.window))
    def update(self, track_id, bbox):
        self.buffers[track_id].append(np.array(bbox, dtype=float))
        return np.stack(self.buffers[track_id], axis=0).mean(axis=0).tolist()

class PlateSmoother:
    def __init__(self, bbox_window=5):
        self.bbox_window = bbox_window
        self.bbox_buffers = defaultdict(lambda: deque(maxlen=self.bbox_window))
        self.best_text = {} 
    def update_bbox(self, track_id, bbox):
        self.bbox_buffers[track_id].append(np.array(bbox, dtype=float))
        return np.stack(self.bbox_buffers[track_id], axis=0).mean(axis=0).tolist()
    def update_text(self, track_id, text, score):
        if text is None or text == '': return
        prev = self.best_text.get(track_id, {'text': '0', 'score': 0.0})
        if score is None: score = 0.0
        if score >= prev['score']: self.best_text[track_id] = {'text': text, 'score': float(score)}
    def get_best_text(self, track_id):
        return self.best_text.get(track_id, {'text': '0', 'score': 0.0})

# --- WORKER CLASS ---

class JunctionProcessor:
    def __init__(self, junction_id: int, video_source: str, coco_model_path: str, lp_model_path: str, config_module=None):
        self.junction_id = junction_id
        self.video_source = video_source
        self.config = config_module
        
        # Initialize Supabase
        self.db = SupabaseService()
        
        # Models
        print(f"Loading Models for Junction {junction_id}...")
        self.coco_model = YOLO(coco_model_path)
        self.lp_model = YOLO(lp_model_path)
        
        if torch.cuda.is_available():
            self.coco_model.to('cuda')
            self.lp_model.to('cuda')
            print("Using GPU")
        else:
            print("Using CPU")
        
        # Initialize SORT Tracker
        self.tracker = Sort(max_age=30, min_hits=3, iou_threshold=0.3)
        self.traffic_controller = TrafficController()
        
        self.car_smoother = BoxSmoother()
        self.plate_smoother = PlateSmoother()
        
        self.vehicles_class_ids = [2, 3, 5, 7] # car, motorcycle, bus, truck
        
        self.cap = cv2.VideoCapture(self.video_source)
        if not self.cap.isOpened():
             # Try opening as int if it's a number (webcam)
             try:
                 source_int = int(self.video_source)
                 self.cap = cv2.VideoCapture(source_int)
             except ValueError:
                 raise ValueError(f"Could not open video source: {self.video_source}")
                 
        if not self.cap.isOpened():
             print(f"ERROR: Failed to open source {self.video_source}")

        # Configurable Output
        self.out = None
        if self.config and self.config.SAVE_VIDEO:
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
            
            output_path = os.path.join(self.config.OUTPUT_DIR, f"processed_j{self.junction_id}_{int(time.time())}.mp4")
            self.out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
            print(f"Recursive Recording logic enabled. Saving to: {output_path}")

        # State
        self.wrong_way_violations = []
        self.last_log_time = 0
        self.last_frame_time = 0

    def detect_ambulance(self, frame, box):
        x1, y1, x2, y2 = map(int, box)
        if x1 < 0 or y1 < 0 or x2 > frame.shape[1] or y2 > frame.shape[0]: return False
        vehicle_roi = frame[y1:y2, x1:x2]
        if vehicle_roi.size == 0: return False
        hsv = cv2.cvtColor(vehicle_roi, cv2.COLOR_BGR2HSV)
        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 70, 50])
        upper_red2 = np.array([180, 255, 255])
        mask = cv2.inRange(hsv, lower_red1, upper_red1) + cv2.inRange(hsv, lower_red2, upper_red2)
        if (cv2.countNonZero(mask) / (vehicle_roi.shape[0] * vehicle_roi.shape[1])) > 0.15:
            return True
        return False

    def check_wrong_way(self, track_id, current_pos):
        history = self.car_smoother.buffers[track_id]
        if len(history) < 20: return False
        x_old, y_old, _, _ = history[0]
        _, y_new, _, _ = current_pos 
        if y_new < y_old - 50: return True # Violation rule
        return False

    def start(self):
        print(f"Junction {self.junction_id}: Processing started.")
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                print("End of stream, restarting...")
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # Detection
            results = self.coco_model(frame, verbose=False)[0]
            detections = []
            for d in results.boxes.data.tolist():
                x1, y1, x2, y2, score, cls = d
                if int(cls) in self.vehicles_class_ids:
                    detections.append([x1, y1, x2, y2, score])
            
            # Tracking
            tracks = self.tracker.update(np.asarray(detections))
            
            # License Plates (Optimize: Run less frequently)
            frame_num = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES))
            lp_boxes = []
            if frame_num % 5 == 0:
                lp_results = self.lp_model(frame, verbose=False)[0]
                lp_boxes = lp_results.boxes.data.tolist() if lp_results.boxes else []
            
            current_lane_density = len(tracks)
            ambulance_in_frame = False
            
            for tr in tracks:
                x1, y1, x2, y2, tid = tr
                tid = int(tid)
                bbox = self.car_smoother.update(tid, [x1, y1, x2, y2])
                sx1, sy1, sx2, sy2 = map(int, bbox)

                color = (0, 255, 0) # Green (Normal)
                
                is_wrong_way = self.check_wrong_way(tid, [sx1, sy1, sx2, sy2])
                if is_wrong_way:
                     color = (0, 0, 255) # Red (Violation)
                     cv2.putText(frame, "WRONG WAY!", (sx1, sy1 - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                     if tid not in self.wrong_way_violations:
                         self.wrong_way_violations.append(tid)
                         self.db.log_violation(self.junction_id, "Wrong Way") # Log immediately

                if self.detect_ambulance(frame, bbox):
                    color = (255, 165, 0) # Orange/Blue for ambulance
                    ambulance_in_frame = True
                    cv2.putText(frame, "AMBULANCE", (sx1, sy2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Main Bounding Box
                cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), color, 2)
                
                # Find Plate (Optimized: Run every 5 frames or if unknown)
                existing_text = self.plate_smoother.get_best_text(tid)
                should_run_ocr = (self.tracker.frame_count % 5 == 0) or (existing_text['text'] == '0')

                if should_run_ocr:
                    for lp in lp_boxes:
                        lx1, ly1, lx2, ly2, lscore, _ = lp
                        lx_c, ly_c = (lx1+lx2)/2, (ly1+ly2)/2
                        if sx1 < lx_c < sx2 and sy1 < ly_c < sy2:
                            # It's a match, read it
                            plate_crop = frame[int(ly1):int(ly2), int(lx1):int(lx2)]
                            if plate_crop.shape[0] > 0 and plate_crop.shape[1] > 0:
                                p_text, p_score = read_license_plate(plate_crop)
                                if p_text:
                                    self.plate_smoother.update_text(tid, p_text, p_score)
                
                # --- BETTER DRAWING LOGIC ---
                # Get best plate text
                best_plate = self.plate_smoother.get_best_text(tid)['text']
                if best_plate == '0':
                    label = f"ID: {tid}"
                else:
                    label = f"ID: {tid} | {best_plate}"
                
                # Calculate Label Size
                (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
                
                # Draw Background Rectangle for Label (Top of Car)
                # Position: Above sx1, sy1
                box_x1 = sx1
                box_y1 = sy1 - text_h - 10
                box_x2 = sx1 + text_w + 10
                box_y2 = sy1
                
                # Ensure label doesn't go off-screen
                if box_y1 < 0: 
                    box_y1 = sy1
                    box_y2 = sy1 + text_h + 10
                    
                cv2.rectangle(frame, (int(box_x1), int(box_y1)), (int(box_x2), int(box_y2)), color, -1) # Filled box with car color
                cv2.putText(frame, label, (int(sx1 + 5), int(box_y2 - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)

            # Traffic Logic
            signal_status = self.traffic_controller.calculate_signal_duration(
                lane_density=current_lane_density, 
                ambulance_detected=ambulance_in_frame
            )
            
            # Periodic Data Sync to Supabase
            if time.time() - self.last_log_time > self.config.LOG_INTERVAL:
                congestion_level = "High" if current_lane_density > 15 else "Low"
                self.db.log_traffic_data(
                    junction_id=self.junction_id,
                    vehicle_count=current_lane_density,
                    congestion_level=congestion_level,
                    avg_speed=0 # Placeholder
                )
                self.last_log_time = time.time()
                print(f"[Junction {self.junction_id}] Synced: Density={current_lane_density}, Signal={signal_status['action']}")

            # --- VISUALIZATION & OUTPUT ---
            # Only draw if we need to Show GUI or Save Video
            if self.config.SHOW_GUI or self.config.SAVE_VIDEO:
                # Calculate FPS
                current_time = time.time()
                fps = 1 / (current_time - self.last_frame_time) if self.last_frame_time > 0 else 0
                self.last_frame_time = current_time

                # Draw Consolidated Info Box (Top Left Corner)
                # Background Box for better readability
                cv2.rectangle(frame, (10, 10), (350, 210), (0, 0, 0), -1)
                
                # 1. Location & ID
                cv2.putText(frame, f"LOC: {self.config.LOCATION}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                cv2.putText(frame, f"ID: {self.config.JUNCTION_ID} | FPS: {int(fps)}", (20, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
                
                # 2. Traffic Stats
                color_density = (0, 255, 0) if current_lane_density < 10 else (0, 0, 255)
                cv2.putText(frame, f"VEHICLES: {current_lane_density}", (20, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.7, color_density, 2)
                
                # 3. Emergency & Violations
                if ambulance_in_frame:
                    cv2.putText(frame, "AMBULANCE DETECTED!", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                elif self.wrong_way_violations:
                    cv2.putText(frame, f"VIOLATIONS: {len(self.wrong_way_violations)}", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                else:
                    cv2.putText(frame, "STATUS: NORMAL", (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

                # 4. Recent License Plates (List)
                cv2.putText(frame, "RECENT PLATES:", (20, 160), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)
                y_offset = 180
                # Get unique recent plates from visible cars
                visible_plates = []
                for tr in tracks:
                     tid = int(tr[4])
                     p_info = self.plate_smoother.get_best_text(tid)
                     if p_info['text'] != '0':
                         visible_plates.append(p_info['text'])
                
                # Display up to 3 recent plates
                for i, plate in enumerate(visible_plates[:3]):
                    cv2.putText(frame, f"- {plate}", (30, y_offset + (i*20)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

                # 4. Save Video
                if self.out:
                    self.out.write(frame)
                    
                # 5. Show GUI
                if self.config.SHOW_GUI:
                    cv2.imshow(f"Worker {self.junction_id}", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        print("Stop signal received.")
                        break
        
        # Cleanup
        if self.out:
            self.out.release()
        self.cap.release()
        cv2.destroyAllWindows()
