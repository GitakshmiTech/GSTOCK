"""Checksum calculation utilities."""

import hashlib
from pathlib import Path


def calculate_sha256(file_path: str | Path, chunk_size: int = 65536) -> str:
    """Calculates SHA-256 hash of a local file."""
    p = Path(file_path)
    if not p.is_file():
        raise FileNotFoundError(f"File not found: {file_path}")

    sha256_hash = hashlib.sha256()
    with open(p, "rb") as f:
        for byte_block in iter(lambda: f.read(chunk_size), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()
