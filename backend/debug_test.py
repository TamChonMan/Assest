
from sqlmodel import SQLModel, create_engine, Session
from models import Asset, Account
from sqlalchemy import inspect

# Create in-memory DB
engine = create_engine("sqlite:///:memory:")
SQLModel.metadata.create_all(engine)

# Inspect table
inspector = inspect(engine)
columns = [c['name'] for c in inspector.get_columns('asset')]
print("Asset columns in DB:", columns)

# Check model fields
print("Asset model fields:", Asset.__fields__.keys())

# Try insert
with Session(engine) as session:
    try:
        a = Asset(symbol="TEST", type="STOCK", tags="Tag1")
        session.add(a)
        session.commit()
        print("Insert successful")
    except Exception as e:
        print("Insert failed:", e)
