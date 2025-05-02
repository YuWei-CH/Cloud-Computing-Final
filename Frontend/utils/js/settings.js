document.addEventListener('DOMContentLoaded', function () {
    // Get all UI elements
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const fontSizeButtons = document.querySelectorAll('.font-size-btn');
    const notificationsToggle = document.getElementById('browser-notifications-toggle');
    const clearDataBtn = document.getElementById('clear-data-btn');
    const saveNotification = document.getElementById('save-notification');

    // Check authentication
    checkAuthentication();

    // Load saved settings
    loadSettings();

    // Dark mode toggle
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', function () {
            const darkTheme = document.getElementById('dark-theme');
            darkTheme.disabled = !this.checked;

            // Save setting globally
            localStorage.setItem('darkMode', this.checked ? 'enabled' : 'disabled');
            showSaveNotification();
        });
    }

    // Font size selection
    fontSizeButtons.forEach(button => {
        button.addEventListener('click', function () {
            // Remove active class from all buttons
            fontSizeButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            this.classList.add('active');

            // Apply font size to body
            const size = this.dataset.size;
            document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
            document.body.classList.add(`font-size-${size}`);

            // Save setting globally
            localStorage.setItem('fontSize', size);
            showSaveNotification();
        });
    });

    // Browser notifications toggle
    if (notificationsToggle) {
        notificationsToggle.addEventListener('change', function () {
            // Request notification permission if enabled
            if (this.checked && Notification.permission !== 'granted') {
                Notification.requestPermission();
            }

            // Save setting
            localStorage.setItem('notifications', this.checked ? 'enabled' : 'disabled');
            showSaveNotification();
        });
    }

    // Clear local data
    if (clearDataBtn) {
        clearDataBtn.addEventListener('click', function () {
            if (confirm('Are you sure you want to clear all locally stored data? This will remove all your preferences and settings.')) {
                // Keep only authentication data
                const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');

                // Clear all storage
                localStorage.clear();
                sessionStorage.clear();

                // Restore authentication if needed
                if (email) {
                    localStorage.setItem('userEmail', email);
                }

                // Show confirmation
                alert('All local data has been cleared. Settings have been reset to default.');

                // Reload page to reset UI
                window.location.reload();
            }
        });
    }

    // Function to show save notification
    function showSaveNotification() {
        saveNotification.classList.add('show');

        // Hide after 3 seconds
        setTimeout(() => {
            saveNotification.classList.remove('show');
        }, 3000);
    }

    // Function to load saved settings
    function loadSettings() {
        // Load dark mode setting
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled' && darkModeToggle) {
            darkModeToggle.checked = true;
            document.getElementById('dark-theme').disabled = false;
        }

        // Load font size setting
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize) {
            fontSizeButtons.forEach(button => {
                button.classList.remove('active');
                if (button.dataset.size === fontSize) {
                    button.classList.add('active');
                }
            });

            document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
            document.body.classList.add(`font-size-${fontSize}`);
        }

        // Load notifications setting
        const notifications = localStorage.getItem('notifications');
        if (notifications === 'disabled' && notificationsToggle) {
            notificationsToggle.checked = false;
        }
    }

    // Authentication check (copied from other pages for consistency)
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
});
