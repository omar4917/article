"""
Async SQLAlchemy database engine and session management.
Supports SQLite (dev) and PostgreSQL (prod) via the same interface.
"""

from __future__ import annotations

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# ── Engine ─────────────────────────────────────────────────────────
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    # SQLite needs this for async support
    connect_args=(
        {"check_same_thread": False}
        if "sqlite" in settings.database_url
        else {}
    ),
)

# ── Session factory ────────────────────────────────────────────────
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


# ── Base model ─────────────────────────────────────────────────────
class Base(DeclarativeBase):
    """Declarative base for all ORM models."""
    pass


# ── Helpers ────────────────────────────────────────────────────────
async def get_db() -> AsyncSession:  # type: ignore[misc]
    """FastAPI dependency – yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables() -> None:
    """Create all tables (used on startup)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables() -> None:
    """Drop all tables (used for testing)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
