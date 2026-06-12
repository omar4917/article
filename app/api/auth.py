"""
Authentication endpoints – register and login.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new admin user",
)
async def register(
    data: UserCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Create a new user account and return a JWT token.
    """
    # Check duplicate email
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        display_name=data.display_name,
    )
    db.add(user)
    await db.flush()

    token = create_access_token({"sub": user.id})
    logger.info("New user registered: %s", user.email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and get JWT token",
)
async def login(
    data: UserLogin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Authenticate with email/password and receive a JWT token.
    """
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    token = create_access_token({"sub": user.id})
    logger.info("User logged in: %s", user.email)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": UserResponse.model_validate(user),
    }
