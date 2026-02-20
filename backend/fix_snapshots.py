from sqlmodel import Session, delete
from database import engine
from models import PortfolioSnapshot

def fix_snapshots():
    with Session(engine) as session:
        print("Clearing PortfolioSnapshot table...")
        session.exec(delete(PortfolioSnapshot))
        session.commit()
        print("✅ PortfolioSnapshot table cleared successfully.")
        print("The system will automatically rebuild snapshots on the next dashboard load.")

if __name__ == "__main__":
    fix_snapshots()
