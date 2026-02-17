
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from main import app
from models import Account, Transaction, TransactionType, Asset
from database import get_session

client = TestClient(app)

@pytest.fixture(name="session")
def session_fixture():
    from database import engine
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session
    SQLModel.metadata.drop_all(engine)

def test_edit_transaction_amount(session: Session):
    # 1. Setup Account
    account = Account(name="Test Acc", type="BANK", currency="USD", balance=1000.0)
    session.add(account)
    session.commit()
    session.refresh(account)

    # 2. Create Transaction (Deposit 500) -> Balance 1500
    res = client.post("/transactions/", json={
        "date": "2023-01-01T00:00:00",
        "type": "DEPOSIT",
        "account_id": account.id,
        "total": 500.0,
        "currency": "USD"
    })
    tx_id = res.json()["id"]
    
    session.refresh(account)
    assert account.balance == 1500.0

    # 3. Edit Transaction (Change to 800) -> Balance should be 1000 + 800 = 1800
    res = client.put(f"/transactions/{tx_id}", json={
        "total": 800.0,
        # other fields optional if we support partial, but for now let's send full or partial
        # Use partial update model
    })
    assert res.status_code == 200
    
    session.refresh(account)
    assert account.balance == 1800.0

def test_edit_transaction_type(session: Session):
    # Deposit 500 -> Balance 500 (Initial 0)
    account = Account(name="Test Acc", type="BANK", currency="USD", balance=0.0)
    session.add(account)
    session.commit()
    
    res = client.post("/transactions/", json={
        "date": "2023-01-01T00:00:00",
        "type": "DEPOSIT",
        "account_id": account.id,
        "total": 500.0,
        "currency": "USD"
    })
    tx_id = res.json()["id"]
    session.refresh(account)
    assert account.balance == 500.0
    
    # Edit to WITHDRAW 200 -> Balance should be 0 (revert 500) - 200 = -200
    res = client.put(f"/transactions/{tx_id}", json={
        "type": "WITHDRAW",
        "total": 200.0
    })
    assert res.status_code == 200
    
    session.refresh(account)
    assert account.balance == -200.0

def test_edit_transaction_date(session: Session):
    # Simply check if date is updated
    account = Account(name="Test Acc", type="BANK", currency="USD", balance=0.0)
    session.add(account)
    session.commit()
    
    res = client.post("/transactions/", json={
        "date": "2023-01-01T00:00:00",
        "type": "DEPOSIT",
        "account_id": account.id,
        "total": 100.0,
        "currency": "USD"
    })
    tx_id = res.json()["id"]
    
    res = client.put(f"/transactions/{tx_id}", json={
        "date": "2022-01-01T00:00:00"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["date"].startswith("2022-01-01")

