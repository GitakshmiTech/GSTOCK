#!/usr/bin/env python3
"""Database initialization script alias."""


if __name__ == "__main__":
    import subprocess
    import sys
    subprocess.run([sys.executable, "scripts/setup_database.py"])
