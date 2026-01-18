import sys
import os
import cv2
import numpy as np
import json

# Add backend to path to import modules
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.core.ai_pipeline import SmartMobilitySystem

# Define paths (Relative to where we run this script)
BASE_DIR = os.getcwd()
EXTERNAL_DIR = os.path.join(BASE_DIR, "Automatic-License-Plate-Recognition-using-YOLOv8")
VIDEO_PATH = os.path.join(EXTERNAL_DIR, "Videos", "sample2.mp4")
COCO_MODEL = os.path.join(EXTERNAL_DIR, "yolov8n.pt")
LP_MODEL = os.path.join(EXTERNAL_DIR, "license_plate_detector.pt")

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
