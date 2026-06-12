"""Article request/response schemas."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Requests ───────────────────────────────────────────────────────
class ArticleCreate(BaseModel):
    """Create a new article."""
    title: str = Field(..., min_length=1, max_length=500)
    content: str = Field("", description="Markdown content")
    category: str = Field("News", description="Article category")
    author: str = Field("Editor", description="Author display name")
    status: str = Field("draft", pattern="^(draft|published)$")
    excerpt: str | None = Field(None, max_length=500)
    featured_image: str | None = None


class ArticleUpdate(BaseModel):
    """Update an existing article (all fields optional)."""
    title: str | None = Field(None, min_length=1, max_length=500)
    content: str | None = None
    category: str | None = None
    author: str | None = None
    status: str | None = Field(None, pattern="^(draft|published)$")
    excerpt: str | None = None
    featured_image: str | None = None


# ── Responses ──────────────────────────────────────────────────────
class ArticleResponse(BaseModel):
    """Full article response."""
    id: str
    user_id: str
    title: str
    slug: str
    content: str
    category: str
    author: str
    status: str
    excerpt: str | None
    featured_image: str | None
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None

    model_config = {"from_attributes": True}


class ArticleListResponse(BaseModel):
    """Paginated article list."""
    articles: list[ArticleResponse]
    total: int
    page: int
    page_size: int


class ArticleStatsResponse(BaseModel):
    """Dashboard statistics."""
    published: int
    drafts: int
    categories: int
    total: int
