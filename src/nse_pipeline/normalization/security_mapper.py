"""Security mapper alias and utilities."""

from nse_pipeline.normalization.symbol_normalizer import SymbolNormalizer

SecurityMapper = SymbolNormalizer
__all__ = ["SecurityMapper", "SymbolNormalizer"]
