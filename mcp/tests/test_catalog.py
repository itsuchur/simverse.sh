import json
from types import SimpleNamespace

import pytest

from mcp_simverse.catalog import (
    GIB,
    PRICE_SCALE,
    _search_query,
    get_package,
    package_from_doc,
    search_packages,
    search_tokens,
)
from mcp_simverse.tools import get_esim_package, search_esim_packages


def test_search_tokens_strip_punctuation() -> None:
    assert search_tokens("Spain!") == ["spain"]
    assert search_tokens("???") == []


def test_search_query_includes_duration_filter() -> None:
    query = _search_query("esimaccess", "123", ["spain"], 30)
    assert "@supplier:{esimaccess}" in query
    assert "@generation:{123}" in query
    assert "@searchText:(w'*spain*')" in query
    assert "@duration:[30 30]" in query


def test_package_from_doc_converts_bytes_and_price_scale() -> None:
    pkg = package_from_doc(
        {
            "packageCode": "ES3",
            "name": "Spain 3GB 30Days",
            "location": "ES",
            "volume": 3 * GIB,
            "duration": 30,
            "retailPrice": 49_900,
        }
    )
    assert pkg.id == "ES3"
    assert pkg.destination == "ES"
    assert pkg.days == 30
    assert pkg.data_gb == 3.0
    assert pkg.price_usd == 4.99


class _FakeSearch:
    def __init__(self, docs: list[object]) -> None:
        self._docs = docs

    def search(self, _query: object) -> object:
        return SimpleNamespace(docs=self._docs)


class _FakeJson:
    def __init__(self, store: dict[str, object]) -> None:
        self._store = store

    def get(self, key: str) -> object:
        return self._store.get(key)


class _FakeRedis:
    def __init__(self) -> None:
        self.kv: dict[str, str] = {}
        self.json_store: dict[str, object] = {}
        self.search_docs: list[object] = []

    def get(self, key: str) -> str | None:
        return self.kv.get(key)

    def json(self) -> _FakeJson:
        return _FakeJson(self.json_store)

    def ft(self, _index: str) -> _FakeSearch:
        return _FakeSearch(self.search_docs)


def test_search_packages_maps_redis_docs(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    fake.kv["catalog:current:esimaccess"] = "gen1"
    fake.search_docs = [
        SimpleNamespace(
            json=json.dumps(
                {
                    "packageCode": "JP5",
                    "name": "Japan 5GB 7Days",
                    "location": "JP",
                    "volume": 5 * GIB,
                    "duration": 7,
                    "retailPrice": 99_900,
                }
            )
        )
    ]
    monkeypatch.setattr("mcp_simverse.catalog.get_redis", lambda: fake)
    packages = search_packages("Japan")
    assert len(packages) == 1
    assert packages[0].id == "JP5"
    assert packages[0].data_gb == 5.0
    result = search_esim_packages(destination="Japan")
    assert result.packages[0].id == "JP5"


def test_search_packages_filters_data_gb(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    fake.kv["catalog:current:esimaccess"] = "gen1"
    fake.search_docs = [
        SimpleNamespace(
            json=json.dumps(
                {
                    "packageCode": "JP3",
                    "name": "Japan 3GB 7Days",
                    "location": "JP",
                    "volume": 3 * GIB,
                    "duration": 7,
                    "retailPrice": 10_000,
                }
            )
        ),
        SimpleNamespace(
            json=json.dumps(
                {
                    "packageCode": "JP5",
                    "name": "Japan 5GB 7Days",
                    "location": "JP",
                    "volume": 5 * GIB,
                    "duration": 7,
                    "retailPrice": 20_000,
                }
            )
        ),
    ]
    monkeypatch.setattr("mcp_simverse.catalog.get_redis", lambda: fake)
    packages = search_packages("Japan", data_gb=5)
    assert [pkg.id for pkg in packages] == ["JP5"]


def test_get_package_reads_current_generation(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    fake.kv["catalog:current:esimaccess"] = "gen1"
    fake.json_store["catalog:package:esimaccess:gen1:ES3"] = {
        "packageCode": "ES3",
        "name": "Spain 3GB 30Days",
        "location": "ES",
        "volume": 3 * GIB,
        "duration": 30,
        "retailPrice": 49_900,
    }
    monkeypatch.setattr("mcp_simverse.catalog.get_redis", lambda: fake)
    pkg = get_package("ES3")
    assert pkg is not None
    assert pkg.id == "ES3"
    assert pkg.price_usd == 49_900 / PRICE_SCALE
    result = get_esim_package("ES3")
    assert result.found is True
    assert result.package is not None
    assert result.package.id == "ES3"


def test_get_package_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    fake = _FakeRedis()
    fake.kv["catalog:current:esimaccess"] = "gen1"
    monkeypatch.setattr("mcp_simverse.catalog.get_redis", lambda: fake)
    result = get_esim_package("NOPE")
    assert result.found is False
    assert result.package is None
