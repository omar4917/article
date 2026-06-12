"""
The Pitch Report – FastAPI Application Entrypoint

A production-ready article platform with:
  - JWT authentication
  - Full article CRUD API
  - Static frontend serving
  - Async SQLAlchemy ORM

Run with: uvicorn app.main:app --reload
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.database import create_tables

# Import all models so they're registered with Base.metadata
import app.models  # noqa: F401

settings = get_settings()

# ── Logging ────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s │ %(levelname)-8s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# ── Seed default admin ─────────────────────────────────────────────
async def _seed_admin() -> None:
    """Create default admin user if no users exist."""
    from sqlalchemy import select, func
    from app.database import async_session
    from app.models.user import User
    from app.core.security import hash_password

    async with async_session() as db:
        count = (await db.execute(select(func.count()).select_from(User))).scalar()
        if count == 0:
            admin = User(
                email=settings.default_admin_email,
                hashed_password=hash_password(settings.default_admin_password),
                display_name="Admin",
            )
            db.add(admin)
            await db.commit()
            logger.info("🌱 Default admin created: %s", settings.default_admin_email)


# ── Lifespan (startup / shutdown) ──────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage application lifecycle."""
    # ── Startup ───────────────────────────────────────────────────
    logger.info("🚀 Starting %s v%s", settings.app_name, settings.app_version)

    # Create database tables
    await create_tables()
    logger.info("✅ Database tables ready")

    # Seed admin user
    await _seed_admin()

    logger.info("═" * 50)
    logger.info("  %s is ready!", settings.app_name)
    logger.info("  API Docs: http://localhost:8001/docs")
    logger.info("  Frontend: http://localhost:8001/")
    logger.info("═" * 50)

    yield

    # ── Shutdown ──────────────────────────────────────────────────
    logger.info("👋 Goodbye!")


# ── FastAPI app ────────────────────────────────────────────────────
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "A production-ready article platform for sports opinion, "
        "debate, and tactical analysis."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Register API routers ──────────────────────────────────────────
from app.api.auth import router as auth_router
from app.api.articles import router as articles_router

API_PREFIX = "/api/v1"

app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(articles_router, prefix=API_PREFIX)


# ── Health check ───────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "app": settings.app_name,
        "version": settings.app_version,
        "debug": settings.debug,
    }


# ── Static files (frontend) ───────────────────────────────────────
# Mount AFTER API routes so /api/v1/* takes priority
static_dir = Path(__file__).parent.parent / "static"
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
