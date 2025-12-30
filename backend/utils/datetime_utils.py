"""
DateTime utility functions for timestamp parsing and formatting
"""

from datetime import datetime
from typing import Optional, Union
import re


def parse_timestamp(timestamp: Union[str, datetime, None]) -> Optional[datetime]:
    """
    Parse timestamp string to datetime object, handling various formats
    
    Supports:
    - ISO format: "2024-01-01T12:00:00" or "2024-01-01T12:00:00Z"
    - PostgreSQL format: "2024-01-01 12:00:00"
    - Already parsed datetime objects
    
    Args:
        timestamp: Timestamp string or datetime object
    
    Returns:
        Parsed datetime object, or None if parsing fails
    """
    # Handle None
    if timestamp is None:
        return None
    
    # Handle already parsed datetime objects
    if isinstance(timestamp, datetime):
        return timestamp
    
    # Handle non-string types
    if not isinstance(timestamp, str):
        return None
    
    # Try ISO format first (most common)
    try:
        # Handle 'Z' timezone indicator
        ts_normalized = timestamp.replace('Z', '+00:00')
        return datetime.fromisoformat(ts_normalized)
    except (ValueError, AttributeError):
        pass
    
    # Try without timezone info
    try:
        return datetime.fromisoformat(timestamp)
    except (ValueError, AttributeError):
        pass
    
    # Try common PostgreSQL and other formats
    common_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%d",
        "%d.%m.%Y",
        "%d/%m/%Y",
    ]
    
    for fmt in common_formats:
        try:
            return datetime.strptime(timestamp, fmt)
        except ValueError:
            continue
    
    # Failed to parse
    return None


def format_timestamp(dt: Optional[datetime], format_type: str = "iso") -> str:
    """
    Format datetime object to string
    
    Args:
        dt: Datetime object to format
        format_type: Format type - "iso", "filename", "display", or custom format string
    
    Returns:
        Formatted timestamp string
    """
    if dt is None:
        return ""
    
    if format_type == "iso":
        return dt.isoformat()
    elif format_type == "filename":
        return dt.strftime('%Y%m%d_%H%M%S')
    elif format_type == "display":
        return dt.strftime('%d.%m.%Y %H:%M:%S')
    elif format_type == "date":
        return dt.strftime('%d.%m.%Y')
    elif format_type == "school_year":
        return dt.strftime("%Y/%Y")
    else:
        # Custom format string
        return dt.strftime(format_type)


def get_current_timestamp(format_type: str = "iso") -> str:
    """
    Get current timestamp as formatted string
    
    Args:
        format_type: Format type - "iso", "filename", "display", or custom format string
    
    Returns:
        Formatted current timestamp
    """
    return format_timestamp(datetime.now(), format_type)


def compare_timestamps(
    timestamp1: Union[str, datetime, None],
    timestamp2: Union[str, datetime, None],
    tolerance_seconds: float = 1.0
) -> Optional[int]:
    """
    Compare two timestamps
    
    Args:
        timestamp1: First timestamp
        timestamp2: Second timestamp
        tolerance_seconds: Tolerance in seconds for comparison
    
    Returns:
        -1 if timestamp1 < timestamp2 (within tolerance)
        0 if timestamps are equal (within tolerance)
        1 if timestamp1 > timestamp2 (within tolerance)
        None if comparison fails
    """
    dt1 = parse_timestamp(timestamp1)
    dt2 = parse_timestamp(timestamp2)
    
    if dt1 is None or dt2 is None:
        return None
    
    diff_seconds = (dt1 - dt2).total_seconds()
    
    if abs(diff_seconds) <= tolerance_seconds:
        return 0
    elif diff_seconds > 0:
        return 1
    else:
        return -1


def is_timestamp_newer(
    timestamp1: Union[str, datetime, None],
    timestamp2: Union[str, datetime, None],
    tolerance_seconds: float = 1.0
) -> bool:
    """
    Check if timestamp1 is newer than timestamp2
    
    Args:
        timestamp1: First timestamp (to check if newer)
        timestamp2: Second timestamp (to compare against)
        tolerance_seconds: Tolerance in seconds
    
    Returns:
        True if timestamp1 is newer than timestamp2 (beyond tolerance), False otherwise
    """
    comparison = compare_timestamps(timestamp1, timestamp2, tolerance_seconds)
    return comparison == 1


def sanitize_filename(filename: str, ensure_extension: Optional[str] = None) -> str:
    """
    Sanitize filename for safe filesystem usage
    
    Removes all special characters except alphanumeric, dash, underscore, and dot.
    Removes multiple consecutive underscores and trims underscores from start/end.
    
    Args:
        filename: Original filename to sanitize
        ensure_extension: Optional extension to ensure (e.g., '.docx')
    
    Returns:
        Sanitized filename safe for all filesystems
    """
    # Clean up - keep only alphanumeric, dash, underscore, dot
    # Replace all other characters with underscore
    safe = re.sub(r'[^\w\-_\.]', '_', filename)
    
    # Remove multiple consecutive underscores
    safe = re.sub(r'_+', '_', safe).strip('_')
    
    # Ensure extension if provided
    if ensure_extension:
        if not safe.lower().endswith(ensure_extension.lower()):
            safe += ensure_extension
    
    return safe

