from sqlmodel import Session, select, create_engine
from models import PortfolioSnapshot
from database import sqlite_url

engine = create_engine(sqlite_url)

with Session(engine) as session:
    session.query(PortfolioSnapshot).delete()
    session.commit()
    print("Deleted all PortfolioSnapshots")
