"""Main entry point for the NSE Market Data Pipeline."""

from nse_pipeline.cli.commands import cli_app


def main():
    cli_app()

if __name__ == "__main__":
    main()
