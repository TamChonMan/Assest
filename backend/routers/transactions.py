"""
Transactions Router: CRUD operations for financial transactions.
Handles balance updates on Deposit, Withdraw, Buy, Sell.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Account, Transaction, TransactionType

# ─── Request Schema ────────────────────────────────────────────────
class TransactionCreate(BaseModel):
    date: datetime
    type: TransactionType
    account_id: int
    asset_id: Optional[int] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    fee: Optional[float] = None
    total: float
    notes: Optional[str] = None


# ─── Router ────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)


@router.post("/", response_model=Transaction)
def create_transaction(
    payload: TransactionCreate,
    session: Session = Depends(get_session),
):
    # 1. Validate account exists
    account = session.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. Balance logic
    if payload.type == TransactionType.DEPOSIT:
        account.balance += payload.total
    elif payload.type == TransactionType.WITHDRAW:
        if account.balance < payload.total:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        account.balance -= payload.total
    elif payload.type == TransactionType.BUY:
        if account.balance < payload.total:
            raise HTTPException(status_code=400, detail="Insufficient funds")
        account.balance -= payload.total
    elif payload.type == TransactionType.SELL:
        account.balance += payload.total

    # 3. Create transaction record
    transaction = Transaction(
        date=payload.date,
        type=payload.type,
        account_id=payload.account_id,
        asset_id=payload.asset_id,
        quantity=payload.quantity,
        price=payload.price,
        fee=payload.fee,
        total=payload.total,
        notes=payload.notes,
    )
    session.add(transaction)
    session.add(account)
    session.commit()
    session.refresh(transaction)
    return transaction


@router.get("/", response_model=List[Transaction])
def list_transactions(
    account_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
):
    statement = select(Transaction)
    if account_id is not None:
        statement = statement.where(Transaction.account_id == account_id)
    statement = statement.order_by(Transaction.date.desc())
    return session.exec(statement).all()
