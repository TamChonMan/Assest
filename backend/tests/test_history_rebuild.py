
import pytest
from sqlmodel import Session, select
from datetime import date, datetime
from models import Account, Asset, Transaction, TransactionType, PortfolioSnapshot
from services.history_rebuilder import rebuild_portfolio_history
from unittest.mock import patch, MagicMock

# Mock yfinance data structure
# Date -> {Symbol -> Price}
MOCK_PRICES = {
    date(2020, 1, 1): {"AAPL": 100.0},
    date(2020, 1, 2): {"AAPL": 105.0},
    date(2020, 1, 3): {"AAPL": 110.0},
}

def mock_get_historical_prices(symbols, start_date, end_date):
    """
    Returns a DataFrame-like dictionary or structure.
    For simplicity, our service will likely iterate days or use a fetcher.
    Let's assume the service uses a helper we can mock that returns stats per day.
    """
    # This mock needs to align with how the service calls it.
    # Let's assume the service calls `market_data.get_price_history_batch(symbols, start, end)`
    pass

@pytest.fixture(name="session")
def session_fixture():
    from sqlmodel import create_engine, SQLModel
    from sqlmodel.pool import StaticPool
    engine = create_engine(
        "sqlite://", 
        connect_args={"check_same_thread": False}, 
        poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session

def test_rebuild_history_simple(session: Session):
    # 1. Setup Data
    account = Account(name="Test Acc", type="BANK", currency="USD", balance=0) # Balance will be calc'd
    session.add(account)
    session.commit()
    
    aapl = Asset(symbol="AAPL", name="Apple", currency="USD", type="STOCK")
    session.add(aapl)
    session.commit()
    
    # Tx 1: Deposit on 2020-01-01
    t1 = Transaction(
        date=datetime(2020, 1, 1),
        type=TransactionType.DEPOSIT,
        account_id=account.id,
        total=1000.0,
        notes="Init Funding"
    )
    session.add(t1)
    
    # Tx 2: Buy AAPL on 2020-01-02 (5 shares @ 100)
    # Note: On 2020-01-02 price is 105 in mock, but we bought at 100.
    t2 = Transaction(
        date=datetime(2020, 1, 2),
        type=TransactionType.BUY,
        account_id=account.id,
        asset_id=aapl.id,
        quantity=5,
        price=100.0,
        fee=0,
        total=500.0,
    )
    session.add(t2)
    session.commit()
    
    # 2. Mock Market Data
    # We'll patch the service function that fetches prices.
    # verify_rebuild_logic relies on `get_price_history_batch`
    
    with patch("services.history_rebuilder.get_price_history_batch") as mock_prices:
        # returns { date: { symbol: price } }
        mock_prices.return_value = {
            date(2020, 1, 1): {"AAPL": 100.0},
            date(2020, 1, 2): {"AAPL": 105.0}, # Market price rose
            date(2020, 1, 3): {"AAPL": 110.0},
        }
        
        # 3. Method Under Test
        # Rebuild from 2020-01-01 to 2020-01-03
        rebuild_portfolio_history(session, start_date=date(2020, 1, 1), end_date=date(2020, 1, 3))
        
        # 4. Verify Snapshots
        snapshots = session.exec(select(PortfolioSnapshot).order_by(PortfolioSnapshot.date)).all()
        print(f"DEBUG: Retrieved Snapshots: {snapshots}")
        for s in snapshots:
            print(f"DEBUG: Snapshot Date type: {type(s.date)}, Value: {s.date}")
            
        assert len(snapshots) >= 3
        
        # Day 1 (Jan 1): Cash 1000. Holdings 0. Equity 1000.
        s1 = next(s for s in snapshots if s.date.date() == date(2020, 1, 1))
        assert s1.total_equity == 1000.0
        
        # Day 2 (Jan 2): Cash 500 (1000-500). Holdings 5 * 105 = 525. Equity = 1025.
        s2 = next(s for s in snapshots if s.date.date() == date(2020, 1, 2))
        assert s2.total_equity == 1025.0
        
        # Day 3 (Jan 3): Cash 500. Holdings 5 * 110 = 550. Equity = 1050.
        s3 = next(s for s in snapshots if s.date.date() == date(2020, 1, 3))
        assert s3.total_equity == 1050.0
