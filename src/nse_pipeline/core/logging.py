"""Structured logging configuration for NSE Market Data Pipeline."""

import logging
import logging.config
from pathlib import Path

import yaml

_LOGGER_INITIALIZED = False


def setup_logging(
    config_path: str = "config/logging.yaml",
    default_level: str = "INFO",
) -> None:
    """Configures logging from YAML file or falls back to standard basic config."""
    global _LOGGER_INITIALIZED
    path = Path(config_path)

    # Ensure log directory exists if standard file handler is configured
    log_dir = Path("logs")
    log_dir.mkdir(parents=True, exist_ok=True)

    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            logging.config.dictConfig(config)
            _LOGGER_INITIALIZED = True
            return
        except Exception as e:
            print(f"Warning: Failed to load logging configuration from {path}: {e}")

    # Fallback basic configuration
    logging.basicConfig(
        level=getattr(logging, default_level.upper(), logging.INFO),
        format="%(asctime)s [%(levelname)s] %(name)s (%(filename)s:%(lineno)d): %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    _LOGGER_INITIALIZED = True


def get_logger(name: str | None = None) -> logging.Logger:
    """Returns a logger instance with configured handlers."""
    global _LOGGER_INITIALIZED
    if not _LOGGER_INITIALIZED:
        setup_logging()
    logger_name = f"nse_pipeline.{name}" if name else "nse_pipeline"
    return logging.getLogger(logger_name)
