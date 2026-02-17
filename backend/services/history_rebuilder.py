
from datetime import date, timedelta, datetime
from typing import List, Dict, Set
from sqlmodel import Session, select
from models import Transaction, PortfolioSnapshot, Asset, TransactionType
from services.market_data import get_price_history_batch, get_asset_price

def rebuild_portfolio_history(session: Session, start_date: date, end_date: date = None):
    """
    Reconstructs PortfolioSnapshot records from start_date to end_date (or today)
    based on transaction history and historical market data.
    """
    if not end_date:
        end_date = date.today()
        
    print(f"Rebuilding history from {start_date} to {end_date}")
        
    # 1. Clear existing snapshots in range to avoid duplicates
    statement = select(PortfolioSnapshot).where(PortfolioSnapshot.date >= start_date).where(PortfolioSnapshot.date <= end_date)
    existing = session.exec(statement).all()
    for s in existing:
        session.delete(s)
    session.commit() # Commit deletion
        
    # 2. Fetch all transactions ordered by date
    # We need ALL transactions to build up state correctly? 
    # Or can we assume we start from 0 if start_date is early enough?
    # If start_date is "2020-01-01", and we have txs from 2020, we assume 0 before that.
    # If there are transactions BEFORE start_date, we must process them to get initial state!
    # Let's fetch ALL transactions and iterate.
    txs = session.exec(select(Transaction).order_by(Transaction.date)).all()
    
    # 3. Identify Assets involved
    asset_ids = set()
    for t in txs:
        if t.asset_id:
            asset_ids.add(t.asset_id)
            
    # Map asset_id -> symbol
    assets = session.exec(select(Asset).where(Asset.id.in_(asset_ids))).all()
    id_map = {a.id: a for a in assets}
    symbols = [a.symbol for a in assets]
    
    # 4. Fetch Market Data for the range
    # Note: We need prices from start_date to end_date.
    # BUT if we process transactions before start_date, do we need prices for them?
    # No, we only need valuations for the Snapshots we create (start_date to end_date).
    price_map = get_price_history_batch(symbols, start_date, end_date)
    
    # 5. Iterate Days
    # Initialize State
    current_cash = 0.0
    current_holdings: Dict[int, float] = {} # { asset_id: quantity }
    current_invested = 0.0 # Total invested capital (Cash In - Cash Out)
    
    # Cursor for transactions
    tx_idx = 0
    total_txs = len(txs)
    
    delta = timedelta(days=1)
    curr_date = start_date
    
    # Pre-process transactions strictly BEFORE start_date to establish initial state
    # This is crucial if start_date is later than first transaction.
    while tx_idx < total_txs and txs[tx_idx].date.date() < start_date:
        tx = txs[tx_idx]
        _apply_transaction_effect(tx, current_holdings, id_map)
        # Update cash/invested
        if tx.type == TransactionType.DEPOSIT:
            current_cash += tx.total
            current_invested += tx.total
        elif tx.type == TransactionType.WITHDRAW:
            current_cash -= tx.total
            current_invested -= tx.total
        elif tx.type == TransactionType.BUY:
            current_cash -= tx.total # Cash decreases
        elif tx.type == TransactionType.SELL:
            current_cash += tx.total # Cash increases
            # Invested amount impact? 
            # Usually "Invested" means net deposits. 
            # Or actual cost basis of holdings?
            # Let's track Net Deposits as "Total Invested" for simple ROI calc.
        
        tx_idx += 1
        
    print(f"Initial State at {start_date}: Cash={current_cash}, Holdings={current_holdings}")
    
    # Iterate from start_date to end_date
    while curr_date <= end_date:
        # Apply transactions ON curr_date
        while tx_idx < total_txs and txs[tx_idx].date.date() <= curr_date:
            tx = txs[tx_idx]
            if tx.date.date() == curr_date:
                _apply_transaction_effect(tx, current_holdings, id_map)
                
                # Update Cash / Invested
                if tx.type == TransactionType.DEPOSIT:
                    current_cash += tx.total
                    current_invested += tx.total
                elif tx.type == TransactionType.WITHDRAW:
                    current_cash -= tx.total
                    current_invested -= tx.total
                elif tx.type == TransactionType.BUY:
                    current_cash -= tx.total
                elif tx.type == TransactionType.SELL:
                    current_cash += tx.total
                elif tx.type in [TransactionType.INTEREST, TransactionType.DIVIDEND]:
                    current_cash += tx.total
                elif tx.type == TransactionType.FEE:
                    current_cash -= tx.total
                    
            tx_idx += 1
            
        # Calculate Equity
        holdings_value = 0.0
        for asset_id, qty in current_holdings.items():
            if qty > 0: # Check floating point formatting?
                asset = id_map.get(asset_id)
                if asset:
                    # Get price for this day
                    # price_map key is date object
                    daily_prices = price_map.get(curr_date, {})
                    price = daily_prices.get(asset.symbol, 0.0)
                    
                    if price == 0.0:
                        # Fallback: maybe price history is missing for today?
                        # Try to use previous day's price?
                        # get_price_history_batch should have ffilled.
                        # If still 0, it means no data yet (e.g. IPO).
                        pass
                        
                    holdings_value += qty * price
        
        total_equity = current_cash + holdings_value
        
        # Save Snapshot
        snap = PortfolioSnapshot(
            date=curr_date,
            total_equity=total_equity,
            total_cash=current_cash,
            total_invested=current_invested,
            holdings_count=len([q for q in current_holdings.values() if q > 0])
        )
        session.add(snap)
        
        curr_date += delta
        
    session.commit()
    print("History rebuild complete.")


def _apply_transaction_effect(tx: Transaction, holdings: Dict[int, float], id_map):
    """Updates holdings dict based on transaction type."""
    if tx.type == TransactionType.BUY:
        if tx.asset_id:
            holdings[tx.asset_id] = holdings.get(tx.asset_id, 0.0) + tx.quantity
    elif tx.type == TransactionType.SELL:
        if tx.asset_id:
            holdings[tx.asset_id] = holdings.get(tx.asset_id, 0.0) - tx.quantity
