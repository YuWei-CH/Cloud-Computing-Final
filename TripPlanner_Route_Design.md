# TripPlanner Route Optimization Module Design

> **Goal:** Build a local-first, AWS-compatible route optimization engine with minimal effort to migrate later to AWS Lambda + Amazon Location Service.

---

## ✅ Project Goals

1. **Build locally first**, no AWS dependency.
2. **Keep modular structure**, prepare for cloud-native AWS migration.
3. **Support Route Optimization (TSP)** for multiple POIs.
4. **Cache and persistence layer**, easily swappable (Redis → ElastiCache, SQLite → DynamoDB).
5. **Provide GeoJSON-compatible output** for map rendering.

---

## 🧱 Optimized Architecture Overview

```
tripplanner/
│
├── app.py                         # FastAPI or Flask API (mock API Gateway)
├── config.py                      # Configuration (provider type, API keys)
│
├── core/
│   ├── router.py                  # Main logic controller (TSP + route)
│   ├── optimizer.py               # TSP solver (brute-force, OR-Tools)
│   ├── geojson.py                 # GeoJSON format generator
│
├── provider/                      # Interchangeable route services
│   ├── base.py                    # Abstract class
│   ├── osrm_provider.py           # OSRM (OpenStreetMap)
│   ├── aws_provider.py            # AWS Location Service (future)
│   └── mock_provider.py           # Local mock for testing
│
├── storage/
│   ├── cache.py                   # Local memory/Redis cache
│   └── db.py                      # SQLite (DynamoDB later)
│
├── test/
│   └── test_optimizer.py
│
└── requirements.txt
```

---

## 🧩 Module Responsibilities

| Module         | Responsibility                          | AWS Migration Ready |
|----------------|------------------------------------------|---------------------|
| router.py      | Core logic, route coordination            | ✅                  |
| optimizer.py   | TSP logic (brute-force, OR-Tools)         | ✅                  |
| geojson.py     | Format output as GeoJSON                  | ✅                  |
| provider/*     | Pluggable route providers                 | ✅                  |
| cache.py       | Caching (in-memory or Redis)              | ✅                  |
| db.py          | Local SQLite or stub                      | ✅                  |

---

## 📦 RoutingProvider Interface

```python
class RoutingProvider:
    def get_distance(self, src: Tuple[float, float], dst: Tuple[float, float]) -> float:
        raise NotImplementedError
    
    def get_route(self, src: Tuple[float, float], dst: Tuple[float, float]) -> List[Tuple[float, float]]:
        raise NotImplementedError
```

---

## 🔁 Pluggable Design Example

```python
# config.py
PROVIDER = 'osrm'  # Options: 'aws', 'mock'
```

```python
# router.py
from provider.osrm_provider import OSRMProvider as RoutingProvider
```

---

## 🚦 TSP Example Logic

```python
# optimizer.py
import itertools

def tsp_brute_force(start, pois, distance_fn):
    best_cost = float('inf')
    best_path = None
    for perm in itertools.permutations(pois):
        path = [start] + list(perm)
        cost = sum(distance_fn(path[i], path[i+1]) for i in range(len(path)-1))
        if cost < best_cost:
            best_cost = cost
            best_path = path
    return best_path
```

---

## 🌍 Routing Provider Example: OSRM

```python
# osrm_provider.py
import requests

class OSRMProvider:
    def get_distance(self, src, dst):
        url = f"http://router.project-osrm.org/route/v1/driving/{src[0]},{src[1]};{dst[0]},{dst[1]}"
        r = requests.get(url).json()
        return r['routes'][0]['distance']

    def get_route(self, src, dst):
        url = f"http://router.project-osrm.org/route/v1/driving/{src[0]},{src[1]};{dst[0]},{dst[1]}?overview=full&geometries=geojson"
        r = requests.get(url).json()
        return r['routes'][0]['geometry']['coordinates']
```

---

## 🌐 GeoJSON Output Example

```python
def coords_to_geojson(coords):
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        },
        "properties": {}
    }
```

---

## 🔧 FastAPI for Local API Server

```bash
uvicorn app:app --reload
```

---

## ✅ Summary

| Feature | Description |
|--------|-------------|
| 🔌 Modular | Each logic module can be replaced easily |
| 🚀 Fast Dev | Work locally with OSRM + SQLite |
| ☁️ Cloud Ready | Drop-in support for AWS services |
| 📐 Extendable | Caching, DB, TSP all pluggable |
| 🔄 Minimal switch | Only switch provider module for migration |

---

Generated on 2025-04-04
