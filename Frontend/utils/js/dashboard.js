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

        // Try with both header and query parameter
        const url = `https://8pwhgwx173.execute-api.us-east-2.amazonaws.com/prod/users?email=${encodeURIComponent(email)}`;
        console.log("Request URL:", url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-User-Email': email,
                'Content-Type': 'application/json'
            }
        });

        console.log("Response status:", response.status);
        const responseData = await response.json();
        console.log("Raw response data:", responseData);

        // Check if we received the Lambda proxy structure (statusCode, headers, body)
        let userData;
        if (responseData.statusCode && responseData.statusCode === 200 && responseData.body) {
            // The body is a JSON string that needs to be parsed
            try {
                userData = JSON.parse(responseData.body);
                console.log("Extracted user data from API Gateway response:", userData);
            } catch (e) {
                console.error("Failed to parse response body:", e);
                throw new Error("Invalid response format from server");
            }
        } else if (!response.ok) {
            throw new Error(`Failed to fetch user data: ${response.status}`);
        } else {
            // Direct response (not wrapped by API Gateway)
            userData = responseData;
        }

        hideLoading();
        return userData;
    } catch (error) {
        console.error('Error fetching user data:', error);
        hideLoading();
        showError("Couldn't load your profile. Please try again later.");

        // Return minimal data structure to avoid errors
        return {
            name: "User",
            username: "",
            email: "",
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
    // Store the user data for later use
    currentUserData = userData;

    // Set user name in the header
    document.getElementById('user-name').textContent = userData.name;

    // Set profile information
    document.getElementById('profile-username').textContent = userData.username;
    document.getElementById('profile-email').textContent = userData.email;
    document.getElementById('profile-member-since').textContent = userData.memberSince;
    document.getElementById('profile-trips').textContent = userData.tripsCount;

    // Also populate the edit form fields
    if (document.getElementById('edit-username')) {
        document.getElementById('edit-username').value = userData.username;
    }

    if (document.getElementById('edit-email')) {
        document.getElementById('edit-email').value = userData.email;
    }

    // Set preferences
    if (userData.preferences) {
        document.getElementById('weather').value = userData.preferences.weather;
        document.getElementById('environment').value = userData.preferences.environment;
        document.getElementById('activity').value = userData.preferences.activity;
        // Removed budget preference setting
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
            const tripName = this.closest('.trip-card').querySelector('h3').textContent;
            alert(`Viewing details for ${tripName}`);
        });
    });

    const editButtons = document.querySelectorAll('.trip-actions button:nth-child(2)');
    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const tripName = this.closest('.trip-card').querySelector('h3').textContent;
            if (this.innerHTML.includes('Clone')) {
                alert(`Creating a new trip based on ${tripName}`);
            } else {
                alert(`Editing ${tripName}`);
            }
        });
    });
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

// Function to load trip history from API
function loadTripHistory() {
    // This would fetch trip history from your backend
    // fetch('https://8pwhgwx173.execute-api.us-east-2.amazonaws.com/prod/trips', {
    //     headers: {
    //         'Authorization': `Bearer ${ getAuthToken() }`
    //     }
    // })
    // .then(response => response.json())
    // .then(trips => {
    //     renderTripCards(trips);
    // })
    // .catch(error => {
    //     console.error('Error loading trip history:', error);
    // });
}

// Helper function to render trip cards from data
function renderTripCards(trips) {
    const tripCardsContainer = document.querySelector('.trip-cards');
    tripCardsContainer.innerHTML = ''; // Clear existing cards

    trips.forEach(trip => {
        // Create and append trip cards using the data
        const tripCard = createTripCardElement(trip);
        tripCardsContainer.appendChild(tripCard);
    });
}

// Show loading indicator
function showLoading(message = "Loading...") {
    // Create loading overlay if it doesn't exist
    if (!document.getElementById('loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'loading-overlay';
        overlay.innerHTML = `
        < div class= "loading-spinner" ></div >
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