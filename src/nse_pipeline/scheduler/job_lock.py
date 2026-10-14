"""Execution lock to prevent overlapping jobs."""

import os
import time
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from nse_pipeline.core.exceptions import LockAcquisitionError
from nse_pipeline.core.logging import get_logger

logger = get_logger("scheduler.job_lock")


class JobLock:
    def __init__(self, lock_name: str, lock_dir: str = "./data"):
        self.lock_name = lock_name
        self.lock_file = Path(lock_dir) / f"{lock_name}.lock"
        self._acquired = False

    def acquire(self, timeout_seconds: int = 5) -> bool:
        """Attempts to acquire the file lock."""
        self.lock_file.parent.mkdir(parents=True, exist_ok=True)
        start_time = time.time()

        while True:
            try:
                # O_CREAT | O_EXCL ensures atomic creation
                fd = os.open(str(self.lock_file), os.O_CREAT | os.O_EXCL | os.O_RDWR)
                with os.fdopen(fd, "w") as f:
                    f.write(f"PID: {os.getpid()}\nTime: {time.time()}\n")
                self._acquired = True
                logger.debug(f"Acquired lock for {self.lock_name}")
                return True
            except FileExistsError:
                # Check for stale lock from terminated/dead process
                try:
                    if self.lock_file.exists():
                        content = self.lock_file.read_text()
                        for line in content.splitlines():
                            if line.startswith("PID:"):
                                pid = int(line.split(":")[1].strip())
                                try:
                                    os.kill(pid, 0)
                                except (ProcessLookupError, OSError):
                                    logger.warning(f"Detected and removed stale lock {self.lock_file} from terminated PID {pid}")
                                    self.lock_file.unlink(missing_ok=True)
                                    break
                except Exception as ex:
                    logger.debug(f"Error checking lock PID: {ex}")

                if (time.time() - start_time) >= timeout_seconds:
                    logger.warning(f"Could not acquire lock for {self.lock_name} within {timeout_seconds}s")
                    return False
                time.sleep(0.5)

    def release(self) -> None:
        """Releases the lock."""
        if self._acquired and self.lock_file.exists():
            try:
                self.lock_file.unlink()
                self._acquired = False
                logger.debug(f"Released lock for {self.lock_name}")
            except Exception as e:
                logger.warning(f"Error removing lock file {self.lock_file}: {e}")


@contextmanager
def acquire_job_lock(lock_name: str, timeout_seconds: int = 5) -> Generator[JobLock, None, None]:
    """Context manager for acquiring and releasing a job lock."""
    lock = JobLock(lock_name)
    if not lock.acquire(timeout_seconds=timeout_seconds):
        raise LockAcquisitionError(f"Another instance of job '{lock_name}' is currently running.")
    try:
        yield lock
    finally:
        lock.release()
