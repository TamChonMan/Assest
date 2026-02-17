import yfinance as yf
import pandas as pd
from datetime import date, timedelta
from typing import List, Dict

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


def get_price_history_batch(symbols: List[str], start_date: date, end_date: date) -> Dict[date, Dict[str, float]]:
    """
    Fetches historical closing prices for multiple symbols.
    Returns: { date: { symbol: price } }
    Handles forward-filling logic for weekends/holidays if needed, 
    or returns available data.
    """
    if not symbols:
        return {}
        
    try:
        # yfinance expects YYYY-MM-DD strings
        start_str = start_date.strftime("%Y-%m-%d")
        # end_date in yfinance is exclusive, so add 1 day to include end_date
        end_str = (end_date + timedelta(days=1)).strftime("%Y-%m-%d")
        
        # Download batch
        # threads=True for speed
        df = yf.download(symbols, start=start_str, end=end_str, progress=False, threads=True)['Close']
        
        if df.empty:
            return {}
            
        # Reformat to Dict[date, Dict[symbol, price]]
        # df index is DatetimeIndex. Columns are symbols (or single Series if 1 symbol).
        
        # Handle single symbol case (Series)
        if isinstance(df, pd.Series):
             # Name is the symbol? Or just 'Close'?
             # Usually yf.download(['AAPL']) returns DataFrame even for 1 symbol if asking for 'Close'?
             # If I ask for just 'Close', and 1 symbol, it might be Series.
             # Safe bet: force DataFrame
             df = df.to_frame()
             if len(symbols) == 1:
                 df.columns = symbols

        # Handle formatting
        result = {}
        # Forward fill missing data (e.g. weekends use Friday price)
        df = df.ffill()
        
        for dt, row in df.iterrows():
            d = dt.date()
            result[d] = {}
            for sym in symbols:
                if sym in row and pd.notna(row[sym]):
                    result[d][sym] = float(row[sym])
                    
        return result
        
    except Exception as e:
        print(f"Error fetching batch history: {e}")
        return {}
