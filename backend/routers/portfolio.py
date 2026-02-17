"""
Portfolio Router: Exposes portfolio holdings and summary endpoints.
"""
from fastapi import APIRouter, Depends
from sqlmodel import Session

from database import get_session
from services.portfolio import calculate_holdings, calculate_summary

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
    return calculate_summary(session)
