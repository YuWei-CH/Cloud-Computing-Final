from typing import List, Tuple, Dict, Optional
from provider.base import RoutingProvider, Route, TransportMode
from core.optimization.route_optimizer import RouteOptimizer

class RoutePlanner:
    def __init__(self, 
                 provider: RoutingProvider,
                 use_kdtree: bool = False,
                 default_mode: TransportMode = TransportMode.DRIVING):
        """
        Initialize the route planner with a routing provider and optimization settings.
        
        Args:
            provider: The routing provider to use for getting routes and matrices
            use_kdtree: Whether to use k-d tree optimization (faster for large datasets)
            default_mode: Default transportation mode to use
        """
        self.provider = provider
        self.optimizer = RouteOptimizer(provider, use_kdtree=use_kdtree)
        self.default_mode = default_mode
        
    async def plan_route(self,
                        points: List[Tuple[float, float]],
                        start_point: Optional[Tuple[float, float]] = None,
                        end_point: Optional[Tuple[float, float]] = None,
                        round_trip: bool = True,
                        mode: Optional[TransportMode] = None) -> Route:
        """
        Plan an optimized route between multiple points.
        
        Args:
            points: List of points to visit
            start_point: Optional starting point
            end_point: Optional ending point
            round_trip: Whether to return to start point
            mode: Transportation mode to use (defaults to self.default_mode)
            
        Returns:
            Optimized route
        """
        # Use default mode if none specified
        mode = mode or self.default_mode
        
        # Get optimized route order
        route = await self.optimizer.optimize_route(
            points=points,
            start_point=start_point,
            end_point=end_point,
            round_trip=round_trip
        )
        
        return route
        
    async def get_distance_matrix(self, points: List[Tuple[float, float]]) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get distance matrix between all points."""
        return await self.provider.get_distance_matrix(points)
        
    async def get_duration_matrix(self, points: List[Tuple[float, float]]) -> Dict[Tuple[Tuple[float, float], Tuple[float, float]], float]:
        """Get duration matrix between all points."""
        return await self.provider.get_duration_matrix(points)
        
    async def get_route_statistics(self, route: Route) -> Dict[str, float]:
        """Get statistics for a route."""
        return {
            "total_distance": route.total_distance,
            "total_duration": route.total_duration,
            "average_speed": route.total_distance / route.total_duration if route.total_duration > 0 else 0
        } 