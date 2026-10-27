"""Vercel FastAPI entrypoint for the existing backend package."""

import sys
from pathlib import Path

backend_dir = str(Path(__file__).resolve().parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.main import app  # noqa: E402
