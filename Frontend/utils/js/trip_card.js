document.addEventListener('DOMContentLoaded', function () {
    // Get trip ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get('trip_id');

    if (tripId) {
        fetchTripDetails(tripId);
    } else {
        document.getElementById('route-status').innerHTML =
            '<div class="error">Error: No trip ID provided</div>';
    }
});

// Fetch trip details from API
async function fetchTripDetails(tripId) {
    try {
        // Update status
        document.getElementById('route-status').innerHTML =
            '<div>Loading trip details...</div>';

        // Here you would fetch the trip details from your API
        // For example:
        // const response = await fetch(`https://your-api-gateway-url/trips/${tripId}`);
        // const tripData = await response.json();

        // For demo purposes, we'll use mock data based on the trip ID
        const tripData = getMockTripData(tripId);

        // Display trip details
        displayTripDetails(tripData);

        // Initialize the map
        initMap(tripData);

    } catch (error) {
        console.error('Error fetching trip details:', error);
        document.getElementById('route-status').innerHTML =
            `<div class="error">Error loading trip: ${error.message}</div>`;
    }
}

// Display trip details in the sidebar
function displayTripDetails(trip) {
    const statusElement = document.getElementById('route-status');
    statusElement.innerHTML = `
        <h2>${trip.start_city} Trip</h2>
        <div class="trip-dates">
            <i class="far fa-calendar-alt"></i> 
            ${new Date(trip.start_date).toLocaleDateString()} 
            (${trip.duration} days)
        </div>
        <div class="trip-status ${trip.status.toLowerCase()}">
            ${trip.status}
        </div>
    `;

    // Generate day buttons
    const dayButtonsContainer = document.getElementById('day-buttons');
    dayButtonsContainer.innerHTML = '';

    trip.everyday.forEach(day => {
        const dayButton = document.createElement('button');
        dayButton.className = 'day-button';
        dayButton.setAttribute('data-day-id', day.id);
        dayButton.innerHTML = `
            <strong>Day ${day.day_number}</strong>
            <div>${day.current_city}</div>
            <small>${day.locations.length} locations</small>
        `;

        dayButton.addEventListener('click', () => showDayRoute(trip, day));
        dayButtonsContainer.appendChild(dayButton);
    });
}

// Initialize Google Map
function initMap(trip) {
    // Create map centered on the trip's start city
    const mapDiv = document.getElementById('map');
    const map = new google.maps.Map(mapDiv, {
        zoom: 12,
        center: getCityCoordinates(trip.start_city)
    });

    // Store map in global scope for later use
    window.tripMap = map;
    window.tripMarkers = [];

    // Show the first day by default
    if (trip.everyday && trip.everyday.length > 0) {
        showDayRoute(trip, trip.everyday[0]);
    }
}

// Show route for a specific day
function showDayRoute(trip, day) {
    // Clear existing markers
    clearMap();

    const map = window.tripMap;
    if (!map) return;

    // Highlight the selected day button
    document.querySelectorAll('.day-button').forEach(btn => {
        btn.classList.remove('active');
    });
    const selectedButton = document.querySelector(`.day-button[data-day-id="${day.id}"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }

    // Add markers for each location
    const bounds = new google.maps.LatLngBounds();
    const markers = [];

    day.locations.forEach((location, index) => {
        // Get coordinates (in a real app, you'd use geocoding or stored coordinates)
        const position = getLocationCoordinates(location);
        bounds.extend(position);

        // Create marker
        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: location.name,
            label: (index + 1).toString()
        });

        // Add info window
        const infoWindow = new google.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <h3>${location.name}</h3>
                    <p>${location.address}</p>
                </div>
            `
        });

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });

        markers.push(marker);
        window.tripMarkers.push(marker);
    });

    // If there are multiple locations, draw a route between them
    if (day.locations.length > 1) {
        const path = day.locations.map(location => getLocationCoordinates(location));

        const route = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 2
        });

        route.setMap(map);
        window.currentRoute = route;
    }

    // Fit map to show all markers
    if (markers.length > 0) {
        map.fitBounds(bounds);
    }
}

// Show all routes for the entire trip
function showAllRoutes() {
    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get('trip_id');

    if (tripId) {
        const tripData = getMockTripData(tripId);

        // Clear existing markers
        clearMap();

        // Create bounds to contain all locations
        const bounds = new google.maps.LatLngBounds();

        // Add markers for all days with different colors
        const dayColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

        tripData.everyday.forEach((day, dayIndex) => {
            const color = dayColors[dayIndex % dayColors.length];

            // Create markers for this day
            day.locations.forEach((location, locIndex) => {
                const position = getLocationCoordinates(location);
                bounds.extend(position);

                // Create marker with day number in label
                const marker = new google.maps.Marker({
                    position: position,
                    map: window.tripMap,
                    title: `Day ${day.day_number}: ${location.name}`,
                    label: `${day.day_number}.${locIndex + 1}`,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: color,
                        fillOpacity: 0.6,
                        strokeWeight: 1,
                        scale: 10
                    }
                });

                window.tripMarkers.push(marker);
            });

            // Draw route for this day
            if (day.locations.length > 1) {
                const path = day.locations.map(location => getLocationCoordinates(location));

                const route = new google.maps.Polyline({
                    path: path,
                    geodesic: true,
                    strokeColor: color,
                    strokeOpacity: 1.0,
                    strokeWeight: 3
                });

                route.setMap(window.tripMap);
                if (!window.allRoutes) window.allRoutes = [];
                window.allRoutes.push(route);
            }
        });

        // Fit map to show all markers
        window.tripMap.fitBounds(bounds);
    }
}

// Clear all markers and routes from the map
function clearMap() {
    // Clear markers
    if (window.tripMarkers) {
        window.tripMarkers.forEach(marker => marker.setMap(null));
        window.tripMarkers = [];
    }

    // Clear current route
    if (window.currentRoute) {
        window.currentRoute.setMap(null);
        window.currentRoute = null;
    }

    // Clear all routes
    if (window.allRoutes) {
        window.allRoutes.forEach(route => route.setMap(null));
        window.allRoutes = [];
    }
}

// Helper function to get coordinates for a city (mock implementation)
function getCityCoordinates(cityName) {
    const cities = {
        'New York City': { lat: 40.7128, lng: -74.0060 },
        'Miami': { lat: 25.7617, lng: -80.1918 },
        'Colorado': { lat: 39.5501, lng: -105.7821 },
        'Unknown City': { lat: 0, lng: 0 }
    };

    return cities[cityName] || cities['Unknown City'];
}

// Helper function to get coordinates for a location (mock implementation)
function getLocationCoordinates(location) {
    // In a real app, you would use geocoding or stored coordinates
    // For demo purposes, we'll generate random coordinates near the city
    const cityName = location.address.split(',').pop().trim();
    const cityCoords = getCityCoordinates(cityName);

    // Add small random offset to create different points in the city
    const lat = cityCoords.lat + (Math.random() - 0.5) * 0.05;
    const lng = cityCoords.lng + (Math.random() - 0.5) * 0.05;

    return { lat, lng };
}

// Mock data generation (in a real app, this would come from your API)
function getMockTripData(tripId) {
    // Predefined trips based on ID
    const trips = {
        "11111111-1111-1111-1111-111111111111": {
            id: "11111111-1111-1111-1111-111111111111",
            user_id: "user-123",
            start_city: "Miami",
            end_city: "Miami",
            duration: 3,
            status: "Completed",
            start_date: "2025-05-01",
            everyday: [
                {
                    id: "day-1-miami",
                    trip_id: "11111111-1111-1111-1111-111111111111",
                    current_city: "Miami",
                    day_number: 1,
                    start_location: "Miami Airport",
                    locations: [
                        { id: "loc-1", name: "South Beach", address: "South Beach, Miami" },
                        { id: "loc-2", name: "Art Deco District", address: "Ocean Drive, Miami" },
                        { id: "loc-3", name: "Bayside Marketplace", address: "Bayside Marketplace, Miami" }
                    ]
                },
                {
                    id: "day-2-miami",
                    trip_id: "11111111-1111-1111-1111-111111111111",
                    current_city: "Miami",
                    day_number: 2,
                    start_location: null,
                    locations: [
                        { id: "loc-4", name: "Vizcaya Museum", address: "Vizcaya Museum, Miami" },
                        { id: "loc-5", name: "Little Havana", address: "Little Havana, Miami" }
                    ]
                },
                {
                    id: "day-3-miami",
                    trip_id: "11111111-1111-1111-1111-111111111111",
                    current_city: "Miami",
                    day_number: 3,
                    start_location: null,
                    locations: [
                        { id: "loc-6", name: "Everglades National Park", address: "Everglades, Miami" },
                        { id: "loc-7", name: "Coral Castle", address: "Coral Castle, Miami" }
                    ]
                }
            ]
        },
        "22222222-2222-2222-2222-222222222222": {
            id: "22222222-2222-2222-2222-222222222222",
            user_id: "user-123",
            start_city: "New York City",
            end_city: "New York City",
            duration: 4,
            status: "Upcoming",
            start_date: "2025-06-15",
            everyday: [
                {
                    id: "day-1-nyc",
                    trip_id: "22222222-2222-2222-2222-222222222222",
                    current_city: "New York City",
                    day_number: 1,
                    start_location: "JFK Airport",
                    locations: [
                        { id: "loc-ny-1", name: "Times Square", address: "Times Square, New York City" },
                        { id: "loc-ny-2", name: "Empire State Building", address: "Empire State Building, New York City" }
                    ]
                },
                {
                    id: "day-2-nyc",
                    trip_id: "22222222-2222-2222-2222-222222222222",
                    current_city: "New York City",
                    day_number: 2,
                    start_location: null,
                    locations: [
                        { id: "loc-ny-3", name: "Central Park", address: "Central Park, New York City" },
                        { id: "loc-ny-4", name: "Metropolitan Museum of Art", address: "Metropolitan Museum, New York City" }
                    ]
                },
                {
                    id: "day-3-nyc",
                    trip_id: "22222222-2222-2222-2222-222222222222",
                    current_city: "New York City",
                    day_number: 3,
                    start_location: null,
                    locations: [
                        { id: "loc-ny-5", name: "Statue of Liberty", address: "Liberty Island, New York City" },
                        { id: "loc-ny-6", name: "Brooklyn Bridge", address: "Brooklyn Bridge, New York City" }
                    ]
                },
                {
                    id: "day-4-nyc",
                    trip_id: "22222222-2222-2222-2222-222222222222",
                    current_city: "New York City",
                    day_number: 4,
                    start_location: null,
                    locations: [
                        { id: "loc-ny-7", name: "One World Trade Center", address: "World Trade Center, New York City" },
                        { id: "loc-ny-8", name: "Broadway Show", address: "Theater District, New York City" }
                    ]
                }
            ]
        },
        "33333333-3333-3333-3333-333333333333": {
            id: "33333333-3333-3333-3333-333333333333",
            user_id: "user-123",
            start_city: "Colorado",
            end_city: "Colorado",
            duration: 5,
            status: "Planning",
            start_date: "2025-07-10",
            everyday: [
                {
                    id: "day-1-co",
                    trip_id: "33333333-3333-3333-3333-333333333333",
                    current_city: "Denver",
                    day_number: 1,
                    start_location: "Denver Airport",
                    locations: [
                        { id: "loc-co-1", name: "Denver Union Station", address: "Union Station, Colorado" },
                        { id: "loc-co-2", name: "Red Rocks Park", address: "Red Rocks, Colorado" }
                    ]
                },
                {
                    id: "day-2-co",
                    trip_id: "33333333-3333-3333-3333-333333333333",
                    current_city: "Boulder",
                    day_number: 2,
                    start_location: null,
                    locations: [
                        { id: "loc-co-3", name: "Flatirons", address: "Flatirons, Colorado" },
                        { id: "loc-co-4", name: "Pearl Street Mall", address: "Pearl Street, Colorado" }
                    ]
                },
                {
                    id: "day-3-co",
                    trip_id: "33333333-3333-3333-3333-333333333333",
                    current_city: "Colorado Springs",
                    day_number: 3,
                    start_location: null,
                    locations: [
                        { id: "loc-co-5", name: "Garden of the Gods", address: "Garden of the Gods, Colorado" },
                        { id: "loc-co-6", name: "Pikes Peak", address: "Pikes Peak, Colorado" }
                    ]
                },
                {
                    id: "day-4-co",
                    trip_id: "33333333-3333-3333-3333-333333333333",
                    current_city: "Aspen",
                    day_number: 4,
                    start_location: null,
                    locations: [
                        { id: "loc-co-7", name: "Maroon Bells", address: "Maroon Bells, Colorado" }
                    ]
                },
                {
                    id: "day-5-co",
                    trip_id: "33333333-3333-3333-3333-333333333333",
                    current_city: "Denver",
                    day_number: 5,
                    start_location: null,
                    locations: [
                        { id: "loc-co-8", name: "Denver Art Museum", address: "Art Museum, Colorado" },
                        { id: "loc-co-9", name: "Denver Botanic Gardens", address: "Botanic Gardens, Colorado" }
                    ]
                }
            ]
        }
    };

    return trips[tripId] || {
        id: tripId,
        user_id: "unknown",
        start_city: "Unknown City",
        end_city: "Unknown City",
        duration: 1,
        status: "Unknown",
        start_date: "2025-01-01",
        everyday: [
            {
                id: "day-1-unknown",
                trip_id: tripId,
                current_city: "Unknown City",
                day_number: 1,
                start_location: null,
                locations: []
            }
        ]
    };
}
