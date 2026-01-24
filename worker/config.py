import os

# ==========================================
# WORKER CONFIGURATION
# ==========================================

# 1. Identity
JUNCTION_ID = 5  # UPDATED
LOCATION_NAME = "Hydrabad route" # UPDATED

# GEOGRAPHIC COORDINATES (Decimal Degrees)
LATITUDE = 17.425069191493133
LONGITUDE = 78.4861838264351

# 2. Input
# Path to video file OR RTSP Stream URL
# Example: "rtsp://username:password@ip:port/stream"
VIDEO_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Videos", "sample3.mp4")

# 3. Models
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COCO_MODEL_PATH = os.path.join(BASE_DIR, "assets", "yolov8n.pt")
LP_MODEL_PATH = os.path.join(BASE_DIR, "assets", "license_plate_detector.pt")

# 4. Output Behavior
SHOW_GUI = True         # Set to True to see the window, False for headless mode
SAVE_VIDEO = False      # UPDATED
OUTPUT_DIR = os.path.join(BASE_DIR, "processed_output")

# 5. Processing / Tuning
LOG_INTERVAL = 5.0      # Seconds between DB syncs
CONFIDENCE_THRESHOLD = 0.5

# Speed Estimation Calibration
SPEED_CALCULATION_FPS = 10  # UPDATED
PIXELS_PER_METER = 50       # How many pixels represent 1 meter (Calibrate this per camera view!)

# Ensure output directory exists
if SAVE_VIDEO and not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
