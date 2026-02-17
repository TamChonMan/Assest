from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_get_market_price():
    """Test the market price endpoint returns valid data for a known symbol."""
    response = client.get("/market/price/AAPL")
    assert response.status_code == 200
    data = response.json()
    assert "symbol" in data
    assert "price" in data
    assert data["symbol"] == "AAPL"
    assert isinstance(data["price"], float)
    assert data["price"] > 0

def test_get_market_price_invalid():
    """Test the market price endpoint handles invalid symbols gracefully."""
    response = client.get("/market/price/INVALID_SYMBOL_XYZ")
    assert response.status_code == 200
    data = response.json()
    assert data["price"] == 0.0
