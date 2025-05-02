let map;
let polylines = [];
let tripData = [];
let markers = [];
let infoWindows = [];
let currentDayIndex = -1;
let placesService;
let pendingTripId = null; // Store the trip ID until Google Maps is ready
let currentBounds = null; // Store the current map bounds for resizing

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
    
    document.getElementById("trip-title").textContent = tripTitle;
    document.getElementById("trip-dates").innerHTML = `<i class="fas fa-calendar"></i> ${formatDate(new Date())}`;
    document.getElementById("trip-duration").innerHTML = `<i class="fas fa-clock"></i> ${tripData.length} days`;
    document.getElementById("trip-status").innerHTML = `<i class="fas fa-info-circle"></i> Active`;
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
    if (!tripData || dayIndex < 0 || dayIndex >= tripData.length) return;
    
    const day = tripData[dayIndex];
    const cityName = extractCityFromAddress(day.destination);
    
    if (cityName) {
        console.log(`Loading weather for day ${dayIndex + 1} (${cityName})`);
        fetchWeatherData(cityName);
    }
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
    try {
        console.log(`Loading weather forecast for ${city}`);
        
        // Show loading state
        const weatherContent = document.getElementById("weather-content");
        weatherContent.innerHTML = `<div class="loading-placeholder">Loading weather for ${city}...</div>`;
        
        // Get API key from config
        const apiKey = config.openWeatherMap.apiKey;
        
        // Fetch current weather
        const weatherUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)}&units=metric&appid=${apiKey}`;
        console.log("Fetching weather with URL:", weatherUrl);
        
        const response = await fetch(weatherUrl);
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Weather data received:", data);
        
        // Display the weather data
        displayWeatherForecast(city, data);
    } catch (error) {
        console.error("Error loading weather:", error);
        const weatherContent = document.getElementById("weather-content");
        weatherContent.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load weather forecast</p>
                <p class="weather-help-text">${error.message}</p>
                <button onclick="fetchWeatherData('${city}')" class="btn-retry">
                    <i class="fas fa-redo"></i> Retry
                </button>
            </div>
        `;
    }
}

function displayWeatherForecast(city, data) {
    const weatherContent = document.getElementById("weather-content");
    weatherContent.innerHTML = "";
    
    if (data && data.list && data.list.length > 0) {
        // Add city name as header
        const cityHeader = document.createElement("div");
        cityHeader.className = "weather-city";
        cityHeader.innerHTML = `<h4>${city}</h4>`;
        weatherContent.appendChild(cityHeader);
        
        // Group forecast by day (OpenWeatherMap returns 3-hour forecasts)
        const dailyForecasts = groupForecastsByDay(data.list);
        
        // Get the current date (trip start date, which we can later adjust based on day number)
        const tripStartDate = new Date(); // We use the current date as a base
        
        // Calculate date for the selected day based on current day index
        const selectedDay = tripData[currentDayIndex >= 0 ? currentDayIndex : 0];
        const selectedDayNumber = selectedDay ? selectedDay.day_number : 1;
        
        // Calculate the date for the selected day (add day number - 1 days to start date)
        const selectedDate = new Date(tripStartDate);
        selectedDate.setDate(tripStartDate.getDate() + (selectedDayNumber - 1));
        
        // Calculate dates for 3-day range: day before, selected day, day after
        const dayBefore = new Date(selectedDate);
        dayBefore.setDate(selectedDate.getDate() - 1);
        
        const dayAfter = new Date(selectedDate);
        dayAfter.setDate(selectedDate.getDate() + 1);
        
        // Format these dates to match the format in the forecast data (YYYY-MM-DD)
        const dateStrings = [
            formatDateForWeather(dayBefore),
            formatDateForWeather(selectedDate),
            formatDateForWeather(dayAfter)
        ];
        
        console.log("Showing weather for dates:", dateStrings);
        
        // Display each of the three days
        dateStrings.forEach(dateStr => {
            const forecast = dailyForecasts[dateStr];
            if (forecast) {
                createWeatherDayElement(dateStr, forecast, weatherContent);
            } else {
                // If we don't have forecast for this date
                createEmptyWeatherDay(dateStr, weatherContent);
            }
        });
    } else {
        weatherContent.innerHTML = `
            <div class="weather-error">
                <i class="fas fa-exclamation-circle"></i>
                <p>Weather forecast not available for ${city}</p>
            </div>
        `;
    }
}

// Helper function to create a weather day element
function createWeatherDayElement(dateStr, forecast, container) {
    const weatherDay = document.createElement("div");
    weatherDay.className = "weather-day";
    
    // Format the date
    const dateObj = new Date(dateStr);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    // Determine if this is the "today" day
    const isSelectedDay = tripData[currentDayIndex >= 0 ? currentDayIndex : 0].day_number === 
        (new Date() - new Date(tripData[0].day_number-1)) / (1000 * 60 * 60 * 24) + 1;
    
    weatherDay.innerHTML = `
        <div class="weather-icon">
            <img src="https://openweathermap.org/img/wn/${forecast.icon}@2x.png" alt="${forecast.description}">
        </div>
        <div class="weather-details">
            <div class="weather-date">
                ${formattedDate}
                ${isSelectedDay ? '<span class="today-badge">TODAY</span>' : ''}
            </div>
            <div class="weather-temp">${Math.round(forecast.temp)}°C</div>
            <div class="weather-condition">${forecast.description}</div>
        </div>
    `;
    container.appendChild(weatherDay);
}

// Helper function to create an empty weather day element
function createEmptyWeatherDay(dateStr, container) {
    const weatherDay = document.createElement("div");
    weatherDay.className = "weather-day weather-day-empty";
    
    // Format the date
    const dateObj = new Date(dateStr);
    const formattedDate = dateObj.toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
    });
    
    weatherDay.innerHTML = `
        <div class="weather-icon">
            <i class="fas fa-question-circle"></i>
        </div>
        <div class="weather-details">
            <div class="weather-date">${formattedDate}</div>
            <div class="weather-temp">--°C</div>
            <div class="weather-condition">No data available</div>
        </div>
    `;
    container.appendChild(weatherDay);
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
                description: forecast.weather[0].description,
                icon: forecast.weather[0].icon,
                tempMin: forecast.main.temp_min,
                tempMax: forecast.main.temp_max
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
                dailyForecasts[date].description = forecast.weather[0].description;
                dailyForecasts[date].icon = forecast.weather[0].icon;
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
        hideLoading();
    } catch (error) {
        console.error("Error fetching location details:", error);
        showError("Failed to load location details");
        hideLoading();
    }
}

function displayLocationDetails(place) {
    const modal = document.getElementById('location-modal');

    // Debug place object
    console.log("Place details:", place);
    console.log("Photos available:", place.photos);
    
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
    document.querySelector('#location-address span').textContent = place.formatted_address;

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
        websiteElement.textContent = new URL(place.website).hostname;
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
        console.log("First photo object:", place.photos[0]);
        // Use getUrl method for photos instead of constructing URL with photo_reference
        photosElement.innerHTML = place.photos
            .slice(0, 6) // Show up to 6 photos
            .map(photo => {
                // Use the getUrl() method provided by Google Maps API
                const photoUrl = photo.getUrl({ maxWidth: 400, maxHeight: 300 });
                console.log("Generated photo URL:", photoUrl);
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
    if (!address) return "New York"; // Default fallback
    
    console.log(`Extracting city from: ${address}`);
    
    // If the address has no commas, it might be a landmark or attraction name
    // In this case, we need to determine the city based on context
    if (!address.includes(',')) {
        // For testing purpose, we'll use the most common city that appears in the trip data
        return findMostCommonCityInTrip() || "New York";
    }
    
    // Split by commas and clean the parts
    const parts = address.split(',').map(part => part.trim());
    
    // For addresses with format: "Street, City, State ZIP"
    if (parts.length >= 2) {
        // Check common US patterns
        // If second part contains 2-letter state code (e.g., NY, CA)
        const stateCodeMatch = parts[1].match(/\b([A-Z]{2})\b/);
        if (stateCodeMatch) {
            const stateCode = stateCodeMatch[1];
            
            // For New York
            if (stateCode === "NY") {
                return "New York";
            }
            
            // For other states, use the first part (which should be the city)
            // But check if first part looks like a street address (has numbers)
            if (!parts[0].match(/\d+/)) {
                return parts[0]; // Likely the city name
            }
        }
        
        // For "Landmark, City, State" format, the city is in the second part
        if (parts.length >= 3 && !parts[1].match(/\d+/)) {
            return parts[1];
        }
        
        // For "City, State" format, the city is in the first part
        if (parts.length === 2 && !parts[0].match(/\d+/)) {
            return parts[0];
        }
    }
    
    // If we can't determine the city, check context from other trip locations
    const contextCity = findMostCommonCityInTrip();
    if (contextCity) {
        return contextCity;
    }
    
    // Last resort: clean the address and return something usable
    return address.replace(/\d+/g, '').replace(/,/g, ' ').trim() || "New York";
}

// Helper function to find the most common city in the trip
function findMostCommonCityInTrip() {
    if (!tripData || tripData.length === 0) return null;
    
    // Collect all addresses
    const addresses = [];
    
    tripData.forEach(day => {
        if (day.origin && day.origin.includes(',')) addresses.push(day.origin);
        if (day.destination && day.destination.includes(',')) addresses.push(day.destination);
        if (day.waypoints) {
            day.waypoints.forEach(waypoint => {
                if (waypoint && waypoint.includes(',')) addresses.push(waypoint);
            });
        }
    });
    
    // No useful addresses found
    if (addresses.length === 0) return null;
    
    // Extract potential city names (second part after comma)
    const potentialCities = [];
    addresses.forEach(address => {
        const parts = address.split(',');
        if (parts.length >= 2) {
            // Try to extract city from second part
            const cityPart = parts[1].trim();
            // Clean up state codes and zip codes
            const cleanCity = cityPart.replace(/\b[A-Z]{2}\b|\d+/g, '').trim();
            if (cleanCity) potentialCities.push(cleanCity);
        }
    });
    
    // Count occurrences of each city
    const cityCounts = {};
    potentialCities.forEach(city => {
        cityCounts[city] = (cityCounts[city] || 0) + 1;
    });
    
    // Find the most common city
    let mostCommonCity = null;
    let highestCount = 0;
    
    for (const city in cityCounts) {
        if (cityCounts[city] > highestCount) {
            mostCommonCity = city;
            highestCount = cityCounts[city];
        }
    }
    
    return mostCommonCity;
}