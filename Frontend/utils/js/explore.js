document.addEventListener('DOMContentLoaded', function () {
    // Check authentication before loading page content
    const token = checkAuthentication();
    if (!token) {
        // This redirect should not happen since checkAuthentication already redirects
        return;
    }

    // Display current date
    updateCurrentDateDisplay();

    // Only initialize basic UI elements that don't depend on Google Maps API
    initViewToggle();
    initTripDurationSelection();
    initItineraryBuilder();
});

// This function will be called by the Google Maps API callback
window.initExploreApp = function () {
    // Check if we're on the explore page (not planning page)
    const isExplorePage = document.getElementById('destination-input') !== null;

    if (isExplorePage) {
        // Initialize components that depend on Google Maps API
        initDestinationInput();
    }
};

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

// NYC attractions data (simulated backend data)
const nycAttractions = [
    {
        id: 1,
        name: 'Empire State Building',
        description: 'Iconic 102-story landmark with an observation deck offering panoramic NYC views.'
    },
    {
        id: 2,
        name: 'Central Park',
        description: 'Sprawling park with paths, lakes, and recreational facilities.'
    },
    {
        id: 3,
        name: 'Metropolitan Museum of Art',
        description: 'World-renowned art museum with vast collection spanning 5,000 years.'
    },
    {
        id: 4,
        name: 'Statue of Liberty',
        description: 'Iconic copper statue on Liberty Island symbolizing freedom and democracy.'
    },
    {
        id: 5,
        name: 'Brooklyn Bridge',
        description: 'Historic bridge connecting Manhattan and Brooklyn with pedestrian walkway.'
    },
    {
        id: 6,
        name: 'Times Square',
        description: 'Bustling commercial intersection known for bright lights and Broadway theaters.'
    },
    {
        id: 7,
        name: 'Museum of Modern Art (MoMA)',
        description: 'Leading modern art museum with famous works by Van Gogh, Picasso, and more.'
    },
    {
        id: 8,
        name: 'High Line',
        description: 'Elevated linear park built on a former railroad track with gardens and art.'
    },
    {
        id: 9,
        name: 'One World Observatory',
        description: 'Observation deck atop One World Trade Center with 360° views of the city.'
    },
    {
        id: 10,
        name: 'Broadway Show',
        description: 'World-class theatrical performances in the Theater District.'
    }
];

// Destination Input and Autocomplete
function initDestinationInput() {
    const destinationInput = document.getElementById('destination-input');
    // Add null checks to prevent errors
    if (!destinationInput) return;

    // Add a check to ensure Google API is available
    if (typeof google === 'undefined' || !google.maps || !google.maps.places) {
        console.error('Google Maps API is not available');
        return;
    }

    const addDestinationBtn = document.getElementById('add-destination-btn');
    const selectedDestinations = document.getElementById('selected-destinations');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const recommendationsSection = document.querySelector('.recommendations-section');

    if (!addDestinationBtn || !selectedDestinations || !autocompleteResults || !recommendationsSection) {
        console.error('Missing required elements for destination input functionality');
        return;
    }

    // Initialize Google Places Autocomplete
    const autocomplete = new google.maps.places.Autocomplete(destinationInput, {
        types: ['(cities)'],
        componentRestrictions: { country: 'us' }
    });

    // Handle place selection
    autocomplete.addListener('place_changed', function () {
        const place = autocomplete.getPlace();
        if (!place.geometry) {
            console.log("No details available for input: '" + place.name + "'");
            return;
        }

        // Get the formatted address
        const destination = place.formatted_address;

        // Clear any previous selections
        selectedDestinations.innerHTML = '';

        // Add the new destination as the only selection
        addDestinationTag(destination);

        // Show recommendations section
        recommendationsSection.style.display = 'block';

        // Reset selected count
        document.getElementById('selected-count').textContent = '0';
    });

    // Get recommendations when button is clicked
    addDestinationBtn.addEventListener('click', function () {
        const value = destinationInput.value.trim();

        if (value) {
            // Clear any previous selections
            selectedDestinations.innerHTML = '';

            // Add the new destination as the only selection
            addDestinationTag(value);

            // Show recommendations section
            recommendationsSection.style.display = 'block';

            // Reset selected count
            document.getElementById('selected-count').textContent = '0';
        }
    });

    // Also get recommendations on Enter key
    destinationInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDestinationBtn.click();
        }
    });

    // Function to add destination tag
    function addDestinationTag(destination) {
        // Clear previous destination cards
        document.querySelector('.recommendation-cards').innerHTML = '';

        const tag = document.createElement('div');
        tag.classList.add('destination-tag');
        tag.innerHTML = `
            ${destination}
            <i class="fas fa-times"></i>
        `;

        // Remove tag when clicking the X
        tag.querySelector('i').addEventListener('click', function () {
            selectedDestinations.removeChild(tag);
            recommendationsSection.style.display = 'none';
        });

        selectedDestinations.appendChild(tag);

        // Load recommendations for the selected destination
        loadRecommendationCards();
    }
}

// View Toggle (Grid/List)
function initViewToggle() {
    const viewButtons = document.querySelectorAll('.view-toggle button');
    const recommendationCards = document.querySelector('.recommendation-cards');

    if (!viewButtons.length || !recommendationCards) return;

    viewButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            viewButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            this.classList.add('active');

            // Change view based on button data-view attribute
            const view = this.getAttribute('data-view');

            if (view === 'list') {
                recommendationCards.classList.add('list-view');
            } else {
                recommendationCards.classList.remove('list-view');
            }
        });
    });
}

// Trip Duration Selection
function initTripDurationSelection() {
    const createTripBtn = document.getElementById('create-trip-btn');
    if (!createTripBtn) return;

    const durationSection = document.getElementById('trip-duration-section');
    const recommendationsSection = document.querySelector('.recommendations-section');

    const durationOptions = document.querySelectorAll('.duration-option');
    const daysInput = document.getElementById('days-input');
    const datesInput = document.getElementById('dates-input');

    const durationBackBtn = document.getElementById('duration-back-btn');
    const durationNextBtn = document.getElementById('duration-next-btn');
    const itinerarySection = document.getElementById('itinerary-section');

    // Show duration section when Create Trip button is clicked
    createTripBtn.addEventListener('click', function () {
        // Store selected attractions in sessionStorage for the planning page
        const selectedCards = document.querySelectorAll('.recommendation-card.selected');
        const selectedIds = Array.from(selectedCards).map(card => card.getAttribute('data-id'));

        // Store the full attractions data as well
        sessionStorage.setItem('attractions_data', JSON.stringify(nycAttractions));

        // Store selected attractions IDs separately
        const destination = document.querySelector('.destination-tag').textContent.trim();
        sessionStorage.setItem('planning_destination', destination);
        sessionStorage.setItem('planning_attractions', JSON.stringify(selectedIds));

        // Store city information for the database schema
        sessionStorage.setItem('start_city', destination);
        sessionStorage.setItem('end_city', destination);

        // Check if any attractions are selected
        if (selectedIds.length === 0) {
            alert("Please select at least one attraction before planning your trip.");
            return;
        }

        // Navigate to planning page
        window.location.href = 'planning.html';
    });

    // Handle back button click in planning mode
    const backToRecsBtn = document.getElementById('back-to-recommendations');
    if (backToRecsBtn) {
        backToRecsBtn.addEventListener('click', function () {
            // Navigate back to explore page
            window.location.href = 'explore.html';
        });
    }

    // Show duration section when Create Trip button is clicked
    createTripBtn.addEventListener('click', function () {
        // Get selected attractions before moving to next step
        const selectedAttractions = document.querySelectorAll('.recommendation-card.selected');

        // Update summary destinations count (always 1 in single destination mode)
        document.getElementById('summary-destinations').textContent = '1';

        recommendationsSection.style.display = 'none';
        durationSection.style.display = 'block';

        // Set default dates (today and today + 3 days)
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 3);

        // Set both start date inputs (for days and date range options)
        document.getElementById('days-start-date').valueAsDate = today;
        document.getElementById('start-date').valueAsDate = today;
        document.getElementById('end-date').valueAsDate = endDate;
    });

    // Switch between duration selection methods
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

    // Go back to recommendations
    durationBackBtn.addEventListener('click', function () {
        durationSection.style.display = 'none';
        recommendationsSection.style.display = 'block';
    });

    // Continue to itinerary builder
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

            // Generate day tabs based on number of days and start date
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

            // Calculate number of days
            const dayDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
            days = Math.round(dayDiff) + 1;

            duration = `${days} days (${formatDate(startDate)} - ${formatDate(endDate)})`;

            // Generate day tabs based on date range
            generateDayTabs(days, startDate);
        }

        // Update summary
        document.getElementById('summary-duration').textContent = duration;

        // Count selected activities
        const selectedCount = document.querySelectorAll('.recommendation-card.selected').length;
        document.getElementById('summary-activities').textContent = selectedCount;

        // Populate selected attractions in the sidebar
        populateSelectedAttractions();

        // Switch to itinerary view
        durationSection.style.display = 'none';
        itinerarySection.style.display = 'flex';
    });
}

// Itinerary Builder
function initItineraryBuilder() {
    // Event delegation for day tabs
    document.addEventListener('click', function (e) {
        if (e.target.classList.contains('day-tab') || e.target.parentElement.classList.contains('day-tab')) {
            const dayTab = e.target.classList.contains('day-tab') ? e.target : e.target.parentElement;
            const tabs = document.querySelectorAll('.day-tab');
            const dayId = dayTab.getAttribute('data-day');

            // Remove active class from all tabs
            tabs.forEach(tab => tab.classList.remove('active'));

            // Add active class to clicked tab
            dayTab.classList.add('active');

            // Show corresponding day content
            showDayContent(dayId);
        }
    });

    // Handle adding custom destinations
    const addCustomBtn = document.getElementById('add-custom-destination');
    if (addCustomBtn) {
        addCustomBtn.addEventListener('click', function () {
            const name = document.getElementById('custom-destination-name').value.trim();
            const type = document.getElementById('custom-destination-type').value;

            if (!name) {
                alert('Please enter an activity name');
                return;
            }

            // Get active day
            const activeDay = document.querySelector('.day-tab.active').getAttribute('data-day');

            // Add custom activity to that day
            addCustomActivity(name, type, activeDay);

            // Clear form
            document.getElementById('custom-destination-name').value = '';
        });
    }

    // Initialize back button
    initBackButton();

    // Initially hide save button until activities are added
    const saveContainer = document.getElementById('save-trip-container');
    if (saveContainer) {
        saveContainer.style.display = 'none';
    }

    // Initialize save trip button
    const saveBtn = document.getElementById('save-trip-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', function () {
            saveTripToDatabase();
        });
    }
}

// Helper function to populate selected attractions in sidebar
function populateSelectedAttractions() {
    const container = document.getElementById('selected-attractions-list');
    container.innerHTML = '';

    // Get all selected attractions
    const selectedCards = document.querySelectorAll('.recommendation-card.selected');

    if (selectedCards.length === 0) {
        container.innerHTML = '<p class="no-attractions">No attractions selected</p>';
        return;
    }

    // Create a draggable list of selected attractions
    selectedCards.forEach(card => {
        const attractionId = parseInt(card.getAttribute('data-id'));
        const attraction = nycAttractions.find(a => a.id === attractionId);

        if (attraction) {
            const item = document.createElement('div');
            item.classList.add('sidebar-attraction-item');
            item.setAttribute('draggable', 'true');
            item.setAttribute('data-id', attraction.id);

            item.innerHTML = `
                <div class="attraction-item-content">
                    <span class="attraction-name">${attraction.name}</span>
                </div>
                <div class="attraction-actions">
                    <button class="btn-text remove-btn">
                        <i class="fas fa-times"></i>
                    </button>
                    <button class="btn-text add-to-day-btn">
                        <i class="fas fa-plus-circle"></i>
                    </button>
                </div>
            `;

            // Add event listener to remove this attraction completely
            const removeBtn = item.querySelector('.remove-btn');
            removeBtn.addEventListener('click', function () {
                // Remove this attraction from the selection
                removeSelectedAttraction(attraction.id);
                container.removeChild(item);
                updateSaveButtonState();

                // If no more attractions are selected, show message
                if (container.children.length === 0) {
                    container.innerHTML = '<p class="no-attractions">No attractions selected</p>';
                }
            });

            // Add event listener to the add button
            const addBtn = item.querySelector('.add-to-day-btn');
            addBtn.addEventListener('click', function () {
                // Get current active day
                const activeDay = document.querySelector('.day-tab.active').getAttribute('data-day');
                addAttractionToDay(attraction, activeDay);
            });

            // Setup drag events
            item.addEventListener('dragstart', function (e) {
                e.dataTransfer.setData('text/plain', attraction.id);
                this.classList.add('dragging');
            });

            item.addEventListener('dragend', function () {
                this.classList.remove('dragging');
            });

            container.appendChild(item);
        }
    });

    // Initialize tracking for save button state
    initSaveButtonTracking();
}

// Function to remove a selected attraction
function removeSelectedAttraction(attractionId) {
    // Find any activities containing this attraction and remove them
    const activities = document.querySelectorAll(`[data-attraction-id="${attractionId}"]`);
    activities.forEach(activity => {
        activity.parentNode.removeChild(activity);
    });

    // Update activity counter
    updateActivityCounter();

    // Also unselect it in the recommendations view (if we go back)
    const recommendationCard = document.querySelector(`.recommendation-card[data-id="${attractionId}"]`);
    if (recommendationCard) {
        recommendationCard.classList.remove('selected');
        const selectBtn = recommendationCard.querySelector('.select-btn span');
        if (selectBtn) {
            selectBtn.textContent = 'Select';
        }
    }
}

// Track which attractions have been added to the itinerary
let addedAttractions = new Set();

// Initialize tracking for save button
function initSaveButtonTracking() {
    addedAttractions.clear();
}

// Function to add an attraction to a specific day
function addAttractionToDay(attraction, dayId) {
    const dayContent = document.getElementById(`day-${dayId}`);
    const activityList = dayContent.querySelector('.activity-list');

    // Check if this attraction is already in this day
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
            <button class="btn-text remove-activity-btn"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    // Add before the "Add Activity" button
    const addButton = activityList.querySelector('.add-activity-btn');
    activityList.insertBefore(activityItem, addButton);

    // Add event listener for remove button
    const removeBtn = activityItem.querySelector('.remove-activity-btn');
    removeBtn.addEventListener('click', function () {
        if (confirm(`Remove ${attraction.name} from Day ${dayId}?`)) {
            activityList.removeChild(activityItem);
            updateActivityCounter();
            checkShowSaveButton();
        }
    });

    // Update the activity counter in the summary
    updateActivityCounter();

    // Show save button when activities exist
    showSaveButton();

    // Mark this attraction as added to the itinerary
    addedAttractions.add(attraction.id);

    // Update save button state
    updateSaveButtonState();
}

// Function to add a custom activity to a day
function addCustomActivity(name, type, dayId) {
    const dayContent = document.getElementById(`day-${dayId}`);
    const activityList = dayContent.querySelector('.activity-list');

    // Get the date for this day from the day tab
    const dayTab = document.querySelector(`.day-tab[data-day="${dayId}"]`);
    let dateText = dayTab ? dayTab.querySelector('small').textContent : `Day ${dayId}`;

    const activityItem = document.createElement('div');
    activityItem.classList.add('activity-item', 'custom-activity');

    activityItem.innerHTML = `
        <div class="activity-date">${dateText}</div>
        <div class="activity-details">
            <h4>${name}</h4>
            <p>Custom activity added by you</p>
        </div>
        <div class="activity-actions">
            <button class="btn-text remove-activity-btn"><i class="fas fa-trash-alt"></i></button>
        </div>
    `;

    // Add before the "Add Activity" button
    const addButton = activityList.querySelector('.add-activity-btn');
    activityList.insertBefore(activityItem, addButton);

    // Add event listener for remove button
    const removeBtn = activityItem.querySelector('.remove-activity-btn');
    removeBtn.addEventListener('click', function () {
        if (confirm(`Remove ${name} from Day ${dayId}?`)) {
            activityList.removeChild(activityItem);
            updateActivityCounter();
            checkShowSaveButton();
        }
    });

    // Update the activity counter in the summary
    updateActivityCounter();

    // Show save button when activities exist
    showSaveButton();
}

// Function to show the save button
function showSaveButton() {
    const saveContainer = document.getElementById('save-trip-container');
    if (saveContainer) {
        saveContainer.style.display = 'flex';
        updateSaveButtonState();
    }
}

// Function to check if all selected attractions have been added
function updateSaveButtonState() {
    const saveBtn = document.getElementById('save-trip-btn');
    const selectedCards = document.querySelectorAll('.recommendation-card.selected');
    const selectedAttractionIds = Array.from(selectedCards).map(card => parseInt(card.getAttribute('data-id')));

    // Check if there are activities and if all selected attractions have been added
    const allActivitiesAdded = selectedAttractionIds.every(id => addedAttractions.has(id));
    const hasActivities = document.querySelectorAll('.activity-item').length > 0;

    if (saveBtn) {
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

    // Also check if we need to show or hide the save button
    checkShowSaveButton();
}

// Function to check if save button should be shown or hidden
function checkShowSaveButton() {
    const activityItems = document.querySelectorAll('.activity-item');
    const saveContainer = document.getElementById('save-trip-container');

    if (saveContainer) {
        if (activityItems.length > 0) {
            saveContainer.style.display = 'flex';
        } else {
            saveContainer.style.display = 'none';
            // Also clear the added attractions tracking
            addedAttractions.clear();
        }
    }
}

function generateDayTabs(days, startDate = null) {
    const tabsContainer = document.querySelector('.day-tabs');
    const contentContainer = document.querySelector('.day-content');

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
            const attraction = nycAttractions.find(a => a.id === attractionId);

            if (attraction) {
                addAttractionToDay(attraction, i);
            }
        });

        contentContainer.appendChild(content);
    }
}

// Helper Functions
function loadRecommendationCards() {
    const cardContainer = document.querySelector('.recommendation-cards');
    const selectedCount = document.getElementById('selected-count');
    let selectionCounter = 0;

    // Limit attractions to 9 results maximum
    const limitedAttractions = nycAttractions.slice(0, 9);

    // Create cards for NYC attractions (limited to 9)
    limitedAttractions.forEach(attraction => {
        const card = document.createElement('div');
        card.classList.add('recommendation-card');
        card.setAttribute('data-id', attraction.id);

        card.innerHTML = `
            <div class="card-content">
                <h3 class="card-title">${attraction.name}</h3>
                <p class="card-description">${attraction.description}</p>
                <div class="card-info">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>New York City, USA</span>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn-text select-btn">
                    <span>Select</span>
                </button>
            </div>
        `;

        // Add click handler for the whole card to toggle selection
        card.addEventListener('click', function () {
            this.classList.toggle('selected');

            // Update the button text based on selection state
            const selectBtn = this.querySelector('.select-btn span');
            if (this.classList.contains('selected')) {
                selectBtn.textContent = 'Selected';
                selectionCounter++;
            } else {
                selectBtn.textContent = 'Select';
                selectionCounter--;
            }

            // Update selection counter display
            selectedCount.textContent = selectionCounter;
        });

        cardContainer.appendChild(card);
    });
}

function showDayContent(dayId) {
    const contentItems = document.querySelectorAll('.day-content-item');

    contentItems.forEach(item => {
        item.style.display = 'none';
    });

    document.getElementById(`day-${dayId}`).style.display = 'block';
}

function formatDate(date) {
    const options = { month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

// Initialize back to recommendations button
function initBackButton() {
    const backBtn = document.getElementById('back-to-recommendations');
    if (backBtn) {
        backBtn.addEventListener('click', function () {
            // Go back to recommendations section
            document.getElementById('itinerary-section').style.display = 'none';
            document.getElementById('trip-duration-section').style.display = 'none';
            document.querySelector('.recommendations-section').style.display = 'block';
        });
    }
}

// Dummy function for saving trip to database - no longer needed as it's moved to planning.js
function saveTripToDatabase() {
    // This is now handled in planning.js with the new database structure
    console.log('This function has been moved to planning.js to match the new database schema');
}
