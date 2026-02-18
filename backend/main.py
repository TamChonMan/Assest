from fastapi import FastAPI, Depends, HTTPException
from contextlib import asynccontextmanager
from sqlmodel import Session, select
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

from database import create_db_and_tables, get_session, engine
from models import Account, Asset, Transaction, TransactionType, AccountType
from routers import market, transactions, portfolio, analytics

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

@app.get("/accounts/", response_model=List[Account])
def read_accounts(session: Session = Depends(get_session)):
    accounts = session.exec(select(Account)).all()
    return accounts
