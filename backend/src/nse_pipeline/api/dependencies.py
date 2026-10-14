"""FastAPI dependency injection utilities including authentication and permissions."""

from typing import Optional

from fastapi import Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from nse_pipeline.database.models import User
from nse_pipeline.database.repositories.user_repository import UserRepository, normalize_screens
from nse_pipeline.database.session import get_db


def get_token_from_header_or_query(
    authorization: Optional[str] = Header(None),
    token: Optional[str] = Query(None),
) -> Optional[str]:
    """Extracts bearer token from Authorization header or URL query parameter."""
    if authorization and authorization.lower().startswith("bearer "):
        return authorization.split(" ", 1)[1].strip()
    return token


def get_current_user(
    token_str: Optional[str] = Depends(get_token_from_header_or_query),
    db: Session = Depends(get_db),
) -> User:
    """Dependency that authenticates the user using their bearer token."""
    if not token_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    repo = UserRepository(db)
    user = repo.get_user_by_token(token_str)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated. Contact an administrator.",
        )

    return user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """Dependency requiring the authenticated user to hold the 'admin' role."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrative privileges required to access this resource.",
        )
    return current_user


def require_screen(screen_key: str):
    """Dependency factory that checks if the user has access to a specific screen."""
    def _screen_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "admin":
            return current_user
        accessible = normalize_screens(current_user.accessible_screens)
        if screen_key not in accessible:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: you do not have permission to access the '{screen_key}' screen.",
            )
        return current_user
    return _screen_checker


__all__ = [
    "get_db",
    "get_current_user",
    "require_admin",
    "require_screen",
    "get_token_from_header_or_query",
]
