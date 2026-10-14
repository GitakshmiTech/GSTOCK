"""Custom exceptions for the NSE Market Data Pipeline."""


class PipelineError(Exception):
    """Base exception for all pipeline errors."""


class ConfigurationError(PipelineError):
    """Raised when configuration is invalid or missing."""


class DownloaderError(PipelineError):
    """Raised when an error occurs during file download."""


class ArchiveNotFoundError(DownloaderError):
    """Raised when an archive file is not found at the remote source."""


class ChecksumMismatchError(DownloaderError):
    """Raised when the calculated file checksum does not match expected checksum."""


class ParserError(PipelineError):
    """Base exception for parsing errors."""


class UnsupportedFormatError(ParserError):
    """Raised when an archive format cannot be recognized or handled."""


class MissingColumnsError(ParserError):
    """Raised when required columns are absent from the input file."""


class NormalizationError(PipelineError):
    """Raised when raw data cannot be transformed into canonical types."""


class ValidationError(PipelineError):
    """Raised when records fail domain validation rules."""


class DatabaseError(PipelineError):
    """Base exception for database failures."""


class DuplicateRecordError(DatabaseError):
    """Raised when duplicate records violate unique constraints."""


class CalendarError(PipelineError):
    """Raised when trading calendar errors occur."""


class LockAcquisitionError(PipelineError):
    """Raised when a concurrent job is already running and lock cannot be acquired."""
