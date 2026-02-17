
import pytest
from datetime import datetime, timedelta
from sqlmodel import Session, SQLModel, create_engine, select
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from main import app
from database import get_session
from models import Account, Asset, PortfolioSnapshot, Transaction

# In-memory DB
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)

@pytest.fixture(name="session", autouse=True)
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)

def test_record_snapshot_logic():
    """Test that a snapshot is recorded when requested if none exists for today."""
    with Session(engine) as session:
        # Setup: Account with balance
        acc = Account(name="TestAcc", type="BANK", currency="USD", balance=5000)
        session.add(acc)
        session.commit()
    
    # Call analytic endpoint (which should trigger snapshot)
    # We haven't implemented the trigger yet, so this will verify the endpoint returns history
    # For MVP, let's assume GET /analytics/history auto-generates snapshot if missing?
    # Or maybe GET /portfolio/summary does?
    # Plan said: "When GET /portfolio/summary is called..."
    
    response = client.get("/portfolio/summary")
    assert response.status_code == 200
    
    # Verify snapshot created
    with Session(engine) as session:
        snap = session.exec(select(PortfolioSnapshot)).first()
        assert snap is not None
        assert snap.total_equity == 5000
        assert snap.date.date() == datetime.utcnow().date()

def test_no_duplicate_snapshot():
    """Test that calling summary multiple times doesn't create duplicate snapshots for same day."""
    with Session(engine) as session:
        acc = Account(name="TestAcc", type="BANK", currency="USD", balance=5000)
        session.add(acc)
        session.commit()
        
    client.get("/portfolio/summary")
    client.get("/portfolio/summary")
    
    with Session(engine) as session:
        snaps = session.exec(select(PortfolioSnapshot)).all()
        assert len(snaps) == 1

def test_get_history_endpoint():
    """Test GET /analytics/history returns snapshots."""
    # Seed past snapshots
    with Session(engine) as session:
        s1 = PortfolioSnapshot(date=datetime.utcnow() - timedelta(days=2), total_equity=4000, currency="USD")
        s2 = PortfolioSnapshot(date=datetime.utcnow() - timedelta(days=1), total_equity=4500, currency="USD")
        session.add(s1)
        session.add(s2)
        session.commit()
        
    response = client.get("/portfolio/history")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert data[0]["total_equity"] == 4000
