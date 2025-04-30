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

    // Initialize date pickers with today's date
    const today = new Date();
    const endDate = new Date();
    endDate.setDate(today.getDate() + 3);

    const daysStartDate = document.getElementById('days-start-date');
    const startDate = document.getElementById('start-date');
    const endDateEl = document.getElementById('end-date');

    if (daysStartDate) daysStartDate.valueAsDate = today;
    if (startDate) startDate.valueAsDate = today;
    if (endDateEl) endDateEl.valueAsDate = endDate;

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

        // Set up duration selection
        initDurationControls();

        // Handle save trip button
        const saveBtn = document.querySelector('.btn-save-trip');
        if (saveBtn) {
            saveBtn.addEventListener('click', saveTripToDatabase);
        }
    } catch (error) {
        console.error('Error initializing planning UI:', error);
    }
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
            startDate = new Date(document.getElementById('days-start-date').value);

            if (isNaN(startDate.getTime())) {
                alert('Please select a valid start date');
                return;
            }

            duration = `${days} days (starting ${formatDate(startDate)})`;
            generateDayTabs(days, startDate);
        } else {
            startDate = new Date(document.getElementById('start-date').value);
            const endDate = new Date(document.getElementById('end-date').value);

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

        // Load selected attractions from sessionStorage
        const attractionIds = JSON.parse(sessionStorage.getItem('planning_attractions') || '[]');
        populateSelectedAttractions(attractionIds);

        durationSection.style.display = 'none';
        itinerarySection.style.display = 'flex';
    });
}

function populateSelectedAttractions(attractionIds) {
    // First try to get attractions from sessionStorage
    let attractionsData;
    try {
        attractionsData = JSON.parse(sessionStorage.getItem('attractions_data') || '[]');
        console.log("Retrieved attractions data:", attractionsData);
    } catch (error) {
        console.error('Error parsing attractions data:', error);
        attractionsData = [];
    }

    // If we don't have attractions data in session storage, 
    // try to use the global nycAttractions if available
    if ((!attractionsData || !attractionsData.length) && typeof nycAttractions !== 'undefined') {
        console.log("Using nycAttractions from global scope");
        attractionsData = nycAttractions;
    }

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
                <button class="btn-text add-to-day-btn">
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

// Modified to handle missing attractionId more gracefully
function addAttractionToDay(attraction, dayId) {
    const dayContent = document.getElementById(`day-${dayId}`);
    if (!dayContent) return;

    const activityList = dayContent.querySelector('.activity-list');
    if (!activityList) return;

    // Check if attraction exists in our selected attractions
    if (!window.planningSelectedAttractions ||
        !window.planningSelectedAttractions.some(a => a.id === attraction.id)) {
        console.error('Attempted to add an attraction that was not pre-selected');
        return;
    }

    // Check if this attraction is already in this day
    const existingActivities = dayContent.querySelectorAll(`[data-attraction-id="${attraction.id}"]`);
    if (existingActivities.length > 0) {
        alert(`${attraction.name} is already in your Day ${dayId} itinerary`);
        return;
    }

    // Create a time for the activity
    const activitiesCount = activityList.querySelectorAll('.activity-item').length;
    let activityTime;

    // Start at 9:00 AM and add 2 hours for each existing activity
    const startHour = 9;
    const hoursToAdd = activitiesCount * 2;
    const hour = (startHour + hoursToAdd) % 12 || 12; // Convert 0 to 12
    const period = (startHour + hoursToAdd) < 12 ? 'AM' : 'PM';
    activityTime = `${hour}:00 ${period}`;

    const activityItem = document.createElement('div');
    activityItem.classList.add('activity-item');
    activityItem.setAttribute('data-attraction-id', attraction.id);

    activityItem.innerHTML = `
        <div class="activity-time">${activityTime}</div>
        <div class="activity-details">
            <h4>${attraction.name}</h4>
            <p>${attraction.description || ''}</p>
        </div>
        <div class="activity-actions">
            <button class="btn-text edit-time-btn"><i class="fas fa-clock"></i></button>
            <button class="btn-text remove-activity-btn"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    // Add before the "Add Activity" button
    const addButton = activityList.querySelector('.add-activity-btn');
    activityList.insertBefore(activityItem, addButton);

    // Add event listeners for edit and remove buttons
    const removeBtn = activityItem.querySelector('.remove-activity-btn');
    removeBtn.addEventListener('click', function () {
        if (confirm(`Remove ${attraction.name} from Day ${dayId}?`)) {
            activityList.removeChild(activityItem);
            updateActivityCounter();
            updateSaveButtonState(); // Add this line
        }
    });

    const editBtn = activityItem.querySelector('.edit-time-btn');
    editBtn.addEventListener('click', function () {
        const newTime = prompt('Enter new time (e.g., "10:30 AM"):', activityTime);
        if (newTime) {
            activityItem.querySelector('.activity-time').textContent = newTime;
        }
    });

    // Update the activity counter in the summary
    updateActivityCounter();
    updateSaveButtonState(); // Add this line
}

function saveTripToDatabase() {
    try {
        // Get all activities from the itinerary
        const activities = Array.from(document.querySelectorAll('.activity-item')).map(item => {
            const dayId = item.closest('.day-content-item').id.replace('day-', '');
            const time = item.querySelector('.activity-time')?.textContent || '12:00 PM';
            const name = item.querySelector('h4')?.textContent || 'Unnamed Activity';

            // Fix: Handle missing tag element by using the attraction type or a default
            let type = 'Attraction'; // Default type

            // Try to get type from the tag element (if it exists)
            const tagElement = item.querySelector('.tag');
            if (tagElement) {
                type = tagElement.textContent;
            } else {
                // If no tag element, check if it's a custom activity
                if (item.classList.contains('custom-activity')) {
                    type = 'Custom';
                }
            }

            return {
                day: parseInt(dayId),
                time: time,
                name: name,
                type: type,
                attractionId: item.getAttribute('data-attraction-id') || null
            };
        });

        // Get trip details
        const destination = sessionStorage.getItem('planning_destination') || 'Unknown Destination';
        const duration = document.getElementById('summary-duration')?.textContent || 'Unknown Duration';

        // Create trip object
        const trip = {
            destination: destination,
            duration: duration,
            activities: activities,
            createdAt: new Date().toISOString()
        };

        console.log('Saving trip:', trip);
        alert('Trip saved successfully! In a real app, this would be saved to the database.');

        // In a real app, you would send this to the server
        // For now, just redirect to dashboard
        window.location.href = '../dashboard/dashboard.html';
    } catch (error) {
        console.error('Error saving trip:', error);
        alert('An error occurred while saving your trip. Please try again.');
    }
}

// Helper function for formatting dates
function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
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
    const allActivities = document.querySelectorAll('.activity-item').length;
    const summaryActivities = document.getElementById('summary-activities');
    if (summaryActivities) {
        summaryActivities.textContent = allActivities;
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
            date.setDate(date.getDate() + (i - 1));
            tab.innerHTML = `
                <span>Day ${i}</span>
                <small>${formatDate(date)}</small>
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

            const attractionId = parseInt(e.dataTransfer.getData('text/plain'));

            // Get the attraction from planningSelectedAttractions instead of nycAttractions
            const attraction = window.planningSelectedAttractions.find(a => a.id === attractionId);

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

// Update this function to validate all attractions are added
function updateSaveButtonState() {
    const saveBtn = document.querySelector('.btn-save-trip');
    if (!saveBtn) return;

    // Check if all selected attractions have been added to the itinerary
    const selectedAttractionIds = window.planningSelectedAttractions?.map(a => a.id) || [];
    const addedActivityIds = Array.from(document.querySelectorAll('.activity-item'))
        .map(item => item.getAttribute('data-attraction-id'))
        .filter(id => id); // Filter out null/undefined

    // Check if every selected attraction has been added
    const allActivitiesAdded = selectedAttractionIds.every(id =>
        addedActivityIds.includes(id.toString()));
    const hasActivities = document.querySelectorAll('.activity-item').length > 0;

    if (allActivitiesAdded && hasActivities) {
        saveBtn.classList.remove('disabled');
        saveBtn.disabled = false;
        saveBtn.title = "Save your trip";
    } else {
        saveBtn.classList.add('disabled');
        saveBtn.disabled = true;
        saveBtn.title = "Add all selected attractions to your itinerary before saving";
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
