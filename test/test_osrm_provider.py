import pytest
from provider.osrm_provider import OSRMProvider
from provider.base import Route, RouteSegment

@pytest.fixture
def osrm_provider():
    return OSRMProvider()

@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),   # Chicago
    ]

def approx_coord(coord1: tuple, coord2: tuple, tolerance: float = 0.001):
    """Check if two coordinates are approximately equal"""
    return (abs(coord1[0] - coord2[0]) < tolerance and 
            abs(coord1[1] - coord2[1]) < tolerance)

@pytest.mark.asyncio
async def test_get_route(osrm_provider):
    start = (40.7128, -74.0060)  # New York
    end = (34.0522, -118.2437)   # Los Angeles
    
    route = await osrm_provider.get_route(start, end)
    
    assert isinstance(route, Route)
    assert len(route.segments) == 1
    assert isinstance(route.segments[0], RouteSegment)
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) > 2  # OSRM should return more than just start and end points
    assert approx_coord(route.coordinates[0], start)
    assert approx_coord(route.coordinates[-1], end)

@pytest.mark.asyncio
async def test_get_distance_matrix(osrm_provider, sample_points):
    matrix = await osrm_provider.get_distance_matrix(sample_points)
    
    assert isinstance(matrix, dict)
    assert len(matrix) == len(sample_points) * len(sample_points)
    
    # Check diagonal (distance to self should be 0)
    for point in sample_points:
        assert matrix[(point, point)] == 0
    
    # Check approximate symmetry (OSRM might have slight differences due to one-way streets)
    for i, start in enumerate(sample_points):
        for j, end in enumerate(sample_points):
            if i != j:  # Skip diagonal
                # Allow 1% difference for one-way streets
                assert abs(matrix[(start, end)] - matrix[(end, start)]) <= matrix[(start, end)] * 0.01

@pytest.mark.asyncio
async def test_get_duration_matrix(osrm_provider, sample_points):
    matrix = await osrm_provider.get_duration_matrix(sample_points)
    
    assert isinstance(matrix, dict)
    assert len(matrix) == len(sample_points) * len(sample_points)
    
    # Check diagonal (duration to self should be 0)
    for point in sample_points:
        assert matrix[(point, point)] == 0
    
    # Check approximate symmetry (OSRM might have slight differences due to one-way streets)
    for i, start in enumerate(sample_points):
        for j, end in enumerate(sample_points):
            if i != j:  # Skip diagonal
                # Allow 1% difference for one-way streets
                assert abs(matrix[(start, end)] - matrix[(end, start)]) <= matrix[(start, end)] * 0.01

@pytest.mark.asyncio
async def test_is_valid_point(osrm_provider):
    # Test with a known valid point (New York)
    valid_point = (40.7128, -74.0060)
    assert await osrm_provider.is_valid_point(valid_point)
    
    # Test with an invalid point (middle of ocean)
    invalid_point = (0.0, 0.0)
    assert not await osrm_provider.is_valid_point(invalid_point)

@pytest.mark.asyncio
async def test_route_coordinates_format(osrm_provider):
    start = (40.7128, -74.0060)  # New York
    end = (34.0522, -118.2437)   # Los Angeles
    
    route = await osrm_provider.get_route(start, end)
    
    # Check that all coordinates are in the correct format (lat, lng)
    for coord in route.coordinates:
        assert isinstance(coord, tuple)
        assert len(coord) == 2
        assert -90 <= coord[0] <= 90  # Latitude
        assert -180 <= coord[1] <= 180  # Longitude

@pytest.mark.asyncio
async def test_error_handling(osrm_provider):
    # Test with invalid coordinates
    invalid_start = (91.0, 0.0)  # Invalid latitude
    end = (40.7128, -74.0060)
    
    with pytest.raises(Exception):
        await osrm_provider.get_route(invalid_start, end) 