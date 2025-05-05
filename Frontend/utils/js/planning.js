document.addEventListener('DOMContentLoaded', function () {
    // Check authentication
    const token = checkAuthentication();
    if (!token) return;

    // Make sure we're on the planning page
    if (!document.querySelector('.planning-header')) {
        console.error('Planning script loaded on non-planning page');
        return;
    }

    // Display current date
    updateCurrentDateDisplay();

    // Set trip destination values immediately
    const destination = sessionStorage.getItem('planning_destination') || 'Unknown Location';
    const startCityEl = document.getElementById('summary-start-city');
    const endCityEl = document.getElementById('summary-end-city');
    const destinationsEl = document.getElementById('summary-destinations');
    
    if (startCityEl) startCityEl.textContent = destination;
    if (endCityEl) endCityEl.textContent = destination;
    if (destinationsEl) destinationsEl.textContent = '1';

    // Initialize date pickers with today's date
    const today = new Date();
    // Format today's date as YYYY-MM-DD for input value
    const todayFormatted = today.toISOString().split('T')[0];
    
    // For end date, add 3 days and format
    const endDate = new Date(today);
    endDate.setDate(today.getDate() + 3);
    const endDateFormatted = endDate.toISOString().split('T')[0];

    const daysStartDate = document.getElementById('days-start-date');
    const startDate = document.getElementById('start-date');
    const endDateEl = document.getElementById('end-date');

    if (daysStartDate) daysStartDate.value = todayFormatted;
    if (startDate) startDate.value = todayFormatted;
    if (endDateEl) endDateEl.value = endDateFormatted;

    // Add event delegation for day tabs
    setupDayTabNavigation();

    // Initialize planning UI components
    initPlanningUI();

    // Debug session storage
    debugSessionStorage();
});

// Copy of the authentication check function from explore.js
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

function initPlanningUI() {
    try {
        // Get stored destination and attractions
        const destination = sessionStorage.getItem('planning_destination') || 'Your';
        const attractionIds = JSON.parse(sessionStorage.getItem('planning_attractions') || '[]');

        // Update UI to show destination
        const titleEl = document.querySelector('.planning-title h1');
        if (titleEl) {
            titleEl.textContent = `Plan Your ${destination} Adventure`;
        }
        
        // Initialize trip summary with dynamic values
        updateTripSummary(destination);

        // Set up duration selection
        initDurationControls();

        // Initialize autocomplete for custom destinations
        initCustomDestinationAutocomplete();

        // Handle save trip button
        const saveBtn = document.querySelector('.btn-save-trip');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveTripToDatabase);
        }

        // Add event listener for custom destination button
        const addCustomDestBtn = document.getElementById('add-custom-destination');
        if (addCustomDestBtn) {
            addCustomDestBtn.addEventListener('click', addCustomDestination);
        }
    } catch (error) {
        console.error('Error initializing planning UI:', error);
    }
}

// Function to update trip summary with current values
function updateTripSummary(destination) {
    // Only update city information when destination has changed
    if (destination) {
        const startCityEl = document.getElementById('summary-start-city');
        const endCityEl = document.getElementById('summary-end-city');
        
        if (startCityEl) startCityEl.textContent = destination;
        if (endCityEl) endCityEl.textContent = destination;
    }
    
    // No need to update destinations count as it's always 1 in this version
}

function initDurationControls() {
    // Handle duration option selection
    const durationOptions = document.querySelectorAll('.duration-option');
    const daysInput = document.getElementById('days-input');
    const datesInput = document.getElementById('dates-input');

    durationOptions.forEach(option => {
        option.addEventListener('click', function () {
            durationOptions.forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');

            const optionType = this.getAttribute('data-option');
            if (optionType === 'days') {
                daysInput.style.display = 'block';
                datesInput.style.display = 'none';
            } else {
                daysInput.style.display = 'none';
                datesInput.style.display = 'block';
            }
        });
    });

    // Continue to itinerary button
    const durationNextBtn = document.getElementById('duration-next-btn');
    const itinerarySection = document.getElementById('itinerary-section');
    const durationSection = document.getElementById('trip-duration-section');

    durationNextBtn.addEventListener('click', function () {
        const activeOption = document.querySelector('.duration-option.active');
        const optionType = activeOption.getAttribute('data-option');
        let duration = '';
        let startDate, days;

        if (optionType === 'days') {
            days = parseInt(document.getElementById('number-of-days').value);
            startDate = parseInputDate(document.getElementById('days-start-date').value);

            if (isNaN(startDate.getTime())) {
                alert('Please select a valid start date');
                return;
            }

            duration = `${days} days (starting ${formatDate(startDate)})`;
            generateDayTabs(days, startDate);
        } else {
            startDate = parseInputDate(document.getElementById('start-date').value);
            const endDate = parseInputDate(document.getElementById('end-date').value);

            if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                alert('Please select valid dates');
                return;
            }

            if (startDate > endDate) {
                alert('End date must be after start date');
                return;
            }

            const dayDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
            days = Math.round(dayDiff) + 1;

            duration = `${days} days (${formatDate(startDate)} - ${formatDate(endDate)})`;
            generateDayTabs(days, startDate);
        }

        // Update summary and show itinerary section
        document.getElementById('summary-duration').textContent = duration;
        
        // Get the destination again to ensure we're using the latest value
        const destination = sessionStorage.getItem('planning_destination') || 'Unknown Location';
        updateTripSummary(destination);

        // Load selected attractions from sessionStorage
        const attractionIds = JSON.parse(sessionStorage.getItem('planning_attractions') || '[]');
        populateSelectedAttractions(attractionIds);

        durationSection.style.display = 'none';
        itinerarySection.style.display = 'flex';
    });
}

function populateSelectedAttractions(attractionIds) {
    // Get attractions from sessionStorage
    let attractionsData;
    try {
        attractionsData = JSON.parse(sessionStorage.getItem('attractions_data') || '[]');
        console.log("Retrieved attractions data:", attractionsData);
    } catch (error) {
        console.error('Error parsing attractions data:', error);
        attractionsData = [];
    }

    // Process attractions with the data we have
    processAttractions(attractionsData, attractionIds);
}

// Helper function to process attractions after they're loaded
function processAttractions(attractionsData, attractionIds) {
    console.log("Attraction IDs to filter:", attractionIds);

    // Filter attractions based on stored IDs
    const selectedAttractions = attractionsData.filter(
        attraction => attractionIds.includes(attraction.id.toString())
    );

    console.log("Selected attractions after filtering:", selectedAttractions);

    // Save the selected attractions for other functions to use
    window.planningSelectedAttractions = selectedAttractions;

    // Update attractions count
    const summaryActivities = document.getElementById('summary-activities');
    if (summaryActivities) {
        summaryActivities.textContent = selectedAttractions.length;
    }

    // Add attractions to sidebar
    const container = document.getElementById('selected-attractions-list');
    if (!container) return;

    container.innerHTML = '';

    if (selectedAttractions.length === 0) {
        container.innerHTML = `
            <div class="no-attractions-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>No attractions selected. Please go back to the explore page and select attractions.</p>
                <a href="explore.html" class="btn-secondary btn-full">
                    <i class="fas fa-arrow-left"></i> Back to Explore
                </a>
            </div>
        `;
        return;
    }

    selectedAttractions.forEach(attraction => {
        const item = document.createElement('div');
        item.classList.add('sidebar-attraction-item');
        item.setAttribute('draggable', 'true');
        item.setAttribute('data-id', attraction.id);

        item.innerHTML = `
            <div class="attraction-item-content">
                <span class="attraction-name">${attraction.name}</span>
            </div>
            <div class="attraction-actions">
                <button class="btn-text remove-attraction-btn" title="Remove this attraction" aria-label="Remove this attraction">
                    <i class="fas fa-times"></i>
                </button>
                <button class="btn-text add-to-day-btn" title="Add to current day">
                    <i class="fas fa-plus-circle"></i>
                </button>
            </div>
        `;

        // Set up event listeners
        const addBtn = item.querySelector('.add-to-day-btn');
        addBtn.addEventListener('click', function () {
            const activeDay = document.querySelector('.day-tab.active').getAttribute('data-day');
            addAttractionToDay(attraction, activeDay);
        });

        // Add event listener for the remove button
        const removeBtn = item.querySelector('.remove-attraction-btn');
        removeBtn.addEventListener('click', function () {
            removeAttractionFromSelection(attraction, item, container);
        });

        // Setup drag-and-drop
        item.addEventListener('dragstart', function (e) {
            e.dataTransfer.setData('text/plain', attraction.id);
            this.classList.add('dragging');
        });

        item.addEventListener('dragend', function () {
            this.classList.remove('dragging');
        });

        container.appendChild(item);
    });
}

// New function to remove an attraction from the selection
function removeAttractionFromSelection(attraction, itemElement, container) {
    // Ask for confirmation
    const confirmed = confirm(`Remove "${attraction.name}" from your selected attractions?`);
    if (!confirmed) return;

    // Add removal animation class
    itemElement.classList.add('removing');

    setTimeout(() => {
        // Remove from the DOM
        itemElement.remove();

        // Remove from the local attractions array
        if (window.planningSelectedAttractions) {
            window.planningSelectedAttractions = window.planningSelectedAttractions.filter(
                item => item.id !== attraction.id
            );

            // Also update session storage
            const attractionIds = window.planningSelectedAttractions.map(a => a.id.toString());
            sessionStorage.setItem('planning_attractions', JSON.stringify(attractionIds));

            // Update activity counter
            updateActivityCounter();

            // Remove from any day it had been added to
            removeAttractionFromAllDays(attraction.id);

            // Update save button state
            updateSaveButtonState();

            // Show notification
            showNotification(`"${attraction.name}" removed from selection`);

            // Check if no attractions remain
            if (window.planningSelectedAttractions.length === 0) {
                container.innerHTML = `
                    <div class="no-attractions-message">
                        <i class="fas fa-exclamation-circle"></i>
                        <p>No attractions selected. Please go back to the explore page and select attractions.</p>
                        <a href="explore.html" class="btn-secondary btn-full">
                            <i class="fas fa-arrow-left"></i> Back to Explore
                        </a>
                    </div>
                `;
            }
        }
    }, 300); // Match with CSS animation duration
}

// Function to remove an attraction from all days in the itinerary
function removeAttractionFromAllDays(attractionId) {
    // Find all instances of this attraction in any day
    const activityItems = document.querySelectorAll(`.activity-item[data-attraction-id="${attractionId}"]`);

    // Remove each instance
    activityItems.forEach(item => {
        item.classList.add('removing');
        setTimeout(() => {
            if (item.parentNode) {
                item.parentNode.removeChild(item);
            }
        }, 300);
    });
}

// Modified to handle missing attractionId more gracefully
function addAttractionToDay(attraction, dayId) {
    const dayContent = document.getElementById(`day-${dayId}`);
    if (!dayContent) return;

    const activityList = dayContent.querySelector('.activity-list');
    if (!activityList) return;

    // Check if attraction exists in our selected attractions
    // Added exception for custom destinations (IDs starting with 'custom-')
    if (!String(attraction.id).startsWith('custom-') &&
        (!window.planningSelectedAttractions ||
            !window.planningSelectedAttractions.some(a => a.id === attraction.id))) {
        console.error('Attempted to add an attraction that was not pre-selected');
        return;
    }

    // Check if this attraction is already in this day - ensure string comparison
    const existingActivities = dayContent.querySelectorAll(`[data-attraction-id="${attraction.id}"]`);
    if (existingActivities.length > 0) {
        alert(`${attraction.name} is already in your Day ${dayId} itinerary`);
        return;
    }

    // Get the date for this day from the day tab
    const dayTab = document.querySelector(`.day-tab[data-day="${dayId}"]`);
    let dateText = dayTab ? dayTab.querySelector('small').textContent : `Day ${dayId}`;

    const activityItem = document.createElement('div');
    activityItem.classList.add('activity-item');
    activityItem.setAttribute('data-attraction-id', attraction.id);

    activityItem.innerHTML = `
        <div class="activity-date">${dateText}</div>
        <div class="activity-details">
            <h4>${attraction.name}</h4>
            <p>${attraction.description || ''}</p>
        </div>
        <div class="activity-actions">
            <button class="btn-text remove-activity-btn" title="Remove this attraction">
                <i class="fas fa-trash-alt"></i>
            </button>
        </div>
    `;

    // Add before the "Add Activity" button
    const addButton = activityList.querySelector('.add-activity-btn');
    activityList.insertBefore(activityItem, addButton);

    // Add event listener for remove button
    const removeBtn = activityItem.querySelector('.remove-activity-btn');
    removeBtn.addEventListener('click', function () {
        removeAttractionFromDay(attraction, dayId, activityItem, activityList);
    });

    // Update the activity counter in the summary
    updateActivityCounter();
    updateSaveButtonState();
}

// New function to handle attraction removal
function removeAttractionFromDay(attraction, dayId, activityItem, activityList) {
    // Create and show confirmation dialog
    const confirmation = confirm(`Remove "${attraction.name}" from Day ${dayId}?`);

    if (confirmation) {
        // Add removal animation
        activityItem.classList.add('removing');

        // Wait for animation to complete before actual removal
        setTimeout(() => {
            activityList.removeChild(activityItem);

            // Show feedback notification
            showNotification(`"${attraction.name}" removed from Day ${dayId}`);

            // Update counters and UI state
            updateActivityCounter();
            updateSaveButtonState();
        }, 300); // Match with CSS animation duration
    }
}

// New function to display notification
function showNotification(message) {
    // Create notification element if it doesn't exist
    if (!document.getElementById('notification')) {
        const notification = document.createElement('div');
        notification.id = 'notification';
        notification.style.position = 'fixed';
        notification.style.bottom = '20px';
        notification.style.right = '20px';
        notification.style.padding = '10px 20px';
        notification.style.backgroundColor = '#4CAF50';
        notification.style.color = 'white';
        notification.style.borderRadius = '4px';
        notification.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        notification.style.zIndex = '1000';
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';

        document.body.appendChild(notification);
    }

    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.opacity = '1';

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
    }, 3000);
}

function saveTripToDatabase() {
    try {
        // Get trip details from session storage and page elements
        const startCity = sessionStorage.getItem('planning_destination') || 'Unknown City';
        const endCity = startCity; // Default to same city, can be updated if multi-city trip

        // Parse duration text to get number of days
        const durationText = document.getElementById('summary-duration')?.textContent || '';
        const durationMatch = durationText.match(/(\d+)/);
        const duration = durationMatch ? parseInt(durationMatch[1]) : 0;

        // Extract start date from either days option or date range option
        let startDate;
        const activeOption = document.querySelector('.duration-option.active');
        if (activeOption) {
            const optionType = activeOption.getAttribute('data-option');
            if (optionType === 'days') {
                startDate = parseInputDate(document.getElementById('days-start-date').value);
            } else {
                startDate = parseInputDate(document.getElementById('start-date').value);
            }
            // Format date as ISO string (YYYY-MM-DD)
            startDate = startDate.toISOString().split('T')[0];
        } else {
            startDate = new Date().toISOString().split('T')[0]; // Default to today
        }

        // Create the main trip object
        const trip = {
            user_id: sessionStorage.getItem('userEmail') || localStorage.getItem('userEmail'), // Would be UUID in real implementation
            start_city: startCity,
            end_city: endCity,
            duration: duration,
            status: 'Planning', // Default status for new trips
            start_date: startDate
        };

        // Collect all locations from activities
        const locations = [];
        const locationMap = new Map(); // To track already added locations

        // Collect everyday data for each day
        const everyday = [];

        // Collect relationships between days and locations
        const everydayLocations = [];

        // Process each day in the itinerary
        for (let day = 1; day <= duration; day++) {
            const dayContent = document.getElementById(`day-${day}`);
            if (!dayContent) continue;

            // Create an everyday entry for this day
            const everydayEntry = {
                id: `day-${day}-${Date.now()}`, // Temporary ID, would be UUID in real implementation 
                trip_id: null, // Will be set after trip is created
                current_city: startCity, // Default to trip's city
                day_number: day,
                start_location: null // Optional, can be updated if needed
            };
            everyday.push(everydayEntry);

            // Process activities for this day
            const activityItems = dayContent.querySelectorAll('.activity-item');
            activityItems.forEach((item, index) => {
                const name = item.querySelector('h4')?.textContent || 'Unnamed Activity';
                // In a real app, we'd have more complete address info
                const address = `${name} Address, ${startCity}`;
                const attractionId = item.getAttribute('data-attraction-id');

                // Create or reuse location
                let locationId;
                if (attractionId && locationMap.has(attractionId)) {
                    // Reuse existing location
                    locationId = locationMap.get(attractionId);
                } else {
                    // Create new location
                    locationId = `loc-${attractionId || name.replace(/\s+/g, '-')}-${Date.now()}`; // Temporary ID
                    locationMap.set(attractionId || name, locationId);

                    locations.push({
                        id: locationId,
                        name: name,
                        address: address
                    });
                }

                // Create everyday_locations mapping
                everydayLocations.push({
                    id: `map-${day}-${index}-${Date.now()}`, // Temporary ID
                    everyday_id: everydayEntry.id,
                    location_id: locationId
                });
            });
        }

        // Prepare the complete data package to send to backend
        const tripData = {
            trip: trip,
            locations: locations,
            everyday: everyday,
            everyday_locations: everydayLocations
        };

        console.log('Saving trip data:', tripData);



        // Show loading indicator
        showLoading("Saving your trip...");

        // Make the actual API call to save the trip
        saveTripToAPI(tripData)
            .then(response => {
                hideLoading();
                console.log('Trip saved successfully:', response);
                alert('Trip saved successfully!');
                window.location.href = '../dashboard/dashboard.html';
            })
            .catch(error => {
                hideLoading();
                console.error('Error saving trip:', error);
                alert('An error occurred while saving your trip. Please try again.');
            });
    } catch (error) {
        hideLoading();
        console.error('Error preparing trip data:', error);
        alert('An error occurred while saving your trip. Please try again.');
    }
}

// Helper function to get auth token (you might already have this elsewhere)
function getAuthToken() {
    // Get token from localStorage or sessionStorage
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken') || '';
}

// Function to save trip data to the API
function saveTripToAPI(tripData) {
    return fetch('https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify(tripData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Failed to save trip');
            }
            return response.json();
        });
}

// Add loading indicator functions (similar to dashboard.js)
function showLoading(message = "Loading...") {
    // Create loading overlay if it doesn't exist
    if (!document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.zIndex = '9999';

        overlay.innerHTML = `
            <div style="background-color: white; padding: 20px; border-radius: 5px; text-align: center;">
                <div class="loading-spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 2s linear infinite; margin: 0 auto;"></div>
                <div class="loading-message" style="margin-top: 10px;">${message}</div>
            </div>
        `;

        // Add the keyframe animation for the spinner
        const style = document.createElement('style');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(overlay);
    } else {
        document.querySelector('#loading-overlay .loading-message').textContent = message;
        document.getElementById('loading-overlay').style.display = 'flex';
    }
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Helper function for formatting dates
function formatDate(date) {
    // Ensure the date displays correctly by adjusting for timezone
    // Clone the date to avoid modifying the original
    const adjustedDate = new Date(date);
    
    // Format the date
    const options = { month: 'short', day: 'numeric' };
    return adjustedDate.toLocaleDateString('en-US', options);
}

// Function to ensure dates are handled consistently
function parseInputDate(dateString) {
    // Create a date from the input value
    const parts = dateString.split('-');
    // JavaScript months are 0-based, so subtract 1 from the month
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date;
}

// Add a function to safely access elements
function safeQuerySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
        console.warn(`Element not found: ${selector}`);
    }
    return element;
}

// Helper function to debug sessionStorage
function debugSessionStorage() {
    console.log("Session Storage Contents:");
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        let value = sessionStorage.getItem(key);

        // Try to parse JSON if it looks like JSON
        if (value.startsWith('[') || value.startsWith('{')) {
            try {
                value = "JSON: " + value.substring(0, 50) + "...";
            } catch (e) {
                // If it's not valid JSON, just show as is
            }
        }

        console.log(`${key}: ${value}`);
    }
}

// Function to update the activity counter
function updateActivityCounter() {
    // Count all activities across all days
    const allActivities = document.querySelectorAll('.activity-item').length;
    const summaryActivities = document.getElementById('summary-activities');
    if (summaryActivities) {
        summaryActivities.textContent = allActivities;
    }
    
    // Also enable the save button if there are activities
    if (allActivities > 0) {
        const saveBtn = document.getElementById('save-trip-btn');
        if (saveBtn) {
            saveBtn.classList.remove('disabled');
            saveBtn.removeAttribute('title');
        }
    }
}

// Adding missing generateDayTabs function from explore.js
function generateDayTabs(days, startDate = null) {
    const tabsContainer = document.querySelector('.day-tabs');
    const contentContainer = document.querySelector('.day-content');

    if (!tabsContainer || !contentContainer) {
        console.error('Day tabs container or content container not found');
        return;
    }

    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    for (let i = 1; i <= days; i++) {
        // Create day tab
        const tab = document.createElement('div');
        tab.classList.add('day-tab');

        if (i === 1) {
            tab.classList.add('active');
        }

        tab.setAttribute('data-day', i);

        if (startDate) {
            const date = new Date(startDate);
            // Clone the date to avoid reference issues
            const dayDate = new Date(date);
            dayDate.setDate(date.getDate() + (i - 1));
            tab.innerHTML = `
                <span>Day ${i}</span>
                <small>${formatDate(dayDate)}</small>
            `;
        } else {
            tab.innerHTML = `<span>Day ${i}</span>`;
        }

        tabsContainer.appendChild(tab);

        // Create day content (initially hidden except for day 1)
        const content = document.createElement('div');
        content.classList.add('day-content-item');
        content.setAttribute('id', `day-${i}`);
        content.style.display = i === 1 ? 'block' : 'none';

        // Setup empty day content
        content.innerHTML = `
            <h3>Day ${i} - Activities</h3>
            <div class="empty-day-message">
                <i class="fas fa-info-circle"></i>
                <p>Drag attractions from the sidebar or click the "+" button on any attraction to add it to this day.</p>
            </div>
            <div class="activity-list">
                <div class="add-activity-btn">
                    <i class="fas fa-plus-circle"></i>
                    <span>Add Activity</span>
                </div>
            </div>
        `;

        // Make day content droppable for drag-and-drop
        content.addEventListener('dragover', function (e) {
            e.preventDefault();
            this.classList.add('dragover');
        });

        content.addEventListener('dragleave', function () {
            this.classList.remove('dragover');
        });

        content.addEventListener('drop', function (e) {
            e.preventDefault();
            this.classList.remove('dragover');

            // Get attraction ID as string without parseInt to support custom IDs
            const attractionId = e.dataTransfer.getData('text/plain');

            // Get the attraction from planningSelectedAttractions
            const attraction = window.planningSelectedAttractions.find(a =>
                a.id.toString() === attractionId
            );

            if (attraction) {
                addAttractionToDay(attraction, i);
            }
        });

        contentContainer.appendChild(content);
    }
}

// Function to show specific day content
function showDayContent(dayId) {
    const contentItems = document.querySelectorAll('.day-content-item');

    contentItems.forEach(item => {
        item.style.display = 'none';
    });

    const dayContent = document.getElementById(`day-${dayId}`);
    if (dayContent) {
        dayContent.style.display = 'block';
    }
}

// Add this new function to handle day tab navigation
function setupDayTabNavigation() {
    // Use event delegation to handle clicks on day tabs
    document.addEventListener('click', function (e) {
        // Check if clicked element or its parent is a day tab
        const dayTab = e.target.closest('.day-tab');
        if (!dayTab) return; // Not clicking on a day tab

        // Get all tabs and remove active class
        const tabs = document.querySelectorAll('.day-tab');
        tabs.forEach(tab => tab.classList.remove('active'));

        // Add active class to the clicked tab
        dayTab.classList.add('active');

        // Show the corresponding day content
        const dayId = dayTab.getAttribute('data-day');
        showDayContent(dayId);
    });
}

// Update this function to validate all attractions are added and handle mixed ID types
function updateSaveButtonState() {
    const saveBtn = document.querySelector('.btn-save-trip');
    if (!saveBtn) return;

    // Count activities to determine if save button should be enabled
    const hasActivities = document.querySelectorAll('.activity-item').length > 0;

    if (hasActivities) {
        saveBtn.classList.remove('disabled');
        saveBtn.disabled = false;
        saveBtn.title = "Save your trip";
    } else {
        saveBtn.classList.add('disabled');
        saveBtn.disabled = true;
        saveBtn.title = "Add attractions to your itinerary before saving";
    }
}

// Function to update the current date display
function updateCurrentDateDisplay() {
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        const now = new Date();
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        currentDateElement.textContent = now.toLocaleDateString('en-US', options);
    }
}

// Add this new function to handle custom destination addition with autocomplete
function addCustomDestination() {
    // Get the active day
    const activeDay = document.querySelector('.day-tab.active');
    if (!activeDay) {
        alert('Please select a day to add this destination to');
        return;
    }

    const dayId = activeDay.getAttribute('data-day');
    const dayContent = document.getElementById(`day-${dayId}`);
    if (!dayContent) {
        alert('Error: Could not find the selected day content');
        return;
    }

    // Get values from custom destination form
    const name = document.getElementById('custom-destination-name').value.trim();
    const description = document.getElementById('custom-destination-description').value.trim();

    if (!name) {
        alert('Please enter a name for your custom destination');
        return;
    }

    // Create a custom attraction object
    const customAttraction = {
        id: 'custom-' + Date.now(), // Generate a unique ID
        name: name,
        description: description || 'Custom destination'
    };

    // Add to the current day
    addAttractionToDay(customAttraction, dayId);

    // Reset the form fields
    document.getElementById('custom-destination-name').value = '';
    document.getElementById('custom-destination-description').value = 'Your custom destination';

    // Show confirmation
    showNotification(`${name} added to Day ${dayId}`);
}

// This function initializes the custom destination autocomplete
function initCustomDestinationAutocomplete() {
    console.log("Initializing custom destination autocomplete");

    // Add autocomplete suggestion box to the DOM
    const customDestName = document.getElementById('custom-destination-name');
    if (!customDestName) {
        console.error("Custom destination input not found");
        return;
    }

    // Check if Google Maps API is defined
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.log("Google Maps API not loaded yet, retrying in 1 second...");
        // Try again in 1 second
        setTimeout(initCustomDestinationAutocomplete, 1000);
        return;
    }

    console.log("Google Maps API loaded, setting up autocomplete");

    // Create suggestion dropdown container if it doesn't exist
    let suggestionsContainer = document.querySelector('.autocomplete-suggestions');
    if (!suggestionsContainer) {
        suggestionsContainer = document.createElement('div');
        suggestionsContainer.classList.add('autocomplete-suggestions');
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.width = customDestName.offsetWidth + 'px';
        suggestionsContainer.style.maxHeight = '200px';
        suggestionsContainer.style.overflowY = 'auto';
        suggestionsContainer.style.background = 'white';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.borderTop = 'none';
        suggestionsContainer.style.zIndex = '1000';
        suggestionsContainer.style.borderRadius = '0 0 4px 4px';
        suggestionsContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';

        // Append to document body instead of parent container for better positioning
        document.body.appendChild(suggestionsContainer);
    }

    // Store place details for later use
    let currentPlaceDetails = null;

    // Create autocomplete service
    const autocompleteService = new google.maps.places.AutocompleteService();
    const placesService = new google.maps.places.PlacesService(document.createElement('div'));

    // Debug - immediately try to get predictions to verify the API is working
    autocompleteService.getPlacePredictions({
        input: "New York",
        types: ['establishment'] // Only use one type at a time
    }, function (predictions, status) {
        console.log("Test prediction status:", status);
        console.log("Test predictions:", predictions?.length || 0);
    });

    // Handle input changes
    customDestName.addEventListener('input', function () {
        const query = this.value.trim();
        console.log("Input changed:", query);

        // Reset place details when input changes
        currentPlaceDetails = null;

        if (query.length > 2) {
            // Search for places matching the query
            console.log("Getting predictions for:", query);
            autocompleteService.getPlacePredictions({
                input: query,
                // Use only 'establishment' type which is the most general
                types: ['establishment']
            }, function (predictions, status) {
                console.log("Prediction status:", status);
                console.log("Predictions count:", predictions?.length || 0);
                displaySuggestions(predictions, status);
            });
        } else {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Display suggestions
    function displaySuggestions(predictions, status) {
        suggestionsContainer.innerHTML = '';

        if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
            console.log("No predictions or error:", status);
            suggestionsContainer.style.display = 'none';
            return;
        }

        console.log("Displaying", predictions.length, "suggestions");

        predictions.forEach(prediction => {
            const item = document.createElement('div');
            item.classList.add('suggestion-item');
            item.textContent = prediction.description;
            item.style.padding = '8px 12px';
            item.style.cursor = 'pointer';
            item.style.borderBottom = '1px solid #eee';

            // Hover effect
            item.addEventListener('mouseenter', function () {
                this.style.backgroundColor = '#f5f5f5';
            });

            item.addEventListener('mouseleave', function () {
                this.style.backgroundColor = 'white';
            });

            // Select suggestion
            item.addEventListener('click', function () {
                // Only store the name (location) and not the full description with address
                const locationName = prediction.structured_formatting ?
                    prediction.structured_formatting.main_text :
                    prediction.description.split(',')[0]; // Take just the first part before the comma

                customDestName.value = locationName;
                suggestionsContainer.style.display = 'none';

                // Get place details to have more information when creating the activity
                placesService.getDetails({
                    placeId: prediction.place_id,
                    fields: ['name', 'formatted_address', 'types']
                }, function (place, status) {
                    if (status === google.maps.places.PlacesServiceStatus.OK) {
                        // Store place details for later use, but we'll only use the name
                        currentPlaceDetails = {
                            name: place.name,
                            // Store address separately, but don't use it in the name
                            formatted_address: place.formatted_address,
                            types: place.types
                        };

                        // Auto-fill description with address if available
                        const description = document.getElementById('custom-destination-description');
                        if (description && place.formatted_address) {
                            description.value = place.formatted_address;
                        }
                    }
                });
            });

            suggestionsContainer.appendChild(item);
        });

        if (predictions.length > 0) {
            // Position the suggestions directly below the input
            const rect = customDestName.getBoundingClientRect();
            console.log("Input position:", rect.left, rect.bottom);
            suggestionsContainer.style.width = rect.width + 'px';
            suggestionsContainer.style.left = rect.left + window.scrollX + 'px';
            suggestionsContainer.style.top = rect.bottom + window.scrollY + 'px';
            suggestionsContainer.style.display = 'block';
        } else {
            suggestionsContainer.style.display = 'none';
        }
    }

    // Close suggestions when clicking outside
    document.addEventListener('click', function (e) {
        if (e.target !== customDestName && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Reposition suggestions on window resize
    window.addEventListener('resize', function () {
        if (suggestionsContainer.style.display !== 'none') {
            const rect = customDestName.getBoundingClientRect();
            suggestionsContainer.style.width = rect.width + 'px';
            suggestionsContainer.style.left = rect.left + window.scrollX + 'px';
            suggestionsContainer.style.top = rect.bottom + window.scrollY + 'px';
        }
    });

    // Handle keyboard navigation in the suggestions
    customDestName.addEventListener('keydown', function (e) {
        const items = suggestionsContainer.querySelectorAll('.suggestion-item');
        const activeItem = suggestionsContainer.querySelector('.suggestion-item.active');
        let activeIndex = -1;

        if (items.length === 0) return;

        // Find the current active item index
        if (activeItem) {
            activeIndex = Array.from(items).indexOf(activeItem);
        }

        // Handle arrow keys
        if (e.key === 'ArrowDown') {
            e.preventDefault();

            if (suggestionsContainer.style.display === 'none') {
                suggestionsContainer.style.display = 'block';
                activeIndex = -1;
            }

            // Remove active from current item
            if (activeItem) {
                activeItem.classList.remove('active');
                activeItem.style.backgroundColor = 'white';
            }

            // Set active to next item, or first if at end
            activeIndex = (activeIndex + 1) % items.length;
            items[activeIndex].classList.add('active');
            items[activeIndex].style.backgroundColor = '#f5f5f5';

            // Scroll into view if needed
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();

            // Remove active from current item
            if (activeItem) {
                activeItem.classList.remove('active');
                activeItem.style.backgroundColor = 'white';
            }

            // Set active to previous item, or last if at beginning
            activeIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
            items[activeIndex].classList.add('active');
            items[activeIndex].style.backgroundColor = '#f5f5f5';

            // Scroll into view if needed
            items[activeIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && activeItem) {
            e.preventDefault();
            activeItem.click();
        } else if (e.key === 'Escape') {
            suggestionsContainer.style.display = 'none';
        }
    });

    // Add event listener for the custom destination button - update to use place details
    const addCustomDestBtn = document.getElementById('add-custom-destination');
    if (addCustomDestBtn) {
        // Remove any existing event listeners
        const newBtn = addCustomDestBtn.cloneNode(true);
        addCustomDestBtn.parentNode.replaceChild(newBtn, addCustomDestBtn);

        newBtn.addEventListener('click', function () {
            const name = document.getElementById('custom-destination-name').value.trim();
            const description = document.getElementById('custom-destination-description').value.trim();

            if (!name) {
                alert('Please enter a name for your custom destination');
                return;
            }

            // Get active day
            const activeDay = document.querySelector('.day-tab.active');
            if (!activeDay) {
                alert('Please select a day to add this destination to');
                return;
            }

            const dayId = activeDay.getAttribute('data-day');

            // Create custom attraction with only the name from place details if available
            const customAttraction = {
                id: 'custom-' + Date.now(),
                // Only use the name, even if we have place details
                name: currentPlaceDetails?.name || name,
                // Store description separately
                description: description || (currentPlaceDetails?.formatted_address || 'Custom destination')
            };

            // Add to current day
            addAttractionToDay(customAttraction, dayId);

            // Reset form
            document.getElementById('custom-destination-name').value = '';
            document.getElementById('custom-destination-description').value = 'Your custom destination';
            currentPlaceDetails = null;

            // Hide suggestions
            suggestionsContainer.style.display = 'none';

            // Show confirmation
            showNotification(`${customAttraction.name} added to Day ${dayId}`);
        });
    }

    // Let the user know autocomplete is ready
    console.log("Custom destination autocomplete setup complete");
}
