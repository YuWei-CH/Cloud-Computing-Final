# TripPlanner Route Optimization Service

A local-first, AWS-compatible route optimization service that supports multiple routing providers and TSP optimization.

## Features

- Multiple routing providers (OSRM, AWS Location Service)
- Traveling Salesman Problem (TSP) optimization
- Caching support (local memory, Redis, AWS ElastiCache)
- AWS Lambda compatible
- Async/await for better performance
- Comprehensive test coverage

## Setup

1. Create and activate virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=provider

# Run specific test file
pytest test/test_mock_provider.py
```

## Development

The project structure follows a modular design for easy AWS migration:

```
tripplanner/
├── app.py                 # FastAPI application
├── config.py             # Configuration management
├── requirements.txt      # Dependencies
├── .env                  # Environment variables
├── provider/            # Routing providers
│   ├── base.py          # Base provider interface
│   ├── osrm_provider.py # OSRM implementation
│   └── mock_provider.py # Mock for testing
└── test/                # Test suite
```

## AWS Migration

The service is designed to be easily migrated to AWS:

1. Replace OSRM provider with AWS Location Service
2. Switch Redis cache to AWS ElastiCache
3. Deploy to AWS Lambda
4. Use API Gateway for HTTP endpoints

## License

MIT License
