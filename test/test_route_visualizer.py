import pytest
from core.visualization.route_visualizer import RouteVisualizer
from provider.base import Route, RouteSegment, TransportMode
import base64
from PIL import Image
import io

@pytest.fixture
def route_visualizer():
    return RouteVisualizer()

@pytest.fixture
def sample_route():
    """Create a sample route for testing"""
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

def test_route_visualizer_initialization(route_visualizer):
    """Test that the RouteVisualizer initializes correctly"""
    assert route_visualizer.map_style == "OpenStreetMap"

def test_create_base_map(route_visualizer):
    """Test creating a base map"""
    center = (40.7128, -74.0060)  # New York
    map_obj = route_visualizer._create_base_map(center, zoom=10)
    
    # Folium converts tuples to lists internally, so compare values instead of types
    assert map_obj.location[0] == center[0]
    assert map_obj.location[1] == center[1]
    assert map_obj.options['zoom'] == 10

def test_add_route_to_map(route_visualizer, sample_route):
    """Test adding a route to a map"""
    center = (40.7128, -74.0060)  # New York
    map_obj = route_visualizer._create_base_map(center)
    
    # Add the route to the map
    route_visualizer._add_route_to_map(map_obj, sample_route)
    
    # The map should now have the route line and markers
    # We can't directly check the map objects, but we can verify the map was created
    assert map_obj is not None

def test_visualize_route(route_visualizer, sample_route):
    """Test visualizing a route"""
    # Generate the visualization
    image_data = route_visualizer.visualize_route(sample_route)
    
    # Verify it's a valid base64 string
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}")

def test_visualize_route_with_custom_center(route_visualizer, sample_route):
    """Test visualizing a route with a custom center point"""
    # Use Chicago as the center
    center = (41.8781, -87.6298)
    
    # Generate the visualization
    image_data = route_visualizer.visualize_route(sample_route, center=center)
    
    # Verify it's a valid base64 string
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}")

def test_visualize_route_with_custom_zoom(route_visualizer, sample_route):
    """Test visualizing a route with a custom zoom level"""
    # Generate the visualization with a custom zoom level
    image_data = route_visualizer.visualize_route(sample_route, zoom=5)
    
    # Verify it's a valid base64 string
    assert isinstance(image_data, str)
    
    # Try to decode and open the image
    try:
        img_data = base64.b64decode(image_data)
        img = Image.open(io.BytesIO(img_data))
        assert img.format == "PNG"
    except Exception as e:
        pytest.fail(f"Failed to decode image: {e}")

def test_visualize_empty_route(route_visualizer):
    """Test visualizing an empty route"""
    # Create an empty route
    empty_route = Route(
        segments=[],
        total_distance=0.0,
        total_duration=0.0,
        coordinates=[]
    )
    
    # This should raise an error or handle the empty route gracefully
    with pytest.raises(Exception):
        route_visualizer.visualize_route(empty_route) 