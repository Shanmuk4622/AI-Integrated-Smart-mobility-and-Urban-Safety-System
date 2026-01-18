import os

# ==========================================
# WORKER CONFIGURATION
# ==========================================

# 1. Identity
JUNCTION_ID = 1  # Default ID for this worker
LOCATION = "Main St & 4th Ave" # Junction Location Description

# 2. Input
# Path to video file OR RTSP Stream URL
# Example: "rtsp://username:password@ip:port/stream"
VIDEO_SOURCE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Videos", "sample2.mp4")

# 3. Output Behavior
SHOW_GUI = True         # Set to True to see the window, False for headless mode
SAVE_VIDEO = False      # Set to True to save processed video
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "processed_output")

# 4. Processing
LOG_INTERVAL = 5.0      # Seconds between DB syncs
CONFIDENCE_THRESHOLD = 0.5

# Ensure output directory exists
if SAVE_VIDEO and not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
