"""User repository and credential management for Role-Based Access Control."""

import hashlib
import json
import logging
import secrets
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from nse_pipeline.database.models import User, UserSession

logger = logging.getLogger("nse_pipeline.database.repositories.user_repository")

# Standard screen keys configured in the platform
AVAILABLE_SCREENS: list[dict[str, str]] = [
    {
        "key": "dashboard",
        "label": "Main Dashboard",
        "description": "Market overview, active indices and top movers",
    },
    {
        "key": "daily-ohlc",
        "label": "All Stocks Daily OHLC",
        "description": "Daily market prices across all NSE stocks (Open, High, Low, Close, Volume, % Change)",
    },
    {
        "key": "explorer",
        "label": "Stock Explorer",
        "description": "Interactive OHLCV charts, volume & technical metrics",
    },
    {
        "key": "seasonality",
        "label": "Seasonal Analysis",
        "description": "Monthly and yearly returns probability matrix and seasonal curves",
    },
    {
        "key": "comparison",
        "label": "Stock Comparison",
        "description": "Multi-stock normalized performance and return comparison",
    },
    {
        "key": "data-mgmt",
        "label": "Data Management",
        "description": "Manual backfill, sync history logs, and 4:00 PM automated scheduler",
    },
    {
        "key": "users",
        "label": "User Management",
        "description": "Admin console for user creation, roles, and screen permissions",
    },
    {
        "key": "settings",
        "label": "System Settings",
        "description": "Backend diagnostics, database pool info, and scheduler configuration",
    },
]

ALL_SCREEN_KEYS: list[str] = [s["key"] for s in AVAILABLE_SCREENS]


def hash_password(password: str, salt: Optional[str] = None) -> tuple[str, str]:
    """Generates PBKDF2-HMAC-SHA256 hash using a 16-byte random salt."""
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations=100_000,
    ).hex()
    return hashed, salt


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    """Verifies a plain password against the stored salt and hash securely."""
    hashed, _ = hash_password(password, salt)
    return secrets.compare_digest(hashed, expected_hash)


def normalize_screens(screens: Any) -> list[str]:
    """Normalizes JSON or list screen values into a python list of strings."""
    if screens is None:
        return []
    if isinstance(screens, str):
        try:
            parsed = json.loads(screens)
            if isinstance(parsed, list):
                return [str(s) for s in parsed]
        except Exception:
            return [screens]
    if isinstance(screens, (list, tuple, set)):
        return [str(s) for s in screens]
    return []


class UserRepository:
    """Repository handling CRUD and auth token sessions for platform users."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def get_by_id(self, user_id: int) -> Optional[User]:
        """Fetch user by primary key."""
        stmt = select(User).where(User.id == user_id)
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_username(self, username: str) -> Optional[User]:
        """Fetch user by username (case-insensitive)."""
        clean_username = username.strip().lower()
        stmt = select(User).where(User.username.ilike(clean_username))
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_email(self, email: str) -> Optional[User]:
        """Fetch user by email (case-insensitive)."""
        clean_email = email.strip().lower()
        stmt = select(User).where(User.email.ilike(clean_email))
        return self.session.execute(stmt).scalar_one_or_none()

    def get_by_identifier(self, identifier: str) -> Optional[User]:
        """Fetch user by either email or username."""
        clean = identifier.strip().lower()
        if "@" in clean:
            user = self.get_by_email(clean)
            if user:
                return user
        user = self.get_by_username(clean)
        if user:
            return user
        return self.get_by_email(clean)

    def list_users(self) -> list[User]:
        """List all users sorted by ID."""
        stmt = select(User).order_by(User.id.asc())
        return list(self.session.execute(stmt).scalars().all())

    def create_user(
        self,
        username: str,
        password: str,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        role: str = "user",
        accessible_screens: Optional[list[str]] = None,
        is_active: bool = True,
    ) -> User:
        """Creates and persists a new user with hashed credentials."""
        clean_username = username.strip().lower()
        clean_email = email.strip().lower() if email and email.strip() else f"{clean_username}@nse.com"

        existing_uname = self.get_by_username(clean_username)
        if existing_uname:
            raise ValueError(f"Username '{clean_username}' already exists.")

        existing_email = self.get_by_email(clean_email)
        if existing_email:
            raise ValueError(f"Email '{clean_email}' is already registered.")

        pwd_hash, salt = hash_password(password)

        if role == "admin":
            screens = ALL_SCREEN_KEYS
        else:
            screens = [s for s in (accessible_screens or []) if s in ALL_SCREEN_KEYS]

        user = User(
            username=clean_username,
            email=clean_email,
            full_name=full_name.strip() if full_name else clean_username.title(),
            password_hash=pwd_hash,
            salt=salt,
            role="admin" if role.lower() == "admin" else "user",
            accessible_screens=screens,
            is_active=is_active,
        )
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        logger.info(f"Created new user '{user.username}' ({user.email}) with role '{user.role}'")
        return user

    def update_user(
        self,
        user_id: int,
        email: Optional[str] = None,
        full_name: Optional[str] = None,
        password: Optional[str] = None,
        role: Optional[str] = None,
        accessible_screens: Optional[list[str]] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[User]:
        """Updates user properties, email, role, screen permissions or password."""
        user = self.get_by_id(user_id)
        if not user:
            return None

        if email is not None and email.strip():
            clean_email = email.strip().lower()
            existing = self.get_by_email(clean_email)
            if existing and existing.id != user.id:
                raise ValueError(f"Email '{clean_email}' is already used by another account.")
            user.email = clean_email

        if full_name is not None:
            user.full_name = full_name.strip()

        if password is not None and password.strip():
            pwd_hash, salt = hash_password(password.strip())
            user.password_hash = pwd_hash
            user.salt = salt

        if role is not None:
            user.role = "admin" if role.lower() == "admin" else "user"

        if accessible_screens is not None:
            if user.role == "admin":
                user.accessible_screens = ALL_SCREEN_KEYS
            else:
                user.accessible_screens = [s for s in accessible_screens if s in ALL_SCREEN_KEYS]

        if is_active is not None:
            user.is_active = is_active

        self.session.commit()
        self.session.refresh(user)
        logger.info(f"Updated user ID {user_id} ('{user.username}')")
        return user

    def delete_user(self, user_id: int) -> bool:
        """Deletes user if not the only active admin."""
        user = self.get_by_id(user_id)
        if not user:
            return False

        if user.role == "admin":
            admin_count = self.session.query(User).filter(User.role == "admin", User.is_active == True).count()
            if admin_count <= 1:
                raise ValueError("Cannot delete the only remaining active Administrator.")

        self.session.delete(user)
        self.session.commit()
        logger.info(f"Deleted user ID {user_id} ('{user.username}')")
        return True

    def create_session(self, user_id: int, expires_at: Optional[datetime] = None) -> UserSession:
        """Generates a secure bearer token session for the user."""
        token = secrets.token_urlsafe(48)
        session_obj = UserSession(
            token=token,
            user_id=user_id,
            expires_at=expires_at,
        )
        self.session.add(session_obj)
        self.session.commit()
        self.session.refresh(session_obj)
        return session_obj

    def get_user_by_token(self, token: str) -> Optional[User]:
        """Finds user associated with active token."""
        stmt = (
            select(User)
            .join(UserSession, UserSession.user_id == User.id)
            .where(UserSession.token == token)
            .where(User.is_active == True)
        )
        return self.session.execute(stmt).scalar_one_or_none()

    def delete_session(self, token: str) -> bool:
        """Invalidates a session token upon logout."""
        stmt = select(UserSession).where(UserSession.token == token)
        session_obj = self.session.execute(stmt).scalar_one_or_none()
        if session_obj:
            self.session.delete(session_obj)
            self.session.commit()
            return True
        return False

    def seed_default_admin(self) -> User:
        """Seeds default admin ('admin@nse.com' / 'admin123') if no admin user exists."""
        admin = self.session.query(User).filter(User.role == "admin").first()
        if admin:
            if not admin.email:
                admin.email = "admin@nse.com"
                self.session.commit()
            return admin

        logger.info("No admin user found. Auto-seeding default administrator account ('admin@nse.com').")
        default_admin = self.create_user(
            username="admin",
            email="admin@nse.com",
            password="admin123",
            full_name="Default Administrator",
            role="admin",
            accessible_screens=ALL_SCREEN_KEYS,
            is_active=True,
        )
        return default_admin
