from typing import Literal, get_args

Intent = Literal[
    "catalog_search",
    "order_help",
    "compatibility",
    "esim_question",
    "out_of_scope",
]

INTENTS: tuple[Intent, ...] = get_args(Intent)

ALLOWED_TOOLS: dict[Intent, tuple[str, ...]] = {
    "catalog_search": ("search_esim_packages", "get_esim_package"),
    "order_help": ("create_checkout", "get_order_status", "get_esim_delivery"),
    "compatibility": ("check_device_compatibility",),
    "esim_question": (
        "search_esim_packages",
        "get_esim_package",
        "check_device_compatibility",
    ),
    "out_of_scope": (),
}

OUT_OF_SCOPE_MESSAGE = (
    "This service only helps with eSIM packages, compatibility, and orders."
)


def tools_for_intent(intent: Intent) -> tuple[str, ...]:
    return ALLOWED_TOOLS[intent]
