let map;
let polylines = [];
let tripData = [];
let markers = [];
let infoWindows = [];
let currentDayIndex = -1;
let placesService;
let pendingTripId = null; // Store the trip ID until Google Maps is ready

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
}

function updateTripSummary(firstDay) {
    document.getElementById("trip-title").textContent = `Trip to ${firstDay.destination}`;
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
        const bounds = new google.maps.LatLngBounds();
        path.forEach(p => bounds.extend(p));
        map.fitBounds(bounds);

        // Animate the route
        animateRoute(polyline);
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

        const bounds = new google.maps.LatLngBounds();
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

            path.forEach(p => bounds.extend(p));
        });

        map.fitBounds(bounds);
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

// Weather Functions
async function loadWeatherForecast(city) {
    try {
        const response = await fetch(`https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/weather?city=${encodeURIComponent(city)}`);
        const data = await response.json();

        const weatherContent = document.getElementById("weather-content");
        weatherContent.innerHTML = "";

        if (data.forecast) {
            data.forecast.forEach(day => {
                const weatherDay = document.createElement("div");
                weatherDay.className = "weather-day";
                weatherDay.innerHTML = `
                    <div class="weather-icon">
                        <i class="fas fa-${getWeatherIcon(day.condition)}"></i>
                    </div>
                    <div class="weather-details">
                        <div>${day.date}</div>
                        <div>${day.temperature}°C</div>
                        <div>${day.condition}</div>
                    </div>
                `;
                weatherContent.appendChild(weatherDay);
            });
        }
    } catch (error) {
        console.error("Error loading weather:", error);
    }
}

function getWeatherIcon(condition) {
    const icons = {
        "Sunny": "sun",
        "Cloudy": "cloud",
        "Rainy": "cloud-rain",
        "Snowy": "snowflake",
        "Thunderstorm": "bolt",
        "Foggy": "smog"
    };
    return icons[condition] || "cloud";
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
        photosElement.innerHTML = place.photos
            .slice(0, 6) // Show up to 6 photos
            .map(photo => `
                <img src="https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photo.photo_reference}&key=${config.googleMaps.apiKey}" 
                     alt="${place.name}">
            `)
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