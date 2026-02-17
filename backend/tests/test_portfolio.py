"""
TDD RED Phase: Tests for Portfolio Engine.
Calculates Holdings (qty per asset), Average Cost, and Unrealized P/L.
"""
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from main import app
from database import get_session
from models import Account, AccountType, Asset


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


@pytest.fixture(name="setup_portfolio")
def setup_portfolio_fixture(client, session):
    """Create account, asset, and some transactions to form a portfolio."""
    # Create account
    account = Account(name="Trading", type=AccountType.STOCK, currency="USD", balance=100000.0)
    session.add(account)
    # Create asset
    asset = Asset(symbol="AAPL", name="Apple Inc.", type="STOCK")
    session.add(asset)
    session.commit()
    session.refresh(account)
    session.refresh(asset)

    # Buy 10 AAPL @ $150
    client.post("/transactions/", json={
        "type": "BUY", "account_id": account.id, "asset_id": asset.id,
        "quantity": 10, "price": 150.0, "total": 1500.0,
        "date": "2026-01-10T00:00:00",
    })
    # Buy 5 more AAPL @ $200
    client.post("/transactions/", json={
        "type": "BUY", "account_id": account.id, "asset_id": asset.id,
        "quantity": 5, "price": 200.0, "total": 1000.0,
        "date": "2026-01-20T00:00:00",
    })
    # Sell 3 AAPL @ $180
    client.post("/transactions/", json={
        "type": "SELL", "account_id": account.id, "asset_id": asset.id,
        "quantity": 3, "price": 180.0, "total": 540.0,
        "date": "2026-02-01T00:00:00",
    })

    return {"account_id": account.id, "asset_id": asset.id}


class TestPortfolioHoldings:
    def test_holdings_endpoint_exists(self, client, setup_portfolio):
        """GET /portfolio/holdings should return 200."""
        response = client.get("/portfolio/holdings")
        assert response.status_code == 200

    def test_holdings_returns_correct_quantity(self, client, setup_portfolio):
        """After Buy 10, Buy 5, Sell 3 → should hold 12 shares."""
        response = client.get("/portfolio/holdings")
        data = response.json()
        aapl = next((h for h in data if h["symbol"] == "AAPL"), None)
        assert aapl is not None
        assert aapl["quantity"] == 12  # 10 + 5 - 3

    def test_holdings_returns_avg_cost(self, client, setup_portfolio):
        """Average cost = (10*150 + 5*200) / 15 = $166.67 (before sell)."""
        # After selling 3, avg cost stays the same (FIFO not applied here, using weighted avg)
        # Weighted avg before sell: (1500 + 1000) / 15 = 166.67
        response = client.get("/portfolio/holdings")
        data = response.json()
        aapl = next((h for h in data if h["symbol"] == "AAPL"), None)
        assert aapl is not None
        assert round(aapl["avg_cost"], 2) == 166.67


class TestPortfolioSummary:
    def test_summary_endpoint_exists(self, client, setup_portfolio):
        """GET /portfolio/summary should return 200."""
        response = client.get("/portfolio/summary")
        assert response.status_code == 200

    def test_summary_has_total_invested(self, client, setup_portfolio):
        """Summary should include total_invested."""
        response = client.get("/portfolio/summary")
        data = response.json()
        assert "total_invested" in data
        # Total bought: 1500 + 1000 = 2500, sold: 540
        # Net invested (cost basis of remaining): 12 * 166.67 ≈ 2000
        assert data["total_invested"] > 0
