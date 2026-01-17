import cv2
import numpy as np
import string
import easyocr
from collections import deque, defaultdict
from ultralytics import YOLO
# Adjust path if needed or copy the sort module. Assuming sort is in requirements or strictly local.
# Since user had 'sort' folder, we might need to copy it or fix path.
# For now, assuming we can import Sort if we fix sys.path.
import sys
import os

# Add the original project to path to find 'sort' if needed, or we just rely on it being there.
# But better to copy 'sort' folder to backend/app/core/sort if it's a specific local file.
# For this implementation, I will assume we might need to patch sys.path or move sort.
# Let's assume we place this file in backend/app/core/
# We will point to models relative to project root.

from .traffic_rules import TrafficController

# Helper functions and classes from original ALPR (Copied for stability)
reader = easyocr.Reader(['en'], gpu=False)

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

def get_car(license_plate, vehicle_track_ids):
    x1, y1, x2, y2, score, class_id = license_plate
    for vehicle in vehicle_track_ids:
        xcar1, ycar1, xcar2, ycar2, car_id = vehicle
        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            return vehicle
    return -1, -1, -1, -1, -1

class BoxSmoother:
    def __init__(self, window=5):
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

# --- smart mobility system class ---

class SmartMobilitySystem:
    def __init__(self, video_path, coco_model_path, lp_model_path):
        self.video_path = video_path
        self.coco_model = YOLO(coco_model_path)
        self.lp_model = YOLO(lp_model_path)
        
        # We need SORT. Using a placeholder or assuming it is available.
        # Ideally, we should copy the `sort` folder to backend/app/core/sort
        # For now, I will assume the user has `sort` installed or I explain this dependency.
        from .sort.sort import Sort 
        self.tracker = Sort()
        
        self.traffic_controller = TrafficController()
        
        self.car_smoother = BoxSmoother()
        self.plate_smoother = PlateSmoother()
        
        self.vehicles_class_ids = [2, 3, 5, 7] # car, motorcycle, bus, truck
        
        self.cap = cv2.VideoCapture(self.video_path)
        
        # Stats
        self.total_cars = 0
        self.ambulance_detected = False
        self.wrong_way_violations = []

    def detect_ambulance(self, frame, box):
        # Placeholder: Analyze ROI for ambulance visual features (White/Red crosses)
        # Or check if class_id is specific.
        # For demo, we can just return False or toggle with a key.
        return False

    def check_wrong_way(self, track_id, previous_positions, current_pos):
        # Logic to check vector direction
        if len(previous_positions) < 10: return False
        # Simplified: moving down (y increases) is OK. Moving Up (y decreases) is WRONG.
        y_start = previous_positions[0][1]
        y_end = current_pos[1]
        if y_end < y_start - 50: # Moved up significantly
            return True
        return False

    def process_stream(self):
        """
        Generator that yields frames and stats
        """
        while self.cap.isOpened():
            ret, frame = self.cap.read()
            if not ret:
                self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                continue

            # 1. Detection
            results = self.coco_model(frame, verbose=False)[0]
            detections = []
            for d in results.boxes.data.tolist():
                x1, y1, x2, y2, score, cls = d
                if int(cls) in self.vehicles_class_ids:
                    detections.append([x1, y1, x2, y2, score])
            
            # 2. Tracking
            tracks = self.tracker.update(np.asarray(detections))
            
            # 3. License Plates
            lp_results = self.lp_model(frame, verbose=False)[0]
            lp_boxes = lp_results.boxes.data.tolist() if lp_results.boxes else []
            
            current_lane_density = len(tracks)
            ambulance_in_frame = False
            
            for tr in tracks:
                x1, y1, x2, y2, tid = tr
                tid = int(tid)
                
                # Smooth box
                bbox = self.car_smoother.update(tid, [x1, y1, x2, y2])
                sx1, sy1, sx2, sy2 = map(int, bbox)
                
                # Check Wrong Way (Mock logic)
                # self.check_wrong_way(tid, ...)
                
                # Draw Car
                color = (0, 255, 0)
                if self.detect_ambulance(frame, bbox):
                    color = (255, 0, 0) # Blue for ambulance
                    ambulance_in_frame = True
                
                cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), color, 3)
                
                # Find Plate
                # Logic similar to ALPR original...
                # (Skipped detailed OCR calls for brevity in this first pass, can add back)

            # 4. Traffic Control Logic
            signal_status = self.traffic_controller.calculate_signal_duration(
                lane_density=current_lane_density, 
                ambulance_detected=ambulance_in_frame
            )
            
            # Overlay Signal Status
            status_text = f"Signal: {signal_status['action']} ({signal_status['duration']}s)"
            cv2.rectangle(frame, (10, 10), (400, 60), (0, 0, 0), -1)
            cv2.putText(frame, status_text, (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            if ambulance_in_frame:
                 cv2.putText(frame, "AMBULANCE DETECTED!", (20, 80), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

            # Yield frame (encoded) and stats
            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            stats = {
                "density": current_lane_density,
                "signal": signal_status,
                "ambulance": ambulance_in_frame
            }
            
            yield frame_bytes, stats

