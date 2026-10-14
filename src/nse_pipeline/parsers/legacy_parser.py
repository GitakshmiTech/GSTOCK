"""Legacy parser re-export."""

from nse_pipeline.parsers.legacy_bhavcopy import LegacyBhavcopyParser

LegacyParser = LegacyBhavcopyParser
__all__ = ["LegacyParser", "LegacyBhavcopyParser"]
