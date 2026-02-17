
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from datetime import date
from database import get_session
from services.history_rebuilder import rebuild_portfolio_history

router = APIRouter(
    prefix="/analytics",
    tags=["analytics"],
)

@router.post("/rebuild-history")
def trigger_history_rebuild(
    start_date: date = Query(default=date(2020, 1, 1)),
    session: Session = Depends(get_session)
):
    """
    Triggers a full rebuild of the portfolio history snapshots starting from the given date.
    Ideally this should be a background task if it takes long, but for now we run it synchronously.
    """
    rebuild_portfolio_history(session, start_date)
    return {"status": "success", "message": f"History reconstruction started from {start_date}"}
