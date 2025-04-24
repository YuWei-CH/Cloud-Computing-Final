import folium
from typing import List, Tuple, Optional, Dict, Any
from PIL import Image
import io
import base64
from provider.base import Route, RouteSegment, TransportMode
import math
import random

class RouteVisualizer:
    """Handles visualization of routes on maps"""
    
    # Color palette for different days
    DAY_COLORS = [
        "blue", "red", "green", "purple", "orange", 
        "darkred", "lightred", "beige", "darkblue", "darkgreen"
    ]
    
    # Color palette for segments within a day
    SEGMENT_COLORS = [
        "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
        "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"
    ]
    
    def __init__(self, map_style: str = "OpenStreetMap"):
        """
        Initialize the route visualizer.
        
        Args:
            map_style: The map style to use (default: OpenStreetMap)
        """
        self.map_style = map_style
        
    def _calculate_bounds_and_center(self, route: Route) -> Tuple[Tuple[float, float], Tuple[float, float]]:
        """Calculate the bounds and center of a route"""
        min_lat, max_lat = float('inf'), float('-inf')
        min_lon, max_lon = float('inf'), float('-inf')
        
        for segment in route.segments:
            # Check coordinates in the segment
            for lat, lon in segment.coordinates:
                min_lat = min(min_lat, lat)
                max_lat = max(max_lat, lat)
                min_lon = min(min_lon, lon)
                max_lon = max(max_lon, lon)
        
        center = ((min_lat + max_lat) / 2, (min_lon + max_lon) / 2)
        bounds = ((min_lat, min_lon), (max_lat, max_lon))
        return center, bounds
        
    def _calculate_zoom(self, bounds: Tuple[Tuple[float, float], Tuple[float, float]]) -> int:
        """Calculate optimal zoom level based on bounds"""
        lat_diff = abs(bounds[1][0] - bounds[0][0])
        lon_diff = abs(bounds[1][1] - bounds[0][1])
        
        # Calculate zoom based on the larger difference
        max_diff = max(lat_diff, lon_diff)
        
        # Convert to zoom level (approximate)
        # Increased the zoom level by adjusting the formula
        zoom = math.floor(math.log2(180 / max_diff)) + 2
        
        # Clamp zoom level between 3 and 18
        return max(3, min(18, zoom))
        
    def _create_base_map(self, center: Tuple[float, float], zoom: int = 10) -> folium.Map:
        """Create a base map centered on the given coordinates"""
        return folium.Map(
            location=center,
            zoom_start=zoom,
            tiles=self.map_style,
            control_scale=True
        )
        
    def _add_route_to_map(self, 
                         map_obj: folium.Map, 
                         route: Route, 
                         color: str = "blue",
                         weight: int = 3,
                         show_labels: bool = True,
                         use_different_colors: bool = False) -> None:
        """Add a route to the map with the specified style"""
        # Create a sidebar for location names
        sidebar_html = """
        <div style="position: fixed; 
                    top: 10px; 
                    left: 10px; 
                    width: 200px; 
                    height: auto; 
                    background-color: white; 
                    border: 2px solid grey; 
                    border-radius: 5px; 
                    padding: 10px; 
                    z-index: 9999;
                    font-family: Arial, sans-serif;">
            <h3 style="margin-top: 0; color: {color};">Route Locations</h3>
            <div id="locations-list">
        """
        
        # Process each segment
        for i, segment in enumerate(route.segments):
            # Choose color for this segment
            segment_color = self.SEGMENT_COLORS[i % len(self.SEGMENT_COLORS)] if use_different_colors else color
            
            # Add the segment line
            if segment.coordinates:
                # Make the route line bolder for single-day routes
                line_weight = 8 if use_different_colors else weight
                
                folium.PolyLine(
                    locations=segment.coordinates,
                    color=segment_color,
                    weight=line_weight,
                    opacity=0.8
                ).add_to(map_obj)
            
            # Add markers for start and end points
            if len(segment.coordinates) > 0:
                start_point = segment.coordinates[0]
                end_point = segment.coordinates[-1]
                
                # Start point marker
                folium.Marker(
                    location=start_point,
                    icon=folium.Icon(
                        color="green" if not use_different_colors else segment_color,
                        icon="play",
                        prefix="fa"
                    )
                ).add_to(map_obj)
                
                # End point marker
                folium.Marker(
                    location=end_point,
                    icon=folium.Icon(
                        color="red" if not use_different_colors else segment_color,
                        icon="stop",
                        prefix="fa"
                    )
                ).add_to(map_obj)
                
                # Add to sidebar
                sidebar_html += f"""
                    <div style="margin-bottom: 10px;">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 20px; height: 20px; background-color: {segment_color}; margin-right: 10px;"></div>
                            <div>
                                <div><strong>Segment {i+1}</strong></div>
                                <div>Distance: {segment.distance:.1f}m</div>
                                <div>Duration: {segment.duration:.1f}s</div>
                            </div>
                        </div>
                    </div>
                """
        
        # Close sidebar HTML
        sidebar_html += """
            </div>
        </div>
        """
        
        # Add sidebar to map
        if show_labels:
            map_obj.get_root().html.add_child(folium.Element(sidebar_html))
    
    def visualize_route(self, 
                       route: Route,
                       center: Optional[Tuple[float, float]] = None,
                       zoom: Optional[int] = None) -> str:
        """
        Create a visualization of the route and return it as a base64-encoded PNG.
        
        Args:
            route: The Route object to visualize
            center: Optional center point for the map (defaults to calculated center)
            zoom: Optional zoom level (defaults to calculated zoom)
            
        Returns:
            Base64-encoded PNG image of the route visualization
        """
        # Calculate bounds and center if not provided
        if not center:
            center, bounds = self._calculate_bounds_and_center(route)
            
        # Calculate zoom if not provided
        if zoom is None:
            _, bounds = self._calculate_bounds_and_center(route)
            zoom = self._calculate_zoom(bounds)
            
        # Create the map
        map_obj = self._create_base_map(center, zoom)
        
        # Add the route to the map with different colors for segments
        self._add_route_to_map(
            map_obj, 
            route, 
            show_labels=True, 
            use_different_colors=True
        )
        
        # Convert map to PNG
        img_data = map_obj._to_png(5)  # 5 is the delay in seconds to allow map to render
        
        # Convert to base64
        img = Image.open(io.BytesIO(img_data))
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode()
        
    def visualize_multi_day_routes(self, routes: List[Route]) -> str:
        """
        Create a visualization of multiple day routes on a single map.
        Each day's route will be shown with a different color.
        
        Args:
            routes: List of Route objects
            
        Returns:
            Base64-encoded PNG image of the multi-day route visualization
        """
        if not routes:
            return ""
            
        # Calculate overall bounds and center
        min_lat, max_lat = float('inf'), float('-inf')
        min_lon, max_lon = float('inf'), float('-inf')
        
        for route in routes:
            center, bounds = self._calculate_bounds_and_center(route)
            min_lat = min(min_lat, bounds[0][0])
            max_lat = max(max_lat, bounds[1][0])
            min_lon = min(min_lon, bounds[0][1])
            max_lon = max(max_lon, bounds[1][1])
            
        overall_center = ((min_lat + max_lat) / 2, (min_lon + max_lon) / 2)
        overall_bounds = ((min_lat, min_lon), (max_lat, max_lon))
        zoom = self._calculate_zoom(overall_bounds)
        
        # Create the map
        map_obj = self._create_base_map(overall_center, zoom)
        
        # Add each route with a different color
        for i, route in enumerate(routes):
            color = self.DAY_COLORS[i % len(self.DAY_COLORS)]
            self._add_route_to_map(map_obj, route, color=color)
        
        # Convert map to PNG
        img_data = map_obj._to_png(5)
        
        # Convert to base64
        img = Image.open(io.BytesIO(img_data))
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode() 