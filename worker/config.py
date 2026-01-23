import os

# ==========================================
# WORKER CONFIGURATION
# ==========================================

# 1. Identity
JUNCTION_ID = 3  # Default ID for this worker
LOCATION_NAME = "VIT-AP University" # Junction Location Description

# GEOGRAPHIC COORDINATES (Decimal Degrees)
LATITUDE = 16.490026
LONGITUDE = 80.513759

# 2. Input
# Path to video file OR RTSP Stream URL
# Example: "rtsp://username:password@ip:port/stream"
VIDEO_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Videos", "sample.mp4")

# 3. Models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COCO_MODEL_PATH = os.path.join(BASE_DIR, "assets", "yolov8n.pt")
LP_MODEL_PATH = os.path.join(BASE_DIR, "assets", "license_plate_detector.pt")

# 4. Output Behavior
SHOW_GUI = True         # Set to True to see the window, False for headless mode
SAVE_VIDEO = False      # Set to True to save processed video
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_output")

# 5. Processing
LOG_INTERVAL = 5.0      # Seconds between DB syncs
CONFIDENCE_THRESHOLD = 0.5

# Ensure output directory exists
if SAVE_VIDEO and not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
