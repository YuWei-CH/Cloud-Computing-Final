# Import necessary libraries
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Tuple
import uvicorn
from config import settings

# Initialize FastAPI application with metadata
app = FastAPI(
    title="TripPlanner API",
    description="Route optimization service with AWS compatibility",
    version="1.0.0"
)

# Define data models using Pydantic
class Point(BaseModel):
    lat: float    # Latitude coordinate
    lng: float    # Longitude coordinate

class RouteRequest(BaseModel):
    start: Point           # Starting location
    points: List[Point]    # List of points to visit

class RouteResponse(BaseModel):
    route: List[Point]     # Optimized route as list of points
    total_distance: float  # Total distance of the route
    duration: float        # Estimated duration of the route

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

# Application entry point
if __name__ == "__main__":
    uvicorn.run(
        "app:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.DEBUG
    )