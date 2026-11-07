"""Vercel entry point: exposes the FastAPI app from webapp/server.py.

vercel.json rewrites every URL to /api/index, so the original path is passed in
the `__p` query parameter and restored here before FastAPI routes the request.
Serverless functions may not run the lifespan start-up hook, so the models are
loaded here, once per cold start.
"""
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from webapp.data import load_state
from webapp.server import app as fastapi_app
from webapp.server import state

if not state:
    state.update(load_state())


async def app(scope, receive, send):
    """Restore the path that vercel.json moved into the `__p` query parameter."""
    if scope["type"] == "http" and scope["path"] == "/api/index":
        params = parse_qsl(scope.get("query_string", b"").decode())
        original = next((v for k, v in params if k == "__p"), "")
        rest = [(k, v) for k, v in params if k != "__p"]
        scope = dict(scope, path="/" + original.lstrip("/"), raw_path=("/" + original.lstrip("/")).encode(),
                     query_string=urlencode(rest).encode())
    await fastapi_app(scope, receive, send)
