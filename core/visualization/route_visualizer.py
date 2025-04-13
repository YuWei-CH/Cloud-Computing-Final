import folium
from typing import List, Tuple, Optional, Dict, Any
from PIL import Image
import io
import base64
from provider.base import Route, TransportMode
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
        
    def _calculate_bounds_and_center(self, route: Dict[str, Any]) -> Tuple[Tuple[float, float], Tuple[float, float], Tuple[float, float]]:
        """Calculate the bounds and center of a route"""
        min_lat, max_lat = float('inf'), float('-inf')
        min_lon, max_lon = float('inf'), float('-inf')
        
        for segment in route["segments"]:
            # Check start location
            start_lat = segment["start_location"]["latitude"]
            start_lon = segment["start_location"]["longitude"]
            min_lat = min(min_lat, start_lat)
            max_lat = max(max_lat, start_lat)
            min_lon = min(min_lon, start_lon)
            max_lon = max(max_lon, start_lon)
            
            # Check end location
            end_lat = segment["end_location"]["latitude"]
            end_lon = segment["end_location"]["longitude"]
            min_lat = min(min_lat, end_lat)
            max_lat = max(max_lat, end_lat)
            min_lon = min(min_lon, end_lon)
            max_lon = max(max_lon, end_lon)
            
            # Check route coordinates
            if segment["coordinates"]:
                for coord in segment["coordinates"]:
                    min_lat = min(min_lat, coord[0])
                    max_lat = max(max_lat, coord[0])
                    min_lon = min(min_lon, coord[1])
                    max_lon = max(max_lon, coord[1])
        
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
            # Add padding to ensure the route is fully visible
            control_scale=True
        )
        
    def _add_route_to_map(self, 
                         map_obj: folium.Map, 
                         route: Dict[str, Any], 
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
        for i, segment in enumerate(route["segments"]):
            # Choose color for this segment
            segment_color = self.SEGMENT_COLORS[i % len(self.SEGMENT_COLORS)] if use_different_colors else color
            
            # Add the segment line with increased weight for single-day routes
            if segment["coordinates"]:
                # Make the route line bolder for single-day routes
                line_weight = 8 if use_different_colors else weight  # Increased weight from 5 to 8
                
                folium.PolyLine(
                    locations=segment["coordinates"],
                    color=segment_color,
                    weight=line_weight,
                    opacity=0.8
                ).add_to(map_obj)
            
            # Add markers for start and end locations
            start_loc = segment["start_location"]
            end_loc = segment["end_location"]
            
            # Start point marker with larger icon
            folium.Marker(
                location=[start_loc["latitude"], start_loc["longitude"]],
                popup=start_loc["name"],
                icon=folium.Icon(
                    color="green" if not use_different_colors else segment_color,
                    icon="play",
                    prefix="fa"
                )
            ).add_to(map_obj)
            
            # End point marker with larger icon
            folium.Marker(
                location=[end_loc["latitude"], end_loc["longitude"]],
                popup=end_loc["name"],
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
                            <div><strong>From:</strong> {start_loc["name"]}</div>
                            <div><strong>To:</strong> {end_loc["name"]}</div>
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
                       route: Dict[str, Any],
                       center: Optional[Tuple[float, float]] = None,
                       zoom: Optional[int] = None) -> str:
        """
        Create a visualization of the route and return it as a base64-encoded PNG.
        
        Args:
            route: The route to visualize (in dictionary format)
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
        
    def visualize_multi_day_routes(self, routes: List[Dict[str, Any]]) -> str:
        """
        Create a visualization of multiple day routes on a single map.
        Each day's route will be shown with a different color.
        
        Args:
            routes: List of route dictionaries, each containing a 'day_number' key
            
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
        
        # Calculate zoom level for all routes
        zoom = self._calculate_zoom(overall_bounds)
        
        # Create the map
        map_obj = self._create_base_map(overall_center, zoom)
        
        # Create a sidebar for day information
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
            <h3 style="margin-top: 0;">Multi-Day Trip</h3>
            <div id="days-list">
        """
        
        # Add each route with a different color
        for route in routes:
            day_number = route.get("day_number", 1)
            color = self.DAY_COLORS[(day_number - 1) % len(self.DAY_COLORS)]
            
            # Add only start and end points for each day
            self._add_route_to_map(
                map_obj, 
                route, 
                color=color,
                show_labels=False,
                use_different_colors=False  # Ensure we use the same color for the entire route
            )
            
            # Add day number label
            if route["segments"]:
                first_segment = route["segments"][0]
                start_loc = first_segment["start_location"]
                
                # Add to sidebar
                sidebar_html += f"""
                    <div style="margin-bottom: 15px;">
                        <div style="display: flex; align-items: center;">
                            <div style="width: 20px; height: 20px; background-color: {color}; margin-right: 10px;"></div>
                            <div>
                                <div style="font-weight: bold;">Day {day_number}</div>
                                <div><strong>Start:</strong> {first_segment["start_location"]["name"]}</div>
                                <div><strong>End:</strong> {first_segment["end_location"]["name"]}</div>
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
        map_obj.get_root().html.add_child(folium.Element(sidebar_html))
        
        # Convert map to PNG
        img_data = map_obj._to_png(5)
        
        # Convert to base64
        img = Image.open(io.BytesIO(img_data))
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        return base64.b64encode(buffered.getvalue()).decode() 