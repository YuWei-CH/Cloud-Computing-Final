from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, text
from sqlalchemy.orm import selectinload
from ..models import OptimizedRoute, RouteSegment
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from provider.base import Route, RouteSegment as ProviderRouteSegment, TransportMode
import logging
from geopy.geocoders import Nominatim

logger = logging.getLogger(__name__)

class RouteRepository:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.geocoder = Nominatim(user_agent="tripplanner")

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
        
    async def get_everyday_id_for_trip_day(self, trip_id: UUID, day_number: int) -> Optional[UUID]:
        """
        Get the everyday ID for a specific day in a trip
        """
        query = """
        SELECT 
            id
        FROM 
            everyday
        WHERE 
            trip_id = :trip_id AND
            day_number = :day_number
        """
        
        result = await self.session.execute(
            query, 
            {"trip_id": trip_id, "day_number": day_number}
        )
        everyday = result.fetchone()
        
        return everyday[0] if everyday else None
        
    async def get_locations_for_everyday(self, everyday_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all locations for a specific day including coordinates
        """
        query = """
        SELECT 
            l.id, 
            l.name, 
            l.address
        FROM 
            locations l
        JOIN 
            everyday_locations el ON l.id = el.location_id
        WHERE 
            el.everyday_id = :everyday_id
        ORDER BY 
            el.id
        """
        
        result = await self.session.execute(query, {"everyday_id": everyday_id})
        locations = []
        
        for row in result.mappings():
            # Convert address to coordinates using geocoding
            # In a production environment, we would likely have lat/lng stored in the database
            # or use a more robust geocoding service with proper caching
            location = {
                "id": row["id"],
                "name": row["name"],
                "address": row["address"],
            }
            locations.append(location)
            
        return locations
        
    async def geocode_address(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Convert address to coordinates using geocoding
        """
        try:
            location = self.geocoder.geocode(address)
            if location:
                return (location.latitude, location.longitude)
        except Exception as e:
            logger.error(f"Error geocoding address {address}: {e}")
        return None
        
    async def get_location_coordinates(self, location_ids: List[UUID]) -> List[Tuple[float, float]]:
        """
        Get coordinates for a list of location IDs
        This is a simplified version that uses a mock
        In a real implementation, we would query the database and use geocoding if needed
        """
        # Query to get addresses for the provided location IDs
        query = """
        SELECT 
            id, 
            address
        FROM 
            locations
        WHERE 
            id = ANY(:location_ids)
        """
        
        result = await self.session.execute(
            text(query), 
            {"location_ids": location_ids}
        )
        
        coordinates = []
        
        # For now, we'll return mock coordinates based on the IDs
        # In a real implementation, we would use the addresses and geocode them
        for row in result:
            # Replace this with real geocoding
            if row[1]:  # If we have an address
                coord = await self.geocode_address(row[1])
                if coord:
                    coordinates.append(coord)
                else:
                    # Mock coordinates if geocoding fails
                    # In production, we would have better fallback mechanisms
                    import hashlib
                    # Generate deterministic fake coordinates from UUID
                    hash_obj = hashlib.md5(str(row[0]).encode())
                    hash_bytes = hash_obj.digest()
                    # Create a latitude between -90 and 90
                    lat = ((hash_bytes[0] / 255) * 180) - 90
                    # Create a longitude between -180 and 180
                    lon = ((hash_bytes[1] / 255) * 360) - 180
                    coordinates.append((lat, lon))
            else:
                # Mock coordinates if no address
                coordinates.append((0, 0))
        
        return coordinates 

    async def get_everyday_location_ids(self, everyday_id: UUID) -> List[UUID]:
        """
        Get all location IDs for a specific day
        """
        query = """
        SELECT 
            location_id
        FROM 
            everyday_locations
        WHERE 
            everyday_id = :everyday_id
        ORDER BY
            id
        """
        
        result = await self.session.execute(
            text(query), 
            {"everyday_id": everyday_id}
        )
        
        # Extract UUIDs from the result
        location_ids = [row[0] for row in result]
        return location_ids 