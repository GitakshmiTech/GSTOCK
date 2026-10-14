"""MongoDB status and synchronization endpoints."""

from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel
from typing import Optional

from nse_pipeline.cli.mongo_sync import launch_compass_app
from nse_pipeline.database.mongo import get_mongo_stats
from nse_pipeline.services.mongo_sync_service import MongoSyncService

router = APIRouter(prefix="/api/v1/mongo", tags=["MongoDB & Compass"])


class MongoSyncRequest(BaseModel):
    sync_all: bool = False
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    symbols: Optional[list[str]] = None


@router.get("/status")
def get_mongodb_status():
    """Retrieve connection status, database info, and document counts for MongoDB Compass."""
    return get_mongo_stats()


@router.post("/launch-compass")
def trigger_launch_compass():
    """Launches the MongoDB Compass application on the local desktop."""
    try:
        launch_compass_app()
        return {"status": "success", "message": "MongoDB Compass launched."}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.post("/sync")
def trigger_mongo_sync(req: MongoSyncRequest, background_tasks: BackgroundTasks):
    """Triggers background synchronization of SQL records into MongoDB collections."""
    def run_sync():
        service = MongoSyncService()
        service.sync_securities()
        service.sync_trading_calendar()
        effective_start = req.start_date if (req.start_date or req.sync_all or req.symbols) else "2025-01-01"
        service.sync_stock_history(
            start_date=effective_start,
            end_date=req.end_date,
            symbols=req.symbols,
        )

    background_tasks.add_task(run_sync)
    return {
        "status": "queued",
        "message": "MongoDB synchronization started in background.",
        "compass_uri": "mongodb://localhost:27017",
        "database": "nse_market_data",
    }
