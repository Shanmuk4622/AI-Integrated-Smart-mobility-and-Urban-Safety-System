import cv2
import numpy as np
import string
import easyocr
from collections import deque, defaultdict
from ultralytics import YOLO
import sys
import os
import matplotlib
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import glob
import time
import argparse
import torch
from filterpy.kalman import KalmanFilter
from .traffic_rules import TrafficController

# ==========================================
# SORT ALGORITHM (Embedded to avoid import errors)
# ==========================================

np.random.seed(0)

def linear_assignment(cost_matrix):
  try:
    import lap
    _, x, y = lap.lapjv(cost_matrix, extend_cost=True)
    return np.array([[y[i],i] for i in x if i >= 0])
  except ImportError:
    from scipy.optimize import linear_sum_assignment
    x, y = linear_sum_assignment(cost_matrix)
    return np.array(list(zip(x, y)))

def iou_batch(bb_test, bb_gt):
  bb_gt = np.expand_dims(bb_gt, 0)
  bb_test = np.expand_dims(bb_test, 1)
  
  xx1 = np.maximum(bb_test[..., 0], bb_gt[..., 0])
  yy1 = np.maximum(bb_test[..., 1], bb_gt[..., 1])
  xx2 = np.minimum(bb_test[..., 2], bb_gt[..., 2])
  yy2 = np.minimum(bb_test[..., 3], bb_gt[..., 3])
  w = np.maximum(0., xx2 - xx1)
  h = np.maximum(0., yy2 - yy1)
  wh = w * h
  o = wh / ((bb_test[..., 2] - bb_test[..., 0]) * (bb_test[..., 3] - bb_test[..., 1])                                      
    + (bb_gt[..., 2] - bb_gt[..., 0]) * (bb_gt[..., 3] - bb_gt[..., 1]) - wh)                                              
  return(o)  

def convert_bbox_to_z(bbox):
  w = bbox[2] - bbox[0]
  h = bbox[3] - bbox[1]
  x = bbox[0] + w/2.
  y = bbox[1] + h/2.
  s = w * h    
  r = w / float(h)
  return np.array([x, y, s, r]).reshape((4, 1))

def convert_x_to_bbox(x,score=None):
  w = np.sqrt(x[2] * x[3])
  h = x[2] / w
  if(score==None):
    return np.array([x[0]-w/2.,x[1]-h/2.,x[0]+w/2.,x[1]+h/2.]).reshape((1,4))
  else:
    return np.array([x[0]-w/2.,x[1]-h/2.,x[0]+w/2.,x[1]+h/2.,score]).reshape((1,5))

class KalmanBoxTracker(object):
  count = 0
  def __init__(self,bbox):
    self.kf = KalmanFilter(dim_x=7, dim_z=4) 
    self.kf.F = np.array([[1,0,0,0,1,0,0],[0,1,0,0,0,1,0],[0,0,1,0,0,0,1],[0,0,0,1,0,0,0],  [0,0,0,0,1,0,0],[0,0,0,0,0,1,0],[0,0,0,0,0,0,1]])
    self.kf.H = np.array([[1,0,0,0,0,0,0],[0,1,0,0,0,0,0],[0,0,1,0,0,0,0],[0,0,0,1,0,0,0]])
    self.kf.R[2:,2:] *= 10.
    self.kf.P[4:,4:] *= 1000. 
    self.kf.P *= 10.
    self.kf.Q[-1,-1] *= 0.01
    self.kf.Q[4:,4:] *= 0.01
    self.kf.x[:4] = convert_bbox_to_z(bbox)
    self.time_since_update = 0
    self.id = KalmanBoxTracker.count
    KalmanBoxTracker.count += 1
    self.history = []
    self.hits = 0
    self.hit_streak = 0
    self.age = 0

  def update(self,bbox):
    self.time_since_update = 0
    self.history = []
    self.hits += 1
    self.hit_streak += 1
    self.kf.update(convert_bbox_to_z(bbox))

  def predict(self):
    if((self.kf.x[6]+self.kf.x[2])<=0):
      self.kf.x[6] *= 0.0
    self.kf.predict()
    self.age += 1
    if(self.time_since_update>0):
      self.hit_streak = 0
    self.time_since_update += 1
    self.history.append(convert_x_to_bbox(self.kf.x))
    return self.history[-1]

  def get_state(self):
    return convert_x_to_bbox(self.kf.x)

def associate_detections_to_trackers(detections,trackers,iou_threshold = 0.3):
  if(len(trackers)==0):
    return np.empty((0,2),dtype=int), np.arange(len(detections)), np.empty((0,5),dtype=int)
  iou_matrix = iou_batch(detections, trackers)
  if min(iou_matrix.shape) > 0:
    a = (iou_matrix > iou_threshold).astype(np.int32)
    if a.sum(1).max() == 1 and a.sum(0).max() == 1:
        matched_indices = np.stack(np.where(a), axis=1)
    else:
      matched_indices = linear_assignment(-iou_matrix)
  else:
    matched_indices = np.empty(shape=(0,2))
  unmatched_detections = []
  for d, det in enumerate(detections):
    if(d not in matched_indices[:,0]):
      unmatched_detections.append(d)
  unmatched_trackers = []
  for t, trk in enumerate(trackers):
    if(t not in matched_indices[:,1]):
      unmatched_trackers.append(t)
  matches = []
  for m in matched_indices:
    if(iou_matrix[m[0], m[1]]<iou_threshold):
      unmatched_detections.append(m[0])
      unmatched_trackers.append(m[1])
    else:
      matches.append(m.reshape(1,2))
  if(len(matches)==0):
    matches = np.empty((0,2),dtype=int)
  else:
    matches = np.concatenate(matches,axis=0)
  return matches, np.array(unmatched_detections), np.array(unmatched_trackers)

class Sort(object):
  def __init__(self, max_age=1, min_hits=3, iou_threshold=0.3):
    self.max_age = max_age
    self.min_hits = min_hits
    self.iou_threshold = iou_threshold
    self.trackers = []
    self.frame_count = 0

  def update(self, dets=np.empty((0, 5))):
    self.frame_count += 1
    trks = np.zeros((len(self.trackers), 5))
    to_del = []
    ret = []
    for t, trk in enumerate(trks):
      pos = self.trackers[t].predict()[0]
      trk[:] = [pos[0], pos[1], pos[2], pos[3], 0]
      if np.any(np.isnan(pos)):
        to_del.append(t)
    trks = np.ma.compress_rows(np.ma.masked_invalid(trks))
    for t in reversed(to_del):
      self.trackers.pop(t)
    matched, unmatched_dets, unmatched_trks = associate_detections_to_trackers(dets,trks, self.iou_threshold)
    for m in matched:
      self.trackers[m[1]].update(dets[m[0], :])
    for i in unmatched_dets:
        trk = KalmanBoxTracker(dets[i,:])
        self.trackers.append(trk)
    i = len(self.trackers)
    for trk in reversed(self.trackers):
        d = trk.get_state()[0]
        if (trk.time_since_update < 1) and (trk.hit_streak >= self.min_hits or self.frame_count <= self.min_hits):
          ret.append(np.concatenate((d,[trk.id+1])).reshape(1,-1)) 
        i -= 1
        if(trk.time_since_update > self.max_age):
          self.trackers.pop(i)
    if(len(ret)>0):
      return np.concatenate(ret)
    return np.empty((0,5))

# ==========================================
# SMART MOBILITY SYSTEM
# ==========================================

# Helper functions and classes from original ALPR (Copied for stability)
# Enable GPU for EasyOCR
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

def get_car(license_plate, vehicle_track_ids):
    x1, y1, x2, y2, score, class_id = license_plate
    for vehicle in vehicle_track_ids:
        xcar1, ycar1, xcar2, ycar2, car_id = vehicle
        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            return vehicle
    return -1, -1, -1, -1, -1

class BoxSmoother:
    def __init__(self, window=30): # Increased window for better trajectory analysis
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
        # Use GPU (device=0) if available
        self.coco_model = YOLO(coco_model_path)
        self.lp_model = YOLO(lp_model_path)
        
        # Explicit transfer to GPU just in case (YOLO usually auto-detects but being safe)
        if torch.cuda.is_available():
            self.coco_model.to('cuda')
            self.lp_model.to('cuda')
        
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
        
        print(f"DEBUG: SmartMobilitySystem Initialized. Video: {self.video_path}")
        if not self.cap.isOpened():
            print("ERROR: Could not open video file!")


    def detect_ambulance(self, frame, box):
        """
        Detects ambulance based on color analysis (Red/White dominance) on 'truck'/'bus' class vehicles.
        """
        x1, y1, x2, y2 = map(int, box)
        if x1 < 0 or y1 < 0 or x2 > frame.shape[1] or y2 > frame.shape[0]:
            return False
        
        # Crop vehicle
        vehicle_roi = frame[y1:y2, x1:x2]
        if vehicle_roi.size == 0: return False

        # Convert to HSV for color detection
        hsv = cv2.cvtColor(vehicle_roi, cv2.COLOR_BGR2HSV)
        
        # Red color range (0-10 and 170-180 for Hue)
        lower_red1 = np.array([0, 70, 50])
        upper_red1 = np.array([10, 255, 255])
        lower_red2 = np.array([170, 70, 50])
        upper_red2 = np.array([180, 255, 255])
        
        mask1 = cv2.inRange(hsv, lower_red1, upper_red1)
        mask2 = cv2.inRange(hsv, lower_red2, upper_red2)
        mask = mask1 + mask2
        
        # Calculate red ratio
        total_pixels = vehicle_roi.shape[0] * vehicle_roi.shape[1]
        red_pixels = cv2.countNonZero(mask)
        
        red_ratio = red_pixels / total_pixels
        
        # Threshold for "Ambulance" (Tune as needed, e.g., > 10% red)
        if red_ratio > 0.15:
            return True
        return False

    def check_wrong_way(self, track_id, current_pos):
        """
        Checks if vehicle is moving in the wrong direction.
        Assumption: Allowed direction is DOWN (y increases). Moving UP significantly is a violation.
        """
        history = self.car_smoother.buffers[track_id]
        if len(history) < 20: return False # Need sufficient history
        
        # Compare current Y with oldest Y in buffer
        # history is a deque of [x1, y1, x2, y2]
        x_old, y_old, _, _ = history[0]
        _, y_new, _, _ = current_pos 
        
        # Check if moving UP (y decreasing) significantly
        # Threshold: 50 pixels over ~1 second
        if y_new < y_old - 50:
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
                
                # Check Wrong Way
                is_wrong_way = self.check_wrong_way(tid, [sx1, sy1, sx2, sy2])
                
                # Draw Car
                color = (0, 255, 0) # Green (Normal)
                
                if is_wrong_way:
                     color = (0, 0, 255) # Red (Violation)
                     cv2.putText(frame, "WRONG WAY!", (sx1, sy1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 2)
                     if tid not in self.wrong_way_violations:
                         self.wrong_way_violations.append(tid)

                if self.detect_ambulance(frame, bbox):
                    color = (255, 165, 0) # Orange/Blue for ambulance
                    ambulance_in_frame = True
                    cv2.putText(frame, "AMBULANCE", (sx1, sy2 + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                
                cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), color, 3)
                
                # Find Plate (Optimized: Run every 5 frames or if unknown)
                # Check if we already have a good plate for this car
                existing_text = self.plate_smoother.get_best_text(tid)
                should_run_ocr = (self.tracker.frame_count % 5 == 0) or (existing_text['text'] == '0')

                if should_run_ocr:
                    for lp in lp_boxes:
                        lx1, ly1, lx2, ly2, lscore, _ = lp
                        # Check overlap with car bbox
                        # Intersection over Union or just Intersection?
                        # Simple inclusion center check
                        lx_c, ly_c = (lx1+lx2)/2, (ly1+ly2)/2
                        if sx1 < lx_c < sx2 and sy1 < ly_c < sy2:
                            # It's a match
                            plate_crop = frame[int(ly1):int(ly2), int(lx1):int(lx2)]
                            if plate_crop.shape[0] > 0 and plate_crop.shape[1] > 0:
                                p_text, p_score = read_license_plate(plate_crop)
                                if p_text:
                                    self.plate_smoother.update_text(tid, p_text, p_score)
                                
                # DRAW INFO ON CAR
                # 1. ID Box
                cv2.rectangle(frame, (sx1, sy1-30), (sx1+80, sy1), (0,0,0), -1)
                cv2.putText(frame, f"ID:{tid}", (sx1+5, sy1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
                
                # 2. Plate Box (Black Background, White Text) if visible
                best = self.plate_smoother.get_best_text(tid)
                if best['text'] != '0':
                     # Calculate text size
                     (mask_w, mask_h), _ = cv2.getTextSize(best['text'], cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
                     # Draw background box at bottom of car
                     cv2.rectangle(frame, (sx1, sy2), (sx1 + mask_w + 10, sy2 + 30), (0, 0, 0), -1)
                     # Draw Text
                     cv2.putText(frame, best['text'], (sx1 + 5, sy2 + 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)

            # 4. Traffic Control Logic
            signal_status = self.traffic_controller.calculate_signal_duration(
                lane_density=current_lane_density, 
                ambulance_detected=ambulance_in_frame
            )
            
            # --- VISUALIZATION OVERLAY ---
            
            # Main Info Bar (Top)
            cv2.rectangle(frame, (0, 0), (frame.shape[1], 80), (0, 0, 0), -1)
            
            # 1. Signal Status
            sig_color = (0, 255, 0) if signal_status['action'] == "GREEN" else (0, 0, 255)
            cv2.putText(frame, f"SIGNAL: {signal_status['action']}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, sig_color, 3)
            cv2.putText(frame, f"{signal_status['duration']}s", (280, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            
            # 2. Density
            cv2.putText(frame, f"DENSITY: {current_lane_density} Veh", (450, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 0), 2)
            
            # 3. Emergency Status
            if ambulance_in_frame:
                cv2.rectangle(frame, (800, 10), (1250, 70), (0, 0, 255), -1)
                cv2.putText(frame, "EMERGENCY: GREEN CORRIDOR", (820, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
                # Flashing border effect
                if int(time.time() * 10) % 2 == 0:
                    cv2.rectangle(frame, (0, 0), (frame.shape[1], frame.shape[0]), (0, 0, 255), 10)
            elif self.wrong_way_violations:
                cv2.putText(frame, f"VIOLATIONS: {len(self.wrong_way_violations)}", (850, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 165, 255), 2)
            else:
                cv2.putText(frame, "STATUS: NORMAL", (850, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (200, 200, 200), 2)


            # Yield frame (encoded) and stats
            _, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            
            # Gather visible plates
            visible_plates = []
            for tr in tracks:
                 tid = int(tr[4])
                 p_info = self.plate_smoother.get_best_text(tid)
                 if p_info['text'] != '0':
                     visible_plates.append({"id": tid, "text": p_info['text']})

            stats = {
                "density": current_lane_density,
                "signal": signal_status,
                "ambulance": ambulance_in_frame,
                "violations": len(self.wrong_way_violations),
                "plates": visible_plates
            }
            
            yield frame_bytes, stats
