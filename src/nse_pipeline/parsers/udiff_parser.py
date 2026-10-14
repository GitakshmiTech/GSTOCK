"""UDiFF parser re-export."""

from nse_pipeline.parsers.udiff_bhavcopy import UdiffBhavcopyParser

UdiffParser = UdiffBhavcopyParser
__all__ = ["UdiffParser", "UdiffBhavcopyParser"]
