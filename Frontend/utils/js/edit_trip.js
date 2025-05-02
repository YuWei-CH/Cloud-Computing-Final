// Global variables to store trip data
let tripId = null;
let tripData = null;
let activities = [];
let currentDayActivities = {};

document.addEventListener('DOMContentLoaded', function () {
    // Initialize the page
    initEditTripPage();
});

async function initEditTripPage() {
    try {
        // Get trip ID from URL
        tripId = getTripIdFromURL();
        if (!tripId) {
            showError("No trip ID specified. Please go back to the dashboard and select a trip to edit.");
            return;
        }

        // Check authentication
        const email = checkAuthentication();
        if (!email) {
            return;
        }

        // Show loading indicator
        showLoading("Loading trip details...");

        // Load trip data
        await loadTripData(tripId, email);

        // Set up event listeners
        setupEventListeners();

        // Hide loading indicator
        hideLoading();
    } catch (error) {
        console.error("Error initializing edit page:", error);
        hideLoading();
        showError("Failed to load trip details. Please try again later.");
    }
}

// Function to get trip ID from URL query parameter
function getTripIdFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('trip_id');
}

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
        console.log("No authentication email found, redirecting to login");
        window.location.href = '../login/login.html';
        return null;
    }

    return email;
}

// Function to load trip data from the API
async function loadTripData(tripId, email) {
    try {
        // Get the trip details
        const tripDetailsUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`;
        const response = await fetch(tripDetailsUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load trip data: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Trip data response:", data);

        // Extract trip details from the response
        let result;

        // Handle different response formats
        if (data.statusCode && data.body) {
            // API Gateway Lambda proxy format
            const bodyContent = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
            result = bodyContent.trip || bodyContent;
        } else {
            // Direct format
            result = data.trip || data;
        }

        // Store the trip data
        tripData = result;

        // Populate the UI with trip data
        populateTripForm(tripData);

        // Load activities/itinerary data
        await loadTripActivities(tripId, email);

    } catch (error) {
        console.error("Error loading trip data:", error);
        throw error;
    }
}

// Function to load trip activities/itinerary
async function loadTripActivities(tripId, email) {
    try {
        // Get the trip itinerary
        const itineraryUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}/itinerary`;
        const response = await fetch(itineraryUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to load trip itinerary: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("Trip itinerary response:", data);

        // Extract activities from the response
        let activitiesData;

        // Handle different response formats
        if (data.statusCode && data.body) {
            // API Gateway Lambda proxy format
            const bodyContent = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
            activitiesData = bodyContent.activities || bodyContent;
        } else {
            // Direct format
            activitiesData = data.activities || data;
        }

        // Store the activities
        activities = activitiesData;

        // Organize activities by day
        organizeActivitiesByDay();

        // Generate day tabs
        generateDayTabs();

        // Update activity count
        updateActivityCount();

    } catch (error) {
        console.error("Error loading trip activities:", error);
        // Show a warning but don't throw an error since we can still edit trip details
        showNotification("Could not load trip activities. Some features may be limited.", "warning");
    }
}

// Function to organize activities by day
function organizeActivitiesByDay() {
    currentDayActivities = {};

    activities.forEach(activity => {
        const dayNumber = activity.day_number || 1;

        if (!currentDayActivities[dayNumber]) {
            currentDayActivities[dayNumber] = [];
        }

        currentDayActivities[dayNumber].push(activity);
    });
}

// Function to populate the trip form with data
function populateTripForm(tripData) {
    // Update form fields
    document.getElementById('trip-title').value = tripData.title || `Trip to ${tripData.start_city}`;
    document.getElementById('start-city').value = tripData.start_city || '';
    document.getElementById('end-city').value = tripData.end_city || '';
    document.getElementById('trip-duration').value = tripData.duration || 1;

    // Format date for the input field (YYYY-MM-DD)
    if (tripData.start_date) {
        const date = new Date(tripData.start_date);
        const formattedDate = date.toISOString().split('T')[0];
        document.getElementById('start-date').value = formattedDate;
    }

    // Update summary information
    document.getElementById('summary-start-city').textContent = tripData.start_city || '';
    document.getElementById('summary-end-city').textContent = tripData.end_city || '';
    document.getElementById('summary-duration').textContent = `${tripData.duration || 1} days`;
}

// Function to generate day tabs based on trip duration
function generateDayTabs() {
    const duration = parseInt(tripData.duration || 1);
    const startDate = new Date(tripData.start_date);

    const tabsContainer = document.querySelector('.day-tabs');
    const contentContainer = document.querySelector('.day-content');

    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    for (let i = 1; i <= duration; i++) {
        // Create day tab
        const tab = document.createElement('div');
        tab.classList.add('day-tab');

        if (i === 1) {
            tab.classList.add('active');
        }

        tab.setAttribute('data-day', i);

        // Add date to tab
        if (startDate && !isNaN(startDate.getTime())) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + (i - 1));
            tab.innerHTML = `
                <span>Day ${i}</span>
                <small>${formatDate(date)}</small>
            `;
        } else {
            tab.innerHTML = `<span>Day ${i}</span>`;
        }

        tabsContainer.appendChild(tab);

        // Create day content
        const content = document.createElement('div');
        content.classList.add('day-content-item');
        content.setAttribute('id', `day-${i}`);
        content.style.display = i === 1 ? 'block' : 'none';

        // Add heading and list container
        content.innerHTML = `
            <h3>Day ${i} - Activities</h3>
            <div class="activity-list" id="activity-list-${i}">
                <!-- Activities will be added here -->
                <div class="add-activity-btn">
                    <i class="fas fa-plus-circle"></i>
                    <span>Add Activity</span>
                </div>
            </div>
        `;

        contentContainer.appendChild(content);

        // Populate activities for this day
        populateDayActivities(i);
    }

    // Add event listeners to day tabs
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            const dayId = this.getAttribute('data-day');

            // Remove active class from all tabs
            document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));

            // Add active class to clicked tab
            this.classList.add('active');

            // Hide all content items
            document.querySelectorAll('.day-content-item').forEach(item => {
                item.style.display = 'none';
            });

            // Show selected day content
            document.getElementById(`day-${dayId}`).style.display = 'block';
        });
    });
}

// Function to populate activities for a specific day
function populateDayActivities(dayNumber) {
    const activityList = document.getElementById(`activity-list-${dayNumber}`);
    const dayActivities = currentDayActivities[dayNumber] || [];

    // Find the add button so we can insert before it
    const addButton = activityList.querySelector('.add-activity-btn');

    // Clear existing activities except the add button
    Array.from(activityList.children).forEach(child => {
        if (!child.classList.contains('add-activity-btn')) {
            activityList.removeChild(child);
        }
    });

    // Add activities
    dayActivities.forEach(activity => {
        const activityItem = createActivityItem(activity, dayNumber);
        activityList.insertBefore(activityItem, addButton);
    });
}

// Function to create an activity item element
function createActivityItem(activity, dayNumber) {
    const item = document.createElement('div');
    item.classList.add('activity-item');
    item.setAttribute('data-id', activity.id);

    // Make sure description is not undefined, use empty string instead
    const description = activity.description || '';

    item.innerHTML = `
        <div class="activity-date">Day ${dayNumber}</div>
        <div class="activity-details">
            <h4 class="editable-field">${activity.name || 'Unnamed Activity'}</h4>
            <p class="editable-field">${description}</p>
        </div>
        <div class="activity-actions">
            <button class="btn-text edit-activity-btn" title="Edit this activity">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn-text delete-activity-btn" title="Remove this activity">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    // Add event listener for delete button
    const deleteBtn = item.querySelector('.delete-activity-btn');
    deleteBtn.addEventListener('click', function () {
        if (confirm(`Remove "${activity.name}" from Day ${dayNumber}?`)) {
            // Mark for deletion
            activity._deleted = true;

            // Add removal animation
            item.classList.add('removing');

            // Remove from UI after animation
            setTimeout(() => {
                item.remove();

                // Update activity count
                updateActivityCount();
            }, 300);
        }
    });

    // Add event listeners for editable fields
    const editableFields = item.querySelectorAll('.editable-field');
    editableFields.forEach(field => {
        field.addEventListener('click', function () {
            makeFieldEditable(this, activity);
        });
    });

    return item;
}

// Function to make a field editable
function makeFieldEditable(element, activity) {
    // Check if already editing
    if (element.classList.contains('editing')) {
        return;
    }

    // Mark as editing
    element.classList.add('editing');

    // Store the original content
    const originalContent = element.textContent;

    // Create an input element
    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalContent;
    input.className = 'edit-field-input';
    input.style.width = '100%';
    input.style.padding = '5px';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '4px';

    // Replace the element content with the input
    element.textContent = '';
    element.appendChild(input);

    // Focus the input
    input.focus();

    // Handle input blur (save changes)
    input.addEventListener('blur', function () {
        saveFieldEdit(element, input.value, activity);
    });

    // Handle enter key
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            saveFieldEdit(element, input.value, activity);
        } else if (e.key === 'Escape') {
            // Restore original content on escape
            element.textContent = originalContent;
            element.classList.remove('editing');
        }
    });
}

// Function to save field edit
function saveFieldEdit(element, newValue, activity) {
    // Remove editing class
    element.classList.remove('editing');

    // Update the element text
    element.textContent = newValue;

    // Update the activity object
    if (element.tagName.toLowerCase() === 'h4') {
        activity.name = newValue;
    } else if (element.tagName.toLowerCase() === 'p') {
        activity.description = newValue;
    }

    // Mark as modified
    activity._modified = true;
}

// Function to set up event listeners
function setupEventListeners() {
    // Add custom destination button
    const addCustomBtn = document.getElementById('add-custom-destination');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', function () {
            addCustomActivity();
        });
    }

    // Trip details form fields (update summary when changed)
    document.getElementById('start-city').addEventListener('input', updateTripSummary);
    document.getElementById('end-city').addEventListener('input', updateTripSummary);
    document.getElementById('trip-duration').addEventListener('change', handleDurationChange);

    // Save button
    document.getElementById('save-trip-btn').addEventListener('click', saveChanges);
}

// Function to add a custom activity
function addCustomActivity() {
    const nameInput = document.getElementById('custom-destination-name');
    const descInput = document.getElementById('custom-destination-description');

    const name = nameInput.value.trim();
    const description = descInput.value.trim();

    if (!name) {
        alert('Please enter an activity name');
        return;
    }

    // Get the active day
    const activeDay = document.querySelector('.day-tab.active').getAttribute('data-day');

    // Create a new activity object
    const newActivity = {
        id: 'new-' + Date.now(), // Temporary ID
        name: name,
        description: description, // Store for UI display, but it won't be saved to DB
        address: description,     // Use description as address for DB storage
        day_number: parseInt(activeDay),
        _new: true // Mark as new
    };

    // Add to activities array
    if (!currentDayActivities[activeDay]) {
        currentDayActivities[activeDay] = [];
    }

    currentDayActivities[activeDay].push(newActivity);

    // Add to the UI
    const activityList = document.getElementById(`activity-list-${activeDay}`);
    const addButton = activityList.querySelector('.add-activity-btn');
    const activityItem = createActivityItem(newActivity, activeDay);

    activityList.insertBefore(activityItem, addButton);

    // Clear inputs
    nameInput.value = '';
    descInput.value = '';

    // Update activity count
    updateActivityCount();

    // Show notification
    showNotification('Activity added successfully');
}

// Function to handle duration change
function handleDurationChange() {
    // Get new duration
    const newDuration = parseInt(document.getElementById('trip-duration').value);
    const oldDuration = parseInt(tripData.duration || 1);

    // Update summary
    updateTripSummary();

    // If duration has changed, regenerate day tabs
    if (newDuration !== oldDuration) {
        // Store active day
        const activeDay = parseInt(document.querySelector('.day-tab.active').getAttribute('data-day'));

        // Update tripData
        tripData.duration = newDuration;

        // Regenerate day tabs
        generateDayTabs();

        // Try to set the same active day, if it exists
        if (activeDay <= newDuration) {
            const dayTab = document.querySelector(`.day-tab[data-day="${activeDay}"]`);
            if (dayTab) {
                dayTab.click();
            }
        }
    }
}

// Function to update trip summary
function updateTripSummary() {
    // Get values from form
    const startCity = document.getElementById('start-city').value;
    const endCity = document.getElementById('end-city').value;
    const duration = document.getElementById('trip-duration').value;

    // Update summary elements
    document.getElementById('summary-start-city').textContent = startCity;
    document.getElementById('summary-end-city').textContent = endCity;
    document.getElementById('summary-duration').textContent = `${duration} days`;
}

// Function to update activity count
function updateActivityCount() {
    let count = 0;

    // Count all activities that aren't marked for deletion
    Object.values(currentDayActivities).forEach(dayActivities => {
        dayActivities.forEach(activity => {
            if (!activity._deleted) {
                count++;
            }
        });
    });

    // Update UI
    document.getElementById('summary-activities').textContent = count;
}

// Function to save changes
async function saveChanges() {
    try {
        showLoading("Saving your changes...");

        // Get email for authentication
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        if (!email) {
            throw new Error("User email not found. Please login again.");
        }

        // Get form values
        const title = document.getElementById('trip-title').value;
        const startCity = document.getElementById('start-city').value;
        const endCity = document.getElementById('end-city').value;
        const startDate = document.getElementById('start-date').value;
        const duration = parseInt(document.getElementById('trip-duration').value);

        // Prepare updated trip data
        const updatedTrip = {
            id: tripId,
            title: title,
            start_city: startCity,
            end_city: endCity,
            start_date: startDate,
            duration: duration,
            user_id: email  // For authentication purposes
        };

        // Prepare updated activities
        const updatedActivities = [];

        // Collect all activities that need updating or creation
        Object.values(currentDayActivities).forEach(dayActivities => {
            dayActivities.forEach(activity => {
                if (activity._deleted) {
                    // If it's a real activity (not a new one), mark for deletion
                    if (!activity._new) {
                        updatedActivities.push({
                            id: activity.id,
                            _deleted: true
                        });
                    }
                } else if (activity._new || activity._modified) {
                    // New or modified activities
                    updatedActivities.push({
                        id: activity.id,
                        name: activity.name,
                        description: activity.description,
                        day_number: activity.day_number,
                        _new: activity._new
                    });
                }
            });
        });

        // Combine data for API
        const updateData = {
            trip: updatedTrip,
            activities: updatedActivities
        };

        // Call the API to update the trip
        const url = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`;
        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            },
            body: JSON.stringify(updateData)
        });

        // Check for success
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update trip');
        }

        hideLoading();

        // Show success message
        showNotification('Trip updated successfully!');

        // Reload the page after a short delay to show the notification
        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        hideLoading();
        console.error('Error saving changes:', error);
        showError(`Failed to save changes: ${error.message}`);
    }
}

// Helper function to format date
function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Function to show loading indicator
function showLoading(message = "Loading...") {
    const overlay = document.getElementById('loading-overlay');
    const loadingMessage = document.querySelector('.loading-message');

    if (loadingMessage) {
        loadingMessage.textContent = message;
    }

    if (overlay) {
        overlay.style.display = 'flex';
    }
}

// Function to hide loading indicator
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');

    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Function to show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.zIndex = '2000';
    errorDiv.style.padding = '15px 20px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';

    // Add to page
    document.body.appendChild(errorDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Function to show notification
function showNotification(message, type = 'success') {
    // Create notification element if it doesn't exist
    if (!document.getElementById('notification')) {
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.color = 'white';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';

        document.body.appendChild(notification);
    }

    const notification = document.getElementById('notification');

    // Set color based on type
    if (type === 'success') {
        notification.style.backgroundColor = '#4CAF50';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#ff9800';
    } else if (type === 'error') {
        notification.style.backgroundColor = '#f44336';
    }

    notification.textContent = message;
    notification.style.opacity = '1';

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}
