let map;
let polylines = [];
let tripData = [];
let markers = [];
let infoWindows = [];
let currentDayIndex = -1;
let placesService;

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

        // Start loading data immediately
        loadTripData(tripId);
    } catch (error) {
        console.error("Error in initialization:", error);
        showError("Failed to initialize the app. Please refresh the page.");
    }
}

// This function will be called by the Google Maps API when it's loaded
async function initMap() {
    console.log('Initializing map...');
    try {
        // Initialize Google Maps with default styles
        map = new google.maps.Map(document.getElementById("map"), {
            zoom: 12,
            center: { lat: 40.7128, lng: -74.0060 }, // Default to New York
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Initialize Places service
        placesService = new google.maps.places.PlacesService(map);

        // Start loading trip data
        const tripId = getTripIdFromURL();
        if (!tripId) {
            showError("Trip ID is missing in URL");
            return;
        }

        // Load and render trip data
        await loadTripData(tripId);
    } catch (error) {
        console.error("Error initializing map:", error);
        showError("Failed to initialize the map. Please refresh the page.");
    }
}

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
    showLoading("Loading trip data...");
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

        tripData = parsed;
        console.log('Parsed trip data:', tripData);
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
        addMarker(path[0], day.origin, 'origin');
        addMarker(path[path.length - 1], day.destination, 'destination');

        // Add intermediate points
        const numPoints = path.length;
        const step = Math.max(1, Math.floor(numPoints / 5));
        for (let i = step; i < numPoints - step; i += step) {
            addMarker(path[i], 'Stop', 'waypoint');
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

function addMarker(position, title, type) {
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
        title: title,
        icon: icon,
        animation: google.maps.Animation.DROP
    });

    const infoWindow = new google.maps.InfoWindow({
        content: `<div class="info-window-content"><strong>${title}</strong></div>`
    });

    marker.addListener('click', () => {
        infoWindows.forEach(iw => iw.close());
        infoWindow.open(map, marker);
    });

    markers.push(marker);
    infoWindows.push(infoWindow);
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
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Error handling for Places API
function handlePlacesError(status) {
    switch(status) {
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