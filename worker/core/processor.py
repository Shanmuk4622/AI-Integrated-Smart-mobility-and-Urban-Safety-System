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
import psutil

# Add worker root to path so we can import 'sort' and 'services'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sort.sort import Sort
from .traffic_rules import TrafficController
# Import Supabase Service
from services.supabase_client import SupabaseService

# ==========================================
# SMART MOBILITY SYSTEM (WORKER VERSION)
# ==========================================

# EasyOCR will be initialized per-instance to avoid CUDA conflicts

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
    def get_last_bbox(self, track_id):
        if track_id in self.bbox_buffers and len(self.bbox_buffers[track_id]) > 0:
             return np.stack(self.bbox_buffers[track_id], axis=0).mean(axis=0).tolist()
        return None

class SpeedEstimator:
    """Estimate vehicle speed based on pixel movement"""
    def __init__(self, fps=30, pixels_per_meter=50):
        self.fps = fps
        self.pixels_per_meter = pixels_per_meter  # Calibration needed
        self.prev_positions = {}
        self.speeds = {}
    
    def update(self, track_id, bbox):
        """Calculate speed based on bbox center movement"""
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        current_pos = np.array([center_x, center_y])
        
        if track_id in self.prev_positions:
            prev_pos = self.prev_positions[track_id]
            
            # Calculate pixel distance
            pixel_distance = np.linalg.norm(current_pos - prev_pos)
            
            # Convert to meters
            meters = pixel_distance / self.pixels_per_meter
            
            # Convert to km/h (assuming 1 frame = 1/fps seconds)
            speed_mps = meters * self.fps
            speed_kmh = speed_mps * 3.6
            
            self.speeds[track_id] = speed_kmh
        
        self.prev_positions[track_id] = current_pos
        return self.speeds.get(track_id, 0.0)

class PerformanceMonitor:
    def __init__(self):
        self.frame_times = deque(maxlen=30)
        self.detection_confidences = deque(maxlen=100)
        self.total_detections = 0
        self.process = psutil.Process()
    
    def log_frame(self, frame_time):
        self.frame_times.append(frame_time)
    
    def log_detection(self, confidence):
        self.detection_confidences.append(confidence)
        self.total_detections += 1
    
    def get_fps(self):
        if len(self.frame_times) < 2:
            return 0.0
        avg_time = sum(self.frame_times) / len(self.frame_times)
        return 1.0 / avg_time if avg_time > 0 else 0.0
    
    def get_cpu_usage(self):
        return self.process.cpu_percent(interval=None)
    
    def get_memory_usage(self):
        mem = self.process.memory_info()
        return (mem.rss / 1024 / 1024)  # MB
    
    def get_avg_confidence(self):
        if not self.detection_confidences:
            return 0.0
        return sum(self.detection_confidences) / len(self.detection_confidences)

# --- WORKER CLASS ---

class JunctionProcessor:
    def __init__(self, junction_id: int, video_source: str, coco_model_path: str, lp_model_path: str, config_module=None, logger=None):
        self.junction_id = junction_id
        self.video_source = video_source
        self.config = config_module
        self.logger = logger  # Store logger instance
        
        # Initialize Supabase
        self.db = SupabaseService()
        
        # Models
        if self.logger:
            self.logger.info(f"Loading Models for Junction {junction_id}...")
        else:
            print(f"Loading Models for Junction {junction_id}...")
            
        self.coco_model = YOLO(coco_model_path)
        self.lp_model = YOLO(lp_model_path)
        
        if torch.cuda.is_available():
            self.coco_model.to('cuda')
            self.lp_model.to('cuda')
            if self.logger:
                self.logger.info("Using GPU for inference")
            else:
                print("Using GPU for inference")
        else:
            if self.logger:
                self.logger.warning("GPU not available, using CPU")
            else:
                print("GPU not available, using CPU")
        
        # Initialize EasyOCR after YOLO models to prevent CUDA conflicts
        if self.logger:
            self.logger.info("Initializing EasyOCR...")
        else:
            print("Initializing EasyOCR...")
        self.reader = easyocr.Reader(['en'], gpu=torch.cuda.is_available())

        # Trackers
        self.tracker = Sort(max_age=30, min_hits=3, iou_threshold=0.3)
        self.car_smoother = BoxSmoother(window=10)
        self.plate_smoother = PlateSmoother(bbox_window=10)
        # Configurable Speed Estimation
        fps = 30
        ppm = 50
        if self.config:
             fps = getattr(self.config, 'SPEED_CALCULATION_FPS', 30)
             ppm = getattr(self.config, 'PIXELS_PER_METER', 50)
             
        if self.logger:
            self.logger.info(f"Speed Est. Config: FPS={fps}, PPM={ppm}")
        else:
            print(f"Speed Est. Config: FPS={fps}, PPM={ppm}")

        self.speed_estimator = SpeedEstimator(fps=fps, pixels_per_meter=ppm)
        self.perf_monitor = PerformanceMonitor()
        self.last_health_log = time.time()
        
        # Data
        self.vehicles_class_ids = [2, 3, 5, 7] # car, motorcycle, bus, truck (COCO)
        self.latest_lp_boxes = []
        self.vehicle_speeds = {}
        self.active_emergency_vehicles = {}  # track_id -> emergency_db_id
        
        self.traffic_controller = TrafficController()
        
        self.cap = cv2.VideoCapture(self.video_source)
        if not self.cap.isOpened():
             # Try opening as int if it's a number (webcam)
             try:
                 source_int = int(self.video_source)
                 self.cap = cv2.VideoCapture(source_int)
             except ValueError:
                 raise ValueError(f"Could not open video source: {self.video_source}")
                 
        if not self.cap.isOpened():
            error_msg = f"Failed to open source {self.video_source}"
            if self.logger:
                self.logger.error(error_msg)
            else:
                print(f"ERROR: {error_msg}")

        # Configurable Output
        self.out = None
        if self.config and self.config.SAVE_VIDEO:
            width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            fps = self.cap.get(cv2.CAP_PROP_FPS) or 30
            
            output_path = os.path.join(self.config.OUTPUT_DIR, f"processed_j{self.junction_id}_{int(time.time())}.mp4")
            self.out = cv2.VideoWriter(output_path, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))
            if self.logger:
                self.logger.info(f"Recording enabled. Saving to: {output_path}")
            else:
                print(f"Recursive Recording logic enabled. Saving to: {output_path}")

        # State
        self.wrong_way_violations = []
        self.last_log_time = 0
        self.last_frame_time = 0
        self.latest_lp_boxes = [] # Store for visualization
        self.last_snapshot_time = 0
        self.frame_count = 0

        # Sync Config to DB
        if self.config:
            self.db.update_junction_info(
                junction_id=self.junction_id,
                name=self.config.LOCATION_NAME,
                latitude=self.config.LATITUDE,
                longitude=self.config.LONGITUDE,
                video_source=self.video_source,
                fps=fps,
                ppm=ppm
            )

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

    def read_license_plate(self, license_plate_crop):
        """Read and validate license plate text from cropped image."""
        detections = self.reader.readtext(license_plate_crop)
        for detection in detections:
            bbox, text, score = detection
            text = text.upper().replace(' ', '')
            if license_complies_format(text):
                return format_license(text), score
        return None, None

    def start(self):
        if self.logger:
            self.logger.info(f"Junction {self.junction_id}: Processing started.")
        else:
            print(f"Junction {self.junction_id}: Processing started.")
        while self.cap.isOpened():
            frame_start = time.time()
            ret, frame = self.cap.read()
            if not ret:
                if self.logger:
                    self.logger.warning("End of stream, restarting...")
                else:
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
            
            # Performance Monitoring
            frame_time = time.time() - frame_start
            self.perf_monitor.log_frame(frame_time)
            
            # License Plates (Optimize: Run less frequently)
            frame_num = int(self.cap.get(cv2.CAP_PROP_POS_FRAMES))
            lp_boxes = []
            if frame_num % 5 == 0:
                lp_results = self.lp_model(frame, verbose=False)[0]
                lp_boxes = lp_results.boxes.data.tolist() if lp_results.boxes else []
                self.latest_lp_boxes = lp_boxes # Update cache
            else:
                lp_boxes = self.latest_lp_boxes # Use cached boxes for drawing/matching logic continuity
            
            current_lane_density = len(tracks)
            ambulance_in_frame = False
            
            # Match LPs to tracks
            matched_lps = {}
            for tr in tracks:
                x1, y1, x2, y2, tid = tr
                tid = int(tid)
                for lpb in lp_boxes:
                    lx1, ly1, lx2, ly2, lconf, lcls = lpb
                    lcx, lcy = (lx1+lx2)/2, (ly1+ly2)/2
                    if x1 < lcx < x2 and y1 < lcy < y2:
                        matched_lps[tid] = [lx1, ly1, lx2, ly2]
                        break

            for tr in tracks:
                x1, y1, x2, y2, tid = tr
                tid = int(tid)
                bbox = self.car_smoother.update(tid, [x1, y1, x2, y2])
                
                # Speed Calculation
                speed_kmh = self.speed_estimator.update(tid, bbox)
                self.vehicle_speeds[tid] = speed_kmh
                
                # Determine class based on IOU with detections
                # Simple approach: find closest detection center
                cls_id = -1
                score = 0.0
                cx, cy = (x1+x2)/2, (y1+y2)/2
                min_dist = 999999
                
                for d in detections:
                    dx, dy, dx2, dy2, dscore = d
                    dcx, dcy = (dx+dx2)/2, (dy+dy2)/2
                    dist = (cx-dcx)**2 + (cy-dcy)**2
                    if dist < min_dist:
                        min_dist = dist
                        score = dscore
                        # We need original class ID, but we only kept specific classes
                        # Re-check results to find class ID (optimization needed)
                        for orig_d in results.boxes.data.tolist():
                             if abs(orig_d[0]-dx)<1 and abs(orig_d[1]-dy)<1:
                                 cls_id = int(orig_d[5])
                                 break
                
                self.perf_monitor.log_detection(score)

                # Emergency Vehicle Detection
                if cls_id == 7: # Truck as Ambulance Proxy for this demo
                    if self.detect_ambulance(frame, bbox):
                        ambulance_in_frame = True
                        if tid not in self.active_emergency_vehicles:
                            # Estimate direction (simplified for now)
                            direction = 'unknown' 
                            emergency_id = self.db.log_emergency_vehicle(
                                junction_id=self.junction_id,
                                vehicle_type='ambulance', # Proxy
                                direction=direction, 
                                estimated_speed=speed_kmh
                            )
                            if emergency_id:
                                self.active_emergency_vehicles[tid] = emergency_id
                        else:
                            eid = self.active_emergency_vehicles[tid]
                            self.db.update_emergency_vehicle_last_seen(eid)

                # --- License Plate Logic ---
                license_plate = None
                if tid in matched_lps:
                    lp_box = matched_lps[tid]
                    # Update plate bbox smoother
                    self.plate_smoother.update_bbox(tid, lp_box)
                    
                    plate_crop = frame[int(lp_box[1]):int(lp_box[3]), int(lp_box[0]):int(lp_box[2])]
                    if plate_crop.shape[0] > 0 and plate_crop.shape[1] > 0:
                        p_text, p_score = self.read_license_plate(plate_crop)
                        if p_text:
                            self.plate_smoother.update_text(tid, p_text, p_score)
                    
                    best = self.plate_smoother.get_best_text(tid)
                    if best['text'] != '0' and best['score'] > 0.4:
                        license_plate = best['text']

                # --- Violation Logic ---
                violation_detected = False
                violation_type = None

                sx1, sy1, sx2, sy2 = map(int, bbox)

                color = (0, 255, 0) # Green (Normal)
                
                is_wrong_way = self.check_wrong_way(tid, [sx1, sy1, sx2, sy2])
                if is_wrong_way:
                     color = (0, 0, 255) # Red (Violation)
                     cv2.putText(frame, "WRONG WAY!", (sx1, sy1 - 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)
                     if tid not in self.wrong_way_violations:
                         self.wrong_way_violations.append(tid)
                         violation_type = "Wrong Way" # Set violation type for enhanced logging

                if self.detect_ambulance(frame, bbox):
                    color = (255, 165, 0) # Orange/Blue for ambulance
                    ambulance_in_frame = True
                    cv2.putText(frame, "AMBULANCE", (sx1, sy2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                # Main Bounding Box
                cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), color, 2)
                
                # --- BETTER DRAWING LOGIC ---
                # Draw Plate BBox if available
                p_bbox = self.plate_smoother.get_last_bbox(tid)
                if p_bbox:
                    px1, py1, px2, py2 = map(int, p_bbox)
                    cv2.rectangle(frame, (px1, py1), (px2, py2), (255, 255, 0), 2) # Cyan for plate

                
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

                # Enhanced Violation Logging
                if violation_type:
                    # Crop violation area
                    # Ensure coords are within frame
                    h, w, _ = frame.shape
                    vx1, vy1, vx2, vy2 = max(0, int(x1)), max(0, int(y1)), min(w, int(x2)), min(h, int(y2))
                    violation_crop = frame[vy1:vy2, vx1:vx2]
                    
                    # Log to DB
                    violation_id = self.db.log_violation_enhanced(
                        junction_id=self.junction_id,
                        violation_type=violation_type,
                        confidence_score=float(score),
                        vehicle_speed=float(speed_kmh),
                        license_plate=license_plate,
                        image_url=None # Placeholder
                    )
                    
                    # Upload Image
                    if violation_id and violation_crop.size > 0:
                        self.db.upload_violation_image(violation_crop, self.junction_id, violation_id)
            
            # Log Worker Health
            if time.time() - self.last_health_log > 30:
                self.db.log_worker_health(
                    junction_id=self.junction_id,
                    fps=self.perf_monitor.get_fps(),
                    cpu_usage=self.perf_monitor.get_cpu_usage(),
                    memory_usage=self.perf_monitor.get_memory_usage(),
                    avg_detection_confidence=self.perf_monitor.get_avg_confidence(),
                    total_detections=self.perf_monitor.total_detections,
                    status='running'
                )
                self.last_health_log = time.time()

            # Traffic Logic
            signal_status = self.traffic_controller.calculate_signal_duration(
                lane_density=current_lane_density, 
                ambulance_detected=ambulance_in_frame
            )
            
            # Logging Traffic Data
            if time.time() - self.last_log_time > self.config.LOG_INTERVAL:
                congestion_level = "Low"
                if current_lane_density > 5: congestion_level = "Medium"
                if current_lane_density > 10: congestion_level = "High"

                if self.logger:
                    self.logger.info(f"Junction {self.junction_id} Stats: Count={current_lane_density}, Speed={0.0}, Congestion={congestion_level}")
                    if ambulance_in_frame:
                         self.logger.info(f"🚑 Ambulance Detected at Junction {self.junction_id}!")
                else:
                    print(f"[{time.strftime('%H:%M:%S')}] Junction {self.junction_id}: {current_lane_density} vehicles. Congestion: {congestion_level}")
                    if ambulance_in_frame:
                        print("🚑 Ambulance Detected!")

                # Calculate avg speed for frame
                avg_speed = 0.0
                if len(self.vehicle_speeds) > 0:
                     avg_speed = sum(self.vehicle_speeds.values()) / len(self.vehicle_speeds)

                self.db.log_traffic_data(self.junction_id, current_lane_density, congestion_level, avg_speed)
                self.last_log_time = time.time()
                if self.logger:
                    self.logger.debug(f"Synced: Density={current_lane_density}, Signal={signal_status['action']}")
                else:
                    print(f"[Junction {self.junction_id}] Synced: Density={current_lane_density}, Signal={signal_status['action']}")

            # --- LIVE SNAPSHOT UPLOAD (1 FPS) ---
            current_time = time.time()
            if current_time - self.last_snapshot_time >= 1.0:
                # Upload the frame (annotated)
                self.db.upload_frame_snapshot(frame, self.junction_id)
                self.last_snapshot_time = current_time
                
                # Helper cleanup (1% chance per scan to act as 'cron')
                if self.frame_count % 100 == 0:
                     self.db.cleanup_old_snapshots(self.junction_id)

            self.frame_count += 1

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
                cv2.putText(frame, f"LOC: {self.config.LOCATION_NAME}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
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
                        if self.logger:
                            self.logger.info("Stop signal received.")
                        else:
                            print("Stop signal received.")
                        break
        
        # Cleanup
        self.stop()
        
    def stop(self):
        if self.logger:
            self.logger.info("Stopping Worker...")
        else:
            print("Stopping Worker...")
        # 1. Update DB Status
        try:
            if self.config:
                self.db.update_status(self.junction_id, "offline")
        except Exception as e:
            if self.logger:
                self.logger.error(f"Error during shutdown sync: {e}")
            else:
                print(f"Error during shutdown sync: {e}")

        # 2. Release Resources
        if self.out:
            self.out.release()
        if self.cap:
             self.cap.release()
        cv2.destroyAllWindows()
        if self.logger:
            self.logger.info("Worker Stopped Cleanly.")
        else:
            print("Worker Stopped Cleanly.")
