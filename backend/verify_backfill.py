from sqlmodel import Session, select, create_engine
from models import PortfolioSnapshot
from database import sqlite_url

engine = create_engine(sqlite_url)

with Session(engine) as session:
    snapshots = session.exec(select(PortfolioSnapshot).order_by(PortfolioSnapshot.date)).all()
    print(f"Total Snapshots: {len(snapshots)}")
    for s in snapshots[:5]: # First 5
        print(f"{s.date}: Equity=${s.total_equity:.2f} Cash=${s.total_cash:.2f}")
    if len(snapshots) > 10:
        print("...")
    for s in snapshots[-5:]: # Last 5
        print(f"{s.date}: Equity=${s.total_equity:.2f} Cash=${s.total_cash:.2f}")
