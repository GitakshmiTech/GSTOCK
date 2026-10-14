"""User and Role Management administrative endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db, require_admin
from nse_pipeline.database.models import User
from nse_pipeline.database.repositories.user_repository import (
    ALL_SCREEN_KEYS,
    AVAILABLE_SCREENS,
    UserRepository,
    normalize_screens,
)

router = APIRouter(prefix="/api/v1/users", tags=["User Management"])


class ScreenDefinition(BaseModel):
    key: str
    label: str
    description: str


class CreateUserRequest(BaseModel):
    email: Optional[str] = Field(None, description="User email address (e.g. trader@example.com)")
    username: Optional[str] = Field(None, description="Unique username (auto-generated from email if not provided)")
    password: str = Field(..., min_length=4, description="User password")
    full_name: Optional[str] = Field(None, description="Display name")
    role: str = Field("user", description="'admin' or 'user'")
    accessible_screens: list[str] = Field(default_factory=list, description="List of screen keys")
    is_active: bool = Field(True, description="Account active status")


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    accessible_screens: Optional[list[str]] = None
    is_active: Optional[bool] = None


class UserDetailResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    full_name: Optional[str]
    role: str
    accessible_screens: list[str]
    is_active: bool
    created_at: Optional[str] = None


def serialize_user_detail(user: User) -> UserDetailResponse:
    if user.role == "admin":
        screens = ALL_SCREEN_KEYS
    else:
        screens = normalize_screens(user.accessible_screens)

    return UserDetailResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        accessible_screens=screens,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.get("/screens", response_model=list[ScreenDefinition])
def get_available_screens():
    """Returns the list of available platform screens with keys and descriptions."""
    return [ScreenDefinition(**s) for s in AVAILABLE_SCREENS]


@router.get("", response_model=list[UserDetailResponse])
def list_users(
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Lists all registered platform users. Accessible by administrators only."""
    repo = UserRepository(db)
    users = repo.list_users()
    return [serialize_user_detail(u) for u in users]


@router.post("", response_model=UserDetailResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: CreateUserRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Creates a new user with Email ID and assigns screen access permissions. Admin only."""
    repo = UserRepository(db)

    # Derive username from email if not given, or email from username
    uname = (payload.username or "").strip()
    email_val = (payload.email or "").strip()

    if not uname and email_val:
        uname = email_val.split("@")[0].lower()
    elif not uname and not email_val:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either Email ID or Username must be provided.",
        )

    try:
        new_user = repo.create_user(
            username=uname,
            email=email_val if email_val else None,
            password=payload.password,
            full_name=payload.full_name,
            role=payload.role,
            accessible_screens=payload.accessible_screens,
            is_active=payload.is_active,
        )
        return serialize_user_detail(new_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.put("/{user_id}", response_model=UserDetailResponse)
def update_user(
    user_id: int,
    payload: UpdateUserRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Updates user information, email, credentials, roles, or screen permissions. Admin only."""
    repo = UserRepository(db)
    try:
        updated = repo.update_user(
            user_id=user_id,
            email=payload.email,
            full_name=payload.full_name,
            password=payload.password,
            role=payload.role,
            accessible_screens=payload.accessible_screens,
            is_active=payload.is_active,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return serialize_user_detail(updated)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Deletes a user account. Cannot delete the last active administrator."""
    repo = UserRepository(db)
    try:
        success = repo.delete_user(user_id)
        if not success:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")
        return {"success": True, "message": f"User ID {user_id} deleted successfully."}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
