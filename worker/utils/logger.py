"""
Structured logging system for worker nodes.
Replaces print statements with proper logging framework.
"""

import logging
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional


class WorkerLogger:
    """Centralized logging for worker nodes."""
    
    _loggers = {}
    
    @staticmethod
    def get_logger(
        name: str = "worker",
        junction_id: Optional[int] = None,
        log_level: str = "INFO",
        log_to_file: bool = True,
        log_dir: str = "logs"
    ) -> logging.Logger:
        """
        Get or create a logger instance.
        
        Args:
            name: Logger name
            junction_id: Junction ID for file naming
            log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
            log_to_file: Whether to write logs to file
            log_dir: Directory for log files
            
        Returns:
            Configured logger instance
        """
        # Create unique logger key
        logger_key = f"{name}_{junction_id}" if junction_id else name
        
        # Return existing logger if already configured
        if logger_key in WorkerLogger._loggers:
            return WorkerLogger._loggers[logger_key]
        
        # Create new logger
        logger = logging.getLogger(logger_key)
        logger.setLevel(getattr(logging, log_level.upper()))
        
        # Remove existing handlers to avoid duplicates
        logger.handlers.clear()
        
        # Create formatters
        detailed_formatter = logging.Formatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        
        simple_formatter = logging.Formatter(
            fmt='[%(levelname)s] %(message)s'
        )
        
        # Console handler (stdout)
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(logging.INFO)
        console_handler.setFormatter(simple_formatter)
        logger.addHandler(console_handler)
        
        # File handler (if enabled)
        if log_to_file:
            # Create logs directory
            log_path = Path(log_dir)
            log_path.mkdir(exist_ok=True)
            
            # Create log filename with timestamp and junction ID
            timestamp = datetime.now().strftime("%Y%m%d")
            if junction_id:
                log_filename = f"junction_{junction_id}_{timestamp}.log"
            else:
                log_filename = f"{name}_{timestamp}.log"
            
            file_handler = logging.FileHandler(
                log_path / log_filename,
                encoding='utf-8'
            )
            file_handler.setLevel(logging.DEBUG)
            file_handler.setFormatter(detailed_formatter)
            logger.addHandler(file_handler)
        
        # Store logger
        WorkerLogger._loggers[logger_key] = logger
        
        return logger
    
    @staticmethod
    def setup_worker_logger(junction_id: int, log_level: str = "INFO") -> logging.Logger:
        """
        Convenience method to set up a worker logger.
        
        Args:
            junction_id: Junction ID
            log_level: Logging level
            
        Returns:
            Configured logger
        """
        return WorkerLogger.get_logger(
            name="worker",
            junction_id=junction_id,
            log_level=log_level,
            log_to_file=True,
            log_dir="logs"
        )


# Convenience functions for quick logging
def debug(msg: str, logger: Optional[logging.Logger] = None):
    """Log debug message."""
    if logger:
        logger.debug(msg)
    else:
        print(f"[DEBUG] {msg}")


def info(msg: str, logger: Optional[logging.Logger] = None):
    """Log info message."""
    if logger:
        logger.info(msg)
    else:
        print(f"[INFO] {msg}")


def warning(msg: str, logger: Optional[logging.Logger] = None):
    """Log warning message."""
    if logger:
        logger.warning(msg)
    else:
        print(f"[WARNING] {msg}")


def error(msg: str, logger: Optional[logging.Logger] = None):
    """Log error message."""
    if logger:
        logger.error(msg)
    else:
        print(f"[ERROR] {msg}")


def critical(msg: str, logger: Optional[logging.Logger] = None):
    """Log critical message."""
    if logger:
        logger.critical(msg)
    else:
        print(f"[CRITICAL] {msg}")
