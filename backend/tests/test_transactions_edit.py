
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool
from main import app
from models import Account, Transaction, TransactionType, Asset
from database import get_session


@pytest.fixture(name="session")
def session_fixture():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    def get_session_override():
        return session
    app.dependency_overrides[get_session] = get_session_override
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


def test_edit_transaction_amount(session: Session, client):
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
    })
    assert res.status_code == 200
    
    session.refresh(account)
    assert account.balance == 1800.0

def test_edit_transaction_type(session: Session, client):
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

def test_edit_transaction_date(session: Session, client):
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
