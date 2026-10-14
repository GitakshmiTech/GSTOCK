"""Integration tests for Dashboard and Analytics endpoints."""

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from nse_pipeline.api.app import app
from nse_pipeline.api.dependencies import get_db
from nse_pipeline.database.bulk_upsert import bulk_upsert_stock_history
from nse_pipeline.database.repositories.security_repository import SecurityRepository


def test_dashboard_and_analytics_flow(test_db_session: Session):
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    # 1. Seed sample multi-day history
    sec_repo = SecurityRepository(test_db_session)
    s1 = sec_repo.get_or_create("RELIANCE", "EQ", company_name="Reliance Industries Ltd")
    s2 = sec_repo.get_or_create("TCS", "EQ", company_name="Tata Consultancy Services")

    records = [
        # RELIANCE
        {
            "trade_date": date(2024, 1, 5), "security_id": s1.id, "symbol": "RELIANCE", "series": "EQ",
            "open_price": 2800.0, "high_price": 2850.0, "low_price": 2790.0, "close_price": 2840.0,
            "prev_close": 2800.0, "traded_quantity": 100000, "turnover": 284000000.0,
            "source_format": "legacy_bhavcopy", "source_file": "sample.csv"
        },
        {
            "trade_date": date(2024, 7, 8), "security_id": s1.id, "symbol": "RELIANCE", "series": "EQ",
            "open_price": 3000.0, "high_price": 3050.0, "low_price": 2990.0, "close_price": 3020.0,
            "prev_close": 2840.0, "traded_quantity": 120000, "turnover": 362400000.0,
            "source_format": "udiff_bhavcopy", "source_file": "sample.csv"
        },
        # TCS
        {
            "trade_date": date(2024, 1, 5), "security_id": s2.id, "symbol": "TCS", "series": "EQ",
            "open_price": 3700.0, "high_price": 3750.0, "low_price": 3690.0, "close_price": 3740.0,
            "prev_close": 3700.0, "traded_quantity": 80000, "turnover": 299200000.0,
            "source_format": "legacy_bhavcopy", "source_file": "sample.csv"
        },
        {
            "trade_date": date(2024, 7, 8), "security_id": s2.id, "symbol": "TCS", "series": "EQ",
            "open_price": 3900.0, "high_price": 3950.0, "low_price": 3890.0, "close_price": 3920.0,
            "prev_close": 3740.0, "traded_quantity": 90000, "turnover": 352800000.0,
            "source_format": "udiff_bhavcopy", "source_file": "sample.csv"
        },
    ]

    bulk_upsert_stock_history(test_db_session, records)
    test_db_session.commit()

    # 2. Test Dashboard Summary
    res_dash = client.get("/api/v1/dashboard/summary")
    assert res_dash.status_code == 200
    d_data = res_dash.json()
    assert d_data["latest_date"] == "2024-07-08"
    assert d_data["total_securities_count"] >= 2
    assert len(d_data["top_gainers"]) >= 1

    # 3. Test Stock Explorer prices with indicators
    res_prices = client.get("/api/v1/stocks/RELIANCE/prices")
    assert res_prices.status_code == 200
    p_data = res_prices.json()
    assert p_data["symbol"] == "RELIANCE"
    assert len(p_data["data"]) == 2
    assert "sma_20" in p_data["data"][0]

    # 4. Test Seasonality
    res_seas = client.get("/api/v1/analytics/seasonality/RELIANCE")
    assert res_seas.status_code == 200
    s_data = res_seas.json()
    assert "monthly_averages" in s_data
    assert "heatmap" in s_data

    # 5. Test Comparison
    res_comp = client.get("/api/v1/analytics/compare?symbols=RELIANCE,TCS")
    assert res_comp.status_code == 200
    c_data = res_comp.json()
    assert len(c_data["summary"]) == 2
    assert "RELIANCE" in c_data["series"]
    assert "TCS" in c_data["series"]

    # 6. Test HTML Terminal rendering
    res_html = client.get("/dashboard")
    assert res_html.status_code == 200
    assert "NSE Market Intelligence Terminal" in res_html.text
