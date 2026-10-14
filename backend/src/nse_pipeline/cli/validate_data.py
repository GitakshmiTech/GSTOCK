"""CLI command for validating stored database records and reconciling missing days."""

import typer
from rich.console import Console
from rich.table import Table

from nse_pipeline.core.clock import parse_date
from nse_pipeline.database.repositories.ingestion_repository import IngestionRepository
from nse_pipeline.database.repositories.price_repository import PriceRepository
from nse_pipeline.database.session import get_db_session
from nse_pipeline.services.recovery_service import RecoveryService

app = typer.Typer(help="Validate stored market data and check quality issues")
console = Console()


@app.command()
def main(
    start: str = typer.Option(..., "--start", "-s", help="Start date (YYYY-MM-DD)"),
    end: str = typer.Option(..., "--end", "-e", help="End date (YYYY-MM-DD)"),
):
    """Checks database integrity, flags missing dates, and summarizes quality issues."""
    start_d = parse_date(start)
    end_d = parse_date(end)
    console.print(f"[bold cyan]Validating stored market data: {start_d} to {end_d}...[/bold cyan]")

    with get_db_session() as session:
        price_repo = PriceRepository(session)
        ingestion_repo = IngestionRepository(session)
        recovery_svc = RecoveryService(session)

        # 1. Check distinct dates stored
        dates_stored = price_repo.get_distinct_dates(start_date=start_d, end_date=end_d)
        missing_dates = recovery_svc.reconcile_missing_dates(start_d, end_d)

        # 2. Check quality issues recorded
        issues = ingestion_repo.list_quality_issues(limit=20)

    table = Table(title="Data Quality & Integrity Report")
    table.add_column("Check", style="cyan")
    table.add_column("Result", style="green" if not missing_dates else "yellow")

    table.add_row("Total Trading Dates Stored", str(len(dates_stored)))
    table.add_row("Missing Trading Dates Count", str(len(missing_dates)))
    if missing_dates:
        table.add_row("First 5 Missing Dates", ", ".join(str(d) for d in missing_dates[:5]))
    table.add_row("Recent Quality Issues Count", str(len(issues)))

    console.print(table)


if __name__ == "__main__":
    app()
