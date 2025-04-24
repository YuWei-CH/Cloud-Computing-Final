import asyncio
import uuid
import os
import sys
from typing import List, Dict, Any, Tuple
from datetime import datetime

# Add the project root to the Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from core.workflow.route_planner import RoutePlanner
from provider.osrm_provider import OSRMProvider
from core.visualization.route_visualizer import RouteVisualizer
from provider.base import TransportMode, Route
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut
import base64

# Initialize geocoder
geocoder = Nominatim(user_agent="tripplanner")

def geocode_address(address: str) -> Tuple[float, float]:
    """Geocode an address to get coordinates"""
    try:
        location = geocoder.geocode(address)
        if location:
            return (location.latitude, location.longitude)
    except GeocoderTimedOut:
        # Retry once on timeout
        try:
            location = geocoder.geocode(address)
            if location:
                return (location.latitude, location.longitude)
        except Exception as e:
            print(f"Error geocoding address {address}: {e}")
    return (0, 0)  # Default coordinates if geocoding fails

# New York locations for each day with pre-defined coordinates
NY_LOCATIONS = {
    1: [  # Day 1: Manhattan landmarks
        {
            "name": "Empire State Building",
            "address": "350 5th Ave, New York, NY 10118",
            "latitude": 40.7484,
            "longitude": -73.9857
        },
        {
            "name": "Central Park",
            "address": "New York, NY 10024",
            "latitude": 40.7829,
            "longitude": -73.9654
        },
        {
            "name": "Times Square",
            "address": "Manhattan, NY 10036",
            "latitude": 40.7580,
            "longitude": -73.9855
        }
    ],
    2: [  # Day 2: Museums and cultural sites
        {
            "name": "Metropolitan Museum of Art",
            "address": "1000 5th Ave, New York, NY 10028",
            "latitude": 40.7794,
            "longitude": -73.9632
        },
        {
            "name": "Museum of Modern Art",
            "address": "11 W 53rd St, New York, NY 10019",
            "latitude": 40.7614,
            "longitude": -73.9776
        },
        {
            "name": "Guggenheim Museum",
            "address": "1071 5th Ave, New York, NY 10128",
            "latitude": 40.7830,
            "longitude": -73.9590
        }
    ],
    3: [  # Day 3: Brooklyn attractions
        {
            "name": "Brooklyn Bridge",
            "address": "New York, NY 10038",
            "latitude": 40.7061,
            "longitude": -73.9969
        },
        {
            "name": "Brooklyn Museum",
            "address": "200 Eastern Pkwy, Brooklyn, NY 11238",
            "latitude": 40.6712,
            "longitude": -73.9636
        },
        {
            "name": "Prospect Park",
            "address": "Brooklyn, NY 11218",
            "latitude": 40.6602,
            "longitude": -73.9690
        }
    ]
}

# In-memory data structures to replace database
class InMemoryStorage:
    def __init__(self):
        self.trips = {}
        self.days = {}
        self.locations = {}
        self.routes = {}
        self.everyday_locations = {}

# Create a global in-memory storage
storage = InMemoryStorage()

async def create_trip() -> uuid.UUID:
    """Create a new trip in memory"""
    trip_id = uuid.uuid4()
    trip_data = {
        "id": trip_id,
        "name": "New York City Explorer",
        "description": "A 3-day exploration of New York City's landmarks",
        "start_date": datetime.now(),
        "end_date": datetime.now()
    }
    
    storage.trips[trip_id] = trip_data
    print(f"Created trip: {trip_data['name']}")
    
    return trip_id

async def create_days(trip_id: uuid.UUID) -> Dict[int, uuid.UUID]:
    """Create days for the trip and return a mapping of day numbers to everyday IDs"""
    day_ids = {}
    
    for day_number in NY_LOCATIONS.keys():
        # Create the day
        everyday_id = uuid.uuid4()
        day_data = {
            "id": everyday_id,
            "trip_id": trip_id,
            "day_number": day_number,
            "description": f"Day {day_number} of New York exploration"
        }
        
        storage.days[everyday_id] = day_data
        day_ids[day_number] = everyday_id
        
        # Create locations for this day
        for location in NY_LOCATIONS[day_number]:
            # Create the location with pre-defined coordinates
            location_id = uuid.uuid4()
            location_data = {
                "id": location_id,
                "name": location["name"],
                "address": location["address"],
                "latitude": location["latitude"],
                "longitude": location["longitude"]
            }
            
            storage.locations[location_id] = location_data
            
            # Link location to the day
            storage.everyday_locations[(everyday_id, location_id)] = True
        
        print(f"Created day {day_number} with {len(NY_LOCATIONS[day_number])} locations")
    
    return day_ids

async def optimize_routes(trip_id: uuid.UUID, day_ids: Dict[int, uuid.UUID]):
    """Optimize routes for each day of the trip"""
    route_planner = RoutePlanner(OSRMProvider())
    
    for day_number, everyday_id in day_ids.items():
        # Get locations for this day
        day_locations = []
        for location_id, location in storage.locations.items():
            if (everyday_id, location_id) in storage.everyday_locations:
                day_locations.append(location)
        
        # Sort locations by day number to maintain order
        day_locations.sort(key=lambda x: x["name"])
        
        # Extract coordinates
        coordinates = [(loc["latitude"], loc["longitude"]) for loc in day_locations]
        
        # Optimize route
        route = await route_planner.plan_route(
            points=coordinates,
            round_trip=True,
            mode=TransportMode.DRIVING
        )
        
        # Store the optimized route
        route_id = uuid.uuid4()
        route_data = {
            "id": route_id,
            "everyday_id": everyday_id,
            "route": route,
            "transport_mode": TransportMode.DRIVING,
            "round_trip": True
        }
        
        storage.routes[route_id] = route_data
        
        print(f"Optimized route for day {day_number}")

async def visualize_routes(trip_id: uuid.UUID):
    """Visualize routes for each day of the trip"""
    visualizer = RouteVisualizer()
    
    # Get all routes for the trip
    trip_routes = []
    for route_id, route_data in storage.routes.items():
        # Find the day number for this route
        everyday_id = route_data["everyday_id"]
        day_data = storage.days[everyday_id]
        day_number = day_data["day_number"]
        
        # Add day number to route data
        route_data["day_number"] = day_number
        trip_routes.append(route_data)
    
    # Sort routes by day number
    trip_routes.sort(key=lambda x: x["day_number"])
    
    # Generate individual day visualizations
    for route_data in trip_routes:
        day_number = route_data["day_number"]
        route = route_data["route"]
        
        # Generate visualization for individual day
        image_data = visualizer.visualize_route(route)
        
        # Convert base64 string to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Save the visualization
        with open(f"day_{day_number}_route.png", "wb") as f:
            f.write(image_bytes)
        
        print(f"Generated visualization for day {day_number}")
    
    # Generate multi-day overview visualization
    if trip_routes:
        # Extract just the routes for the multi-day visualization
        routes_list = [route_data["route"] for route_data in trip_routes]
        
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
    # Create trip
    print("Creating trip...")
    trip_id = await create_trip()
    
    # Create days and locations
    print("Creating days and locations...")
    day_ids = await create_days(trip_id)
    
    # Optimize routes
    print("Optimizing routes...")
    await optimize_routes(trip_id, day_ids)
    
    # Visualize routes
    print("Generating visualizations...")
    await visualize_routes(trip_id)
    
    print("Done! Check the generated PNG files for route visualizations.")

if __name__ == "__main__":
    asyncio.run(main()) 