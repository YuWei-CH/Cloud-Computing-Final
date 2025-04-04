from typing import List, Tuple, Dict
from provider.base import Route, RoutingProvider, TransportMode
import numpy as np
from itertools import permutations
from scipy.spatial import cKDTree

class RouteOptimizer:
    def __init__(self, provider: RoutingProvider, use_kdtree: bool = False):
        self.provider = provider
        self.use_kdtree = use_kdtree
        
    async def _optimize_with_kdtree(self, points: List[Tuple[float, float]], start_point: Tuple[float, float]) -> List[Tuple[float, float]]:
        """
        Optimize route using k-d tree based nearest neighbor search.
        O(n log n) complexity.
        """
        # Convert points to numpy array for k-d tree
        points_array = np.array(points)
        kdtree = cKDTree(points_array)
        
        # Start with start_point
        route = [start_point]
        remaining_points = points.copy()
        
        current_point = start_point
        while remaining_points:
            # Find nearest point using k-d tree: O(log n)
            _, idx = kdtree.query(current_point)
            next_point = tuple(points_array[idx])
            
            # Add to route and update remaining points
            route.append(next_point)
            remaining_points.remove(next_point)
            current_point = next_point
            
            # Update k-d tree with remaining points
            if remaining_points:
                points_array = np.array(remaining_points)
                kdtree = cKDTree(points_array)
        
        # Add return to start point
        route.append(start_point)
                
        return route

    async def optimize_route(self, points: List[Tuple[float, float]], 
                           start_point: Tuple[float, float] = None,
                           end_point: Tuple[float, float] = None,
                           round_trip: bool = True) -> Route:
        """
        Optimize the route between multiple points using the provided routing provider.
        
        Args:
            points: List of (latitude, longitude) tuples representing the points to visit
            start_point: Optional starting point. If not provided, first point in points list is used
            end_point: Optional ending point. If not provided and round_trip is True, returns to start point
            round_trip: Whether to return to the start point. Ignored if end_point is provided.
            
        Returns:
            Route object containing the optimized path
        """
        if not points:
            raise ValueError("No points provided")
            
        # Set start and end points
        if start_point is None:
            start_point = points[0]
        if end_point is None:
            end_point = start_point if round_trip else points[-1]  # Return to start if round_trip, else end at last point
            
        # Remove start and end points from the points list if they're in it
        remaining_points = [p for p in points if p not in [start_point, end_point]]
        
        # If we only have start and end points, return direct route
        if not remaining_points:
            return await self.provider.get_route(start_point, end_point)
        
        # Choose optimization method
        if self.use_kdtree:
            route_points = await self._optimize_with_kdtree(remaining_points, start_point)
            if not round_trip:
                route_points.pop()  # Remove the return-to-start point
            if end_point != route_points[-1]:
                route_points.append(end_point)
        else:
            # Get distance matrix for all points
            all_points = [start_point] + remaining_points + [end_point]
            distance_matrix = await self.provider.get_distance_matrix(all_points)
            
            # Find optimal route using nearest neighbor algorithm
            current_point = start_point
            route_points = [start_point]
            unvisited = remaining_points.copy()
            
            while unvisited:
                # Find nearest unvisited point
                min_distance = float('inf')
                next_point = None
                
                for point in unvisited:
                    distance = distance_matrix[(current_point, point)]
                    if distance < min_distance:
                        min_distance = distance
                        next_point = point
                        
                route_points.append(next_point)
                unvisited.remove(next_point)
                current_point = next_point
                
            # Add end point if needed
            if end_point != route_points[-1]:
                route_points.append(end_point)
        
        # Create route segments
        segments = []
        total_distance = 0
        total_duration = 0
        coordinates = []
        
        for i in range(len(route_points) - 1):
            segment = await self.provider.get_route(route_points[i], route_points[i + 1])
            segments.extend(segment.segments)
            total_distance += segment.total_distance
            total_duration += segment.total_duration
            if i == 0:
                coordinates.extend(segment.coordinates)
            else:
                coordinates.extend(segment.coordinates[1:])  # Skip first point to avoid duplicates
            
        return Route(
            segments=segments,
            total_distance=total_distance,
            total_duration=total_duration,
            coordinates=coordinates
        )
        
    async def get_route_statistics(self, route: Route) -> Dict:
        """
        Calculate statistics for a given route.
        
        Args:
            route: Route object to analyze
            
        Returns:
            Dictionary containing route statistics
        """
        return {
            'total_distance': route.total_distance,
            'total_duration': route.total_duration,
            'number_of_segments': len(route.segments),
            'average_segment_distance': route.total_distance / len(route.segments) if route.segments else 0,
            'average_segment_duration': route.total_duration / len(route.segments) if route.segments else 0
        } 