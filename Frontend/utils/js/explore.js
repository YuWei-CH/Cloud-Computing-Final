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

    // Preload attractions data so it's ready when needed
    fetchAttractionsData();
});

// Global variable to store attractions data
let attractionsData = [];

// Function to fetch attractions from API
async function fetchAttractionsData() {
    try {
        // Show loading state
        const cardContainer = document.querySelector('.recommendation-cards');
        if (cardContainer) {
            cardContainer.innerHTML = `
                <div class="loading-attractions">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Loading attractions...</p>
                </div>
            `;
        }

        console.log("Fetching attractions data from API...");

        // Get location from input without fallback
        const destinationInput = document.getElementById('destination-input');
        let location = destinationInput ? destinationInput.value.trim() : "";

        // If no location is provided, show a message and return early
        if (!location) {
            console.log("No location provided for API call");
            if (cardContainer) {
                cardContainer.innerHTML = `
                    <div class="error-message" style="grid-column: 1/-1; text-align: center; padding: 20px;">
                        <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 24px;"></i>
                        <p>Please enter a destination to see attractions</p>
                    </div>
                `;
            }
            attractionsData = [];
            return;
        }

        // Process the location to extract just the city name (remove state and country)
        location = extractCityName(location);
        console.log("Using location for API call:", location);

        // Get user preferences from storage or use defaults
        const preferences = getUserPreferences();

        // Build the API URL with query parameters
        const queryParams = new URLSearchParams({
            location: location,
            weather: preferences.weather,
            environment: preferences.environment,
            activity: preferences.activity
        });

        const apiUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/recommendation?${queryParams}`;
        console.log("Calling API:", apiUrl);

        // Simple direct fetch call without fallback
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API request failed with status ${response.status}`);
        }

        const data = await response.json();
        console.log("Raw API response:", data);

        // More robust parsing of API response
        let places = [];

        // Check different possible response formats
        if (data.body) {
            // Parse the body if it's a string
            const bodyData = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;

            // Now check if bodyData has a places property
            if (bodyData && bodyData.places) {
                places = bodyData.places;
            } else if (Array.isArray(bodyData)) {
                // If bodyData is directly an array
                places = bodyData;
            }
        } else if (data.places) {
            // Direct places property in response
            places = data.places;
        } else if (Array.isArray(data)) {
            // If the response itself is an array
            places = data;
        }

        console.log("Places from API:", places);

        // Transform the data to match our expected format
        attractionsData = places.map((place, index) => ({
            id: index + 1, // Generate sequential IDs
            name: place.name || 'Unknown Attraction',
            description: place.description || 'No description available',
            address: place.address || '' // Keep address in case we want to use it
        }));

        console.log("Processed attractions data:", attractionsData);

        // If recommendation cards are already visible, reload them with the new data
        const recommendationsSection = document.querySelector('.recommendations-section');
        if (recommendationsSection && recommendationsSection.style.display !== 'none') {
            loadRecommendationCards();
        }

        // Store in session storage for other pages to use
        sessionStorage.setItem('attractions_data', JSON.stringify(attractionsData));

    } catch (error) {
        console.error("Error fetching attractions data:", error);

        // Show more specific error message
        const cardContainer = document.querySelector('.recommendation-cards');
        if (cardContainer) {
            cardContainer.innerHTML = `
                <div class="error-message" style="grid-column: 1/-1; text-align: center; padding: 20px;">
                    <i class="fas fa-exclamation-triangle" style="color: #e74c3c; font-size: 24px;"></i>
                    <p>Sorry, we couldn't load attractions at this time. Please try again later.</p>
                    <p style="font-size: 12px; color: #777; margin-top: 10px;">Error details: ${error.message}</p>
                    <button id="retry-fetch" class="btn-secondary" style="margin-top: 15px;">Try Again</button>
                </div>
            `;

            // Add event listener to retry button
            const retryButton = document.getElementById('retry-fetch');
            if (retryButton) {
                retryButton.addEventListener('click', () => fetchAttractionsData());
            }
        }

        // Set empty attractions array
        attractionsData = [];
        sessionStorage.setItem('attractions_data', JSON.stringify(attractionsData));
    }
}

// Helper function to extract just the city name from a full location string
function extractCityName(location) {
    // If location is empty, return empty string (we've removed the fallback)
    if (!location) return "";

    // Extract the first part (city name) from addresses like "Miami, FL, USA"
    const parts = location.split(',');
    if (parts.length > 0) {
        // Return just the city name with a comma
        return parts[0].trim() + ',';
    }

    // If no commas found, just return the input with a comma
    return location.trim() + ',';
}

// Helper function to get user preferences
function getUserPreferences() {
    // Try to get preferences from localStorage (saved in settings)
    const weather = localStorage.getItem('weather') || 'warm';
    const environment = localStorage.getItem('environment') || 'city';
    const activity = localStorage.getItem('activity') || 'relaxing';

    console.log("Using preferences:", { weather, environment, activity });

    return { weather, environment, activity };
}

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

        // Store the destination in session storage for planning
        sessionStorage.setItem('planning_destination', destination);

        // Load recommendations for the selected destination
        fetchAttractionsData(); // This will also call loadRecommendationCards when data is ready
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
        sessionStorage.setItem('attractions_data', JSON.stringify(attractionsData));

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
        // Add autocomplete suggestion box to the DOM
        const customDestName = document.getElementById('custom-destination-name');
        const customDestInput = customDestName.parentElement;

        // Create suggestion dropdown container
        const suggestionsContainer = document.createElement('div');
        suggestionsContainer.classList.add('autocomplete-suggestions');
        suggestionsContainer.style.display = 'none';
        suggestionsContainer.style.position = 'absolute';
        suggestionsContainer.style.width = '100%';
        suggestionsContainer.style.maxHeight = '200px';
        suggestionsContainer.style.overflowY = 'auto';
        suggestionsContainer.style.background = 'white';
        suggestionsContainer.style.border = '1px solid #ccc';
        suggestionsContainer.style.borderTop = 'none';
        suggestionsContainer.style.zIndex = '1000';
        suggestionsContainer.style.borderRadius = '0 0 4px 4px';
        suggestionsContainer.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';

        customDestInput.style.position = 'relative';
        customDestInput.appendChild(suggestionsContainer);

        // Variable to store the current place details - defined outside the Google API check
        let currentPlaceDetails = null;

        // Initialize Google Places Autocomplete if Google Maps API is available
        if (typeof google !== 'undefined' && google.maps && google.maps.places) {
            // Create autocomplete service
            const autocompleteService = new google.maps.places.AutocompleteService();
            const placesService = new google.maps.places.PlacesService(document.createElement('div'));

            // Handle input changes
            customDestName.addEventListener('input', function () {
                const query = this.value.trim();

                // Reset place details when input changes
                currentPlaceDetails = null;

                if (query.length > 2) {
                    // Search for places matching the query
                    autocompleteService.getPlacePredictions({
                        input: query,
                        types: ['establishment', 'tourist_attraction', 'point_of_interest']
                    }, displaySuggestions);
                } else {
                    suggestionsContainer.style.display = 'none';
                }
            });

            // Display suggestions
            function displaySuggestions(predictions, status) {
                suggestionsContainer.innerHTML = '';

                if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) {
                    suggestionsContainer.style.display = 'none';
                    return;
                }

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
                        customDestName.value = prediction.description;
                        suggestionsContainer.style.display = 'none';

                        // Get place details to have more information when creating the activity
                        placesService.getDetails({
                            placeId: prediction.place_id,
                            fields: ['name', 'formatted_address', 'types']
                        }, function (place, status) {
                            if (status === google.maps.places.PlacesServiceStatus.OK) {
                                // Store place details for later use
                                currentPlaceDetails = place;

                                // Auto-select activity type based on place type if possible
                                const placeType = getPlaceType(place.types);
                                const typeSelect = document.getElementById('custom-destination-type');
                                if (typeSelect && placeType) {
                                    const options = Array.from(typeSelect.options);
                                    const matchingOption = options.find(option =>
                                        option.value.toLowerCase() === placeType.toLowerCase());

                                    if (matchingOption) {
                                        typeSelect.value = matchingOption.value;
                                    }
                                }
                            }
                        });
                    });

                    suggestionsContainer.appendChild(item);
                });

                if (predictions.length > 0) {
                    suggestionsContainer.style.display = 'block';
                } else {
                    suggestionsContainer.style.display = 'none';
                }
            }

            // Map Google place types to activity types
            function getPlaceType(types) {
                if (types.includes('restaurant') || types.includes('food')) return 'food';
                if (types.includes('museum')) return 'culture';
                if (types.includes('park') || types.includes('natural_feature')) return 'nature';
                if (types.includes('amusement_park') || types.includes('aquarium')) return 'entertainment';
                if (types.includes('shopping_mall') || types.includes('store')) return 'shopping';
                return 'other';
            }

            // Close suggestions when clicking outside
            document.addEventListener('click', function (e) {
                if (!customDestInput.contains(e.target)) {
                    suggestionsContainer.style.display = 'none';
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
        }

        // Single click handler for the Add button - works with or without Google Maps API
        addCustomBtn.addEventListener('click', function () {
            const name = document.getElementById('custom-destination-name').value.trim();
            const type = document.getElementById('custom-destination-type').value;

            if (!name) {
                alert('Please enter an activity name');
                return;
            }

            // Get active day
            const activeDay = document.querySelector('.day-tab.active').getAttribute('data-day');

            // Add custom activity to that day with place details if available
            addCustomActivity(name, type, activeDay, currentPlaceDetails);

            // Clear form
            document.getElementById('custom-destination-name').value = '';
            currentPlaceDetails = null;

            // Hide suggestions
            suggestionsContainer.style.display = 'none';
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
        const attraction = attractionsData.find(a => a.id === attractionId);

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
function addCustomActivity(name, type, dayId, placeDetails) {
    const dayContent = document.getElementById(`day-${dayId}`);
    const activityList = dayContent.querySelector('.activity-list');

    // Get the date for this day from the day tab
    const dayTab = document.querySelector(`.day-tab[data-day="${dayId}"]`);
    let dateText = dayTab ? dayTab.querySelector('small').textContent : `Day ${dayId}`;

    const activityItem = document.createElement('div');
    activityItem.classList.add('activity-item', 'custom-activity');

    // Create description text based on available information
    let description = 'Custom activity added by you';
    if (placeDetails && placeDetails.formatted_address) {
        description = placeDetails.formatted_address;
    }

    activityItem.innerHTML = `
        <div class="activity-date">${dateText}</div>
        <div class="activity-details">
            <h4>${name}</h4>
            <p>${description}</p>
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
            const attraction = attractionsData.find(a => a.id === attractionId);

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

    // Clear any existing cards
    cardContainer.innerHTML = '';

    // Show loading state if we don't have data yet
    if (attractionsData.length === 0) {
        cardContainer.innerHTML = `
            <div class="loading-attractions">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Loading attractions...</p>
            </div>
        `;
        return;
    }

    // Limit attractions to 9 results maximum
    const limitedAttractions = attractionsData.slice(0, 9);

    // Get current destination for fallback address
    let currentDestination = "Unknown Location";
    const destinationTag = document.querySelector('.destination-tag');
    if (destinationTag) {
        currentDestination = destinationTag.textContent.trim();
    } else {
        // Try to get from session storage if not in UI
        const storedDestination = sessionStorage.getItem('planning_destination');
        if (storedDestination) {
            currentDestination = storedDestination;
        }
    }

    // Create cards for attractions (limited to 9)
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
                    <span>${attraction.address || currentDestination}</span>
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

// Function to update the activity counter in the summary
function updateActivityCounter() {
    const activities = document.querySelectorAll('.activity-item');
    const counter = document.getElementById('summary-activities');

    if (counter) {
        counter.textContent = activities.length;
    }
}
