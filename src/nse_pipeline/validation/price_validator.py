"""Domain price, OHLC integrity, and volume validations."""

from typing import Any

from nse_pipeline.core.constants import SeverityLevel


class PriceValidator:
    @classmethod
    def validate_price_record(cls, record: dict[str, Any]) -> list[dict[str, Any]]:
        """Validates OHLC prices, volumes, and returns list of validation findings."""
        issues: list[dict[str, Any]] = []

        open_p = record.get("open_price")
        high_p = record.get("high_price")
        low_p = record.get("low_price")
        close_p = record.get("close_price")
        prev_close = record.get("prev_close")
        traded_qty = record.get("traded_quantity")
        deliv_qty = record.get("deliverable_quantity")

        # 1. Non-positive price check
        for name, val in [("open_price", open_p), ("high_price", high_p), ("low_price", low_p), ("close_price", close_p)]:
            if val is not None and val <= 0:
                issues.append({
                    "rule_name": f"NON_POSITIVE_{name.upper()}",
                    "severity": SeverityLevel.ERROR,
                    "details": f"{name} is {val}, which is <= 0.",
                })

        # 2. OHLC relational integrity
        if high_p is not None and low_p is not None and high_p < low_p:
            issues.append({
                "rule_name": "HIGH_LESS_THAN_LOW",
                "severity": SeverityLevel.ERROR,
                "details": f"High price ({high_p}) is lower than low price ({low_p}).",
            })

        if high_p is not None and open_p is not None and high_p < open_p:
            issues.append({
                "rule_name": "HIGH_LESS_THAN_OPEN",
                "severity": SeverityLevel.ERROR,
                "details": f"High price ({high_p}) is lower than open price ({open_p}).",
            })

        if high_p is not None and close_p is not None and high_p < close_p:
            issues.append({
                "rule_name": "HIGH_LESS_THAN_CLOSE",
                "severity": SeverityLevel.ERROR,
                "details": f"High price ({high_p}) is lower than close price ({close_p}).",
            })

        if low_p is not None and open_p is not None and low_p > open_p:
            issues.append({
                "rule_name": "LOW_GREATER_THAN_OPEN",
                "severity": SeverityLevel.ERROR,
                "details": f"Low price ({low_p}) is higher than open price ({open_p}).",
            })

        if low_p is not None and close_p is not None and low_p > close_p:
            issues.append({
                "rule_name": "LOW_GREATER_THAN_CLOSE",
                "severity": SeverityLevel.ERROR,
                "details": f"Low price ({low_p}) is higher than close price ({close_p}).",
            })

        # 3. Unusual price change warning (> 20%)
        if close_p is not None and prev_close is not None and prev_close > 0:
            change_pct = abs(close_p - prev_close) / prev_close
            if change_pct > 0.20:
                issues.append({
                    "rule_name": "EXTREME_PRICE_SWING",
                    "severity": SeverityLevel.WARNING,
                    "details": f"Daily price change is {change_pct * 100:.2f}% (prev={prev_close}, close={close_p}).",
                })

        # 4. Quantity and volume checks
        if traded_qty is not None and traded_qty < 0:
            issues.append({
                "rule_name": "NEGATIVE_TRADED_QUANTITY",
                "severity": SeverityLevel.ERROR,
                "details": f"Traded quantity is negative: {traded_qty}.",
            })

        if deliv_qty is not None and traded_qty is not None:
            if deliv_qty > traded_qty:
                issues.append({
                    "rule_name": "DELIVERY_EXCEEDS_VOLUME",
                    "severity": SeverityLevel.WARNING,
                    "details": f"Deliverable quantity ({deliv_qty}) exceeds total traded volume ({traded_qty}).",
                })

        return issues
