"""Vercel Serverless entrypoint for FastAPI application."""
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from dashboard.server.app import app
