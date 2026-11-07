"""Vercel entry point: exposes the FastAPI app from webapp/server.py.

Serverless functions may not run the lifespan start-up hook, so the models are
loaded here, once per cold start.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from webapp.data import load_state  # noqa: E402
from webapp.server import app, state  # noqa: E402

if not state:
    state.update(load_state())
