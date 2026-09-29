"""Root FastAPI entrypoint for Vercel."""
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dashboard.server.app import app
