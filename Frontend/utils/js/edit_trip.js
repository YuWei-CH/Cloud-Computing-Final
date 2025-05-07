let tripData = null;
let currentDay = 0; // Track which day is currently being edited
let allDaysData = []; // Store data for all days
let placesService = null;

document.addEventListener('DOMContentLoaded', function () {
    // Check for trip_id in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tripId = urlParams.get('trip_id');

    if (!tripId) {
        showError("No trip ID provided. Please select a trip from your dashboard.");
        return;
    }

    // Check authentication immediately
    const email = checkAuthentication();
    if (!email) {
        showError("You must be logged in to edit trips.");
        // Redirect to login after 2 seconds
        setTimeout(() => {
            window.location.href = '../login/login.html';
        }, 2000);
        return;
    }

    // Initialize the page once Google Maps is loaded
    if (typeof google !== 'undefined' && google.maps) {
        initializePlacesService();
        loadTripData(tripId);
    } else {
        // If Google Maps isn't loaded yet, wait for it
        window.initializeApp = function () {
            initializePlacesService();
            loadTripData(tripId);
        };
    }

    // Set up form submission handler
    document.getElementById('trip-details-form').addEventListener('submit', function (e) {
        e.preventDefault();
        saveTripChanges();
    });

    // Set up the save button
    const saveBtn = document.getElementById('save-trip-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function (e) {
            e.preventDefault();
            saveTripChanges();
        });
    }

    // Set up custom activity addition
    const addCustomBtn = document.getElementById('add-custom-destination');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', function () {
            addCustomActivity();
        });
    }
});

// Authentication check function
function checkAuthentication() {
    // Check localStorage first (for remembered users)
    let email = localStorage.getItem('userEmail');

    // If not in localStorage, check sessionStorage
    if (!email) {
        email = sessionStorage.getItem('userEmail');
    }

    if (!email) {
        // No email found, redirect to login
        console.log("No authentication email found");
        return null;
    }

    return email;
}

function initializePlacesService() {
    // Initialize Google Places service if needed
    placesService = new google.maps.places.PlacesService(
        document.createElement('div') // Dummy element for PlacesService
    );
}

// Helper to generate a temporary ID for new activities
function generateTempId() {
    return 'new-' + Math.random().toString(36).substr(2, 9);
}

// When loading trip data, also load activity IDs if present
async function loadTripData(tripId) {
    try {
        showLoading("Loading trip data...");

        // Get user email for authentication - IMPORTANT
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        if (!email) {
            throw new Error("User not logged in. Please login again to continue.");
        }

        // Fetch trip details - INCLUDE EMAIL HEADER
        const detailsUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`;
        console.log("Fetching trip details from:", detailsUrl);
        console.log("Using authentication email:", email);

        const detailsResponse = await fetch(detailsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email  // Include email header for authentication
            }
        });

        if (!detailsResponse.ok) {
            if (detailsResponse.status === 401) {
                throw new Error("Authentication failed. Please login again.");
            }
            throw new Error(`Failed to load trip details: ${detailsResponse.status}`);
        }

        const detailsData = await detailsResponse.json();
        console.log("Trip details:", detailsData);

        // Extract trip details from the response
        let tripDetails = null;
        if (detailsData.statusCode && detailsData.body) {
            // API Gateway Lambda proxy format
            const bodyContent = typeof detailsData.body === 'string'
                ? JSON.parse(detailsData.body)
                : detailsData.body;
            tripDetails = bodyContent.trip || bodyContent;
        } else {
            // Direct response format
            tripDetails = detailsData.trip || detailsData;
        }

        if (!tripDetails) {
            throw new Error("Invalid trip data received");
        }

        // Ensure we have a title - create default if missing
        if (!tripDetails.title) {
            tripDetails.title = `Trip to ${tripDetails.start_city || 'Unknown Location'}`;
        }

        // Store trip data for later use
        tripData = tripDetails;

        // Populate trip details in the form
        populateTripDetails(tripDetails);

        hideLoading();
    } catch (error) {
        console.error("Error loading trip data:", error);
        hideLoading();
        showError(error.message || "Failed to load trip data");

        // If authentication failed, redirect to login
        if (error.message.includes("Authentication") || error.message.includes("login")) {
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 2000);
        }
    }
}

function populateTripDetails(tripDetails) {
    // Fill in the trip details form
    document.getElementById('trip-title').value = tripDetails.title || `Trip to ${tripDetails.start_city || 'Unknown Location'}`;
    document.getElementById('start-city').value = tripDetails.start_city || '';
    document.getElementById('end-city').value = tripDetails.end_city || '';

    // Format date to YYYY-MM-DD for the input field
    let startDate = tripDetails.start_date || '';
    if (startDate.includes('T')) {
        startDate = startDate.split('T')[0];
    }
    document.getElementById('start-date').value = startDate;

    document.getElementById('trip-duration').value = tripDetails.duration || 1;
}

// Add custom activity as an object
function addCustomActivity() {
    const name = document.getElementById('custom-destination-name').value.trim();
    const description = document.getElementById('custom-destination-description').value.trim();

    if (!name) {
        alert("Please enter an activity name");
        return;
    }

    // Format activity
    const activity = {
        id: generateTempId(),
        name: description ? `${name} - ${description}` : name,
        address: description ? `${name} - ${description}` : name,
        _new: true
    };

    // Add to current day's waypoints
    if (!allDaysData[currentDay].waypoints) {
        allDaysData[currentDay].waypoints = [];
    }

    allDaysData[currentDay].waypoints.push(activity);

    // Refresh the waypoints UI
    populateWaypoints(currentDay, allDaysData[currentDay].waypoints);

    // Clear the inputs
    document.getElementById('custom-destination-name').value = '';
    document.getElementById('custom-destination-description').value = '';
}

// Updated to save waypoint objects
function saveCurrentDayData() {
    if (currentDay >= 0 && currentDay < allDaysData.length) {
        console.log(`Saving current day (${currentDay}) data before navigation/saving`);

        const dayData = allDaysData[currentDay];
        if (!dayData) return; // Should not happen

        // Update destination (read-only, but ensure data model is consistent with UI)
        const destInput = document.querySelector(`#destination-${currentDay}`);
        if (destInput) dayData.destination = destInput.value;

        // Update waypoints based on current input fields
        const currentWaypoints = dayData.waypoints || [];
        const updatedWaypoints = [];
        const waypointInputs = document.querySelectorAll(`#waypoints-container-${currentDay} .waypoint-input`);

        waypointInputs.forEach(input => {
            const activityId = input.getAttribute('data-activity-id');
            const name = input.value.trim();

            // Find the original waypoint object using the ID
            const originalWp = currentWaypoints.find(wp => wp.id === activityId);

            if (name) { // Only save if there's a name
                if (originalWp) {
                    // If name changed and it's not a new item, mark as modified
                    if (originalWp.name !== name && !originalWp._new) {
                        originalWp._modified = true;
                    }
                    originalWp.name = name;
                    originalWp.address = name; // Keep address same as name for simplicity
                    updatedWaypoints.push(originalWp);
                } else {
                    // This case should ideally not happen if IDs are managed correctly
                    // But as a fallback, treat it like a new item if ID wasn't found
                    updatedWaypoints.push({
                        id: activityId || generateTempId(), // Use existing temp ID or generate new
                        name: name,
                        address: name,
                        _new: true
                    });
                }
            }
        });

        // Add back any waypoints marked as _deleted (they are not in the UI inputs)
        currentWaypoints.forEach(wp => {
            if (wp._deleted && !updatedWaypoints.some(uwp => uwp.id === wp.id)) {
                updatedWaypoints.push(wp);
            }
        });

        // Update the main data structure
        allDaysData[currentDay].waypoints = updatedWaypoints;

        console.log(`Saved data for day ${currentDay + 1}:`, allDaysData[currentDay]);
    }
}

// Also add window event listener to save data before user leaves the page
window.addEventListener('beforeunload', function (e) {
    // Save current day data
    saveCurrentDayData();

    // Check if there are unsaved changes by comparing with original data
    // This is optional and could be enhanced with a more thorough comparison
    const message = "You have unsaved changes. Are you sure you want to leave?";
    e.returnValue = message;
    return message;
});

function setupDayNavigation() {
    // Add prev/next day buttons
    const dayContent = document.querySelector('.day-content');
    const navigation = document.createElement('div');
    navigation.className = 'day-navigation';
    navigation.innerHTML = `
        <button type="button" class="btn-secondary prev-day">
            <i class="fas fa-chevron-left"></i> Previous Day
        </button>
        <button type="button" class="btn-secondary next-day">
            <i class="fas fa-chevron-right"></i> Next Day
        </button>
    `;
    dayContent.insertAdjacentElement('afterend', navigation);

    // Add event listeners
    document.querySelector('.prev-day').addEventListener('click', function () {
        if (currentDay > 0) {
            showDay(currentDay - 1);
        }
    });

    document.querySelector('.next-day').addEventListener('click', function () {
        if (currentDay < allDaysData.length - 1) {
            showDay(currentDay + 1);
        } else {
            // Ask if they want to add a new day
            if (confirm("Would you like to add a new day to your trip?")) {
                // Current data is saved in addNewDay via saveCurrentDayData()
                addNewDay();
            }
        }
    });
}

// Utility functions
function showLoading(message) {
    const loadingEl = document.getElementById('loading-overlay');
    if (!loadingEl) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-message">${message}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        const msgEl = loadingEl.querySelector('.loading-message');
        if (msgEl) msgEl.textContent = message;
        loadingEl.style.display = 'flex';
    }
}

function hideLoading() {
    const loadingEl = document.getElementById('loading-overlay');
    if (loadingEl) {
        loadingEl.style.display = 'none';
    }
}

function showError(message) {
    // Create error element if it doesn't exist
    let errorEl = document.querySelector('.error-message');
    if (!errorEl) {
        errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        // Insert at the top of the main content
        const main = document.querySelector('.main-content');
        if (main && main.firstChild) {
            main.insertBefore(errorEl, main.firstChild);
        } else {
            document.body.appendChild(errorEl);
        }
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    // Auto-hide after 5 seconds
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}
