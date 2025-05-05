let currentUserData = null;

document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication before loading page content
    const email = checkAuthentication();
    if (!email) {
        return;
    }

    try {
        // Get user data from database using email
        const userData = await getUserData(email);

        // Populate user information
        populateUserInfo(userData);

        // Load user's trips
        const trips = await loadUserTrips(email);

        // Update the trip count in the profile section
        updateTripCount(trips.length);

        // Set up event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showError("There was a problem loading your dashboard.");
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
        console.log("No authentication email found, redirecting to login");
        window.location.href = '../login/login.html';
        return null;
    }

    return email;
}

// Get real user data from the database
async function getUserData(email) {
    try {
        // Show loading indicator
        showLoading("Loading your profile...");

        console.log("Sending request with email:", email);

        // Try with both header and query parameter for maximum compatibility
        const url = `https://8pwhgwx173.execute-api.us-east-2.amazonaws.com/prod/users?email=${encodeURIComponent(email)}`;
        console.log("Request URL:", url);

        // Only use the headers that are allowed by your API Gateway CORS configuration
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-User-Email': email,
                'Content-Type': 'application/json'
                // Removed X-Debug-Info header which was causing CORS issues
            }
        });

        console.log("Response status:", response.status);
        const responseText = await response.text(); // Get raw text first for debugging
        console.log("Raw response text:", responseText);

        let responseData;
        try {
            responseData = JSON.parse(responseText);
            console.log("Parsed response data:", responseData);
        } catch (e) {
            console.error("Failed to parse response as JSON:", e);
            throw new Error("Invalid JSON response from server");
        }

        // Check if we received the Lambda proxy structure (statusCode, headers, body)
        let userData;
        if (responseData.statusCode && responseData.body) {
            try {
                // Handle both string and object body formats
                userData = typeof responseData.body === 'string'
                    ? JSON.parse(responseData.body)
                    : responseData.body;
                console.log("Extracted user data from API Gateway response:", userData);
            } catch (e) {
                console.error("Failed to parse response body:", e);
                throw new Error("Invalid response format from server");
            }
        } else if (!response.ok) {
            console.error("Error response:", responseData);
            throw new Error(`Failed to fetch user data: ${response.status}`);
        } else {
            // Direct response (not wrapped by API Gateway)
            userData = responseData;
        }

        hideLoading();

        // Make sure we have the email in the user data for display
        if (userData && !userData.email) {
            userData.email = email;
        }

        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        hideLoading();

        // Show error message to user
        showError(`Couldn't load your profile: ${error.message}. Please check console for details.`);

        // Return minimal data structure to avoid errors
        return {
            name: "User",
            username: "",
            email: email, // At least pass the email through
            memberSince: "",
            tripsCount: 0,
            preferences: {
                weather: "warm",
                environment: "city",
                activity: "relaxing"
            }
        };
    }
}

// Populate user information in the UI
function populateUserInfo(userData) {
    console.log("Populating user info with data:", JSON.stringify(userData));

    // Store the user data for later use
    currentUserData = userData;

    // Safety check for empty userData
    if (!userData) {
        console.error("userData is null or undefined");
        return;
    }

    // Set user name in the header - use email as fallback
    document.getElementById('user-name').textContent = userData.name || userData.username || userData.email || "User";

    // Set profile information with fallbacks for missing data
    document.getElementById('profile-username').textContent = userData.username || "Not set";
    document.getElementById('profile-email').textContent = userData.email || "Not set";
    document.getElementById('profile-member-since').textContent = userData.memberSince || "Not set";
    document.getElementById('profile-trips').textContent = userData.tripsCount || "0";

    // Also populate the edit form fields
    if (document.getElementById('edit-username')) {
        document.getElementById('edit-username').value = userData.username || "";
    }

    if (document.getElementById('edit-email')) {
        document.getElementById('edit-email').value = userData.email || "";
    }

    // Set preferences with safety checks
    if (userData.preferences) {
        document.getElementById('weather').value = userData.preferences.weather || "warm";
        document.getElementById('environment').value = userData.preferences.environment || "city";
        document.getElementById('activity').value = userData.preferences.activity || "relaxing";
    }
}

// Set up event listeners for interactive elements
function setupEventListeners() {
    // Edit profile button
    const editProfileBtn = document.getElementById('edit-profile-btn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', function () {
            // Show edit mode, hide view mode
            document.getElementById('profile-view-mode').style.display = 'none';
            document.getElementById('profile-edit-mode').style.display = 'block';

            // Change the button text and functionality
            this.style.display = 'none';
        });
    }

    // Cancel edit button
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function () {
            // Use stored data instead of trying to fetch again
            document.getElementById('edit-username').value = currentUserData.username;
            document.getElementById('edit-email').value = currentUserData.email;
        });
    }

    // Profile edit form submission
    const profileEditForm = document.getElementById('profile-edit-form');
    if (profileEditForm) {
        // Profile edit form submission
        profileEditForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Get the updated values
            const updatedUsername = document.getElementById('edit-username').value;
            const updatedEmail = document.getElementById('edit-email').value;

            try {
                // Send update to database
                await updateUserProfile({
                    username: updatedUsername,
                    email: updatedEmail
                });

                // Update the display values
                document.getElementById('profile-username').textContent = updatedUsername;
                document.getElementById('profile-email').textContent = updatedEmail;

                // Hide edit mode, show view mode
                document.getElementById('profile-edit-mode').style.display = 'none';
                document.getElementById('profile-view-mode').style.display = 'flex';

                // Show the edit button again
                document.getElementById('edit-profile-btn').style.display = 'block';

                alert('Profile updated successfully!');
            } catch (error) {
                alert('Failed to update profile. Please try again.');
            }
        });
    }

    // Update preferences form
    const preferencesForm = document.getElementById('preferences-form');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            // Get form values
            const formData = {
                weather: document.getElementById('weather').value,
                environment: document.getElementById('environment').value,
                activity: document.getElementById('activity').value
            };

            try {
                // Actually call the update function
                await updateUserPreferences(formData);
                alert('Preferences updated successfully!');
            } catch (error) {
                alert('Failed to update preferences. Please try again.');
            }
        });
    }

    // Trip card actions
    const viewButtons = document.querySelectorAll('.trip-actions button:first-child');
    viewButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripName = tripCard.querySelector('h3').textContent;

            const tripId = mapTripNameToTripId(tripName); // This function maps trip names to IDs

            if (!tripId) {
                alert(`Trip ID not found for "${tripName}"`);
                return;
            }

            // jump to
            window.location.href = `../trip_card/trip_card.html?trip_id=${tripId}`;
        });
    });

    const editButtons = document.querySelectorAll('.trip-actions button:nth-child(2)');
    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripId = tripCard.dataset.tripId;
            const tripName = tripCard.querySelector('h3').textContent;

            if (this.innerHTML.includes('Clone')) {
                // Show clone trip modal
                showCloneTripModal(tripId, tripName, tripCard);
            } else {
                // Direct to the edit trip page with the trip ID
                window.location.href = `../edit_trip/edit_trip.html?trip_id=${tripId}`;
            }
        });
    });

    // New Trip button
    const newTripBtn = document.querySelector('.history-section .btn-secondary');
    if (newTripBtn) {
        newTripBtn.addEventListener('click', function () {
            window.location.href = '../explore/explore.html';
        });
    }

    // Clone modal close button
    const closeCloneModal = document.getElementById('close-clone-modal');
    if (closeCloneModal) {
        closeCloneModal.addEventListener('click', function () {
            document.getElementById('clone-trip-modal').style.display = 'none';
        });
    }

    // Cancel clone button
    const cancelCloneBtn = document.getElementById('cancel-clone-btn');
    if (cancelCloneBtn) {
        cancelCloneBtn.addEventListener('click', function () {
            document.getElementById('clone-trip-modal').style.display = 'none';
        });
    }

    // Clone form submission
    const cloneTripForm = document.getElementById('clone-trip-form');
    if (cloneTripForm) {
        cloneTripForm.addEventListener('submit', function (e) {
            e.preventDefault();
            submitCloneTrip();
        });
    }
}

// Function to show the clone trip modal with trip details
function showCloneTripModal(tripId, tripName, tripCard) {
    // Store the trip ID in a data attribute for later use
    const modal = document.getElementById('clone-trip-modal');
    modal.dataset.tripId = tripId;

    // Set trip name in the form
    document.getElementById('clone-trip-name').textContent = tripName;

    // Pre-fill form with trip details
    document.getElementById('clone-trip-title').value = `Copy of ${tripName}`;

    // Set default date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formattedDate = tomorrow.toISOString().split('T')[0];
    document.getElementById('clone-start-date').value = formattedDate;

    // Get and display trip duration
    const durationText = tripCard.querySelector('.tag').textContent.split(' ')[0];
    document.getElementById('clone-trip-duration').textContent = durationText;

    // Show the modal
    modal.style.display = 'flex';
}

// Function to submit the clone trip request
async function submitCloneTrip() {
    try {
        // Get form values
        const modal = document.getElementById('clone-trip-modal');
        const tripId = modal.dataset.tripId;
        const title = document.getElementById('clone-trip-title').value; // Just for UI
        const startDate = document.getElementById('clone-start-date').value;

        if (!tripId || !startDate) {
            alert('Please fill in all required fields');
            return;
        }

        showLoading("Cloning trip...");

        // Get email for authentication
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');

        if (!email) {
            throw new Error("User email not found. Please login again.");
        }

        // Call the API to clone the trip
        const url = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}/clone`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            },
            body: JSON.stringify({
                start_date: startDate
                // Note: We don't send title as it's not used in the database
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to clone trip');
        }

        const result = await response.json();

        // Hide modal and loading
        modal.style.display = 'none';
        hideLoading();

        // Show success message
        alert('Trip cloned successfully!');

        // Reload the page to show the new trip
        window.location.reload();

    } catch (error) {
        console.error('Error cloning trip:', error);
        hideLoading();
        showError(`Failed to clone trip: ${error.message}`);
    }
}

// Update user preferences in the database
async function updateUserPreferences(preferences) {
    try {
        showLoading("Updating your preferences...");

        // Get email and verify it exists before proceeding
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        console.log("Email from storage for preferences update:", email);

        if (!email) {
            console.error("No email found in storage for preferences update!");
            throw new Error("User email not found. Please login again.");
        }

        // Add email to query parameters AND include in the body
        const updatedPreferences = {
            ...preferences,
            email: email  // Include email in the request body too
        };

        console.log("Full preferences payload:", updatedPreferences);

        const url = `https://8pwhgwx173.execute-api.us-east-2.amazonaws.com/prod/users/preferences?email=${encodeURIComponent(email)}`;
        console.log("Request URL:", url);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            },
            body: JSON.stringify(updatedPreferences)
        });

        console.log("Response status:", response.status);
        const responseData = await response.json();
        console.log("Raw preferences update response:", responseData);

        // Handle Lambda proxy response format
        let result;
        if (responseData.statusCode) {
            // API Gateway Lambda proxy format
            if (responseData.statusCode !== 200) {
                let errorMessage = 'Unknown error';
                try {
                    const errorBody = JSON.parse(responseData.body);
                    errorMessage = errorBody.error || errorMessage;
                } catch (e) {
                    console.error("Failed to parse error body:", e);
                }
                throw new Error(`Server returned an error: ${errorMessage}`);
            }

            // Parse the response body if successful
            try {
                result = JSON.parse(responseData.body);
                console.log("Processed preferences update response:", result);
            } catch (e) {
                console.error("Failed to parse response body:", e);
                throw new Error("Invalid response format from server");
            }
        } else if (!response.ok) {
            throw new Error(`Failed to update preferences: ${response.status}`);
        } else {
            // Direct response (not wrapped by API Gateway)
            result = responseData;
        }

        hideLoading();
        return result;
    } catch (error) {
        console.error('Error updating preferences:', error);
        hideLoading();
        showError("Couldn't update your preferences. Please try again later.");
        throw error;
    }
}

// Update user profile in the database
async function updateUserProfile(profileData) {
    try {
        showLoading("Updating your profile...");

        // Get email and verify it exists before proceeding
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        console.log("Email from storage for profile update:", email);

        if (!email) {
            console.error("No email found in storage for profile update!");
            throw new Error("User email not found. Please login again.");
        }

        // Add email to query parameters AND include in the body
        const updatedProfileData = {
            ...profileData,
            email: email  // Include email in the request body too
        };

        console.log("Full profile payload:", updatedProfileData);

        const url = `https://8pwhgwx173.execute-api.us-east-2.amazonaws.com/prod/users/profile?email=${encodeURIComponent(email)}`;
        console.log("Request URL:", url);

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            },
            body: JSON.stringify(updatedProfileData)
        });

        console.log("Response status:", response.status);
        const responseData = await response.json();
        console.log("Raw profile update response:", responseData);

        // Handle Lambda proxy response format
        let result;
        if (responseData.statusCode) {
            // API Gateway Lambda proxy format
            if (responseData.statusCode !== 200) {
                let errorMessage = 'Unknown error';
                try {
                    const errorBody = JSON.parse(responseData.body);
                    errorMessage = errorBody.error || errorMessage;
                } catch (e) {
                    console.error("Failed to parse error body:", e);
                }
                throw new Error(`Server returned an error: ${errorMessage}`);
            }

            // Parse the response body if successful
            try {
                result = JSON.parse(responseData.body);
                console.log("Processed profile update response:", result);
            } catch (e) {
                console.error("Failed to parse response body:", e);
                throw new Error("Invalid response format from server");
            }
        } else if (!response.ok) {
            throw new Error(`Failed to update profile: ${response.status}`);
        } else {
            // Direct response (not wrapped by API Gateway)
            result = responseData;
        }

        hideLoading();
        return result;
    } catch (error) {
        console.error('Error updating profile:', error);
        hideLoading();
        showError("Couldn't update your profile. Please try again later.");
        throw error;
    }
}

// Function to load trips for current user from API
async function loadUserTrips(email) {
    try {
        showLoading("Loading your trips...");

        // Get userId from email - just use email as userId
        const userId = email;

        const url = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips?user_id=${encodeURIComponent(userId)}`;
        console.log("Fetching trips from:", url);

        // Fetch trips from API
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log("Trips API response status:", response.status);
        const data = await response.json();
        console.log("Trips API raw response:", data);

        // Extract trips from the response with improved parsing
        let trips = [];

        if (data.statusCode && data.body) {
            // Handle Lambda proxy response format
            console.log("Parsing Lambda proxy response");
            try {
                // Handle both string and object body
                const bodyContent = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                console.log("Parsed body content:", bodyContent);

                if (bodyContent.trips) {
                    trips = bodyContent.trips;
                }
            } catch (e) {
                console.error("Failed to parse response body:", e);
            }
        } else if (data.trips) {
            // Direct response with trips array
            console.log("Found trips directly in response");
            trips = data.trips;
        } else {
            // Unknown format, try to find trips anywhere in the response
            console.log("Looking for trips in unknown response format");
            const responseStr = JSON.stringify(data);
            if (responseStr.includes("trips")) {
                try {
                    // As a last resort, try to find a trips array in the response
                    const matches = responseStr.match(/"trips"\s*:\s*(\[.*?\])/);
                    if (matches && matches[1]) {
                        trips = JSON.parse(matches[1]);
                    }
                } catch (e) {
                    console.error("Failed to extract trips from response:", e);
                }
            }
        }

        console.log(`Found ${trips.length} trips:`, trips);

        // Update UI with trips
        renderTripCards(trips);

        hideLoading();
        return trips;
    } catch (error) {
        console.error('Error loading trips:', error);
        hideLoading();
        showError("Couldn't load your trips. Please try again later.");

        // Return empty array to avoid errors
        return [];
    }
}

// Calculate trip status based on dates
function calculateTripStatus(tripData) {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of day for accurate comparison

    // Parse the start date
    const startDate = new Date(tripData.start_date);
    startDate.setHours(0, 0, 0, 0);

    // Calculate end date (start date + duration)
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (tripData.duration || 0));

    // Determine status
    if (endDate < today) {
        return "completed";
    } else if (startDate <= today && today <= endDate) {
        return "now";
    } else {
        return "upcoming";
    }
}

// Format dates for display
function formatDateRange(startDateStr, duration) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (duration || 0));

    // Format as MM/DD/YYYY
    const formatDate = (date) => {
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
    };

    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
}

// Helper function to render trip cards from data
function renderTripCards(trips) {
    const tripCardsContainer = document.querySelector('.trip-cards');
    tripCardsContainer.innerHTML = ''; // Clear existing cards

    if (!trips || trips.length === 0) {
        tripCardsContainer.innerHTML = '<div class="no-trips-message">You have no trips yet. Create your first trip!</div>';
        return;
    }

    trips.forEach(trip => {
        // Calculate trip status
        const status = calculateTripStatus(trip);

        // Map status to display text
        const statusText = {
            "completed": "Completed",
            "now": "In Progress",
            "upcoming": "Upcoming"
        }[status];

        // Format date range
        const dateRange = formatDateRange(trip.start_date, trip.duration);

        // Get trip image URL or use placeholder
        const imageUrl = trip.cover_url || `https://via.placeholder.com/300x150?text=${encodeURIComponent(trip.start_city)}`;

        // Create trip card HTML
        const tripCard = document.createElement('div');
        tripCard.className = 'trip-card';
        tripCard.dataset.tripId = trip.id;
        tripCard.innerHTML = `
            <div class="trip-image">
                <img src="${imageUrl}" alt="${trip.title || 'Trip'}">
                <div class="trip-status ${status}">${statusText}</div>
            </div>
            <div class="trip-details">
                <h3>${trip.title || `Trip to ${trip.start_city}`}</h3>
                <div class="trip-meta">
                    <span><i class="far fa-calendar-alt"></i> ${dateRange}</span>
                    <span><i class="fas fa-map-marker-alt"></i> ${trip.start_city} to ${trip.end_city}</span>
                </div>
                <div class="trip-tags">
                    <span class="tag">${trip.duration} Days</span>
                    <span class="tag">${trip.start_city}</span>
                </div>
            </div>
            <div class="trip-actions">
                <button class="btn-text view-trip"><i class="fas fa-eye"></i> View</button>
                ${status === "upcoming" ? '<button class="btn-text edit-trip"><i class="fas fa-pencil-alt"></i> Edit</button>' :
                '<button class="btn-text clone-trip"><i class="fas fa-copy"></i> Clone</button>'}
                <button class="btn-text delete-trip"><i class="fas fa-trash-alt"></i> Delete</button>
                <button class="btn-text upload-tickets"><i class="fas fa-ticket-alt"></i> Upload Tickets</button>
            </div>
        `;

        tripCardsContainer.appendChild(tripCard);
    });

    // Add event listeners to the new trip action buttons
    document.querySelectorAll('.view-trip').forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripId = tripCard.dataset.tripId;

            if (!tripId) {
                alert('Trip ID not found');
                return;
            }

            window.location.href = `../trip_card/trip_card.html?trip_id=${tripId}`;
        });
    });

    document.querySelectorAll('.edit-trip, .clone-trip').forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripId = tripCard.dataset.tripId;
            const tripName = tripCard.querySelector('h3').textContent;

            if (this.classList.contains('edit-trip')) {
                // Direct to the edit trip page with the trip ID
                window.location.href = `../edit_trip/edit_trip.html?trip_id=${tripId}`;
            } else {
                // Show clone trip modal
                showCloneTripModal(tripId, tripName, tripCard);
            }
        });
    });

    // Add event listeners for the delete buttons
    document.querySelectorAll('.delete-trip').forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripId = tripCard.dataset.tripId;
            const tripName = tripCard.querySelector('h3').textContent;

            if (confirm(`Are you sure you want to delete "${tripName}"? This action cannot be undone.`)) {
                deleteTrip(tripId, tripCard);
            }
        });
    });

    // Add event listeners for the upload tickets buttons
    document.querySelectorAll('.upload-tickets').forEach(button => {
        button.addEventListener('click', function () {
            const tripCard = this.closest('.trip-card');
            const tripId = tripCard.dataset.tripId;

            if (!tripId) {
                alert('Trip ID not found');
                return;
            }

            window.location.href = `../tickets/ticket_upload.html?tripId=${tripId}`;
        });
    });
}

// Function to delete a trip
async function deleteTrip(tripId, tripCardElement) {
    try {
        showLoading("Deleting trip...");

        // Get email for authentication
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');

        if (!email) {
            throw new Error("User email not found. Please login again.");
        }

        // Call the API to delete the trip
        const url = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/trips/${tripId}`;

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Email': email
            }
        });

        let result;
        try {
            const responseText = await response.text();
            result = responseText ? JSON.parse(responseText) : {};
        } catch (e) {
            console.error("Error parsing response:", e);
            result = { success: response.ok };
        }

        if (response.ok || (result && (result.success || result.deleted))) {
            // Remove the trip card from the UI with animation
            tripCardElement.classList.add('deleting');

            setTimeout(() => {
                tripCardElement.remove();

                // Check if there are no more trips
                const remainingTrips = document.querySelectorAll('.trip-card');
                if (remainingTrips.length === 0) {
                    const tripCardsContainer = document.querySelector('.trip-cards');
                    tripCardsContainer.innerHTML = '<div class="no-trips-message">You have no trips yet. Create your first trip!</div>';
                }

                // Update the trip count
                updateTripCount(remainingTrips.length);

                // Show success message
                alert("Trip deleted successfully");
            }, 300); // Slight delay for animation
        } else {
            throw new Error(result.message || result.error || 'Failed to delete trip');
        }

        hideLoading();
    } catch (error) {
        hideLoading();
        console.error("Error deleting trip:", error);
        alert(`Failed to delete trip: ${error.message || 'Unknown error'}`);
    }
}

// Show loading indicator
function showLoading(message = "Loading...") {
    // Create loading overlay if it doesn't exist
    if (!document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-message">${message}</div>
        `;
        document.body.appendChild(overlay);
    } else {
        document.querySelector('#loading-overlay .loading-message').textContent = message;
        document.getElementById('loading-overlay').style.display = 'flex';
    }
}

// Hide loading indicator
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// Show error message
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;

    // Add to page
    const mainContent = document.querySelector('.main-content');
    mainContent.insertBefore(errorDiv, mainContent.firstChild);

    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Function to update the trip count in the UI
function updateTripCount(count) {
    // Update the trip count in the profile
    const tripCountElement = document.getElementById('profile-trips');
    if (tripCountElement) {
        tripCountElement.textContent = count;
    }

    // Also update the stored user data
    if (currentUserData) {
        currentUserData.tripsCount = count;
    }

    console.log(`Updated trip count to: ${count}`);
}