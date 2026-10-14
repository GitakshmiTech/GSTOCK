# Parser & Column Mapping Documentation

## Format Transition
On **8 July 2024**, the National Stock Exchange of India transitioned from the legacy Capital Market Bhavcopy format to the **UDiFF (Unified Data Interchange Format) Common Bhavcopy Final ZIP**.

| Attribute | Legacy Bhavcopy (Pre-2024-07-08) | UDiFF Bhavcopy (2024-07-08 Onwards) |
|---|---|---|
| **File Naming** | `cmDDMMMYYYYbhav.csv.zip` | `BhavCopy_NSE_CM_0_0_0_YYYYMMDD_F_0000.csv.zip` |
| **Archive Structure** | Single CSV inside ZIP | Single CSV inside ZIP |
| **Date Header** | `TIMESTAMP` or `TRADEDATE` | `TradDt` / `BizDt` |
| **Date Format** | `DD-MMM-YYYY` (e.g. `05-JAN-2001`) | `YYYY-MM-DD` (e.g. `2024-07-08`) |
| **Ticker Header** | `SYMBOL` | `TckrSymb` |
| **Series Header** | `SERIES` | `SctySrs` |
| **Open Price** | `OPEN` | `OpnPric` |
| **High Price** | `HIGH` | `HghPric` |
| **Low Price** | `LOW` | `LwPric` |
| **Close Price** | `CLOSE` | `ClsPric` |
| **Last Price** | `LAST` | `LastPric` |
| **Previous Close** | `PREVCLOSE` | `PrvsClsgPric` |
| **Traded Volume** | `TOTTRDQTY` | `TtlTradgVol` |
| **Turnover Value** | `TOTTRDVAL` | `TtlTrfVal` |
| **Number of Trades**| `TOTALTRADES` | `TtlNbOfTxsExctd` / `TtlNbOrTxnExctd` |
| **ISIN Code** | `ISIN` | `ISIN` |
| **Deliverable Qty** | `DELIV_QTY` (if present) | `DlvryQty` (if present) |

## Canonical Schema Mapping
All parsers normalize data into the following uniform dictionary representation:
```python
{
    "trade_date": datetime.date,
    "symbol": str,
    "series": str,
    "open_price": Optional[float],
    "high_price": Optional[float],
    "low_price": Optional[float],
    "close_price": Optional[float],
    "last_price": Optional[float],
    "prev_close": Optional[float],
    "vwap": Optional[float],
    "traded_quantity": Optional[int],
    "turnover": Optional[float],
    "no_of_trades": Optional[int],
    "deliverable_quantity": Optional[int],
    "deliverable_pct": Optional[float],
    "isin": Optional[str],
}
```
Missing or blank numeric values are converted to `None` rather than `0.0`.
`vwap` is automatically computed as `round(turnover / traded_quantity, 4)` whenever volume and turnover are positive and `vwap` is absent.
