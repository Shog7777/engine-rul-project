"""Vercel entry point: exposes the FastAPI app from webapp/server.py.

Serverless functions may not run the lifespan start-up hook, so the models are
loaded here, once per cold start.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from webapp.data import load_state
from webapp.server import app, state  # noqa: F401  (Vercel looks for `app`)

if not state:
    state.update(load_state())


@app.exception_handler(404)
async def _debug_404(request, exc):  # temporary diagnostics
    from fastapi.responses import JSONResponse
    return JSONResponse({"seen_path": request.url.path, "scope_path": request.scope.get("path"), "root_path": request.scope.get("root_path")}, status_code=404)
