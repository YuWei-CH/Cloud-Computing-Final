import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi import status
from app import app, RouteRequest, Point, AddressPoint
from storage.repositories.route_repository import RouteRepository
from provider.base import TransportMode, Route, RouteSegment

# Helper to create a mock route
def create_mock_route():
    return Route(
        segments=[
            RouteSegment(
                distance=1000,
                duration=120,
                coordinates=[(40.7128, -74.0060), (34.0522, -118.2437)],
                mode=TransportMode.DRIVING
            )
        ],
        total_distance=1000,
        total_duration=120,
        coordinates=[(40.7128, -74.0060), (34.0522, -118.2437)]
    )

def test_route_request_validation():
    """Test that RouteRequest properly validates inputs"""
    # Valid request with points
    valid_points = {
        "points": [{"lat": 40.7128, "lon": -74.0060}],
        "round_trip": True
    }
    request = RouteRequest(**valid_points)
    assert request.points is not None
    assert request.addresses is None
    
    # Valid request with addresses
    valid_addresses = {
        "addresses": [{"address": "New York, NY"}],
        "round_trip": True
    }
    request = RouteRequest(**valid_addresses)
    assert request.points is None
    assert request.addresses is not None
    
    # Invalid request with neither points nor addresses
    invalid_request = {
        "round_trip": True
    }
    with pytest.raises(ValueError):
        RouteRequest(**invalid_request)

def test_optimize_with_coordinates(client, monkeypatch):
    """Test the /optimize endpoint with coordinate-based points"""
    # Mock the route planner
    async def mock_plan_route(*args, **kwargs):
        return create_mock_route()
    
    async def mock_get_route_statistics(*args, **kwargs):
        return {
            "total_distance": 1000,
            "total_duration": 120,
            "average_speed": 8.33,
            "number_of_segments": 1
        }
        
    # Apply the mock
    monkeypatch.setattr("app.route_planner.plan_route", mock_plan_route)
    monkeypatch.setattr("app.route_planner.get_route_statistics", mock_get_route_statistics)
    
    # Make the request
    payload = {
        "points": [
            {"lat": 40.7128, "lon": -74.0060},
            {"lat": 34.0522, "lon": -118.2437}
        ],
        "round_trip": True,
        "mode": "driving"
    }
    
    response = client.post("/optimize", json=payload)
    
    # Check the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_distance"] == 1000
    assert data["total_duration"] == 120
    assert len(data["waypoints"]) == 2
    assert len(data["segments"]) == 1
    assert data["statistics"]["total_distance"] == 1000

def test_optimize_with_addresses(client, monkeypatch):
    """Test the /optimize endpoint with address-based points"""
    # Mock geocode_address in RouteRepository
    async def mock_geocode_address(self, address):
        if address == "New York, NY":
            return (40.7128, -74.0060)
        elif address == "Los Angeles, CA":
            return (34.0522, -118.2437)
        return None
    
    # Mock route planner methods
    async def mock_plan_route(*args, **kwargs):
        return create_mock_route()
    
    async def mock_get_route_statistics(*args, **kwargs):
        return {
            "total_distance": 1000,
            "total_duration": 120,
            "average_speed": 8.33,
            "number_of_segments": 1
        }
    
    # Apply the mocks
    monkeypatch.setattr(RouteRepository, "geocode_address", mock_geocode_address)
    monkeypatch.setattr("app.route_planner.plan_route", mock_plan_route)
    monkeypatch.setattr("app.route_planner.get_route_statistics", mock_get_route_statistics)
    
    # Make the request
    payload = {
        "addresses": [
            {"address": "New York, NY", "name": "New York"},
            {"address": "Los Angeles, CA", "name": "Los Angeles"}
        ],
        "round_trip": True,
        "mode": "driving"
    }
    
    response = client.post("/optimize", json=payload)
    
    # Check the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["total_distance"] == 1000
    assert data["total_duration"] == 120
    assert len(data["waypoints"]) == 2
    assert data["waypoints"][0]["address"] == "New York, NY"
    assert data["waypoints"][0]["name"] == "New York"
    assert data["waypoints"][1]["address"] == "Los Angeles, CA"
    assert data["waypoints"][1]["name"] == "Los Angeles"

def test_distance_matrix_with_addresses(client, monkeypatch):
    """Test the /matrix/distance endpoint with addresses"""
    # Mock geocode_address in RouteRepository
    async def mock_geocode_address(self, address):
        if address == "New York, NY":
            return (40.7128, -74.0060)
        elif address == "Los Angeles, CA":
            return (34.0522, -118.2437)
        return None
    
    # Mock get_distance_matrix
    async def mock_get_distance_matrix(points):
        matrix = {}
        for i, start in enumerate(points):
            for j, end in enumerate(points):
                if i == j:
                    matrix[(start, end)] = 0
                else:
                    matrix[(start, end)] = 1000 * (i + j)
        return matrix
    
    # Apply the mocks
    monkeypatch.setattr(RouteRepository, "geocode_address", mock_geocode_address)
    monkeypatch.setattr("app.route_planner.get_distance_matrix", mock_get_distance_matrix)
    
    # Make the request
    response = client.get("/matrix/distance?addresses=New%20York,%20NY&addresses=Los%20Angeles,%20CA")
    
    # Check the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "New York, NY" in data
    assert "Los Angeles, CA" in data
    assert data["New York, NY"]["Los Angeles, CA"] == 1000
    assert data["Los Angeles, CA"]["New York, NY"] == 1000

def test_duration_matrix_with_addresses(client, monkeypatch):
    """Test the /matrix/duration endpoint with addresses"""
    # Mock geocode_address in RouteRepository
    async def mock_geocode_address(self, address):
        if address == "New York, NY":
            return (40.7128, -74.0060)
        elif address == "Los Angeles, CA":
            return (34.0522, -118.2437)
        return None
    
    # Mock get_duration_matrix
    async def mock_get_duration_matrix(points):
        matrix = {}
        for i, start in enumerate(points):
            for j, end in enumerate(points):
                if i == j:
                    matrix[(start, end)] = 0
                else:
                    matrix[(start, end)] = 120 * (i + j)
        return matrix
    
    # Apply the mocks
    monkeypatch.setattr(RouteRepository, "geocode_address", mock_geocode_address)
    monkeypatch.setattr("app.route_planner.get_duration_matrix", mock_get_duration_matrix)
    
    # Make the request
    response = client.get("/matrix/duration?addresses=New%20York,%20NY&addresses=Los%20Angeles,%20CA")
    
    # Check the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "New York, NY" in data
    assert "Los Angeles, CA" in data
    assert data["New York, NY"]["Los Angeles, CA"] == 120
    assert data["Los Angeles, CA"]["New York, NY"] == 120

def test_mixed_coordinates_and_addresses(client, monkeypatch):
    """Test using both coordinates and addresses in the same request"""
    # Mock geocode_address in RouteRepository
    async def mock_geocode_address(self, address):
        if address == "Chicago, IL":
            return (41.8781, -87.6298)
        return None
    
    # Mock get_distance_matrix
    async def mock_get_distance_matrix(points):
        matrix = {}
        for i, start in enumerate(points):
            for j, end in enumerate(points):
                if i == j:
                    matrix[(start, end)] = 0
                else:
                    matrix[(start, end)] = 1000 * (i + j)
        return matrix
    
    # Apply the mocks
    monkeypatch.setattr(RouteRepository, "geocode_address", mock_geocode_address)
    monkeypatch.setattr("app.route_planner.get_distance_matrix", mock_get_distance_matrix)
    
    # Make the request with both point coordinates and addresses
    response = client.get(
        "/matrix/distance?points=40.7128,-74.0060&points=34.0522,-118.2437&addresses=Chicago,%20IL"
    )
    
    # Check the response
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "40.7128,-74.0060" in data
    assert "34.0522,-118.2437" in data
    assert "Chicago, IL" in data 