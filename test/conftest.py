import pytest
import asyncio
from typing import Dict, List, Tuple, Any
from unittest.mock import MagicMock, AsyncMock
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app import app
from storage.repositories.route_repository import RouteRepository

# Sample data for tests
@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),  # Chicago
        (29.7604, -95.3698)   # Houston
    ]

@pytest.fixture
def sample_addresses():
    return [
        "New York, NY",
        "Los Angeles, CA",
        "Chicago, IL",
        "Houston, TX"
    ]

@pytest.fixture
def sample_address_points():
    return [
        {"address": "New York, NY", "name": "New York"},
        {"address": "Los Angeles, CA", "name": "Los Angeles"},
        {"address": "Chicago, IL", "name": "Chicago"},
        {"address": "Houston, TX", "name": "Houston"}
    ]

@pytest.fixture
def sample_points_with_addresses(sample_points, sample_addresses):
    return dict(zip(sample_points, sample_addresses))

# Mock database session
@pytest.fixture
def mock_db_session():
    return AsyncMock(spec=AsyncSession)

# Route repository with mocked geocoder
@pytest.fixture
def route_repository(mock_db_session):
    repo = RouteRepository(mock_db_session)
    # Mock the geocoder to avoid external calls
    repo.geocoder = MagicMock()
    repo.geocoder.geocode.return_value = MagicMock(
        latitude=40.7128, 
        longitude=-74.0060
    )
    return repo

# Test client for API testing
@pytest.fixture
def client():
    # Create a mock DB dependency that doesn't actually interact with a database
    async def override_get_db():
        mock_session = AsyncMock(spec=AsyncSession)
        try:
            yield mock_session
        finally:
            # This prevents the actual DB close operation
            pass
            
    # Override the get_db dependency
    original_dependencies = app.dependency_overrides.copy()
    
    # Find the get_db dependency in app routes
    for route in app.routes:
        if hasattr(route, "dependant"):
            for dep in route.dependant.dependencies:
                if hasattr(dep, "call") and dep.call.__name__ == "get_db":
                    app.dependency_overrides[dep.call] = override_get_db
                    break
    
    # Create a TestClient
    with TestClient(app) as test_client:
        yield test_client
        
    # Reset overrides
    app.dependency_overrides = original_dependencies 