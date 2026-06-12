"""
Article CRUD endpoints – public reads, authenticated writes.
"""

from __future__ import annotations

import logging
import re
import unicodedata
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.database import get_db
from app.models.article import Article
from app.models.user import User
from app.schemas.article import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleStatsResponse,
    ArticleUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/articles", tags=["Articles"])


# ── Helpers ────────────────────────────────────────────────────────
def slugify(text: str) -> str:
    """Convert text to a URL-safe slug."""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


async def _unique_slug(db: AsyncSession, base_slug: str, exclude_id: str | None = None) -> str:
    """Ensure slug uniqueness by appending a suffix if needed."""
    slug = base_slug
    counter = 1
    while True:
        query = select(Article).where(Article.slug == slug)
        if exclude_id:
            query = query.where(Article.id != exclude_id)
        result = await db.execute(query)
        if result.scalar_one_or_none() is None:
            return slug
        slug = f"{base_slug}-{counter}"
        counter += 1


# ── Public endpoints ───────────────────────────────────────────────
@router.get(
    "",
    response_model=ArticleListResponse,
    summary="List articles (public)",
)
async def list_articles(
    category: str | None = Query(None, description="Filter by category"),
    status_filter: str = Query("published", alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    List articles with optional filtering and pagination.
    Public endpoint — defaults to published articles only.
    """
    # Base query
    query = select(Article).where(Article.status == status_filter)

    if category:
        query = query.where(Article.category == category)

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Fetch page
    query = (
        query
        .order_by(Article.published_at.desc().nullslast(), Article.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(query)
    articles = list(result.scalars().all())

    return {
        "articles": [ArticleResponse.model_validate(a) for a in articles],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get(
    "/categories",
    summary="List distinct categories (public)",
)
async def list_categories(
    db: AsyncSession = Depends(get_db),
) -> list[str]:
    """Return all categories that have published articles."""
    result = await db.execute(
        select(Article.category)
        .where(Article.status == "published")
        .distinct()
        .order_by(Article.category)
    )
    return [row[0] for row in result.all()]


@router.get(
    "/stats",
    response_model=ArticleStatsResponse,
    summary="Dashboard stats (auth required)",
)
async def get_stats(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, int]:
    """Return article counts for the admin dashboard."""
    published = (await db.execute(
        select(func.count()).where(Article.status == "published")
    )).scalar() or 0

    drafts = (await db.execute(
        select(func.count()).where(Article.status == "draft")
    )).scalar() or 0

    categories = (await db.execute(
        select(func.count(Article.category.distinct()))
    )).scalar() or 0

    return {
        "published": published,
        "drafts": drafts,
        "categories": categories,
        "total": published + drafts,
    }


@router.get(
    "/{slug}",
    response_model=ArticleResponse,
    summary="Get article by slug (public)",
)
async def get_article(
    slug: str,
    db: AsyncSession = Depends(get_db),
) -> ArticleResponse:
    """Fetch a single article by its URL slug."""
    result = await db.execute(select(Article).where(Article.slug == slug))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )

    return ArticleResponse.model_validate(article)


# ── Authenticated endpoints ────────────────────────────────────────
@router.post(
    "",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create article (auth required)",
)
async def create_article(
    data: ArticleCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArticleResponse:
    """Create a new article."""
    slug = await _unique_slug(db, slugify(data.title))

    article = Article(
        user_id=user.id,
        title=data.title,
        slug=slug,
        content=data.content,
        category=data.category,
        author=data.author,
        status=data.status,
        excerpt=data.excerpt,
        featured_image=data.featured_image,
        published_at=(
            datetime.now(timezone.utc) if data.status == "published" else None
        ),
    )
    db.add(article)
    await db.flush()

    logger.info("Article created: %s (id=%s)", article.title, article.id)
    return ArticleResponse.model_validate(article)


@router.put(
    "/{article_id}",
    response_model=ArticleResponse,
    summary="Update article (auth required)",
)
async def update_article(
    article_id: str,
    data: ArticleUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ArticleResponse:
    """Update an existing article."""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )

    update_data = data.model_dump(exclude_unset=True)

    # Re-slug if title changed
    if "title" in update_data:
        update_data["slug"] = await _unique_slug(
            db, slugify(update_data["title"]), exclude_id=article.id
        )

    # Set published_at when status changes to published
    if update_data.get("status") == "published" and article.status != "published":
        update_data["published_at"] = datetime.now(timezone.utc)
    elif update_data.get("status") == "draft":
        update_data["published_at"] = None

    for key, value in update_data.items():
        setattr(article, key, value)

    await db.flush()

    logger.info("Article updated: %s (id=%s)", article.title, article.id)
    return ArticleResponse.model_validate(article)


@router.delete(
    "/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete article (auth required)",
    response_class=Response,
)
async def delete_article(
    article_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Delete an article permanently."""
    result = await db.execute(select(Article).where(Article.id == article_id))
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Article not found",
        )

    await db.delete(article)
    await db.flush()

    logger.info("Article deleted: id=%s", article_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
