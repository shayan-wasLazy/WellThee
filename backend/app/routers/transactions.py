import csv
import hashlib
import io
from datetime import date
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.models import Transaction, User
from app.schemas import TransactionCreate, TransactionRead, TransactionUpdate

router = APIRouter(prefix="/transactions", tags=["transactions"])
MAX_IMPORT_BYTES = 5 * 1024 * 1024


@router.get("", response_model=list[TransactionRead])
def list_transactions(
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    from_date: date | None = None,
    to_date: date | None = None,
    category: str | None = None,
    type: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Transaction]:
    query = select(Transaction).where(Transaction.user_id == user.id)
    if from_date:
        query = query.where(Transaction.occurred_on >= from_date)
    if to_date:
        query = query.where(Transaction.occurred_on <= to_date)
    if category:
        query = query.where(Transaction.category == category)
    if type:
        query = query.where(Transaction.type == type)
    return list(db.scalars(query.order_by(Transaction.occurred_on.desc(), Transaction.created_at.desc()).limit(limit).offset(offset)))


@router.post("", response_model=TransactionRead, status_code=status.HTTP_201_CREATED)
def create_transaction(
    payload: TransactionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    record = Transaction(user_id=user.id, **payload.model_dump())
    record.currency = record.currency.upper()
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.patch("/{transaction_id}", response_model=TransactionRead)
def update_transaction(
    transaction_id: str,
    payload: TransactionUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Transaction:
    record = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    updates = payload.model_dump(exclude_unset=True)
    if any(value is None for value in updates.values()):
        raise HTTPException(status_code=422, detail="Transaction fields cannot be set to null.")
    for key, value in updates.items():
        setattr(record, key, value.upper() if key == "currency" else value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_transaction(
    transaction_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    record = db.scalar(select(Transaction).where(Transaction.id == transaction_id, Transaction.user_id == user.id))
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    db.delete(record)
    db.commit()


@router.post("/import", status_code=status.HTTP_200_OK)
async def import_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, int]:
    raw = await file.read(MAX_IMPORT_BYTES + 1)
    if len(raw) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail="CSV import is limited to 5 MB.")
    try:
        text = raw.decode("utf-8-sig")
        reader = csv.DictReader(io.StringIO(text))
        required = {"date", "description", "amount"}
        headers = {header.strip().lower() for header in (reader.fieldnames or [])}
        if not required.issubset(headers):
            raise HTTPException(status_code=422, detail="CSV requires date, description and amount columns.")
        rows = []
        seen: set[str] = set()
        for line_number, row in enumerate(reader, start=2):
            values = {str(key).strip().lower(): (value or "").strip() for key, value in row.items() if key}
            try:
                occurred_on = date.fromisoformat(values["date"])
                amount = Decimal(values["amount"].replace(",", "").replace("₹", "").strip())
                description = values["description"][:240]
                category = values.get("category", "Other") or "Other"
                tx_type = values.get("type", "expense").lower() or "expense"
                currency = (values.get("currency", "INR") or "INR").upper()
                account = values.get("account", "CSV import") or "CSV import"
            except (KeyError, ValueError, InvalidOperation) as exc:
                raise HTTPException(status_code=422, detail=f"Invalid CSV data on row {line_number}.") from exc
            if amount <= 0 or not description or tx_type not in {"income", "expense", "transfer", "refund"}:
                raise HTTPException(status_code=422, detail=f"Invalid amount, description or type on row {line_number}.")
            canonical = "|".join([occurred_on.isoformat(), description.casefold(), str(amount), tx_type, category.casefold(), account.casefold(), currency])
            fingerprint = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
            if fingerprint in seen:
                continue
            seen.add(fingerprint)
            rows.append((occurred_on, description, amount, tx_type, category, currency, account, fingerprint))
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=422, detail="Upload a UTF-8 encoded CSV file.") from exc

    existing = set(db.scalars(select(Transaction.import_fingerprint).where(
        Transaction.user_id == user.id,
        Transaction.import_fingerprint.in_([row[7] for row in rows]) if rows else False,
    )))
    inserted = 0
    for occurred_on, description, amount, tx_type, category, currency, account, fingerprint in rows:
        if fingerprint in existing:
            continue
        db.add(Transaction(
            user_id=user.id, occurred_on=occurred_on, description=description, amount=amount,
            type=tx_type, category=category, currency=currency, account=account,
            import_fingerprint=fingerprint,
        ))
        inserted += 1
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="One or more imported records conflict with existing data.")
    await file.close()
    return {"inserted": inserted, "duplicates": len(rows) - inserted}
