from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session, DeclarativeBase
from .config import settings

DB_URL = (settings.DATABASE_URL
          .replace("postgresql+asyncpg://", "postgresql://")
          .replace("+asyncpg", "")
          .replace("postgres://", "postgresql://", 1))

engine = create_engine(DB_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

class Base(DeclarativeBase):
    pass

def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
