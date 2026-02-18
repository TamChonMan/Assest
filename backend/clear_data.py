
from sqlmodel import Session, delete
from database import engine
from models import Account, Transaction, PortfolioSnapshot, PriceHistory, Asset

def clear_all_data():
    print("Clearing all user data...")
    with Session(engine) as session:
        # Delete independent tables first if cascading isn't set up, 
        # or child tables first to avoid FK constraints.
        
        # 1. PriceHistory (depends on Asset)
        session.exec(delete(PriceHistory))
        print("Deleted PriceHistory.")
        
        # 2. PortfolioSnapshot (Independent mostly)
        session.exec(delete(PortfolioSnapshot))
        print("Deleted PortfolioSnapshot.")
        
        # 3. Transaction (depends on Account, Asset)
        session.exec(delete(Transaction))
        print("Deleted Transaction.")
        
        # 4. Account (Independent)
        session.exec(delete(Account))
        print("Deleted Account.")
        
        # 5. Asset (Optional? User might want to keep assets definitions, but request said "account and transactions".
        # Usually assets are shared definitions. I'll keep Assets for now unless user insists, 
        # as they are just definitions like "AAPL".)
        # But if user wants a clean slate, maybe they want to re-add assets too?
        # Safe to keep Assets as they are just reference data.
        
        session.commit()
        print("All user data cleared.")

if __name__ == "__main__":
    clear_all_data()
