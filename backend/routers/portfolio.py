"""
Portfolio Router: Exposes portfolio holdings and summary endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from database import get_session
from services.portfolio import calculate_holdings, calculate_summary, record_daily_snapshot
from models import PortfolioSnapshot

router = APIRouter(
    prefix="/portfolio",
    tags=["portfolio"],
)


@router.get("/holdings")
def get_holdings(session: Session = Depends(get_session)):
    """Get current portfolio holdings with quantity and avg cost."""
    return calculate_holdings(session)


@router.get("/summary")
def get_summary(session: Session = Depends(get_session)):
    """Get portfolio summary: total invested, holdings count."""
    # Trigger daily snapshot
    record_daily_snapshot(session)
    return calculate_summary(session)


@router.get("/history", response_model=List[PortfolioSnapshot])
def get_history(session: Session = Depends(get_session)):
    """Get historical portfolio snapshots for trend chart."""
    return session.exec(select(PortfolioSnapshot).order_by(PortfolioSnapshot.date)).all()
