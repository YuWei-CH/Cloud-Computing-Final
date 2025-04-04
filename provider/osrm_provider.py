import aiohttp
from typing import List, Tuple, Dict, Optional
from .base import RoutingProvider, Route, RouteSegment, TransportMode

class OSRMProvider(RoutingProvider):
    """OSRM routing provider implementation with support for multiple transport modes"""
    
    def __init__(self, base_url: str = "http://router.project-osrm.org"):
        self.base_url = base_url.rstrip('/')
    
    async def get_route(
        self, 
        start: Tuple[float, float], 
        end: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> Route:
        """Get a route between two points using OSRM"""
        transport_mode = mode.value if mode else TransportMode.DRIVING.value
        
        url = f"{self.base_url}/route/v1/{transport_mode}/{start[1]},{start[0]};{end[1]},{end[0]}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "annotations": "true"
        }
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    raise Exception(f"OSRM request failed: {await response.text()}")
                
                data = await response.json()
                route_data = data['routes'][0]
                
                # Extract coordinates
                coordinates = [
                    (coord[1], coord[0])  # OSRM returns [lng, lat], we use [lat, lng]
                    for coord in route_data['geometry']['coordinates']
                ]
                
                # Create route segment
                segment = RouteSegment(
                    distance=route_data['distance'],
                    duration=route_data['duration'],
                    coordinates=coordinates,
                    mode=mode or TransportMode.DRIVING
                )
                
                return Route(
                    segments=[segment],
                    total_distance=route_data['distance'],
                    total_duration=route_data['duration'],
                    coordinates=coordinates
                )
    
    async def get_distance_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of distances between all pairs of points"""
        transport_mode = mode.value if mode else TransportMode.DRIVING.value
        
        # Format coordinates for OSRM
        coords = ";".join(f"{p[1]},{p[0]}" for p in points)
        url = f"{self.base_url}/table/v1/{transport_mode}/{coords}"
        params = {"annotations": "distance"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    raise Exception(f"OSRM matrix request failed: {await response.text()}")
                
                data = await response.json()
                distances = data['distances']
                
                # Convert to our format
                matrix = {}
                for i, row in enumerate(distances):
                    for j, distance in enumerate(row):
                        matrix[(points[i], points[j])] = distance
                return matrix
    
    async def get_duration_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of durations between all pairs of points"""
        transport_mode = mode.value if mode else TransportMode.DRIVING.value
        
        # Format coordinates for OSRM
        coords = ";".join(f"{p[1]},{p[0]}" for p in points)
        url = f"{self.base_url}/table/v1/{transport_mode}/{coords}"
        params = {"annotations": "duration"}
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url, params=params) as response:
                if response.status != 200:
                    raise Exception(f"OSRM matrix request failed: {await response.text()}")
                
                data = await response.json()
                durations = data['durations']
                
                # Convert to our format
                matrix = {}
                for i, row in enumerate(durations):
                    for j, duration in enumerate(row):
                        matrix[(points[i], points[j])] = duration
                
                return matrix
    
    async def is_valid_point(
        self, 
        point: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> bool:
        """Check if a point is valid and reachable"""
        transport_mode = mode.value if mode else TransportMode.DRIVING.value
        
        url = f"{self.base_url}/nearest/v1/{transport_mode}/{point[1]},{point[0]}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                if response.status != 200:
                    return False
                
                data = await response.json()
                # Check if the nearest point is within 100 meters
                return data['code'] == 'Ok' and data['waypoints'][0]['distance'] < 100 