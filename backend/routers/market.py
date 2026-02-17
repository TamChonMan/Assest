from fastapi import APIRouter, HTTPException
from services.market_data import get_asset_price
from pydantic import BaseModel

class MarketPriceResponse(BaseModel):
    symbol: str
    price: float
    currency: str = "USD"

router = APIRouter(
    prefix="/market",
    tags=["market"]
)

# Symbol suffix → currency mapping
SYMBOL_CURRENCY_MAP = {
    ".HK": "HKD", ".TW": "TWD", ".T": "JPY",
    ".L": "GBP", ".PA": "EUR", ".DE": "EUR",
    ".SS": "CNY", ".SZ": "CNY",
}

def _detect_price_currency(symbol: str) -> str:
    for suffix, curr in SYMBOL_CURRENCY_MAP.items():
        if symbol.upper().endswith(suffix.upper()):
            return curr
    return "USD"

@router.get("/price/{symbol}", response_model=MarketPriceResponse)
def get_price(symbol: str):
    """
    Get the current market price for a given symbol (Stock, Crypto).
    """
    price = get_asset_price(symbol)
    currency = _detect_price_currency(symbol)
    return MarketPriceResponse(symbol=symbol, price=price, currency=currency)


class ValidationResponse(BaseModel):
    valid: bool
    symbol: str
    name: str = ""
    currency: str = "USD"

@router.get("/validate/{symbol}", response_model=ValidationResponse)
def validate_symbol(symbol: str):
    """
    Validate if a symbol exists and return basic metadata.
    """
    from services.market_data import validate_symbol_exists
    return validate_symbol_exists(symbol)
