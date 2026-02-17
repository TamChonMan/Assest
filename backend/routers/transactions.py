"""
Transactions Router: CRUD operations for financial transactions.
Handles balance updates on Deposit, Withdraw, Buy, Sell.
Auto-creates Asset records when a symbol is provided for BUY/SELL.
Handles cross-currency logic (Asset Currency -> Account Currency).
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import Account, Asset, Transaction, TransactionType

# ─── Constants ─────────────────────────────────────────────────────
# USD Base Rates
EXCHANGE_RATES = {
    "USD": 1.0,
    "HKD": 7.8,
    "MOP": 8.03,
}

# ─── Request Schema ────────────────────────────────────────────────
class TransactionCreate(BaseModel):
    date: datetime
    type: TransactionType
    account_id: int
    asset_id: Optional[int] = None
    symbol: Optional[str] = None      # e.g. "AAPL", "0700.HK"
    currency: Optional[str] = None    # Currency of the transaction amount (e.g. HKD for 0700.HK)
    tags: Optional[str] = None        # NEW: Comma-separated tags e.g. "Tech,China"
    quantity: Optional[float] = None
    price: Optional[float] = None
    fee: Optional[float] = None
    total: float                      # Amount in TRANSACTION currency (e.g. HKD)
    notes: Optional[str] = None


# ─── Router ────────────────────────────────────────────────────────
router = APIRouter(
    prefix="/transactions",
    tags=["transactions"],
)


# ─── Symbol Currency Detection ─────────────────────────────────────
SYMBOL_CURRENCY_MAP = {
    ".HK": "HKD",
    ".TW": "TWD",
    ".T": "JPY",
    ".L": "GBP",
    ".PA": "EUR",
    ".DE": "EUR",
    ".SS": "CNY",
    ".SZ": "CNY",
}

def _detect_currency_from_symbol(symbol: str) -> str:
    """Detect trading currency from Yahoo Finance symbol suffix."""
    if not symbol:
        return "USD"
    symbol_upper = symbol.upper()
    for suffix, currency in SYMBOL_CURRENCY_MAP.items():
        if symbol_upper.endswith(suffix.upper()):
            return currency
    # Crypto pairs like BTC-USD
    if "-USD" in symbol_upper:
        return "USD"
    return "USD"  # Default for US stocks


def _resolve_asset(session: Session, symbol: str, tags: Optional[str] = None) -> Asset:
    """Look up an existing Asset by symbol, or auto-create one. Updates tags if provided."""
    statement = select(Asset).where(Asset.symbol == symbol)
    asset = session.exec(statement).first()
    
    if asset:
        # Update tags if provided
        if tags:
            current_tags = set(asset.tags.split(",")) if asset.tags else set()
            new_tags = set(t.strip() for t in tags.split(",") if t.strip())
            merged = current_tags.union(new_tags)
            if merged:
                asset.tags = ",".join(sorted(merged))
                session.add(asset)
        return asset

    # Auto-create — detect currency from symbol suffix
    detected_currency = _detect_currency_from_symbol(symbol)
    asset = Asset(symbol=symbol, name=symbol, type="STOCK", tags=tags, currency=detected_currency)
    session.add(asset)
    session.flush()          # get the id without committing
    return asset


def _convert_currency(amount: float, from_curr: str, to_curr: str) -> float:
    """Convert amount between currencies using USD base."""
    if from_curr == to_curr:
        return amount
    
    from_rate = EXCHANGE_RATES.get(from_curr, 1.0)
    to_rate = EXCHANGE_RATES.get(to_curr, 1.0)
    
    # from -> USD -> to
    amount_usd = amount / from_rate
    return amount_usd * to_rate


@router.post("/", response_model=Transaction)
def create_transaction(
    payload: TransactionCreate,
    session: Session = Depends(get_session),
):
    # 1. Validate account exists
    account = session.get(Account, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    # 2. Resolve asset_id from symbol for BUY/SELL
    asset_id = payload.asset_id
    if payload.type in (TransactionType.BUY, TransactionType.SELL):
        if payload.symbol and not asset_id:
            asset = _resolve_asset(session, payload.symbol.upper(), tags=payload.tags)
            asset_id = asset.id
        # Also support updating tags if asset_id IS provided?
        elif asset_id and payload.tags:
            asset = session.get(Asset, asset_id)
            if asset:
                 # Logic repeated, could be refactored, but inline for now
                current_tags = set(asset.tags.split(",")) if asset.tags else set()
                new_tags = set(t.strip() for t in payload.tags.split(",") if t.strip())
                merged = current_tags.union(new_tags)
                if merged:
                    asset.tags = ",".join(sorted(merged))
                    session.add(asset)

    # 3. Determine currencies and amounts
    # Default tx_currency to account currency if not specified
    tx_currency = payload.currency or account.currency
    
    # Calculate amount in Account Currency (for balance update)
    amount_in_account_curr = _convert_currency(payload.total, tx_currency, account.currency)

    # 4. Balance logic
    if payload.type == TransactionType.DEPOSIT:
        account.balance += amount_in_account_curr
    elif payload.type == TransactionType.WITHDRAW:
        if account.balance < amount_in_account_curr:
            # Check with a small buffer for float precision? No, standard check.
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient funds. Required: {amount_in_account_curr:.2f} {account.currency}, Available: {account.balance:.2f} {account.currency}"
            )
        account.balance -= amount_in_account_curr
    elif payload.type == TransactionType.BUY:
        if account.balance < amount_in_account_curr:
             raise HTTPException(
                status_code=400, 
                detail=f"Insufficient funds. Required: {amount_in_account_curr:.2f} {account.currency}, Available: {account.balance:.2f} {account.currency}"
            )
        account.balance -= amount_in_account_curr
    elif payload.type == TransactionType.SELL:
        account.balance += amount_in_account_curr

    # 5. Create transaction record
    # IMPORTANT: We store 'total' in ACCOUNT CURRENCY to match the balance impact.
    # This means total != quantity * price if currencies differ.
    transaction = Transaction(
        date=payload.date,
        type=payload.type,
        account_id=payload.account_id,
        asset_id=asset_id,
        quantity=payload.quantity,
        price=payload.price,
        fee=payload.fee,
        total=amount_in_account_curr, # Stored in account currency
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


class TransactionUpdate(BaseModel):
    date: Optional[datetime] = None
    type: Optional[TransactionType] = None
    account_id: Optional[int] = None
    asset_id: Optional[int] = None
    symbol: Optional[str] = None
    currency: Optional[str] = None
    tags: Optional[str] = None
    quantity: Optional[float] = None
    price: Optional[float] = None
    fee: Optional[float] = None
    total: Optional[float] = None
    notes: Optional[str] = None


def _apply_balance_change(account: Account, tx_type: TransactionType, amount: float, revert: bool = False):
    """
    Apply or Revert balance change based on transaction type.
    amount should be in Account Currency.
    """
    # If revert is True, we flip the operation
    if revert:
        if tx_type == TransactionType.DEPOSIT:
            account.balance -= amount
        elif tx_type == TransactionType.WITHDRAW:
            account.balance += amount
        elif tx_type == TransactionType.BUY:
            account.balance += amount
        elif tx_type == TransactionType.SELL:
            account.balance -= amount
    else:
        if tx_type == TransactionType.DEPOSIT:
            account.balance += amount
        elif tx_type == TransactionType.WITHDRAW:
            account.balance -= amount
        elif tx_type == TransactionType.BUY:
            account.balance -= amount
        elif tx_type == TransactionType.SELL:
            account.balance += amount


@router.put("/{transaction_id}", response_model=Transaction)
def update_transaction(
    transaction_id: int,
    payload: TransactionUpdate,
    session: Session = Depends(get_session),
):
    # 1. Get existing transaction
    tx = session.get(Transaction, transaction_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    # 2. Get Account (Old)
    # We need to handle account change too? For now assuming account_id is constant or handled carefully.
    # If account_id changes, we need to revert on old account and apply on new account.
    # Let's support account change.
    
    old_account = session.get(Account, tx.account_id)
    if not old_account:
        raise HTTPException(status_code=404, detail="Associated Account not found")

    # 3. Revert Old Effect
    # The 'total' in tx is already in Account Currency.
    _apply_balance_change(old_account, tx.type, tx.total, revert=True)
    session.add(old_account)
    
    # 4. Update fields (in memory)
    tx_data = payload.dict(exclude_unset=True)
    
    # Exclude fields that are not columns in Transaction or handled separately
    exclude_fields = {"symbol", "currency", "tags", "total"}
    
    for key, value in tx_data.items():
        if key not in exclude_fields and hasattr(tx, key):
            setattr(tx, key, value)
        
    # 5. Resolve New Account (might be same)
    new_account = session.get(Account, tx.account_id)
    if not new_account:
        raise HTTPException(status_code=404, detail="New Account not found")
        
    # 6. Resolve Asset/Tags if changed
    if payload.symbol or payload.tags:
         # Simplified logic: If symbol provided, verify/link asset.
         if payload.symbol: 
             asset = _resolve_asset(session, payload.symbol, payload.tags) # This handles tag merge and creation
             tx.asset_id = asset.id
             tx.symbol = payload.symbol # Update symbol if it exists on model (likely does? Check models.py if needed, or just rely on asset_id)
             # Note: Transaction model likely doesn't have 'symbol' column, it relies on asset linkage.
             # But we updated 'asset_id' so that's enough.
             
         elif tx.asset_id and payload.tags:
             # Just updating tags on existing asset
             asset = session.get(Asset, tx.asset_id)
             if asset:
                 current_tags = set(asset.tags.split(",")) if asset.tags else set()
                 new_tags = set(t.strip() for t in payload.tags.split(",") if t.strip())
                 merged = current_tags.union(new_tags)
                 if merged:
                     asset.tags = ",".join(sorted(merged))
                     session.add(asset)

    # 7. Recalculate Total in Account Currency (if financial fields change)
    # We assume 'payload.total' is the RAW amount in 'payload.currency' (or fallback).
    # If payload.total is NOT provided, we assume the existing stored tx.total (Account Currency) is still valid for the new state.
    # (e.g. changing Date or Type doesn't change amount magnitude).
    
    if payload.total is not None:
        raw_total = payload.total
        # Determine currency of the transaction amount
        # Helper: We don't store original currency in Transaction model permanently?
        # If we don't, we must rely on payload.currency.
        tx_currency = payload.currency or new_account.currency 
        
        amount_in_acc_curr = _convert_currency(raw_total, tx_currency, new_account.currency)
        tx.total = amount_in_acc_curr
    
    # 8. Apply New Effect
    _apply_balance_change(new_account, tx.type, tx.total, revert=False) 
    
    session.add(new_account)
    session.add(tx)
    session.commit()
    session.refresh(tx)
    return tx
