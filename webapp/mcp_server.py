"""MCP server: lets an AI agent (Claude Code, Codex CLI, Gemini CLI, ...) use the RUL models.

Run from the project root so the relative paths and the Helper package resolve:
    python -m webapp.mcp_server
Register it with an agent, for example Claude Code:
    claude mcp add engine-rul -- python -m webapp.mcp_server
"""
from mcp.server.mcpserver import MCPServer

from webapp import agent_tools

mcp = MCPServer("engine-rul", instructions=(
    "Estimate the remaining useful life (RUL, in operating cycles) of simulated NASA aircraft "
    "engines with four trained regression models. Engines are numbered 1 to 100."))


@mcp.tool()
def list_engines(limit: int = 10) -> dict:
    """List NASA test engines with the number of cycles observed for each."""
    return agent_tools.list_engines(limit)


@mcp.tool()
def predict_rul(engine_id: int, model: str = agent_tools.DEFAULT_MODEL) -> dict:
    """Predict the remaining useful life, in cycles, of one engine (1 to 100)."""
    return agent_tools.predict_rul(engine_id, model)


@mcp.tool()
def compare_models() -> dict:
    """MAE, RMSE and R2 on the official NASA test set for the four models."""
    return agent_tools.compare_models()


@mcp.tool()
def maintenance_brief(engine_id: int) -> dict:
    """Short maintenance recommendation for one engine, based on its predicted RUL."""
    return agent_tools.maintenance_brief(engine_id)


if __name__ == "__main__":
    mcp.run()
