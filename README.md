# Route Optimization Microservice

A microservice for optimizing multi-point routes using various transportation modes.

## Current Status

### Completed Features
- ✅ Basic route optimization using distance-based algorithms
- ✅ Support for multiple transportation modes (driving, walking, cycling)
- ✅ K-d tree optimization for large datasets
- ✅ Round-trip and non-round-trip route planning
- ✅ Distance and duration matrix calculations
- ✅ Comprehensive test coverage
- ✅ Mock provider for testing
- ✅ OSRM provider integration
- ✅ RESTful API endpoints
- ✅ Basic error handling
- ✅ Database storage for optimized routes
- ✅ Interactive API documentation (Swagger/OpenAPI)

### Pending Features
- ⚠️ API Integration
  - ✅ RESTful API endpoints
  - ✅ API documentation
  - ❌ Rate limiting
  - ❌ Request validation
  - ⚠️ Error handling middleware (basic implementation)

- ⚠️ Storage Management
  - ✅ Route history storage
  - ❌ Caching layer for frequently accessed routes
  - ✅ Database integration (PostgreSQL)
  - ✅ Data persistence

## Project Structure
```
project/
├── core/
│   ├── optimization/
│   │   └── route_optimizer.py    # Route optimization algorithms
│   └── workflow/
│       └── route_planner.py      # Main orchestrator
├── provider/
│   ├── base.py                  # Base classes and interfaces
│   ├── mock_provider.py         # Mock implementation
│   └── osrm_provider.py         # OSRM implementation
├── storage/
│   ├── db.py                    # Database connection setup
│   ├── models.py                # SQLAlchemy models
│   └── repositories/
│       └── route_repository.py  # Route data access layer
├── migrations/                  # Alembic database migrations
├── test/
│   ├── test_route_optimizer.py
│   └── test_route_planner.py
├── app.py                       # FastAPI application
└── config.py                    # Configuration settings
```

## API Documentation

The API includes interactive documentation:

- **Swagger UI**: Available at `/docs` when the API is running
- **ReDoc**: Available at `/redoc` when the API is running

These interfaces allow you to:
- Browse all available endpoints
- View parameter details and examples
- Make test requests directly from the browser
- See response schemas and examples

## API Endpoints

### Health Checks
- `GET /health` - Check API health status
- `GET /` - Check API health status and environment

### Route Optimization
- `POST /optimize` - Optimize a route between multiple points
  ```json
  {
    "points": [
      {"lat": 40.7128, "lon": -74.0060},
      {"lat": 34.0522, "lon": -118.2437}
    ],
    "start_point": {"lat": 40.7128, "lon": -74.0060},  // Optional
    "end_point": {"lat": 34.0522, "lon": -118.2437},   // Optional
    "round_trip": true,                                // Optional, default: true
    "mode": "driving"                                  // Optional, default: driving
  }
  ```

### Matrix Calculations
- `GET /matrix/distance?points=lat1,lon1&points=lat2,lon2` - Get distance matrix between points
- `GET /matrix/duration?points=lat1,lon1&points=lat2,lon2` - Get duration matrix between points

### Trip-Specific Routes
- `POST /trips/{trip_id}/days/{day_number}/optimize` - Optimize and store a route for a specific day in a trip
  ```json
  {
    "locations": ["location-uuid-1", "location-uuid-2", "location-uuid-3"],
    "mode": "driving",
    "round_trip": true
  }
  ```
- `GET /trips/{trip_id}/days/{day_number}/route` - Get the optimized route for a specific day in a trip
- `GET /trips/{trip_id}/routes` - Get all optimized routes for a trip

## Database Schema

### Optimized Routes
```
optimized_routes
----------------
id (UUID primary key)
everyday_id (UUID, foreign key to everyday.id)
total_distance (float) - total distance in meters
total_duration (float) - total duration in seconds
transport_mode (string) - driving, walking, cycling
round_trip (boolean) - whether this is a round trip
created_at (timestamp)
updated_at (timestamp)
```

### Route Segments
```
route_segments
--------------
id (UUID primary key)
route_id (UUID, foreign key to optimized_routes.id)
segment_order (int) - the order of segments in the route
start_location_id (UUID, foreign key to locations.id)
end_location_id (UUID, foreign key to locations.id)
distance (float) - segment distance in meters
duration (float) - segment duration in seconds
coordinates (JSON) - the full path coordinates for this segment
```

## Usage

### Python Client
```python
from core.workflow.route_planner import RoutePlanner
from provider.osrm_provider import OSRMProvider

# Initialize the route planner
provider = OSRMProvider()
planner = RoutePlanner(provider)

# Plan a route
points = [
    (40.7128, -74.0060),  # New York
    (34.0522, -118.2437),  # Los Angeles
    (41.8781, -87.6298),  # Chicago
    (29.7604, -95.3698)   # Houston
]

# Get optimized route
route = await planner.plan_route(points)

# Get route statistics
stats = await planner.get_route_statistics(route)
```

### API Client
```bash
# Get distance matrix between New York and Los Angeles
curl "http://localhost:8000/matrix/distance?points=40.7128,-74.0060&points=34.0522,-118.2437"

# Optimize a route between multiple points
curl -X POST -H "Content-Type: application/json" \
  -d '{"points": [{"lat": 40.7128, "lon": -74.0060}, {"lat": 34.0522, "lon": -118.2437}]}' \
  http://localhost:8000/optimize
  
# Optimize and store a route for day 1 of trip
curl -X POST -H "Content-Type: application/json" \
  -d '{"locations": ["uuid1", "uuid2", "uuid3"], "mode": "walking", "round_trip": true}' \
  http://localhost:8000/trips/trip-uuid/days/1/optimize
  
# Get the stored route for day 1 of trip
curl http://localhost:8000/trips/trip-uuid/days/1/route
```

## Development

### Setup
1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up the database:
```bash
# Create .env file from example
cp .env.example .env

# Edit the database connection settings in .env
# Create database in PostgreSQL
createdb tripplanner

# Run migrations (once Alembic is set up)
alembic upgrade head
```

4. Start the API server:
```bash
uvicorn app:app --reload
```

5. Access the API documentation:
```
Swagger UI: http://localhost:8000/docs
ReDoc: http://localhost:8000/redoc
```

### Running Tests
```bash
pytest -v
```

## Next Steps
1. ✅ Implement RESTful API endpoints
2. ✅ Add database integration for route history
3. ✅ Create API documentation
4. Implement caching layer
5. Add request validation
6. Add monitoring and logging
7. Implement rate limiting
