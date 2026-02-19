"""
Portfolio Service: Calculates holdings, average cost, and P/L from transaction history.
"""
from datetime import datetime, date, timedelta
from typing import Optional, List, Dict
from sqlmodel import Session, select
from database import engine
from models import Transaction, TransactionType, Asset, Account, PortfolioSnapshot, PriceHistory
from services.market_data import get_asset_price, get_price_history_batch

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


def calculate_holdings(session: Session, at_date: Optional[date] = None) -> list[dict]:
    """
    Calculate current holdings from all BUY/SELL transactions.
    Returns a list of holdings with symbol, quantity, avg_cost, total_invested.
    Holdings are grouped by (account_id, asset_id).
    Uses weighted average cost method.
    If at_date is provided, only considers transactions on or before that date.
    """
    # Get all BUY/SELL transactions with assets
    statement = (
        select(Transaction)
        .where(Transaction.type.in_([TransactionType.BUY, TransactionType.SELL]))
        .where(Transaction.asset_id.is_not(None))
    )
    
    if at_date:
        # Filter by date (end of day)
        end_of_day = datetime(at_date.year, at_date.month, at_date.day, 23, 59, 59)
        statement = statement.where(Transaction.date <= end_of_day)

    statement = statement.order_by(Transaction.date)
    transactions = session.exec(statement).all()

    # Aggregate by (account_id, asset_id)
    holdings: dict[tuple[int, int], dict] = {}

    for tx in transactions:
        key = (tx.account_id, tx.asset_id)
        if key not in holdings:
            holdings[key] = {"quantity": 0, "total_cost": 0.0}

        h = holdings[key]
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
    
    for (account_id, asset_id), h in holdings.items():
        if h["quantity"] <= 0.0001: # Filter near-zero
            continue
        asset = session.get(Asset, asset_id)
        if not asset: continue
        account = session.get(Account, account_id)
        account_name = account.name if account else "Unknown"

        avg_cost = h["total_cost"] / h["quantity"]
        asset_currency = getattr(asset, 'currency', 'USD') or 'USD'
        
        # Get price appropriate for the date
        if at_date:
            # Find last price on or before at_date
            price_stmt = (
                select(PriceHistory)
                .where(PriceHistory.asset_id == asset_id)
                .where(PriceHistory.date <= datetime(at_date.year, at_date.month, at_date.day, 23, 59, 59))
                .order_by(PriceHistory.date.desc())
            )
            hist_price = session.exec(price_stmt).first()
            current_price = hist_price.price if hist_price else avg_cost # Fallback to cost if no history
        else:
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
            "account_id": account_id,
            "account_name": account_name,
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

def calculate_cash_balances_at_date(session: Session, at_date: date) -> float:
    """
    Reconstruct total cash balance (in USD) for all accounts at a specific past date.
    Logic: Start with 0, replay all cash-affecting transactions up to at_date.
    Types: DEPOSIT(+), WITHDRAW(-), BUY(-), SELL(+)
    Note: Transaction.total is stored in Account Currency.
    """
    end_of_day = datetime(at_date.year, at_date.month, at_date.day, 23, 59, 59)
    
    # Fetch all transactions up to date
    statement = (
        select(Transaction)
        .where(Transaction.date <= end_of_day)
        .order_by(Transaction.date)
    )
    transactions = session.exec(statement).all()
    
    # Map account_id -> current balance (reconstructed)
    account_balances = {} 

    for tx in transactions:
        aid = tx.account_id
        if aid not in account_balances:
            account_balances[aid] = 0.0
            
        amount = tx.total # In account currency
        
        if tx.type == TransactionType.DEPOSIT:
            account_balances[aid] += amount
        elif tx.type == TransactionType.WITHDRAW:
            account_balances[aid] -= amount
        elif tx.type == TransactionType.BUY:
            account_balances[aid] -= amount
        elif tx.type == TransactionType.SELL:
            account_balances[aid] += amount
    
    # Convert all to USD
    total_cash_usd = 0.0
    for aid, bal in account_balances.items():
        account = session.get(Account, aid)
        if account:
            total_cash_usd += _convert_to_usd(bal, account.currency)
            
    return total_cash_usd


def calculate_portfolio_value_at_date(session: Session, at_date: date) -> dict:
    """Calculate Total Equity at a specific date."""
    # 1. Holdings Value
    holdings = calculate_holdings(session, at_date=at_date)
    total_market_value_usd = sum(h["market_value_usd"] for h in holdings)
    total_invested_usd = sum(
        _convert_to_usd(h["total_invested"], h.get("currency", "USD"))
        for h in holdings
    )

    # 2. Cash Value (Reconstructed)
    total_cash_usd = calculate_cash_balances_at_date(session, at_date)

    return {
        "date": at_date,
        "total_equity": total_market_value_usd + total_cash_usd,
        "total_cash": total_cash_usd,
        "total_invested": total_invested_usd
    }


def _update_price_history(session: Session, price_data: Dict[date, Dict[str, float]], assets: List[Asset]):
    """Helper to update PriceHistory table with batch data."""
    asset_map = {a.symbol: a.id for a in assets}
    
    for day, prices in price_data.items():
        day_datetime = datetime(day.year, day.month, day.day)
        
        for symbol, price in prices.items():
            if symbol not in asset_map:
                continue
                
            asset_id = asset_map[symbol]
            
            # Check if exists
            existing = session.exec(
                select(PriceHistory)
                .where(PriceHistory.asset_id == asset_id)
                .where(PriceHistory.date == day_datetime)
            ).first()
            
            if existing:
                if abs(existing.price - price) > 0.0001:
                    existing.price = price
                    session.add(existing)
            else:
                new_price = PriceHistory(
                    asset_id=asset_id,
                    date=day_datetime,
                    price=price
                )
                session.add(new_price)
    
    session.commit()

def _backfill_range(session: Session, start_date: date, end_date: date):
    """Backfill snapshots for a date range (inclusive)."""
    current_date = start_date
    while current_date <= end_date:
        day_start = datetime(current_date.year, current_date.month, current_date.day)
        day_end = datetime(current_date.year, current_date.month, current_date.day, 23, 59, 59)
        
        existing = session.exec(
            select(PortfolioSnapshot)
            .where(PortfolioSnapshot.date >= day_start)
            .where(PortfolioSnapshot.date <= day_end)
        ).first()

        if not existing:
            vals = calculate_portfolio_value_at_date(session, current_date)
            snapshot = PortfolioSnapshot(
                date=day_start,
                total_equity=vals["total_equity"],
                total_cash=vals["total_cash"],
                total_invested=vals["total_invested"],
                currency="USD"
            )
            session.add(snapshot)
            session.commit()
            print(f"Backfilled snapshot for {current_date}: ${vals['total_equity']:.2f}")
        
        current_date += timedelta(days=1)


def backfill_history(session: Session):
    """
    Backfill PortfolioSnapshot entries from the first transaction date until today.
    Also fetches daily historical prices for all assets to ensure accuracy.
    """
    first_tx = session.exec(select(Transaction).order_by(Transaction.date)).first()
    if not first_tx:
        return

    start_date = first_tx.date.date()
    today = datetime.utcnow().date()
    
    # 1. Identify all assets involved in relevant transactions
    # (Actually we want history for ALL assets that might be held)
    # Simple approach: Get all assets
    assets = session.exec(select(Asset)).all()
    symbols = [a.symbol for a in assets if a.symbol]
    
    if symbols:
        # 2. Fetch daily history for all symbols
        print(f"Fetching historical prices for {len(symbols)} assets from {start_date}...")
        
        # Check existing data to minimize API calls
        start_datetime = datetime(start_date.year, start_date.month, start_date.day)
        existing_rows = session.exec(
            select(PriceHistory)
            .where(PriceHistory.date >= start_datetime)
        ).all()
        
        existing_data = {}
        for row in existing_rows:
            d = row.date.date()
            if d not in existing_data: existing_data[d] = {}
            # Need symbol... PriceHistory has asset_id. Need map.
            # Efficiently map asset_id -> symbol
            asset = next((a for a in assets if a.id == row.asset_id), None)
            if asset and asset.symbol:
                existing_data[d][asset.symbol] = row.price

        price_data = get_price_history_batch(symbols, start_date, today, existing_data=existing_data)
        
        # 3. Update PriceHistory table
        _update_price_history(session, price_data, assets)
        print("Price history updated.")

    # 4. Backfill snapshots
    _backfill_range(session, start_date, today)


def rebuild_snapshots_from(session: Session, from_date: date):
    """
    Delete all snapshots on or after from_date, then re-backfill.
    Called after account creation or data changes that affect historical values.
    """
    from_datetime = datetime(from_date.year, from_date.month, from_date.day)
    
    # Delete existing snapshots from this date onwards
    old_snapshots = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date >= from_datetime)
    ).all()
    for snap in old_snapshots:
        session.delete(snap)
    session.commit()
    
    # Check if we need to fetch history (might be needed if we rebuild from far past)
    # Reuse backfill logic but only for range? Or just rely on backfill_history logic?
    # Ideally should pre-fetch history for this range too.
    
    today = datetime.utcnow().date()
    
    # Fetch history for this range
    # Fetch history for this range
    assets = session.exec(select(Asset)).all()
    symbols = [a.symbol for a in assets if a.symbol]
    if symbols:
        # Check existing data to minimize API calls
        start_datetime = datetime(from_date.year, from_date.month, from_date.day)
        existing_rows = session.exec(
            select(PriceHistory)
            .where(PriceHistory.date >= start_datetime)
        ).all()
        
        existing_data = {}
        asset_map_id = {a.id: a.symbol for a in assets} # optimize lookup

        for row in existing_rows:
            d = row.date.date()
            if d not in existing_data: existing_data[d] = {}
            if row.asset_id in asset_map_id:
                sym = asset_map_id[row.asset_id]
                existing_data[d][sym] = row.price

        price_data = get_price_history_batch(symbols, from_date, today, existing_data=existing_data)
        if price_data:
            _update_price_history(session, price_data, assets)

    # Re-backfill from the given date
    _backfill_range(session, from_date, today)


def run_rebuild_snapshots_background(from_date: date):
    """Wrapper to run rebuild in background with fresh session."""
    try:
        with Session(engine) as session:
            rebuild_snapshots_from(session, from_date)
            print(f"Background rebuild complete from {from_date}")
    except Exception as e:
        print(f"Error in background rebuild: {e}")


def record_daily_snapshot(session: Session) -> Optional[PortfolioSnapshot]:
    """Check if snapshot exists for today. If not, calculate and save."""
    today = datetime.utcnow().date()
    # Check existing
    start_of_day = datetime(today.year, today.month, today.day)
    
    existing = session.exec(
        select(PortfolioSnapshot).where(PortfolioSnapshot.date >= start_of_day)
    ).first()

    if existing:
        return None  # Already recorded

    # Calculate equity
    summary = calculate_summary(session)
    equity = summary["total_equity"]
    cash = summary["total_cash"]
    invested = summary["total_invested"]

    snapshot = PortfolioSnapshot(
        date=datetime.utcnow(),
        total_equity=equity,
        total_cash=cash,
        total_invested=invested,
        currency="USD"
    )
    session.add(snapshot)
    session.commit()
    session.refresh(snapshot)
    return snapshot
