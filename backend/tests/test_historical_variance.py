
import pytest
from datetime import datetime, timedelta, date
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool
from unittest.mock import patch, MagicMock

from database import get_session
from main import app
from models import Account, Asset, Transaction, TransactionType, PortfolioSnapshot
from services.portfolio import backfill_history

@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_backfill_fetches_historical_prices(session: Session):
    """
    Test that backfill_history fetches daily historical prices and uses them
    to calculate snapshots, rather than just using the purchase price.
    """
    # 1. Setup: Create Account and Asset
    account = Account(name="Test Acc", type="STOCK", currency="USD", balance=10000.0)
    session.add(account)
    asset = Asset(symbol="AAPL", name="Apple Inc.", type="STOCK", currency="USD")
    session.add(asset)
    session.commit()
    session.refresh(account)
    session.refresh(asset)

    # 2. Key Dates
    today = datetime.utcnow().date()
    # Buy 5 days ago
    buy_date = today - timedelta(days=5)
    buy_datetime = datetime(buy_date.year, buy_date.month, buy_date.day)

    # 3. Create Transaction: Deposit 10000
    deposit_tx = Transaction(
        date=buy_datetime,
        type=TransactionType.DEPOSIT,
        account_id=account.id,
        total=10000.0,
        currency="USD"
    )
    session.add(deposit_tx)

    # 4. Create Transaction: Buy 10 AAPL @ $150
    tx = Transaction(
        date=buy_datetime,
        type=TransactionType.BUY,
        account_id=account.id,
        asset_id=asset.id,
        quantity=10.0,
        price=150.0,
        total=1500.0,
        currency="USD"
    )
    session.add(tx)
    session.commit()

    # 5. Mock Price History
    # Day 0 (Buy): $150
    # Day 1: $160
    # Day 2: $140
    # Day 3: $155
    # Day 4: $150 (Today)
    
    mock_prices = {
        buy_date: {"AAPL": 150.0},
        buy_date + timedelta(days=1): {"AAPL": 160.0},
        buy_date + timedelta(days=2): {"AAPL": 140.0},
        buy_date + timedelta(days=3): {"AAPL": 155.0},
        buy_date + timedelta(days=4): {"AAPL": 150.0},
        today: {"AAPL": 150.0}
    }

    # Patch get_price_history_batch to return our mock data
    with patch("services.portfolio.get_price_history_batch") as mock_get_history:
        mock_get_history.return_value = mock_prices
        
        # Also patch get_asset_price to avoid external calls for "today" fallback
        with patch("services.portfolio.get_asset_price", return_value=150.0):
            # 5. Run Backfill
            backfill_history(session)

    # 6. Verify Snapshots
    # We expect snapshots for Day 0 to Day 4 (depending on when backfill stops, usually implies today)
    
    # Check Day 1 Snapshot (Price 160 -> Value 1600 + Cash (10000-1500=8500) = 10100)
    day1_date = buy_datetime + timedelta(days=1)
    snap_day1 = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date == day1_date)
    ).first()
    
    # If logic is implemented, equity should be 10100. 
    # If NOT implemented, it will likely use avg_cost ($150) -> Equity 10000.
    assert snap_day1 is not None
    assert snap_day1.total_equity == 10100.0

    # Check Day 2 Snapshot (Price 140 -> Value 1400 + Cash 8500 = 9900)
    day2_date = buy_datetime + timedelta(days=2)
    snap_day2 = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date == day2_date)
    ).first()
    
    assert snap_day2 is not None
    assert snap_day2.total_equity == 9900.0
