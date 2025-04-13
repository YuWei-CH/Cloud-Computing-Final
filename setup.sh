#!/bin/bash

echo "🚀 Starting TripPlanner setup..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
else
    echo "✅ Homebrew is already installed"
fi

# Install PostgreSQL if not installed
if ! command -v postgres &> /dev/null; then
    echo "Installing PostgreSQL..."
    brew install postgresql@14
    brew services start postgresql@14
    echo "Waiting for PostgreSQL to start..."
    sleep 5
else
    echo "✅ PostgreSQL is already installed"
    # Ensure PostgreSQL is running
    brew services start postgresql@14
fi

# Create Python virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Create database and user
echo "Setting up database..."

# Create postgres user if it doesn't exist
if ! psql postgres -tAc "SELECT 1 FROM pg_roles WHERE rolname='postgres'" | grep -q 1; then
    echo "Creating postgres user..."
    createuser -s postgres
fi

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw tripplanner; then
    echo "Creating tripplanner database..."
    createdb tripplanner
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOL
# Database settings
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=tripplanner
DB_ECHO_SQL=false

# Environment settings
ENV=local

# Cache settings
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Routing provider settings
ROUTING_PROVIDER=osrm

# API settings
API_HOST=0.0.0.0
API_PORT=8000
DEBUG=true
EOL
fi

# Ensure alembic.ini is in the root directory
if [ ! -f "alembic.ini" ] && [ -f "migrations/alembic.ini" ]; then
    echo "Copying alembic.ini to root directory..."
    cp migrations/alembic.ini .
fi

# Run database migrations
echo "Running database migrations..."
alembic upgrade head

echo "✨ Setup complete! Your database is ready to use."
echo "
To start using the TripPlanner:
1. Activate the virtual environment: source venv/bin/activate
2. Start the API server: uvicorn app:app --reload
" 