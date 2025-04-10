import pytest
from pydantic import ValidationError
from app import RouteRequest, Point, AddressPoint, LocationInfo

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

def test_address_point_model():
    """Test the AddressPoint model"""
    # Valid address point with name
    address = AddressPoint(address="New York, NY", name="Empire State Building")
    assert address.address == "New York, NY"
    assert address.name == "Empire State Building"
    
    # Valid address point without name
    address = AddressPoint(address="New York, NY")
    assert address.address == "New York, NY"
    assert address.name is None
    
    # Invalid address point
    with pytest.raises(ValidationError):
        AddressPoint()

def test_point_model():
    """Test the Point model"""
    # Valid point with address
    point = Point(lat=40.7128, lon=-74.0060, address="New York, NY")
    assert point.lat == 40.7128
    assert point.lon == -74.0060
    assert point.address == "New York, NY"
    
    # Valid point without address
    point = Point(lat=40.7128, lon=-74.0060)
    assert point.lat == 40.7128
    assert point.lon == -74.0060
    assert point.address is None
    
    # Invalid point (missing coordinates)
    with pytest.raises(ValidationError):
        Point(address="New York, NY")

def test_location_info_model():
    """Test the LocationInfo model"""
    # Valid location with all fields
    location = LocationInfo(
        lat=40.7128, 
        lon=-74.0060, 
        address="New York, NY", 
        name="Empire State Building"
    )
    assert location.lat == 40.7128
    assert location.lon == -74.0060
    assert location.address == "New York, NY"
    assert location.name == "Empire State Building"
    
    # Valid location with only required fields
    location = LocationInfo(lat=40.7128, lon=-74.0060)
    assert location.lat == 40.7128
    assert location.lon == -74.0060
    assert location.address is None
    assert location.name is None
    
    # Invalid location (missing coordinates)
    with pytest.raises(ValidationError):
        LocationInfo(address="New York, NY") 