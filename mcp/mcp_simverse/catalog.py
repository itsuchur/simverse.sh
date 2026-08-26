from __future__ import annotations

import json
import os
from typing import Any

from redis import Redis
from redis.commands.search.query import Query

from mcp_simverse.models import EsimPackage

CATALOG_INDEX = "idx:catalog:packages"
ESIMACCESS_SUPPLIER = "esimaccess"
PRICE_SCALE = 10_000
GIB = 1024**3
SEARCH_LIMIT = 10_000
RESULT_LIMIT = 20
DATA_GB_TOLERANCE = 0.05

_client: Redis | None = None


class CatalogError(RuntimeError):
    pass


def escape_tag(value: str) -> str:
    return "".join(ch if ch.isalnum() else f"\\{ch}" for ch in value)


def search_tokens(query: str) -> list[str]:
    tokens: list[str] = []
    for part in query.casefold().split():
        token = "".join(ch for ch in part if ch.isalnum())
        if token:
            tokens.append(token)
    return tokens


def get_redis() -> Redis:
    global _client
    url = os.getenv("REDIS_URL")
    if not url:
        raise CatalogError("REDIS_URL is not configured")
    if _client is None:
        _client = Redis.from_url(url, decode_responses=True)
    return _client


def _unwrap_json(value: Any) -> dict[str, Any] | None:
    if value is None:
        return None
    if isinstance(value, list):
        value = value[0] if value else None
    if isinstance(value, str):
        value = json.loads(value)
    if isinstance(value, dict):
        return value
    return None


def package_from_doc(doc: dict[str, Any]) -> EsimPackage:
    code = str(doc.get("packageCode") or "")
    volume = float(doc.get("volume") or 0)
    retail = doc.get("retailPrice")
    if not isinstance(retail, (int, float)):
        retail = doc.get("price") or 0
    duration = doc.get("duration") or 0
    return EsimPackage(
        id=code,
        name=str(doc.get("name") or code),
        destination=str(doc.get("location") or ""),
        days=int(duration),
        data_gb=volume / GIB,
        price_usd=float(retail) / PRICE_SCALE,
    )


def _current_generation(redis: Redis, supplier: str) -> str | None:
    generation = redis.get(f"catalog:current:{supplier}")
    if generation is None or generation == "":
        return None
    return str(generation)


def _search_query(
    supplier: str,
    generation: str,
    tokens: list[str],
    days: int | None,
) -> str:
    parts = [
        f"@supplier:{{{escape_tag(supplier)}}}",
        f"@generation:{{{escape_tag(generation)}}}",
    ]
    parts.extend(f"@searchText:(w'*{token}*')" for token in tokens)
    if days is not None:
        parts.append(f"@duration:[{days} {days}]")
    return " ".join(parts)


def _docs_from_search(result: Any) -> list[dict[str, Any]]:
    packages: list[dict[str, Any]] = []
    for doc in getattr(result, "docs", []):
        raw = getattr(doc, "json", None)
        parsed = _unwrap_json(raw)
        if parsed is None:
            parsed = {
                key: value
                for key, value in vars(doc).items()
                if key not in {"id", "payload"}
            }
        if parsed.get("packageCode"):
            packages.append(parsed)
    return packages


def _matches_data_gb(doc: dict[str, Any], data_gb: float | None) -> bool:
    if data_gb is None:
        return True
    volume = float(doc.get("volume") or 0)
    return abs(volume / GIB - data_gb) <= DATA_GB_TOLERANCE


def search_packages(
    destination: str,
    days: int | None = None,
    data_gb: float | None = None,
    *,
    supplier: str = ESIMACCESS_SUPPLIER,
) -> list[EsimPackage]:
    tokens = search_tokens(destination)
    if not tokens:
        return []

    redis = get_redis()
    generation = _current_generation(redis, supplier)
    if generation is None:
        return []

    query = Query(_search_query(supplier, generation, tokens, days))
    query = query.paging(0, SEARCH_LIMIT).dialect(2)
    result = redis.ft(CATALOG_INDEX).search(query)
    matches = [
        package_from_doc(doc)
        for doc in _docs_from_search(result)
        if _matches_data_gb(doc, data_gb)
    ]
    return matches[:RESULT_LIMIT]


def get_package(
    package_id: str,
    *,
    supplier: str = ESIMACCESS_SUPPLIER,
) -> EsimPackage | None:
    redis = get_redis()
    generation = _current_generation(redis, supplier)
    if generation is None:
        return None
    key = f"catalog:package:{supplier}:{generation}:{package_id}"
    doc = _unwrap_json(redis.json().get(key))
    if doc is None:
        return None
    return package_from_doc(doc)
