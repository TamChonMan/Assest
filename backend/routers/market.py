from fastapi import APIRouter, HTTPException
from services.market_data import get_asset_price
from pydantic import BaseModel

class MarketPriceResponse(BaseModel):
    symbol: str
    price: float

router = APIRouter(
    prefix="/market",
    tags=["market"]
)

@router.get("/price/{symbol}", response_model=MarketPriceResponse)
def get_price(symbol: str):
    """
    Get the current market price for a given symbol (Stock, Crypto).
    """
    price = get_asset_price(symbol)
    return MarketPriceResponse(symbol=symbol, price=price)
