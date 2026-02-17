"""
Portfolio Service: Calculates holdings, average cost, and P/L from transaction history.
"""
from datetime import datetime, date
from typing import Optional
from sqlmodel import Session, select
from models import Transaction, TransactionType, Asset, Account, PortfolioSnapshot, PriceHistory
from services.market_data import get_asset_price

# Shared Exchange Rates (Should be in config/shared module ideally)
# For MVP, duplicating or importing. Let's define here for service.
EXCHANGE_RATES = {
    "USD": 1.0,
    "HKD": 7.8,
    "MOP": 8.03,
    "CNY": 7.2,
}

def _convert_to_usd(amount: float, currency: str) -> float:
    return amount / EXCHANGE_RATES.get(currency, 1.0)


def calculate_holdings(session: Session) -> list[dict]:
    """
    Calculate current holdings from all BUY/SELL transactions.
    Returns a list of holdings with symbol, quantity, avg_cost, total_invested.
    Uses weighted average cost method.
    """
    # ... (Previous implementation remains similar, but explicit select)
    # Get all BUY/SELL transactions with assets
    statement = (
        select(Transaction)
        .where(Transaction.type.in_([TransactionType.BUY, TransactionType.SELL]))
        .where(Transaction.asset_id.is_not(None))
        .order_by(Transaction.date)
    )
    transactions = session.exec(statement).all()

    # Aggregate by asset_id
    holdings: dict[int, dict] = {}

    for tx in transactions:
        aid = tx.asset_id
        if aid not in holdings:
            holdings[aid] = {"quantity": 0, "total_cost": 0.0}

        h = holdings[aid]
        if tx.type == TransactionType.BUY:
            h["total_cost"] += tx.total  # price * quantity
            h["quantity"] += tx.quantity or 0
        elif tx.type == TransactionType.SELL:
            qty_sold = tx.quantity or 0
            if h["quantity"] > 0:
                 # Reduce cost basis proportionally
                cost_per_unit = h["total_cost"] / h["quantity"]
                h["total_cost"] -= cost_per_unit * qty_sold
            h["quantity"] -= qty_sold

    # Build result with asset info & current price
    result = []
    for asset_id, h in holdings.items():
        if h["quantity"] <= 0.0001: # Filter near-zero
            continue
        asset = session.get(Asset, asset_id)
        if not asset: continue

        avg_cost = h["total_cost"] / h["quantity"]
        asset_currency = getattr(asset, 'currency', 'USD') or 'USD'
        
        # Get latest price from DB (PriceHistory), then live, then avg_cost fallback
        latest_price_row = session.exec(
            select(PriceHistory).where(PriceHistory.asset_id == asset_id).order_by(PriceHistory.date.desc())
        ).first()
        if latest_price_row:
            current_price = latest_price_row.price
        else:
            # Fetch live price from Yahoo Finance
            live_price = get_asset_price(asset.symbol)
            current_price = live_price if live_price > 0 else avg_cost

        market_value = h["quantity"] * current_price  # In asset's native currency
        market_value_usd = _convert_to_usd(market_value, asset_currency)
        
        result.append({
            "asset_id": asset_id,
            "symbol": asset.symbol,
            "name": asset.name,
            "currency": asset_currency,
            "quantity": h["quantity"],
            "avg_cost": round(avg_cost, 2),
            "total_invested": round(h["total_cost"], 2),
            "current_price": round(current_price, 2),
            "market_value": round(market_value, 2),
            "market_value_usd": round(market_value_usd, 2),
            "tags": asset.tags,  
        })

    return result


def calculate_summary(session: Session) -> dict:
    """Calculate portfolio summary: total invested, holdings count, AND total equity.
    All monetary values are normalized to USD."""
    # 1. Holdings Equity (converted to USD)
    holdings = calculate_holdings(session)
    total_invested = sum(
        _convert_to_usd(h["total_invested"], h.get("currency", "USD"))
        for h in holdings
    )
    total_market_value_usd = sum(h["market_value_usd"] for h in holdings)

    # 2. Cash Equity (Sum of all accounts converted to USD)
    accounts = session.exec(select(Account)).all()
    total_cash_usd = sum(_convert_to_usd(a.balance, a.currency) for a in accounts)

    total_equity = total_market_value_usd + total_cash_usd

    return {
        "total_invested": round(total_invested, 2),
        "total_market_value": round(total_market_value_usd, 2),
        "total_cash": round(total_cash_usd, 2),
        "total_equity": round(total_equity, 2),
        "holdings_count": len(holdings),
        "holdings": holdings,
    }

def record_daily_snapshot(session: Session) -> Optional[PortfolioSnapshot]:
    """Check if snapshot exists for today. If not, calculate and save."""
    today = datetime.utcnow().date()
    # Check existing
    existing = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date >= today) # Simple check for today
    ).first()
    
    # Actually, comparison strictly on date part
    # SQLite datetime is string mostly.
    # Let's use range for today
    start_of_day = datetime(today.year, today.month, today.day)
    
    existing = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date >= start_of_day)
    ).first()

    if existing:
        return None  # Already recorded

    # Calculate equity
    summary = calculate_summary(session)
    equity = summary["total_equity"]

    snapshot = PortfolioSnapshot(
        date=datetime.utcnow(),
        total_equity=equity,
        currency="USD"
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot
