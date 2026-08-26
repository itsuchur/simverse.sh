from typing import Any

import pytest
from starlette.testclient import TestClient

from mcp_simverse.intents import OUT_OF_SCOPE_MESSAGE
from mcp_simverse.models import EsimPackage, IntentClassification, ToolSelection
from mcp_simverse.openrouter import OpenRouterClient, parse_json_object
from mcp_simverse.pipeline import QueryPipeline
from mcp_simverse.server import mcp
from mcp_simverse.tools import search_esim_packages


class FakeClassifier:
    def __init__(
        self,
        intent: str,
        tool: str | None = None,
        arguments: dict[str, Any] | None = None,
    ) -> None:
        self.intent = intent
        self.tool = tool
        self.arguments = arguments or {}

    async def classify_intent(self, text: str) -> IntentClassification:
        return IntentClassification(intent=self.intent, reason=text)

    async def extract_tool(self, text: str, intent: str) -> ToolSelection:
        assert self.tool is not None
        return ToolSelection(tool=self.tool, arguments=self.arguments)


@pytest.fixture
def http_client() -> TestClient:
    with TestClient(mcp.http_app()) as client:
        yield client


def test_parse_json_object_strips_fences() -> None:
    data = parse_json_object('```json\n{"intent": "catalog_search"}\n```')
    assert data["intent"] == "catalog_search"


@pytest.mark.asyncio
async def test_out_of_scope_refuses_without_tools() -> None:
    pipeline = QueryPipeline(mcp, FakeClassifier("out_of_scope"))
    result = await pipeline.run("What is the weather in Tokyo?")
    assert result.model_dump() == {
        "intent": "out_of_scope",
        "refused": True,
        "message": OUT_OF_SCOPE_MESSAGE,
    }


@pytest.mark.asyncio
async def test_in_scope_dispatches_to_tool(monkeypatch: pytest.MonkeyPatch) -> None:
    japan = EsimPackage(
        id="JP5",
        name="Japan 5GB 7Days",
        destination="JP",
        days=7,
        data_gb=5.0,
        price_usd=9.99,
    )
    monkeypatch.setattr(
        "mcp_simverse.catalog.search_packages",
        lambda destination, days=None, data_gb=None: [japan],
    )
    pipeline = QueryPipeline(
        mcp,
        FakeClassifier(
            "catalog_search",
            tool="search_esim_packages",
            arguments={"destination": "Japan"},
        ),
    )
    result = await pipeline.run("eSIM for Japan")
    dumped = result.model_dump()
    assert dumped["intent"] == "catalog_search"
    assert dumped["tool"] == "search_esim_packages"
    assert dumped["arguments"]["destination"] == "Japan"
    expected = search_esim_packages(destination="Japan").model_dump()
    assert dumped["result"] == expected


def test_health(http_client: TestClient) -> None:
    response = http_client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_query_out_of_scope(
    http_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from mcp_simverse import server as server_mod

    monkeypatch.setattr(
        server_mod,
        "get_pipeline",
        lambda: QueryPipeline(mcp, FakeClassifier("out_of_scope")),
    )
    response = http_client.post("/v1/query", json={"text": "write me a python script"})
    assert response.status_code == 200
    body = response.json()
    assert body["refused"] is True
    assert body["intent"] == "out_of_scope"


def test_query_requires_openrouter_key(
    http_client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from mcp_simverse import server as server_mod

    monkeypatch.setattr(
        server_mod,
        "get_pipeline",
        lambda: QueryPipeline(mcp, OpenRouterClient(api_key="")),
    )
    response = http_client.post("/v1/query", json={"text": "Japan eSIM"})
    assert response.status_code == 503
    assert "OPENROUTER_API_KEY" in response.json()["error"]
