document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('register-form');
    const usernameInput = document.getElementById('username');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const togglePassword = document.getElementById('togglePassword');
    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    const usernameError = document.getElementById('username-error');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const confirmPasswordError = document.getElementById('confirm-password-error');

    // Toggle password visibility
    togglePassword.addEventListener('click', function () {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });

    // Password strength checker
    passwordInput.addEventListener('input', function () {
        const password = this.value;
        const strength = checkPasswordStrength(password);

        // Update strength bar
        strengthBar.style.width = strength.percent + '%';
        strengthBar.style.backgroundColor = strength.color;
        strengthText.textContent = strength.text;
        strengthText.style.color = strength.color;

        // Check confirm password match if it has a value
        if (confirmPasswordInput.value) {
            validateConfirmPassword(confirmPasswordInput.value);
        }
    });

    // Username validation
    usernameInput.addEventListener('blur', function () {
        validateUsername(this.value);
    });

    // Email validation
    emailInput.addEventListener('blur', function () {
        validateEmail(this.value);
    });

    // Confirm password validation
    confirmPasswordInput.addEventListener('input', function () {
        validateConfirmPassword(this.value);
    });

    // Form submission
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        // Validate all inputs before submission
        const isUsernameValid = validateUsername(usernameInput.value);
        const isEmailValid = validateEmail(emailInput.value);
        const isPasswordValid = validatePassword(passwordInput.value);
        const isConfirmPasswordValid = validateConfirmPassword(confirmPasswordInput.value);

        if (isUsernameValid && isEmailValid && isPasswordValid && isConfirmPasswordValid) {
            // Here you would typically send data to your backend
            const formData = {
                username: usernameInput.value,
                email: emailInput.value,
                password: passwordInput.value,
                weather: document.getElementById('weather').value,
                environment: document.getElementById('environment').value,
                activity: document.getElementById('activity').value
            };

            console.log('Form submitted with data:', formData);

            const poolData = config.cognito;

            const userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

            const attributeList = [
                new AmazonCognitoIdentity.CognitoUserAttribute({
                    Name: "email",
                    Value: emailInput.value
                })
            ];
            userPool.signUp(emailInput.value, passwordInput.value, attributeList, null, function (err, result) {
                if (err) {
                    alert(err.message || JSON.stringify(err));
                    return;
                }
                const cognitoUser = result.user;
                console.log("User name is " + cognitoUser.getUsername());
                alert("Signup success! Please check your email to confirm your account.");
                window.location.href = 'login.html';
            });
        }
    });

    // Add animation to form fields on focus
    const formInputs = document.querySelectorAll('input, select');
    formInputs.forEach(input => {
        input.addEventListener('focus', function () {
            this.parentElement.style.boxShadow = '0 0 0 2px rgba(67, 97, 238, 0.3)';
        });

        input.addEventListener('blur', function () {
            this.parentElement.style.boxShadow = 'none';
        });
    });

    // Helper functions
    function validateUsername(username) {
        if (username.length < 3) {
            usernameError.textContent = 'Username must be at least 3 characters long';
            usernameInput.parentElement.style.borderColor = 'var(--error-color)';
            return false;
        } else {
            usernameError.textContent = '';
            usernameInput.parentElement.style.borderColor = 'var(--border-color)';
            return true;
        }
    }

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
        if (password.length < 8) {
            passwordError.textContent = 'Password must be at least 8 characters long';
            passwordInput.parentElement.style.borderColor = 'var(--error-color)';
            return false;
        } else {
            passwordError.textContent = '';
            passwordInput.parentElement.style.borderColor = 'var(--border-color)';
            return true;
        }
    }

    function validateConfirmPassword(confirmPassword) {
        if (confirmPassword !== passwordInput.value) {
            confirmPasswordError.textContent = 'Passwords do not match';
            confirmPasswordInput.parentElement.style.borderColor = 'var(--error-color)';
            return false;
        } else if (confirmPassword === '') {
            confirmPasswordError.textContent = 'Please confirm your password';
            confirmPasswordInput.parentElement.style.borderColor = 'var(--error-color)';
            return false;
        } else {
            confirmPasswordError.textContent = '';
            confirmPasswordInput.parentElement.style.borderColor = 'var(--border-color)';
            return true;
        }
    }

    function checkPasswordStrength(password) {
        // Default values
        let strength = {
            percent: 0,
            color: '#e9ecef',
            text: 'Password strength'
        };

        if (!password) {
            return strength;
        }

        let score = 0;

        // Length check
        if (password.length >= 8) score += 1;
        if (password.length >= 12) score += 1;

        // Complexity checks
        if (/[A-Z]/.test(password)) score += 1;
        if (/[a-z]/.test(password)) score += 1;
        if (/[0-9]/.test(password)) score += 1;
        if (/[^A-Za-z0-9]/.test(password)) score += 1;

        // Determine strength based on score
        switch (true) {
            case (score <= 2):
                strength = {
                    percent: 25,
                    color: '#dc3545',
                    text: 'Weak'
                };
                break;
            case (score <= 4):
                strength = {
                    percent: 50,
                    color: '#ffc107',
                    text: 'Moderate'
                };
                break;
            case (score <= 5):
                strength = {
                    percent: 75,
                    color: '#17a2b8',
                    text: 'Strong'
                };
                break;
            case (score > 5):
                strength = {
                    percent: 100,
                    color: '#28a745',
                    text: 'Very Strong'
                };
                break;
        }

        return strength;
    }
});