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

                    alert("Login successful!");
                    window.location.href = '../dashboard/dashboard.html';
                },

                onFailure: function (err) {
                    alert(err.message || JSON.stringify(err));
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
});