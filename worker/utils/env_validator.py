"""
Environment variable validation for worker nodes.
Ensures all required configuration is present before startup.
"""

import os
from typing import List, Tuple
from pathlib import Path


class ValidationError(Exception):
    """Raised when environment validation fails."""
    pass


class EnvValidator:
    """Validates required environment variables and configuration."""
    
    REQUIRED_ENV_VARS = [
        "SUPABASE_URL",
        "SUPABASE_KEY"
    ]
    
    @staticmethod
    def validate_env_vars() -> Tuple[bool, List[str]]:
        """
        Validate that all required environment variables are set.
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        for var in EnvValidator.REQUIRED_ENV_VARS:
            value = os.getenv(var)
            if not value or value.strip() == "":
                errors.append(f"Missing required environment variable: {var}")
        
        # Validate Supabase URL format
        supabase_url = os.getenv("SUPABASE_URL", "")
        if supabase_url and not supabase_url.startswith("https://"):
            errors.append("SUPABASE_URL must start with 'https://'")
        
        return (len(errors) == 0, errors)
    
    @staticmethod
    def validate_video_source(video_source: str) -> Tuple[bool, str]:
        """
        Validate video source (file path or RTSP URL).
        
        Args:
            video_source: Path to video file or RTSP URL
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        # Check if it's an RTSP stream
        if video_source.startswith("rtsp://"):
            return (True, "")
        
        # Check if it's a file path
        video_path = Path(video_source)
        if not video_path.exists():
            return (False, f"Video file not found: {video_source}")
        
        if not video_path.is_file():
            return (False, f"Video source is not a file: {video_source}")
        
        # Check file extension
        valid_extensions = ['.mp4', '.avi', '.mov', '.mkv', '.flv']
        if video_path.suffix.lower() not in valid_extensions:
            return (False, f"Unsupported video format: {video_path.suffix}. Supported: {', '.join(valid_extensions)}")
        
        return (True, "")
    
    @staticmethod
    def validate_model_path(model_path: str, model_name: str) -> Tuple[bool, str]:
        """
        Validate that a model file exists.
        
        Args:
            model_path: Path to model file
            model_name: Name of the model (for error messages)
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        model_file = Path(model_path)
        
        if not model_file.exists():
            return (False, f"{model_name} not found at: {model_path}")
        
        if not model_file.is_file():
            return (False, f"{model_name} path is not a file: {model_path}")
        
        # Check file extension
        if model_file.suffix.lower() not in ['.pt', '.pth', '.onnx']:
            return (False, f"{model_name} has invalid extension: {model_file.suffix}")
        
        return (True, "")
    
    @staticmethod
    def validate_coordinates(latitude: float, longitude: float) -> Tuple[bool, str]:
        """
        Validate GPS coordinates.
        
        Args:
            latitude: Latitude in decimal degrees
            longitude: Longitude in decimal degrees
            
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not (-90 <= latitude <= 90):
            return (False, f"Invalid latitude: {latitude}. Must be between -90 and 90")
        
        if not (-180 <= longitude <= 180):
            return (False, f"Invalid longitude: {longitude}. Must be between -180 and 180")
        
        return (True, "")
    
    @staticmethod
    def validate_all(config_module) -> None:
        """
        Validate all configuration settings.
        Raises ValidationError if any validation fails.
        
        Args:
            config_module: The config module to validate
        """
        all_errors = []
        
        # 1. Environment variables
        env_valid, env_errors = EnvValidator.validate_env_vars()
        if not env_valid:
            all_errors.extend(env_errors)
        
        # 2. Video source
        video_valid, video_error = EnvValidator.validate_video_source(config_module.VIDEO_SOURCE)
        if not video_valid:
            all_errors.append(video_error)
        
        # 3. Model paths
        coco_valid, coco_error = EnvValidator.validate_model_path(
            config_module.COCO_MODEL_PATH, 
            "COCO Model (yolov8n.pt)"
        )
        if not coco_valid:
            all_errors.append(coco_error)
        
        lp_valid, lp_error = EnvValidator.validate_model_path(
            config_module.LP_MODEL_PATH,
            "License Plate Model"
        )
        if not lp_valid:
            all_errors.append(f"WARNING: {lp_error}")
        
        # 4. Coordinates
        coord_valid, coord_error = EnvValidator.validate_coordinates(
            config_module.LATITUDE,
            config_module.LONGITUDE
        )
        if not coord_valid:
            all_errors.append(coord_error)
        
        # 5. Junction ID
        if config_module.JUNCTION_ID <= 0:
            all_errors.append(f"Invalid JUNCTION_ID: {config_module.JUNCTION_ID}. Must be positive integer")
        
        # Raise error if any validation failed
        if all_errors:
            error_msg = "\n❌ Configuration Validation Failed:\n" + "\n".join(f"  - {err}" for err in all_errors)
            raise ValidationError(error_msg)


def validate_startup(config_module) -> None:
    """
    Convenience function to validate configuration on startup.
    Prints success message if validation passes.
    
    Args:
        config_module: The config module to validate
        
    Raises:
        ValidationError: If validation fails
    """
    try:
        EnvValidator.validate_all(config_module)
        print("✅ Configuration validation passed")
    except ValidationError as e:
        print(str(e))
        raise
