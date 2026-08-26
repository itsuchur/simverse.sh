from fastmcp import FastMCP

import mcp_simverse.catalog as catalog
from mcp_simverse.models import (
    CheckoutResult,
    DeviceCompatibilityResult,
    EsimDeliveryResult,
    GetEsimPackageResult,
    OrderStatusResult,
    SearchEsimPackagesResult,
)


def search_esim_packages(
    destination: str,
    days: int | None = None,
    data_gb: float | None = None,
) -> SearchEsimPackagesResult:
    """Search available eSIM data packages by destination and optional duration/data."""
    return SearchEsimPackagesResult(
        packages=catalog.search_packages(destination, days=days, data_gb=data_gb)
    )


def get_esim_package(package_id: str) -> GetEsimPackageResult:
    """Get a single eSIM package by id."""
    package = catalog.get_package(package_id)
    return GetEsimPackageResult(found=package is not None, package=package)


def check_device_compatibility(
    device_model: str,
    os: str | None = None,
) -> DeviceCompatibilityResult:
    """Check whether a device is likely to support eSIM."""
    model_l = device_model.casefold()
    unsupported = any(token in model_l for token in ("iphone 6", "iphone xr", "nokia 3310"))
    return DeviceCompatibilityResult(
        device_model=device_model,
        os=os,
        esim_supported=not unsupported,
        notes=(
            "Placeholder compatibility result. Confirm with the carrier before purchase."
            if not unsupported
            else "This placeholder catalog treats the device as eSIM-incompatible."
        ),
    )


def create_checkout(
    package_id: str,
    email: str | None = None,
    quantity: int = 1,
) -> CheckoutResult:
    """Create a checkout session for an eSIM package."""
    order_id = f"ord_{package_id}"
    checkout_id = f"chk_{package_id}"
    return CheckoutResult(
        checkout_id=checkout_id,
        order_id=order_id,
        package_id=package_id,
        email=email,
        quantity=quantity,
        status="pending_payment",
        checkout_url=f"https://checkout.simverse.example/{checkout_id}",
    )


def get_order_status(order_id: str) -> OrderStatusResult:
    """Look up the status of an eSIM order."""
    return OrderStatusResult(
        order_id=order_id,
        status="paid",
        package_id="pkg_jp_7d_5gb",
    )


def get_esim_delivery(order_id: str) -> EsimDeliveryResult:
    """Get eSIM delivery details (activation code / QR) for an order."""
    return EsimDeliveryResult(
        order_id=order_id,
        status="ready",
        activation_code="LPA:1$smdp.example$PLACEHOLDER-CODE",
        qr_url=f"https://delivery.simverse.example/{order_id}/qr.png",
        smdp_address="smdp.example",
    )


def register_tools(mcp: FastMCP) -> None:
    mcp.tool(search_esim_packages)
    mcp.tool(get_esim_package)
    mcp.tool(check_device_compatibility)
    mcp.tool(create_checkout)
    mcp.tool(get_order_status)
    mcp.tool(get_esim_delivery)
