import httpx
from fastapi import HTTPException, status

from app.config import get_settings


def _credentials() -> tuple[str, str]:
    settings = get_settings()
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="PayPal is not configured. Add the PayPal Sandbox credentials to the backend environment.",
        )
    return settings.paypal_client_id, settings.paypal_client_secret


def _access_token(client: httpx.Client) -> str:
    settings = get_settings()
    client_id, secret = _credentials()
    response = client.post(
        f"{settings.paypal_base_url}/v1/oauth2/token",
        auth=(client_id, secret),
        headers={"Accept": "application/json", "Accept-Language": "en_US"},
        data={"grant_type": "client_credentials"},
    )
    if response.is_error:
        raise HTTPException(status_code=502, detail="PayPal authentication failed.")
    token = response.json().get("access_token")
    if not token:
        raise HTTPException(status_code=502, detail="PayPal did not return an access token.")
    return str(token)


def create_order(amount: str, currency: str, description: str, return_url: str, cancel_url: str) -> dict:
    settings = get_settings()
    with httpx.Client(timeout=20) as client:
        token = _access_token(client)
        response = client.post(
            f"{settings.paypal_base_url}/v2/checkout/orders",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": f"wealthos-{__import__('uuid').uuid4()}",
            },
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "description": description,
                    "amount": {"currency_code": currency.upper(), "value": amount},
                }],
                "payment_source": {
                    "paypal": {
                        "experience_context": {
                            "return_url": return_url,
                            "cancel_url": cancel_url,
                            "user_action": "PAY_NOW",
                        }
                    }
                },
            },
        )
        if response.is_error:
            raise HTTPException(status_code=502, detail="PayPal could not create the order.")
        return response.json()


def capture_order(order_id: str) -> dict:
    settings = get_settings()
    with httpx.Client(timeout=20) as client:
        token = _access_token(client)
        response = client.post(
            f"{settings.paypal_base_url}/v2/checkout/orders/{order_id}/capture",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "PayPal-Request-Id": f"wealthos-capture-{order_id}",
            },
            json={},
        )
        if response.is_error:
            raise HTTPException(status_code=502, detail="PayPal could not capture the approved order.")
        return response.json()


def verify_webhook(headers: dict[str, str], event: dict) -> bool:
    settings = get_settings()
    if not settings.paypal_webhook_id:
        raise HTTPException(status_code=503, detail="PayPal webhook verification is not configured.")
    required = {
        "auth_algo": headers.get("paypal-auth-algo"),
        "cert_url": headers.get("paypal-cert-url"),
        "transmission_id": headers.get("paypal-transmission-id"),
        "transmission_sig": headers.get("paypal-transmission-sig"),
        "transmission_time": headers.get("paypal-transmission-time"),
    }
    if any(not value for value in required.values()):
        return False
    with httpx.Client(timeout=20) as client:
        token = _access_token(client)
        response = client.post(
            f"{settings.paypal_base_url}/v1/notifications/verify-webhook-signature",
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            json={
                **required,
                "webhook_id": settings.paypal_webhook_id,
                "webhook_event": event,
            },
        )
        if response.is_error:
            raise HTTPException(status_code=502, detail="PayPal webhook verification request failed.")
        return response.json().get("verification_status") == "SUCCESS"
