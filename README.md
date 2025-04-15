# 🗺️ Route Optimization Microservice

<div align="center">

![Python](https://img.shields.io/badge/python-v3.8+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.68.0-green.svg)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

A powerful microservice for optimizing multi-point routes using various transportation modes.

[Features](#features) • [Quick Start](#quick-start) • [API Documentation](#api-documentation) • [Examples](#examples)

</div>

## ✨ Features

### 🚀 Core Features
- 🛣️ Advanced route optimization with distance-based algorithms
- 🚶‍♂️ Multi-modal transportation support (driving, walking, cycling)
- 🌳 K-d tree optimization for large datasets
- 🔄 Round-trip and non-round-trip route planning
- 📏 Distance and duration matrix calculations
- 🗺️ Interactive route visualization
- 📅 Multi-day trip planning and visualization

### 🛠️ Technical Features
- 📚 Comprehensive test coverage
- 🔄 Mock provider for testing
- 🌐 OSRM provider integration
- 🚀 RESTful API endpoints
- ⚡ High-performance database storage
- 📊 Interactive API documentation
- 🔒 Basic error handling

### 🚧 In Progress
- 🚦 Rate limiting
- ✅ Request validation
- 💾 Caching layer for frequent routes
- ⚠️ Enhanced error handling middleware

## 🚀 Quick Start

Get started in minutes with our automated setup:

```bash
# Make the script executable
chmod +x setup.sh

# Run the setup script
./setup.sh
```

The setup script handles everything:
1. 📦 Package management (Homebrew)
2. 🗃️ Database setup (PostgreSQL 14)
3. 🐍 Python environment
4. 📚 Dependencies
5. 🔧 Configuration
6. 🗃️ Database migrations

Start the API server:
```bash
source venv/bin/activate
uvicorn app:app --reload
```

## 📁 Project Structure

```
project/
├── core/                    # Core functionality
│   ├── optimization/       # Route optimization algorithms
│   ├── workflow/          # Main orchestrator
│   └── visualization/     # Route visualization tools
├── provider/              # Route providers
├── storage/              # Data persistence
├── migrations/           # Database migrations
├── test/                # Test suite
├── scripts/             # Utility scripts
├── app.py              # FastAPI application
└── config.py           # Configuration
```

## 📚 API Documentation

Interactive documentation available at runtime:

- 🔍 [Swagger UI](http://localhost:8000/docs)
- 📖 [ReDoc](http://localhost:8000/redoc)

### 🔑 Key Endpoints

#### Health Checks
- `GET /health` - API health status
- `GET /` - Environment info

#### Route Optimization
- `POST /optimize` - Optimize multi-point routes
  ```json
  {
    "points": [
      {"lat": 40.7128, "lon": -74.0060},
      {"lat": 34.0522, "lon": -118.2437}
    ],
    "start_point": {"lat": 40.7128, "lon": -74.0060},
    "end_point": {"lat": 34.0522, "lon": -118.2437},
    "round_trip": true,
    "mode": "driving"
  }
  ```

#### Matrix Calculations
- `GET /matrix/distance` - Distance matrix
- `GET /matrix/duration` - Duration matrix

#### Trip Management
- `POST /trips/{trip_id}/days/{day_number}/optimize` - Day-specific route optimization
- `GET /trips/{trip_id}/routes` - Trip route history

## 💾 Database Schema

### Core Tables
- `trips` - Trip metadata
- `everyday` - Daily trip segments
- `locations` - Point of interest data
- `optimized_routes` - Route optimization results
- `route_segments` - Individual route segments

## 🎨 Route Visualization

### Features
- 🎯 High-visibility route lines
- 🎨 Color-coded segments
- 📍 Custom markers
- 📊 Information sidebar
- 🔍 Smart zoom

### Example Usage
```python
from core.visualization.route_visualizer import RouteVisualizer

# Initialize
visualizer = RouteVisualizer()

# Single route
image_data = visualizer.visualize_route(route)

# Multi-day visualization
image_data = visualizer.visualize_multi_day_routes(routes)

# Save visualization
with open("route_map.png", "wb") as f:
    f.write(base64.b64decode(image_data))
```

## 📝 Examples

### Basic Route Planning
```python
from core.workflow.route_planner import RoutePlanner
from provider.osrm_provider import OSRMProvider

# Setup
provider = OSRMProvider()
planner = RoutePlanner(provider)

# Plan route
points = [
    {"lat": 40.7128, "lon": -74.0060},  # NYC
    {"lat": 34.0522, "lon": -118.2437}, # LA
    {"lat": 41.8781, "lon": -87.6298}   # Chicago
]

route = planner.plan_route(points, mode="driving", round_trip=True)
print(f"Distance: {route.total_distance / 1000:.2f} km")
print(f"Duration: {route.total_duration / 3600:.2f} hours")
```

### Multi-Day Trip Planning
```python
# Create trip
trip_id = await create_trip(db_session, "NYC Adventure", "3-day NYC trip")

# Add locations
locations = [
    {"name": "Times Square", "lat": 40.7580, "lon": -73.9855},
    {"name": "Central Park", "lat": 40.7829, "lon": -73.9654},
    {"name": "Empire State", "lat": 40.7484, "lon": -73.9857}
]

# Optimize and visualize
await route_repo.optimize_route_for_day(
    trip_id=trip_id,
    day_number=1,
    location_ids=location_ids,
    transport_mode="driving"
)

# Visualize
visualizer = RouteVisualizer()
image_data = visualizer.visualize_multi_day_routes(routes)
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
Made with ❤️ by the Route Optimization Team
</div>