// Variables to store state
let selectedTripId = null;
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication before loading page content
    const email = checkAuthentication();
    if (!email) {
        return;
    }

    try {
        // Load upcoming trips
        await loadUpcomingTrips(email);

        // Set up event listeners
        setupEventListeners();

    } catch (error) {
        console.error('Error initializing upload page:', error);
        showError("There was a problem loading your trips.");
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

// Function to load upcoming trips for current user
async function loadUpcomingTrips(email) {
    try {
        showLoading("Loading your upcoming trips...");

        // Get userId from email - just use email as userId for simplicity
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

        // Extract trips from the response
        let trips = [];

        if (data.statusCode && data.body) {
            // Handle Lambda proxy response format
            try {
                // Handle both string and object body
                const bodyContent = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
                if (bodyContent.trips) {
                    trips = bodyContent.trips;
                }
            } catch (e) {
                console.error("Failed to parse response body:", e);
            }
        } else if (data.trips) {
            // Direct response with trips array
            trips = data.trips;
        }

        console.log(`Found ${trips.length} trips:`, trips);

        // Filter for upcoming trips only
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const upcomingTrips = trips.filter(trip => {
            const startDate = new Date(trip.start_date);
            startDate.setHours(0, 0, 0, 0);
            return startDate >= today;
        });

        console.log(`Found ${upcomingTrips.length} upcoming trips:`, upcomingTrips);

        // Render the upcoming trips in the UI
        renderUpcomingTrips(upcomingTrips);

        hideLoading();
        return upcomingTrips;
    } catch (error) {
        console.error('Error loading trips:', error);
        hideLoading();
        showError("Couldn't load your trips. Please try again later.");

        // Return empty array to avoid errors
        return [];
    }
}

// Render upcoming trips in the trip selector
function renderUpcomingTrips(trips) {
    const tripSelector = document.getElementById('trip-selector');
    tripSelector.innerHTML = ''; // Clear existing content

    if (!trips || trips.length === 0) {
        tripSelector.innerHTML = '<div class="no-trips-message">You have no upcoming trips. Create a trip first!</div>';
        return;
    }

    // Sort trips by start date (earliest first)
    trips.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    trips.forEach(trip => {
        const startDate = new Date(trip.start_date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + (trip.duration || 0));

        // Format dates for display
        const formatDate = (date) => {
            return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
        };

        const dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;

        const tripElement = document.createElement('div');
        tripElement.className = 'trip-item';
        tripElement.dataset.tripId = trip.id;
        tripElement.innerHTML = `
            <h3>${trip.title || `Trip to ${trip.start_city}`}</h3>
            <div>
                <i class="far fa-calendar-alt"></i> ${dateRange}
            </div>
            <div>
                <i class="fas fa-map-marker-alt"></i> ${trip.start_city} to ${trip.end_city}
            </div>
        `;

        tripElement.addEventListener('click', function () {
            // Remove selected class from all trips
            document.querySelectorAll('.trip-item').forEach(item => {
                item.classList.remove('selected');
            });

            // Add selected class to this trip
            tripElement.classList.add('selected');

            // Store the selected trip ID
            selectedTripId = trip.id;

            // Update the upload section title
            document.getElementById('selected-trip-name').textContent = trip.title || `Trip to ${trip.start_city}`;

            // Show the upload section
            document.getElementById('upload-section').style.display = 'block';

            // Scroll to the upload section
            document.getElementById('upload-section').scrollIntoView({
                behavior: 'smooth'
            });
        });

        tripSelector.appendChild(tripElement);
    });
}

// Set up event listeners for file upload functionality
function setupEventListeners() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when dragging over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => {
            dropArea.classList.remove('dragover');
        }, false);
    });

    // Handle dropped files
    dropArea.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndAddFiles(files);
        }
    });

    // Click to browse files
    dropArea.addEventListener('click', () => {
        fileInput.click();
    });

    // Upload button click
    uploadBtn.addEventListener('click', uploadFiles);

    // Cancel button click
    cancelBtn.addEventListener('click', () => {
        // Clear selected files
        selectedFiles = [];
        document.getElementById('file-preview').innerHTML = '';

        // Hide error message
        document.getElementById('file-error').style.display = 'none';

        // Disable upload button
        uploadBtn.disabled = true;

        // Hide success message
        document.getElementById('upload-success').style.display = 'none';
    });
}

// Handle file selection from input
function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        validateAndAddFiles(files);
    }
}

// Validate and add files to the selected files array
function validateAndAddFiles(files) {
    const errorElement = document.getElementById('file-error');
    const filePreview = document.getElementById('file-preview');
    const uploadBtn = document.getElementById('upload-btn');

    // Check file types
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();

        // Check if file is an image (jpg, jpeg, png) or PDF
        if (
            fileType === 'image/jpeg' ||
            fileType === 'image/jpg' ||
            fileType === 'image/png' ||
            fileType === 'application/pdf' ||
            fileName.endsWith('.jpg') ||
            fileName.endsWith('.jpeg') ||
            fileName.endsWith('.png') ||
            fileName.endsWith('.pdf')
        ) {
            // Valid file type
            selectedFiles.push(file);

            // Create preview element
            const fileElement = document.createElement('div');
            fileElement.className = 'selected-file';

            // Get appropriate icon
            let fileIcon;
            if (fileType.includes('image')) {
                fileIcon = 'fa-file-image';
            } else if (fileType.includes('pdf')) {
                fileIcon = 'fa-file-pdf';
            } else {
                fileIcon = 'fa-file';
            }

            fileElement.innerHTML = `
                <i class="fas ${fileIcon}"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">(${formatFileSize(file.size)})</span>
                <i class="fas fa-times remove-file"></i>
            `;

            // Add event listener to remove file
            fileElement.querySelector('.remove-file').addEventListener('click', function () {
                // Remove file from selectedFiles array
                const index = selectedFiles.indexOf(file);
                if (index !== -1) {
                    selectedFiles.splice(index, 1);
                }

                // Remove preview element
                fileElement.remove();

                // Disable upload button if no files selected
                if (selectedFiles.length === 0) {
                    uploadBtn.disabled = true;
                }
            });

            filePreview.appendChild(fileElement);
        } else {
            // Invalid file type
            errorElement.textContent = `Error: "${file.name}" is not a supported file type. Please upload JPG, JPEG, PNG, or PDF files only.`;
            errorElement.style.display = 'block';

            // Auto-hide error after 5 seconds
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);

            continue;
        }
    }

    // Enable upload button if files are selected
    if (selectedFiles.length > 0) {
        uploadBtn.disabled = false;
    }

    // Reset file input
    document.getElementById('file-input').value = '';
}

// Format file size for display
function formatFileSize(bytes) {
    if (bytes < 1024) {
        return bytes + ' bytes';
    } else if (bytes < 1048576) {
        return (bytes / 1024).toFixed(1) + ' KB';
    } else {
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
}

// Upload files to the server
async function uploadFiles() {
    if (!selectedTripId || selectedFiles.length === 0) {
        return;
    }

    try {
        showLoading("Uploading your tickets...");

        // Get user email for authentication
        const email = localStorage.getItem('userEmail') || sessionStorage.getItem('userEmail');

        // Show upload progress
        const progressElement = document.getElementById('upload-progress');
        const progressBar = document.getElementById('progress-bar');
        progressElement.style.display = 'block';

        // For each file, create formData and upload
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            // Update progress bar
            const progress = (i / selectedFiles.length) * 100;
            progressBar.style.width = `${progress}%`;

            // Create FormData
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tripId', selectedTripId);
            formData.append('email', email);

            // Upload URL - you'll need to replace this with your actual API endpoint
            const url = 'https://your-api-endpoint-for-file-upload.com/upload';

            // Simulate upload for now (since we don't have the actual API)
            // In a real implementation, you would use this:
            /*
            const response = await fetch(url, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed with status: ${response.status}`);
            }
            
            const result = await response.json();
            console.log('Upload result:', result);
            */

            // For demonstration, we'll simulate an API call with a delay
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Complete progress bar
        progressBar.style.width = '100%';

        // Show success message
        document.getElementById('upload-success').style.display = 'block';

        // Clear selected files
        selectedFiles = [];
        document.getElementById('file-preview').innerHTML = '';

        // Disable upload button
        document.getElementById('upload-btn').disabled = true;

        hideLoading();

        // Hide progress bar after a delay
        setTimeout(() => {
            progressElement.style.display = 'none';
            progressBar.style.width = '0';
        }, 2000);

    } catch (error) {
        console.error('Error uploading files:', error);
        hideLoading();
        showError("Couldn't upload your files. Please try again later.");
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
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '20px';
    errorDiv.style.left = '50%';
    errorDiv.style.transform = 'translateX(-50%)';
    errorDiv.style.zIndex = '2000';
    errorDiv.style.padding = '15px 20px';
    errorDiv.style.borderRadius = '5px';
    errorDiv.style.backgroundColor = '#f8d7da';
    errorDiv.style.color = '#721c24';
    errorDiv.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';

    // Add to page
    document.body.appendChild(errorDiv);

    // Auto remove after 5 seconds
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}
