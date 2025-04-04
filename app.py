# Import necessary libraries
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Tuple
import uvicorn
from config import settings
from core.segmented_router import SegmentedRouter, RouteSegmentRequest
from provider.osrm_provider import OSRMProvider
from provider.base import TransportMode

# Initialize FastAPI application with metadata
app = FastAPI(
    title="TripPlanner API",
    description="Route optimization service with AWS compatibility",
    version="1.0.0"
)

# Initialize providers
osrm_provider = OSRMProvider()
router = SegmentedRouter(osrm_provider)

# Define data models using Pydantic
class Point(BaseModel):
    lat: float    # Latitude coordinate
    lon: float    # Longitude coordinate

class SegmentRequest(BaseModel):
    start_point: Point
    end_point: Point
    mode: TransportMode

class SegmentedRouteRequest(BaseModel):
    segments: List[SegmentRequest]

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
    try:
        # TODO: Implement route optimization logic
        # This will be implemented in the next step
        raise NotImplementedError("Route optimization not yet implemented")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/segmented-route")
async def get_segmented_route(request: SegmentedRouteRequest):
    """Calculate a route with multiple transport modes"""
    try:
        # Convert request to RouteSegmentRequest objects
        segments = [
            RouteSegmentRequest(
                start_point=(segment.start_point.lat, segment.start_point.lon),
                end_point=(segment.end_point.lat, segment.end_point.lon),
                mode=segment.mode
            )
            for segment in request.segments
        ]
        
        # Validate segments
        if not await router.validate_segments(segments):
            raise HTTPException(
                status_code=400,
                detail="One or more segments contain invalid points"
            )
        
        # Calculate route
        route = await router.get_segmented_route(segments)
        
        return {
            "total_distance": route.total_distance,
            "total_duration": route.total_duration,
            "coordinates": route.coordinates,
            "segments": route.segments
        }
        
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