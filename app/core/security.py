"""
Security module: JWT authentication, password hashing.
Follows the same patterns as the reference project.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()

# ── Password hashing ──────────────────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Verify a password against its hash."""
    return pwd_context.verify(plain, hashed)


# ── JWT tokens ─────────────────────────────────────────────────────
def create_access_token(
    data: dict,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(
        to_encode, settings.secret_key, algorithm=settings.jwt_algorithm
    )


def decode_access_token(token: str) -> dict | None:
    """Decode and verify a JWT token. Returns claims or None."""
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.jwt_algorithm]
        )
        return payload
    except JWTError:
        return None
