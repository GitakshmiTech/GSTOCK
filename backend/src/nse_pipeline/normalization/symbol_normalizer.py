"""Symbol and series normalization utilities."""



class SymbolNormalizer:
    @staticmethod
    def normalize_symbol(symbol: str) -> str:
        """Trims and standardizes equity symbol."""
        if not symbol:
            return ""
        return str(symbol).strip().upper()

    @staticmethod
    def normalize_series(series: str | None) -> str:
        """Trims and standardizes series code, defaulting to 'EQ' if blank."""
        if not series:
            return "EQ"
        s = str(series).strip().upper()
        if s in ("", "NAN", "NULL", "NONE"):
            return "EQ"
        return s

    @staticmethod
    def normalize_isin(isin: str | None) -> str | None:
        """Validates and trims ISIN code."""
        if not isin:
            return None
        clean = str(isin).strip().upper()
        if len(clean) == 12 and clean.isalnum():
            return clean
        return None
