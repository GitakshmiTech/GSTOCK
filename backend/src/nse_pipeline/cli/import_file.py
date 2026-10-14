"""CLI command for importing a local NSE Bhavcopy archive."""

from pathlib import Path

import typer
from rich.console import Console
from rich.table import Table

from nse_pipeline.core.clock import parse_date
from nse_pipeline.database.session import get_db_session
from nse_pipeline.services.ingestion_service import IngestionService

app = typer.Typer(help="Import local Bhavcopy CSV or ZIP file")
console = Console()


@app.command()
def main(
    path: str = typer.Option(..., "--path", "-p", help="Path to local file (CSV, ZIP, GZIP)"),
    date_str: str | None = typer.Option(None, "--date", "-d", help="Explicit trade date override (YYYY-MM-DD)"),
):
    """Imports a local file into the database."""
    file_path = Path(path)
    if not file_path.is_file():
        console.print(f"[bold red]File does not exist: {path}[/bold red]")
        raise typer.Exit(code=1)

    override_date = parse_date(date_str) if date_str else None
    console.print(f"[bold cyan]Importing local file {file_path.name}...[/bold cyan]")

    with get_db_session() as session:
        service = IngestionService(session)
        result = service.ingest_file(file_path=file_path, trade_date_override=override_date)

    table = Table(title="File Import Result")
    table.add_column("Property", style="cyan")
    table.add_column("Value", style="green" if result.status == "IMPORTED" else "red")

    table.add_row("File", result.file_name)
    table.add_row("Trade Date", str(result.trade_date))
    table.add_row("Status", str(result.status))
    table.add_row("Raw Rows", str(result.raw_row_count))
    table.add_row("Parsed Records", str(result.parsed_count))
    table.add_row("Imported Rows", str(result.inserted_count))
    table.add_row("Rejected Rows", str(result.rejected_count))
    if result.error_message:
        table.add_row("Error", result.error_message)

    console.print(table)


if __name__ == "__main__":
    app()
