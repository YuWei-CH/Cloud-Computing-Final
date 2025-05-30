// Variables to store state
let selectedFiles = [];

document.addEventListener('DOMContentLoaded', async function () {
    // Check authentication before loading page content
    const email = checkAuthentication();
    if (!email) {
        return;
    }

    try {
        // Set up event listeners for the page
        setupEventListeners();

        // Load user tickets
        await loadUserTickets(email);

    } catch (error) {
        console.error('Error initializing upload page:', error);
        showGhibliPopup("Oops!", "There was a problem loading your tickets.", "Try Again", () => {
            window.location.reload();
        });
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

// Set up event listeners for all page functionality
function setupEventListeners() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const mainUploadBtn = document.getElementById('main-upload-btn');

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

        // Show Ghibli popup for success
        showGhibliPopup(
            "Upload Complete!",
            `${selectedFiles.length > 1 ? 'Your tickets have' : 'Your ticket has'} been uploaded successfully.`,
            "View Tickets",
            function() {
                // Reload the page to show the new tickets
                window.location.reload();
            }
        );

    } catch (error) {
        console.error('Error uploading files:', error);
        hideLoading();
        showGhibliPopup(
            "Upload Failed",
            "We couldn't upload your tickets. Please try again later.",
            "OK"
        );
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

// Show loading indicator with Ghibli style
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

// Show error message with Ghibli style
function showError(message) {
    showGhibliPopup(
        "Oops!",
        message,
        "OK"
    );
}

// Function to show a custom Ghibli-style popup
function showGhibliPopup(title, message, buttonText = "OK", callback = null) {
    const popup = document.getElementById('ghibli-popup');
    const popupTitle = document.getElementById('popup-title');
    const popupMessage = document.getElementById('popup-message');
    const popupButton = document.getElementById('popup-button');
    
    if (!popup || !popupTitle || !popupMessage || !popupButton) {
        console.error("Popup elements not found, falling back to alert");
        alert(message);
        if (callback) callback();
        return;
    }
    
    // Set popup content
    popupTitle.textContent = title;
    popupMessage.textContent = message;
    popupButton.textContent = buttonText;
    
    // Show the popup with animation
    popup.classList.add('show');
    
    // Add button click handler
    const handleButtonClick = function() {
        popup.classList.remove('show');
        popupButton.removeEventListener('click', handleButtonClick);
        if (callback) {
            setTimeout(callback, 300); // Wait for animation to complete
        }
    };
    
    popupButton.addEventListener('click', handleButtonClick);
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

// Confirm before deleting a ticket - using Ghibli popup
function confirmDeleteTicket(ticketId, ticketElement) {
    showGhibliPopup(
        "Delete Ticket?",
        "Are you sure you want to delete this ticket? This action cannot be undone.",
        "Yes, Delete",
        function() {
            deleteTicket(ticketId, ticketElement);
        }
    );
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

            // Show success message using Ghibli popup
            showGhibliPopup(
                "Success!",
                "Your ticket has been deleted successfully.",
                "OK"
            );
        }, 300);

    } catch (error) {
        console.error('Error deleting ticket:', error);
        ticketElement.classList.remove('deleting');
        ticketElement.querySelector('.delete-ticket').disabled = false;
        
        // Show error message
        showGhibliPopup(
            "Delete Failed",
            "We couldn't delete the ticket. Please try again later.",
            "OK"
        );
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
