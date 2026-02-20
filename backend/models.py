from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship
from enum import Enum

class AccountType(str, Enum):
    BANK = "BANK"
    STOCK = "STOCK"
    CRYPTO = "CRYPTO"

class TransactionType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    DEPOSIT = "DEPOSIT"
    WITHDRAW = "WITHDRAW"
    INTEREST = "INTEREST"
    DIVIDEND = "DIVIDEND"
    FEE = "FEE"
class AssetTagLink(SQLModel, table=True):
    asset_id: Optional[int] = Field(default=None, foreign_key="asset.id", primary_key=True, ondelete="CASCADE")
    tag_id: Optional[int] = Field(default=None, foreign_key="tag.id", primary_key=True, ondelete="CASCADE")

class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    color: Optional[str] = None  # Hex color e.g. #FF0000

    assets: List["Asset"] = Relationship(back_populates="tags", link_model=AssetTagLink)


class Account(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    type: AccountType
    currency: str = Field(default="HKD")
    balance: float = Field(default=0.0)
    inception_date: Optional[datetime] = Field(default_factory=datetime.utcnow)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    transactions: List["Transaction"] = Relationship(back_populates="account")

class Asset(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(unique=True, index=True)
    name: Optional[str] = None
    type: str
    currency: str = Field(default="USD")  # Trading currency (e.g., HKD, USD)
    tags: List["Tag"] = Relationship(back_populates="assets", link_model=AssetTagLink)
    
    transactions: List["Transaction"] = Relationship(back_populates="asset")
    prices: List["PriceHistory"] = Relationship(back_populates="asset")


class Transaction(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime
    type: TransactionType
    status: str = Field(default="COMPLETED")

    account_id: int = Field(foreign_key="account.id")
    account: Account = Relationship(back_populates="transactions")

    asset_id: Optional[int] = Field(default=None, foreign_key="asset.id")
    asset: Optional[Asset] = Relationship(back_populates="transactions")

    quantity: Optional[float] = None
    price: Optional[float] = None
    fee: Optional[float] = None
    total: float

    notes: Optional[str] = None

    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class PriceHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    asset_id: int = Field(foreign_key="asset.id")
    asset: Asset = Relationship(back_populates="prices")
    date: datetime
    price: float

class PortfolioSnapshot(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    date: datetime = Field(index=True)     # Snapshot date (usually midnight)
    total_equity: float                    # Total value in settlement currency
    total_cash: Optional[float] = None     # Cash portion of equity
    total_invested: Optional[float] = None # Net deposits (cash in - cash out)
    holdings_count: Optional[int] = None   # Number of distinct holdings
    currency: str = Field(default="USD")   # Currency of the snapshot
    created_at: datetime = Field(default_factory=datetime.utcnow)
