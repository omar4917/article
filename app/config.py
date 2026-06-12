"""
Application configuration via pydantic-settings.
All settings are loaded from environment variables / .env file.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Central configuration for The Pitch Report."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────────────
    app_name: str = "The Pitch Report"
    app_version: str = "1.0.0"
    debug: bool = False

    # ── Security ───────────────────────────────────────────────────
    secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # ── Database ───────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./pitch_report.db"

    # ── Admin defaults ─────────────────────────────────────────────
    default_admin_email: str = "admin@pitchreport.com"
    default_admin_password: str = "admin"


@lru_cache
def get_settings() -> Settings:
    """Cached singleton for application settings."""
    return Settings()
