import argparse
import os
import sys

# Add worker root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.processor import JunctionProcessor
from services.supabase_client import SupabaseService

import config  # Import local config

# Resolve paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_COCO = os.path.join(BASE_DIR, "assets", "yolov8n.pt")
DEFAULT_LP = os.path.join(BASE_DIR, "assets", "license_plate_detector.pt")

def main():
    parser = argparse.ArgumentParser(description="AI Worker for Traffic Monitoring")
    # Arguments default to None so we can know if user provided them
    parser.add_argument("--junction_id", type=int, help=f"ID of the junction (Default: {config.JUNCTION_ID})")
    parser.add_argument("--source", type=str, help=f"Video Source (Default: {config.VIDEO_SOURCE})")
    parser.add_argument("--coco_model", type=str, default=DEFAULT_COCO, help="Path to YOLOv8 COCO model")
    parser.add_argument("--lp_model", type=str, default=DEFAULT_LP, help="Path to License Plate model")
    parser.add_argument("--no-gui", action="store_true", help="Disable GUI window")
    parser.add_argument("--save", action="store_true", help="Enable video saving")
    
    args = parser.parse_args()
    
    # 1. Apply Overrides to Config
    if args.junction_id:
        config.JUNCTION_ID = args.junction_id
        
    if args.source:
        config.VIDEO_SOURCE = args.source
        
    if args.no_gui:
        config.SHOW_GUI = False
        
    if args.save:
        config.SAVE_VIDEO = True
        
    print(f"Starting Worker for Junction {config.JUNCTION_ID}")
    print(f"Source: {config.VIDEO_SOURCE}")
    print(f"GUI: {config.SHOW_GUI}, Save: {config.SAVE_VIDEO}")

    # 2. Check Models
    if not os.path.exists(args.coco_model):
        print(f"ERROR: COCO Model not found at {args.coco_model}")
        return
    
    if not os.path.exists(args.lp_model):
         print(f"WARNING: LP Model not found at {args.lp_model}. Plate detection may fail.")

    # 3. Start Processor
    try:
        processor = JunctionProcessor(
            junction_id=config.JUNCTION_ID,
            video_source=config.VIDEO_SOURCE,
            coco_model_path=args.coco_model,
            lp_model_path=args.lp_model,
            config_module=config # Pass the config object
        )
        processor.start()
    except KeyboardInterrupt:
        print("Worker stopped by user.")
    except Exception as e:
        print(f"CRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
