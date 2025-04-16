document.addEventListener('DOMContentLoaded', function () {
    // Check authentication before loading page content
    const token = checkAuthentication();
    if (!token) {
        // This redirect should not happen since checkAuthentication already redirects
        return;
    }

    // Get user data - in a real app, this would be fetched using the token
    const userData = getUserData(token);

    // Populate user information
    populateUserInfo(userData);

    // Set up event listeners
    setupEventListeners();

    // Load trip history - in a real app, this would be fetched from your backend
    // loadTripHistory();
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

// Simulate getting user data (in a real app, this would make an API call)
function getUserData() {
    // Updated mock data with Yuwei Sun's information
    return {
        name: "Yuwei Sun",
        username: "yuweisun",
        email: "ys4680@nyu.edu",
        memberSince: "May 2025",
        tripsCount: 3,
        preferences: {
            weather: "warm",
            environment: "beach",
            activity: "relaxing"
            // Removed budget from preferences
        }
    };
}

// Populate user information in the UI
function populateUserInfo(userData) {
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
            // Hide edit mode, show view mode
            document.getElementById('profile-edit-mode').style.display = 'none';
            document.getElementById('profile-view-mode').style.display = 'flex';

            // Show the edit button again
            document.getElementById('edit-profile-btn').style.display = 'block';

            // Reset the form values to the current user data
            const userData = getUserData();
            document.getElementById('edit-username').value = userData.username;
            document.getElementById('edit-email').value = userData.email;
        });
    }

    // Profile edit form submission
    const profileEditForm = document.getElementById('profile-edit-form');
    if (profileEditForm) {
        profileEditForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Get the updated values
            const updatedUsername = document.getElementById('edit-username').value;
            const updatedEmail = document.getElementById('edit-email').value;

            // Update the display values
            document.getElementById('profile-username').textContent = updatedUsername;
            document.getElementById('profile-email').textContent = updatedEmail;

            // In a real application, you would send these updates to your backend
            console.log('Profile updated:', {
                username: updatedUsername,
                email: updatedEmail
            });

            // Hide edit mode, show view mode
            document.getElementById('profile-edit-mode').style.display = 'none';
            document.getElementById('profile-view-mode').style.display = 'flex';

            // Show the edit button again
            document.getElementById('edit-profile-btn').style.display = 'block';

            alert('Profile updated successfully!');
        });
    }

    // Update preferences form
    const preferencesForm = document.getElementById('preferences-form');
    if (preferencesForm) {
        preferencesForm.addEventListener('submit', function (e) {
            e.preventDefault();

            // Get form values
            const formData = {
                weather: document.getElementById('weather').value,
                environment: document.getElementById('environment').value,
                activity: document.getElementById('activity').value
                // Removed budget from form data collection
            };

            // In a real app, you would send this to your backend
            console.log('Preferences updated:', formData);
            alert('Preferences updated successfully!');

            // Simulate API call to update preferences
            // updateUserPreferences(formData);
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

// In a real app, you would have functions to interact with your backend API
function updateUserPreferences(preferences) {
    // This would make an API call to update user preferences
    console.log('Sending preferences to API:', preferences);
    // Example API call:
    // return fetch('https://your-aws-api-endpoint.com/user/preferences', {
    //     method: 'PUT',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${getAuthToken()}`
    //     },
    //     body: JSON.stringify(preferences)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     console.log('Preferences updated successfully', data);
    //     return data;
    // });
}

// Helper function to update user profile on the backend
function updateUserProfile(profileData) {
    // This would make an API call to update user profile information
    console.log('Sending profile update to API:', profileData);
    // Example API call:
    // return fetch('https://your-aws-api-endpoint.com/user/profile', {
    //     method: 'PUT',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${getAuthToken()}`
    //     },
    //     body: JSON.stringify(profileData)
    // })
    // .then(response => response.json())
    // .then(data => {
    //     console.log('Profile updated successfully', data);
    //     return data;
    // });
}

// Function to load trip history from API
function loadTripHistory() {
    // This would fetch trip history from your backend
    // fetch('https://your-aws-api-endpoint.com/trips', {
    //     headers: {
    //         'Authorization': `Bearer ${getAuthToken()}`
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
