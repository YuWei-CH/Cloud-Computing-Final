let map;
let polylines = [];
let tripData = [];
let markers = [];
let infoWindows = [];
let currentDayIndex = -1;
let placesService;

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Google Maps
    map = new google.maps.Map(document.getElementById("map"), {
        zoom: 8,
        center: { lat: 0, lng: 0 },
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

    const tripId = getTripIdFromURL();
    if (!tripId) {
        alert("Trip ID is missing in URL");
        return;
    }

    try {
        // Load trip details
        const tripResponse = await fetch(`https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`, {
            method: "GET"
        });
        const tripDetails = await tripResponse.json();
        updateTripSummary(tripDetails);

        // Load route data
        const routeResponse = await fetch(`https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/routing?trip_id=${tripId}`, {
            method: "GET"
        });
        const data = await routeResponse.json();
        console.log("[DEBUG] Lambda returned:", data);

        let parsed;
        if (data.statusCode && data.body) {
            parsed = JSON.parse(data.body).results;
        } else if (data.results) {
            parsed = data.results;
        } else {
            throw new Error("Invalid response structure from routing Lambda");
        }

        tripData = parsed;
        renderDayButtons();
        showAllRoutes();
        loadWeatherForecast(tripDetails.start_city);
    } catch (error) {
        console.error("Error loading trip data:", error);
        alert("Failed to load trip route.");
    }
});

function updateTripSummary(tripDetails) {
    document.getElementById("trip-title").textContent = `Trip to ${tripDetails.start_city}`;
    document.getElementById("trip-dates").innerHTML = `<i class="fas fa-calendar"></i> ${tripDetails.start_date}`;
    document.getElementById("trip-duration").innerHTML = `<i class="fas fa-clock"></i> ${tripDetails.duration} days`;
    document.getElementById("trip-status").innerHTML = `<i class="fas fa-info-circle"></i> ${tripDetails.status}`;
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
            <small>Origin: ${day.origin}</small><br/>
            <small>Destination: ${day.destination}</small>
        `;
        btn.onclick = () => showSingleRoute(idx);
        container.appendChild(btn);
    });
}

function showSingleRoute(index) {
    clearMap();
    currentDayIndex = index;
    updateRouteStatus(`Showing Day ${tripData[index].day_number}`);
    const day = tripData[index];
    const path = google.maps.geometry.encoding.decodePath(day.polyline);

    // Create gradient polyline
    createGradientPolyline(path);

    // Add markers for origin and destination with enhanced info
    addLocationMarkerWithPlaces(path[0], day.origin, "origin");
    addLocationMarkerWithPlaces(path[path.length - 1], day.destination, "destination");

    // Add markers for intermediate points
    const numPoints = path.length;
    const step = Math.max(1, Math.floor(numPoints / 10)); // Show up to 10 intermediate points
    
    for (let i = step; i < numPoints - step; i += step) {
        const point = path[i];
        searchNearbyPlaces(point);
    }

    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds);
}

function createGradientPolyline(path) {
    // Create multiple segments for gradient effect
    const numSegments = path.length - 1;
    const gradientColors = generateGradientColors("#4CAF50", "#FF5722", numSegments);

    for (let i = 0; i < numSegments; i++) {
        const segment = new google.maps.Polyline({
            path: [path[i], path[i + 1]],
            strokeColor: gradientColors[i],
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: map,
            geodesic: true,
            icons: [{
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    fillColor: gradientColors[i],
                    fillOpacity: 1,
                    scale: 2,
                    strokeColor: gradientColors[i],
                    strokeWeight: 1
                },
                repeat: '50px'
            }]
        });
        polylines.push(segment);
    }
}

function generateGradientColors(startColor, endColor, steps) {
    const start = hexToRgb(startColor);
    const end = hexToRgb(endColor);
    const colors = [];

    for (let i = 0; i < steps; i++) {
        const r = Math.round(start.r + (end.r - start.r) * (i / (steps - 1)));
        const g = Math.round(start.g + (end.g - start.g) * (i / (steps - 1)));
        const b = Math.round(start.b + (end.b - start.b) * (i / (steps - 1)));
        colors.push(rgbToHex(r, g, b));
    }

    return colors;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

async function addLocationMarkerWithPlaces(position, locationName, type) {
    const request = {
        query: locationName,
        location: position,
        radius: 1000,
        fields: ['name', 'geometry', 'photos', 'formatted_address', 'rating', 'user_ratings_total', 'opening_hours']
    };

    try {
        const results = await new Promise((resolve, reject) => {
            placesService.findPlaceFromQuery(request, (results, status) => {
                if (status === google.maps.places.PlacesServiceStatus.OK) {
                    resolve(results);
                } else {
                    reject(status);
                }
            });
        });

        if (results && results.length > 0) {
            const place = results[0];
            const photos = place.photos ? place.photos.map(photo => photo.getUrl()) : [];
            
            const icon = {
                url: getMarkerIcon(type),
                scaledSize: new google.maps.Size(32, 32),
                origin: new google.maps.Point(0, 0),
                anchor: new google.maps.Point(16, 32)
            };

            const marker = new google.maps.Marker({
                position: place.geometry.location,
                map: map,
                title: place.name,
                icon: icon,
                animation: google.maps.Animation.DROP
            });

            const content = createEnhancedInfoWindowContent(place, photos);
            const infoWindow = new google.maps.InfoWindow({ content });

            marker.addListener("click", () => {
                infoWindows.forEach(iw => iw.close());
                infoWindow.open(map, marker);
            });

            markers.push(marker);
            infoWindows.push(infoWindow);
        }
    } catch (error) {
        console.error("Error fetching place details:", error);
        // Fallback to basic marker
        addLocationMarker(position, locationName, type);
    }
}

function searchNearbyPlaces(location) {
    const request = {
        location: location,
        radius: 1000,
        type: ['point_of_interest']
    };

    placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
            // Take the most relevant result
            const place = results[0];
            if (place) {
                const photos = place.photos ? place.photos.map(photo => photo.getUrl()) : [];
                addLocationMarkerWithDetails(place, photos);
            }
        }
    });
}

function addLocationMarkerWithDetails(place, photos) {
    const icon = {
        url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
        scaledSize: new google.maps.Size(32, 32),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(16, 32)
    };

    const marker = new google.maps.Marker({
        position: place.geometry.location,
        map: map,
        title: place.name,
        icon: icon,
        animation: google.maps.Animation.DROP
    });

    const content = createEnhancedInfoWindowContent(place, photos);
    const infoWindow = new google.maps.InfoWindow({ content });

    marker.addListener("click", () => {
        infoWindows.forEach(iw => iw.close());
        infoWindow.open(map, marker);
    });

    markers.push(marker);
    infoWindows.push(infoWindow);
}

function createEnhancedInfoWindowContent(place, photos) {
    let content = `
        <div class="info-window-content">
            <div class="info-window-title">${place.name}</div>
    `;

    if (place.rating) {
        content += `
            <div class="info-window-rating">
                Rating: ${place.rating} ⭐ (${place.user_ratings_total} reviews)
            </div>
        `;
    }

    if (place.formatted_address) {
        content += `
            <div class="info-window-address">
                <i class="fas fa-map-marker-alt"></i> ${place.formatted_address}
            </div>
        `;
    }

    if (place.opening_hours) {
        content += `
            <div class="info-window-hours">
                <i class="fas fa-clock"></i> ${place.opening_hours.isOpen() ? 'Open Now' : 'Closed'}
            </div>
        `;
    }

    if (photos && photos.length > 0) {
        content += `<div class="info-window-photos">`;
        photos.slice(0, 3).forEach(photo => {
            content += `
                <img src="${photo}" class="info-window-photo" 
                    onclick="showPhotoGallery('${place.name}', '${JSON.stringify(photos)}')"
                    alt="${place.name}">
            `;
        });
        content += `</div>`;
    }

    content += `</div>`;
    return content;
}

function getMarkerIcon(type) {
    const icons = {
        origin: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
        destination: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
        poi: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png"
    };
    return icons[type] || "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
}

function showAllRoutes() {
    clearMap();
    currentDayIndex = -1;
    updateRouteStatus("Showing entire trip");
    const colors = ["#FF5733", "#33A1FF", "#33FF6E", "#FFD133", "#B833FF"];
    const bounds = new google.maps.LatLngBounds();

    tripData.forEach((day, i) => {
        const path = google.maps.geometry.encoding.decodePath(day.polyline);
        const polyline = new google.maps.Polyline({
            path,
            strokeColor: colors[i % colors.length],
            strokeOpacity: 0.8,
            strokeWeight: 3,
            map
        });
        polylines.push(polyline);
        path.forEach(p => bounds.extend(p));
    });

    if (tripData.length > 0) {
        map.fitBounds(bounds);
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

// Photo Gallery Functions
function showPhotoGallery(title, photosJson) {
    const photos = JSON.parse(photosJson);
    const modal = document.getElementById("photo-modal");
    const gallery = document.getElementById("photo-gallery");
    
    gallery.innerHTML = `
        <h3>${title}</h3>
        <div class="photo-grid">
            ${photos.map(photo => `
                <div class="photo-item">
                    <img src="${photo}" alt="${title}">
                </div>
            `).join("")}
        </div>
    `;
    
    modal.style.display = "block";
}

// Close modal when clicking the close button
document.querySelector(".close").addEventListener("click", () => {
    document.getElementById("photo-modal").style.display = "none";
});

// Close modal when clicking outside
window.addEventListener("click", (event) => {
    const modal = document.getElementById("photo-modal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
});

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