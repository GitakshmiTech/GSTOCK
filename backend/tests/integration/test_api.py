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


def test_api_securities_shares_only_filters_etfs(test_db_session: Session):
    """Verifies that securities endpoint filters out ETFs and mutual funds by default."""
    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    sec_repo = SecurityRepository(test_db_session)
    sec_repo.get_or_create("HDFCBANK", "EQ", company_name="HDFC Bank Limited", isin="INE040A01034")
    sec_repo.get_or_create("HDFCAMC", "EQ", company_name="HDFC Asset Management Company Limited", isin="INE127D01025")
    sec_repo.get_or_create("HDFCBSE500", "EQ", company_name="HDFC BSE 500 ETF", isin="INF179KC1EZ4")
    sec_repo.get_or_create("HDFCGOLD", "EQ", company_name="HDFC Gold ETF", isin="INF179KC1981")

    # Also create NCDs and Rights Entitlements
    sec_repo.get_or_create("1035UCL26", "EQ", company_name="Sec Re Ncd 10.35% Sr Iii", isin="INE583D07448")
    sec_repo.get_or_create("3IINFO-RE", "BE", company_name="3I Infotech Ltd", isin="INE748C20012")
    sec_repo.get_or_create("3IINFOLTD", "EQ", company_name="3i Infotech Limited", isin="INE748C01038")

    # Default query (shares_only=true) returns only company shares, not ETFs, NCDs, or REs
    res_shares = client.get("/api/v1/securities?q=HDFC")
    assert res_shares.status_code == 200
    shares_data = res_shares.json()
    symbols = [s["symbol"] for s in shares_data]
    assert "HDFCBANK" in symbols
    assert "HDFCAMC" in symbols
    assert "HDFCBSE500" not in symbols
    assert "HDFCGOLD" not in symbols

    # Check that NCDs and Rights Entitlements are excluded
    res_3i = client.get("/api/v1/securities?q=3IINFO")
    assert res_3i.status_code == 200
    symbols_3i = [s["symbol"] for s in res_3i.json()]
    assert "3IINFOLTD" in symbols_3i
    assert "3IINFO-RE" not in symbols_3i

    # Also create closed-ended mutual fund schemes
    sec_repo.get_or_create("FTCSF3YDIV", "EQ", company_name=None, isin=None)
    sec_repo.get_or_create("UTIUS64-CI", "EQ", company_name="Utius64-ci Limited", isin=None)

    res_ncd = client.get("/api/v1/securities?q=1035UCL26")
    assert res_ncd.status_code == 200
    assert len(res_ncd.json()) == 0

    res_ftc = client.get("/api/v1/securities?q=FTCSF")
    assert res_ftc.status_code == 200
    assert len(res_ftc.json()) == 0

    res_uti = client.get("/api/v1/securities?q=UTIUS64")
    assert res_uti.status_code == 200
    assert len(res_uti.json()) == 0

    # Explicit shares_only=false returns all securities including ETFs, NCDs, and REs
    res_all = client.get("/api/v1/securities?q=HDFC&shares_only=false")
    assert res_all.status_code == 200
    all_symbols = [s["symbol"] for s in res_all.json()]
    assert "HDFCBANK" in all_symbols
    assert "HDFCAMC" in all_symbols
    assert "HDFCBSE500" in all_symbols
    assert "HDFCGOLD" in all_symbols


def test_api_symbol_aliases_and_3m_continuity(test_db_session: Session):
    """Test that historical renamings like BIRLA3M -> 3MINDIA combine prices and exclude unrelated ISINs."""
    from datetime import date
    from nse_pipeline.database.repositories.security_repository import SecurityRepository
    from nse_pipeline.database.repositories.price_repository import PriceRepository

    app.dependency_overrides[get_db] = lambda: test_db_session
    client = TestClient(app)

    sec_repo = SecurityRepository(test_db_session)
    sec_3m = sec_repo.get_or_create("3MINDIA", "EQ", company_name="3M India Limited", isin="INE470A01017")
    sec_birla = sec_repo.get_or_create("BIRLA3M", "EQ", company_name="3M India Limited", isin=None)
    # Unrelated security whose ISIN happens to contain '3M'
    sec_repo.get_or_create("MERCURYEV", "EQ", company_name="Mercury Ev-Tech Limited", isin="INE763M01028")

    price_repo = PriceRepository(test_db_session)
    price_repo.bulk_upsert(
        [
            {
                "trade_date": date(2002, 5, 10),
                "security_id": sec_birla.id,
                "symbol": "BIRLA3M",
                "series": "EQ",
                "open_price": 500.0,
                "high_price": 510.0,
                "low_price": 490.0,
                "close_price": 505.0,
                "prev_close": 500.0,
                "traded_quantity": 1000,
                "turnover": 505000.0,
                "source_format": "udiff_bhavcopy",
                "source_file": "bhav2002.csv",
            },
            {
                "trade_date": date(2005, 8, 12),
                "security_id": sec_3m.id,
                "symbol": "3MINDIA",
                "series": "EQ",
                "open_price": 800.0,
                "high_price": 820.0,
                "low_price": 790.0,
                "close_price": 810.0,
                "prev_close": 800.0,
                "traded_quantity": 2000,
                "turnover": 1620000.0,
                "source_format": "udiff_bhavcopy",
                "source_file": "bhav2005.csv",
            },
        ]
    )
    test_db_session.commit()

    # 1. Search '3M' should return 3MINDIA and BIRLA3M, but NOT MERCURYEV
    res_search = client.get("/api/v1/securities?q=3M")
    assert res_search.status_code == 200
    search_syms = [s["symbol"] for s in res_search.json()]
    assert "3MINDIA" in search_syms
    assert "MERCURYEV" not in search_syms

    # 2. Stock price history for 3MINDIA should seamlessly include BIRLA3M from 2002
    res_prices = client.get("/api/v1/stocks/3MINDIA/prices")
    assert res_prices.status_code == 200
    prices_data = res_prices.json()
    data_points = prices_data.get("prices") or prices_data.get("data")
    assert len(data_points) == 2
    dates = [p["trade_date"] for p in data_points]
    assert "2002-05-10" in dates
    assert "2005-08-12" in dates
