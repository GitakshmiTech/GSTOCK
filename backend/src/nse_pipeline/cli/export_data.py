"""CLI command to export historical prices to CSV or Excel."""


import typer
from rich.console import Console

from nse_pipeline.core.clock import parse_date
from nse_pipeline.database.session import get_db_session
from nse_pipeline.services.export_service import ExportService

app = typer.Typer(help="Export historical market data to CSV or Excel")
console = Console()


@app.command()
def main(
    symbol: str = typer.Option(..., "--symbol", "-s", help="Stock symbol, e.g. RELIANCE"),
    start: str | None = typer.Option(None, "--start", help="Start date (YYYY-MM-DD)"),
    end: str | None = typer.Option(None, "--end", help="End date (YYYY-MM-DD)"),
    series: str = typer.Option("EQ", "--series", help="Series, e.g. EQ"),
    format_type: str = typer.Option("csv", "--format", "-f", help="Output format: csv or excel"),
):
    """Exports historical prices for a symbol."""
    start_d = parse_date(start) if start else None
    end_d = parse_date(end) if end else None

    console.print(f"[bold cyan]Exporting {symbol} ({series}) data ({format_type})...[/bold cyan]")

    with get_db_session() as session:
        service = ExportService(session)
        out_path = service.export_symbol_history(
            symbol=symbol,
            start_date=start_d,
            end_date=end_d,
            series=series,
            format_type=format_type,
        )

    console.print(f"[bold green]✓ Successfully exported to {out_path}[/bold green]")


if __name__ == "__main__":
    app()
