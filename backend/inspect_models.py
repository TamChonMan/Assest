
from models import AccountType, Account, Transaction, TransactionType
from sqlmodel import SQLModel

print(f"AccountType members: {[m.value for m in AccountType]}")
print(f"TransactionType members: {[m.value for m in TransactionType]}")
print(f"Account table: {Account.__tablename__}")
print(f"Transaction table: {Transaction.__tablename__}")

# Check fields
print("Account fields:", Account.__fields__.keys())
print("Transaction fields:", Transaction.__fields__.keys())
