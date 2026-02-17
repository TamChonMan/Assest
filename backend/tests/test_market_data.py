import pytest
from services.market_data import get_asset_price

def test_get_us_stock_price():
    """Test fetching a valid US stock price (Apple)."""
    price = get_asset_price("AAPL")
    assert isinstance(price, float)
    assert price > 0

def test_get_hk_stock_price():
    """Test fetching a valid HK stock price (Tencent)."""
    # Yahoo Finance uses .HK suffix
    price = get_asset_price("0700.HK")
    assert isinstance(price, float)
    assert price > 0

def test_get_crypto_price():
    """Test fetching a valid Crypto price (Bitcoin)."""
    # Yahoo Finance uses -USD suffix for crypto
    price = get_asset_price("BTC-USD")
    assert isinstance(price, float)
    assert price > 0

def test_invalid_symbol():
    """Test fetching an invalid symbol returns 0 or raises handled error."""
    price = get_asset_price("INVALID_SYMBOL_12345")
    assert price == 0.0
