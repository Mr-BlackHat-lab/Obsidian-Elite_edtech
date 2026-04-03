from __future__ import annotations

import click

from commands.generate_test import test_command
from commands.process import process_command
from commands.show_progress import progress_command


@click.group()
def cli() -> None:
    """LearnPulse AI CLI."""


cli.add_command(process_command, name="process")
cli.add_command(test_command, name="test")
cli.add_command(progress_command, name="progress")


if __name__ == "__main__":
    cli()
