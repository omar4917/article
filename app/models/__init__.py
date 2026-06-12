"""ORM model package – import all models so Base.metadata sees them."""

from app.models.user import User
from app.models.article import Article

__all__ = [
    "User",
    "Article",
]
