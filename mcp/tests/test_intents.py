from mcp_simverse.intents import (
    ALLOWED_TOOLS,
    INTENTS,
    OUT_OF_SCOPE_MESSAGE,
    tools_for_intent,
)


def test_all_intents_have_allow_list() -> None:
    assert set(ALLOWED_TOOLS) == set(INTENTS)


def test_catalog_search_tools() -> None:
    assert tools_for_intent("catalog_search") == (
        "search_esim_packages",
        "get_esim_package",
    )


def test_order_help_tools() -> None:
    assert tools_for_intent("order_help") == (
        "create_checkout",
        "get_order_status",
        "get_esim_delivery",
    )


def test_compatibility_tools() -> None:
    assert tools_for_intent("compatibility") == ("check_device_compatibility",)


def test_esim_question_is_informational() -> None:
    tools = tools_for_intent("esim_question")
    assert "create_checkout" not in tools
    assert "get_order_status" not in tools
    assert "get_esim_delivery" not in tools
    assert tools == (
        "search_esim_packages",
        "get_esim_package",
        "check_device_compatibility",
    )


def test_out_of_scope_has_no_tools() -> None:
    assert tools_for_intent("out_of_scope") == ()
    assert "eSIM" in OUT_OF_SCOPE_MESSAGE
