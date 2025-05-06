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

        // Store all days data, and ensure waypoints are objects with id, name, etc.
        allDaysData = itineraryData.map(day => {
            // If waypoints are strings, convert to objects
            if (Array.isArray(day.waypoints)) {
                day.waypoints = day.waypoints.map(wp => {
                    if (typeof wp === 'string') {
                        return { id: generateTempId(), name: wp, _new: true };
                    }
                    // If already object, ensure id and name
                    if (!wp.id) wp.id = generateTempId();
                    if (!wp.name && wp.address) wp.name = wp.address;
                    return wp;
                });
            } else {
                day.waypoints = [];
            }
            return day;
        });

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

    currentDay = dayIndex;

    document.querySelectorAll('.day-tab').forEach((tab, index) => {
        tab.classList.toggle('active', index === dayIndex);
    });

    const dayData = allDaysData[dayIndex];
    const contentContainer = document.querySelector('.day-content');
    contentContainer.innerHTML = '';

    const dayForm = document.createElement('form');
    dayForm.className = 'day-form';
    dayForm.id = `day-form-${dayIndex}`;

    const editNotice = document.createElement('div');
    editNotice.className = 'edit-notice';
    editNotice.innerHTML = `
        <p><i class="fas fa-info-circle"></i> You can add, modify, or remove waypoints/activities for each day. Origin and destination cities are set by your overall trip details.</p>
    `;
    dayForm.appendChild(editNotice);

    // Origin field - read-only
    const originField = createFormField('Origin', `origin-${dayIndex}`, dayData.origin || '', true);
    dayForm.appendChild(originField);

    // Destination field - read-only again
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

    contentContainer.appendChild(dayForm);

    // Remove event listener for destination input
    // dayForm.querySelector(`#destination-${dayIndex}`).addEventListener('input', function () { ... });

    addDayActionListeners(dayIndex);
    // Populate waypoints using the filtered list (excluding _deleted)
    populateWaypoints(dayIndex, (dayData.waypoints || []).filter(wp => !wp._deleted));
    updateActivityCount();
}

// Update populateWaypoints to use activity objects
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
                   value="${waypoint.name || waypoint}" required
                   data-activity-id="${waypoint.id || ''}">
            <button type="button" class="btn-text delete-waypoint" data-day="${dayIndex}" data-index="${wpIndex}">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(waypointItem);

        // Mark as modified on change
        waypointItem.querySelector('input').addEventListener('input', function () {
            if (waypoints[wpIndex] && !waypoints[wpIndex]._new) {
                waypoints[wpIndex]._modified = true;
            }
            waypoints[wpIndex].name = this.value;
            waypoints[wpIndex].address = this.value;
        });
    });

    // Add event listeners for delete buttons
    container.querySelectorAll('.delete-waypoint').forEach(btn => {
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

// Add waypoint as an object
function addWaypoint(dayIndex) {
    const container = document.getElementById(`waypoints-container-${dayIndex}`);

    // Remove "no waypoints" message if it exists
    const noWaypoints = container.querySelector('.no-waypoints');
    if (noWaypoints) {
        container.removeChild(noWaypoints);
    }

    // Get current waypoints
    const currentWaypoints = allDaysData[dayIndex].waypoints || [];

    // Add a new empty waypoint (activity)
    const wpIndex = currentWaypoints.length;
    const newWp = { id: generateTempId(), name: '', address: '', _new: true };
    currentWaypoints.push(newWp);
    allDaysData[dayIndex].waypoints = currentWaypoints;
    populateWaypoints(dayIndex, currentWaypoints);
    container.querySelector(`#waypoint-${dayIndex}-${wpIndex}`).focus();
    updateActivityCount();
}

// Mark deleted activities with _deleted, keep in data, remove from UI
function deleteWaypoint(dayIndex, waypointIndex) {
    const waypoints = allDaysData[dayIndex].waypoints || [];
    // Find the actual waypoint in the full list based on visible index
    const visibleWaypoints = waypoints.filter(wp => !wp._deleted);
    if (waypointIndex < 0 || waypointIndex >= visibleWaypoints.length) return;

    const waypointToDelete = visibleWaypoints[waypointIndex];

    if (waypointToDelete && waypointToDelete.id && !waypointToDelete.id.startsWith('new-')) {
        // Mark existing as deleted
        waypointToDelete._deleted = true;
        // Clear other flags
        delete waypointToDelete._new;
        delete waypointToDelete._modified;
    } else {
        // If it was a new item not yet saved, remove it entirely from the data
        const actualIndex = waypoints.findIndex(wp => wp.id === waypointToDelete.id);
        if (actualIndex !== -1) {
            waypoints.splice(actualIndex, 1);
        }
    }

    // Refresh UI with non-deleted waypoints
    populateWaypoints(dayIndex, waypoints.filter(w => !w._deleted));
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

// UpdateDaysDataFromForms: update activity objects, mark as _modified if changed
function updateDaysDataFromForms() {
    console.log("Updating days data from forms");

    // Update each day's data from the corresponding form
    allDaysData.forEach((day, index) => {
        // Save destination for each day
        const destInput = document.querySelector(`#destination-${index}`);
        if (destInput) {
            day.destination = destInput.value;
        }
        // ...existing code for waypoints...
        const waypoints = [];
        const waypointInputs = document.querySelectorAll(`#waypoints-container-${index} .waypoint-input`);
        waypointInputs.forEach((input, i) => {
            const id = input.getAttribute('data-activity-id') || generateTempId();
            const value = input.value.trim();
            if (!value) return;
            let orig = day.waypoints && day.waypoints[i] ? day.waypoints[i] : {};
            let obj = {
                id: id,
                name: value,
                address: value
            };
            if (orig._new) obj._new = true;
            if (orig._modified) obj._modified = true;
            waypoints.push(obj);
        });
        // Add any _deleted activities (not shown in UI)
        if (Array.isArray(day.waypoints)) {
            day.waypoints.forEach(wp => {
                if (wp._deleted) waypoints.push(wp);
            });
        }
        day.waypoints = waypoints;
    });

    console.log("Updated days data:", allDaysData);
}

async function saveTripChanges() {
    try {
        showLoading("Saving trip changes...");
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        if (!email) throw new Error("User not logged in. Please login again to continue.");

        // Save current day data (ensuring objects are saved)
        saveCurrentDayData();

        // Adjust number of days if duration changed
        const newDuration = parseInt(document.getElementById('trip-duration').value);
        // ... (rest of duration adjustment logic remains the same) ...
        if (newDuration !== allDaysData.length) {
            if (newDuration > allDaysData.length) {
                for (let i = allDaysData.length; i < newDuration; i++) {
                    const lastDay = allDaysData[allDaysData.length - 1];
                    const newDay = {
                        day_number: i + 1,
                        origin: lastDay ? lastDay.destination : '',
                        destination: '', // Destination will be set by backend logic or next day's origin
                        waypoints: []
                    };
                    allDaysData.push(newDay);
                }
            } else if (newDuration < allDaysData.length) {
                allDaysData = allDaysData.slice(0, newDuration);
            }
            // Re-render tabs if duration changed
            renderDayTabs(allDaysData);
        }


        // Capture latest form data (including any final edits in the current day's form)
        updateDaysDataFromForms();

        if (!tripData || !tripData.id) throw new Error("Trip ID is missing, cannot save changes");

        const startDateInput = document.getElementById('start-date').value;
        let formattedStartDate = startDateInput;
        if (startDateInput) {
            const dateObj = new Date(startDateInput);
            if (!isNaN(dateObj.getTime())) {
                formattedStartDate = dateObj.toISOString().split('T')[0];
            }
        }

        // Use end_city directly from the main trip form
        const tripDetails = {
            id: tripData.id,
            user_id: tripData.user_id || email,
            start_city: document.getElementById('start-city').value,
            end_city: document.getElementById('end-city').value, // Use main form field
            duration: allDaysData.length,
            start_date: formattedStartDate,
            title: document.getElementById('trip-title').value || `Trip to ${document.getElementById('start-city').value}`
        };

        // Build activities array with correct flags and IDs
        const activities = [];
        allDaysData.forEach((day) => {
            // Remove the _destination logic
            // if (day.destination && day.destination !== '') { ... }

            if (Array.isArray(day.waypoints)) {
                day.waypoints.forEach((wp) => {
                    // Ensure day_number is correctly assigned, especially for modified/deleted
                    const activityPayload = {
                        id: wp.id,
                        day_number: day.day_number,
                        name: wp.name,
                        address: wp.address
                    };

                    if (wp._deleted) {
                        // Only send ID and _deleted flag for deletion
                        if (wp.id && !wp.id.startsWith('new-')) {
                            activities.push({
                                id: wp.id,
                                _deleted: true
                            });
                        }
                        // Do not send anything if a _new item was deleted before saving
                    } else if (wp._new) {
                        activityPayload._new = true;
                        // Remove temporary ID for new items
                        delete activityPayload.id;
                        activities.push(activityPayload);
                    } else if (wp._modified) {
                        activityPayload._modified = true;
                        activities.push(activityPayload);
                    }
                    // Unchanged items are not sent
                });
            }
        });

        const requestBody = {
            trip: tripDetails,
            activities: activities
        };

        if (!tripDetails.start_city || !tripDetails.end_city || !tripDetails.start_date) {
            throw new Error("Missing required trip details (start city, end city, or start date)");
        }

        console.log("Saving trip details:", JSON.stringify(requestBody, null, 2)); // Pretty print for debugging

        const detailsUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripData.id}`;
        const detailsResponse = await fetch(detailsUrl, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            },
            body: JSON.stringify(requestBody)
        });

        // ... (rest of response handling remains the same) ...
        // Handle response
        let responseData;
        try {
            const responseText = await detailsResponse.text();
            console.log("Raw response from trip update:", responseText);
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
        hideLoading();
        alert("Trip saved successfully!");
        if (confirm("Would you like to view your updated trip?")) {
            window.location.href = `../trip_card/trip_card.html?trip_id=${tripData.id}`;
        } else {
            window.location.href = "../dashboard/dashboard.html";
        }

    } catch (error) {
        // ... (rest of error handling remains the same) ...
        console.error("Error saving trip changes:", error);
        hideLoading();
        showError(error.message || "Failed to save trip changes");
        if (error.message.includes("Authentication") || error.message.includes("login")) {
            setTimeout(() => {
                window.location.href = '../login/login.html';
            }, 2000);
        }
    }
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
