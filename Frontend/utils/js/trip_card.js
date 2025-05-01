let map;
let polylines = [];
let tripData = [];

document.addEventListener("DOMContentLoaded", async () => {
    // Initialize Google Maps
    map = new google.maps.Map(document.getElementById("map"), {});

    const tripId = getTripIdFromURL();
    if (!tripId) {
        alert("Trip ID is missing in URL");
        return;
    }

    try {
        const response = await fetch(`https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/routing?trip_id=${tripId}`, {
            method: "GET"
        });
        const data = await response.json();
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
    } catch (error) {
        console.error("Error loading trip data:", error);
        alert("Failed to load trip route.");
    }
});

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
    updateRouteStatus(`Showing Day ${tripData[index].day_number}`);
    const day = tripData[index];
    const path = google.maps.geometry.encoding.decodePath(day.polyline);

    const polyline = new google.maps.Polyline({
        path,
        strokeColor: "#ff6600",
        strokeOpacity: 1.0,
        strokeWeight: 4,
        map
    });

    polylines.push(polyline);

    const bounds = new google.maps.LatLngBounds();
    path.forEach(p => bounds.extend(p));
    map.fitBounds(bounds);
}

function showAllRoutes() {
    clearMap();
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
}

function updateRouteStatus(message) {
    const el = document.getElementById("route-status");
    if (el) el.textContent = message;
}