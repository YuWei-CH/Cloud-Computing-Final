from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from ..models import OptimizedRoute, RouteSegment
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from provider.base import Route, RouteSegment as ProviderRouteSegment, TransportMode
import logging

logger = logging.getLogger(__name__)

class RouteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_route(self, everyday_id: UUID, route: Route, transport_mode: TransportMode, round_trip: bool) -> OptimizedRoute:
        """
        Create a new optimized route for a day
        """
        # Create the route record
        db_route = OptimizedRoute(
            everyday_id=everyday_id,
            total_distance=route.total_distance,
            total_duration=route.total_duration,
            transport_mode=transport_mode.value,
            round_trip=round_trip
        )
        self.session.add(db_route)
        await self.session.flush()
        
        # Create the route segments
        for i, segment in enumerate(route.segments):
            # Extract start and end coordinates
            start_coord = segment.coordinates[0]
            end_coord = segment.coordinates[-1]
            
            # TODO: In a real implementation, we'd need to look up the location_ids from the coordinates
            # This is a simplified version that assumes we have location_ids
            # In practice, we would query the locations table to find the correct IDs
            
            db_segment = RouteSegment(
                route_id=db_route.id,
                segment_order=i,
                start_location_id=start_coord,  # This is a placeholder - would be replaced with actual location ID
                end_location_id=end_coord,      # This is a placeholder - would be replaced with actual location ID
                distance=segment.distance,
                duration=segment.duration,
                coordinates=segment.coordinates
            )
            self.session.add(db_segment)
        
        await self.session.commit()
        return db_route

    async def get_route_by_everyday_id(self, everyday_id: UUID) -> Optional[OptimizedRoute]:
        """
        Get optimized route by everyday ID
        """
        query = select(OptimizedRoute).where(
            OptimizedRoute.everyday_id == everyday_id
        ).options(selectinload(OptimizedRoute.segments))
        
        result = await self.session.execute(query)
        return result.scalars().first()
    
    async def get_routes_by_trip_id(self, trip_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all optimized routes for a trip,
        including the day number for each route
        """
        # This query joins everyday and optimized_routes to get routes by trip
        query = """
        SELECT 
            r.*, 
            e.day_number
        FROM 
            optimized_routes r
        JOIN 
            everyday e ON r.everyday_id = e.id
        WHERE 
            e.trip_id = :trip_id
        ORDER BY 
            e.day_number
        """
        
        result = await self.session.execute(query, {"trip_id": trip_id})
        routes = []
        
        for row in result:
            # Convert raw query result to dictionary
            route_dict = {
                "id": row.id,
                "everyday_id": row.everyday_id,
                "day_number": row.day_number,
                "total_distance": row.total_distance,
                "total_duration": row.total_duration,
                "transport_mode": row.transport_mode,
                "round_trip": row.round_trip,
                "created_at": row.created_at,
                "updated_at": row.updated_at
            }
            routes.append(route_dict)
            
        return routes
    
    async def update_route(self, route_id: UUID, route_data: Dict[str, Any]) -> bool:
        """
        Update route information
        """
        stmt = update(OptimizedRoute).where(
            OptimizedRoute.id == route_id
        ).values(**route_data)
        
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0
    
    async def delete_route(self, route_id: UUID) -> bool:
        """
        Delete a route and all its segments
        """
        stmt = delete(OptimizedRoute).where(
            OptimizedRoute.id == route_id
        )
        
        result = await self.session.execute(stmt)
        await self.session.commit()
        return result.rowcount > 0
        
    async def get_route_for_day(self, trip_id: UUID, day_number: int) -> Optional[OptimizedRoute]:
        """
        Get optimized route for a specific day in a trip
        """
        query = """
        SELECT 
            r.*
        FROM 
            optimized_routes r
        JOIN 
            everyday e ON r.everyday_id = e.id
        WHERE 
            e.trip_id = :trip_id AND
            e.day_number = :day_number
        """
        
        result = await self.session.execute(
            query, 
            {"trip_id": trip_id, "day_number": day_number}
        )
        route = result.mappings().first()
        
        if not route:
            return None
            
        # Get segments for this route
        segments_query = select(RouteSegment).where(
            RouteSegment.route_id == route["id"]
        ).order_by(RouteSegment.segment_order)
        
        segments_result = await self.session.execute(segments_query)
        segments = segments_result.scalars().all()
        
        # Reconstruct the route with segments
        route_obj = OptimizedRoute(
            id=route["id"],
            everyday_id=route["everyday_id"],
            total_distance=route["total_distance"],
            total_duration=route["total_duration"],
            transport_mode=route["transport_mode"],
            round_trip=route["round_trip"],
            created_at=route["created_at"],
            updated_at=route["updated_at"]
        )
        route_obj.segments = segments
        
        return route_obj 