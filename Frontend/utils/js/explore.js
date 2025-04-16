document.addEventListener('DOMContentLoaded', function () {
    // Check authentication before loading page content
    const token = checkAuthentication();
    if (!token) {
        // This redirect should not happen since checkAuthentication already redirects
        return;
    }

    // Initialize page elements and event listeners
    initDestinationInput();
    initViewToggle();
    initTripDurationSelection();
    initItineraryBuilder();

    // Load sample data for demonstration
    loadSampleDestinations();
});

// Authentication check function
function checkAuthentication() {
    // Check localStorage first (for remembered users)
    let token = localStorage.getItem('userToken');

    // If not in localStorage, check sessionStorage
    if (!token) {
        token = sessionStorage.getItem('userToken');
    }

    if (!token) {
        // No token found, redirect to login
        console.log("No authentication token found, redirecting to login");
        window.location.href = '../login/login.html';
        return null;
    }

    return token;
}

// Destination Input and Autocomplete
function initDestinationInput() {
    const destinationInput = document.getElementById('destination-input');
    const addDestinationBtn = document.getElementById('add-destination-btn');
    const selectedDestinations = document.getElementById('selected-destinations');
    const autocompleteResults = document.getElementById('autocomplete-results');
    const recommendationsSection = document.querySelector('.recommendations-section');

    // Sample destinations for autocomplete
    const destinations = [
        'New York, USA', 'Paris, France', 'Tokyo, Japan', 'London, UK',
        'Rome, Italy', 'Sydney, Australia', 'Barcelona, Spain', 'Dubai, UAE',
        'Singapore', 'Hong Kong', 'Bangkok, Thailand', 'Vancouver, Canada',
        'Amsterdam, Netherlands', 'Berlin, Germany', 'Istanbul, Turkey'
    ];

    // Show autocomplete results on input
    destinationInput.addEventListener('input', function () {
        const value = this.value.trim();

        // Clear previous results
        autocompleteResults.innerHTML = '';

        if (value.length < 2) {
            autocompleteResults.style.display = 'none';
            return;
        }

        // Filter destinations based on input
        const filteredDestinations = destinations.filter(destination =>
            destination.toLowerCase().includes(value.toLowerCase())
        );

        if (filteredDestinations.length > 0) {
            autocompleteResults.style.display = 'block';

            filteredDestinations.forEach(destination => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item');
                item.textContent = destination;

                item.addEventListener('click', function () {
                    destinationInput.value = destination;
                    autocompleteResults.style.display = 'none';
                });

                autocompleteResults.appendChild(item);
            });
        } else {
            autocompleteResults.style.display = 'none';
        }
    });

    // Hide autocomplete when clicking outside
    document.addEventListener('click', function (e) {
        if (e.target !== destinationInput && e.target !== autocompleteResults) {
            autocompleteResults.style.display = 'none';
        }
    });

    // Add destination tag when button is clicked
    addDestinationBtn.addEventListener('click', function () {
        const value = destinationInput.value.trim();

        if (value) {
            addDestinationTag(value);
            destinationInput.value = '';

            // Show recommendations section when at least one destination is added
            if (selectedDestinations.children.length > 0) {
                recommendationsSection.style.display = 'block';
            }
        }
    });

    // Also add destination on Enter key
    destinationInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addDestinationBtn.click();
        }
    });

    // Function to add destination tag
    function addDestinationTag(destination) {
        // Check if this destination already exists
        const existingTags = Array.from(selectedDestinations.children).map(tag =>
            tag.textContent.trim().replace('×', '').trim()
        );

        if (existingTags.includes(destination)) {
            return;
        }

        const tag = document.createElement('div');
        tag.classList.add('destination-tag');
        tag.innerHTML = `
            ${destination}
            <i class="fas fa-times"></i>
        `;

        // Remove tag when clicking the X
        tag.querySelector('i').addEventListener('click', function () {
            selectedDestinations.removeChild(tag);

            // Hide recommendations if no destinations are selected
            if (selectedDestinations.children.length === 0) {
                recommendationsSection.style.display = 'none';
            }
        });

        selectedDestinations.appendChild(tag);

        // Load recommendation cards for the new destination
        loadRecommendationCards(destination);
    }
}

// View Toggle (Grid/List)
function initViewToggle() {
    const viewButtons = document.querySelectorAll('.view-toggle button');
    const recommendationCards = document.querySelector('.recommendation-cards');

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
        recommendationsSection.style.display = 'none';
        durationSection.style.display = 'block';

        // Set default dates (today and today + 3 days)
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 3);

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

        if (optionType === 'days') {
            const days = document.getElementById('number-of-days').value;
            duration = `${days} days`;

            // Generate day tabs based on number of days
            generateDayTabs(parseInt(days));
        } else {
            const startDate = new Date(document.getElementById('start-date').value);
            const endDate = new Date(document.getElementById('end-date').value);

            if (startDate > endDate) {
                alert('End date must be after start date');
                return;
            }

            // Calculate number of days
            const dayDiff = (endDate - startDate) / (1000 * 60 * 60 * 24);
            const days = Math.round(dayDiff) + 1;

            duration = `${days} days (${formatDate(startDate)} - ${formatDate(endDate)})`;

            // Generate day tabs based on date range
            generateDayTabs(days, startDate);
        }

        // Update summary
        document.getElementById('summary-duration').textContent = duration;
        document.getElementById('summary-activities').textContent = '0';
        document.getElementById('summary-destinations').textContent =
            document.getElementById('selected-destinations').children.length;

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
}

// Helper Functions
function loadSampleDestinations() {
    // Add sample destinations for demonstration
    const sampleDestinations = ['Paris, France', 'Amsterdam, Netherlands'];
    const selectedDestinations = document.getElementById('selected-destinations');
    const recommendationsSection = document.querySelector('.recommendations-section');

    sampleDestinations.forEach(destination => {
        const tag = document.createElement('div');
        tag.classList.add('destination-tag');
        tag.innerHTML = `
            ${destination}
            <i class="fas fa-times"></i>
        `;

        // Remove tag when clicking the X
        tag.querySelector('i').addEventListener('click', function () {
            selectedDestinations.removeChild(tag);

            // Hide recommendations if no destinations are selected
            if (selectedDestinations.children.length === 0) {
                recommendationsSection.style.display = 'none';
            }
        });

        selectedDestinations.appendChild(tag);

        // Load recommendation cards
        loadRecommendationCards(destination);
    });

    // Show recommendations section
    recommendationsSection.style.display = 'block';
}

function loadRecommendationCards(destination) {
    // In a real app, you would fetch recommendations from an API
    // Here we'll generate sample cards based on the destination

    const cardContainer = document.querySelector('.recommendation-cards');

    // Sample attractions based on destination
    let attractions = [];

    if (destination.includes('Paris')) {
        attractions = [
            {
                name: 'Eiffel Tower',
                image: 'https://via.placeholder.com/400x300?text=Eiffel+Tower',
                description: 'Iconic iron tower offering city views from observation decks.',
                rating: 4.7,
                highlights: ['Panoramic View', 'Iconic Landmark'],
                type: 'Landmark'
            },
            {
                name: 'Louvre Museum',
                image: 'https://via.placeholder.com/400x300?text=Louvre+Museum',
                description: 'World\'s largest art museum and historic monument in Paris.',
                rating: 4.8,
                highlights: ['Mona Lisa', 'Ancient Artifacts'],
                type: 'Museum'
            },
            {
                name: 'Notre-Dame Cathedral',
                image: 'https://via.placeholder.com/400x300?text=Notre+Dame',
                description: 'Medieval Catholic cathedral known for its French Gothic architecture.',
                rating: 4.6,
                highlights: ['Gothic Architecture', 'Religious Site'],
                type: 'Landmark'
            }
        ];
    } else if (destination.includes('Amsterdam')) {
        attractions = [
            {
                name: 'Van Gogh Museum',
                image: 'https://via.placeholder.com/400x300?text=Van+Gogh+Museum',
                description: 'Museum dedicated to the works of Vincent van Gogh and his contemporaries.',
                rating: 4.6,
                highlights: ['Sunflowers', 'Self-Portraits'],
                type: 'Museum'
            },
            {
                name: 'Anne Frank House',
                image: 'https://via.placeholder.com/400x300?text=Anne+Frank+House',
                description: 'Biographical museum dedicated to Jewish wartime diarist Anne Frank.',
                rating: 4.5,
                highlights: ['Historical Site', 'Moving Experience'],
                type: 'Museum'
            },
            {
                name: 'Canal Cruise',
                image: 'https://via.placeholder.com/400x300?text=Amsterdam+Canals',
                description: 'Scenic boat trip through Amsterdam\'s famous canal ring.',
                rating: 4.7,
                highlights: ['UNESCO World Heritage', 'City Views'],
                type: 'Activity'
            }
        ];
    } else {
        // Generic attractions for any other destination
        attractions = [
            {
                name: 'City Tour',
                image: `https://via.placeholder.com/400x300?text=${destination}+Tour`,
                description: 'Explore the highlights of the city with a guided tour.',
                rating: 4.5,
                highlights: ['Local Guide', 'City Highlights'],
                type: 'Activity'
            },
            {
                name: 'Local Museum',
                image: `https://via.placeholder.com/400x300?text=${destination}+Museum`,
                description: 'Discover the history and culture of the region.',
                rating: 4.3,
                highlights: ['Cultural Experience', 'Artifacts'],
                type: 'Museum'
            },
            {
                name: 'Food Experience',
                image: `https://via.placeholder.com/400x300?text=${destination}+Food`,
                description: 'Taste the local cuisine and traditional dishes.',
                rating: 4.6,
                highlights: ['Local Cuisine', 'Culinary Tour'],
                type: 'Food'
            }
        ];
    }

    // Create cards for each attraction
    attractions.forEach(attraction => {
        // Check if card already exists (avoid duplicates)
        const existingCard = document.querySelector(`.recommendation-card[data-name="${attraction.name}"]`);
        if (existingCard) {
            return;
        }

        const card = document.createElement('div');
        card.classList.add('recommendation-card');
        card.setAttribute('data-name', attraction.name);
        card.setAttribute('data-destination', destination);

        card.innerHTML = `
            <div class="card-image">
                <img src="${attraction.image}" alt="${attraction.name}">
                <div class="card-badge">${attraction.type}</div>
            </div>
            <div class="card-content">
                <h3 class="card-title">${attraction.name}</h3>
                <p class="card-description">${attraction.description}</p>
                <div class="card-info">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${destination}</span>
                </div>
                <div class="card-tags">
                    ${attraction.highlights.map(highlight => `<span class="tag">${highlight}</span>`).join('')}
                </div>
            </div>
            <div class="card-footer">
                <div class="card-rating">
                    <i class="fas fa-star"></i>
                    <span>${attraction.rating}</span>
                </div>
                <button class="btn-text bookmark-btn">
                    <i class="far fa-bookmark"></i>
                </button>
            </div>
        `;

        // Add event listener to bookmark button
        const bookmarkBtn = card.querySelector('.bookmark-btn');
        bookmarkBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            const icon = this.querySelector('i');
            icon.classList.toggle('far');
            icon.classList.toggle('fas');
        });

        cardContainer.appendChild(card);
    });
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

        content.innerHTML = `
            <h3>Day ${i} - Activities</h3>
            <div class="activity-list">
                <div class="add-activity-btn">
                    <i class="fas fa-plus-circle"></i>
                    <span>Add Activity</span>
                </div>
            </div>
        `;

        contentContainer.appendChild(content);
    }
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
