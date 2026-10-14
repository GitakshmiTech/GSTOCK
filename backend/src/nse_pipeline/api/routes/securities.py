"""Endpoints for querying the Security Master."""


from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from nse_pipeline.api.dependencies import get_db
from nse_pipeline.api.schemas.prices import SecuritySchema
from nse_pipeline.database.repositories.security_repository import SecurityRepository

router = APIRouter(prefix="/api/v1/securities", tags=["Securities"])


@router.get("", response_model=list[SecuritySchema])
def search_securities(
    q: str = Query(default="", description="Search symbol or company name"),
    limit: int = Query(default=5000, le=10000),
    db: Session = Depends(get_db),
):
    """Search registered securities in the security master."""
    repo = SecurityRepository(db)
    return repo.search(query=q, limit=limit)
