document.addEventListener('DOMContentLoaded', function () {
    // Check authentication before loading settings
    const email = checkAuthentication();
    if (!email) return;

    // Load saved settings
    loadSettings();

    // Set up event listeners for settings changes
    setupEventListeners();
});

// Authentication check function (copied from other pages for consistency)
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

// Load settings from localStorage
function loadSettings() {
    // Dark mode setting
    const darkMode = localStorage.getItem('darkMode') === 'true';
    document.getElementById('dark-mode-toggle').checked = darkMode;
    applyDarkMode(darkMode);

    // Font size setting
    const fontSize = localStorage.getItem('fontSize') || 'medium';
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.size === fontSize) {
            btn.classList.add('active');
        }
    });
    applyFontSize(fontSize);

    // Email notifications setting
    const emailNotifications = localStorage.getItem('emailNotifications') !== 'false'; // Default is true
    document.getElementById('email-notifications-toggle').checked = emailNotifications;

    // Browser notifications setting
    const browserNotifications = localStorage.getItem('browserNotifications') !== 'false'; // Default is true
    document.getElementById('browser-notifications-toggle').checked = browserNotifications;

    // Remember login setting
    const rememberLogin = localStorage.getItem('rememberLogin') !== 'false'; // Default is true
    document.getElementById('remember-login-toggle').checked = rememberLogin;

    // Data collection setting
    const dataCollection = localStorage.getItem('dataCollection') !== 'false'; // Default is true
    document.getElementById('data-collection-toggle').checked = dataCollection;
}

// Set up event listeners for all settings
function setupEventListeners() {
    // Dark mode toggle
    document.getElementById('dark-mode-toggle').addEventListener('change', function (e) {
        const isDarkMode = e.target.checked;
        localStorage.setItem('darkMode', isDarkMode);
        applyDarkMode(isDarkMode);
        showSaveNotification();
    });

    // Font size buttons
    document.querySelectorAll('.font-size-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const size = this.dataset.size;

            // Update active button
            document.querySelectorAll('.font-size-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            // Save and apply font size
            localStorage.setItem('fontSize', size);
            applyFontSize(size);
            showSaveNotification();
        });
    });

    // Email notifications toggle
    document.getElementById('email-notifications-toggle').addEventListener('change', function (e) {
        localStorage.setItem('emailNotifications', e.target.checked);
        showSaveNotification();
    });

    // Browser notifications toggle
    document.getElementById('browser-notifications-toggle').addEventListener('change', function (e) {
        localStorage.setItem('browserNotifications', e.target.checked);

        // If enabled, request notification permission
        if (e.target.checked) {
            requestNotificationPermission();
        }

        showSaveNotification();
    });

    // Remember login toggle
    document.getElementById('remember-login-toggle').addEventListener('change', function (e) {
        localStorage.setItem('rememberLogin', e.target.checked);

        // If turned off, clear localStorage but keep sessionStorage
        if (!e.target.checked) {
            const sessionEmail = sessionStorage.getItem('userEmail');
            localStorage.removeItem('userEmail');
            // Ensure we have email in session storage
            if (sessionEmail) {
                sessionStorage.setItem('userEmail', sessionEmail);
            }
        }

        showSaveNotification();
    });

    // Data collection toggle
    document.getElementById('data-collection-toggle').addEventListener('change', function (e) {
        localStorage.setItem('dataCollection', e.target.checked);
        showSaveNotification();
    });

    // Clear data button
    document.getElementById('clear-data-btn').addEventListener('click', function () {
        if (confirm('Are you sure you want to clear all locally stored data? This will log you out.')) {
            clearAllData();
        }
    });
}

// Apply dark mode
function applyDarkMode(isDarkMode) {
    const darkTheme = document.getElementById('dark-theme');

    if (isDarkMode) {
        darkTheme.removeAttribute('disabled');
    } else {
        darkTheme.setAttribute('disabled', 'true');
    }
}

// Apply font size
function applyFontSize(size) {
    document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    document.body.classList.add(`font-size-${size}`);
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission().then(function (permission) {
            if (permission !== 'granted') {
                console.log('Notification permission denied');
                // Update toggle to reflect actual state
                document.getElementById('browser-notifications-toggle').checked = false;
                localStorage.setItem('browserNotifications', false);
            }
        });
    }
}

// Clear all locally stored data
function clearAllData() {
    // Preserve the dark mode setting for better UX
    const darkMode = localStorage.getItem('darkMode');

    // Clear all localStorage
    localStorage.clear();

    // Clear all sessionStorage
    sessionStorage.clear();

    // Restore dark mode setting if it was enabled
    if (darkMode === 'true') {
        localStorage.setItem('darkMode', 'true');
    }

    showSaveNotification('All data cleared successfully');

    // Redirect to login after a short delay
    setTimeout(() => {
        window.location.href = '../login/login.html';
    }, 1500);
}

// Show save notification
function showSaveNotification(message = 'Settings saved successfully') {
    const notification = document.getElementById('save-notification');
    notification.textContent = message;
    notification.classList.add('show');

    // Hide notification after 3 seconds
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
