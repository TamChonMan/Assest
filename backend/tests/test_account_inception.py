"""
TDD Tests for Account Inception Date Feature.
Cycle 1: inception_date field on Account model
Cycle 2: Auto-create DEPOSIT tx on account creation
Cycle 3: Snapshot rebuild from inception date
"""
import pytest
from datetime import datetime, date
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from models import Account, AccountType, Transaction, TransactionType, PortfolioSnapshot


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


# ─── Cycle 1: inception_date on Account model ─────────────────────

class TestAccountInceptionDate:
    def test_create_account_returns_inception_date(self, client):
        """Creating an account should return an inception_date field."""
        response = client.post("/accounts/", json={
            "name": "Test Account",
            "type": "BANK",
            "currency": "HKD",
            "balance": 50000.0,
        })
        assert response.status_code == 200
        data = response.json()
        assert "inception_date" in data
        assert data["inception_date"] is not None

    def test_create_account_with_custom_inception_date(self, client):
        """Creating an account with a custom inception_date should store it."""
        response = client.post("/accounts/", json={
            "name": "Old Account",
            "type": "STOCK",
            "currency": "USD",
            "balance": 10000.0,
            "inception_date": "2025-06-15T00:00:00",
        })
        assert response.status_code == 200
        data = response.json()
        assert "inception_date" in data
        # Should be the date we specified
        assert "2025-06-15" in data["inception_date"]

    def test_create_account_default_inception_date_is_today(self, client):
        """If no inception_date is provided, it should default to today."""
        response = client.post("/accounts/", json={
            "name": "New Account",
            "type": "CRYPTO",
            "currency": "USD",
            "balance": 0,
        })
        assert response.status_code == 200
        data = response.json()
        today_str = datetime.utcnow().strftime("%Y-%m-%d")
        assert today_str in data["inception_date"]


# ─── Cycle 2: Auto-create DEPOSIT transaction ────────────────────

class TestAutoDepositOnAccountCreation:
    def test_account_with_balance_creates_deposit_tx(self, client, session):
        """Creating account with balance > 0 should auto-create a DEPOSIT transaction."""
        response = client.post("/accounts/", json={
            "name": "Funded Account",
            "type": "BANK",
            "currency": "HKD",
            "balance": 100000.0,
            "inception_date": "2025-12-01T00:00:00",
        })
        assert response.status_code == 200
        account_id = response.json()["id"]

        # Check that a DEPOSIT transaction was created
        txs = session.exec(
            select(Transaction).where(Transaction.account_id == account_id)
        ).all()
        assert len(txs) == 1
        tx = txs[0]
        assert tx.type == TransactionType.DEPOSIT
        assert tx.total == 100000.0
        assert "2025-12-01" in tx.date.strftime("%Y-%m-%d")

    def test_account_with_zero_balance_no_deposit_tx(self, client, session):
        """Creating account with balance == 0 should NOT create a DEPOSIT transaction."""
        response = client.post("/accounts/", json={
            "name": "Empty Account",
            "type": "STOCK",
            "currency": "USD",
            "balance": 0,
        })
        assert response.status_code == 200
        account_id = response.json()["id"]

        txs = session.exec(
            select(Transaction).where(Transaction.account_id == account_id)
        ).all()
        assert len(txs) == 0


# ─── Cycle 3: Snapshot rebuild from inception date ────────────────

class TestSnapshotRebuildOnAccountCreation:
    def test_creating_account_rebuilds_snapshots_from_inception(self, client, session):
        """After creating an account with inception_date in the past,
        snapshots from that date should be recalculated."""
        # First, create some existing snapshots
        old_snapshot = PortfolioSnapshot(
            date=datetime(2025, 12, 1),
            total_equity=0.0,
            total_cash=0.0,
            total_invested=0.0,
            currency="USD",
        )
        session.add(old_snapshot)
        session.commit()

        # Create account with inception_date = Dec 1, 2025
        response = client.post("/accounts/", json={
            "name": "HK Savings",
            "type": "BANK",
            "currency": "HKD",
            "balance": 100000.0,
            "inception_date": "2025-12-01T00:00:00",
        })
        assert response.status_code == 200

        # Old snapshot for Dec 1 should be recalculated (deleted and re-created)
        # with the new account's balance included
        snapshots = session.exec(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.date >= datetime(2025, 12, 1))
            .order_by(PortfolioSnapshot.date)
        ).all()

        assert len(snapshots) > 0
        # The Dec 1 snapshot should now include HKD 100,000 converted to USD
        dec1 = snapshots[0]
        expected_usd = 100000.0 / 7.8  # ~12820.51
        assert dec1.total_equity > 0
        assert abs(dec1.total_equity - expected_usd) < 1.0  # Within $1 tolerance
