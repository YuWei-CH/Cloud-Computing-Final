import pytest
from core.workflow.route_planner import RoutePlanner
from provider.mock_provider import MockProvider
from provider.base import Route, TransportMode

@pytest.fixture
def mock_provider():
    return MockProvider()

@pytest.fixture
def route_planner(mock_provider):
    return RoutePlanner(mock_provider)

@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),   # Chicago
        (29.7604, -95.3698),   # Houston
    ]

@pytest.mark.asyncio
async def test_plan_route_basic(route_planner, sample_points):
    route = await route_planner.plan_route(sample_points)
    
    assert isinstance(route, Route)
    assert len(route.coordinates) > 0
    assert route.total_distance > 0
    assert route.total_duration > 0

@pytest.mark.asyncio
async def test_plan_route_with_mode(route_planner, sample_points):
    # Test with different transportation modes
    for mode in [TransportMode.DRIVING, TransportMode.WALKING]:
        route = await route_planner.plan_route(sample_points, mode=mode)
        assert isinstance(route, Route)
        assert len(route.coordinates) > 0
        assert route.total_distance > 0
        assert route.total_duration > 0

@pytest.mark.asyncio
async def test_plan_route_no_round_trip(route_planner, sample_points):
    route = await route_planner.plan_route(sample_points, round_trip=False)
    
    assert isinstance(route, Route)
    assert len(route.coordinates) == len(sample_points)
    assert route.coordinates[0] == sample_points[0]  # Start point should be first
    assert route.coordinates[-1] == sample_points[-1]  # End point should be last

@pytest.mark.asyncio
async def test_get_matrices(route_planner, sample_points):
    # Test distance matrix
    distance_matrix = await route_planner.get_distance_matrix(sample_points)
    assert len(distance_matrix) == len(sample_points) * len(sample_points)  # Include self-distances (0)
    
    # Test duration matrix
    duration_matrix = await route_planner.get_duration_matrix(sample_points)
    assert len(duration_matrix) == len(sample_points) * len(sample_points)  # Include self-durations (0)

@pytest.mark.asyncio
async def test_get_route_statistics(route_planner, sample_points):
    route = await route_planner.plan_route(sample_points)
    stats = await route_planner.get_route_statistics(route)
    
    assert "total_distance" in stats
    assert "total_duration" in stats
    assert "average_speed" in stats
    assert stats["total_distance"] > 0
    assert stats["total_duration"] > 0
    assert stats["average_speed"] > 0 