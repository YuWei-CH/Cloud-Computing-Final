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
            // Here you would typically send data to your backend for authentication
            const formData = {
                email: emailInput.value,
                password: passwordInput.value,
                remember: document.getElementById('remember').checked
            };

            console.log('Login form submitted with data:', formData);

            // In a real application, you would send this data to your AWS backend
            // Example:
            // fetch('https://your-aws-api-endpoint.com/login', {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //     },
            //     body: JSON.stringify(formData)
            // })
            // .then(response => response.json())
            // .then(data => {
            //     // Handle successful login
            //     // Redirect to dashboard or home page
            // })
            // .catch(error => {
            //     // Handle login error
            //     passwordError.textContent = 'Invalid email or password';
            // });

            // Simulating successful login for demo purposes
            alert('Login successful! You will be redirected to the dashboard.');
            // window.location.href = 'dashboard.html';
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