import sys
import os
import cv2
import numpy as np
import json

# Add backend to path (Go up one level from scripts/)
sys.path.append(os.path.join(os.getcwd(), 'backend'))
# Also try adding root for module resolution
sys.path.append(os.path.dirname(os.getcwd()))

try:
    from backend.app.core.ai_pipeline import SmartMobilitySystem
except ImportError:
     # try relative if running from root
     sys.path.append(os.getcwd())
     from backend.app.core.ai_pipeline import SmartMobilitySystem

# Define paths
# We are in /scripts or root. 
BASE_DIR = os.path.dirname(os.getcwd()) if os.getcwd().endswith("scripts") else os.getcwd()
ASSETS_DIR = os.path.join(BASE_DIR, "backend", "assets")
VIDEO_PATH = os.path.join(ASSETS_DIR, "Videos", "sample2.mp4")
COCO_MODEL = os.path.join(ASSETS_DIR, "yolov8n.pt")
LP_MODEL = os.path.join(ASSETS_DIR, "license_plate_detector.pt")

def main():
    print("--- Starting Local Smart Mobility Demo ---")
    print("Press 'q' in the window to exit.")
    
    # Initialize System
    try:
        system = SmartMobilitySystem(
            video_path=VIDEO_PATH,
            coco_model_path=COCO_MODEL,
            lp_model_path=LP_MODEL
        )
    except Exception as e:
        print(f"Error initializing system: {e}")
        return

    # Process Stream
    for frame_bytes, stats in system.process_stream():
        # Decode the JPEG bytes back to image for display
        nparr = np.frombuffer(frame_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            continue

        # Resize for better visibility if needed (Optional)
        # frame = cv2.resize(frame, (1280, 720))

        # Show Stats on console
        print(f"\rDensity: {stats['density']} | Signal: {stats['signal']['action'][:1]} | Violations: {stats['violations']} | Plates: {len(stats['plates'])}", end="")

        # Display Result
        cv2.imshow("Smart Mobility AI - Local Debug", frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cv2.destroyAllWindows()
    print("\nDemo Finished.")

if __name__ == "__main__":
    main()
