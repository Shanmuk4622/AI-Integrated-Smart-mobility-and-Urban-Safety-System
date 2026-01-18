"""
ALPR System Runner
Simple script to execute the Automatic License Plate Recognition system.
Configuration can be modified in config.py
"""

from alpr_pipeline import alpr_realtime
import config


def main():
    """
    Main entry point for the ALPR system.
    Loads configuration and starts the processing pipeline.
    """
    print("=" * 80)
    print(" " * 20 + "AUTOMATIC LICENSE PLATE RECOGNITION SYSTEM")
    print("=" * 80)
    print()
    
    # Validate configuration
    try:
        config.validate_config()
    except Exception as e:
        print(f"❌ Configuration Error: {e}")
        print("\nPlease check your config.py file and ensure all paths are correct.")
        return
    
    # Display configuration summary
    if config.VERBOSE:
        print(config.get_config_summary())
        print()
    
    # Run the ALPR pipeline
    try:
        alpr_realtime(
            video_path=config.VIDEO_PATH,
            coco_weights=config.VEHICLE_MODEL_PATH,
            lp_weights=config.LICENSE_PLATE_MODEL_PATH,
            vehicles=config.VEHICLE_CLASSES,
            target_fps=config.TARGET_FPS,
            smooth_window=config.SMOOTH_WINDOW,
            show=config.SHOW_LIVE_VIDEO,
            save_path=config.OUTPUT_PATH,
            codec=config.VIDEO_CODEC
        )
        
        print("\n🎉 ALPR processing completed successfully!")
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Processing interrupted by user")
        
    except Exception as e:
        print(f"\n\n❌ Error during processing: {e}")
        print("\nPlease check:")
        print("  1. Video file exists and is not corrupted")
        print("  2. Model files are downloaded and in correct location")
        print("  3. SORT module is properly installed")
        print("  4. All dependencies are installed (run: pip install -r requirements.txt)")
        raise


if __name__ == "__main__":
    main()
