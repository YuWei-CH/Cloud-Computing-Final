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

### Pending Features
- ⚠️ API Integration
  - ✅ RESTful API endpoints
  - ❌ API documentation
  - ❌ Rate limiting
  - ❌ Authentication/Authorization
  - ❌ Request validation
  - ⚠️ Error handling middleware (basic implementation)

- ❌ Storage Management
  - Route history storage
  - User preferences storage
  - Caching layer for frequently accessed routes
  - Database integration
  - Data persistence

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
├── test/
│   ├── test_route_optimizer.py
│   └── test_route_planner.py
├── app.py                       # FastAPI application
└── config.py                    # Configuration settings
```

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

3. Start the API server:
```bash
uvicorn app:app --reload
```

### Running Tests
```bash
pytest -v
```

## Next Steps
1. ✅ Implement RESTful API endpoints
2. Add database integration for route history
3. Implement caching layer
4. Add user authentication
5. Create API documentation
6. Add monitoring and logging
7. Implement rate limiting
8. Add request validation
