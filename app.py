# Import necessary libraries
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import List, Tuple, Optional
import uvicorn
from config import settings
from provider.osrm_provider import OSRMProvider
from provider.base import TransportMode, Route
from core.workflow.route_planner import RoutePlanner

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