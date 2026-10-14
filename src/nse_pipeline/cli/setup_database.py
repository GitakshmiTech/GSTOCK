"""CLI command to initialize database schema, tables and calendar."""

import typer
from rich.console import Console

from nse_pipeline.core.logging import get_logger
from nse_pipeline.database.session import get_db_session, init_db
from nse_pipeline.scheduler.trading_calendar import NSETradingCalendar

app = typer.Typer(help="Initialize NSE Pipeline Database and Trading Calendar")
console = Console()
logger = get_logger("cli.setup_database")


@app.command()
def main():
    """Initializes tables and seeds the trading calendar."""
    console.print("[bold blue]Starting NSE Market Data Pipeline database initialization...[/bold blue]")
    try:
        init_db()
        console.print("[green]✓ Database schema and tables created successfully.[/green]")

        with get_db_session() as session:
            console.print("Seeding trading calendar (2001–2026)...")
            count = NSETradingCalendar.seed_calendar(session, start_year=2001, end_year=2026)
            console.print(f"[green]✓ Seeded {count} dates into trading_calendar table.[/green]")

        console.print("[bold green]Database setup completed successfully![bold green]")
    except Exception as e:
        console.print(f"[bold red]Database setup failed: {e}[/bold red]")
        raise typer.Exit(code=1)


if __name__ == "__main__":
    app()
