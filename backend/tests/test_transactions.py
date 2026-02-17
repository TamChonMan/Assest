"""
TDD RED Phase: Tests for Transaction CRUD & Balance Updates.
These tests should ALL FAIL initially because routers/transactions.py does not exist yet.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from models import Account, AccountType, Transaction, TransactionType, Asset


# ─── Test DB Fixture ───────────────────────────────────────────────
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


@pytest.fixture(name="bank_account")
def bank_account_fixture(session: Session):
    """Create a bank account with $10,000 balance for testing."""
    account = Account(name="My Bank", type=AccountType.BANK, currency="USD", balance=10000.0)
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@pytest.fixture(name="stock_asset")
def stock_asset_fixture(session: Session):
    """Create AAPL asset for testing."""
    asset = Asset(symbol="AAPL", name="Apple Inc.", type="STOCK")
    session.add(asset)
    session.commit()
    session.refresh(asset)
    return asset


# ─── Test: Deposit ─────────────────────────────────────────────────
class TestDeposit:
    def test_deposit_increases_balance(self, client, bank_account):
        """POST /transactions/ with DEPOSIT should increase account balance."""
        response = client.post("/transactions/", json={
            "type": "DEPOSIT",
            "account_id": bank_account.id,
            "total": 5000.0,
            "date": "2026-02-17T00:00:00",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "DEPOSIT"
        assert data["total"] == 5000.0

    def test_deposit_updates_account_balance(self, client, bank_account, session):
        """After deposit, account balance should reflect the change."""
        client.post("/transactions/", json={
            "type": "DEPOSIT",
            "account_id": bank_account.id,
            "total": 3000.0,
            "date": "2026-02-17T00:00:00",
        })
        session.expire_all()
        account = session.get(Account, bank_account.id)
        assert account.balance == 13000.0  # 10000 + 3000


# ─── Test: Withdraw ────────────────────────────────────────────────
class TestWithdraw:
    def test_withdraw_decreases_balance(self, client, bank_account, session):
        """POST /transactions/ with WITHDRAW should decrease account balance."""
        client.post("/transactions/", json={
            "type": "WITHDRAW",
            "account_id": bank_account.id,
            "total": 2000.0,
            "date": "2026-02-17T00:00:00",
        })
        session.expire_all()
        account = session.get(Account, bank_account.id)
        assert account.balance == 8000.0  # 10000 - 2000

    def test_withdraw_insufficient_funds(self, client, bank_account):
        """Withdraw more than balance should return 400."""
        response = client.post("/transactions/", json={
            "type": "WITHDRAW",
            "account_id": bank_account.id,
            "total": 99999.0,
            "date": "2026-02-17T00:00:00",
        })
        assert response.status_code == 400


# ─── Test: Buy Stock ───────────────────────────────────────────────
class TestBuyStock:
    def test_buy_creates_transaction(self, client, bank_account, stock_asset):
        """POST /transactions/ with BUY should create transaction with asset."""
        response = client.post("/transactions/", json={
            "type": "BUY",
            "account_id": bank_account.id,
            "asset_id": stock_asset.id,
            "quantity": 10,
            "price": 150.0,
            "total": 1500.0,
            "date": "2026-02-17T00:00:00",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["type"] == "BUY"
        assert data["quantity"] == 10
        assert data["price"] == 150.0

    def test_buy_decreases_account_balance(self, client, bank_account, stock_asset, session):
        """Buying stock should decrease account cash balance."""
        client.post("/transactions/", json={
            "type": "BUY",
            "account_id": bank_account.id,
            "asset_id": stock_asset.id,
            "quantity": 10,
            "price": 150.0,
            "total": 1500.0,
            "date": "2026-02-17T00:00:00",
        })
        session.expire_all()
        account = session.get(Account, bank_account.id)
        assert account.balance == 8500.0  # 10000 - 1500


# ─── Test: Sell Stock ──────────────────────────────────────────────
class TestSellStock:
    def test_sell_increases_account_balance(self, client, bank_account, stock_asset, session):
        """Selling stock should increase account cash balance."""
        # First buy
        client.post("/transactions/", json={
            "type": "BUY",
            "account_id": bank_account.id,
            "asset_id": stock_asset.id,
            "quantity": 10,
            "price": 150.0,
            "total": 1500.0,
            "date": "2026-02-17T00:00:00",
        })
        # Then sell 5 shares at $200
        response = client.post("/transactions/", json={
            "type": "SELL",
            "account_id": bank_account.id,
            "asset_id": stock_asset.id,
            "quantity": 5,
            "price": 200.0,
            "total": 1000.0,
            "date": "2026-02-17T00:00:00",
        })
        assert response.status_code == 200
        session.expire_all()
        account = session.get(Account, bank_account.id)
        assert account.balance == 9500.0  # 10000 - 1500 + 1000


# ─── Test: List Transactions ──────────────────────────────────────
class TestListTransactions:
    def test_list_all(self, client, bank_account):
        """GET /transactions/ should return all transactions."""
        client.post("/transactions/", json={
            "type": "DEPOSIT",
            "account_id": bank_account.id,
            "total": 1000.0,
            "date": "2026-02-17T00:00:00",
        })
        response = client.get("/transactions/")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_filter_by_account(self, client, bank_account):
        """GET /transactions/?account_id=1 should filter by account."""
        client.post("/transactions/", json={
            "type": "DEPOSIT",
            "account_id": bank_account.id,
            "total": 500.0,
            "date": "2026-02-17T00:00:00",
        })
        response = client.get(f"/transactions/?account_id={bank_account.id}")
        assert response.status_code == 200
        data = response.json()
        assert all(t["account_id"] == bank_account.id for t in data)
