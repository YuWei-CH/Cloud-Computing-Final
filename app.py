# Import necessary libraries
from fastapi import FastAPI, HTTPException, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional, Dict, Any
import uvicorn
from config import settings
from provider.osrm_provider import OSRMProvider
from provider.base import TransportMode, Route
from core.workflow.route_planner import RoutePlanner
from sqlalchemy.ext.asyncio import AsyncSession
from storage.db import get_db
from storage.repositories.route_repository import RouteRepository
from uuid import UUID

# Initialize FastAPI application with metadata
app = FastAPI(
    title="TripPlanner API",
    description="Route optimization service with AWS compatibility",
    version="1.0.0"
)

# Initialize providers and planner
osrm_provider = OSRMProvider()
route_planner = RoutePlanner(osrm_provider)

# Define data models using Pydantic
class Point(BaseModel):
    lat: float = Field(..., description="Latitude coordinate")
    lon: float = Field(..., description="Longitude coordinate")

class RouteRequest(BaseModel):
    points: List[Point] = Field(..., description="List of points to visit")
    start_point: Optional[Point] = Field(None, description="Optional starting point (defaults to first point)")
    end_point: Optional[Point] = Field(None, description="Optional ending point (defaults to start point for round trips)")
    round_trip: bool = Field(True, description="Whether to return to starting point")
    mode: TransportMode = Field(TransportMode.DRIVING, description="Transportation mode")

class RouteStatistics(BaseModel):
    total_distance: float = Field(..., description="Total distance in meters")
    total_duration: float = Field(..., description="Total duration in seconds")
    average_speed: float = Field(..., description="Average speed in m/s")

class RouteSegmentResponse(BaseModel):
    distance: float = Field(..., description="Segment distance in meters")
    duration: float = Field(..., description="Segment duration in seconds")
    coordinates: List[Tuple[float, float]] = Field(..., description="List of coordinates")
    mode: TransportMode = Field(..., description="Transportation mode")

class RouteResponse(BaseModel):
    total_distance: float = Field(..., description="Total distance in meters")
    total_duration: float = Field(..., description="Total duration in seconds")
    coordinates: List[Tuple[float, float]] = Field(..., description="List of coordinates for the entire route")
    segments: List[RouteSegmentResponse] = Field(..., description="List of route segments")
    statistics: RouteStatistics = Field(..., description="Route statistics")

class TripRouteRequest(BaseModel):
    locations: List[UUID] = Field(..., description="List of location IDs to visit")
    mode: TransportMode = Field(TransportMode.DRIVING, description="Transportation mode")
    round_trip: bool = Field(True, description="Whether to return to starting point")

class DayRouteResponse(BaseModel):
    id: UUID = Field(..., description="Route ID")
    day_number: int = Field(..., description="Day number in the trip")
    total_distance: float = Field(..., description="Total distance in meters")
    total_duration: float = Field(..., description="Total duration in seconds")
    transport_mode: str = Field(..., description="Transportation mode")
    round_trip: bool = Field(..., description="Whether this is a round trip")
    segments: List[Dict[str, Any]] = Field(..., description="Route segments details")

# Health check endpoint
@app.get("/")
async def root():
    return {
        "status": "healthy", 
        "environment": settings.ENV
    }

# Main route optimization endpoint
@app.post("/optimize", response_model=RouteResponse)
async def optimize_route(request: RouteRequest):
    """
    Optimize a route between multiple points.
    
    - **points**: List of points to visit (required)
    - **start_point**: Optional starting point (defaults to first point)
    - **end_point**: Optional ending point (defaults to start point for round trips)
    - **round_trip**: Whether to return to starting point (default: true)
    - **mode**: Transportation mode (driving, walking, cycling)
    """
    try:
        # Convert points to tuples
        points = [(p.lat, p.lon) for p in request.points]
        
        # Handle optional start and end points
        start_point = (request.start_point.lat, request.start_point.lon) if request.start_point else None
        end_point = (request.end_point.lat, request.end_point.lon) if request.end_point else None
        
        # Get optimized route
        route = await route_planner.plan_route(
            points=points,
            start_point=start_point,
            end_point=end_point,
            round_trip=request.round_trip,
            mode=request.mode
        )
        
        # Get route statistics
        stats = await route_planner.get_route_statistics(route)
        
        # Convert route to response model
        return RouteResponse(
            total_distance=route.total_distance,
            total_duration=route.total_duration,
            coordinates=route.coordinates,
            segments=[
                RouteSegmentResponse(
                    distance=segment.distance,
                    duration=segment.duration,
                    coordinates=segment.coordinates,
                    mode=segment.mode
                ) for segment in route.segments
            ],
            statistics=RouteStatistics(
                total_distance=stats["total_distance"],
                total_duration=stats["total_duration"],
                average_speed=stats["average_speed"]
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matrix/distance")
async def get_distance_matrix(points: List[str] = Query(..., description="Points in format 'lat,lon'")):
    """
    Get distance matrix between multiple points.
    
    - **points**: List of points in format 'lat,lon' (e.g. '40.7128,-74.0060')
    """
    try:
        # Parse points from query parameters
        point_tuples = [tuple(map(float, p.split(","))) for p in points]
        
        # Get distance matrix
        matrix = await route_planner.get_distance_matrix(point_tuples)
        
        # Convert matrix to a more user-friendly format
        result = {}
        for (src, dst), distance in matrix.items():
            src_str = f"{src[0]},{src[1]}"
            dst_str = f"{dst[0]},{dst[1]}"
            if src_str not in result:
                result[src_str] = {}
            result[src_str][dst_str] = distance
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matrix/duration")
async def get_duration_matrix(points: List[str] = Query(..., description="Points in format 'lat,lon'")):
    """
    Get duration matrix between multiple points.
    
    - **points**: List of points in format 'lat,lon' (e.g. '40.7128,-74.0060')
    """
    try:
        # Parse points from query parameters
        point_tuples = [tuple(map(float, p.split(","))) for p in points]
        
        # Get duration matrix
        matrix = await route_planner.get_duration_matrix(point_tuples)
        
        # Convert matrix to a more user-friendly format
        result = {}
        for (src, dst), duration in matrix.items():
            src_str = f"{src[0]},{src[1]}"
            dst_str = f"{dst[0]},{dst[1]}"
            if src_str not in result:
                result[src_str] = {}
            result[src_str][dst_str] = duration
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for trip route optimization
@app.post("/trips/{trip_id}/days/{day_number}/optimize")
async def optimize_day_route(
    trip_id: UUID,
    day_number: int,
    request: TripRouteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize a route for a specific day in a trip.
    
    - **trip_id**: ID of the trip
    - **day_number**: Day number in the trip
    - **locations**: List of location IDs to include in the route
    - **mode**: Transportation mode
    - **round_trip**: Whether to return to the starting point
    """
    try:
        # TODO: Get everyday_id from trip_id and day_number
        # This would require a query to the everyday table
        everyday_id = None  # This would be replaced with a real ID from the database
        
        # TODO: Get location coordinates from location IDs
        # This would require a query to the locations table
        # For now, we'll use mock coordinates
        location_coords = []
        
        # Calculate optimized route
        route = await route_planner.plan_route(
            points=location_coords,
            round_trip=request.round_trip,
            mode=request.mode
        )
        
        # Store the optimized route in the database
        route_repo = RouteRepository(db)
        db_route = await route_repo.create_route(
            everyday_id=everyday_id,
            route=route,
            transport_mode=request.mode,
            round_trip=request.round_trip
        )
        
        return {
            "message": "Route optimized and stored successfully",
            "route_id": db_route.id,
            "total_distance": route.total_distance,
            "total_duration": route.total_duration
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get route for a specific day in a trip
@app.get("/trips/{trip_id}/days/{day_number}/route")
async def get_day_route(
    trip_id: UUID,
    day_number: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the optimized route for a specific day in a trip.
    
    - **trip_id**: ID of the trip
    - **day_number**: Day number in the trip
    """
    try:
        route_repo = RouteRepository(db)
        route = await route_repo.get_route_for_day(trip_id, day_number)
        
        if not route:
            raise HTTPException(status_code=404, detail="Route not found for this day")
        
        # Format the response
        segments = []
        for segment in route.segments:
            segments.append({
                "id": segment.id,
                "order": segment.segment_order,
                "start_location_id": segment.start_location_id,
                "end_location_id": segment.end_location_id,
                "distance": segment.distance,
                "duration": segment.duration,
                "coordinates": segment.coordinates
            })
        
        return DayRouteResponse(
            id=route.id,
            day_number=day_number,
            total_distance=route.total_distance,
            total_duration=route.total_duration,
            transport_mode=route.transport_mode,
            round_trip=route.round_trip,
            segments=segments
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Get all routes for a trip
@app.get("/trips/{trip_id}/routes")
async def get_trip_routes(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all optimized routes for a trip.
    
    - **trip_id**: ID of the trip
    """
    try:
        route_repo = RouteRepository(db)
        routes = await route_repo.get_routes_by_trip_id(trip_id)
        
        if not routes:
            return {"routes": []}
        
        return {"routes": routes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}

# Application entry point
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )