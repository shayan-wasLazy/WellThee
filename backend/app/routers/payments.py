from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models import PayPalEvent, Payment, User
from app.schemas import PayPalCaptureResponse, PayPalOrderRequest, PayPalOrderResponse
from app.services.paypal import capture_order, create_order, verify_webhook

router = APIRouter(prefix="/payments/paypal", tags=["PayPal"])


@router.post("/orders", response_model=PayPalOrderResponse, status_code=status.HTTP_201_CREATED)
def create_paypal_order(
    payload: PayPalOrderRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PayPalOrderResponse:
    if payload.currency.upper() not in {"USD", "EUR", "GBP", "CAD", "AUD"}:
        raise HTTPException(status_code=422, detail="Choose a PayPal-supported checkout currency for this demo flow.")
    order = create_order(
        amount=f"{payload.amount:.2f}",
        currency=payload.currency.upper(),
        description=payload.description,
        return_url=payload.return_url,
        cancel_url=payload.cancel_url,
    )
    approval_url = next(
        (link["href"] for link in order.get("links", []) if link.get("rel") in {"approve", "payer-action"}),
        None,
    )
    if not order.get("id") or not approval_url:
        raise HTTPException(status_code=502, detail="PayPal did not return a usable approval link.")
    payment = Payment(
        user_id=user.id,
        provider_order_id=order["id"],
        amount=payload.amount,
        currency=payload.currency.upper(),
        description=payload.description,
        status=order.get("status", "CREATED"),
    )
    db.add(payment)
    db.commit()
    return PayPalOrderResponse(order_id=order["id"], status=payment.status, approval_url=approval_url)


@router.post("/orders/{order_id}/capture", response_model=PayPalCaptureResponse)
def capture_paypal_order(
    order_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PayPalCaptureResponse:
    payment = db.scalar(select(Payment).where(Payment.provider_order_id == order_id, Payment.user_id == user.id))
    if not payment:
        raise HTTPException(status_code=404, detail="PayPal order not found.")
    if payment.status == "COMPLETED":
        return PayPalCaptureResponse(order_id=order_id, status=payment.status, capture_id=payment.provider_capture_id)
    result = capture_order(order_id)
    status_value = result.get("status", "UNKNOWN")
    capture_id = None
    for unit in result.get("purchase_units", []):
        for capture in unit.get("payments", {}).get("captures", []):
            capture_id = capture.get("id") or capture_id
    payment.status = status_value
    payment.provider_capture_id = capture_id
    db.commit()
    return PayPalCaptureResponse(order_id=order_id, status=status_value, capture_id=capture_id)


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def paypal_webhook(request: Request, db: Session = Depends(get_db)) -> dict[str, str]:
    event = await request.json()
    header_map = {key.lower(): value for key, value in request.headers.items()}
    if not verify_webhook(header_map, event):
        raise HTTPException(status_code=400, detail="PayPal webhook signature could not be verified.")

    event_id = event.get("id")
    event_type = event.get("event_type", "UNKNOWN")
    resource = event.get("resource", {})
    resource_id = resource.get("id")
    if not event_id:
        raise HTTPException(status_code=400, detail="PayPal event is missing its event ID.")

    if db.scalar(select(PayPalEvent).where(PayPalEvent.provider_event_id == event_id)):
        return {"status": "duplicate_ignored"}

    db.add(PayPalEvent(provider_event_id=event_id, event_type=event_type, resource_id=resource_id))
    related = resource.get("supplementary_data", {}).get("related_ids", {})
    order_id = related.get("order_id") or (resource.get("id") if event_type.startswith("CHECKOUT.ORDER.") else None)
    if order_id:
        payment = db.scalar(select(Payment).where(Payment.provider_order_id == order_id))
        if payment:
            if event_type == "PAYMENT.CAPTURE.COMPLETED":
                payment.status = "COMPLETED"
                payment.provider_capture_id = resource_id
            elif event_type == "PAYMENT.CAPTURE.DENIED":
                payment.status = "DENIED"
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"status": "duplicate_ignored"}
    return {"status": "accepted"}
