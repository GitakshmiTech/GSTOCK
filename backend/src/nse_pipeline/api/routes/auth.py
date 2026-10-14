"""Authentication endpoints for user login, session validation, and logout."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_current_user, get_db, get_token_from_header_or_query
from nse_pipeline.database.models import User
from nse_pipeline.database.repositories.user_repository import (
    ALL_SCREEN_KEYS,
    UserRepository,
    normalize_screens,
    verify_password,
)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class LoginRequest(BaseModel):
    email: Optional[str] = Field(None, description="Account Email ID (e.g. admin@nse.com)")
    username: Optional[str] = Field(None, description="Account Username (optional if email provided)")
    password: str = Field(..., description="Account password")


class UserProfileResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str]
    role: str
    accessible_screens: list[str]
    is_active: bool


class LoginResponse(BaseModel):
    token: str
    user: UserProfileResponse


def serialize_user(user: User) -> UserProfileResponse:
    """Formats User model into a safe user profile response object."""
    if user.role == "admin":
        screens = ALL_SCREEN_KEYS
    else:
        screens = normalize_screens(user.accessible_screens)

    return UserProfileResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        accessible_screens=screens,
        is_active=user.is_active,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates credentials using Email ID or Username, and issues a bearer session token."""
    repo = UserRepository(db)
    identifier = payload.email or payload.username
    if not identifier or not identifier.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ID or Username is required.",
        )

    user = repo.get_by_identifier(identifier.strip())

    if not user or not verify_password(payload.password, user.salt, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email ID or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated. Please contact an administrator.",
        )

    session_obj = repo.create_session(user.id)
    return LoginResponse(
        token=session_obj.token,
        user=serialize_user(user),
    )


@router.get("/me", response_model=UserProfileResponse)
def get_current_profile(current_user: User = Depends(get_current_user)):
    """Returns profile and assigned accessible screens for the active session."""
    return serialize_user(current_user)


@router.post("/logout")
def logout(
    token_str: Optional[str] = Depends(get_token_from_header_or_query),
    db: Session = Depends(get_db),
):
    """Invalidates the active user session token."""
    if token_str:
        repo = UserRepository(db)
        repo.delete_session(token_str)
    return {"success": True, "message": "Successfully logged out."}
