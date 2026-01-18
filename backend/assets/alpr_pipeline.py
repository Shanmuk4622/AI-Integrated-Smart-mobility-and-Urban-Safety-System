"""
Automatic License Plate Recognition (ALPR) Pipeline
Complete standalone implementation with all dependencies integrated.

This module contains everything needed to run real-time ALPR:
- Vehicle and license plate detection using YOLOv8
- Object tracking using SORT
- OCR for license plate text extraction
- Smoothing algorithms for stable bounding boxes
- Complete video processing pipeline
"""

import cv2
import numpy as np
import string
import easyocr
from collections import deque, defaultdict
from ultralytics import YOLO
from sort.sort import Sort


# =============================================================================
# OCR INITIALIZATION AND CHARACTER MAPPING
# =============================================================================

# Initialize the OCR reader
reader = easyocr.Reader(['en'], gpu=False)

# Mapping dictionaries for character conversion (license plate format correction)
dict_char_to_int = {
    'O': '0', 'I': '1', 'J': '3', 'A': '4', 'G': '6', 'S': '5'
}

dict_int_to_char = {
    '0': 'O', '1': 'I', '3': 'J', '4': 'A', '6': 'G', '5': 'S'
}


# =============================================================================
# UTILITY FUNCTIONS FOR LICENSE PLATE PROCESSING
# =============================================================================

def license_complies_format(text):
    """
    Check if the license plate text complies with the required format.
    Expected format: 2 letters + 2 digits + 3 letters (e.g., AB12CDE)

    Args:
        text (str): License plate text.

    Returns:
        bool: True if the license plate complies with the format, False otherwise.
    """
    if len(text) != 7:
        return False

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
    """
    Format the license plate text by converting characters using the mapping dictionaries.
    Corrects common OCR mistakes (e.g., O->0 in digit positions, 0->O in letter positions)

    Args:
        text (str): License plate text.

    Returns:
        str: Formatted license plate text.
    """
    license_plate_ = ''
    # Positions: 0,1 = letters, 2,3 = digits, 4,5,6 = letters
    mapping = {
        0: dict_int_to_char, 1: dict_int_to_char, 
        4: dict_int_to_char, 5: dict_int_to_char, 6: dict_int_to_char,
        2: dict_char_to_int, 3: dict_char_to_int
    }
    
    for j in [0, 1, 2, 3, 4, 5, 6]:
        if text[j] in mapping[j].keys():
            license_plate_ += mapping[j][text[j]]
        else:
            license_plate_ += text[j]

    return license_plate_


def read_license_plate(license_plate_crop):
    """
    Read the license plate text from the given cropped image using OCR.

    Args:
        license_plate_crop (numpy.ndarray): Cropped image containing the license plate.

    Returns:
        tuple: (formatted_text, confidence_score) or (None, None) if no valid plate found.
    """
    detections = reader.readtext(license_plate_crop)

    for detection in detections:
        bbox, text, score = detection
        text = text.upper().replace(' ', '')

        if license_complies_format(text):
            return format_license(text), score

    return None, None


def get_car(license_plate, vehicle_track_ids):
    """
    Match a detected license plate to its parent vehicle using spatial overlap.
    A license plate is assigned to a vehicle if it's completely inside the vehicle's bbox.

    Args:
        license_plate (tuple): (x1, y1, x2, y2, score, class_id) of the license plate.
        vehicle_track_ids (list): List of tracked vehicles [(x1, y1, x2, y2, id), ...].

    Returns:
        tuple: Vehicle coordinates and ID (x1, y1, x2, y2, id) or (-1, -1, -1, -1, -1).
    """
    x1, y1, x2, y2, score, class_id = license_plate

    for vehicle in vehicle_track_ids:
        xcar1, ycar1, xcar2, ycar2, car_id = vehicle
        
        # Check if license plate is completely inside the vehicle bbox
        if x1 > xcar1 and y1 > ycar1 and x2 < xcar2 and y2 < ycar2:
            return vehicle

    return -1, -1, -1, -1, -1


# =============================================================================
# SMOOTHING CLASSES FOR STABLE TRACKING
# =============================================================================

class BoxSmoother:
    """
    Maintains a moving average of bounding boxes per track_id.
    Reduces jitter and provides stable bounding box visualization.
    """
    def __init__(self, window=5):
        """
        Args:
            window (int): Number of frames to average (larger = smoother but more lag)
        """
        self.window = window
        self.buffers = defaultdict(lambda: deque(maxlen=self.window))

    def update(self, track_id, bbox):
        """
        Add a new bounding box and return the smoothed average.

        Args:
            track_id (int): Unique identifier for the tracked object.
            bbox (list): Bounding box [x1, y1, x2, y2].

        Returns:
            list: Smoothed bounding box [x1, y1, x2, y2].
        """
        self.buffers[track_id].append(np.array(bbox, dtype=float))
        arr = np.stack(self.buffers[track_id], axis=0)
        return arr.mean(axis=0).tolist()

    def get(self, track_id, default_bbox=None):
        """
        Get the current smoothed bbox without updating.

        Args:
            track_id (int): Unique identifier for the tracked object.
            default_bbox: Value to return if track_id not found.

        Returns:
            list: Smoothed bounding box or default_bbox.
        """
        buf = self.buffers.get(track_id, None)
        if buf and len(buf) > 0:
            arr = np.stack(buf, axis=0)
            return arr.mean(axis=0).tolist()
        return default_bbox


class PlateSmoother:
    """
    Manages license plate bounding box smoothing and tracks the best OCR result.
    Retains the highest confidence plate text for each vehicle throughout tracking.
    """
    def __init__(self, bbox_window=5):
        """
        Args:
            bbox_window (int): Number of frames to average for bbox smoothing.
        """
        self.bbox_window = bbox_window
        self.bbox_buffers = defaultdict(lambda: deque(maxlen=self.bbox_window))
        self.best_text = {}  # track_id -> {'text': str, 'score': float}

    def update_bbox(self, track_id, bbox):
        """
        Add a new plate bbox and return the smoothed average.

        Args:
            track_id (int): Vehicle ID this plate belongs to.
            bbox (list): Plate bounding box [x1, y1, x2, y2].

        Returns:
            list: Smoothed bounding box [x1, y1, x2, y2].
        """
        self.bbox_buffers[track_id].append(np.array(bbox, dtype=float))
        arr = np.stack(self.bbox_buffers[track_id], axis=0)
        return arr.mean(axis=0).tolist()

    def update_text(self, track_id, text, score):
        """
        Update the best OCR text if the new score is higher.

        Args:
            track_id (int): Vehicle ID this plate belongs to.
            text (str): Extracted license plate text.
            score (float): OCR confidence score.
        """
        if text is None or text == '':
            return
        
        prev = self.best_text.get(track_id, {'text': '0', 'score': 0.0})
        if score is None:
            score = 0.0
        
        if score >= prev['score']:
            self.best_text[track_id] = {'text': text, 'score': float(score)}

    def get_best_text(self, track_id):
        """
        Retrieve the best OCR result for a vehicle.

        Args:
            track_id (int): Vehicle ID.

        Returns:
            dict: {'text': str, 'score': float}
        """
        return self.best_text.get(track_id, {'text': '0', 'score': 0.0})


# =============================================================================
# MAIN ALPR PIPELINE
# =============================================================================

def alpr_realtime(
    video_path="Videos/sample2.mp4",
    coco_weights="yolov8n.pt",
    lp_weights="license_plate_detector.pt",
    vehicles=(2, 3, 5, 7),
    target_fps=10,
    smooth_window=5,
    show=True,
    save_path="Videos/out.avi",
    codec="XVID"
):
    """
    Real-time Automatic License Plate Recognition Pipeline.
    
    This function performs end-to-end ALPR in a single loop:
    1. Detect vehicles using YOLOv8 (COCO model)
    2. Track vehicles across frames using SORT
    3. Detect license plates using custom YOLOv8 model
    4. Match plates to vehicles
    5. Extract text using OCR (EasyOCR)
    6. Apply smoothing to bounding boxes
    7. Draw overlays (bboxes + text)
    8. Display and save output video

    Args:
        video_path (str): Path to input video file.
        coco_weights (str): Path to YOLOv8 vehicle detection model.
        lp_weights (str): Path to YOLOv8 license plate detection model.
        vehicles (tuple): COCO class IDs for vehicles (2=car, 3=motorcycle, 5=bus, 7=truck).
        target_fps (int): Processing framerate (lower = faster, skip more frames).
        smooth_window (int): Moving average window size for bbox smoothing.
        show (bool): Display live video window during processing.
        save_path (str): Path to save output video.
        codec (str): Video codec ('XVID' for .avi, 'mp4v' for .mp4).

    Raises:
        RuntimeError: If video cannot be opened or VideoWriter fails.
    """
    print("=" * 70)
    print("AUTOMATIC LICENSE PLATE RECOGNITION SYSTEM")
    print("=" * 70)
    print(f"📹 Video: {video_path}")
    print(f"🚗 Vehicle Model: {coco_weights}")
    print(f"🔢 Plate Model: {lp_weights}")
    print(f"⚡ Target FPS: {target_fps}")
    print(f"🎯 Smooth Window: {smooth_window}")
    print("=" * 70)

    # Load detection models
    print("Loading YOLOv8 models...")
    coco_model = YOLO(coco_weights)
    lp_model = YOLO(lp_weights)
    print("✅ Models loaded successfully!")

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"❌ Cannot open video: {video_path}")


    # Get video properties
    input_fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_step = max(1, int(input_fps / target_fps))

    print(f"📊 Video Info: {width}x{height} @ {input_fps} FPS ({total_frames} frames)")
    print(f"⏭️  Frame Skip: Processing every {frame_step} frame(s)")

    # Setup video writer to match processed FPS
    fourcc = cv2.VideoWriter_fourcc(*codec)
    out = cv2.VideoWriter(save_path, fourcc, target_fps, (width, height))
    if not out.isOpened():
        raise RuntimeError("❌ VideoWriter failed. Try a different codec/container.")
    print(f"💾 Output: {save_path}")

    # Create display window
    if show:
        cv2.namedWindow("ALPR-Realtime", cv2.WINDOW_NORMAL)
        print("🖥️  Live window enabled (press 'q' to quit)")

    # Initialize trackers and smoothers
    mot_tracker = Sort()
    car_smoother = BoxSmoother(window=smooth_window)
    plate_smoother = PlateSmoother(bbox_window=smooth_window)

    frame_idx = -1
    processed_count = 0
    ret = True

    print("🚀 Starting processing...\n")

    # Main processing loop
    while ret:
        frame_idx += 1
        ret, frame = cap.read()
        if not ret:
            break

        # Frame skipping for performance
        if frame_idx % frame_step != 0:
            continue

        processed_count += 1

        # --- STEP 1: Detect Vehicles ---
        det = coco_model(frame, verbose=False)[0]
        detections_ = []
        for d in det.boxes.data.tolist():
            x1, y1, x2, y2, score, class_id = d
            if int(class_id) in vehicles:
                detections_.append([x1, y1, x2, y2, score])

        # --- STEP 2: Track Vehicles ---
        tracks = mot_tracker.update(np.asarray(detections_))  # Returns [x1,y1,x2,y2,id]

        # --- STEP 3: Detect License Plates ---
        lp_det = lp_model(frame, verbose=False)[0]
        lp_boxes = lp_det.boxes.data.tolist() if lp_det.boxes is not None else []

        # --- STEP 4: Match Plates to Vehicles + OCR ---
        for lp in lp_boxes:
            x1, y1, x2, y2, lp_score, _ = lp
            xcar1, ycar1, xcar2, ycar2, car_id = get_car(lp, tracks)
            
            if car_id == -1:
                continue

            # Crop and preprocess license plate
            lp_crop = frame[int(y1):int(y2), int(x1):int(x2), :]
            if lp_crop.size == 0:
                continue
            
            lp_gray = cv2.cvtColor(lp_crop, cv2.COLOR_BGR2GRAY)
            _, lp_thresh = cv2.threshold(lp_gray, 64, 255, cv2.THRESH_BINARY_INV)
            
            # Extract text via OCR
            lp_text, lp_text_score = read_license_plate(lp_thresh)

            # Update best text for this vehicle
            plate_smoother.update_text(int(car_id), lp_text, lp_text_score)

            # Smooth plate bbox
            sm_lp_bbox = plate_smoother.update_bbox(int(car_id), [x1, y1, x2, y2])

            # Draw smoothed plate bbox (RED)
            sx1, sy1, sx2, sy2 = map(int, sm_lp_bbox)
            cv2.rectangle(frame, (sx1, sy1), (sx2, sy2), (0, 0, 255), 3)
            cv2.putText(frame, f"LP:{lp_text or '0'}", (sx1, max(0, sy1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

        # --- STEP 5: Draw Vehicle Tracks ---
        for tr in tracks:
            tx1, ty1, tx2, ty2, tid = tr
            sm_car_bbox = car_smoother.update(int(tid), [tx1, ty1, tx2, ty2])
            cx1, cy1, cx2, cy2 = map(int, sm_car_bbox)

            # Draw vehicle bbox (GREEN)
            cv2.rectangle(frame, (cx1, cy1), (cx2, cy2), (0, 255, 0), 3)
            cv2.putText(frame, f"ID:{int(tid)}", (cx1, max(0, cy1 - 8)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

            # Overlay best plate text above vehicle (if available)
            best = plate_smoother.get_best_text(int(tid))
            plate_text = best['text']
            if plate_text and plate_text != '0':
                # Calculate text position (centered above vehicle)
                (tw, th), _ = cv2.getTextSize(plate_text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 3)
                text_x = int((cx1 + cx2 - tw) / 2)
                text_y = max(0, cy1 - 20)
                
                # Measure text size for background box
                (text_w, text_h), _ = cv2.getTextSize(plate_text, cv2.FONT_HERSHEY_SIMPLEX, 1.2, 2)

                # Define background box
                bg_x1 = text_x - 10
                bg_y1 = text_y - text_h - 10
                bg_x2 = text_x + text_w + 10
                bg_y2 = text_y + 10

                # Draw white background for readability
                cv2.rectangle(frame, (bg_x1, bg_y1), (bg_x2, bg_y2), (255, 255, 255), -1)

                # Draw black text on top
                cv2.putText(frame, plate_text, (text_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 0), 2)


        # --- STEP 6: UI Overlay: Car/Plate Info ---
        # Count unique car IDs and collect visible plate numbers
        car_ids = set()
        plate_texts = []
        for tr in tracks:
            tid = int(tr[4])
            car_ids.add(tid)
            best = plate_smoother.get_best_text(tid)
            plate_text = best['text']
            if plate_text and plate_text != '0' and plate_text not in plate_texts:
                plate_texts.append(plate_text)

        num_cars = len(car_ids)
        num_plates = len(plate_texts)

        # Prepare info text
        info_lines = [
            f"Cars detected: {num_cars}",
            f"Plates detected: {num_plates}"
        ]
        if num_plates > 0:
            info_lines.append("Plates: " + ", ".join(plate_texts))

        # Draw semi-transparent rectangle
        overlay = frame.copy()
        box_w = 420
        box_h = 30 + 25 * len(info_lines)
        cv2.rectangle(overlay, (10, 10), (10 + box_w, 10 + box_h), (40, 40, 40), -1)
        alpha = 0.5
        frame = cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0)

        # Draw info text
        for i, line in enumerate(info_lines):
            y = 35 + i * 25
            cv2.putText(frame, line, (25, y), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (255, 255, 255), 2)

        # --- STEP 7: Write and Display ---
        out.write(frame)

        if show:
            cv2.imshow("ALPR-Realtime", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("\n⚠️  User interrupted (pressed 'q')")
                break

        # Progress indicator
        if processed_count % 10 == 0:
            progress = (frame_idx / total_frames) * 100
            print(f"⏳ Progress: {progress:.1f}% (Frame {frame_idx}/{total_frames})", end='\r')

    # Cleanup
    out.release()
    cap.release()
    if show:
        cv2.destroyAllWindows()

    print(f"\n\n✅ Processing complete!")
    print(f"📊 Processed {processed_count} frames out of {total_frames} total frames")
    print(f"💾 Output saved to: {save_path}")
    print("=" * 70)
