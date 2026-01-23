import argparse
import os
import sys

# Add worker root to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.processor import JunctionProcessor
from services.supabase_client import SupabaseService
from utils.env_validator import validate_startup, ValidationError
from utils.logger import WorkerLogger
from utils.error_handler import ErrorHandler

import config  # Import local config

# Resolve paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_COCO = os.path.join(BASE_DIR, "assets", "yolov8n.pt")
DEFAULT_LP = os.path.join(BASE_DIR, "assets", "license_plate_detector.pt")

def main():
    # Initialize logger (will be updated with junction_id later)
    logger = None
    
    parser = argparse.ArgumentParser(description="AI Worker for Traffic Monitoring")
    # Arguments default to None so we can know if user provided them
    parser.add_argument("--junction_id", type=int, help=f"ID of the junction (Default: {config.JUNCTION_ID})")
    parser.add_argument("--source", type=str, help=f"Video Source (Default: {config.VIDEO_SOURCE})")
    parser.add_argument("--coco_model", type=str, default=config.COCO_MODEL_PATH, help="Path to YOLOv8 COCO model")
    parser.add_argument("--lp_model", type=str, default=config.LP_MODEL_PATH, help="Path to License Plate model")
    parser.add_argument("--log_level", type=str, default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"], help="Logging level")

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
    
    # 2. Setup Logger
    logger = WorkerLogger.setup_worker_logger(
        junction_id=config.JUNCTION_ID,
        log_level=args.log_level
    )
    
    logger.info("="*60)
    logger.info(f"Starting Worker for Junction {config.JUNCTION_ID}")
    logger.info(f"Source: {config.VIDEO_SOURCE}")
    logger.info(f"GUI: {config.SHOW_GUI}, Save: {config.SAVE_VIDEO}")
    logger.info("="*60)
    
    # 3. Validate Environment
    try:
        validate_startup(config)
    except ValidationError as e:
        logger.critical("Configuration validation failed. Exiting.")
        return 1

    # 4. Check Models (additional validation)
    if not os.path.exists(args.coco_model):
        logger.error(f"COCO Model not found at {args.coco_model}")
        return 1
    
    if not os.path.exists(args.lp_model):
        logger.warning(f"LP Model not found at {args.lp_model}. Plate detection may fail.")

    # 5. Start Processor
    try:
        logger.info("Initializing Junction Processor...")
        processor = JunctionProcessor(
            junction_id=config.JUNCTION_ID,
            video_source=config.VIDEO_SOURCE,
            coco_model_path=args.coco_model,
            lp_model_path=args.lp_model,
            config_module=config,  # Pass the config object
            logger=logger  # Pass logger to processor
        )
        logger.info("Starting video processing loop...")
        processor.start()
    except KeyboardInterrupt:
        logger.info("Received keyboard interrupt. Shutting down gracefully...")
        if 'processor' in locals():
            processor.stop()
    except Exception as e:
        logger.critical(f"CRITICAL ERROR: {e}")
        if 'processor' in locals():
            processor.stop()
        import traceback
        logger.error(traceback.format_exc())
        return 1
    
    logger.info("Worker stopped successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
