from typing import List, Tuple, Dict, Optional, Set
from .base import RoutingProvider, Route, RouteSegment, TransportMode

class MockProvider(RoutingProvider):
    """Mock routing provider for testing"""
    
    def __init__(self):
        self._valid_points: Set[Tuple[float, float]] = set()
    
    def add_valid_point(self, point: Tuple[float, float]):
        """Add a point to the set of valid points"""
        self._valid_points.add(point)
    
    async def get_route(
        self, 
        start: Tuple[float, float], 
        end: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> Route:
        """Get a mock route between two points"""
        # Calculate distance using Euclidean distance
        distance = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5 * 111000  # Convert to meters
        
        # Calculate duration based on mode
        mode = mode or TransportMode.DRIVING
        if mode == TransportMode.DRIVING:
            duration = distance / 13.89  # 50 km/h = 13.89 m/s
        elif mode == TransportMode.WALKING:
            duration = distance / 1.4  # 5 km/h = 1.4 m/s
        else:  # Cycling
            duration = distance / 5  # 18 km/h = 5 m/s
        
        # Create a simple route with start and end points
        coordinates = [start, end]
        
        # Create route segment
        segment = RouteSegment(
            distance=distance,
            duration=duration,
            coordinates=coordinates,
            mode=mode
        )
        
        return Route(
            segments=[segment],
            total_distance=distance,
            total_duration=duration,
            coordinates=coordinates
        )
    
    async def get_distance_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of distances between all pairs of points"""
        matrix = {}
        for i, start in enumerate(points):
            for j, end in enumerate(points):
                if i == j:
                    matrix[(start, end)] = 0
                else:
                    distance = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5 * 111000
                    matrix[(start, end)] = distance
        return matrix
    
    async def get_duration_matrix(
        self, 
        points: List[Tuple[float, float]],
        mode: Optional[TransportMode] = None
    ) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get a matrix of durations between all pairs of points"""
        mode = mode or TransportMode.DRIVING
        matrix = {}
        for i, start in enumerate(points):
            for j, end in enumerate(points):
                if i == j:
                    matrix[(start, end)] = 0
                else:
                    distance = ((end[0] - start[0])**2 + (end[1] - start[1])**2)**0.5 * 111000
                    if mode == TransportMode.DRIVING:
                        duration = distance / 13.89  # 50 km/h = 13.89 m/s
                    elif mode == TransportMode.WALKING:
                        duration = distance / 1.4  # 5 km/h = 1.4 m/s
                    else:  # Cycling
                        duration = distance / 5  # 18 km/h = 5 m/s
                    matrix[(start, end)] = duration
        return matrix
    
    async def is_valid_point(
        self, 
        point: Tuple[float, float],
        mode: Optional[TransportMode] = None
    ) -> bool:
        """Check if a point is valid"""
        return point in self._valid_points 