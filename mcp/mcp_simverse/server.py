from __future__ import annotations

import os
from typing import Any

from dotenv import load_dotenv
from fastmcp import FastMCP
from starlette.requests import Request
from starlette.responses import JSONResponse

from mcp_simverse.models import QueryRequest
from mcp_simverse.openrouter import OpenRouterClient, OpenRouterError
from mcp_simverse.pipeline import QueryPipeline
from mcp_simverse.tools import register_tools

load_dotenv()

mcp = FastMCP("Simverse eSIM")
register_tools(mcp)

_pipeline: QueryPipeline | None = None


def get_pipeline() -> QueryPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = QueryPipeline(mcp, OpenRouterClient())
    return _pipeline


@mcp.custom_route("/health", methods=["GET"])
async def health(_request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


@mcp.custom_route("/v1/query", methods=["POST"])
async def query(request: Request) -> JSONResponse:
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "Request body must be JSON"}, status_code=400)

    try:
        payload = QueryRequest.model_validate(body)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=422)

    pipeline = get_pipeline()
    classifier = pipeline.classifier
    if isinstance(classifier, OpenRouterClient) and not classifier.configured():
        return JSONResponse(
            {"error": "OPENROUTER_API_KEY is not configured"},
            status_code=503,
        )

    try:
        result = await pipeline.run(payload.text)
    except OpenRouterError as exc:
        return JSONResponse({"error": str(exc)}, status_code=422)

    return JSONResponse(result.model_dump())


def run() -> None:
    mcp.run(
        transport="http",
        host=os.getenv("MCP_HOST", "0.0.0.0"),
        port=int(os.getenv("MCP_PORT", "4000")),
    )
