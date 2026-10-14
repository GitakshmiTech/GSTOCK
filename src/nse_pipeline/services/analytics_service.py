"""Financial analytics service for technical indicators, returns, seasonality and drawdowns."""

from datetime import date
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.repositories.price_repository import PriceRepository

logger = get_logger("services.analytics")


class AnalyticsService:
    def __init__(self, session: Session):
        self.session = session
        self.price_repo = PriceRepository(session)

    def get_stock_prices_with_indicators(
        self,
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        series: str = "EQ",
    ) -> Dict[str, Any]:
        """Calculates daily returns, SMA-20, SMA-50, and SMA-200 for a stock."""
        records = self.price_repo.get_prices(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            series=series,
            limit=100000,
        )
        if not records:
            return {"symbol": symbol, "data": [], "prices": [], "summary": {}}

        df = pd.DataFrame([
            {
                "trade_date": r.trade_date.isoformat(),
                "open": float(r.open_price) if r.open_price is not None else None,
                "high": float(r.high_price) if r.high_price is not None else None,
                "low": float(r.low_price) if r.low_price is not None else None,
                "close": float(r.close_price) if r.close_price is not None else None,
                "volume": int(r.traded_quantity) if r.traded_quantity is not None else 0,
                "turnover": float(r.turnover) if r.turnover is not None else 0.0,
                "prev_close": float(r.prev_close) if r.prev_close is not None else None,
            }
            for r in records
        ])

        # Calculate daily returns
        df["daily_return"] = df["close"].pct_change() * 100.0

        # Moving averages
        df["sma_20"] = df["close"].rolling(window=20, min_periods=1).mean()
        df["sma_50"] = df["close"].rolling(window=50, min_periods=1).mean()
        df["sma_200"] = df["close"].rolling(window=200, min_periods=1).mean()

        # Cumulative return
        first_close = df["close"].dropna().iloc[0] if not df["close"].dropna().empty else 1.0
        df["cumulative_return"] = ((df["close"] / first_close) - 1.0) * 100.0

        # Drawdowns
        rolling_max = df["close"].cummax()
        df["drawdown"] = ((df["close"] - rolling_max) / rolling_max) * 100.0

        # Summary statistics
        clean_returns = df["daily_return"].dropna()
        annualized_volatility = (
            float(clean_returns.std() * np.sqrt(252)) if len(clean_returns) > 1 else 0.0
        )
        max_drawdown = float(df["drawdown"].min()) if not df["drawdown"].empty else 0.0
        total_return = (
            float(((df["close"].iloc[-1] / first_close) - 1.0) * 100.0) if len(df) > 0 else 0.0
        )

        # Replace NaN with None for JSON serialization
        records_out = df.replace({np.nan: None}).to_dict(orient="records")
        end_date_str = df["trade_date"].iloc[-1] if len(df) > 0 else None
        is_delisted = bool(end_date_str and end_date_str < "2026-07-15")
        is_active = not is_delisted
        status = "DELISTED" if is_delisted else "ACTIVE"
        status_message = (
            f"Delisted / Inactive on NSE. Last traded on {end_date_str}."
            if is_delisted
            else None
        )

        return {
            "symbol": symbol.upper(),
            "series": series.upper(),
            "records_count": len(records_out),
            "is_active": is_active,
            "is_delisted": is_delisted,
            "status": status,
            "status_message": status_message,
            "summary": {
                "latest_close": df["close"].iloc[-1] if len(df) > 0 else None,
                "total_return_pct": round(total_return, 2),
                "annualized_volatility_pct": round(annualized_volatility, 2),
                "max_drawdown_pct": round(max_drawdown, 2),
                "start_date": df["trade_date"].iloc[0] if len(df) > 0 else None,
                "end_date": end_date_str,
                "is_active": is_active,
                "is_delisted": is_delisted,
                "status": status,
                "status_message": status_message,
            },
            "data": records_out,
            "prices": records_out,
        }

    def calculate_seasonality(
        self,
        symbol: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        start_year: Optional[int] = None,
        end_year: Optional[int] = None,
        series: str = "EQ",
    ) -> Dict[str, Any]:
        """Calculates monthly returns, monthly averages, win rates, and quarterly returns with optional date/year filters."""
        records = self.price_repo.get_prices(
            symbol=symbol,
            start_date=start_date,
            end_date=end_date,
            series=series,
            limit=100000,
        )
        if not records:
            return {"symbol": symbol, "monthly_averages": {}, "heatmap": [], "win_rates": {}}

        df = pd.DataFrame([
            {
                "trade_date": pd.to_datetime(r.trade_date),
                "close": float(r.close_price) if r.close_price is not None else None,
            }
            for r in records
        ]).dropna(subset=["close"])

        if df.empty:
            return {"symbol": symbol, "monthly_averages": {}, "heatmap": [], "win_rates": {}}

        df["year"] = df["trade_date"].dt.year
        df["month"] = df["trade_date"].dt.month
        df["quarter"] = df["trade_date"].dt.quarter
        df["day_name"] = df["trade_date"].dt.day_name()
        df["week"] = df["trade_date"].dt.isocalendar().week

        if start_year is not None:
            df = df[df["year"] >= int(start_year)]
        if end_year is not None:
            df = df[df["year"] <= int(end_year)]

        if df.empty:
            return {"symbol": symbol, "monthly_averages": {}, "heatmap": [], "win_rates": {}}

        # Monthly return: (last close in month - first close in month) / first close in month * 100
        monthly_groups = df.groupby(["year", "month"])
        monthly_returns_list = []

        for (yr, mo), group in monthly_groups:
            first_p = group.sort_values("trade_date").iloc[0]["close"]
            last_p = group.sort_values("trade_date").iloc[-1]["close"]
            ret = ((last_p / first_p) - 1.0) * 100.0 if first_p > 0 else 0.0
            monthly_returns_list.append({
                "year": int(yr),
                "month": int(mo),
                "return_pct": round(float(ret), 2),
            })

        m_df = pd.DataFrame(monthly_returns_list)
        if m_df.empty:
            return {
                "symbol": symbol,
                "monthly_averages": {},
                "monthly_seasonality": {},
                "heatmap": [],
                "win_rates": {},
                "monthly": {"columns": [], "rows": [], "average": {}, "median": {}, "win_rates": {}},
                "quarterly": {"columns": [], "rows": [], "average": {}, "median": {}, "win_rates": {}},
            }

        full_month_names = {
            1: "January", 2: "February", 3: "March", 4: "April", 5: "May", 6: "June",
            7: "July", 8: "August", 9: "September", 10: "October", 11: "November", 12: "December"
        }
        short_month_names = {
            1: "Jan", 2: "Feb", 3: "Mar", 4: "Apr", 5: "May", 6: "Jun",
            7: "Jul", 8: "Aug", 9: "Sep", 10: "Oct", 11: "Nov", 12: "Dec"
        }

        # Monthly summary metrics
        monthly_avg = m_df.groupby("month")["return_pct"].mean().round(2).to_dict()
        monthly_med = m_df.groupby("month")["return_pct"].median().round(2).to_dict()

        monthly_averages_short = {short_month_names[m]: monthly_avg.get(m, 0.0) for m in range(1, 13)}
        monthly_averages_full = {full_month_names[m]: monthly_avg.get(m, 0.0) for m in range(1, 13)}
        monthly_medians_full = {full_month_names[m]: monthly_med.get(m, 0.0) for m in range(1, 13)}
        monthly_win_rates_full = {}
        win_rates_dict = {}

        for m in range(1, 13):
            sub = m_df[m_df["month"] == m]
            if len(sub) > 0:
                pos_count = (sub["return_pct"] > 0).sum()
                rate = round((pos_count / len(sub)) * 100.0, 1)
            else:
                rate = 0.0
            monthly_win_rates_full[full_month_names[m]] = rate
            win_rates_dict[short_month_names[m]] = {
                "positive_pct": rate,
                "total_years": int(len(sub)),
            }

        # Monthly rows sorted descending by year
        pivot = m_df.pivot(index="year", columns="month", values="return_pct")
        heatmap = []
        monthly_rows = []
        for yr in sorted(pivot.index, reverse=True):
            row_short = {"year": int(yr)}
            row_full = {"year": int(yr)}
            for mo in range(1, 13):
                val = pivot.loc[yr, mo] if mo in pivot.columns else np.nan
                float_val = round(float(val), 2) if pd.notna(val) else None
                row_short[short_month_names[mo]] = float_val
                row_full[full_month_names[mo]] = float_val
            heatmap.append(row_short)
            monthly_rows.append(row_full)

        # Quarterly returns
        quarterly_groups = df.groupby(["year", "quarter"])
        quarterly_returns_list = []
        for (yr, q), group in quarterly_groups:
            first_p = group.sort_values("trade_date").iloc[0]["close"]
            last_p = group.sort_values("trade_date").iloc[-1]["close"]
            ret = ((last_p / first_p) - 1.0) * 100.0 if first_p > 0 else 0.0
            quarterly_returns_list.append({
                "year": int(yr),
                "quarter": int(q),
                "return_pct": round(float(ret), 2),
            })
        q_df = pd.DataFrame(quarterly_returns_list)
        q_cols = ["Q1", "Q2", "Q3", "Q4"]
        quarterly_rows = []
        quarterly_avg = {}
        quarterly_med = {}
        quarterly_win = {}

        if not q_df.empty:
            q_pivot = q_df.pivot(index="year", columns="quarter", values="return_pct")
            for q in range(1, 5):
                q_sub = q_df[q_df["quarter"] == q]
                q_key = f"Q{q}"
                if len(q_sub) > 0:
                    quarterly_avg[q_key] = round(float(q_sub["return_pct"].mean()), 2)
                    quarterly_med[q_key] = round(float(q_sub["return_pct"].median()), 2)
                    quarterly_win[q_key] = round(float((q_sub["return_pct"] > 0).mean() * 100.0), 1)
                else:
                    quarterly_avg[q_key] = 0.0
                    quarterly_med[q_key] = 0.0
                    quarterly_win[q_key] = 0.0

            for yr in sorted(q_pivot.index, reverse=True):
                q_row = {"year": int(yr)}
                for q in range(1, 5):
                    val = q_pivot.loc[yr, q] if q in q_pivot.columns else np.nan
                    q_row[f"Q{q}"] = round(float(val), 2) if pd.notna(val) else None
                quarterly_rows.append(q_row)

        # Weekly returns (ISO weeks W1..W52)
        df["iso_week"] = df["trade_date"].dt.isocalendar().week
        weekly_groups = df.groupby(["year", "iso_week"])
        weekly_returns_list = []
        for (yr, wk), group in weekly_groups:
            first_p = group.sort_values("trade_date").iloc[0]["close"]
            last_p = group.sort_values("trade_date").iloc[-1]["close"]
            ret = ((last_p / first_p) - 1.0) * 100.0 if first_p > 0 else 0.0
            weekly_returns_list.append({
                "year": int(yr),
                "week": int(wk),
                "return_pct": round(float(ret), 2),
            })
        w_df = pd.DataFrame(weekly_returns_list)
        w_cols = [f"W{i}" for i in range(1, 53)]
        weekly_rows = []
        weekly_avg = {}
        weekly_med = {}
        weekly_win = {}

        if not w_df.empty:
            w_pivot = w_df.pivot(index="year", columns="week", values="return_pct")
            for wk in range(1, 53):
                w_sub = w_df[w_df["week"] == wk]
                w_key = f"W{wk}"
                if len(w_sub) > 0:
                    weekly_avg[w_key] = round(float(w_sub["return_pct"].mean()), 2)
                    weekly_med[w_key] = round(float(w_sub["return_pct"].median()), 2)
                    weekly_win[w_key] = round(float((w_sub["return_pct"] > 0).mean() * 100.0), 1)
                else:
                    weekly_avg[w_key] = 0.0
                    weekly_med[w_key] = 0.0
                    weekly_win[w_key] = 0.0

            for yr in sorted(w_pivot.index, reverse=True):
                w_row = {"year": int(yr)}
                for wk in range(1, 53):
                    val = w_pivot.loc[yr, wk] if wk in w_pivot.columns else np.nan
                    w_row[f"W{wk}"] = round(float(val), 2) if pd.notna(val) else None
                weekly_rows.append(w_row)

        # Weekday returns
        df["daily_return"] = df["close"].pct_change() * 100.0
        weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
        weekday_avg = {}
        weekday_med = {}
        weekday_win = {}
        for wd in weekdays:
            w_sub = df[df["day_name"] == wd]["daily_return"].dropna()
            if len(w_sub) > 0:
                weekday_avg[wd] = round(float(w_sub.mean()), 2)
                weekday_med[wd] = round(float(w_sub.median()), 2)
                weekday_win[wd] = round(float((w_sub > 0).mean() * 100.0), 1)
            else:
                weekday_avg[wd] = 0.0
                weekday_med[wd] = 0.0
                weekday_win[wd] = 0.0

        end_d_str = df["trade_date"].dt.strftime("%Y-%m-%d").iloc[-1] if not df.empty else None
        start_d_str = df["trade_date"].dt.strftime("%Y-%m-%d").iloc[0] if not df.empty else None
        is_delisted = bool(end_d_str and end_d_str < "2026-07-15")
        is_active = not is_delisted
        status = "DELISTED" if is_delisted else "ACTIVE"
        status_message = (
            f"Delisted / Inactive on NSE. Last traded on {end_d_str}."
            if is_delisted
            else None
        )

        return {
            "symbol": symbol.upper(),
            "start_date": start_d_str,
            "end_date": end_d_str,
            "is_active": is_active,
            "is_delisted": is_delisted,
            "status": status,
            "status_message": status_message,
            "monthly_averages": monthly_averages_short,
            "monthly_seasonality": monthly_averages_short,
            "win_rates": win_rates_dict,
            "heatmap": heatmap,
            "monthly": {
                "columns": list(full_month_names.values()),
                "rows": monthly_rows,
                "average": monthly_averages_full,
                "median": monthly_medians_full,
                "win_rates": monthly_win_rates_full,
            },
            "quarterly": {
                "columns": q_cols,
                "rows": quarterly_rows,
                "average": quarterly_avg,
                "median": quarterly_med,
                "win_rates": quarterly_win,
            },
            "weekly": {
                "columns": w_cols,
                "rows": weekly_rows,
                "average": weekly_avg,
                "median": weekly_med,
                "win_rates": weekly_win,
            },
            "weekday": {
                "columns": weekdays,
                "average": weekday_avg,
                "median": weekday_med,
                "win_rates": weekday_win,
            },
        }

    def compare_stocks(
        self,
        symbols: List[str],
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        series: str = "EQ",
    ) -> Dict[str, Any]:
        """Compares multiple stocks, normalizing performance to 100 at base date."""
        comparison_series = {}
        summary_stats = []

        for sym in symbols:
            clean_sym = sym.strip().upper()
            prices = self.price_repo.get_prices(
                symbol=clean_sym,
                start_date=start_date,
                end_date=end_date,
                series=series,
                limit=50000,
            )
            if not prices:
                continue

            df = pd.DataFrame([
                {
                    "trade_date": p.trade_date.isoformat(),
                    "close": float(p.close_price) if p.close_price is not None else None,
                }
                for p in prices
            ]).dropna(subset=["close"])

            if df.empty:
                continue

            # Base 100 normalized performance
            base_p = df["close"].iloc[0]
            df["normalized_price"] = (df["close"] / base_p) * 100.0
            df["daily_return"] = df["close"].pct_change() * 100.0

            # Drawdown
            rolling_max = df["close"].cummax()
            df["drawdown"] = ((df["close"] - rolling_max) / rolling_max) * 100.0

            clean_rets = df["daily_return"].dropna()
            volatility = float(clean_rets.std() * np.sqrt(252)) if len(clean_rets) > 1 else 0.0
            max_dd = float(df["drawdown"].min()) if not df["drawdown"].empty else 0.0
            cum_ret = float(((df["close"].iloc[-1] / base_p) - 1.0) * 100.0)

            comparison_series[clean_sym] = df.replace({np.nan: None}).to_dict(orient="records")

            summary_stats.append({
                "symbol": clean_sym,
                "base_price": base_p,
                "latest_close": df["close"].iloc[-1],
                "cumulative_return_pct": round(cum_ret, 2),
                "annualized_volatility_pct": round(volatility, 2),
                "max_drawdown_pct": round(max_dd, 2),
                "data_points": len(df),
            })

        return {
            "symbols": symbols,
            "summary": summary_stats,
            "summary_stats": summary_stats,
            "series": comparison_series,
        }
