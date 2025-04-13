import pytest
from fastapi.testclient import TestClient
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import UUID, uuid4
import base64
from PIL import Image
import io
from fastapi import HTTPException

from app import app
from provider.base import Route, RouteSegment, TransportMode
from storage.models import OptimizedRoute

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def sample_route_id():
    return uuid4()

@pytest.fixture
def mock_route():
    """Create a mock route for testing"""
    # Create a simple route with 3 points
    coordinates = [
        (40.7128, -74.0060),  # New York
        (41.8781, -87.6298),  # Chicago
        (34.0522, -118.2437),  # Los Angeles
    ]
    
    # Create segments
    segments = []
    for i in range(len(coordinates) - 1):
        segment = RouteSegment(
            distance=1000000.0,  # 1000 km
            duration=36000.0,    # 10 hours
            coordinates=[coordinates[i], coordinates[i+1]],
            mode=TransportMode.DRIVING
        )
        segments.append(segment)
    
    # Create the route
    return Route(
        segments=segments,
        total_distance=2000000.0,  # 2000 km
        total_duration=72000.0,    # 20 hours
        coordinates=coordinates
    )

@pytest.fixture
def mock_route_repository(mock_route):
    """Create a mock route repository"""
    async def mock_get_route(route_id):
        if route_id == UUID('00000000-0000-0000-0000-000000000000'):
            raise HTTPException(status_code=404, detail="Route not found")
        return mock_route
    
    # Create a mock repository
    mock_repo = AsyncMock()
    mock_repo.get_route = mock_get_route
    
    return mock_repo

@pytest.mark.asyncio
async def test_visualize_route_endpoint_success(client, sample_route_id, mock_route_repository):
    """Test the route visualization endpoint with a valid route ID"""
    # Mock the RouteRepository
    with patch('app.RouteRepository', return_value=mock_route_repository):
        # Call the endpoint
        response = client.get(f"/routes/{sample_route_id}/visualize")
        
        # Check the response
        assert response.status_code == 200
        assert "image_data" in response.json()
        
        # Verify the image data is valid
        image_data = response.json()["image_data"]
        assert isinstance(image_data, str)
        
        # Try to decode and open the image
        try:
            img_data = base64.b64decode(image_data)
            img = Image.open(io.BytesIO(img_data))
            assert img.format == "PNG"
        except Exception as e:
            pytest.fail(f"Failed to decode image: {e}")

@pytest.mark.asyncio
async def test_visualize_route_endpoint_not_found(client, mock_route_repository):
    """Test the route visualization endpoint with a non-existent route ID"""
    # Mock the RouteRepository
    with patch('app.RouteRepository', return_value=mock_route_repository):
        # Call the endpoint with a non-existent route ID
        response = client.get("/routes/00000000-0000-0000-0000-000000000000/visualize")
        
        # Check the response
        assert response.status_code == 404
        assert "detail" in response.json()
        assert response.json()["detail"] == "Route not found"

@pytest.mark.asyncio
async def test_visualize_route_endpoint_error(client, mock_route_repository):
    """Test the route visualization endpoint with an error in the repository"""
    # Create a mock repository that raises an exception
    mock_repo = AsyncMock()
    mock_repo.get_route.side_effect = Exception("Database error")
    
    # Mock the RouteRepository
    with patch('app.RouteRepository', return_value=mock_repo):
        # Call the endpoint
        response = client.get(f"/routes/{uuid4()}/visualize")
        
        # Check the response
        assert response.status_code == 500
        assert "detail" in response.json() 