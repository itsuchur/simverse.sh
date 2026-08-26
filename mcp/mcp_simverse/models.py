from typing import Any, Literal

from pydantic import BaseModel, Field

from mcp_simverse.intents import Intent


class QueryRequest(BaseModel):
    text: str = Field(min_length=1)


class IntentClassification(BaseModel):
    intent: Intent
    reason: str = ""


class ToolSelection(BaseModel):
    tool: str
    arguments: dict[str, Any] = Field(default_factory=dict)


class QuerySuccess(BaseModel):
    intent: Intent
    tool: str
    arguments: dict[str, Any]
    result: Any


class QueryRefused(BaseModel):
    intent: Literal["out_of_scope"] = "out_of_scope"
    refused: Literal[True] = True
    message: str


class SearchEsimPackagesInput(BaseModel):
    destination: str
    days: int | None = None
    data_gb: float | None = None


class GetEsimPackageInput(BaseModel):
    package_id: str


class CheckDeviceCompatibilityInput(BaseModel):
    device_model: str
    os: str | None = None


class CreateCheckoutInput(BaseModel):
    package_id: str
    email: str | None = None
    quantity: int = 1


class GetOrderStatusInput(BaseModel):
    order_id: str


class GetEsimDeliveryInput(BaseModel):
    order_id: str


class EsimPackage(BaseModel):
    id: str
    name: str
    destination: str
    days: int
    data_gb: float
    price_usd: float


class SearchEsimPackagesResult(BaseModel):
    packages: list[EsimPackage]


class GetEsimPackageResult(BaseModel):
    found: bool
    package: EsimPackage | None = None


class DeviceCompatibilityResult(BaseModel):
    device_model: str
    os: str | None
    esim_supported: bool
    notes: str


class CheckoutResult(BaseModel):
    checkout_id: str
    order_id: str
    package_id: str
    email: str | None
    quantity: int
    status: str
    checkout_url: str


class OrderStatusResult(BaseModel):
    order_id: str
    status: str
    package_id: str


class EsimDeliveryResult(BaseModel):
    order_id: str
    status: str
    activation_code: str | None
    qr_url: str | None
    smdp_address: str | None


TOOL_INPUT_MODELS: dict[str, type[BaseModel]] = {
    "search_esim_packages": SearchEsimPackagesInput,
    "get_esim_package": GetEsimPackageInput,
    "check_device_compatibility": CheckDeviceCompatibilityInput,
    "create_checkout": CreateCheckoutInput,
    "get_order_status": GetOrderStatusInput,
    "get_esim_delivery": GetEsimDeliveryInput,
}


def tool_json_schemas(tool_names: tuple[str, ...]) -> dict[str, dict[str, Any]]:
    return {
        name: TOOL_INPUT_MODELS[name].model_json_schema()
        for name in tool_names
        if name in TOOL_INPUT_MODELS
    }
