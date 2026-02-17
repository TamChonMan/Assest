import yfinance as yf

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
    except Exception as e:
        print(f"Error fetching price for {symbol}: {e}")
        return 0.0
