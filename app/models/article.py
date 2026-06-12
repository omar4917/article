"""Article ORM model – the core content entity."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Article(Base):
    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(500), unique=True, nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    category: Mapped[str] = mapped_column(
        String(100), nullable=False, default="News"
    )
    author: Mapped[str] = mapped_column(
        String(255), nullable=False, default="Editor"
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft",
        doc="draft | published",
    )
    excerpt: Mapped[str | None] = mapped_column(Text, nullable=True)
    featured_image: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    published_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    author_user = relationship("User", back_populates="articles", lazy="selectin")

    # Composite index for common queries
    __table_args__ = (
        Index("ix_articles_status_published", "status", "published_at"),
    )

    def __repr__(self) -> str:
        return f"<Article {self.title[:40]}>"
