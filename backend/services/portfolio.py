"""
Portfolio Service: Calculates holdings, average cost, and P/L from transaction history.
"""
from sqlmodel import Session, select
from models import Transaction, TransactionType, Asset


def calculate_holdings(session: Session) -> list[dict]:
    """
    Calculate current holdings from all BUY/SELL transactions.
    Returns a list of holdings with symbol, quantity, avg_cost, total_invested.
    Uses weighted average cost method.
    """
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
                # Remove proportional cost (weighted average)
                cost_per_unit = h["total_cost"] / h["quantity"]
                h["total_cost"] -= cost_per_unit * qty_sold
            h["quantity"] -= qty_sold

    # Build result with asset info
    result = []
    for asset_id, h in holdings.items():
        if h["quantity"] <= 0:
            continue
        asset = session.get(Asset, asset_id)
        avg_cost = h["total_cost"] / h["quantity"] if h["quantity"] > 0 else 0
        result.append({
            "asset_id": asset_id,
            "symbol": asset.symbol if asset else "UNKNOWN",
            "name": asset.name if asset else "Unknown",
            "quantity": h["quantity"],
            "avg_cost": round(avg_cost, 2),
            "total_invested": round(h["total_cost"], 2),
        })

    return result


def calculate_summary(session: Session) -> dict:
    """Calculate portfolio summary: total invested, total holdings count."""
    holdings = calculate_holdings(session)
    total_invested = sum(h["total_invested"] for h in holdings)
    return {
        "total_invested": round(total_invested, 2),
        "holdings_count": len(holdings),
        "holdings": holdings,
    }
