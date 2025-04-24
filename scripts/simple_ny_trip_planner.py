import asyncio
from typing import List, Dict, Any
from core.workflow.route_planner import RoutePlanner
from provider.osrm_provider import OSRMProvider
from core.visualization.route_visualizer import RouteVisualizer
from provider.base import TransportMode, Route
import base64

# New York locations for each day with pre-defined coordinates
NY_LOCATIONS = {
    1: [  # Day 1: Manhattan landmarks
        {
            "name": "Empire State Building",
            "latitude": 40.7484,
            "longitude": -73.9857
        },
        {
            "name": "Central Park",
            "latitude": 40.7829,
            "longitude": -73.9654
        },
        {
            "name": "Times Square",
            "latitude": 40.7580,
            "longitude": -73.9855
        }
    ],
    2: [  # Day 2: Museums and cultural sites
        {
            "name": "Metropolitan Museum of Art",
            "latitude": 40.7794,
            "longitude": -73.9632
        },
        {
            "name": "Museum of Modern Art",
            "latitude": 40.7614,
            "longitude": -73.9776
        },
        {
            "name": "Guggenheim Museum",
            "latitude": 40.7830,
            "longitude": -73.9590
        }
    ],
    3: [  # Day 3: Brooklyn attractions
        {
            "name": "Brooklyn Bridge",
            "latitude": 40.7061,
            "longitude": -73.9969
        },
        {
            "name": "Brooklyn Museum",
            "latitude": 40.6712,
            "longitude": -73.9636
        },
        {
            "name": "Prospect Park",
            "latitude": 40.6602,
            "longitude": -73.9690
        }
    ]
}

async def optimize_routes() -> Dict[int, Dict[str, Any]]:
    """Optimize routes for each day of the trip"""
    route_planner = RoutePlanner(OSRMProvider())
    optimized_routes = {}
    
    for day_number, locations in NY_LOCATIONS.items():
        # Extract coordinates for the locations
        coordinates = [(loc["latitude"], loc["longitude"]) for loc in locations]
        
        # Optimize route
        route = await route_planner.plan_route(
            points=coordinates,
            round_trip=True,
            mode=TransportMode.DRIVING
        )
        
        optimized_routes[day_number] = {
            "route": route,
            "locations": locations,
            "day_number": day_number
        }
        
        print(f"Optimized route for day {day_number}")
    
    return optimized_routes

async def visualize_routes(optimized_routes: Dict[int, Dict[str, Any]]):
    """Visualize routes for each day of the trip"""
    visualizer = RouteVisualizer()
    
    # Generate individual day visualizations
    for day_number, route_data in optimized_routes.items():
        route: Route = route_data["route"]
        
        # Generate visualization for individual day
        image_data = visualizer.visualize_route(route)
        
        # Convert base64 string to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Save the visualization
        with open(f"day_{day_number}_route.png", "wb") as f:
            f.write(image_bytes)
        
        print(f"Generated visualization for day {day_number}")
    
    # Generate multi-day overview visualization
    routes_list = [route_data["route"] for route_data in optimized_routes.values()]
    
    if routes_list:
        # Generate multi-day visualization
        image_data = visualizer.visualize_multi_day_routes(routes_list)
        
        # Convert base64 string to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Save the visualization
        with open("multi_day_routes.png", "wb") as f:
            f.write(image_bytes)
        
        print("Generated multi-day route visualization")

async def main():
    """Main function to run the trip planning demo"""
    # Optimize routes
    print("Optimizing routes...")
    optimized_routes = await optimize_routes()
    
    # Visualize routes
    print("Generating visualizations...")
    await visualize_routes(optimized_routes)
    
    print("Done! Check the generated PNG files for route visualizations.")

if __name__ == "__main__":
    asyncio.run(main()) 