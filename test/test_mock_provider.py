import pytest
from provider.mock_provider import MockProvider
from provider.base import Route, RouteSegment, TransportMode

@pytest.fixture
def mock_provider():
    return MockProvider()

@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),   # Chicago
    ]

@pytest.mark.asyncio
async def test_get_route(mock_provider):
    start = (40.7128, -74.0060)  # New York
    end = (34.0522, -118.2437)   # Los Angeles
    
    route = await mock_provider.get_route(start, end)
    
    assert isinstance(route, Route)
    assert len(route.segments) == 1
    assert isinstance(route.segments[0], RouteSegment)
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) == 2
    assert route.coordinates[0] == start
    assert route.coordinates[-1] == end

@pytest.mark.asyncio
async def test_get_distance_matrix(mock_provider, sample_points):
    matrix = await mock_provider.get_distance_matrix(sample_points)
    
    assert isinstance(matrix, dict)
    assert len(matrix) == len(sample_points) * len(sample_points)
    
    # Check diagonal (distance to self should be 0)
    for point in sample_points:
        assert matrix[(point, point)] == 0
    
    # Check symmetry
    for i, start in enumerate(sample_points):
        for j, end in enumerate(sample_points):
            assert matrix[(start, end)] == matrix[(end, start)]

@pytest.mark.asyncio
async def test_get_duration_matrix(mock_provider, sample_points):
    matrix = await mock_provider.get_duration_matrix(sample_points)
    
    assert isinstance(matrix, dict)
    assert len(matrix) == len(sample_points) * len(sample_points)
    
    # Check diagonal (duration to self should be 0)
    for point in sample_points:
        assert matrix[(point, point)] == 0
    
    # Check symmetry
    for i, start in enumerate(sample_points):
        for j, end in enumerate(sample_points):
            assert matrix[(start, end)] == matrix[(end, start)]

@pytest.mark.asyncio
async def test_is_valid_point(mock_provider):
    valid_point = (40.7128, -74.0060)
    invalid_point = (0.0, 0.0)
    
    # Initially, no points should be valid
    assert not await mock_provider.is_valid_point(valid_point)
    assert not await mock_provider.is_valid_point(invalid_point)
    
    # Add a valid point
    mock_provider.add_valid_point(valid_point)
    
    # Now only the added point should be valid
    assert await mock_provider.is_valid_point(valid_point)
    assert not await mock_provider.is_valid_point(invalid_point)

@pytest.mark.asyncio
async def test_route_distance_duration_relationship(mock_provider):
    start = (40.7128, -74.0060)  # New York
    end = (34.0522, -118.2437)   # Los Angeles
    
    route = await mock_provider.get_route(start, end)
    
    # Check that duration is approximately distance/speed
    # We use 13.89 m/s (50 km/h) in the mock provider
    expected_duration = route.total_distance / 13.89
    assert abs(route.total_duration - expected_duration) < 0.1  # Allow small floating point differences 