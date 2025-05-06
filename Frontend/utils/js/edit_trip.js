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

    // Set up day navigation
    setupDayNavigation();

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

        // Now fetch the itinerary data (all days)
        const routingUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/routing?trip_id=${tripId}`;
        const routingResponse = await fetch(routingUrl, {
            headers: {
                'Content-Type': 'application/json',
            }
        });

        if (!routingResponse.ok) {
            throw new Error(`Failed to load routing data: ${routingResponse.status}`);
        }

        const routingData = await routingResponse.json();
        console.log("Routing data:", routingData);

        // Extract itinerary data
        let itineraryData = [];
        if (routingData.statusCode && routingData.body) {
            const bodyContent = typeof routingData.body === 'string'
                ? JSON.parse(routingData.body)
                : routingData.body;
            itineraryData = bodyContent.results || [];
        } else {
            itineraryData = routingData.results || routingData || [];
        }

        if (!itineraryData || itineraryData.length === 0) {
            throw new Error("No itinerary data available");
        }

        // Store all days data
        allDaysData = itineraryData;

        // Generate day tabs
        renderDayTabs(allDaysData);

        // Show the first day by default
        showDay(0);

        // Update summary information
        updateTripSummary();

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

    // Update summary fields
    document.getElementById('summary-start-city').textContent = tripDetails.start_city || 'Not set';
    document.getElementById('summary-end-city').textContent = tripDetails.end_city || 'Not set';
    document.getElementById('summary-duration').textContent = `${tripDetails.duration || 1} days`;
}

function renderDayTabs(daysData) {
    const tabsContainer = document.querySelector('.day-tabs');
    tabsContainer.innerHTML = '';

    daysData.forEach((day, index) => {
        const tab = document.createElement('button');
        tab.className = 'day-tab';
        tab.setAttribute('data-day', index);
        tab.textContent = `Day ${index + 1}`;

        tab.addEventListener('click', () => {
            // Save current data before switching
            showDay(index);
        });

        tabsContainer.appendChild(tab);
    });

    // Add new day button if needed
    const addDayBtn = document.createElement('button');
    addDayBtn.className = 'day-tab add-day';
    addDayBtn.innerHTML = '<i class="fas fa-plus"></i> Add Day';
    addDayBtn.addEventListener('click', () => {
        // Save current data before adding new day
        saveCurrentDayData();
        addNewDay();
    });
    tabsContainer.appendChild(addDayBtn);
}

function createFormField(label, id, value, isReadOnly = false) {
    const fieldDiv = document.createElement('div');
    fieldDiv.className = 'form-group';

    // Add readonly attribute and different styling if the field is read-only
    const readOnlyAttr = isReadOnly ? 'readonly' : '';
    const readOnlyClass = isReadOnly ? 'readonly-field' : '';

    fieldDiv.innerHTML = `
        <label for="${id}">${label} ${isReadOnly ? '<small>(cannot be modified)</small>' : ''}</label>
        <input type="text" id="${id}" name="${id}" class="form-control ${readOnlyClass}" value="${value}" ${readOnlyAttr} required>
    `;
    return fieldDiv;
}

function showDay(dayIndex) {
    // Save current day data before switching
    saveCurrentDayData();

    // Validate dayIndex
    if (dayIndex < 0 || dayIndex >= allDaysData.length) {
        console.error(`Invalid day index: ${dayIndex}`);
        return;
    }

    // Update current day
    currentDay = dayIndex;

    // Highlight selected tab
    document.querySelectorAll('.day-tab').forEach((tab, index) => {
        tab.classList.toggle('active', index === dayIndex);
    });

    // Get the day data
    const dayData = allDaysData[dayIndex];

    // Render the day content
    const contentContainer = document.querySelector('.day-content');
    contentContainer.innerHTML = '';

    // Create the day form
    const dayForm = document.createElement('form');
    dayForm.className = 'day-form';
    dayForm.id = `day-form-${dayIndex}`;

    // Add instruction notice about what can be edited
    const editNotice = document.createElement('div');
    editNotice.className = 'edit-notice';
    editNotice.innerHTML = `
        <p><i class="fas fa-info-circle"></i> You can add, modify, or remove waypoints/activities for each day. Origin and destination cities are set by your overall trip details.</p>
    `;
    dayForm.appendChild(editNotice);

    // Origin field - make read-only
    const originField = createFormField('Origin', `origin-${dayIndex}`, dayData.origin || '', true);
    dayForm.appendChild(originField);

    // Destination field - make read-only
    const destField = createFormField('Destination', `destination-${dayIndex}`, dayData.destination || '', true);
    dayForm.appendChild(destField);

    // Add waypoints section
    const waypointsSection = document.createElement('div');
    waypointsSection.className = 'waypoints-section';
    waypointsSection.innerHTML = `
        <h3>Waypoints / Activities</h3>
        <p class="waypoints-help">Add locations or activities you plan to visit on this day. These might include landmarks, restaurants, museums, etc.</p>
        <div class="waypoints-container" id="waypoints-container-${dayIndex}"></div>
        <button type="button" class="btn-secondary add-waypoint" data-day="${dayIndex}">
            <i class="fas fa-plus"></i> Add Waypoint
        </button>
    `;
    dayForm.appendChild(waypointsSection);

    // Add day actions
    const dayActions = document.createElement('div');
    dayActions.className = 'day-actions';
    dayActions.innerHTML = `
        <button type="button" class="btn-secondary move-day-up" ${dayIndex === 0 ? 'disabled' : ''}>
            <i class="fas fa-arrow-up"></i> Move Up
        </button>
        <button type="button" class="btn-secondary move-day-down" ${dayIndex === allDaysData.length - 1 ? 'disabled' : ''}>
            <i class="fas fa-arrow-down"></i> Move Down
        </button>
        <button type="button" class="btn-danger delete-day" ${allDaysData.length <= 1 ? 'disabled' : ''}>
            <i class="fas fa-trash"></i> Delete Day
        </button>
    `;
    dayForm.appendChild(dayActions);

    // Add the form to the content container
    contentContainer.appendChild(dayForm);

    // Add event listeners for day actions
    addDayActionListeners(dayIndex);

    // Populate waypoints
    populateWaypoints(dayIndex, dayData.waypoints || []);

    // Update activity count in summary
    updateActivityCount();
}

function populateWaypoints(dayIndex, waypoints) {
    const container = document.getElementById(`waypoints-container-${dayIndex}`);
    container.innerHTML = '';

    if (!waypoints || waypoints.length === 0) {
        container.innerHTML = '<p class="no-waypoints">No waypoints added yet.</p>';
        return;
    }

    waypoints.forEach((waypoint, wpIndex) => {
        const waypointItem = document.createElement('div');
        waypointItem.className = 'waypoint-item';
        waypointItem.innerHTML = `
            <div class="waypoint-handle"><i class="fas fa-grip-lines"></i></div>
            <input type="text" class="form-control waypoint-input" 
                   id="waypoint-${dayIndex}-${wpIndex}" 
                   name="waypoint-${dayIndex}-${wpIndex}" 
                   value="${waypoint}" required>
            <button type="button" class="btn-text delete-waypoint" data-day="${dayIndex}" data-index="${wpIndex}">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(waypointItem);
    });

    // Add event listeners for delete buttons
    document.querySelectorAll('.delete-waypoint').forEach(btn => {
        btn.addEventListener('click', function () {
            const dayIdx = parseInt(this.getAttribute('data-day'));
            const wpIdx = parseInt(this.getAttribute('data-index'));
            deleteWaypoint(dayIdx, wpIdx);
        });
    });
}

function addDayActionListeners(dayIndex) {
    // Add waypoint button
    document.querySelector(`.add-waypoint[data-day="${dayIndex}"]`).addEventListener('click', function () {
        addWaypoint(dayIndex);
    });

    // Move day up
    const moveUpBtn = document.querySelector('.move-day-up');
    if (moveUpBtn) {
        moveUpBtn.addEventListener('click', function () {
            if (dayIndex > 0) {
                moveDay(dayIndex, dayIndex - 1);
            }
        });
    }

    // Move day down
    const moveDownBtn = document.querySelector('.move-day-down');
    if (moveDownBtn) {
        moveDownBtn.addEventListener('click', function () {
            if (dayIndex < allDaysData.length - 1) {
                moveDay(dayIndex, dayIndex + 1);
            }
        });
    }

    // Delete day
    const deleteBtn = document.querySelector('.delete-day');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
            if (allDaysData.length > 1) {
                deleteDay(dayIndex);
            }
        });
    }
}

function addWaypoint(dayIndex) {
    const container = document.getElementById(`waypoints-container-${dayIndex}`);

    // Remove "no waypoints" message if it exists
    const noWaypoints = container.querySelector('.no-waypoints');
    if (noWaypoints) {
        container.removeChild(noWaypoints);
    }

    // Get current waypoints
    const currentWaypoints = allDaysData[dayIndex].waypoints || [];

    // Add a new empty waypoint
    const wpIndex = currentWaypoints.length;

    // Add to UI
    const waypointItem = document.createElement('div');
    waypointItem.className = 'waypoint-item';
    waypointItem.innerHTML = `
        <div class="waypoint-handle"><i class="fas fa-grip-lines"></i></div>
        <input type="text" class="form-control waypoint-input" 
               id="waypoint-${dayIndex}-${wpIndex}" 
               name="waypoint-${dayIndex}-${wpIndex}" 
               placeholder="Enter location or activity" required>
        <button type="button" class="btn-text delete-waypoint" data-day="${dayIndex}" data-index="${wpIndex}">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(waypointItem);

    // Focus the new input
    waypointItem.querySelector('input').focus();

    // Add event listener for the delete button
    waypointItem.querySelector('.delete-waypoint').addEventListener('click', function () {
        deleteWaypoint(dayIndex, wpIndex);
    });

    // Update the data model
    currentWaypoints.push('');
    allDaysData[dayIndex].waypoints = currentWaypoints;

    // Update activity count
    updateActivityCount();
}

function deleteWaypoint(dayIndex, waypointIndex) {
    // Update the data model
    const waypoints = allDaysData[dayIndex].waypoints || [];
    waypoints.splice(waypointIndex, 1);
    allDaysData[dayIndex].waypoints = waypoints;

    // Refresh the UI
    populateWaypoints(dayIndex, waypoints);

    // Update activity count
    updateActivityCount();
}

function moveDay(fromIndex, toIndex) {
    // Save current data before moving
    saveCurrentDayData();

    // Swap days in the data model
    const dayToMove = allDaysData[fromIndex];
    allDaysData.splice(fromIndex, 1);
    allDaysData.splice(toIndex, 0, dayToMove);

    // Update day numbers
    allDaysData.forEach((day, idx) => {
        day.day_number = idx + 1;
    });

    // Re-render day tabs
    renderDayTabs(allDaysData);

    // Show the moved day
    showDay(toIndex);
}

function deleteDay(dayIndex) {
    if (allDaysData.length <= 1) {
        alert("Cannot delete the only day in the trip.");
        return;
    }

    // Save current data before deleting
    saveCurrentDayData();

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete Day ${dayIndex + 1}?`)) {
        return;
    }

    // Remove the day from the data model
    allDaysData.splice(dayIndex, 1);

    // Update day numbers
    allDaysData.forEach((day, idx) => {
        day.day_number = idx + 1;
    });

    // Re-render day tabs
    renderDayTabs(allDaysData);

    // Show the previous day or the first day if we deleted the first day
    const newDayIndex = dayIndex > 0 ? dayIndex - 1 : 0;
    showDay(newDayIndex);

    // Update duration in trip details
    document.getElementById('trip-duration').value = allDaysData.length;
    updateTripSummary();
}

function addNewDay() {
    // Create a new day data object
    const lastDay = allDaysData[allDaysData.length - 1];
    const newDay = {
        day_number: allDaysData.length + 1,
        origin: lastDay ? lastDay.destination : '',
        destination: '',
        waypoints: []
    };

    // Add to the data model
    allDaysData.push(newDay);

    // Update trip duration
    document.getElementById('trip-duration').value = allDaysData.length;
    updateTripSummary();

    // Re-render day tabs
    renderDayTabs(allDaysData);

    // Show the new day
    showDay(allDaysData.length - 1);
}

function addCustomActivity() {
    const name = document.getElementById('custom-destination-name').value.trim();
    const description = document.getElementById('custom-destination-description').value.trim();

    if (!name) {
        alert("Please enter an activity name");
        return;
    }

    // Format activity
    const activity = description ? `${name} - ${description}` : name;

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

    // Update activity count
    updateActivityCount();
}

function updateTripSummary() {
    const startCity = document.getElementById('start-city').value;
    const endCity = document.getElementById('end-city').value;
    const duration = document.getElementById('trip-duration').value;

    document.getElementById('summary-start-city').textContent = startCity || 'Not set';
    document.getElementById('summary-end-city').textContent = endCity || 'Not set';
    document.getElementById('summary-duration').textContent = `${duration} days`;
}

function updateActivityCount() {
    let totalActivities = 0;

    // Count all waypoints across all days
    allDaysData.forEach(day => {
        totalActivities += (day.waypoints ? day.waypoints.length : 0);
    });

    // Add origin and destination for each day
    totalActivities += allDaysData.length * 2;

    document.getElementById('summary-activities').textContent = totalActivities;
}

async function saveTripChanges() {
    try {
        showLoading("Saving trip changes...");

        // Get user email for authentication - IMPORTANT
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        if (!email) {
            throw new Error("User not logged in. Please login again to continue.");
        }

        // Always save current day's data before proceeding
        saveCurrentDayData();

        // First, check if we need to adjust the number of days
        const newDuration = parseInt(document.getElementById('trip-duration').value);
        if (newDuration !== allDaysData.length) {
            // If the user manually edited the duration, we need to add or remove days
            if (newDuration > allDaysData.length) {
                // Add days
                for (let i = allDaysData.length; i < newDuration; i++) {
                    const lastDay = allDaysData[allDaysData.length - 1];
                    const newDay = {
                        day_number: i + 1,
                        origin: lastDay ? lastDay.destination : '',
                        destination: '',
                        waypoints: []
                    };
                    allDaysData.push(newDay);
                }
            } else if (newDuration < allDaysData.length) {
                // Remove days
                allDaysData = allDaysData.slice(0, newDuration);
            }
        }

        // Make sure we capture the latest form data before saving
        updateDaysDataFromForms();

        // Ensure we have the original trip ID
        if (!tripData || !tripData.id) {
            throw new Error("Trip ID is missing, cannot save changes");
        }

        // Format the date properly to ensure it's in YYYY-MM-DD format
        const startDateInput = document.getElementById('start-date').value;
        let formattedStartDate = startDateInput;
        if (startDateInput) {
            // Make sure we have a valid date
            const dateObj = new Date(startDateInput);
            if (!isNaN(dateObj.getTime())) {
                formattedStartDate = dateObj.toISOString().split('T')[0];
            }
        }

        // Format trip details according to Lambda expectations
        const tripDetails = {
            id: tripData.id,
            user_id: tripData.user_id || email,
            start_city: document.getElementById('start-city').value,
            end_city: document.getElementById('end-city').value,
            duration: newDuration,
            start_date: formattedStartDate,
            title: document.getElementById('trip-title').value || `Trip to ${document.getElementById('start-city').value}`
        };

        // Format activities from days data with _new flag as required by Lambda
        const activities = [];
        allDaysData.forEach((day, dayIndex) => {
            // Add waypoints as activities
            if (day.waypoints && day.waypoints.length > 0) {
                day.waypoints.forEach((waypoint) => {
                    if (waypoint.trim()) {  // Only add non-empty waypoints
                        activities.push({
                            _new: true, // Mark as new since we're creating/updating all
                            day_number: day.day_number,
                            name: waypoint,
                            address: waypoint // Using the waypoint name as address too
                        });
                    }
                });
            }
        });

        // Create the request body according to Lambda expectations
        const requestBody = {
            trip: tripDetails,
            activities: activities
        };

        // Extra validation step
        if (!tripDetails.start_city || !tripDetails.end_city || !tripDetails.start_date) {
            throw new Error("Missing required trip details (start city, end city, or start date)");
        }

        console.log("Saving trip details:", JSON.stringify(requestBody));

        // Save trip details first
        const detailsUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripData.id}`;
        console.log(`Sending PUT request to ${detailsUrl}`);

        const detailsResponse = await fetch(detailsUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email // Authentication header
            },
            body: JSON.stringify(requestBody)
        });

        // Handle response
        let responseData;
        try {
            // First try to get text for logging purposes
            const responseText = await detailsResponse.text();
            console.log("Raw response from trip update:", responseText);

            // If it's valid JSON, parse it
            try {
                responseData = JSON.parse(responseText);
            } catch (e) {
                responseData = { message: responseText };
            }
        } catch (e) {
            console.error("Error reading response:", e);
            responseData = {};
        }

        if (!detailsResponse.ok) {
            console.error("Error response status:", detailsResponse.status);
            console.error("Error response data:", responseData);

            if (detailsResponse.status === 401) {
                throw new Error("Authentication failed. Please login again.");
            }
            throw new Error(`Failed to save trip details: ${responseData.error || responseData.message || detailsResponse.status}`);
        }

        console.log("Trip details saved successfully:", responseData);

        // Show success message
        hideLoading();
        alert("Trip saved successfully!");

        // Redirect back to dashboard or trip view
        if (confirm("Would you like to view your updated trip?")) {
            window.location.href = `../trip_card/trip_card.html?trip_id=${tripData.id}`;
        } else {
            window.location.href = "../dashboard/dashboard.html";
        }
    } catch (error) {
        console.error("Error saving trip changes:", error);
        hideLoading();
        showError(error.message || "Failed to save trip changes");

        // If authentication failed, redirect to login
        if (error.message.includes("Authentication") || error.message.includes("login")) {
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 2000);
        }
    }
}

function updateDaysDataFromForms() {
    console.log("Updating days data from forms");

    // Update each day's data from the corresponding form
    allDaysData.forEach((day, index) => {
        // Only update waypoints, not origin or destination since they're read-only
        // Update waypoints
        const waypoints = [];
        const waypointInputs = document.querySelectorAll(`#waypoints-container-${index} .waypoint-input`);
        waypointInputs.forEach(input => {
            if (input.value.trim()) {
                waypoints.push(input.value.trim());
            }
        });
        day.waypoints = waypoints;
    });

    console.log("Updated days data:", allDaysData);
}

function saveCurrentDayData() {
    if (currentDay >= 0 && currentDay < allDaysData.length) {
        console.log(`Saving current day(${currentDay}) data before navigation`);

        // Save only the current day's waypoints
        const waypoints = [];
        const waypointInputs = document.querySelectorAll(`#waypoints-container-${currentDay} .waypoint-input`);

        waypointInputs.forEach(input => {
            if (input.value.trim()) {
                waypoints.push(input.value.trim());
            }
        });

        // Update in memory
        allDaysData[currentDay].waypoints = waypoints;

        console.log(`Saved ${waypoints.length} waypoints for day ${currentDay + 1}`);
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
