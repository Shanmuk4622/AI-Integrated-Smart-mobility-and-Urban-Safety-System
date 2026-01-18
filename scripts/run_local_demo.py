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
    from backend import config # Import Config
except ImportError:
     # try relative if running from root
     sys.path.append(os.getcwd())
     from backend.app.core.ai_pipeline import SmartMobilitySystem
     from backend import config

# Define paths
# We are in /scripts or root. 
BASE_DIR = os.path.dirname(os.getcwd()) if os.getcwd().endswith("scripts") else os.getcwd()
ASSETS_DIR = os.path.join(BASE_DIR, "backend", "assets")
COCO_MODEL = os.path.join(ASSETS_DIR, "yolov8n.pt")
LP_MODEL = os.path.join(ASSETS_DIR, "license_plate_detector.pt")

def main():
    print("--- Starting Local Smart Mobility Demo ---")
    print(f"Video Source: {config.VIDEO_PATH}")
    print("Press 'q' in the window to exit.")
    
    # Initialize System
    try:
        system = SmartMobilitySystem(
            video_path=config.VIDEO_PATH,
            coco_model_path=COCO_MODEL,
            lp_model_path=LP_MODEL
        )
    except Exception as e:
        print(f"Error initializing system: {e}")
        return

    # Process Stream
    for frame_bytes, stats in system.process_stream():
        
        # Show Stats on console
        print(f"\rDensity: {stats['density']} | Signal: {stats['signal']['action'][:1]} | Violations: {stats['violations']} | Plates: {len(stats['plates'])}", end="")
        
        # If the internal GUI is OFF, we verify here by showing it manually
        # If internal GUI is ON, we don't need to double-show it, but for a "Demo" script, 
        # let's trust the internal one. 
        if not config.SHOW_GUI:
             # Decode and show manually if user turned off internal GUI but ran the DEMO script
            nparr = np.frombuffer(frame_bytes, np.uint8)
            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if frame is not None:
                cv2.imshow("Smart Mobility AI - Local Debug", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

    cv2.destroyAllWindows()
    print("\nDemo Finished.")

if __name__ == "__main__":
    main()
