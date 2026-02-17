
import pytest
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, MagicMock

client = TestClient(app)

def test_validate_symbol_valid():
    with patch("yfinance.Ticker") as mock_ticker:
        # Mock yfinance behavior for valid symbol
        instance = mock_ticker.return_value
        instance.info = {"longName": "Apple Inc.", "currency": "USD"}
        instance.history.return_value = MagicMock(empty=False) # Or empty DataFrame check

        response = client.get("/market/validate/AAPL")
        assert response.status_code == 200
        data = response.json()
        assert data["valid"] is True
        assert data["symbol"] == "AAPL"
        assert "currency" in data

def test_validate_symbol_invalid():
    with patch("yfinance.Ticker") as mock_ticker:
        # Mock behavior for invalid symbol (e.g., info is empty or history raises error)
        instance = mock_ticker.return_value
        # yfinance often returns empty info or raises error for bad tickers
        instance.info = {} 
        instance.history.side_effect = Exception("No data found")
        
        # Alternatively, checking if .info is empty is a common check
        
        response = client.get("/market/validate/INVALID123")
        assert response.status_code == 200 # Should return 200 with valid=False
        data = response.json()
        assert data["valid"] is False
        assert data["symbol"] == "INVALID123"

def test_validate_symbol_cached():
    # Test that subsequent calls use cache (mocking internal cache if possible, or just verifying response speed/mock call count)
    pass
