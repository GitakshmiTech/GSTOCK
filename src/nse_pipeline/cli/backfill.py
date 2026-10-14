"""CLI command for running historical backfill."""


import typer
from rich.console import Console
from rich.table import Table

from nse_pipeline.core.clock import parse_date
from nse_pipeline.services.backfill_service import BackfillService

app = typer.Typer(help="Historical backfill CLI for NSE market data")
console = Console()


@app.command()
def main(
    start: str = typer.Option(..., "--start", "-s", help="Start date (YYYY-MM-DD)"),
    end: str = typer.Option(..., "--end", "-e", help="End date (YYYY-MM-DD)"),
    batch_size: int | None = typer.Option(None, "--batch-size", "-b", help="Batch size in days"),
    resume: bool = typer.Option(True, "--resume/--no-resume", help="Skip dates already present in database"),
):
    """Executes historical backfill for the specified date range."""
    start_d = parse_date(start)
    end_d = parse_date(end)

    console.print(f"[bold cyan]Initiating historical backfill: {start_d} to {end_d}[/bold cyan]")
    service = BackfillService()
    summary = service.run_backfill(start_date=start_d, end_date=end_d, resume=resume, batch_size=batch_size)

    # Print summary table
    table = Table(title="Historical Backfill Summary")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")

    table.add_row("Job ID", summary.job_id)
    table.add_row("Date Range", f"{summary.start_date} to {summary.end_date}")
    table.add_row("Total Calendar Days", str(summary.total_dates_requested))
    table.add_row("Trading Days Found", str(summary.trading_dates_count))
    table.add_row("Previously Present (Skipped)", str(summary.already_imported_count))
    table.add_row("Successfully Imported Dates", str(summary.successful_dates_count))
    table.add_row("Missing / Failed Dates", str(summary.failed_dates_count))
    table.add_row("Total Price Rows Imported", f"{summary.total_rows_imported:,}")

    console.print(table)


if __name__ == "__main__":
    app()
