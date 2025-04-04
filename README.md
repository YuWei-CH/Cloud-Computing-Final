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

### Pending Features
- ❌ API Integration
  - RESTful API endpoints
  - API documentation
  - Rate limiting
  - Authentication/Authorization
  - Request validation
  - Error handling middleware

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
└── test/
    ├── test_route_optimizer.py
    └── test_route_planner.py
```

## Usage

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

### Running Tests
```bash
pytest -v
```

## Next Steps
1. Implement RESTful API endpoints
2. Add database integration for route history
3. Implement caching layer
4. Add user authentication
5. Create API documentation
6. Add monitoring and logging
7. Implement rate limiting
8. Add request validation
