import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.verify_installation import verify

if __name__ == "__main__":
    verify()
