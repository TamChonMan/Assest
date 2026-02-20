from fastapi import FastAPI, Depends, HTTPException
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import create_db_and_tables, get_session, engine
from models import Account, Asset, Transaction, TransactionType, AccountType
from routers import transactions, portfolio, market, analytics, tags, assets

from apscheduler.schedulers.asyncio import AsyncIOScheduler

# ─── Request Schema ────────────────────────────────────────────────
class AccountCreate(BaseModel):
    name: str
    type: AccountType
    currency: str = "HKD"
    balance: float = 0.0
    inception_date: Optional[datetime] = None  # Defaults to now if not provided


# ─── Scheduler ─────────────────────────────────────────────────────
scheduler = AsyncIOScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    
    # Schedule daily snapshot
    from services.portfolio import record_daily_snapshot
    
    def job_daily_snapshot():
        with Session(engine) as session:
            record_daily_snapshot(session)

    # Run every day at 00:05 UTC (or server time)
    scheduler.add_job(job_daily_snapshot, 'cron', hour=0, minute=5)
    scheduler.start()
    
    yield
    scheduler.shutdown()

app = FastAPI(lifespan=lifespan)

from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"Hello": "Asset Manager Backend"}

app.include_router(market.router)
app.include_router(transactions.router)
app.include_router(portfolio.router)
app.include_router(analytics.router)
app.include_router(tags.router)
app.include_router(assets.router)

@app.post("/accounts/", response_model=Account)
def create_account(payload: AccountCreate, session: Session = Depends(get_session)):
    from services.portfolio import rebuild_snapshots_from

    # Default inception_date to now
    inception = payload.inception_date or datetime.utcnow()

    account = Account(
        name=payload.name,
        type=payload.type,
        currency=payload.currency,
        balance=payload.balance,
        inception_date=inception,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    account_id = account.id

    # Auto-create DEPOSIT transaction if balance > 0
    if payload.balance > 0:
        deposit_tx = Transaction(
            date=inception,
            type=TransactionType.DEPOSIT,
            account_id=account_id,
            total=payload.balance,
        )
        session.add(deposit_tx)
        session.commit()

    # Rebuild snapshots from inception_date
    rebuild_snapshots_from(session, inception.date() if isinstance(inception, datetime) else inception)

    # Re-fetch account (session may have been detached by rebuild commits)
    account = session.get(Account, account_id)
    return account

@app.delete("/accounts/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session)):
    from services.portfolio import rebuild_snapshots_from
    
    account = session.get(Account, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
        
    # Get inception/first tx date for rebuild later
    # If no transactions, inception_date is good start.
    # But if account had transactions from long ago, we need to rebuild from then.
    # Actually, if we delete the account, its effect is removed.
    # We should rebuild from the earliest date that this account affected the portfolio.
    # That is min(inception_date, first_transaction_date).
    # Since inception_date defaults to created_at or user-defined, let's use that.
    rebuild_date = account.inception_date.date() if account.inception_date else datetime.utcnow().date()
    
    # Check if there were earlier transactions (e.g. backdated)
    first_tx = session.exec(select(Transaction).where(Transaction.account_id == account_id).order_by(Transaction.date)).first()
    if first_tx and first_tx.date.date() < rebuild_date:
        rebuild_date = first_tx.date.date()

    # Manual cascade delete transactions (safest)
    transactions = session.exec(select(Transaction).where(Transaction.account_id == account_id)).all()
    for tx in transactions:
        session.delete(tx)
        
    session.delete(account)
    session.commit()
    
    # Rebuild history now that account is gone
    rebuild_snapshots_from(session, rebuild_date)
    
    return {"ok": True}

@app.get("/accounts/", response_model=List[Account])
def read_accounts(session: Session = Depends(get_session)):
    accounts = session.exec(select(Account)).all()
    return accounts
