from __future__ import annotations

from typing import Any, Protocol

from fastmcp import FastMCP
from pydantic import ValidationError

from mcp_simverse.intents import OUT_OF_SCOPE_MESSAGE, tools_for_intent
from mcp_simverse.models import (
    IntentClassification,
    QueryRefused,
    QuerySuccess,
    ToolSelection,
    TOOL_INPUT_MODELS,
)
from mcp_simverse.openrouter import OpenRouterClient, OpenRouterError


class Classifier(Protocol):
    async def classify_intent(self, text: str) -> IntentClassification: ...

    async def extract_tool(self, text: str, intent: Any) -> ToolSelection: ...


class QueryPipeline:
    def __init__(self, mcp: FastMCP, classifier: Classifier | None = None) -> None:
        self.mcp = mcp
        self.classifier = classifier or OpenRouterClient()

    async def run(self, text: str) -> QuerySuccess | QueryRefused:
        classification = await self.classifier.classify_intent(text)
        if classification.intent == "out_of_scope":
            return QueryRefused(message=OUT_OF_SCOPE_MESSAGE)

        selection = await self.classifier.extract_tool(text, classification.intent)
        allowed = tools_for_intent(classification.intent)
        if selection.tool not in allowed:
            raise OpenRouterError(
                f"Tool {selection.tool!r} is not allowed for intent {classification.intent}"
            )

        input_model = TOOL_INPUT_MODELS.get(selection.tool)
        if input_model is None:
            raise OpenRouterError(f"Unknown tool {selection.tool!r}")
        try:
            arguments = input_model.model_validate(selection.arguments).model_dump(
                exclude_none=True
            )
        except ValidationError as exc:
            raise OpenRouterError(f"Tool arguments failed validation: {exc}") from exc

        tool_result = await self.mcp.call_tool(selection.tool, arguments)
        payload: Any = tool_result.structured_content
        if payload is None:
            payload = [
                block.model_dump() if hasattr(block, "model_dump") else block
                for block in tool_result.content
            ]
        return QuerySuccess(
            intent=classification.intent,
            tool=selection.tool,
            arguments=arguments,
            result=payload,
        )
