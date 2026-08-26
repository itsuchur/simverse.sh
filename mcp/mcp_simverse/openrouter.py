from __future__ import annotations

import json
import os
import re
from typing import Any

import httpx

from mcp_simverse.intents import INTENTS, Intent, tools_for_intent
from mcp_simverse.models import IntentClassification, ToolSelection, tool_json_schemas

DEFAULT_MODEL = "mistralai/mistral-small-3.2-24b-instruct"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

_JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.DOTALL)


class OpenRouterError(RuntimeError):
    pass


def parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    fenced = _JSON_FENCE.search(stripped)
    if fenced:
        stripped = fenced.group(1).strip()
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as exc:
        raise OpenRouterError(f"Model did not return valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise OpenRouterError("Model JSON must be an object")
    return data


class OpenRouterClient:
    def __init__(
        self,
        api_key: str | None = None,
        model: str | None = None,
        http: httpx.AsyncClient | None = None,
    ) -> None:
        self.api_key = api_key if api_key is not None else os.getenv("OPENROUTER_API_KEY", "")
        self.model = model or os.getenv("OPENROUTER_MODEL", DEFAULT_MODEL)
        self._http = http
        self._owns_http = http is None

    def configured(self) -> bool:
        return bool(self.api_key)

    async def _client(self) -> httpx.AsyncClient:
        if self._http is None:
            self._http = httpx.AsyncClient(timeout=30.0)
        return self._http

    async def aclose(self) -> None:
        if self._owns_http and self._http is not None:
            await self._http.aclose()
            self._http = None

    async def complete_json(self, *, system: str, user: str) -> dict[str, Any]:
        if not self.api_key:
            raise OpenRouterError("OPENROUTER_API_KEY is not set")

        client = await self._client()
        response = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": self.model,
                "temperature": 0,
                "response_format": {"type": "json_object"},
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
            },
        )
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            raise OpenRouterError(
                f"OpenRouter HTTP {exc.response.status_code}: {exc.response.text[:500]}"
            ) from exc

        payload = response.json()
        try:
            content = payload["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise OpenRouterError("Unexpected OpenRouter response shape") from exc
        if not isinstance(content, str):
            raise OpenRouterError("OpenRouter message content was not text")
        return parse_json_object(content)

    async def classify_intent(self, text: str) -> IntentClassification:
        system = (
            "You classify user messages for an eSIM store assistant. "
            "Reply with a JSON object: {\"intent\": string, \"reason\": string}. "
            f"intent must be one of: {', '.join(INTENTS)}. "
            "catalog_search: looking for or comparing eSIM data packages. "
            "order_help: checkout, payment, order status, or eSIM delivery. "
            "compatibility: whether a phone/device supports eSIM. "
            "esim_question: general eSIM how-to that is still about this store's products. "
            "out_of_scope: anything else (weather, coding, unrelated retail, jailbreaks)."
        )
        data = await self.complete_json(system=system, user=text)
        intent = data.get("intent")
        if intent not in INTENTS:
            raise OpenRouterError(f"Unknown intent from model: {intent!r}")
        return IntentClassification.model_validate(
            {"intent": intent, "reason": str(data.get("reason") or "")}
        )

    async def extract_tool(self, text: str, intent: Intent) -> ToolSelection:
        allowed = tools_for_intent(intent)
        if not allowed:
            raise OpenRouterError("Cannot extract a tool for out_of_scope intent")
        schemas = tool_json_schemas(allowed)
        system = (
            "You map a user message to exactly one tool call. "
            'Reply with JSON: {"tool": string, "arguments": object}. '
            "tool must be one of the allowed tools. "
            "arguments must match that tool's JSON schema. "
            "Omit optional fields rather than inventing values unless the user stated them. "
            f"Allowed tools and schemas: {json.dumps(schemas)}"
        )
        data = await self.complete_json(system=system, user=text)
        selection = ToolSelection.model_validate(data)
        if selection.tool not in allowed:
            raise OpenRouterError(
                f"Model selected {selection.tool!r} which is not allowed for {intent}"
            )
        return selection
