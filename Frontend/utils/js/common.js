// Common script to apply global settings across all pages
document.addEventListener('DOMContentLoaded', function () {
    // Apply dark mode setting
    const darkMode = localStorage.getItem('darkMode');
    if (darkMode === 'enabled') {
        document.getElementById('dark-theme').disabled = false;
        document.body.classList.add('dark-mode');
    }

    // Apply font size setting
    const fontSize = localStorage.getItem('fontSize');
    if (fontSize) {
        document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        document.body.classList.add(`font-size-${fontSize}`);
    }

    // Check if user is logged in and update UI accordingly
    checkLoginState();
});

// Function to check if user is logged in
function checkLoginState() {
    const isLoggedIn = isUserLoggedIn();
    
    // Get the current page path
    const currentPath = window.location.pathname;
    const isIndexPage = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath.endsWith('/Frontend/');
    
    // Check if we're on the index/home page
    if (isIndexPage) {
        updateHomePageForLoggedInUser(isLoggedIn);
    }
    
    // Handle navigation bars on other pages
    if (document.querySelector('.dashboard-navbar')) {
        // Already on a dashboard page with new navbar style
        updateDashboardNavbar(isLoggedIn);
    } else if (document.querySelector('.navbar')) {
        // On a page with the home navbar style
        updateHomeNavbar(isLoggedIn);
    }
}

// Check if user is logged in by checking localStorage and sessionStorage
function isUserLoggedIn() {
    return !!(localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail'));
}

// Update the home page navbar for logged-in users
function updateHomeNavbar(isLoggedIn) {
    const navbar = document.querySelector('.navbar');
    if (!navbar) return;
    
    // Get the existing login button or create container for dashboard links
    const loginBtn = navbar.querySelector('.login-btn-nav');
    
    if (isLoggedIn) {
        // User is logged in - replace login button with user menu
        if (loginBtn) {
            // Replace login button with user menu
            const userMenu = document.createElement('div');
            userMenu.className = 'user-menu';
            userMenu.innerHTML = `
                <div class="user-avatar">
                    <i class="fas fa-user"></i>
                </div>
                <div class="user-dropdown">
                    <a href="dashboard/dashboard.html"><i class="fas fa-home"></i> Dashboard</a>
                    <a href="explore/explore.html"><i class="fas fa-map-marked-alt"></i> Explore</a>
                    <a href="tickets/ticket_upload.html"><i class="fas fa-ticket-alt"></i> Tickets</a>
                    <a href="settings/settings.html"><i class="fas fa-cog"></i> Settings</a>
                    <a href="login/login.html" class="logout"><i class="fas fa-sign-out-alt"></i> Logout</a>
                </div>
            `;
            
            // Create a container for the user menu
            const userControls = document.createElement('div');
            userControls.className = 'user-controls';
            userControls.appendChild(userMenu);
            
            // Replace the login button with the user menu
            loginBtn.parentNode.replaceChild(userControls, loginBtn);
            
            // Add necessary styles for user menu on home page
            addUserMenuStyles();
        }
    } else {
        // User is not logged in - ensure login button is present
        // No need to do anything, the login button is already in the HTML
    }
}

// Update dashboard navbar for logged-in state
function updateDashboardNavbar(isLoggedIn) {
    // For dashboard pages, we assume user should be logged in
    // If not logged in, redirect to login page
    if (!isLoggedIn) {
        // Don't redirect when already on login page to avoid loops
        if (!window.location.pathname.includes('/login/')) {
            window.location.href = '../login/login.html';
        }
    }
    
    // Update user avatar with user info if available
    const userAvatar = document.getElementById('user-avatar');
    if (userAvatar && isLoggedIn) {
        const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        const userInitial = userEmail ? userEmail.charAt(0).toUpperCase() : 'U';
        // If user has a custom avatar in localStorage, use it
        const userAvatarSrc = localStorage.getItem('userAvatar');
        if (userAvatarSrc) {
            userAvatar.innerHTML = `<img src="${userAvatarSrc}" alt="User Avatar">`;
        } else {
            // Otherwise just show the initial
            userAvatar.innerHTML = userInitial;
        }
    }
}

// Update the home page for logged-in users
function updateHomePageForLoggedInUser(isLoggedIn) {
    // Adapt home page content for logged in users
    if (isLoggedIn) {
        // Get the user email or username to display
        const userEmail = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');
        const username = userEmail ? userEmail.split('@')[0] : 'Traveler';
        
        // Update hero section if it exists
        const heroContent = document.querySelector('.hero-content');
        if (heroContent) {
            const heroHeading = heroContent.querySelector('h1');
            if (heroHeading) {
                heroHeading.textContent = `Welcome back, Traveler!`;
            }
            
            const heroParagraph = heroContent.querySelector('p');
            if (heroParagraph) {
                heroParagraph.textContent = 'Continue planning your journey or explore new destinations.';
            }
            
            const ctaBtn = heroContent.querySelector('.cta-btn');
            if (ctaBtn) {
                ctaBtn.textContent = 'Go to Dashboard';
                ctaBtn.href = 'dashboard/dashboard.html';
            }
        }
    }
}

// Handle logout click events
document.addEventListener('click', function(e) {
    if (e.target && e.target.matches('.logout, .logout i, .logout *')) {
        e.preventDefault();
        
        // Clear user data
        localStorage.removeItem('userEmail');
        sessionStorage.removeItem('userEmail');
        
        // Redirect to login page
        window.location.href = e.target.closest('a').href;
    }
});

// Add styles needed for user menu on home page
function addUserMenuStyles() {
    // Check if styles already exist
    if (document.getElementById('user-menu-styles')) return;
    
    const styleTag = document.createElement('style');
    styleTag.id = 'user-menu-styles';
    styleTag.textContent = `
        .navbar .user-controls {
            display: flex;
            gap: 15px;
            align-items: center;
        }
        
        .navbar .user-avatar {
            width: 35px;
            height: 35px;
            border-radius: 50%;
            overflow: hidden;
            background-color: var(--light-gray);
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--primary-color);
            font-weight: bold;
            cursor: pointer;
        }
        
        .navbar .user-menu {
            position: relative;
        }
        
        .navbar .user-dropdown {
            position: absolute;
            top: 45px;
            right: 0;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
            width: 200px;
            overflow: hidden;
            visibility: hidden;
            opacity: 0;
            transform: translateY(-10px);
            transition: all 0.3s ease;
            z-index: 100;
        }
        
        .navbar .user-menu:hover .user-dropdown {
            visibility: visible;
            opacity: 1;
            transform: translateY(0);
        }
        
        .navbar .user-dropdown a {
            display: flex;
            align-items: center;
            padding: 12px 15px;
            color: var(--text-color);
            text-decoration: none;
            transition: all 0.2s;
        }
        
        .navbar .user-dropdown a:hover {
            background-color: var(--light-gray);
            color: var(--primary-color);
        }
        
        .navbar .user-dropdown a i {
            margin-right: 10px;
            width: 20px;
            text-align: center;
        }
        
        .navbar .user-dropdown .logout {
            border-top: 1px solid var(--light-gray);
            color: #dc3545;
        }
        
        .navbar .user-dropdown .logout:hover {
            background-color: #fff5f5;
        }
    `;
    
    document.head.appendChild(styleTag);
}
