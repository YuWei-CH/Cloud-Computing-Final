// Variables to store state
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication before loading page content
    const email = checkAuthentication();
    if (!email) {
        return;
    }

    try {
        // Check if a trip ID was provided in the URL
        const urlParams = new URLSearchParams(window.location.search);
        const tripIdFromUrl = urlParams.get('tripId');

        // Load upcoming trips
        const trips = await loadUpcomingTrips(email);

        // Set up event listeners for the page
        setupEventListeners(trips);

        // If trip ID was provided in URL, pre-select that trip and open upload section
        if (tripIdFromUrl) {
            preSelectTrip(tripIdFromUrl, trips);
        }

        // Load user tickets
        await loadUserTickets(email);

    } catch (error) {
        console.error('Error initializing upload page:', error);
        showError("There was a problem loading your trips.");
    }
});

// Pre-select a trip based on ID from URL parameter
function preSelectTrip(tripId, trips) {
    if (!tripId || !trips || trips.length === 0) return;

    // Find the trip in our loaded trips
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return;

    // Show the upload section
    document.getElementById('upload-section').style.display = 'block';

    // Scroll to the upload section
    document.getElementById('upload-section').scrollIntoView({
        behavior: 'smooth'
    });
}

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

    // Clear existing content
    tripSelector.innerHTML = '';

    if (!trips || trips.length === 0) {
        tripSelector.innerHTML = '<div class="no-trips-message">You have no upcoming trips. Create a trip first!</div>';
        return;
    }

    // Sort trips by start date (earliest first)
    trips.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    // Create trip cards for display in list
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
            <div class="trip-details">
                <h3>${trip.title || `Trip to ${trip.start_city}`}</h3>
                <div>
                    <i class="far fa-calendar-alt"></i> ${dateRange}
                </div>
                <div>
                    <i class="fas fa-map-marker-alt"></i> ${trip.start_city} to ${trip.end_city}
                </div>
            </div>
        `;

        tripSelector.appendChild(tripElement);
    });
}

// Set up event listeners for all page functionality
function setupEventListeners(trips) {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const mainUploadBtn = document.getElementById('main-upload-btn');

    // Remove tripDropdown reference and event listener

    // Main upload button shows the upload section
    mainUploadBtn.addEventListener('click', function () {
        document.getElementById('upload-section').style.display = 'block';
        document.getElementById('upload-section').scrollIntoView({
            behavior: 'smooth'
        });
    });

    // File input change event
    fileInput.addEventListener('change', handleFileSelect);

    // Drag and drop events for file drop area
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

    // Fix for double file dialog - simplified click handler
    dropArea.addEventListener('click', () => {
        // Simply trigger the file input
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

    // Set up tab navigation for tickets
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons and content
            tabButtons.forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Add active class to clicked button and corresponding content
            button.classList.add('active');
            const tabName = button.getAttribute('data-tab');
            document.getElementById(`${tabName}-tickets`).classList.add('active');
        });
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
    if (selectedFiles.length === 0) {
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

        // For each file, upload to the API
        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];

            // Update progress bar
            const progress = (i / selectedFiles.length) * 100;
            progressBar.style.width = `${progress}%`;

            // Get file content type
            let contentType;
            if (file.type.includes('jpeg') || file.type.includes('jpg')) {
                contentType = 'image/jpeg';
            } else if (file.type.includes('png')) {
                contentType = 'image/png';
            } else if (file.type.includes('pdf')) {
                contentType = 'application/pdf';
            } else {
                // Default to binary for unknown types
                contentType = 'application/octet-stream';
            }

            // Create the API URL (removed the tripId parameter)
            const apiUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/tickets?filename=${encodeURIComponent(file.name)}`;

            try {
                // Read the file as an ArrayBuffer
                const fileContent = await readFileAsArrayBuffer(file);

                // Make the API call
                const response = await fetch(apiUrl, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': contentType,
                        'x-amz-meta-userEmail': email
                    },
                    body: fileContent
                });

                if (!response.ok) {
                    throw new Error(`Upload failed with status: ${response.status}`);
                }

                console.log(`File ${file.name} uploaded successfully`);
            } catch (uploadError) {
                console.error('Error uploading file:', uploadError);
                throw uploadError;
            }
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

// Read file as ArrayBuffer (needed for binary upload)
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
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

// Load user tickets from the API
async function loadUserTickets(email) {
    try {
        const futureTicketsContainer = document.getElementById('future-tickets');
        const pastTicketsContainer = document.getElementById('past-tickets');

        // Set loading state
        futureTicketsContainer.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-spinner fa-spin"></i> Loading your tickets...
            </div>
        `;
        pastTicketsContainer.innerHTML = `
            <div class="loading-indicator">
                <i class="fas fa-spinner fa-spin"></i> Loading your tickets...
            </div>
        `;

        // Fetch tickets from API
        const url = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/tickets?user_email=${encodeURIComponent(email)}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tickets: ${response.status}`);
        }

        const data = await response.json();

        // Render future tickets
        renderTickets(data.future, futureTicketsContainer, 'future');

        // Render past tickets
        renderTickets(data.past, pastTicketsContainer, 'past');

    } catch (error) {
        console.error('Error loading tickets:', error);
        document.getElementById('future-tickets').innerHTML = `
            <div class="tickets-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>There was a problem loading your tickets. Please try again later.</p>
            </div>
        `;
        document.getElementById('past-tickets').innerHTML = `
            <div class="tickets-empty">
                <i class="fas fa-exclamation-circle"></i>
                <p>There was a problem loading your tickets. Please try again later.</p>
            </div>
        `;
    }
}

// Render tickets to the appropriate container
function renderTickets(tickets, container, type) {
    if (!tickets || tickets.length === 0) {
        container.innerHTML = `
            <div class="tickets-empty">
                <i class="fas fa-ticket-alt"></i>
                <p>You don't have any ${type === 'future' ? 'upcoming' : 'past'} tickets.</p>
                ${type === 'future' ? '<p>Upload your travel tickets to see them here!</p>' : ''}
            </div>
        `;
        return;
    }

    // Create tickets list container
    const ticketsList = document.createElement('div');
    ticketsList.className = 'tickets-list';

    // Add each ticket
    tickets.forEach(ticket => {
        // Format dates
        const departureDate = new Date(ticket.departure_datetime);
        const arrivalDate = new Date(ticket.arrival_datetime);

        const formatDate = (date) => {
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        };

        const formatTime = (date) => {
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        };

        // Create ticket card
        const ticketCard = document.createElement('div');
        ticketCard.className = 'ticket-card';

        // Add ticket ID as data attribute for future delete functionality
        ticketCard.dataset.ticketId = ticket.id;

        // Set ticket icon based on type
        let typeIcon = 'fa-plane';
        if (ticket.type === 'train') {
            typeIcon = 'fa-train';
        } else if (ticket.type === 'bus') {
            typeIcon = 'fa-bus';
        } else if (ticket.type === 'ship') {
            typeIcon = 'fa-ship';
        }

        ticketCard.innerHTML = `
            <div class="ticket-type">${ticket.type}</div>
            <div class="ticket-header">
                <div class="ticket-number">Ticket #${ticket.ticket_number}</div>
            </div>
            <div class="ticket-route">
                <div class="ticket-city departure">
                    <div class="code">${ticket.departure_code || '—'}</div>
                    <div class="name">${ticket.departure_city}</div>
                </div>
                <div class="ticket-route-divider">
                    <i class="fas ${typeIcon} ticket-route-icon"></i>
                    <div class="ticket-route-line"></div>
                </div>
                <div class="ticket-city arrival">
                    <div class="code">${ticket.arrival_code || '—'}</div>
                    <div class="name">${ticket.arrival_city}</div>
                </div>
            </div>
            <div class="ticket-details">
                <div class="ticket-detail">
                    <div class="ticket-detail-label">Departure</div>
                    <div class="ticket-detail-value">${formatDate(departureDate)}</div>
                    <div class="ticket-detail-value">${formatTime(departureDate)}</div>
                </div>
                <div class="ticket-detail">
                    <div class="ticket-detail-label">Arrival</div>
                    <div class="ticket-detail-value">${formatDate(arrivalDate)}</div>
                    <div class="ticket-detail-value">${formatTime(arrivalDate)}</div>
                </div>
                ${ticket.seats ? `
                <div class="ticket-detail">
                    <div class="ticket-detail-label">Seat</div>
                    <div class="ticket-detail-value">${ticket.seats}</div>
                </div>
                ` : ''}
            </div>
            <div class="ticket-actions">
                <button class="delete-ticket" data-ticket-id="${ticket.id}">
                    <i class="fas fa-trash-alt"></i> Delete
                </button>
            </div>
        `;

        ticketsList.appendChild(ticketCard);

        // Add event listener to delete button
        setTimeout(() => {
            const deleteBtn = ticketCard.querySelector('.delete-ticket');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function () {
                    confirmDeleteTicket(ticket.id, ticketCard);
                });
            }
        }, 0);
    });

    // Replace loading indicator with tickets list
    container.innerHTML = '';
    container.appendChild(ticketsList);
}

// Confirm before deleting a ticket
function confirmDeleteTicket(ticketId, ticketElement) {
    if (confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) {
        deleteTicket(ticketId, ticketElement);
    }
}

// Delete a ticket using the API
async function deleteTicket(ticketId, ticketElement) {
    try {
        // Show loading state on the ticket card
        ticketElement.classList.add('deleting');
        ticketElement.querySelector('.delete-ticket').disabled = true;

        // Call the DELETE API endpoint
        const apiUrl = `https://af6zo8cu88.execute-api.us-east-2.amazonaws.com/Prod/tickets/${ticketId}`;

        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`Delete failed with status: ${response.status}`);
        }

        // Handle success - remove the ticket from the UI with animation
        ticketElement.classList.add('deleted');

        // After animation completes, remove the element
        setTimeout(() => {
            ticketElement.remove();

            // Check if there are no tickets left and show empty message if needed
            updateEmptyState();

            // Show success message
            showSuccessToast('Ticket deleted successfully');
        }, 300);

    } catch (error) {
        console.error('Error deleting ticket:', error);
        ticketElement.classList.remove('deleting');
        ticketElement.querySelector('.delete-ticket').disabled = false;
        showError("Couldn't delete the ticket. Please try again later.");
    }
}

// Check if there are no tickets and update the UI accordingly
function updateEmptyState() {
    const futureTickets = document.querySelector('#future-tickets .tickets-list');
    const pastTickets = document.querySelector('#past-tickets .tickets-list');

    // Check future tickets
    if (futureTickets && (!futureTickets.children.length || futureTickets.children.length === 0)) {
        document.getElementById('future-tickets').innerHTML = `
            <div class="tickets-empty">
                <i class="fas fa-ticket-alt"></i>
                <p>You don't have any upcoming tickets.</p>
                <p>Upload your travel tickets to see them here!</p>
            </div>
        `;
    }

    // Check past tickets
    if (pastTickets && (!pastTickets.children.length || pastTickets.children.length === 0)) {
        document.getElementById('past-tickets').innerHTML = `
            <div class="tickets-empty">
                <i class="fas fa-ticket-alt"></i>
                <p>You don't have any past tickets.</p>
            </div>
        `;
    }
}

// Show a success toast message
function showSuccessToast(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
        <i class="fas fa-check-circle"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
