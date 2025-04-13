import pytest
from core.workflow.route_planner import RoutePlanner
from core.visualization.route_visualizer import RouteVisualizer
from provider.osrm_provider import OSRMProvider
from provider.base import TransportMode
import base64
from PIL import Image
import io

@pytest.fixture
def osrm_provider():
    return OSRMProvider()

@pytest.fixture
def route_planner(osrm_provider):
    return RoutePlanner(osrm_provider)

@pytest.fixture
def route_visualizer():
    return RouteVisualizer()

@pytest.fixture
def sample_points():
    return [
        (40.7128, -74.0060),  # New York
        (34.0522, -118.2437),  # Los Angeles
        (41.8781, -87.6298),  # Chicago
        (29.7604, -95.3698)   # Houston
    ]

@pytest.mark.asyncio
async def test_plan_and_visualize_route(route_planner, route_visualizer, sample_points):
    """Test planning a route and then visualizing it"""
    # Plan a route
    route = await route_planner.plan_route(sample_points)
    
    # Verify the route was created
    assert route is not None
    assert len(route.coordinates) > 0
    
    # Visualize the route
    image_data = route_visualizer.visualize_route(route)
    
    # Verify the image data is valid
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}")

@pytest.mark.asyncio
async def test_plan_and_visualize_route_with_mode(route_planner, route_visualizer, sample_points):
    """Test planning a route with a specific transport mode and then visualizing it"""
    # Plan a route with walking mode
    route = await route_planner.plan_route(sample_points, mode=TransportMode.WALKING)
    
    # Verify the route was created
    assert route is not None
    assert len(route.coordinates) > 0
    
    # Visualize the route
    image_data = route_visualizer.visualize_route(route)
    
    # Verify the image data is valid
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}")

@pytest.mark.asyncio
async def test_plan_and_visualize_route_with_start_end(route_planner, route_visualizer, sample_points):
    """Test planning a route with start and end points and then visualizing it"""
    # Define start and end points
    start_point = (40.7128, -74.0060)  # New York
    end_point = (29.7604, -95.3698)    # Houston
    
    # Plan a route with start and end points
    route = await route_planner.plan_route(
        points=sample_points[1:-1],  # Exclude start and end points
        start_point=start_point,
        end_point=end_point
    )
    
    # Verify the route was created
    assert route is not None
    assert len(route.coordinates) > 0
    
    # Visualize the route
    image_data = route_visualizer.visualize_route(route)
    
    # Verify the image data is valid
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}") 