import asyncio
import uuid
from typing import List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from storage.db import async_session, init_db
from storage.repositories.route_repository import RouteRepository
from core.workflow.route_planner import RoutePlanner
from provider.osrm_provider import OSRMProvider
from core.visualization.route_visualizer import RouteVisualizer
from provider.base import TransportMode
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

async def create_trip(db: AsyncSession) -> uuid.UUID:
    """Create a new trip in the database"""
    # Create a new trip
    trip_query = text("""
    INSERT INTO trips (id, name, description, start_date, end_date)
    VALUES (:id, :name, :description, :start_date, :end_date)
    RETURNING id
    """)
    
    trip_id = uuid.uuid4()
    trip_data = {
        "id": trip_id,
        "name": "New York City Explorer",
        "description": "A 3-day exploration of New York City's landmarks",
        "start_date": datetime.now(),
        "end_date": datetime.now()
    }
    
    result = await db.execute(trip_query, trip_data)
    await db.commit()
    
    return trip_id

async def create_days(db: AsyncSession, trip_id: uuid.UUID) -> Dict[int, uuid.UUID]:
    """Create days for the trip and return a mapping of day numbers to everyday IDs"""
    day_ids = {}
    
    for day_number in NY_LOCATIONS.keys():
        # Create the day
        day_query = text("""
        INSERT INTO everyday (id, trip_id, day_number, description)
        VALUES (:id, :trip_id, :day_number, :description)
        RETURNING id
        """)
        
        day_data = {
            "id": uuid.uuid4(),
            "trip_id": trip_id,
            "day_number": day_number,
            "description": f"Day {day_number} of New York exploration"
        }
        
        result = await db.execute(day_query, day_data)
        everyday_id = result.scalar_one()
        day_ids[day_number] = everyday_id
        
        # Create locations for this day
        for location in NY_LOCATIONS[day_number]:
            # Create the location with pre-defined coordinates
            location_query = text("""
            INSERT INTO locations (id, name, address, latitude, longitude)
            VALUES (:id, :name, :address, :latitude, :longitude)
            RETURNING id
            """)
            
            location_data = {
                "id": uuid.uuid4(),
                "name": location["name"],
                "address": location["address"],
                "latitude": location["latitude"],
                "longitude": location["longitude"]
            }
            
            result = await db.execute(location_query, location_data)
            location_id = result.scalar_one()
            
            # Link location to the day
            link_query = text("""
            INSERT INTO everyday_locations (everyday_id, location_id)
            VALUES (:everyday_id, :location_id)
            """)
            
            await db.execute(link_query, {
                "everyday_id": everyday_id,
                "location_id": location_id
            })
    
    await db.commit()
    return day_ids

async def optimize_routes(db: AsyncSession, trip_id: uuid.UUID, day_ids: Dict[int, uuid.UUID]):
    """Optimize routes for each day of the trip"""
    route_repo = RouteRepository(db)
    route_planner = RoutePlanner(OSRMProvider())
    
    for day_number, everyday_id in day_ids.items():
        # Get location IDs for this day
        location_ids = await route_repo.get_everyday_location_ids(everyday_id)
        
        # Get coordinates for these locations
        location_coords = await route_repo.get_location_coordinates(location_ids)
        
        # Optimize route
        route = await route_planner.plan_route(
            points=location_coords,
            round_trip=True,
            mode=TransportMode.DRIVING
        )
        
        # Store the optimized route
        await route_repo.create_route(
            everyday_id=everyday_id,
            route=route,
            transport_mode=TransportMode.DRIVING,
            round_trip=True
        )
        
        print(f"Optimized route for day {day_number}")

async def visualize_routes(db: AsyncSession, trip_id: uuid.UUID):
    """Visualize routes for each day of the trip"""
    route_repo = RouteRepository(db)
    visualizer = RouteVisualizer()
    
    # Get all routes for the trip
    routes = await route_repo.get_routes_by_trip_id(trip_id)
    
    # Generate individual day visualizations
    for route in routes:
        day_number = route["day_number"]
        route_id = route["id"]
        
        # Get the full route with segments
        full_route = await route_repo.get_route_for_day(trip_id, day_number)
        
        if full_route:
            # Generate visualization for individual day
            image_data = visualizer.visualize_route(full_route)
            
            # Convert base64 string to bytes
            image_bytes = base64.b64decode(image_data)
            
            # Save the visualization
            with open(f"day_{day_number}_route.png", "wb") as f:
                f.write(image_bytes)
            
            print(f"Generated visualization for day {day_number}")
    
    # Generate multi-day overview visualization
    full_routes = []
    for route in routes:
        day_number = route["day_number"]
        full_route = await route_repo.get_route_for_day(trip_id, day_number)
        if full_route:
            full_route["day_number"] = day_number
            full_routes.append(full_route)
    
    if full_routes:
        # Generate multi-day visualization
        image_data = visualizer.visualize_multi_day_routes(full_routes)
        
        # Convert base64 string to bytes
        image_bytes = base64.b64decode(image_data)
        
        # Save the visualization
        with open("multi_day_routes.png", "wb") as f:
            f.write(image_bytes)
        
        print("Generated multi-day route visualization")

async def main():
    """Main function to run the trip planning demo"""
    # Initialize database
    await init_db()
    
    async with async_session() as db:
        # Create trip
        print("Creating trip...")
        trip_id = await create_trip(db)
        
        # Create days and locations
        print("Creating days and locations...")
        day_ids = await create_days(db, trip_id)
        
        # Optimize routes
        print("Optimizing routes...")
        await optimize_routes(db, trip_id, day_ids)
        
        # Visualize routes
        print("Generating visualizations...")
        await visualize_routes(db, trip_id)
        
        print("Done! Check the generated PNG files for route visualizations.")

if __name__ == "__main__":
    asyncio.run(main()) 