from sqlmodel import Session
from database import engine
from services.portfolio import backfill_history

def run_backfill():
    with Session(engine) as session:
        print("Starting history backfill...")
        backfill_history(session)
        print("✅ History backfill complete.")
        print("The Total Asset Trend chart should now be populated.")

if __name__ == "__main__":
    run_backfill()
