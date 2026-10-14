"""Integration tests for FastAPI endpoints."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from nse_pipeline.api.app import app
from nse_pipeline.api.dependencies import get_db
from nse_pipeline.database.bulk_upsert import bulk_upsert_stock_history
from nse_pipeline.database.repositories.security_repository import SecurityRepository


def test_api_health(test_db_session: Session):
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    db_response = client.get("/health/database")
    assert db_response.status_code == 200
    assert db_response.json()["database"] == "connected"


def test_api_query_prices_and_securities(test_db_session: Session):
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    # Insert sample data
    sec_repo = SecurityRepository(test_db_session)
    sec = sec_repo.get_or_create("INFY", "EQ", company_name="Infosys Limited", isin="INE009A01021")

    bulk_upsert_stock_history(
        test_db_session,
        [{
            "trade_date": date(2024, 7, 8),
            "security_id": sec.id,
            "symbol": "INFY",
            "series": "EQ",
            "open_price": 1640.0,
            "high_price": 1665.0,
            "low_price": 1635.0,
            "close_price": 1658.20,
            "prev_close": 1630.0,
            "vwap": 1655.0,
            "traded_quantity": 3400000,
            "turnover": 5630000000.0,
            "source_format": "udiff_bhavcopy",
            "source_file": "sample.csv",
        }],
    )
    test_db_session.commit()

    # Query prices endpoint
    res_prices = client.get("/api/v1/prices/INFY")
    assert res_prices.status_code == 200
    data = res_prices.json()
    assert len(data) == 1
    assert data[0]["symbol"] == "INFY"
    assert data[0]["close_price"] == 1658.20

    # Query securities search endpoint
    res_sec = client.get("/api/v1/securities?q=Infosys")
    assert res_sec.status_code == 200
    sec_data = res_sec.json()
    assert len(sec_data) >= 1
    assert sec_data[0]["symbol"] == "INFY"
    assert sec_data[0]["company_name"] == "Infosys Limited"


def test_api_daily_market_ohlc(test_db_session: Session):
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    sec_repo = SecurityRepository(test_db_session)
    sec_tcs = sec_repo.get_or_create("TCS", "EQ", company_name="Tata Consultancy Services", isin="INE467B01029")
    sec_infy = sec_repo.get_or_create("INFY", "EQ", company_name="Infosys Limited", isin="INE009A01021")

    bulk_upsert_stock_history(
        test_db_session,
        [
            {
                "trade_date": date(2026, 10, 9),
                "security_id": sec_tcs.id,
                "symbol": "TCS",
                "series": "EQ",
                "open_price": 2086.0,
                "high_price": 2204.0,
                "low_price": 2086.0,
                "close_price": 2156.0,
                "prev_close": 2076.0,
                "last_price": 2156.0,
                "vwap": 2168.0,
                "traded_quantity": 1000000,
                "turnover": 2156000000.0,
                "source_format": "udiff_bhavcopy",
                "source_file": "sample.csv",
            },
            {
                "trade_date": date(2026, 10, 9),
                "security_id": sec_infy.id,
                "symbol": "INFY",
                "series": "EQ",
                "open_price": 1000.0,
                "high_price": 1020.0,
                "low_price": 990.0,
                "close_price": 995.0,
                "prev_close": 1000.0,
                "last_price": 995.0,
                "vwap": 1005.0,
                "traded_quantity": 500000,
                "turnover": 500000000.0,
                "source_format": "udiff_bhavcopy",
                "source_file": "sample.csv",
            },
        ],
    )
    test_db_session.commit()

    res = client.get("/api/v1/prices/daily-market?trade_date=2026-10-09")
    assert res.status_code == 200
    data = res.json()

    assert data["trade_date"] == "2026-10-09"
    assert data["summary"]["total_stocks"] == 2
    assert data["summary"]["advances"] == 1  # TCS (2156 > 2076)
    assert data["summary"]["declines"] == 1  # INFY (995 < 1000)
    assert data["total_count"] == 2
    assert len(data["items"]) == 2

    # Check that OHLC fields are returned correctly
    tcs = next(item for item in data["items"] if item["symbol"] == "TCS")
    assert tcs["open_price"] == 2086.0
    assert tcs["high_price"] == 2204.0
    assert tcs["low_price"] == 2086.0
    assert tcs["close_price"] == 2156.0
    assert tcs["prev_close"] == 2076.0
    assert tcs["change"] == 80.0
    assert round(tcs["change_pct"], 2) == 3.85
    assert tcs["company_name"] == "Tata Consultancy Services"


def test_api_icici_alias_and_resolution(test_db_session: Session):
    """Test that querying ICICI seamlessly aliases to ICICIBANK with full historical dataset and priority."""
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    sec_repo = SecurityRepository(test_db_session)
    # Create legacy ICICI and active ICICIBANK
    sec_legacy = sec_repo.get_or_create("ICICI", "EQ", company_name="ICICI Limited")
    sec_legacy.last_traded_date = date(2002, 5, 30)

    sec_bank = sec_repo.get_or_create("ICICIBANK", "EQ", company_name="ICICI Bank Limited")
    sec_bank.last_traded_date = date(2026, 10, 12)

    bulk_upsert_stock_history(
        test_db_session,
        [
            {
                "trade_date": date(2026, 10, 12),
                "security_id": sec_bank.id,
                "symbol": "ICICIBANK",
                "series": "EQ",
                "open_price": 1335.0,
                "high_price": 1345.0,
                "low_price": 1330.0,
                "close_price": 1340.0,
                "prev_close": 1330.0,
                "vwap": 1338.0,
                "traded_quantity": 5000000,
                "turnover": 6700000000.0,
                "source_format": "udiff_bhavcopy",
                "source_file": "sample.csv",
            }
        ],
    )
    test_db_session.commit()

    # 1. Querying prices for ICICI returns ICICIBANK data
    res_prices = client.get("/api/v1/prices/ICICI")
    assert res_prices.status_code == 200
    prices = res_prices.json()
    assert len(prices) == 1
    assert prices[0]["symbol"] == "ICICIBANK"
    assert prices[0]["close_price"] == 1340.0

    # 2. Querying stock history for ICICI returns ICICIBANK indicators
    res_stock = client.get("/api/v1/stocks/ICICI/prices")
    assert res_stock.status_code == 200
    stock_data = res_stock.json()
    assert stock_data["records_count"] == 1
    assert stock_data["data"][0]["close"] == 1340.0

    # 3. Querying securities for ICICI prioritizes active ICICIBANK
    res_sec = client.get("/api/v1/securities?q=ICICI")
    assert res_sec.status_code == 200
    sec_list = res_sec.json()
    assert len(sec_list) >= 2
    assert sec_list[0]["symbol"] == "ICICIBANK"
    assert sec_list[0]["company_name"] == "ICICI Bank Limited"


