import pytest
import asyncio
from unittest.mock import MagicMock, AsyncMock, patch
from uuid import uuid4, UUID
from storage.repositories.route_repository import RouteRepository

@pytest.mark.asyncio
async def test_geocode_address(route_repository):
    """Test the geocode_address method with a successful geocoding"""
    address = "New York, NY"
    
    # Configure the mock to return a specific location
    route_repository.geocoder.geocode.return_value = MagicMock(
        latitude=40.7128, 
        longitude=-74.0060
    )
    
    result = await route_repository.geocode_address(address)
    
    # Check the geocoder was called with the correct address
    route_repository.geocoder.geocode.assert_called_once_with(address)
    
    # Check the result contains the expected coordinates
    assert result is not None
    assert result[0] == 40.7128  # latitude
    assert result[1] == -74.0060  # longitude

@pytest.mark.asyncio
async def test_geocode_address_failure(route_repository):
    """Test the geocode_address method with a failed geocoding"""
    address = "Non-existent location"
    
    # Configure the mock to return None (geocoding failure)
    route_repository.geocoder.geocode.return_value = None
    
    result = await route_repository.geocode_address(address)
    
    # Check the geocoder was called with the correct address
    route_repository.geocoder.geocode.assert_called_once_with(address)
    
    # Check that None is returned for failed geocoding
    assert result is None

@pytest.mark.asyncio
async def test_geocode_address_exception(route_repository):
    """Test the geocode_address method when an exception occurs"""
    address = "Error-causing address"
    
    # Configure the mock to raise an exception
    route_repository.geocoder.geocode.side_effect = Exception("Geocoding error")
    
    result = await route_repository.geocode_address(address)
    
    # Check the geocoder was called with the correct address
    route_repository.geocoder.geocode.assert_called_once_with(address)
    
    # Check that None is returned when an exception occurs
    assert result is None

@pytest.mark.asyncio
async def test_get_location_coordinates(route_repository, mock_db_session):
    """Test the get_location_coordinates method"""
    # Create mock location IDs
    location_ids = [uuid4(), uuid4(), uuid4()]
    
    # Configure the session execute to return mock rows
    mock_db_session.execute.return_value = MagicMock()
    mock_rows = [
        (location_ids[0], "New York, NY"),
        (location_ids[1], "Los Angeles, CA"),
        (location_ids[2], None)  # Test with a location that has no address
    ]
    mock_db_session.execute.return_value.__iter__.return_value = mock_rows
    
    # Configure geocode_address to return coordinates for the first two addresses
    # and None for any other address
    async def mock_geocode_address(address):
        if address == "New York, NY":
            return (40.7128, -74.0060)
        elif address == "Los Angeles, CA":
            return (34.0522, -118.2437)
        return None
    
    with patch.object(route_repository, 'geocode_address', side_effect=mock_geocode_address):
        result = await route_repository.get_location_coordinates(location_ids)
    
    # Check the database was queried with the location IDs
    mock_db_session.execute.assert_called_once()
    
    # Check the result contains coordinates for each location
    assert len(result) == 3
    assert result[0] == (40.7128, -74.0060)  # New York
    assert result[1] == (34.0522, -118.2437)  # Los Angeles
    # The third result should be a fallback (0, 0) or a mock coordinate

@pytest.mark.asyncio
async def test_get_locations_for_everyday(route_repository, mock_db_session):
    """Test the get_locations_for_everyday method"""
    # Create a mock everyday ID
    everyday_id = uuid4()
    
    # Configure the session execute to return mock location rows
    mock_db_session.execute.return_value = MagicMock()
    mock_mappings = [
        {"id": uuid4(), "name": "New York", "address": "New York, NY"},
        {"id": uuid4(), "name": "Los Angeles", "address": "Los Angeles, CA"}
    ]
    mock_db_session.execute.return_value.mappings.return_value = mock_mappings
    
    result = await route_repository.get_locations_for_everyday(everyday_id)
    
    # Check the database was queried with the everyday ID
    mock_db_session.execute.assert_called_once()
    
    # Check the result contains the expected locations
    assert len(result) == 2
    assert result[0]["name"] == "New York"
    assert result[0]["address"] == "New York, NY"
    assert result[1]["name"] == "Los Angeles"
    assert result[1]["address"] == "Los Angeles, CA"

@pytest.mark.asyncio
async def test_get_everyday_location_ids(route_repository, mock_db_session):
    """Test the get_everyday_location_ids method"""
    # Create a mock everyday ID
    everyday_id = uuid4()
    
    # Create mock location IDs to return
    mock_location_ids = [uuid4(), uuid4(), uuid4()]
    
    # Configure the session execute to return mock rows for location_ids
    mock_db_session.execute.return_value = MagicMock()
    mock_rows = [(mock_location_ids[0],), (mock_location_ids[1],), (mock_location_ids[2],)]
    mock_db_session.execute.return_value.__iter__.return_value = mock_rows
    
    # Call the method
    result = await route_repository.get_everyday_location_ids(everyday_id)
    
    # Check the database was queried
    mock_db_session.execute.assert_called_once()
    
    # Check the result contains the expected location IDs
    assert len(result) == 3
    assert result[0] == mock_location_ids[0]
    assert result[1] == mock_location_ids[1]
    assert result[2] == mock_location_ids[2]

@pytest.mark.asyncio
async def test_get_everyday_location_ids_empty(route_repository, mock_db_session):
    """Test the get_everyday_location_ids method when there are no locations"""
    # Create a mock everyday ID
    everyday_id = uuid4()
    
    # Configure the session execute to return empty result
    mock_db_session.execute.return_value = MagicMock()
    mock_rows = []
    mock_db_session.execute.return_value.__iter__.return_value = mock_rows
    
    # Call the method
    result = await route_repository.get_everyday_location_ids(everyday_id)
    
    # Check the database was queried
    mock_db_session.execute.assert_called_once()
    
    # Check the result is an empty list
    assert isinstance(result, list)
    assert len(result) == 0

@pytest.mark.asyncio
async def test_get_everyday_location_ids_db_error(route_repository, mock_db_session):
    """Test the get_everyday_location_ids method when the database query fails"""
    # Create a mock everyday ID
    everyday_id = uuid4()
    
    # Configure the session execute to raise an exception
    mock_db_session.execute.side_effect = Exception("Database error")
    
    # Call the method and expect an exception
    with pytest.raises(Exception) as exc_info:
        await route_repository.get_everyday_location_ids(everyday_id)
    
    # Check the exception message
    assert "Database error" in str(exc_info.value)
    
    # Check the database query was attempted
    mock_db_session.execute.assert_called_once() 