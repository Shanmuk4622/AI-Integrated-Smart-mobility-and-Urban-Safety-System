
import os

# Base Directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

# --- USER SETTINGS ---

# 1. Window Display
# Set to True to see the processing window (consumes more resources)
# Set to False to run in "Headless" mode (faster, best for server)
SHOW_GUI = True  

# 2. Video Recording
# Set to True to save the processed video to 'output_videos/'
SAVE_VIDEO = True

# 3. Input Source
# Path to input video file
VIDEO_PATH = os.path.join(ASSETS_DIR, "Videos", "sample2.mp4")

# 4. Processing Settings
# Target FPS (approximate)
TARGET_FPS = 30

# 5. Output Settings
OUTPUT_DIR = os.path.join(BASE_DIR, "output_videos")
if SAVE_VIDEO and not os.path.exists(OUTPUT_DIR):
    os.makedirs(OUTPUT_DIR)
