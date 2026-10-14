"""CLI command for manual or scheduled daily EOD update."""


import typer
from rich.console import Console
from rich.table import Table

from nse_pipeline.core.clock import parse_date, today_ist
from nse_pipeline.services.daily_update_service import DailyUpdateService

app = typer.Typer(help="Daily EOD Update CLI for NSE market data")
console = Console()


@app.command()
def main(
    date_str: str | None = typer.Option(None, "--date", "-d", help="Specific trade date to run (YYYY-MM-DD, defaults to today)"),
    force: bool = typer.Option(False, "--force", "-f", help="Force execution even if holiday/weekend or file exists"),
    wait: bool = typer.Option(True, "--wait/--no-wait", help="Wait and retry if file not yet published"),
):
    """Executes the daily market data update."""
    target_date = parse_date(date_str) if date_str else today_ist()
    console.print(f"[bold cyan]Running Daily EOD Update for {target_date}...[/bold cyan]")

    service = DailyUpdateService()
    result = service.run_daily_update(target_date=target_date, force=force, wait_for_publication=wait)

    table = Table(title="Daily Update Result")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="green" if result.status == "IMPORTED" else "yellow")

    table.add_row("Trade Date", str(result.trade_date))
    table.add_row("Status", str(result.status))
    table.add_row("Source File", result.file_name)
    table.add_row("Rows Inserted/Updated", str(result.inserted_count))
    table.add_row("Rows Rejected", str(result.rejected_count))
    if result.error_message:
        table.add_row("Error/Note", result.error_message)

    console.print(table)


if __name__ == "__main__":
    app()
