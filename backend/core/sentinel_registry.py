"""
Sentinel Registry — Single shared instance of VerifairSentinel.

This module ensures VerifairSentinel is loaded only ONCE across the entire
application, preventing duplicate model loading that wastes ~2GB of RAM.

Usage:
    from backend.core.sentinel_registry import get_sentinel
    sentinel = get_sentinel()  # Returns the shared instance or None
"""

import logging
from typing import Optional
from backend.core.sentinel import VerifairSentinel

logger = logging.getLogger("SentinelRegistry")

_sentinel_instance: Optional[VerifairSentinel] = None
_initialized = False


def get_sentinel() -> Optional[VerifairSentinel]:
    """Get or create the shared VerifairSentinel instance."""
    global _sentinel_instance, _initialized

    if _initialized:
        return _sentinel_instance

    _initialized = True
    try:
        logger.info("Initializing shared VerifairSentinel instance...")
        _sentinel_instance = VerifairSentinel()
        logger.info("Shared VerifairSentinel initialized successfully.")
    except Exception as e:
        logger.critical(f"Failed to initialize VerifairSentinel: {e}")
        _sentinel_instance = None

    return _sentinel_instance
