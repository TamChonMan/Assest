import yfinance as yf
import pandas as pd
from datetime import date, timedelta
from typing import List, Dict, Optional

def get_asset_price(symbol: str) -> float:
    """
    Fetches the current price of an asset using Yahoo Finance.
    
    Args:
        symbol (str): The ticker symbol (e.g., 'AAPL', '0700.HK', 'BTC-USD').
        
    Returns:
        float: The current price, or 0.0 if not found/error.
    """
    try:
        if not symbol:
            return 0.0
            
        ticker = yf.Ticker(symbol)
        
        # Try fast_info first (faster, real-time)
        try:
            price = ticker.fast_info.last_price
            if price:
                return float(price)
        except:
            pass
            
        # Fallback to history (slower but reliable)
        history = ticker.history(period="1d")
        if not history.empty:
            return float(history['Close'].iloc[-1])
            
        return 0.0
        return 0.0
    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        return 0.0


def validate_symbol_exists(symbol: str) -> dict:
    """
    Checks if a symbol is valid on Yahoo Finance.
    Returns: { "valid": bool, "symbol": str, "name": str, "currency": str }
    """
    try:
        if not symbol:
            return {"valid": False, "symbol": symbol}
            
        ticker = yf.Ticker(symbol)
        
        # Check history first (definitive check for existence)
        # Using period="5d" to avoid weekend gaps, "1d" might be empty on Sunday?
        # valid tickers should return something.
        hist = ticker.history(period="5d")
        if hist.empty:
            return {"valid": False, "symbol": symbol}
            
        # Try to get metadata
        name = symbol
        currency = "USD"
        
        try:
            # fast_info is preferred (lazy loaded)
            if hasattr(ticker, 'fast_info'):
                currency = ticker.fast_info.currency
                # fast_info doesn't seemingly have name?
                # accessing .info triggers full request.
                # Let's try .info carefully or just stick to basics.
                # If we need name, we might need .info.
            
            # If we need name, we unfortunately need .info
            # But maybe we can skip name for validation speed, or fetch it async?
            # User wants validation, name is nice to have.
            info = ticker.info 
            name = info.get("longName") or info.get("shortName") or symbol
            currency = info.get("currency") or currency
        except:
            pass

        return {
            "valid": True,
            "symbol": symbol,
            "name": name,
            "currency": currency
        }
    except Exception as e:
        print(f"Error validating {symbol}: {e}")
        return {"valid": False, "symbol": symbol}


def get_price_history_batch(
    symbols: List[str], 
    start_date: date, 
    end_date: date,
    existing_data: Optional[Dict[date, Dict[str, float]]] = None
) -> Dict[date, Dict[str, float]]:
    """
    Fetches historical closing prices for multiple symbols.
    Returns: { date: { symbol: price } }
    
    OPTIMIZATION: If existing_data is provided, checks gaps and only fetches missing.
    """
    if not symbols:
        return {}

    # Define the full range of dates needed (business days approx)
    # Actually, simpler: just identify which (symbol, date) are missing?
    # Fetching by range is API constrained. We can't fetch "dates 1, 3, 5".
    # Best approach: Check if we have *most* data. 
    # If we are missing data for a symbol in the range, we fetch the range for that symbol.
    
    symbols_to_fetch = set()
    
    if existing_data:
        # Check each symbol: do we have data for it in the range?
        # This is a heuristic. If we have meaningful data, we assume it's good?
        # Or checking start/end?
        # Strict approach: Iterate all days? Too slow.
        # fast check: if symbol is in existing_data for *some* dates, is it enough?
        # Let's check if the symbol has data covering start_date to end_date.
        
        # Flatten existing data to {symbol: {date, ...}}
        existing_by_symbol = {}
        for d, prices in existing_data.items():
            if not d: continue
            # Filter range
            if start_date <= d <= end_date:
                for sym, p in prices.items():
                    if sym not in existing_by_symbol: existing_by_symbol[sym] = 0
                    existing_by_symbol[sym] += 1
        
        # Estimate expected days (approx 5/7 of range)
        days_delta = (end_date - start_date).days
        expected_days = max(1, int(days_delta * 0.6)) # rough estimate for weekends/holidays
        
        for sym in symbols:
            count = existing_by_symbol.get(sym, 0)
            if count < expected_days:
                symbols_to_fetch.add(sym)
    else:
        symbols_to_fetch = set(symbols)

    if not symbols_to_fetch:
        print(f"Smart Cache: All {len(symbols)} assets have sufficient data. Skipping download.")
        return {}

    try:
        fetch_list = list(symbols_to_fetch)
        print(f"Smart Cache: Fetching history for {len(fetch_list)}/{len(symbols)} assets...")
        
        # yfinance expects YYYY-MM-DD strings
        start_str = start_date.strftime("%Y-%m-%d")
        # end_date in yfinance is exclusive, so add 1 day to include end_date
        end_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Download batch
        # threads=True for speed
        df = yf.download(fetch_list, start=start_str, end=end_str, progress=False, threads=True)['Close']
        
        if df.empty:
            return {}
            
        # Reformat to Dict[date, Dict[symbol, price]]
        
        # Handle single symbol case (Series)
        if isinstance(df, pd.Series):
             df = df.to_frame()
             if len(fetch_list) == 1:
                 df.columns = fetch_list

        # Handle formatting
        result = {}
        # Forward fill missing data (e.g. weekends use Friday price)
        df = df.ffill()
        
        for dt, row in df.iterrows():
            d = dt.date()
            result[d] = {}
            for sym in fetch_list:
                if sym in row and pd.notna(row[sym]):
                    result[d][sym] = float(row[sym])
                    
        return result
        
    except Exception as e:
        print(f"Error fetching batch history: {e}")
        return {}
