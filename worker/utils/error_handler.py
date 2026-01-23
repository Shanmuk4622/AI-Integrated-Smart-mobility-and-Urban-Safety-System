"""
Centralized error handling with retry logic and graceful degradation.
"""

import time
import functools
from typing import Callable, Any, Optional
import logging


class RetryableError(Exception):
    """Exception that can be retried."""
    pass


class FatalError(Exception):
    """Exception that should stop execution."""
    pass


def retry_on_failure(
    max_retries: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple = (Exception,),
    logger: Optional[logging.Logger] = None
):
    """
    Decorator to retry a function on failure.
    
    Args:
        max_retries: Maximum number of retry attempts
        delay: Initial delay between retries (seconds)
        backoff: Multiplier for delay after each retry
        exceptions: Tuple of exceptions to catch and retry
        logger: Logger instance for logging retry attempts
        
    Example:
        @retry_on_failure(max_retries=3, delay=2.0)
        def upload_to_supabase(data):
            # Network call that might fail
            pass
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> Any:
            current_delay = delay
            last_exception = None
            
            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    
                    if attempt < max_retries:
                        if logger:
                            logger.warning(
                                f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}: {str(e)}. "
                                f"Retrying in {current_delay:.1f}s..."
                            )
                        else:
                            print(f"[RETRY] {func.__name__} failed, retrying in {current_delay:.1f}s...")
                        
                        time.sleep(current_delay)
                        current_delay *= backoff
                    else:
                        if logger:
                            logger.error(
                                f"All {max_retries} retry attempts failed for {func.__name__}: {str(e)}"
                            )
                        else:
                            print(f"[ERROR] All retries failed for {func.__name__}")
            
            # All retries exhausted
            raise last_exception
        
        return wrapper
    return decorator


def safe_execute(
    func: Callable,
    default_return: Any = None,
    error_message: str = "Operation failed",
    logger: Optional[logging.Logger] = None
) -> Any:
    """
    Execute a function safely with error handling.
    Returns default value on error instead of raising exception.
    
    Args:
        func: Function to execute
        default_return: Value to return on error
        error_message: Error message to log
        logger: Logger instance
        
    Returns:
        Function result or default_return on error
        
    Example:
        result = safe_execute(
            lambda: risky_operation(),
            default_return=[],
            error_message="Failed to fetch data"
        )
    """
    try:
        return func()
    except Exception as e:
        if logger:
            logger.error(f"{error_message}: {str(e)}")
        else:
            print(f"[ERROR] {error_message}: {str(e)}")
        return default_return


class ErrorHandler:
    """Centralized error handling for worker operations."""
    
    def __init__(self, logger: Optional[logging.Logger] = None):
        """
        Initialize error handler.
        
        Args:
            logger: Logger instance for error reporting
        """
        self.logger = logger
        self.error_count = 0
        self.error_threshold = 10  # Stop after this many consecutive errors
    
    def handle_video_error(self, error: Exception, video_source: str) -> bool:
        """
        Handle video capture errors.
        
        Args:
            error: The exception that occurred
            video_source: Video source path/URL
            
        Returns:
            True if should continue, False if should stop
        """
        self.error_count += 1
        
        if self.logger:
            self.logger.error(f"Video capture error from {video_source}: {str(error)}")
        else:
            print(f"[ERROR] Video capture failed: {str(error)}")
        
        # Stop if too many consecutive errors
        if self.error_count >= self.error_threshold:
            if self.logger:
                self.logger.critical(
                    f"Too many consecutive errors ({self.error_count}). Stopping worker."
                )
            else:
                print(f"[CRITICAL] Too many errors. Stopping.")
            return False
        
        return True
    
    def handle_model_error(self, error: Exception, model_name: str) -> bool:
        """
        Handle model inference errors.
        
        Args:
            error: The exception that occurred
            model_name: Name of the model
            
        Returns:
            True if should continue (skip frame), False if fatal
        """
        if self.logger:
            self.logger.warning(f"Model {model_name} inference error: {str(error)}")
        else:
            print(f"[WARNING] Model error: {str(error)}")
        
        # Model errors are usually recoverable (skip frame)
        return True
    
    def handle_database_error(self, error: Exception, operation: str) -> bool:
        """
        Handle database sync errors.
        
        Args:
            error: The exception that occurred
            operation: Description of the database operation
            
        Returns:
            True if should continue, False if fatal
        """
        if self.logger:
            self.logger.error(f"Database error during {operation}: {str(error)}")
        else:
            print(f"[ERROR] Database error: {str(error)}")
        
        # Database errors are recoverable (data will sync on next interval)
        return True
    
    def reset_error_count(self):
        """Reset error counter after successful operation."""
        self.error_count = 0


# Predefined retry decorators for common operations
retry_database = retry_on_failure(
    max_retries=3,
    delay=1.0,
    backoff=2.0,
    exceptions=(Exception,)
)

retry_network = retry_on_failure(
    max_retries=5,
    delay=2.0,
    backoff=1.5,
    exceptions=(ConnectionError, TimeoutError)
)
