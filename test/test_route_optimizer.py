import pytest
from core.optimization.route_optimizer import RouteOptimizer
from provider.mock_provider import MockProvider
from provider.base import Route, RouteSegment

@pytest.fixture
def mock_provider():
    return MockProvider()

@pytest.fixture
def route_optimizer(mock_provider):
    return RouteOptimizer(mock_provider)

@pytest.fixture
def kdtree_route_optimizer(mock_provider):
    return RouteOptimizer(mock_provider, use_kdtree=True)

@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),   # Chicago
        (29.7604, -95.3698),   # Houston
    ]

@pytest.mark.asyncio
async def test_optimize_route_basic(route_optimizer, sample_points):
    route = await route_optimizer.optimize_route(sample_points)
    
    assert isinstance(route, Route)
    assert len(route.segments) > 0
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) == len(sample_points) + 1  # +1 for return to start

@pytest.mark.asyncio
async def test_optimize_route_with_start_end(route_optimizer, sample_points):
    start = (40.7128, -74.0060)  # New York
    end = (29.7604, -95.3698)    # Houston
    waypoints = sample_points[1:-1]  # Los Angeles and Chicago
    
    route = await route_optimizer.optimize_route(waypoints, start, end)
    
    assert isinstance(route, Route)
    assert route.coordinates[0] == start
    assert route.coordinates[-1] == end
    assert len(route.coordinates) == len(waypoints) + 2  # +2 for start and end points

@pytest.mark.asyncio
async def test_optimize_route_empty_points(route_optimizer):
    with pytest.raises(ValueError):
        await route_optimizer.optimize_route([])

@pytest.mark.asyncio
async def test_optimize_route_single_point(route_optimizer):
    point = (40.7128, -74.0060)
    route = await route_optimizer.optimize_route([point])
    
    assert isinstance(route, Route)
    assert len(route.segments) == 1
    assert route.coordinates[0] == point
    assert route.coordinates[-1] == point

@pytest.mark.asyncio
async def test_get_route_statistics(route_optimizer, sample_points):
    route = await route_optimizer.optimize_route(sample_points)
    stats = await route_optimizer.get_route_statistics(route)
    
    assert isinstance(stats, dict)
    assert 'total_distance' in stats
    assert 'total_duration' in stats
    assert 'number_of_segments' in stats
    assert 'average_segment_distance' in stats
    assert 'average_segment_duration' in stats
    
    # Check that averages are calculated correctly
    assert stats['average_segment_distance'] == stats['total_distance'] / stats['number_of_segments']
    assert stats['average_segment_duration'] == stats['total_duration'] / stats['number_of_segments']

@pytest.mark.asyncio
async def test_kdtree_optimization(kdtree_route_optimizer, sample_points):
    route = await kdtree_route_optimizer.optimize_route(sample_points)
    
    assert isinstance(route, Route)
    assert len(route.segments) > 0
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) == len(sample_points) + 1  # +1 for return to start
    
    # First and last points should be the same (round trip)
    assert route.coordinates[0] == route.coordinates[-1] 

@pytest.mark.asyncio
async def test_optimize_route_no_round_trip(route_optimizer, sample_points):
    route = await route_optimizer.optimize_route(sample_points, round_trip=False)
    
    assert isinstance(route, Route)
    assert len(route.segments) > 0
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) == len(sample_points)  # No extra point for return
    assert route.coordinates[0] == sample_points[0]  # Should start at first point
    assert route.coordinates[-1] == sample_points[-1]  # Should end at last point

@pytest.mark.asyncio
async def test_kdtree_no_round_trip(kdtree_route_optimizer, sample_points):
    route = await kdtree_route_optimizer.optimize_route(sample_points, round_trip=False)
    
    assert isinstance(route, Route)
    assert len(route.segments) > 0
    assert route.total_distance > 0
    assert route.total_duration > 0
    assert len(route.coordinates) == len(sample_points)  # No extra point for return
    assert route.coordinates[0] == sample_points[0]  # Should start at first point
    assert route.coordinates[-1] == sample_points[-1]  # Should end at last point 