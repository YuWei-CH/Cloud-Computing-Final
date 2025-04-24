#!/bin/bash

# Check if a script name was provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <script_name>"
    echo "Example: $0 ny_trip_planner.py"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Activate virtual environment if it exists
if [ -d "$PROJECT_ROOT/test_venv" ]; then
    echo "Activating TESTING virtual environment..."
    source "$PROJECT_ROOT/test_venv/bin/activate"
else
    echo "Warning: Virtual environment not found at $PROJECT_ROOT/test_venv"
    echo "Make sure you've run setup.sh first"
    exit 1
fi

# Set PYTHONPATH to include the project root
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

# Run the script
echo "Running $1..."
python -W ignore "$SCRIPT_DIR/$1" 