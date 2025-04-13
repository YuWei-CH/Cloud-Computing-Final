#!/bin/bash

echo "Starting cleanup process..."

# Deactivate virtual environment if it's active
if [[ "$VIRTUAL_ENV" != "" ]]; then
    echo "Deactivating virtual environment..."
    deactivate
fi

# Remove virtual environment
if [ -d "venv" ]; then
    echo "Removing virtual environment..."
    rm -rf venv
fi

# Drop the database
echo "Dropping database..."
dropdb tripplanner || true

# Remove any cached Python files
echo "Removing Python cache files..."
find . -type d -name "__pycache__" -exec rm -r {} +
find . -type f -name "*.pyc" -delete
find . -type f -name "*.pyo" -delete
find . -type f -name "*.pyd" -delete

# Remove any generated files
echo "Removing generated files..."
rm -f .env
rm -f *.log

# Remove any test artifacts
echo "Removing test artifacts..."
rm -rf .pytest_cache
rm -rf .coverage
rm -rf htmlcov

echo "Cleanup complete!" 