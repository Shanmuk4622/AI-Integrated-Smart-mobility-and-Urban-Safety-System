"""
Configuration File for ALPR System
All parameters for the license plate recognition system.
Modify these values to customize the system behavior.
"""

# =============================================================================
# VIDEO INPUT/OUTPUT SETTINGS
# =============================================================================

# Path to input video file
VIDEO_PATH = "Videos/sample.mp4"

# Path to save output video with annotations
OUTPUT_PATH = "Videos/out.avi"

# Video codec for output file
# Options: "XVID" (for .avi), "mp4v" (for .mp4), "H264" (requires ffmpeg)
VIDEO_CODEC = "XVID"


# =============================================================================
# MODEL SETTINGS
# =============================================================================

# Path to YOLOv8 vehicle detection model (COCO pre-trained)
VEHICLE_MODEL_PATH = "yolov8n.pt"

# Path to custom-trained license plate detection model
LICENSE_PLATE_MODEL_PATH = "license_plate_detector.pt"


# =============================================================================
# DETECTION SETTINGS
# =============================================================================

# COCO dataset class IDs for vehicles to detect
# 2 = car, 3 = motorcycle, 5 = bus, 7 = truck
VEHICLE_CLASSES = (2, 3, 5, 7)


# =============================================================================
# PERFORMANCE SETTINGS
# =============================================================================

# Target processing framerate (frames per second)
# Lower value = faster processing but skips more frames
# Higher value = more accurate but slower processing
# Recommended: 10 for CPU, 30 for GPU
TARGET_FPS = 10

# Frame step for processing (calculated automatically from TARGET_FPS)
# You can set this manually to override automatic calculation
# None = auto-calculate, or set integer value (e.g., 3 = process every 3rd frame)
FRAME_STEP = None


# =============================================================================
# SMOOTHING SETTINGS
# =============================================================================

# Moving average window size for bounding box smoothing
# Larger value = smoother but more lag
# Smaller value = more responsive but jittery
# Recommended: 3-7 frames
SMOOTH_WINDOW = 5


# =============================================================================
# DISPLAY SETTINGS
# =============================================================================

# Show live video window during processing
# Set to False for faster processing without display
SHOW_LIVE_VIDEO = True

# Display window title
WINDOW_TITLE = "ALPR-Realtime"


# =============================================================================
# OCR SETTINGS
# =============================================================================

# Use GPU for OCR (EasyOCR)
# Set to True if you have CUDA-enabled GPU
OCR_GPU = False

# OCR language
OCR_LANGUAGE = ['en']

# License plate format validation
# Expected format: 2 letters + 2 digits + 3 letters (e.g., AB12CDE)
# Set to False to accept any OCR result without format checking
VALIDATE_PLATE_FORMAT = True


# =============================================================================
# VISUALIZATION SETTINGS
# =============================================================================

# Bounding box colors (BGR format)
VEHICLE_BBOX_COLOR = (0, 255, 0)  # Green
PLATE_BBOX_COLOR = (0, 0, 255)    # Red

# Bounding box thickness
BBOX_THICKNESS = 3

# Text settings
TEXT_FONT = 0  # cv2.FONT_HERSHEY_SIMPLEX
TEXT_SCALE_SMALL = 0.7
TEXT_SCALE_LARGE = 1.2
TEXT_THICKNESS = 2

# License plate text background
TEXT_BG_COLOR = (255, 255, 255)  # White background
TEXT_FG_COLOR = (0, 0, 0)        # Black text


# =============================================================================
# ADVANCED SETTINGS
# =============================================================================

# Confidence threshold for vehicle detection (0.0 - 1.0)
VEHICLE_CONFIDENCE = 0.25

# Confidence threshold for license plate detection (0.0 - 1.0)
PLATE_CONFIDENCE = 0.25

# Minimum OCR confidence to accept result (0.0 - 1.0)
MIN_OCR_CONFIDENCE = 0.0

# SORT tracker parameters
SORT_MAX_AGE = 1          # Frames to keep alive a track without detections
SORT_MIN_HITS = 3         # Minimum hits before track is confirmed
SORT_IOU_THRESHOLD = 0.3  # IoU threshold for matching


# =============================================================================
# DEBUG SETTINGS
# =============================================================================

# Print verbose output during processing
VERBOSE = True

# Save debug frames (helpful for troubleshooting)
SAVE_DEBUG_FRAMES = False
DEBUG_OUTPUT_DIR = "debug_frames/"


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_config_summary():
    """Return a formatted string with current configuration."""
    return f"""
    ╔══════════════════════════════════════════════════════════════════╗
    ║                    ALPR CONFIGURATION                            ║
    ╠══════════════════════════════════════════════════════════════════╣
    ║ Video Input:     {VIDEO_PATH:<45} ║
    ║ Video Output:    {OUTPUT_PATH:<45} ║
    ║ Vehicle Model:   {VEHICLE_MODEL_PATH:<45} ║
    ║ Plate Model:     {LICENSE_PLATE_MODEL_PATH:<45} ║
    ║ Target FPS:      {TARGET_FPS:<45} ║
    ║ Smooth Window:   {SMOOTH_WINDOW:<45} ║
    ║ Show Live:       {str(SHOW_LIVE_VIDEO):<45} ║
    ║ OCR GPU:         {str(OCR_GPU):<45} ║
    ╚══════════════════════════════════════════════════════════════════╝
    """


def validate_config():
    """Validate configuration parameters and raise errors if invalid."""
    import os
    
    # Check if model files exist
    if not os.path.exists(VEHICLE_MODEL_PATH):
        raise FileNotFoundError(f"Vehicle model not found: {VEHICLE_MODEL_PATH}")
    
    if not os.path.exists(LICENSE_PLATE_MODEL_PATH):
        raise FileNotFoundError(f"License plate model not found: {LICENSE_PLATE_MODEL_PATH}")
    
    # Check if video exists
    if not os.path.exists(VIDEO_PATH):
        raise FileNotFoundError(f"Video file not found: {VIDEO_PATH}")
    
    # Validate numeric parameters
    if TARGET_FPS <= 0:
        raise ValueError("TARGET_FPS must be positive")
    
    if SMOOTH_WINDOW < 1:
        raise ValueError("SMOOTH_WINDOW must be at least 1")
    
    print("✅ Configuration validated successfully!")
