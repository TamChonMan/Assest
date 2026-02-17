from datetime import datetime
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from main import app
from database import get_session
from models import Account, Asset, TransactionType

from sqlalchemy.pool import StaticPool

# Create in-memory DB for tests
engine = create_engine(
    "sqlite:///:memory:", 
    connect_args={"check_same_thread": False}, 
    poolclass=StaticPool
)

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session_override():
    with Session(engine) as session:
        yield session

app.dependency_overrides[get_session] = get_session_override
client = TestClient(app)

import pytest

# ... (previous imports)

@pytest.fixture(name="session", autouse=True)
def session_fixture():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

def test_add_tags_to_asset():
    """Test that creating a transaction with tags updates the Asset tags."""
    # 1. Create Account
    with Session(engine) as session:
        # Check if asset table has tags column (debug)
        from sqlalchemy import inspect
        insp = inspect(engine)
        print("DEBUG: Asset columns:", [c['name'] for c in insp.get_columns('asset')])

        acc = Account(name="Test Account", type="STOCK", currency="USD", balance=10000)
        session.add(acc)
        session.commit()
        acc_id = acc.id

    # 2. Buy Asset with Tags: "Tech, AI"
    payload = {
        "date": datetime.now().isoformat(),
        "type": "BUY",
        "account_id": acc_id,
        "symbol": "NVDA",
        "total": 5000,
        "quantity": 10,
        "price": 500,
        "tags": "Tech, AI"  # This field doesn't exist in payload yet
    }
    
    response = client.post("/transactions/", json=payload)
    assert response.status_code == 200
    
    # Verify Asset created and has tags
    with Session(engine) as session:
        asset = session.query(Asset).filter(Asset.symbol == "NVDA").first()
        assert asset is not None
        assert "Tech" in asset.tags
        assert "AI" in asset.tags

def test_append_tags_to_existing_asset():
    """Test appending new tags to existing tags."""
    # 1. Setup Data: Account and Asset with existing tags
    with Session(engine) as session:
        acc = Account(name="Test Account 2", type="STOCK", currency="USD", balance=10000)
        session.add(acc)
        session.flush()
        acc_id = acc.id
        
        # Create asset with initial tags
        asset = Asset(symbol="NVDA", type="STOCK", tags="Tech, AI")
        session.add(asset)
        session.commit()

    # 2. Buy same asset with NEW tag: "Growth"
    payload = {
        "date": datetime.now().isoformat(),
        "type": "BUY",
        "account_id": acc_id,
        "symbol": "NVDA",
        "total": 1000,
        "quantity": 2,
        "price": 500,
        "tags": "Growth"
    }

    response = client.post("/transactions/", json=payload)
    assert response.status_code == 200
    
    # Verify Asset tags merged: "Tech, AI, Growth"
    with Session(engine) as session:
        asset = session.exec(select(Asset).where(Asset.symbol == "NVDA")).first()
        tags_list = [t.strip() for t in asset.tags.split(",")]
        assert "Tech" in tags_list
        assert "AI" in tags_list
        assert "Growth" in tags_list
