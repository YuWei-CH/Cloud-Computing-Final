document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('login-form');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');

    // Toggle password visibility
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });

    // Email validation
    emailInput.addEventListener('blur', function () {
        validateEmail(this.value);
    });

    // Form submission
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Validate inputs before submission
        const isEmailValid = validateEmail(emailInput.value);
        const isPasswordValid = validatePassword(passwordInput.value);

        if (isEmailValid && isPasswordValid) {
            const formData = {
                email: emailInput.value,
                password: passwordInput.value,
                remember: document.getElementById('remember').checked
            };

            console.log('Login form submitted with data:', formData);

            const poolData = config.cognito;
            const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

            const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails({
                Username: emailInput.value,
                Password: passwordInput.value,
            });

            const userData = {
                Username: emailInput.value,
                Pool: userPool,
            };

            const cognitoUser = new AmazonCognitoIdentity.CognitoUser(userData);

            cognitoUser.authenticateUser(authenticationDetails, {
                onSuccess: function (result) {
                    console.log("Login successful.");

                    // Get the remember me preference
                    const rememberMe = document.getElementById('remember').checked;

                    // Get user email from form
                    const userEmail = emailInput.value;

                    // Store email with appropriate persistence
                    if (rememberMe) {
                        // Store in localStorage for longer persistence
                        localStorage.setItem('userEmail', userEmail);
                    } else {
                        // Store in sessionStorage for browser session only
                        sessionStorage.setItem('userEmail', userEmail);
                    }

                    showNotification("Login successful! Redirecting to dashboard...", "success");
                    setTimeout(() => {
                        window.location.href = '../dashboard/dashboard.html';
                    }, 1500);
                },

                onFailure: function (err) {
                    showNotification(err.message || JSON.stringify(err), "error");
                }
            });
        }
    });

    // Add animation to form fields on focus
    const formInputs = document.querySelectorAll('input:not([type=checkbox])');
    formInputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.style.boxShadow = '0 0 0 2px rgba(67, 97, 238, 0.3)';
        });

        input.addEventListener('blur', function () {
            this.parentElement.style.boxShadow = 'none';
        });
    });

    // Helper functions
    function validateEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = regex.test(email);

        if (!isValid && email !== '') {
            emailError.textContent = 'Please enter a valid email address';
            emailInput.parentElement.style.borderColor = 'var(--error-color)';
        } else {
            emailError.textContent = '';
            emailInput.parentElement.style.borderColor = 'var(--border-color)';
        }

        return isValid || email === '';
    }

    function validatePassword(password) {
        if (password === '') {
            passwordError.textContent = 'Please enter your password';
            passwordInput.parentElement.style.borderColor = 'var(--error-color)';
            return false;
        } else {
            passwordError.textContent = '';
            passwordInput.parentElement.style.borderColor = 'var(--border-color)';
            return true;
        }
    }

    function showNotification(message, type = 'success') {
        // Create notification element if it doesn't exist
        if (!document.getElementById('notification')) {
            const notification = document.createElement('div');
            notification.id = 'notification';
            notification.style.position = 'fixed';
            notification.style.top = '20px';
            notification.style.right = '20px';
            notification.style.padding = '15px 25px';
            notification.style.color = 'white';
            notification.style.borderRadius = '8px';
            notification.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.1)';
            notification.style.zIndex = '1000';
            notification.style.transition = 'all 0.3s ease';
            notification.style.transform = 'translateY(-100px)';
            notification.style.opacity = '0';
            notification.style.display = 'flex';
            notification.style.alignItems = 'center';
            notification.style.gap = '10px';
            notification.style.fontWeight = '500';

            document.body.appendChild(notification);
        }

        const notification = document.getElementById('notification');

        // Set color based on type
        if (type === 'success') {
            notification.style.backgroundColor = 'var(--success-color)';
            notification.innerHTML = `<i class="fas fa-check-circle"></i> ${message}`;
        } else if (type === 'error') {
            notification.style.backgroundColor = 'var(--error-color)';
            notification.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
        }

        // Show notification
        notification.style.transform = 'translateY(0)';
        notification.style.opacity = '1';

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.style.transform = 'translateY(-100px)';
            notification.style.opacity = '0';
        }, 3000);
    }
});