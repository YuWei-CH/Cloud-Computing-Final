let map;
let polylines = [];
let tripData = [];
let markers = [];
let infoWindows = [];
let currentDayIndex = -1;
let placesService;
let pendingTripId = null; // Store the trip ID until Google Maps is ready
let currentBounds = null; // Store the current map bounds for resizing
let tripDetails = null; // Store complete trip information including start_date

// Initialize loading state
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    try {
        const tripId = getTripIdFromURL();
        if (!tripId) {
            showError("Trip ID is missing in URL");
            return;
        }

        // Show loading state
        showLoading("Loading your trip...");

        // Store the trip ID for later use when Google Maps is ready
        pendingTripId = tripId;

        // We'll wait for initMap to be called by the Google Maps API
        // Don't call loadTripData here because google is not defined yet
    } catch (error) {
        console.error("Error in initialization:", error);
        showError("Failed to initialize the app. Please refresh the page.");
    }
}

// This function will be called by the Google Maps API when it's loaded
async function initMap() {
    console.log('Initializing map...');
    try {
        // Initialize Google Maps with minimal configuration
        map = new google.maps.Map(document.getElementById("map"), {
            zoom: 2, // Start with a world view
            center: { lat: 0, lng: 0 }, // Center at (0,0)
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Ensure map fills available space
        google.maps.event.addListenerOnce(map, 'idle', function () {
            google.maps.event.trigger(map, 'resize');
        });

        // Fix for map not taking full size
        window.addEventListener('resize', function () {
            google.maps.event.trigger(map, 'resize');
            // Recenter the map if needed
            if (currentBounds) {
                map.fitBounds(currentBounds);
            }
        });

        // Initialize Places service
        placesService = new google.maps.places.PlacesService(map);

        // Now that Google Maps is loaded, we can proceed with the trip data
        if (pendingTripId) {
            await loadTripData(pendingTripId);
        } else {
            const tripId = getTripIdFromURL();
            if (!tripId) {
                showError("Trip ID is missing in URL");
                return;
            }
            await loadTripData(tripId);
        }
    } catch (error) {
        console.error("Error initializing map:", error);
        showError("Failed to initialize the map. Please refresh the page.");
    }
}

// Add this code to the initMap function or after the map is created

// Force resize the map to fit container after initialization
function resizeMap() {
    if (typeof google !== 'undefined' && map) {
        google.maps.event.trigger(map, 'resize');
        if (currentBounds) {
            map.fitBounds(currentBounds);
        }
    }
}

// Call resize on window load and resize events
window.addEventListener('load', resizeMap);
window.addEventListener('resize', resizeMap);

// Check for DOM content loaded to fix map sizing
document.addEventListener('DOMContentLoaded', function () {
    // Add a slight delay to ensure the map container is fully rendered
    setTimeout(resizeMap, 100);
});

function showError(message) {
    hideLoading(); // Ensure loading is hidden when showing error
    const errorModal = document.getElementById("error-modal");
    const errorMessage = document.getElementById("error-message");
    if (errorModal && errorMessage) {
        errorMessage.textContent = message;
        errorModal.style.display = "block";
    } else {
        console.error(message);
    }
}

function showLoading(message = "Loading...") {
    const overlay = document.getElementById("loading-overlay");
    const loadingText = document.querySelector(".loading-text");
    if (overlay && loadingText) {
        loadingText.textContent = message;
        overlay.style.display = "flex";
    }
}

function hideLoading() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

async function loadTripData(tripId) {
    try {
        console.log('Loading trip data for ID:', tripId);

        // First get the complete trip details
        const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        if (!userEmail) {
            throw new Error("User not logged in");
        }
        
        // Fetch full trip details
        console.log("Fetching complete trip details");
        const tripDetailsUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`;
        const detailsResponse = await fetch(tripDetailsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': userEmail
            }
        });
        
        if (!detailsResponse.ok) {
            throw new Error(`Failed to load trip details: ${detailsResponse.statusText}`);
        }
        
        const detailsData = await detailsResponse.json();
        console.log('Trip details loaded:', detailsData);
        
        // Extract trip details from the response
        if (detailsData.statusCode && detailsData.body) {
            // API Gateway Lambda proxy format
            const bodyContent = typeof detailsData.body === 'string' ? JSON.parse(detailsData.body) : detailsData.body;
            tripDetails = bodyContent.trip || bodyContent;
        } else {
            // Direct format
            tripDetails = detailsData.trip || detailsData;
        }
        
        console.log('Parsed trip details:', tripDetails);

        // Now fetch the route data
        const routeUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/routing?trip_id=${tripId}`;
        const routeResponse = await fetch(routeUrl);

        if (!routeResponse.ok) {
            throw new Error(`Failed to load route data: ${routeResponse.statusText}`);
        }

        const data = await routeResponse.json();
        console.log('Route data loaded:', data);

        let parsed;
        try {
            if (data.statusCode && data.body) {
                parsed = JSON.parse(data.body).results;
            } else if (data.results) {
                parsed = data.results;
            } else {
                throw new Error("Invalid response structure from routing Lambda");
            }
        } catch (parseError) {
            console.error("Error parsing response:", parseError);
            throw new Error("Failed to parse route data");
        }

        if (!parsed || parsed.length === 0) {
            throw new Error("No route data available");
        }

        tripData = parsed;
        console.log('Parsed trip data:', tripData);

        // Get the first point of the first day's route to center the map
        const firstDay = tripData[0];
        if (firstDay && firstDay.polyline) {
            const path = google.maps.geometry.encoding.decodePath(firstDay.polyline);
            if (path && path.length > 0) {
                // Center on the first point
                map.setCenter(path[0]);
                map.setZoom(12);
            }
        }

        renderTripData();
        hideLoading();
    } catch (error) {
        console.error("Error loading trip data:", error);
        showError(error.message || "Failed to load trip data");
        hideLoading();
    }
}

function renderTripData() {
    updateTripSummary(tripData[0]);
    renderDayButtons();
    showAllRoutes();
    
    // Default to showing weather for the first day's city
    if (tripData && tripData.length > 0) {
        updateWeatherForDay(0);
    }
}

function updateTripSummary(firstDay) {
    console.log("Trip data for summary:", tripData);
    
    // Focus on extracting city names only
    const cities = new Set();
    
    // Get the main city if we can find it in addresses
    tripData.forEach(day => {
        // Try to extract city from full addresses
        if (day.origin.includes("New York")) {
            cities.add("New York");
        }
        
        // Look for full addresses with comma-separated parts
        if (day.origin.includes(",")) {
            const parts = day.origin.split(",");
            // For address format like "Street, City, State ZIP"
            if (parts.length >= 2) {
                // In US addresses, city is typically the second part
                const potentialCity = parts[1].trim();
                // Only add if it looks like a city (no numbers, reasonable length)
                if (!potentialCity.match(/\d+/) && potentialCity.length < 30) {
                    cities.add(potentialCity);
                }
            }
        }
        
        // Same for destination if it has address format
        if (day.destination.includes(",")) {
            const parts = day.destination.split(",");
            if (parts.length >= 2) {
                const potentialCity = parts[1].trim();
                if (!potentialCity.match(/\d+/) && potentialCity.length < 30) {
                    cities.add(potentialCity);
                }
            }
        }
    });
    
    // Hard-code city extraction for known landmarks in New York
    const nyLandmarks = [
        "Empire State Building", "Central Park", "Brooklyn Bridge", 
        "Times Square", "Statue of Liberty", "One World Observatory"
    ];
    
    // Check if we're in New York based on landmarks
    let hasNyLandmarks = false;
    tripData.forEach(day => {
        // Check origin, destination, and waypoints for NY landmarks
        if (nyLandmarks.some(landmark => day.origin.includes(landmark) || 
                                          day.destination.includes(landmark) ||
                                          (day.waypoints && day.waypoints.some(wp => wp.includes(landmark))))) {
            hasNyLandmarks = true;
        }
    });
    
    // If we found NY landmarks but no city, add New York
    if (hasNyLandmarks && cities.size === 0) {
        cities.add("New York");
    }
    
    // Convert to array and create a formatted string
    let cityList = Array.from(cities);
    console.log("Extracted cities:", cityList);
    
    // If we still don't have cities, just use "Trip" as the title
    let tripTitle = "Trip";
    
    if (cityList.length === 1) {
        tripTitle = `Trip to ${cityList[0]}`;
    } else if (cityList.length === 2) {
        tripTitle = `Trip to ${cityList[0]} and ${cityList[1]}`;
    } else if (cityList.length > 2) {
        // For more than 2 cities, list them with commas and the last one with "and"
        const lastCity = cityList.pop();
        tripTitle = `Trip to ${cityList.join(', ')} and ${lastCity}`;
    }
    
    console.log("Trip title:", tripTitle);
    
    // Use trip title from trip details if available
    if (tripDetails && tripDetails.title) {
        tripTitle = tripDetails.title;
    }
    
    document.getElementById("trip-title").textContent = tripTitle;
    
    // Date calculation ----------------------
    // Get start date from tripDetails
    if (!tripDetails || !tripDetails.start_date) {
        console.error("No trip start date available!");
        document.getElementById("trip-dates").innerHTML = `<i class="fas fa-calendar"></i> Dates not available`;
    document.getElementById("trip-duration").innerHTML = `<i class="fas fa-clock"></i> ${tripData.length} days`;
        document.getElementById("trip-status").innerHTML = `<i class="fas fa-info-circle"></i> Unknown`;
        return;
    }
    
    // Parse start date properly (ensure it's in YYYY-MM-DD format to avoid time zone issues)
    let startDateStr = tripDetails.start_date;
    if (startDateStr.includes('T')) {
        // If ISO format with time, extract just the date part
        startDateStr = startDateStr.split('T')[0];
    }
    console.log(`Parsing start date: ${startDateStr}`);
    
    const tripStartDate = new Date(startDateStr + 'T00:00:00');
    
    // Make sure start date is valid
    if (isNaN(tripStartDate.getTime())) {
        console.error(`Invalid start date: ${tripDetails.start_date}`);
        document.getElementById("trip-dates").innerHTML = `<i class="fas fa-calendar"></i> Invalid date`;
        return;
    }
    
    console.log(`Trip start date parsed as: ${tripStartDate.toISOString()}`);
    
    // Get trip duration (integer)
    const duration = Math.max(1, parseInt(tripDetails.duration) || tripData.length);
    
    // Calculate end date correctly (start date + duration - 1)
    const tripEndDate = new Date(tripStartDate);
    tripEndDate.setDate(tripStartDate.getDate() + duration - 1);
    
    console.log(`Trip date calculation:
      Start date: ${tripStartDate.toISOString()}
      Duration: ${duration} days
      End date: ${tripEndDate.toISOString()}`);
    
    // Format dates properly for display
    const dateRange = `${formatDate(tripStartDate)} - ${formatDate(tripEndDate)}`;
    
    // Update the UI with the correct date information
    document.getElementById("trip-dates").innerHTML = `<i class="fas fa-calendar"></i> ${dateRange}`;
    document.getElementById("trip-duration").innerHTML = `<i class="fas fa-clock"></i> ${duration} days`;
    
    // Set trip status based on the calculated dates
    const status = calculateTripStatus(tripStartDate, duration);
    document.getElementById("trip-status").innerHTML = `<i class="fas fa-info-circle"></i> ${status}`;
}

// Helper function to calculate trip status
function calculateTripStatus(startDate, duration) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison
    
    // Ensure startDate is a Date object
    const tripStart = new Date(startDate);
    tripStart.setHours(0, 0, 0, 0);
    
    // Calculate end date
    const tripEnd = new Date(tripStart);
    tripEnd.setDate(tripStart.getDate() + (parseInt(duration) || 0) - 1);
    tripEnd.setHours(23, 59, 59, 999); // End of the day
    
    // Determine status
    if (tripEnd < today) {
        return "Completed";
    } else if (tripStart <= today && today <= tripEnd) {
        return "In Progress";
    } else {
        return "Upcoming";
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function getTripIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get("trip_id");
}

function renderDayButtons() {
    const container = document.getElementById("day-buttons");
    container.innerHTML = "";

    tripData.forEach((day, idx) => {
        const btn = document.createElement("button");
        btn.className = "day-button";
        btn.innerHTML = `
            <strong>Day ${day.day_number}</strong><br/>
            <small><i class="fas fa-map-marker-alt"></i> ${day.origin}</small><br/>
            <small><i class="fas fa-flag-checkered"></i> ${day.destination}</small>
        `;
        btn.onclick = () => showSingleRoute(idx);
        container.appendChild(btn);
    });
}

// Function to update weather for a specific day
function updateWeatherForDay(dayIndex) {
    if (!tripData || tripData.length === 0) return;
    
    // Ensure the dayIndex is valid
    if (dayIndex < 0 || dayIndex >= tripData.length) {
        dayIndex = 0; // Fallback to the first day
    }
    
    const day = tripData[dayIndex];
    
    // Show a loading indicator in the weather section only (not full screen)
    const weatherContent = document.getElementById("weather-content");
    weatherContent.innerHTML = `<div class="loading-placeholder">Finding location and loading weather...</div>`;
    
    // Get city from the first location of that day (origin)
    // The extractCityFromAddress function will now handle the API calls and update the weather
    let cityName = extractCityFromAddress(day.origin);
    
    // If we got an immediate city result, use it
    if (cityName) {
        console.log(`Using immediate city result: ${cityName} for day ${dayIndex + 1}`);
        fetchWeatherData(cityName);
        return;
    }
    
    // If origin didn't yield an immediate result, try destination (the Google API call from origin might still be processing)
    if (day.destination && day.destination !== day.origin) {
        cityName = extractCityFromAddress(day.destination);
        if (cityName) {
            console.log(`Using destination city: ${cityName} for day ${dayIndex + 1}`);
            fetchWeatherData(cityName);
            return;
        }
    }
    
    // If still no immediate result, try first day's origin as fallback
    if (tripData.length > 0 && tripData[0].origin && tripData[0].origin !== day.origin) {
        cityName = extractCityFromAddress(tripData[0].origin);
        if (cityName) {
            console.log(`Using trip start city: ${cityName} for day ${dayIndex + 1}`);
            fetchWeatherData(cityName);
            return;
        }
    }
    
    // If we reach this point with no immediate city name, the API calls will eventually update the weather
    // or the findMostCommonCityInTrip fallback will be used
}

async function showSingleRoute(index) {
    try {
        clearMap();
        currentDayIndex = index;
        updateRouteStatus(`Showing Day ${tripData[index].day_number}`);

        const day = tripData[index];
        const path = google.maps.geometry.encoding.decodePath(day.polyline);

        // Create route polyline with animation
        const polyline = new google.maps.Polyline({
            path: path,
            geodesic: true,
            strokeColor: '#FF0000',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            map: map
        });
        polylines.push(polyline);

        // Add markers for origin and destination
        const originMarker = await addMarker(path[0], day.origin, 'origin');
        const destMarker = await addMarker(path[path.length - 1], day.destination, 'destination');

        // Add intermediate points only if they have unique location names
        // and are different from origin and destination
        if (day.waypoints && day.waypoints.length > 0) {
            const uniqueLocations = new Set([day.origin, day.destination]);

            for (const waypoint of day.waypoints) {
                if (!uniqueLocations.has(waypoint)) {
                    uniqueLocations.add(waypoint);
                    // Find the closest point on the path for this waypoint
                    const waypointLocation = await getLocationCoordinates(waypoint);
                    if (waypointLocation) {
                        await addMarker(waypointLocation, waypoint, 'waypoint');
                    }
                }
            }
        }

        // Fit bounds to show the entire route
        currentBounds = new google.maps.LatLngBounds();
        path.forEach(p => currentBounds.extend(p));
        map.fitBounds(currentBounds);

        // Animate the route
        animateRoute(polyline);
        
        // Update weather for the selected day
        updateWeatherForDay(index);
    } catch (error) {
        console.error("Error showing route:", error);
        showError("Failed to show route details");
    }
}

// Helper function to get coordinates for a location name
async function getLocationCoordinates(locationName) {
    return new Promise((resolve, reject) => {
        const request = {
            query: locationName,
            fields: ['geometry']
        };

        placesService.findPlaceFromQuery(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                resolve(results[0].geometry.location);
            } else {
                console.warn(`Could not find coordinates for location: ${locationName}`);
                resolve(null);
            }
        });
    });
}

function addMarker(position, locationName, type) {
    return new Promise((resolve, reject) => {
        const icon = {
            origin: {
                url: 'https://maps.google.com/mapfiles/ms/icons/green-dot.png',
                scaledSize: new google.maps.Size(32, 32)
            },
            destination: {
                url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
                scaledSize: new google.maps.Size(32, 32)
            },
            waypoint: {
                url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                scaledSize: new google.maps.Size(24, 24)
            }
        }[type];

        const marker = new google.maps.Marker({
            position: position,
            map: map,
            title: locationName,
            icon: icon,
            animation: google.maps.Animation.DROP
        });

        // Create a request for place details using the location name
        const request = {
            query: locationName,
            fields: ['place_id']
        };

        // First find the place_id using the location name
        placesService.findPlaceFromQuery(request, (results, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                // Now get detailed place information using place_id
                const detailsRequest = {
                    placeId: results[0].place_id,
                    fields: ['name', 'formatted_address', 'photos', 'rating', 'user_ratings_total',
                        'opening_hours', 'website', 'formatted_phone_number', 'reviews']
                };

                placesService.getDetails(detailsRequest, (placeDetails, detailsStatus) => {
                    if (detailsStatus === google.maps.places.PlacesServiceStatus.OK) {
                        // Create info window with place details
                        const photoUrl = placeDetails.photos && placeDetails.photos.length > 0
                            ? placeDetails.photos[0].getUrl({ maxWidth: 400, maxHeight: 200 })
                            : 'https://via.placeholder.com/400x200?text=No+Image';

                        const ratingStars = placeDetails.rating
                            ? '<i class="fas fa-star"></i>'.repeat(Math.floor(placeDetails.rating)) +
                            (placeDetails.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : '')
                            : '';

                        const infoWindow = new google.maps.InfoWindow({
                            content: `
                                <div class="info-window-content">
                                    <div class="info-window-image">
                                        <img src="${photoUrl}" alt="${placeDetails.name}">
                                    </div>
                                    <div class="info-window-details">
                                        <div class="info-window-title">${placeDetails.name}</div>
                                        <div class="info-window-subtitle">
                                            <i class="fas fa-map-marker-alt"></i>
                                            ${placeDetails.formatted_address || locationName}
                                        </div>
                                        ${placeDetails.rating ? `
                                            <div class="info-window-rating">
                                                ${ratingStars}
                                                <span>${placeDetails.rating.toFixed(1)} (${placeDetails.user_ratings_total} reviews)</span>
                                            </div>
                                        ` : ''}
                                        <button onclick="showLocationDetails('${results[0].place_id}', '${locationName}', ${position.lat()}, ${position.lng()})" 
                                                class="info-window-button">
                                            <i class="fas fa-info-circle"></i>
                                            View Details
                                        </button>
                                    </div>
                                </div>
                            `
                        });

                        marker.addListener('click', () => {
                            infoWindows.forEach(iw => iw.close());
                            infoWindow.open(map, marker);
                        });

                        infoWindows.push(infoWindow);
                    } else {
                        // Fallback info window if place details are not available
                        const infoWindow = createFallbackInfoWindow(locationName, position);
                        marker.addListener('click', () => {
                            infoWindows.forEach(iw => iw.close());
                            infoWindow.open(map, marker);
                        });
                        infoWindows.push(infoWindow);
                    }
                });
            } else {
                // Fallback info window if place cannot be found
                const infoWindow = createFallbackInfoWindow(locationName, position);
                marker.addListener('click', () => {
                    infoWindows.forEach(iw => iw.close());
                    infoWindow.open(map, marker);
                });
                infoWindows.push(infoWindow);
            }
        });

        markers.push(marker);
        resolve(marker);
    });
}

function createFallbackInfoWindow(locationName, position) {
    return new google.maps.InfoWindow({
        content: `
            <div class="info-window-content">
                <div class="info-window-details">
                    <div class="info-window-title">${locationName}</div>
                    <button onclick="showLocationDetails(null, '${locationName}', ${position.lat()}, ${position.lng()})" 
                            class="info-window-button">
                        <i class="fas fa-info-circle"></i>
                        View Details
                    </button>
                </div>
            </div>
        `
    });
}

function animateRoute(polyline) {
    const length = google.maps.geometry.spherical.computeLength(polyline.getPath());
    const numSteps = 100;
    let step = 0;

    const interval = setInterval(() => {
        step++;
        if (step > numSteps) {
            clearInterval(interval);
            return;
        }

        const icons = polyline.get('icons');
        icons[0].offset = (step / numSteps * 100) + '%';
        polyline.set('icons', icons);
    }, 50);

    polyline.set('icons', [{
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            strokeColor: '#393'
        },
        offset: '0%'
    }]);
}

async function showAllRoutes() {
    try {
        clearMap();
        currentDayIndex = -1;
        updateRouteStatus("Showing entire trip");

        currentBounds = new google.maps.LatLngBounds();
        const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFA500', '#800080'];

        tripData.forEach((day, index) => {
            const path = google.maps.geometry.encoding.decodePath(day.polyline);
            const polyline = new google.maps.Polyline({
                path: path,
                geodesic: true,
                strokeColor: colors[index % colors.length],
                strokeOpacity: 1.0,
                strokeWeight: 3,
                map: map
            });
            polylines.push(polyline);

            // Add markers for each day's start and end
            addMarker(path[0], day.origin, index === 0 ? 'origin' : 'waypoint');
            addMarker(path[path.length - 1], day.destination,
                index === tripData.length - 1 ? 'destination' : 'waypoint');

            path.forEach(p => currentBounds.extend(p));
        });

        map.fitBounds(currentBounds);
        
        // When showing all routes, use the start city of the trip for weather
        if (tripData && tripData.length > 0) {
            updateWeatherForDay(0); // Use the first day's location for weather
        }
    } catch (error) {
        console.error("Error showing all routes:", error);
        showError("Failed to show all routes");
    }
}

function clearMap() {
    polylines.forEach(p => p.setMap(null));
    polylines = [];
    markers.forEach(m => m.setMap(null));
    markers = [];
    infoWindows.forEach(iw => iw.close());
    infoWindows = [];
}

function updateRouteStatus(message) {
    const el = document.getElementById("route-status");
    if (el) el.textContent = message;
}

// Event listeners for modals
document.querySelectorAll('.modal .close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function () {
        this.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Error handling for Places API
function handlePlacesError(status) {
    switch (status) {
        case google.maps.places.PlacesServiceStatus.ZERO_RESULTS:
            console.log("No places found in this location");
            break;
        case google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT:
            showError("Too many requests. Please try again later.");
            break;
        case google.maps.places.PlacesServiceStatus.REQUEST_DENIED:
            showError("Places API request was denied");
            break;
        default:
            showError("Failed to load place details");
    }
}

// Weather Functions using OpenWeatherMap API
async function fetchWeatherData(city) {
    if (!city) {
        console.error("Cannot fetch weather: city name is missing");
        const weatherContent = document.getElementById("weather-content");
        weatherContent.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Unable to determine location for weather</p>
                <p class="weather-help-text">Try selecting a different day</p>
            </div>
        `;
        return;
    }

    try {
        console.log(`Loading weather forecast for ${city}`);
        
        // Clean up city name for OpenWeatherMap API
        // Remove any trailing periods, commas, or other non-alphanumeric characters
        let cleanCityName = city.trim().replace(/[^\w\s,-]/g, '');
        
        // For multi-word city names like "New York", ensure proper formatting
        cleanCityName = cleanCityName.replace(/\s+/g, ' ');
        
        // If the city already contains a state/country code (e.g., "New York, NY"), 
        // we'll keep it as is since OpenWeatherMap can handle this format
        
        console.log(`Using cleaned city name: ${cleanCityName}`);
        
        // Show loading state in the weather section only
        const weatherContent = document.getElementById("weather-content");
        weatherContent.innerHTML = `<div class="loading-placeholder">Loading weather for ${cleanCityName}...</div>`;
        
        // Get API key from config
        const apiKey = config.openWeatherMap.apiKey;
        
        // Fetch current weather
        const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(cleanCityName)}&units=metric&appid=${apiKey}`;
        console.log("Fetching weather with URL:", weatherUrl);
        
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
            // If specific city name fails, try different approaches
            if (response.status === 404) {
                // Try a different approach based on the format of the city name
                if (cleanCityName.includes(",")) {
                    // If it has a comma (like "New York, NY"), try just the first part
                    const mainCity = cleanCityName.split(",")[0].trim();
                    console.log(`City with state/country not found, trying just the city: ${mainCity}`);
                    return fetchWeatherData(mainCity);
                } else if (cleanCityName.includes(" ")) {
                    // If it's a multi-word city (like "New York"), try appending a country code
                    console.log(`City not found, trying with US country code`);
                    return fetchWeatherData(`${cleanCityName}, US`);
                } else if (!/^[a-zA-Z\s]+$/.test(cleanCityName)) {
                    // If the city contains non-alphabetic characters, try to further clean it
                    const alphabeticOnly = cleanCityName.replace(/[^a-zA-Z\s]/g, '');
                    console.log(`Trying with alphabetic characters only: ${alphabeticOnly}`);
                    return fetchWeatherData(alphabeticOnly);
                }
            }
            
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Weather data received:", data);
        
        // Store this successful city name for future reference
        localStorage.setItem('lastSuccessfulCityName', cleanCityName);
        
        // Display the weather data
        displayWeatherForecast(cleanCityName, data);
    } catch (error) {
        console.error("Error loading weather:", error);
        const weatherContent = document.getElementById("weather-content");
        
        // Try to get the last successful city name from storage
        const lastSuccessfulCity = localStorage.getItem('lastSuccessfulCityName');
        
        weatherContent.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load weather forecast</p>
                <p class="weather-help-text">${error.message}</p>
                <div class="weather-error-actions">
                <button onclick="fetchWeatherData('${city}')" class="btn-retry">
                    <i class="fas fa-redo"></i> Retry
                </button>
                    ${lastSuccessfulCity && lastSuccessfulCity !== city ? 
                      `<button onclick="fetchWeatherData('${lastSuccessfulCity}')" class="btn-alternate">
                          Try "${lastSuccessfulCity}" instead
                       </button>` : ''}
                    <button onclick="fetchWeatherData('New York')" class="btn-fallback">
                        <i class="fas fa-map-marker-alt"></i> Use New York
                    </button>
                </div>
            </div>
        `;
    }
}

function displayWeatherForecast(city, data) {
    const weatherContent = document.getElementById("weather-content");
    weatherContent.innerHTML = "";
    
    if (data && data.list && data.list.length > 0) {
        // Add city name as header with country name if available
        const cityHeader = document.createElement("div");
        cityHeader.className = "weather-city";
        
        // Extract city and country from API response
        const cityName = data.city ? data.city.name : city;
        const countryCode = data.city ? data.city.country : "";
        
        // Format location name with both city and country
        let locationText = cityName;
        if (countryCode) {
            locationText = `${cityName}, ${countryCode}`;
        }
        
        cityHeader.innerHTML = `<h4>${locationText}</h4>`;
        weatherContent.appendChild(cityHeader);
        
        // Group forecast by day (OpenWeatherMap returns 3-hour forecasts)
        const dailyForecasts = groupForecastsByDay(data.list);
        
        // Get the trip start date from tripDetails if available, otherwise use current date
        let tripStartDate;
        if (tripDetails && tripDetails.start_date) {
            // Parse start date properly (ensure it's in YYYY-MM-DD format to avoid time zone issues)
            let startDateStr = tripDetails.start_date;
            if (startDateStr.includes('T')) {
                // If ISO format with time, extract just the date part
                startDateStr = startDateStr.split('T')[0];
            }
            
            tripStartDate = new Date(startDateStr + 'T00:00:00');
            
            if (isNaN(tripStartDate.getTime())) {
                console.error(`Invalid trip start date: ${tripDetails.start_date}, using current date instead`);
                tripStartDate = new Date();
            }
        } else {
            tripStartDate = new Date();
        }
        
        // Calculate date for the selected day based on current day index
        const selectedDay = tripData[currentDayIndex >= 0 ? currentDayIndex : 0];
        const selectedDayNumber = selectedDay ? selectedDay.day_number : 1;
        
        // Calculate the date for the selected day by adding days to trip start date
        const selectedDate = new Date(tripStartDate);
        selectedDate.setDate(tripStartDate.getDate() + (selectedDayNumber - 1));
        
        console.log(`Weather date calculation:
          Trip start date: ${tripStartDate.toISOString()}
          Selected day number: ${selectedDayNumber}
          Date for forecast: ${selectedDate.toISOString()}`);
        
        // Format the date to match the forecast data
        const dateStr = formatDateForWeather(selectedDate);
        console.log(`Looking for weather data for date: ${dateStr}`);
        
        // Get the forecast for the selected day
        const forecast = dailyForecasts[dateStr];
        
        if (forecast) {
            // Create a more detailed weather display
            const weatherDay = document.createElement("div");
            weatherDay.className = "weather-day detailed";
            
            // Format the date
            const formattedDate = selectedDate.toLocaleDateString('en-US', { 
                weekday: 'long', 
                month: 'long', 
                day: 'numeric' 
            });
            
            weatherDay.innerHTML = `
                <div class="weather-main">
                    <div class="weather-icon">
                        <img src="https://openweathermap.org/img/wn/${forecast.icon}@2x.png" alt="${forecast.description}">
                    </div>
                    <div class="weather-temp-main">
                        <div class="temp-value">${Math.round(forecast.temp)}°C</div>
                        <div class="temp-feels">Feels like ${Math.round(forecast.feels_like)}°C</div>
                    </div>
                </div>
                <div class="weather-details">
                    <div class="weather-date">${formattedDate}</div>
                    <div class="weather-condition">${forecast.description}</div>
                    <div class="weather-stats">
                        <div class="stat-item">
                            <i class="fas fa-temperature-low"></i>
                            <span>Min: ${Math.round(forecast.tempMin)}°C</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-temperature-high"></i>
                            <span>Max: ${Math.round(forecast.tempMax)}°C</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-wind"></i>
                            <span>Wind: ${Math.round(forecast.wind_speed)} km/h</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-tint"></i>
                            <span>Humidity: ${forecast.humidity}%</span>
                        </div>
                    </div>
                </div>
            `;
            weatherContent.appendChild(weatherDay);
        } else {
            // If we don't have forecast for this date
            weatherContent.innerHTML = `
                <div class="weather-error">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>Weather forecast not available for ${locationText} on this date</p>
                    <p class="weather-help-text">Forecast date: ${dateStr}</p>
                </div>
            `;
        }
    } else {
        weatherContent.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Weather forecast not available for ${city}</p>
            </div>
        `;
    }
}

// Helper function to format date as YYYY-MM-DD for weather API
function formatDateForWeather(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to group 3-hour forecasts by day
function groupForecastsByDay(forecastList) {
    const dailyForecasts = {};
    
    forecastList.forEach(forecast => {
        // Get date string (YYYY-MM-DD) from timestamp
        const date = forecast.dt_txt.split(' ')[0];
        
        // If we haven't processed this day yet, initialize it
        if (!dailyForecasts[date]) {
            dailyForecasts[date] = {
                temp: forecast.main.temp,
                feels_like: forecast.main.feels_like,
                description: forecast.weather[0].description,
                icon: forecast.weather[0].icon,
                tempMin: forecast.main.temp_min,
                tempMax: forecast.main.temp_max,
                humidity: forecast.main.humidity,
                wind_speed: forecast.wind.speed
            };
        } else {
            // Update min/max temperature
            if (forecast.main.temp_max > dailyForecasts[date].tempMax) {
                dailyForecasts[date].tempMax = forecast.main.temp_max;
            }
            if (forecast.main.temp_min < dailyForecasts[date].tempMin) {
                dailyForecasts[date].tempMin = forecast.main.temp_min;
            }
            
            // Use noon forecast for the day's representative weather if available
            if (forecast.dt_txt.includes('12:00:00')) {
                dailyForecasts[date].temp = forecast.main.temp;
                dailyForecasts[date].feels_like = forecast.main.feels_like;
                dailyForecasts[date].description = forecast.weather[0].description;
                dailyForecasts[date].icon = forecast.weather[0].icon;
                dailyForecasts[date].humidity = forecast.main.humidity;
                dailyForecasts[date].wind_speed = forecast.wind.speed;
            }
        }
    });
    
    return dailyForecasts;
}

async function showLocationDetails(placeId, locationName, lat, lng) {
    try {
        showLoading("Loading location details...");

        let placeDetails;

        if (placeId) {
            // If we have a place_id, use it directly
            const detailsRequest = {
                placeId: placeId,
                fields: [
                    'name',
                    'formatted_address',
                    'formatted_phone_number',
                    'website',
                    'opening_hours',
                    'photos',
                    'rating',
                    'reviews',
                    'price_level',
                    'url'
                ]
            };

            placeDetails = await new Promise((resolve, reject) => {
                placesService.getDetails(detailsRequest, (result, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        resolve(result);
                    } else {
                        reject(new Error(`Failed to get place details: ${status}`));
                    }
                });
            });
        } else {
            // If we don't have a place_id, search by location name
            const request = {
                query: locationName,
                fields: ['place_id']
            };

            const searchResult = await new Promise((resolve, reject) => {
                placesService.findPlaceFromQuery(request, (results, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                        resolve(results[0]);
                    } else {
                        reject(new Error(`Could not find place: ${status}`));
                    }
                });
            });

            // Now get the details using the found place_id
            const detailsRequest = {
                placeId: searchResult.place_id,
                fields: [
                    'name',
                    'formatted_address',
                    'formatted_phone_number',
                    'website',
                    'opening_hours',
                    'photos',
                    'rating',
                    'reviews',
                    'price_level',
                    'url'
                ]
            };

            placeDetails = await new Promise((resolve, reject) => {
                placesService.getDetails(detailsRequest, (result, status) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        resolve(result);
                    } else {
                        reject(new Error(`Failed to get place details: ${status}`));
                    }
                });
            });
        }

        displayLocationDetails(placeDetails);
    } catch (error) {
        console.error("Error fetching location details:", error);
        showError("Failed to load location details");
    } finally {
        hideLoading();
    }
}

function displayLocationDetails(place) {
    const modal = document.getElementById('location-modal');

    // Debug place object
    console.log("Place details:", place);
    
    // Update header
    document.getElementById('location-name').textContent = place.name;

    // Update rating
    const ratingElement = document.getElementById('location-rating');
    if (place.rating) {
        ratingElement.innerHTML = `
            ${place.rating.toFixed(1)} 
            ${'<i class="fas fa-star"></i>'.repeat(Math.floor(place.rating))}
            ${place.rating % 1 >= 0.5 ? '<i class="fas fa-star-half-alt"></i>' : ''}
            (${place.user_ratings_total || 0} reviews)
        `;
    } else {
        ratingElement.innerHTML = 'No ratings available';
    }

    // Update address
    document.querySelector('#location-address span').textContent = place.formatted_address || 'Address not available';

    // Update phone
    const phoneElement = document.querySelector('#location-phone span');
    if (place.formatted_phone_number) {
        phoneElement.textContent = place.formatted_phone_number;
    } else {
        phoneElement.textContent = 'No phone number available';
    }

    // Update website
    const websiteElement = document.querySelector('#location-website a');
    if (place.website) {
        websiteElement.href = place.website;
        try {
        websiteElement.textContent = new URL(place.website).hostname;
        } catch (e) {
            websiteElement.textContent = place.website;
        }
    } else {
        websiteElement.href = '#';
        websiteElement.textContent = 'No website available';
    }

    // Update opening hours
    const hoursElement = document.querySelector('.hours-list');
    if (place.opening_hours && place.opening_hours.weekday_text) {
        hoursElement.innerHTML = place.opening_hours.weekday_text
            .map(text => `<div>${text}</div>`)
            .join('');
    } else {
        hoursElement.innerHTML = '<div>Opening hours not available</div>';
    }

    // Update photos
    const photosElement = document.getElementById('location-photos-gallery');
    if (place.photos && place.photos.length > 0) {
        photosElement.innerHTML = place.photos
            .slice(0, 6) // Show up to 6 photos
            .map(photo => {
                // Use the getUrl() method provided by Google Maps API
                const photoUrl = photo.getUrl({ maxWidth: 400, maxHeight: 300 });
                return `<img src="${photoUrl}" alt="${place.name}">`;
            })
            .join('');
    } else {
        photosElement.innerHTML = '<p>No photos available</p>';
    }

    // Update reviews
    const reviewsElement = document.getElementById('location-reviews-list');
    if (place.reviews && place.reviews.length > 0) {
        reviewsElement.innerHTML = place.reviews
            .slice(0, 5) // Show up to 5 reviews
            .map(review => `
                <div class="review-item">
                    <div class="review-header">
                        <div class="review-author">
                            <img src="${review.profile_photo_url || 'https://via.placeholder.com/40'}" 
                                 alt="${review.author_name}">
                            <span>${review.author_name}</span>
                        </div>
                        <div class="review-time">${review.relative_time_description}</div>
                    </div>
                    <div class="review-text">${review.text}</div>
                </div>
            `)
            .join('');
    } else {
        reviewsElement.innerHTML = '<p>No reviews available</p>';
    }

    // Show the modal
    modal.style.display = 'block';
}

// Helper function to extract city name from address
function extractCityFromAddress(address) {
    if (!address) return null;
    
    console.log(`Extracting city from: ${address}`);
    
    // If the address already contains a properly formatted city name, use that
    if (address.includes(',')) {
        const parts = address.split(',').map(part => part.trim());
        
        // Check for formats like "New York, NY" -> extract "New York"
        if (parts.length === 2 && parts[1].match(/^\s*[A-Z]{2}\s*$/)) {
            console.log(`Found "City, State" format - extracting: ${parts[0]}`);
            return parts[0]; // Just the city name
        }
    }
    
    // Use Google Places API to get better location data
    if (placesService) {
        // Use geocode service to get proper address components
        const geocoder = new google.maps.Geocoder();
        
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === google.maps.GeocoderStatus.OK && results && results.length > 0) {
                // Log the full results for debugging
                console.log("Geocoder results:", results[0]);
                
                // Get the address components
                const addressComponents = results[0].address_components;
                let cityName = null;
                
                // First try to find the locality (city) component
                for (const component of addressComponents) {
                    if (component.types.includes('locality')) {
                        // This is the city/town component
                        cityName = component.long_name;
                        console.log(`Google Geocoder found city (locality): ${cityName}`);
                        
                        // We found a proper city, use it immediately
                        fetchWeatherData(cityName);
                        return;
                    }
                }
                
                // If no locality found, try sublocality or administrative_area_level_2 (county)
                for (const component of addressComponents) {
                    if (component.types.includes('sublocality') || 
                        component.types.includes('sublocality_level_1')) {
                        cityName = component.long_name;
                        console.log(`Google Geocoder found sublocality: ${cityName}`);
                        fetchWeatherData(cityName);
                        return;
                    } else if (component.types.includes('administrative_area_level_2') && !cityName) {
                        // This is usually a county in the US
                        cityName = component.long_name;
                        console.log(`Google Geocoder found county: ${cityName}`);
                        // Don't return yet, keep looking for better matches
                    }
                }
                
                // If we still don't have a city, use administrative_area_level_1 (state/province)
                for (const component of addressComponents) {
                    if (component.types.includes('administrative_area_level_1')) {
                        cityName = component.long_name;
                        console.log(`Google Geocoder found state/province: ${cityName}`);
                        fetchWeatherData(cityName);
                        return;
                    }
                }
                
                // If we got this far but found a county earlier, use that
                if (cityName) {
                    console.log(`Using county name from Geocoder: ${cityName}`);
                    fetchWeatherData(cityName);
                    return;
                }
                
                // If no city components found but we have formatted address, extract from that
                const formattedAddress = results[0].formatted_address;
                if (formattedAddress) {
                    console.log(`Using formatted address: ${formattedAddress}`);
                    const addressParts = formattedAddress.split(',').map(part => part.trim());
                    
                    // Try to find a suitable part - not the first (usually street) or last (usually country)
                    if (addressParts.length >= 3) {
                        // Use second part as it's often the city
                        const potentialCity = addressParts[1];
                        console.log(`Extracted city from formatted address: ${potentialCity}`);
                        fetchWeatherData(potentialCity);
                        return;
                    } else if (addressParts.length === 2) {
                        // For 2-part addresses, use the first part unless it looks like a street address
                        const firstPart = addressParts[0];
                        if (!firstPart.match(/^\d+/) && !firstPart.includes("Street") && !firstPart.includes("Avenue")) {
                            console.log(`Using first part of address: ${firstPart}`);
                            fetchWeatherData(firstPart);
                            return;
                        }
                    }
                }
            }
            
            console.log(`Google Geocoder could not find city, trying Places API`);
            
            // Fallback to Places API
            const request = {
                query: address,
                fields: ['name', 'formatted_address']
            };
            
            placesService.findPlaceFromQuery(request, (placeResults, placeStatus) => {
                if (placeStatus === google.maps.places.PlacesServiceStatus.OK && placeResults && placeResults.length > 0) {
                    const formattedAddress = placeResults[0].formatted_address;
                    console.log(`Google Places API returned: ${formattedAddress}`);
                    
                    // Try to extract the city from the formatted address
                    if (formattedAddress && formattedAddress.includes(',')) {
                        const parts = formattedAddress.split(',').map(part => part.trim());
                        
                        // Look for the city part - it's usually the second-to-last part in US addresses
                        // like "New York, NY, USA" -> extract "New York"
                        if (parts.length >= 3) {
                            // Try the second part first (common city position)
                            let cityPart = parts[parts.length - 2].replace(/\b[A-Z]{2}\b/g, '').trim();
                            
                            // If that looks like a state code or ZIP, try the part before it
                            if (!cityPart || cityPart.length <= 2 || /^\d+$/.test(cityPart)) {
                                cityPart = parts[parts.length - 3].trim();
                            }
                            
                            if (cityPart && cityPart !== "USA") {
                                console.log(`Extracted city from Places API: ${cityPart}`);
                                fetchWeatherData(cityPart);
                                return;
                            }
                        }
                    }
                    
                    // If we couldn't extract from the address, use the place name as a last resort
                    const placeName = placeResults[0].name;
                    if (placeName && placeName.split(' ').length <= 3) {
                        console.log(`Using place name as city: ${placeName}`);
                        fetchWeatherData(placeName);
                        return;
                    }
                }
                
                // If all Google APIs failed, use trip context
                const fallbackCity = getFallbackCity();
                console.log(`Using fallback city: ${fallbackCity}`);
                fetchWeatherData(fallbackCity);
            });
        });
        
        // Return null since we're handling this asynchronously
        return null;
    }
    
    // If Google Maps API is not available, use fallback
    return getFallbackCity();
}