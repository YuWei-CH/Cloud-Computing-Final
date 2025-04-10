# Import necessary libraries
from fastapi import FastAPI, HTTPException, Query, Depends
from pydantic import BaseModel, Field, AnyUrl
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
from fastapi.openapi.utils import get_openapi
from fastapi.middleware.cors import CORSMiddleware
import logging
from pydantic import validator, root_validator

# Initialize logger
logger = logging.getLogger(__name__)

# Configure basic logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Initialize FastAPI application with metadata
app = FastAPI(
    title="TripPlanner Route Optimization API",
    description="""
    This API provides route optimization services for planning trips with multiple stops.
    
    ## Features
    
    * Calculate optimized routes between multiple points
    * Support for different transportation modes (driving, walking, cycling)
    * Distance and duration matrix calculations
    * Store and retrieve optimized routes for trips
    
    ## Notes
    
    All distances are in meters and durations are in seconds.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Initialize providers and planner
osrm_provider = OSRMProvider()
route_planner = RoutePlanner(osrm_provider)

# Define data models using Pydantic
class Point(BaseModel):
    lat: float = Field(..., description="Latitude coordinate", example=40.7128)
    lon: float = Field(..., description="Longitude coordinate", example=-74.0060)
    address: Optional[str] = Field(None, description="Address associated with this point", example="New York, NY")
    
    class Config:
        schema_extra = {
            "example": {
                "lat": 40.7128,
                "lon": -74.0060,
                "address": "New York, NY"
            }
        }

class AddressPoint(BaseModel):
    address: str = Field(..., description="Street address to geocode", example="New York, NY")
    name: Optional[str] = Field(None, description="Optional name for this location", example="Empire State Building")
    
    class Config:
        schema_extra = {
            "example": {
                "address": "New York, NY",
                "name": "Empire State Building"
            }
        }

class RouteRequest(BaseModel):
    points: Optional[List[Point]] = Field(None, description="List of coordinate points to visit")
    addresses: Optional[List[AddressPoint]] = Field(None, description="List of addresses to visit (alternative to points)")
    start_point: Optional[Point] = Field(None, description="Optional starting point (defaults to first point)")
    start_address: Optional[AddressPoint] = Field(None, description="Optional starting address (alternative to start_point)")
    end_point: Optional[Point] = Field(None, description="Optional ending point (defaults to start point for round trips)")
    end_address: Optional[AddressPoint] = Field(None, description="Optional ending address (alternative to end_point)")
    round_trip: bool = Field(True, description="Whether to return to starting point")
    mode: TransportMode = Field(TransportMode.DRIVING, description="Transportation mode")
    
    class Config:
        schema_extra = {
            "example": {
                "addresses": [
                    {"address": "New York, NY", "name": "New York"},
                    {"address": "Los Angeles, CA", "name": "Los Angeles"},
                    {"address": "Chicago, IL", "name": "Chicago"}
                ],
                "round_trip": True,
                "mode": "driving"
            }
        }
    
    @root_validator(pre=True)
    def validate_points_or_addresses(cls, values):
        """Validate that either points or addresses are provided"""
        points = values.get('points')
        addresses = values.get('addresses')
        
        if (points is None or len(points) == 0) and (addresses is None or len(addresses) == 0):
            raise ValueError("Either 'points' or 'addresses' must be provided")
        
        return values

class RouteStatistics(BaseModel):
    total_distance: float = Field(..., description="Total distance in meters", example=4500000.0)
    total_duration: float = Field(..., description="Total duration in seconds", example=180000.0)
    average_speed: float = Field(..., description="Average speed in m/s", example=25.0)

class LocationInfo(BaseModel):
    lat: float = Field(..., description="Latitude coordinate", example=40.7128)
    lon: float = Field(..., description="Longitude coordinate", example=-74.0060)
    address: Optional[str] = Field(None, description="Address if available", example="New York, NY")
    name: Optional[str] = Field(None, description="Location name if available", example="Empire State Building")

class RouteSegmentResponse(BaseModel):
    distance: float = Field(..., description="Segment distance in meters", example=230000.0)
    duration: float = Field(..., description="Segment duration in seconds", example=10800.0)
    coordinates: List[Tuple[float, float]] = Field(..., description="List of coordinates")
    start_location: LocationInfo = Field(..., description="Starting location information")
    end_location: LocationInfo = Field(..., description="Ending location information")
    mode: TransportMode = Field(..., description="Transportation mode", example="driving")

class RouteResponse(BaseModel):
    total_distance: float = Field(..., description="Total distance in meters", example=4500000.0)
    total_duration: float = Field(..., description="Total duration in seconds", example=180000.0)
    coordinates: List[Tuple[float, float]] = Field(..., description="List of coordinates for the entire route")
    waypoints: List[LocationInfo] = Field(..., description="List of waypoint locations with address information")
    segments: List[RouteSegmentResponse] = Field(..., description="List of route segments")
    statistics: RouteStatistics = Field(..., description="Route statistics")

class TripRouteRequest(BaseModel):
    locations: List[UUID] = Field(
        ..., 
        description="List of location IDs to visit. These should be valid UUIDs of locations in the database.",
        min_items=2,  # At least 2 locations are needed for a route
    )
    mode: TransportMode = Field(
        TransportMode.DRIVING, 
        description="Transportation mode to use for the route"
    )
    round_trip: bool = Field(
        True, 
        description="Whether to return to the starting point. If true, the route will return to the first location."
    )
    
    class Config:
        schema_extra = {
            "example": {
                "locations": [
                    "123e4567-e89b-12d3-a456-426614174000",
                    "123e4567-e89b-12d3-a456-426614174001",
                    "123e4567-e89b-12d3-a456-426614174002"
                ],
                "mode": "driving",
                "round_trip": True
            }
        }

class DayRouteResponse(BaseModel):
    id: UUID = Field(..., description="Route ID")
    day_number: int = Field(..., description="Day number in the trip", example=1)
    total_distance: float = Field(..., description="Total distance in meters", example=25000.0)
    total_duration: float = Field(..., description="Total duration in seconds", example=3600.0)
    transport_mode: str = Field(..., description="Transportation mode", example="driving")
    round_trip: bool = Field(..., description="Whether this is a round trip", example=True)
    segments: List[Dict[str, Any]] = Field(..., description="Route segments details")

class DayTransportMode(BaseModel):
    day_number: int = Field(..., description="Day number in the trip", example=1)
    mode: TransportMode = Field(..., description="Transportation mode for this day", example="driving")

# Organize endpoints by tags
tags_metadata = [
    {
        "name": "health",
        "description": "Health check endpoints"
    },
    {
        "name": "routes",
        "description": "Route optimization endpoints for calculating the best route between multiple points"
    },
    {
        "name": "matrices",
        "description": "Distance and duration matrix calculation endpoints"
    },
    {
        "name": "trips",
        "description": "Trip-specific route optimization and storage endpoints"
    }
]

# Health check endpoint
@app.get("/", tags=["health"])
async def root():
    """
    Root endpoint returning API health status and environment information.
    
    Returns:
        dict: A dictionary containing health status and environment information
    """
    return {
        "status": "healthy", 
        "environment": settings.ENV
    }

# Main route optimization endpoint
@app.post("/optimize", response_model=RouteResponse, tags=["routes"])
async def optimize_route(request: RouteRequest, db: AsyncSession = Depends(get_db)):
    """
    Optimize a route between multiple points or addresses.
    
    This endpoint calculates the optimal route to visit all specified points/addresses, 
    minimizing the total travel distance or time.
    
    Args:
        request: A RouteRequest object containing points/addresses to visit and routing options
        db: Database session dependency
    
    Returns:
        RouteResponse: The optimized route with segment details and statistics
        
    Raises:
        400 Bad Request: If the request contains invalid parameters
        500 Internal Server Error: If there's an issue with the route calculation
    """
    try:
        route_repo = RouteRepository(db)
        points = []
        addresses = {}
        names = {}
        
        # Process coordinate points if provided
        if request.points:
            for p in request.points:
                point = (p.lat, p.lon)
                points.append(point)
                if p.address:
                    addresses[point] = p.address
        
        # Process address points if provided
        if request.addresses:
            for a in request.addresses:
                # Geocode address to coordinates
                coord = await route_repo.geocode_address(a.address)
                if not coord:
                    raise ValueError(f"Could not geocode address: {a.address}")
                point = coord
                points.append(point)
                addresses[point] = a.address
                if a.name:
                    names[point] = a.name
        
        if not points:
            raise ValueError("No valid points or addresses provided")
        
        # Handle optional start and end points
        start_point = None
        if request.start_point:
            start_point = (request.start_point.lat, request.start_point.lon)
            if request.start_point.address:
                addresses[start_point] = request.start_point.address
        elif request.start_address:
            start_coord = await route_repo.geocode_address(request.start_address.address)
            if not start_coord:
                raise ValueError(f"Could not geocode start address: {request.start_address.address}")
            start_point = start_coord
            addresses[start_point] = request.start_address.address
            if request.start_address.name:
                names[start_point] = request.start_address.name
        
        end_point = None
        if request.end_point:
            end_point = (request.end_point.lat, request.end_point.lon)
            if request.end_point.address:
                addresses[end_point] = request.end_point.address
        elif request.end_address:
            end_coord = await route_repo.geocode_address(request.end_address.address)
            if not end_coord:
                raise ValueError(f"Could not geocode end address: {request.end_address.address}")
            end_point = end_coord
            addresses[end_point] = request.end_address.address
            if request.end_address.name:
                names[end_point] = request.end_address.name
        
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
        
        # Create waypoints with address information
        waypoints = []
        for point in points:
            waypoint = LocationInfo(
                lat=point[0],
                lon=point[1],
                address=addresses.get(point, None),
                name=names.get(point, None)
            )
            waypoints.append(waypoint)
        
        # Create segments with address information
        segments = []
        for segment in route.segments:
            start_point = segment.coordinates[0]
            end_point = segment.coordinates[-1]
            
            segment_resp = RouteSegmentResponse(
                distance=segment.distance,
                duration=segment.duration,
                coordinates=segment.coordinates,
                start_location=LocationInfo(
                    lat=start_point[0],
                    lon=start_point[1],
                    address=addresses.get(start_point, None),
                    name=names.get(start_point, None)
                ),
                end_location=LocationInfo(
                    lat=end_point[0],
                    lon=end_point[1],
                    address=addresses.get(end_point, None),
                    name=names.get(end_point, None)
                ),
                mode=segment.mode
            )
            segments.append(segment_resp)
        
        # Convert route to response model
        return RouteResponse(
            total_distance=route.total_distance,
            total_duration=route.total_duration,
            coordinates=route.coordinates,
            waypoints=waypoints,
            segments=segments,
            statistics=RouteStatistics(
                total_distance=stats["total_distance"],
                total_duration=stats["total_duration"],
                average_speed=stats.get("average_speed", stats["total_distance"] / stats["total_duration"] if stats["total_duration"] else 0)
            )
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matrix/distance", tags=["matrices"])
async def get_distance_matrix(
    points: Optional[List[str]] = Query(None, description="Points in format 'lat,lon'", example=["40.7128,-74.0060", "34.0522,-118.2437"]),
    addresses: Optional[List[str]] = Query(None, description="Street addresses to geocode", example=["New York, NY", "Los Angeles, CA"]),
    db: AsyncSession = Depends(get_db)
):
    """
    Get distance matrix between multiple points or addresses.
    
    This endpoint calculates the distance in meters between each pair of points. You can specify either coordinates or addresses.
    
    Args:
        points: List of points in format 'lat,lon' (e.g. '40.7128,-74.0060')
        addresses: List of street addresses to geocode
        db: Database session dependency
    
    Returns:
        dict: A nested dictionary with distances between all pairs of points, with original addresses/coordinates as keys
        
    Raises:
        400 Bad Request: If the points/addresses are invalid
        500 Internal Server Error: If there's an issue with the calculation
    """
    try:
        route_repo = RouteRepository(db)
        point_tuples = []
        original_inputs = []
        
        # Process coordinate points if provided
        if points:
            for p in points:
                point_tuple = tuple(map(float, p.split(",")))
                point_tuples.append(point_tuple)
                original_inputs.append(p)
        
        # Process addresses if provided
        if addresses:
            for addr in addresses:
                # Geocode address to coordinates
                coord = await route_repo.geocode_address(addr)
                if not coord:
                    raise ValueError(f"Could not geocode address: {addr}")
                point_tuples.append(coord)
                original_inputs.append(addr)
        
        if not point_tuples:
            raise ValueError("No valid points or addresses provided")
        
        # Get distance matrix
        raw_matrix = await route_planner.get_distance_matrix(point_tuples)
        
        # Convert matrix to a more user-friendly format with original inputs as keys
        result = {}
        for i, src in enumerate(point_tuples):
            src_key = original_inputs[i]
            if src_key not in result:
                result[src_key] = {}
            
            for j, dst in enumerate(point_tuples):
                dst_key = original_inputs[j]
                result[src_key][dst_key] = raw_matrix.get((src, dst), 0)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/matrix/duration", tags=["matrices"])
async def get_duration_matrix(
    points: Optional[List[str]] = Query(None, description="Points in format 'lat,lon'", example=["40.7128,-74.0060", "34.0522,-118.2437"]),
    addresses: Optional[List[str]] = Query(None, description="Street addresses to geocode", example=["New York, NY", "Los Angeles, CA"]),
    db: AsyncSession = Depends(get_db)
):
    """
    Get duration matrix between multiple points or addresses.
    
    This endpoint calculates the travel time in seconds between each pair of points. You can specify either coordinates or addresses.
    
    Args:
        points: List of points in format 'lat,lon' (e.g. '40.7128,-74.0060')
        addresses: List of street addresses to geocode
        db: Database session dependency
    
    Returns:
        dict: A nested dictionary with travel times between all pairs of points, with original addresses/coordinates as keys
        
    Raises:
        400 Bad Request: If the points/addresses are invalid
        500 Internal Server Error: If there's an issue with the calculation
    """
    try:
        route_repo = RouteRepository(db)
        point_tuples = []
        original_inputs = []
        
        # Process coordinate points if provided
        if points:
            for p in points:
                point_tuple = tuple(map(float, p.split(",")))
                point_tuples.append(point_tuple)
                original_inputs.append(p)
        
        # Process addresses if provided
        if addresses:
            for addr in addresses:
                # Geocode address to coordinates
                coord = await route_repo.geocode_address(addr)
                if not coord:
                    raise ValueError(f"Could not geocode address: {addr}")
                point_tuples.append(coord)
                original_inputs.append(addr)
        
        if not point_tuples:
            raise ValueError("No valid points or addresses provided")
        
        # Get duration matrix
        raw_matrix = await route_planner.get_duration_matrix(point_tuples)
        
        # Convert matrix to a more user-friendly format with original inputs as keys
        result = {}
        for i, src in enumerate(point_tuples):
            src_key = original_inputs[i]
            if src_key not in result:
                result[src_key] = {}
            
            for j, dst in enumerate(point_tuples):
                dst_key = original_inputs[j]
                result[src_key][dst_key] = raw_matrix.get((src, dst), 0)
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# New endpoint for trip route optimization
@app.post("/trips/{trip_id}/days/{day_number}/optimize", tags=["trips"])
async def optimize_day_route(
    trip_id: UUID,
    day_number: int,
    request: TripRouteRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize and store a route for a specific day in a trip.
    
    This endpoint calculates the optimal route to visit all locations for a specific 
    day in a trip and stores the result in the database.
    
    Args:
        trip_id: UUID of the trip
        day_number: Day number in the trip
        request: A TripRouteRequest object containing locations and routing options
        db: Database session dependency
    
    Returns:
        dict: A dictionary containing the route ID and summary statistics
        
    Raises:
        400 Bad Request: If the request contains invalid parameters
        404 Not Found: If the trip or day is not found
        500 Internal Server Error: If there's an issue with the calculation or storage
    """
    try:
        # Initialize the repository
        route_repo = RouteRepository(db)
        
        # Get the everyday_id for this trip and day
        everyday_id = await route_repo.get_everyday_id_for_trip_day(trip_id, day_number)
        
        if not everyday_id:
            raise HTTPException(
                status_code=404, 
                detail=f"Day {day_number} not found for trip {trip_id}"
            )
        
        # Get location coordinates from location IDs
        location_coords = await route_repo.get_location_coordinates(request.locations)
        
        if not location_coords or len(location_coords) == 0:
            raise HTTPException(
                status_code=400,
                detail="Could not get coordinates for the provided locations"
            )
        
        # Calculate optimized route
        route = await route_planner.plan_route(
            points=location_coords,
            round_trip=request.round_trip,
            mode=request.mode
        )
        
        # Store the optimized route in the database
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
            "total_duration": route.total_duration,
            "coordinates": location_coords,
            "points_count": len(location_coords)
        }
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error optimizing route: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Get route for a specific day in a trip
@app.get("/trips/{trip_id}/days/{day_number}/route", response_model=DayRouteResponse, tags=["trips"])
async def get_day_route(
    trip_id: UUID,
    day_number: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the optimized route for a specific day in a trip.
    
    This endpoint retrieves the stored optimized route for a specific day in a trip.
    
    Args:
        trip_id: UUID of the trip
        day_number: Day number in the trip
        db: Database session dependency
    
    Returns:
        DayRouteResponse: The stored route with segment details
        
    Raises:
        404 Not Found: If no route is found for the specified day
        500 Internal Server Error: If there's an issue with the database
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
@app.get("/trips/{trip_id}/routes", tags=["trips"])
async def get_trip_routes(
    trip_id: UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Get all optimized routes for a trip.
    
    This endpoint retrieves all stored optimized routes for a trip.
    
    Args:
        trip_id: UUID of the trip
        db: Database session dependency
    
    Returns:
        dict: A dictionary containing a list of routes
        
    Raises:
        500 Internal Server Error: If there's an issue with the database
    """
    try:
        route_repo = RouteRepository(db)
        routes = await route_repo.get_routes_by_trip_id(trip_id)
        
        if not routes:
            return {"routes": []}
        
        return {"routes": routes}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health", tags=["health"])
async def health_check():
    """
    Health check endpoint.
    
    Returns:
        dict: A dictionary containing health status
    """
    return {"status": "healthy"}

# New endpoint for optimizing all routes in a trip
@app.post("/trips/{trip_id}/optimize", tags=["trips"])
async def optimize_trip_routes(
    trip_id: UUID,
    mode: TransportMode = TransportMode.DRIVING,
    round_trip: bool = True,
    day_modes: Optional[List[DayTransportMode]] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Optimize and store routes for all days in a trip.
    
    This endpoint automatically calculates optimal routes for each day in a trip 
    based on the locations already stored in the database. It will create or update
    routes for all days in the trip.
    
    Args:
        trip_id: UUID of the trip
        mode: Default transportation mode to use
        round_trip: Whether routes should return to starting point
        day_modes: Optional list of specific transport modes for particular days
        db: Database session dependency
    
    Returns:
        dict: A dictionary containing summary of optimized routes
        
    Raises:
        404 Not Found: If the trip is not found or has no days/locations
        500 Internal Server Error: If there's an issue with calculation or storage
    """
    try:
        # Initialize the repository
        route_repo = RouteRepository(db)
        
        # Create a mapping of day numbers to transport modes
        day_mode_map = {}
        if day_modes:
            for day_mode in day_modes:
                day_mode_map[day_mode.day_number] = day_mode.mode
        
        # Query to get all days for this trip
        days_query = """
        SELECT 
            id as everyday_id,
            day_number,
            description
        FROM 
            everyday
        WHERE 
            trip_id = :trip_id
        ORDER BY 
            day_number
        """
        
        days_result = await db.execute(days_query, {"trip_id": trip_id})
        days = days_result.mappings().all()
        
        if not days:
            raise HTTPException(
                status_code=404, 
                detail=f"No days found for trip {trip_id}"
            )
        
        # List to store results for each day
        results = []
        
        # For each day in this trip
        for day_number, everyday_id, day_description in days:
            # Skip this day if there are no locations or only one location
            location_ids = await route_repo.get_everyday_location_ids(everyday_id)
            if len(location_ids) < 2:
                results.append({
                    "day_number": day_number,
                    "description": day_description,
                    "status": "skipped",
                    "reason": "Insufficient locations (need at least 2)"
                })
                continue
                
            try:
                # Get coordinates for these locations
                location_coords = await route_repo.get_location_coordinates(location_ids)
                
                # Determine which transport mode to use for this day
                day_transport_mode = day_mode_map.get(day_number, mode)
                
                # Optimize route
                route = await route_planner.plan_route(
                    points=location_coords,
                    round_trip=round_trip,
                    mode=day_transport_mode
                )
                
                # Get statistics for the route
                stats = await route_planner.get_route_statistics(route)
                
                # Store the optimized route
                db_route = await route_repo.create_route(
                    everyday_id=everyday_id,
                    route=route,
                    transport_mode=day_transport_mode,
                    round_trip=round_trip
                )
                
                # Add to results
                results.append({
                    "day_number": day_number,
                    "description": day_description,
                    "status": "optimized",
                    "route_id": str(db_route.id),
                    "transport_mode": day_transport_mode.value,
                    "statistics": {
                        "total_distance": stats["total_distance"],
                        "total_duration": stats["total_duration"],
                        "num_segments": len(route.segments),
                        "num_locations": len(location_ids)
                    }
                })
            except Exception as e:
                # Log the error for debugging
                logger.error(f"Error optimizing route for day {day_number}: {str(e)}")
                results.append({
                    "day_number": day_number,
                    "description": day_description,
                    "status": "error",
                    "error": str(e)
                })
        
        return {
            "trip_id": str(trip_id),
            "optimized_days": len([r for r in results if r["status"] == "optimized"]),
            "skipped_days": len([r for r in results if r["status"] == "skipped"]),
            "failed_days": len([r for r in results if r["status"] == "error"]),
            "days": results
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error optimizing trip routes: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Custom OpenAPI schema generation
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    
    openapi_schema = get_openapi(
        title="TripPlanner Route Optimization API",
        version="1.0.0",
        description="""
        This API provides route optimization services for planning trips with multiple stops.
        
        ## Features
        
        * Calculate optimized routes between multiple points
        * Support for different transportation modes (driving, walking, cycling)
        * Convert addresses to coordinates with geocoding
        * Distance and duration matrix calculations
        * Store and retrieve optimized routes for trips
        
        ## Examples
        
        ### Optimizing a route with coordinates
        
        ```json
        {
            "points": [
                {"lat": 40.7128, "lon": -74.0060},
                {"lat": 34.0522, "lon": -118.2437},
                {"lat": 41.8781, "lon": -87.6298}
            ],
            "round_trip": true,
            "mode": "driving"
        }
        ```
        
        ### Optimizing a route with addresses
        
        ```json
        {
            "addresses": [
                {"address": "New York, NY", "name": "New York"},
                {"address": "Los Angeles, CA", "name": "Los Angeles"},
                {"address": "Chicago, IL", "name": "Chicago"}
            ],
            "round_trip": true,
            "mode": "driving"
        }
        ```
        
        ## Notes
        
        All distances are in meters and durations are in seconds.
        """,
        routes=app.routes,
        tags=tags_metadata
    )
    
    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# Application entry point
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )