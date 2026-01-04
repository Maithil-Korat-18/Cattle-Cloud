<<<<<<< HEAD:static/js/login.js
// API Configuration
        const API_URL = '/api';
        
        const container = document.querySelector('.container');
        const registerBtn = document.querySelector('.register-btn');
        const loginBtn = document.querySelector('.login-btn');
        const backArrow = document.getElementById('backArrow');
        
        let currentStep = 1;
        let registrationData = {};
        let verificationCodeSent = false;
        let emailVerified = false;

        // Google Sign-In Configuration
        const GOOGLE_CLIENT_ID = '654239516719-fvbmjp61hu20mevnsc7n883is6vj7ud9.apps.googleusercontent.com';

        // Rate Limiter Class
        class RateLimiter {
            constructor(maxAttempts = 3, timeWindow = 60000) {
                this.attempts = {};
                this.maxAttempts = maxAttempts;
                this.timeWindow = timeWindow;
            }
            
            canAttempt(key) {
                const now = Date.now();
                
                if (!this.attempts[key]) {
                    this.attempts[key] = [];
                }
                
                this.attempts[key] = this.attempts[key].filter(
                    timestamp => now - timestamp < this.timeWindow
                );
                
                if (this.attempts[key].length >= this.maxAttempts) {
                    return {
                        allowed: false,
                        message: `Too many attempts. Please try again in ${Math.ceil((this.attempts[key][0] + this.timeWindow - now) / 1000)} seconds`
                    };
                }
                
                this.attempts[key].push(now);
                return { allowed: true };
            }
        }

        const loginLimiter = new RateLimiter(5, 300000); // 5 attempts per 5 minutes
        const verificationLimiter = new RateLimiter(3, 60000); // 3 attempts per minute

        // Validation Functions
        function validateEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!email.trim()) {
                return { valid: false, message: 'Email is required' };
            }
            
            if (!emailRegex.test(email)) {
                return { valid: false, message: 'Please enter a valid email address' };
            }
            
            const domain = email.split('@')[1]?.toLowerCase();
            
            if (domain && domain.includes('..')) {
                return { valid: false, message: 'Invalid email format' };
            }
            
            return { valid: true };
        }

        function validatePhone(phone) {
            const cleaned = phone.replace(/[\s\-\(\)]/g, '');
            
            if (!cleaned) {
                return { valid: false, message: 'Phone number is required' };
            }
            
            if (!/^\d{10}$/.test(cleaned)) {
                return { valid: false, message: 'Phone number must be exactly 10 digits' };
            }
            
            if (cleaned[0] === '0' || cleaned[0] === '1') {
                return { valid: false, message: 'Phone number cannot start with 0 or 1' };
            }
            
            return { valid: true, cleaned: cleaned };
        }

        function validatePassword(password) {
            if (!password) {
                return { valid: false, message: 'Password is required' };
            }
            
            if (password.length < 8) {
                return { valid: false, message: 'Password must be at least 8 characters' };
            }
            
            if (password.length > 128) {
                return { valid: false, message: 'Password must be less than 128 characters' };
            }
            
            if (!/[A-Z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one uppercase letter' };
            }
            
            if (!/[a-z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one lowercase letter' };
            }
            
            if (!/\d/.test(password)) {
                return { valid: false, message: 'Password must contain at least one number' };
            }
            
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one special character' };
            }
            
            const weakPasswords = ['password', '12345678', 'qwerty123', 'abc123456', 'password123'];
            if (weakPasswords.includes(password.toLowerCase())) {
                return { valid: false, message: 'This password is too common. Please choose a stronger password' };
            }
            
            return { valid: true };
        }

        function validateFullName(name) {
            if (!name.trim()) {
                return { valid: false, message: 'Full name is required' };
            }
            
            if (name.trim().length < 2) {
                return { valid: false, message: 'Name must be at least 2 characters' };
            }
            
            if (name.trim().length > 100) {
                return { valid: false, message: 'Name must be less than 100 characters' };
            }
            
            if (!/^[a-zA-Z\s\-']+$/.test(name)) {
                return { valid: false, message: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
            }
            
            const nameParts = name.trim().split(/\s+/);
            if (nameParts.length < 2) {
                return { valid: false, message: 'Please enter your full name (first and last name)' };
            }
            
            return { valid: true };
        }

        function validateVerificationCode(code) {
            if (!code) {
                return { valid: false, message: 'Verification code is required' };
            }
            
            const cleaned = code.replace(/\s/g, '');
            
            if (!/^\d{6}$/.test(cleaned)) {
                return { valid: false, message: 'Verification code must be 6 digits' };
            }
            
            return { valid: true, cleaned: cleaned };
        }

        function sanitizeInput(input) {
            const div = document.createElement('div');
            div.textContent = input;
            return div.innerHTML
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .trim();
        }

        // Function to show specific step
        function showStep(step) {
            document.querySelectorAll('.registration-step').forEach(s => {
                s.classList.remove('active-step');
            });
            
            document.getElementById('step' + step).classList.add('active-step');
            currentStep = step;
            
            if (step > 1) {
                backArrow.style.display = 'block';
            } else {
                backArrow.style.display = 'none';
            }
        }

        // Back arrow functionality
        backArrow.addEventListener('click', () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });

        // API Functions
        async function sendVerificationCodeAPI(email) {
            try {
                const response = await fetch(`${API_URL}/send-verification-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server. Please make sure the Flask server is running on port 5000.' };
            }
        }

        async function verifyEmailCodeAPI(email, code, purpose = 'registration') {
            try {
                const response = await fetch(`${API_URL}/verify-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, code, purpose })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function sendResetCodeAPI(email) {
            try {
                const response = await fetch(`${API_URL}/send-reset-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function resetPasswordAPI(email, password) {
            try {
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function completeRegistration(userData) {
            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(userData)
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function loginUser(emailOrPhone, password) {
            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials:'include',
                    body: JSON.stringify({ emailOrPhone, password })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function googleLoginAPI(email, name, googleId) {
            try {
                const response = await fetch(`${API_URL}/google-login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, name, googleId })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        // Initialize Google Sign-In
        function initGoogleSignIn() {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleLogin
            });

            // Render Google Sign-In button for login
            google.accounts.id.renderButton(
                document.getElementById('googleLoginDiv'),
                { 
                    theme: 'outline', 
                    size: 'large',
                    width: 250,
                    text: 'signin_with'
                }
            );
        }

        // Handle Google Login Response
        function handleGoogleLogin(response) {
            const userInfo = parseJwt(response.credential);
            
            console.log('Google Login Success:', {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub
            });

            googleLoginAPI(userInfo.email, userInfo.name, userInfo.sub).then(result => {
                if (result.success) {
                    console.log('User data:', result.user);
                    window.location.href = '/home';
                } else {
                    showMessage('error', result.message);
                }
            });
        }

        // Parse JWT token
        function parseJwt(token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        }

        // Handle Google icon clicks
        document.getElementById('googleIconLogin').addEventListener('click', function(e) {
            e.preventDefault();
            google.accounts.id.prompt();
        });

        // Initialize Google Sign-In when page loads
        window.onload = function() {
            initGoogleSignIn();
        };

        registerBtn.addEventListener('click', () => {
            container.classList.add('active');
            resetRegistration();
        });

        loginBtn.addEventListener('click', () => {
            container.classList.remove('active');
            resetRegistration();
        });

        // Helper function to show messages
        function showMessage(type, message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
            messageDiv.textContent = message;
            messageDiv.style.position = 'fixed';
            messageDiv.style.top = '20px';
            messageDiv.style.right = '20px';
            messageDiv.style.zIndex = '10000';
            messageDiv.style.maxWidth = '400px';
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }

        // Login form submission
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const emailOrPhone = this.querySelector('input[type="text"]').value;
            const password = this.querySelector('input[type="password"]').value;
            
            if (!emailOrPhone || !password) {
                showMessage('error', 'Please enter email/phone and password');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            
            const result = await loginUser(emailOrPhone, password);
            
            if (result.success) {
                window.location.href = '/home';
            } else {
                showMessage('error', result.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });

        // Step 1 form submission
        document.getElementById('step1Form').addEventListener('submit', function (e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName');
            const phone = document.getElementById('phone');

            if (!fullName.value.trim()) {
                showError(fullName, 'Full name is required');
                return;
            }

            if (!phone.value.trim()) {
                showError(phone, 'Phone number is required');
                return;
            }

            if (!/^[0-9]{10}$/.test(phone.value)) {
                showError(phone, 'Phone number must be 10 digits');
                return;
            }

            registrationData.fullName = fullName.value;
            registrationData.phone = phone.value;

            showStep(2);
        });

        // Send verification code for registration
        document.getElementById('verifyEmailBtn').addEventListener('click', async function() {
            const email = document.getElementById('email');
            const emailError = document.getElementById('emailError');
            
            email.classList.remove('error-input');
            emailError.style.display = 'none';
            
            if (!email.value.trim()) {
                email.classList.add('error-input');
                emailError.textContent = 'Email is required';
                emailError.style.display = 'block';
                return;
            }
            
            if (!email.value.includes('@') || !email.value.includes('.')) {
                email.classList.add('error-input');
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Sending...';
            
            const result = await sendVerificationCodeAPI(email.value);
            
            if (result.success) {
                registrationData.email = email.value;
                document.getElementById('displayEmail').textContent = email.value;
                document.getElementById('verificationPopup').classList.add('show');
                showMessage('success', 'Verification code sent to your email');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Email';
        });

        // Verify code for registration
        document.getElementById('verifyCodeBtn').addEventListener('click', async function() {
            const code = document.getElementById('verificationCode').value;
            
            if (!code) {
                showMessage('error', 'Please enter the verification code');
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Verifying...';
            
            const result = await verifyEmailCodeAPI(registrationData.email, code, 'registration');
            
            if (result.success) {
                emailVerified = true;
                document.getElementById('verificationPopup').classList.remove('show');
                document.getElementById('verificationCode').value = '';
                showMessage('success', 'Email verified successfully');
                showStep(3);
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Code';
        });

        // Change email link
        document.getElementById('changeEmailLink').addEventListener('click', function() {
            document.getElementById('verificationPopup').classList.remove('show');
            document.getElementById('verificationCode').value = '';
            emailVerified = false;
            document.getElementById('email').focus();
        });

        // Step 2 form submission
        document.getElementById('step2Form').addEventListener('submit', function(e) {
            e.preventDefault();
        });

        // Step 3 form submission - Save to database
        document.getElementById('step3Form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            clearErrors();
            
            const password = document.getElementById('password');
            const confirmPassword = document.getElementById('confirmPassword');
            const errorDiv = document.getElementById('passwordError');
            
            let hasError = false;
            
            if (!password.value) {
                showError(password, 'Password is required');
                hasError = true;
            } else if (password.value.length < 8) {
                showError(password, 'Password must be at least 8 characters long');
                hasError = true;
            }
            
            if (!confirmPassword.value) {
                showError(confirmPassword, 'Please confirm your password');
                hasError = true;
            } else if (password.value !== confirmPassword.value) {
                showError(confirmPassword, 'Passwords do not match');
                errorDiv.textContent = 'Passwords do not match!';
                errorDiv.style.display = 'block';
                hasError = true;
            }
            
            if (hasError) return;
            
            registrationData.password = password.value;
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';
            
            const result = await completeRegistration(registrationData);
            
            if (result.success) {
                console.log('Registration Data saved:', registrationData);
                showMessage('success', 'Registration completed successfully! You can now login.');
                
                container.classList.remove('active');
                resetRegistration();
            } else {
                showMessage('error', result.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Complete Registration';
            }
        });

        // Forgot Password functionality
        const forgotLink = document.querySelector('.forgot-link a');
        const forgotEmailStep = document.getElementById('forgotEmailStep');
        const forgotResetStep = document.getElementById('forgotResetStep');
        const loginContainer = document.querySelector('.form-box.login');
        const forgotBackArrow = document.getElementById('forgotBackArrow');
        const resetBackArrow = document.getElementById('resetBackArrow');
        
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginContainer.classList.add('hide');
            forgotEmailStep.classList.add('show');
        });
        
        forgotBackArrow.addEventListener('click', function() {
            forgotEmailStep.classList.remove('show');
            loginContainer.classList.remove('hide');
            document.getElementById('forgotEmailForm').reset();
            clearErrors();
        });
        
        resetBackArrow.addEventListener('click', function() {
            forgotResetStep.classList.remove('show');
            forgotEmailStep.classList.add('show');
            document.getElementById('resetPasswordForm').reset();
            clearErrors();
        });
        
        // Send reset code for forgot password
        document.getElementById('sendResetCodeBtn').addEventListener('click', async function() {
            const email = document.getElementById('forgotEmail');
            const emailError = document.getElementById('forgotEmailError');
            
            email.classList.remove('error-input');
            emailError.style.display = 'none';
            
            if (!email.value.trim()) {
                email.classList.add('error-input');
                emailError.textContent = 'Email is required';
                emailError.style.display = 'block';
                return;
            }
            
            if (!email.value.includes('@') || !email.value.includes('.')) {
                email.classList.add('error-input');
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Sending...';
            
            const result = await sendResetCodeAPI(email.value);
            
            if (result.success) {
                document.getElementById('displayForgotEmail').textContent = email.value;
                document.getElementById('forgotVerificationPopup').classList.add('show');
                showMessage('success', 'Reset code sent to your email');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Send Reset Code';
        });
        
        // Verify reset code for forgot password
        document.getElementById('verifyResetCodeBtn').addEventListener('click', async function() {
            const code = document.getElementById('forgotVerificationCode').value;
            const email = document.getElementById('forgotEmail').value;
            
            if (!code) {
                showMessage('error', 'Please enter the reset code');
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Verifying...';
            
            const result = await verifyEmailCodeAPI(email, code, 'reset');
            
            if (result.success) {
                document.getElementById('forgotVerificationPopup').classList.remove('show');
                document.getElementById('forgotVerificationCode').value = '';
                
                forgotEmailStep.classList.remove('show');
                forgotResetStep.classList.add('show');
                showMessage('success', 'Code verified successfully');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Code';
        });
        
        // Change forgot email
        document.getElementById('changeForgotEmailLink').addEventListener('click', function() {
            document.getElementById('forgotVerificationPopup').classList.remove('show');
            document.getElementById('forgotVerificationCode').value = '';
            document.getElementById('forgotEmail').focus();
        });
        
        // Reset password form submission
        document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            clearErrors();
            
            const newPassword = document.getElementById('newPassword');
            const confirmNewPassword = document.getElementById('confirmNewPassword');
            const errorDiv = document.getElementById('resetPasswordError');
            const email = document.getElementById('forgotEmail').value;
            
            let hasError = false;
            
            if (!newPassword.value) {
                showError(newPassword, 'Password is required');
                hasError = true;
            } else if (newPassword.value.length < 8) {
                showError(newPassword, 'Password must be at least 8 characters long');
                hasError = true;
            }
            
            if (!confirmNewPassword.value) {
                showError(confirmNewPassword, 'Please confirm your password');
                hasError = true;
            } else if (newPassword.value !== confirmNewPassword.value) {
                showError(confirmNewPassword, 'Passwords do not match');
                errorDiv.textContent = 'Passwords do not match!';
                errorDiv.style.display = 'block';
                hasError = true;
            }
            
            if (hasError) return;
            
            const result = await resetPasswordAPI(email, newPassword.value);
            
            if (result.success) {
                console.log('Password reset successful for:', email);
                showMessage('success', 'Password reset successfully! You can now login.');
                
                forgotResetStep.classList.remove('show');
                loginContainer.classList.remove('hide');
                document.getElementById('forgotEmailForm').reset();
                document.getElementById('resetPasswordForm').reset();
                clearErrors();
            } else {
                showMessage('error', result.message);
            }
        });

        function resetRegistration() {
            currentStep = 1;
            registrationData = {};
            verificationCodeSent = false;
            emailVerified = false;
            
            showStep(1);
            
            document.getElementById('step1Form').reset();
            document.getElementById('step2Form').reset();
            document.getElementById('step3Form').reset();
            
            document.getElementById('passwordError').style.display = 'none';
            
            clearErrors();
        }
        
        function showError(element, message) {
            element.classList.add('error-input');
            
            let errorText = element.parentElement.querySelector('.error-text');
            if (!errorText) {
                errorText = document.createElement('div');
                errorText.className = 'error-text';
                element.parentElement.insertAdjacentElement('afterend', errorText);
            }
            errorText.textContent = message;
            errorText.style.display = 'block';
        }
        
        function clearErrors() {
            document.querySelectorAll('.error-input').forEach(el => {
                el.classList.remove('error-input');
            });
            document.querySelectorAll('.error-text').forEach(el => {
                el.style.display = 'none';
            });
        }
=======
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login/Registration Form</title>
    <link href="https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css" rel="stylesheet" />
    <script src="https://accounts.google.com/gsi/client" async defer></script>
    <style>
        @import url("https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap");

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: "Poppins", sans-serif;
            text-decoration: none;
            list-style: none;
        }

        body {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(90deg, #e2e2e2, #c9d6ff);
        }

        .container {
            position: relative;
            width: 850px;
            height: 550px;
            background: #fff;
            margin: 20px;
            border-radius: 30px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.2);
            overflow: hidden;
        }

        .container h1 {
            font-size: 36px;
            margin: -10px 0;
        }

        .container p {
            font-size: 14.5px;
            margin: 15px 0;
        }

        form {
            width: 100%;
        }

        .form-box {
            position: absolute;
            right: 0;
            width: 50%;
            height: 100%;
            background: #fff;
            display: flex;
            align-items: center;
            color: #333;
            text-align: center;
            padding: 40px;
            z-index: 1;
            transition: 0.6s ease-in-out 1.2s, visibility 0s 1s;
        }

        .container.active .form-box {
            right: 50%;
        }

        .form-box.register {
            visibility: hidden;
        }

        .container.active .form-box.register {
            visibility: visible;
        }

        .registration-step {
            display: none;
            width: 100%;
        }

        .registration-step.active-step {
            display: block;
        }

        .input-box {
            position: relative;
            margin: 20px 0;
        }

        .input-box input,
        .input-box select {
            width: 100%;
            padding: 13px 50px 13px 20px;
            background: #eee;
            border-radius: 8px;
            border: none;
            outline: none;
            font-size: 16px;
            color: #333;
            font-weight: 500;
        }

        .input-box input::placeholder {
            color: #888;
            font-weight: 400;
        }

        .input-box select {
            padding: 13px 45px 13px 20px;
            appearance: none;
            cursor: pointer;
            background: #eee;
            border: none;
            transition: all 0.3s ease;
        }

        .input-box select:hover {
            background: #e0e0e0;
        }

        .input-box select:focus {
            background: #eee;
            outline: none;
        }

        .input-box select option {
            border-radius: 8px;
            padding: 10px;
        }

        .input-box i {
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 20px;
            pointer-events: none;
        }

        .input-box.has-select i {
            right: 15px;
        }

        .forgot-link {
            margin: -15px 0 15px;
        }

        .forgot-link a {
            font-size: 14.5px;
            color: #333;
        }

        .btn {
            width: 100%;
            height: 48px;
            background: #7494ec;
            border-radius: 8px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            border: none;
            cursor: pointer;
            font-size: 16px;
            color: #fff;
            font-weight: 600;
        }

        .btn:disabled {
            background: #a8b9e8;
            cursor: not-allowed;
        }

        .social-icons a:hover {
            border-color: #7494ec;
            color: #7494ec;
            transform: translateY(-2px);
        }

        .social-icons a.google:hover {
            border-color: #DB4437;
            color: #DB4437;
        }

        #googleLoginDiv, #googleRegisterDiv {
            display: flex;
            justify-content: center;
            margin: 15px 0;
        }

        .toggle-box {
            position: absolute;
            width: 100%;
            height: 100%;
        }

        .toggle-box::before {
            content: "";
            position: absolute;
            left: -250%;
            width: 300%;
            height: 100%;
            background: #7494ec;
            border-radius: 150px;
            z-index: 2;
            transition: 1.8s ease-in-out;
        }

        .container.active .toggle-box::before {
            left: 50%;
        }

        .toggle-panel {
            position: absolute;
            width: 50%;
            height: 100%;
            color: #fff;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 2;
            transition: 0.6s ease-in-out;
        }

        .toggle-panel.toggle-left {
            left: 0;
            transition-delay: 1.2s;
        }

        .container.active .toggle-panel.toggle-left {
            left: -50%;
            transition-delay: 0.6s;
        }

        .toggle-panel.toggle-right {
            right: -50%;
            transition-delay: 0.6s;
        }

        .container.active .toggle-panel.toggle-right {
            right: 0;
            transition-delay: 1.2s;
        }

        .toggle-panel p {
            margin-bottom: 20px;
        }

        .toggle-panel .btn {
            width: 160px;
            height: 46px;
            background: transparent;
            border: 2px solid #fff;
            box-shadow: none;
        }

        .back-arrow {
            position: absolute;
            top: 20px;
            left: 20px;
            font-size: 24px;
            color: #7494ec;
            cursor: pointer;
            z-index: 10;
        }

        .verification-message {
            background: #e8f5e9;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            font-size: 14px;
            color: #2e7d32;
        }

        .error-message {
            background: #ffebee;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            font-size: 14px;
            color: #c62828;
        }

        .change-email-link {
            font-size: 14px;
            color: #7494ec;
            cursor: pointer;
            text-decoration: underline;
            margin-top: 10px;
            display: inline-block;
        }

        .popup-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 1000;
            justify-content: center;
            align-items: center;
        }

        .popup-overlay.show {
            display: flex;
        }

        .popup-box {
            background: #fff;
            padding: 30px;
            border-radius: 20px;
            box-shadow: 0 0 30px rgba(0, 0, 0, 0.3);
            max-width: 400px;
            width: 90%;
            text-align: center;
        }

        .popup-box h2 {
            font-size: 24px;
            margin-bottom: 20px;
            color: #333;
        }

        .popup-box .input-box {
            margin: 20px 0;
        }

        .popup-box .btn {
            margin-top: 10px;
        }

        .error-input {
            border: 2px solid #ff4444 !important;
        }

        .error-text {
            color: #ff4444;
            font-size: 12px;
            text-align: left;
            margin-top: -15px;
            margin-bottom: 10px;
            padding-left: 5px;
        }

        .forgot-container {
            display: none;
        }

        .forgot-container.show {
            display: block;
        }

        .form-box.login.hide,
        .form-box.register.hide {
            display: none;
        }

        .success-message {
            background: #e8f5e9;
            padding: 12px;
            border-radius: 8px;
            margin: 15px 0;
            font-size: 14px;
            color: #2e7d32;
        }

        @media screen and (max-width: 650px) {
            .container {
                height: calc(100vh - 40px);
            }

            .form-box {
                bottom: 0;
                width: 100%;
                height: 70%;
                padding: 30px 20px;
            }

            .container.active .form-box {
                right: 0;
                bottom: 30%;
            }

            .toggle-box::before {
                left: 0;
                top: -270%;
                width: 100%;
                height: 300%;
                border-radius: 20vw;
            }

            .container.active .toggle-box::before {
                left: 0;
                top: 70%;
            }

            .container.active .toggle-panel.toggle-left {
                left: 0;
                top: -30%;
            }

            .toggle-panel {
                width: 100%;
                height: 30%;
            }

            .toggle-panel.toggle-left {
                top: 0;
            }

            .toggle-panel.toggle-right {
                right: 0;
                bottom: -30%;
            }

            .container.active .toggle-panel.toggle-right {
                bottom: 0;
            }
        }

        @media screen and (max-width: 400px) {
            .form-box {
                padding: 20px;
            }

            .toggle-panel h1 {
                font-size: 30px;
            }

            .container h1 {
                font-size: 28px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="form-box login">
            <form id="loginForm">
                <h1>Login</h1>
                <div class="input-box">
                    <input type="text" placeholder="Email or Phone Number" required />
                    <i class="bx bxs-user"></i>
                </div>
                <div class="input-box">
                    <input type="password" placeholder="Password" required />
                    <i class="bx bxs-lock-alt"></i>
                </div>
                <div class="forgot-link">
                    <a href="#">Forgot Password?</a>
                </div>
                <button type="submit" class="btn">Login</button>
                <p>or login with</p>
                <div id="googleLoginDiv"></div>
                <div class="social-icons">
                    <a href="#" class="google" id="googleIconLogin"></a>
                </div>
            </form>
        </div>

        <!-- Forgot Password - Email Step -->
        <div class="form-box forgot-container" id="forgotEmailStep">
            <i class="bx bx-arrow-back back-arrow" id="forgotBackArrow"></i>
            <form id="forgotEmailForm">
                <h1>Reset Password</h1>
                <p style="font-size: 13px; color: #666; margin-bottom: 20px;">Enter your email to receive a verification code</p>
                <div class="input-box">
                    <input type="email" id="forgotEmail" placeholder="Email" required />
                    <i class="bx bxs-envelope"></i>
                </div>
                <div id="forgotEmailError" class="error-text" style="display: none;"></div>
                <button type="button" class="btn" id="sendResetCodeBtn">Send Reset Code</button>
            </form>
        </div>

        <!-- Forgot Password - Reset Password Step -->
        <div class="form-box forgot-container" id="forgotResetStep">
            <i class="bx bx-arrow-back back-arrow" id="resetBackArrow"></i>
            <form id="resetPasswordForm">
                <h1>Set New Password</h1>
                <div class="verification-message" style="margin-bottom: 20px;">
                    <i class="bx bx-check-circle"></i> Code verified successfully!
                </div>
                <div class="input-box">
                    <input type="password" id="newPassword" placeholder="New Password" required minlength="8" />
                    <i class="bx bxs-lock-alt"></i>
                </div>
                <div class="input-box">
                    <input type="password" id="confirmNewPassword" placeholder="Confirm New Password" required minlength="8" />
                    <i class="bx bxs-lock-alt"></i>
                </div>
                <div id="resetPasswordError" class="error-message" style="display: none;"></div>
                <button type="submit" class="btn">Reset Password</button>
            </form>
        </div>

        <div class="form-box register">
            <i class="bx bx-arrow-back back-arrow" id="backArrow" style="display: none;"></i>
            
            <!-- Step 1: Basic Info -->
            <div class="registration-step active-step" id="step1">
                <form id="step1Form">
                    <h1>Registration</h1>
                    <div class="input-box">
                        <input type="text" id="fullName" placeholder="Full Name" required />
                        <i class="bx bxs-user"></i>
                    </div>
                    <div class="input-box">
                        <input type="tel" id="phone" placeholder="Phone Number" required pattern="[0-9]{10}" />
                        <i class="bx bxs-phone"></i>
                    </div>
                    
                    <button type="submit" class="btn">Next</button>
                </form>
            </div>

            <!-- Step 2: Email Verification -->
            <div class="registration-step" id="step2">
                <form id="step2Form">
                    <h1>Email Verification</h1>
                    <div class="input-box">
                        <input type="email" id="email" placeholder="Email" required />
                        <i class="bx bxs-envelope"></i>
                    </div>
                    <div id="emailError" class="error-text" style="display: none;"></div>
                    <button type="button" class="btn" id="verifyEmailBtn">Verify Email</button>
                </form>
            </div>

            <!-- Step 3: Password Setup -->
            <div class="registration-step" id="step3">
                <form id="step3Form">
                    <h1>Set Password</h1>
                    <div class="input-box">
                        <input type="password" id="password" placeholder="Password" required minlength="8" />
                        <i class="bx bxs-lock-alt"></i>
                    </div>
                    <div class="input-box">
                        <input type="password" id="confirmPassword" placeholder="Confirm Password" required minlength="8" />
                        <i class="bx bxs-lock-alt"></i>
                    </div>
                    <div id="passwordError" class="error-message" style="display: none;"></div>
                    <button type="submit" class="btn">Complete Registration</button>
                </form>
            </div>
        </div>

        <div class="toggle-box">
            <div class="toggle-panel toggle-left">
                <h1>Hello, Welcome!</h1>
                <p>Don't have an account?</p>
                <button class="btn register-btn">Register</button>
            </div>

            <div class="toggle-panel toggle-right">
                <h1>Welcome Back!</h1>
                <p>Already have an account?</p>
                <button class="btn login-btn">Login</button>
            </div>
        </div>
    </div>

    <!-- Verification Popup for Registration -->
    <div class="popup-overlay" id="verificationPopup">
        <div class="popup-box">
            <h2>Enter Verification Code</h2>
            <p style="margin-bottom: 20px; font-size: 14px; color: #666;">We've sent a code to <span id="displayEmail" style="font-weight: 600;"></span></p>
            <div class="input-box">
                <input type="text" id="verificationCode" placeholder="Enter 6-digit code" maxlength="6" />
                <i class="bx bx-key"></i>
            </div>
            <button type="button" class="btn" id="verifyCodeBtn">Verify Code</button>
            <span class="change-email-link" id="changeEmailLink">Change Email</span>
        </div>
    </div>

    <!-- Forgot Password Verification Popup -->
    <div class="popup-overlay" id="forgotVerificationPopup">
        <div class="popup-box">
            <h2>Enter Reset Code</h2>
            <p style="margin-bottom: 20px; font-size: 14px; color: #666;">We've sent a reset code to <span id="displayForgotEmail" style="font-weight: 600;"></span></p>
            <div class="input-box">
                <input type="text" id="forgotVerificationCode" placeholder="Enter 6-digit code" maxlength="6" />
                <i class="bx bx-key"></i>
            </div>
            <button type="button" class="btn" id="verifyResetCodeBtn">Verify Code</button>
            <span class="change-email-link" id="changeForgotEmailLink">Change Email</span>
        </div>
    </div>

    <script>
        // API Configuration
        const API_URL = '/api';
        
        const container = document.querySelector('.container');
        const registerBtn = document.querySelector('.register-btn');
        const loginBtn = document.querySelector('.login-btn');
        const backArrow = document.getElementById('backArrow');
        
        let currentStep = 1;
        let registrationData = {};
        let verificationCodeSent = false;
        let emailVerified = false;

        // Google Sign-In Configuration
        const GOOGLE_CLIENT_ID = '654239516719-fvbmjp61hu20mevnsc7n883is6vj7ud9.apps.googleusercontent.com';

        // Rate Limiter Class
        class RateLimiter {
            constructor(maxAttempts = 3, timeWindow = 60000) {
                this.attempts = {};
                this.maxAttempts = maxAttempts;
                this.timeWindow = timeWindow;
            }
            
            canAttempt(key) {
                const now = Date.now();
                
                if (!this.attempts[key]) {
                    this.attempts[key] = [];
                }
                
                this.attempts[key] = this.attempts[key].filter(
                    timestamp => now - timestamp < this.timeWindow
                );
                
                if (this.attempts[key].length >= this.maxAttempts) {
                    return {
                        allowed: false,
                        message: `Too many attempts. Please try again in ${Math.ceil((this.attempts[key][0] + this.timeWindow - now) / 1000)} seconds`
                    };
                }
                
                this.attempts[key].push(now);
                return { allowed: true };
            }
        }

        const loginLimiter = new RateLimiter(5, 300000); // 5 attempts per 5 minutes
        const verificationLimiter = new RateLimiter(3, 60000); // 3 attempts per minute

        // Validation Functions
        function validateEmail(email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            
            if (!email.trim()) {
                return { valid: false, message: 'Email is required' };
            }
            
            if (!emailRegex.test(email)) {
                return { valid: false, message: 'Please enter a valid email address' };
            }
            
            const domain = email.split('@')[1]?.toLowerCase();
            
            if (domain && domain.includes('..')) {
                return { valid: false, message: 'Invalid email format' };
            }
            
            return { valid: true };
        }

        function validatePhone(phone) {
            const cleaned = phone.replace(/[\s\-\(\)]/g, '');
            
            if (!cleaned) {
                return { valid: false, message: 'Phone number is required' };
            }
            
            if (!/^\d{10}$/.test(cleaned)) {
                return { valid: false, message: 'Phone number must be exactly 10 digits' };
            }
            
            if (cleaned[0] === '0' || cleaned[0] === '1') {
                return { valid: false, message: 'Phone number cannot start with 0 or 1' };
            }
            
            return { valid: true, cleaned: cleaned };
        }

        function validatePassword(password) {
            if (!password) {
                return { valid: false, message: 'Password is required' };
            }
            
            if (password.length < 8) {
                return { valid: false, message: 'Password must be at least 8 characters' };
            }
            
            if (password.length > 128) {
                return { valid: false, message: 'Password must be less than 128 characters' };
            }
            
            if (!/[A-Z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one uppercase letter' };
            }
            
            if (!/[a-z]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one lowercase letter' };
            }
            
            if (!/\d/.test(password)) {
                return { valid: false, message: 'Password must contain at least one number' };
            }
            
            if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
                return { valid: false, message: 'Password must contain at least one special character' };
            }
            
            const weakPasswords = ['password', '12345678', 'qwerty123', 'abc123456', 'password123'];
            if (weakPasswords.includes(password.toLowerCase())) {
                return { valid: false, message: 'This password is too common. Please choose a stronger password' };
            }
            
            return { valid: true };
        }

        function validateFullName(name) {
            if (!name.trim()) {
                return { valid: false, message: 'Full name is required' };
            }
            
            if (name.trim().length < 2) {
                return { valid: false, message: 'Name must be at least 2 characters' };
            }
            
            if (name.trim().length > 100) {
                return { valid: false, message: 'Name must be less than 100 characters' };
            }
            
            if (!/^[a-zA-Z\s\-']+$/.test(name)) {
                return { valid: false, message: 'Name can only contain letters, spaces, hyphens, and apostrophes' };
            }
            
            const nameParts = name.trim().split(/\s+/);
            if (nameParts.length < 2) {
                return { valid: false, message: 'Please enter your full name (first and last name)' };
            }
            
            return { valid: true };
        }

        function validateVerificationCode(code) {
            if (!code) {
                return { valid: false, message: 'Verification code is required' };
            }
            
            const cleaned = code.replace(/\s/g, '');
            
            if (!/^\d{6}$/.test(cleaned)) {
                return { valid: false, message: 'Verification code must be 6 digits' };
            }
            
            return { valid: true, cleaned: cleaned };
        }

        function sanitizeInput(input) {
            const div = document.createElement('div');
            div.textContent = input;
            return div.innerHTML
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#x27;')
                .trim();
        }

        // Function to show specific step
        function showStep(step) {
            document.querySelectorAll('.registration-step').forEach(s => {
                s.classList.remove('active-step');
            });
            
            document.getElementById('step' + step).classList.add('active-step');
            currentStep = step;
            
            if (step > 1) {
                backArrow.style.display = 'block';
            } else {
                backArrow.style.display = 'none';
            }
        }

        // Back arrow functionality
        backArrow.addEventListener('click', () => {
            if (currentStep > 1) {
                showStep(currentStep - 1);
            }
        });

        // API Functions
        async function sendVerificationCodeAPI(email) {
            try {
                const response = await fetch(`${API_URL}/send-verification-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server. Please make sure the Flask server is running on port 5000.' };
            }
        }

        async function verifyEmailCodeAPI(email, code, purpose = 'registration') {
            try {
                const response = await fetch(`${API_URL}/verify-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, code, purpose })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function sendResetCodeAPI(email) {
            try {
                const response = await fetch(`${API_URL}/send-reset-code`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function resetPasswordAPI(email, password) {
            try {
                const response = await fetch(`${API_URL}/reset-password`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, password })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function completeRegistration(userData) {
            try {
                const response = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify(userData)
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function loginUser(emailOrPhone, password) {
            try {
                const response = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials:'include',
                    body: JSON.stringify({ emailOrPhone, password })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        async function googleLoginAPI(email, name, googleId) {
            try {
                const response = await fetch(`${API_URL}/google-login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include',
                    body: JSON.stringify({ email, name, googleId })
                });
                
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error:', error);
                return { success: false, message: 'Failed to connect to server' };
            }
        }

        // Initialize Google Sign-In
        function initGoogleSignIn() {
            google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleLogin
            });

            // Render Google Sign-In button for login
            google.accounts.id.renderButton(
                document.getElementById('googleLoginDiv'),
                { 
                    theme: 'outline', 
                    size: 'large',
                    width: 250,
                    text: 'signin_with'
                }
            );
        }

        // Handle Google Login Response
        function handleGoogleLogin(response) {
            const userInfo = parseJwt(response.credential);
            
            console.log('Google Login Success:', {
                email: userInfo.email,
                name: userInfo.name,
                picture: userInfo.picture,
                sub: userInfo.sub
            });

            googleLoginAPI(userInfo.email, userInfo.name, userInfo.sub).then(result => {
                if (result.success) {
                    console.log('User data:', result.user);
                    window.location.href = '/';
                } else {
                    showMessage('error', result.message);
                }
            });
        }

        // Parse JWT token
        function parseJwt(token) {
            const base64Url = token.split('.')[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
            return JSON.parse(jsonPayload);
        }

        // Handle Google icon clicks
        document.getElementById('googleIconLogin').addEventListener('click', function(e) {
            e.preventDefault();
            google.accounts.id.prompt();
        });

        // Initialize Google Sign-In when page loads
        window.onload = function() {
            initGoogleSignIn();
        };

        registerBtn.addEventListener('click', () => {
            container.classList.add('active');
            resetRegistration();
        });

        loginBtn.addEventListener('click', () => {
            container.classList.remove('active');
            resetRegistration();
        });

        // Helper function to show messages
        function showMessage(type, message) {
            const messageDiv = document.createElement('div');
            messageDiv.className = type === 'success' ? 'success-message' : 'error-message';
            messageDiv.textContent = message;
            messageDiv.style.position = 'fixed';
            messageDiv.style.top = '20px';
            messageDiv.style.right = '20px';
            messageDiv.style.zIndex = '10000';
            messageDiv.style.maxWidth = '400px';
            document.body.appendChild(messageDiv);
            
            setTimeout(() => {
                messageDiv.remove();
            }, 3000);
        }

        // Login form submission
        document.getElementById('loginForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const emailOrPhone = this.querySelector('input[type="text"]').value;
            const password = this.querySelector('input[type="password"]').value;
            
            if (!emailOrPhone || !password) {
                showMessage('error', 'Please enter email/phone and password');
                return;
            }
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Logging in...';
            
            const result = await loginUser(emailOrPhone, password);
            
            if (result.success) {
                window.location.href = '/';
            } else {
                showMessage('error', result.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });

        // Step 1 form submission
        document.getElementById('step1Form').addEventListener('submit', function (e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName');
            const phone = document.getElementById('phone');

            if (!fullName.value.trim()) {
                showError(fullName, 'Full name is required');
                return;
            }

            if (!phone.value.trim()) {
                showError(phone, 'Phone number is required');
                return;
            }

            if (!/^[0-9]{10}$/.test(phone.value)) {
                showError(phone, 'Phone number must be 10 digits');
                return;
            }

            registrationData.fullName = fullName.value;
            registrationData.phone = phone.value;

            showStep(2);
        });

        // Send verification code for registration
        document.getElementById('verifyEmailBtn').addEventListener('click', async function() {
            const email = document.getElementById('email');
            const emailError = document.getElementById('emailError');
            
            email.classList.remove('error-input');
            emailError.style.display = 'none';
            
            if (!email.value.trim()) {
                email.classList.add('error-input');
                emailError.textContent = 'Email is required';
                emailError.style.display = 'block';
                return;
            }
            
            if (!email.value.includes('@') || !email.value.includes('.')) {
                email.classList.add('error-input');
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Sending...';
            
            const result = await sendVerificationCodeAPI(email.value);
            
            if (result.success) {
                registrationData.email = email.value;
                document.getElementById('displayEmail').textContent = email.value;
                document.getElementById('verificationPopup').classList.add('show');
                showMessage('success', 'Verification code sent to your email');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Email';
        });

        // Verify code for registration
        document.getElementById('verifyCodeBtn').addEventListener('click', async function() {
            const code = document.getElementById('verificationCode').value;
            
            if (!code) {
                showMessage('error', 'Please enter the verification code');
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Verifying...';
            
            const result = await verifyEmailCodeAPI(registrationData.email, code, 'registration');
            
            if (result.success) {
                emailVerified = true;
                document.getElementById('verificationPopup').classList.remove('show');
                document.getElementById('verificationCode').value = '';
                showMessage('success', 'Email verified successfully');
                showStep(3);
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Code';
        });

        // Change email link
        document.getElementById('changeEmailLink').addEventListener('click', function() {
            document.getElementById('verificationPopup').classList.remove('show');
            document.getElementById('verificationCode').value = '';
            emailVerified = false;
            document.getElementById('email').focus();
        });

        // Step 2 form submission
        document.getElementById('step2Form').addEventListener('submit', function(e) {
            e.preventDefault();
        });

        // Step 3 form submission - Save to database
        document.getElementById('step3Form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            clearErrors();
            
            const password = document.getElementById('password');
            const confirmPassword = document.getElementById('confirmPassword');
            const errorDiv = document.getElementById('passwordError');
            
            let hasError = false;
            
            if (!password.value) {
                showError(password, 'Password is required');
                hasError = true;
            } else if (password.value.length < 8) {
                showError(password, 'Password must be at least 8 characters long');
                hasError = true;
            }
            
            if (!confirmPassword.value) {
                showError(confirmPassword, 'Please confirm your password');
                hasError = true;
            } else if (password.value !== confirmPassword.value) {
                showError(confirmPassword, 'Passwords do not match');
                errorDiv.textContent = 'Passwords do not match!';
                errorDiv.style.display = 'block';
                hasError = true;
            }
            
            if (hasError) return;
            
            registrationData.password = password.value;
            
            const submitBtn = this.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Registering...';
            
            const result = await completeRegistration(registrationData);
            
            if (result.success) {
                console.log('Registration Data saved:', registrationData);
                showMessage('success', 'Registration completed successfully! You can now login.');
                
                container.classList.remove('active');
                resetRegistration();
            } else {
                showMessage('error', result.message);
                submitBtn.disabled = false;
                submitBtn.textContent = 'Complete Registration';
            }
        });

        // Forgot Password functionality
        const forgotLink = document.querySelector('.forgot-link a');
        const forgotEmailStep = document.getElementById('forgotEmailStep');
        const forgotResetStep = document.getElementById('forgotResetStep');
        const loginContainer = document.querySelector('.form-box.login');
        const forgotBackArrow = document.getElementById('forgotBackArrow');
        const resetBackArrow = document.getElementById('resetBackArrow');
        
        forgotLink.addEventListener('click', function(e) {
            e.preventDefault();
            loginContainer.classList.add('hide');
            forgotEmailStep.classList.add('show');
        });
        
        forgotBackArrow.addEventListener('click', function() {
            forgotEmailStep.classList.remove('show');
            loginContainer.classList.remove('hide');
            document.getElementById('forgotEmailForm').reset();
            clearErrors();
        });
        
        resetBackArrow.addEventListener('click', function() {
            forgotResetStep.classList.remove('show');
            forgotEmailStep.classList.add('show');
            document.getElementById('resetPasswordForm').reset();
            clearErrors();
        });
        
        // Send reset code for forgot password
        document.getElementById('sendResetCodeBtn').addEventListener('click', async function() {
            const email = document.getElementById('forgotEmail');
            const emailError = document.getElementById('forgotEmailError');
            
            email.classList.remove('error-input');
            emailError.style.display = 'none';
            
            if (!email.value.trim()) {
                email.classList.add('error-input');
                emailError.textContent = 'Email is required';
                emailError.style.display = 'block';
                return;
            }
            
            if (!email.value.includes('@') || !email.value.includes('.')) {
                email.classList.add('error-input');
                emailError.textContent = 'Please enter a valid email address';
                emailError.style.display = 'block';
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Sending...';
            
            const result = await sendResetCodeAPI(email.value);
            
            if (result.success) {
                document.getElementById('displayForgotEmail').textContent = email.value;
                document.getElementById('forgotVerificationPopup').classList.add('show');
                showMessage('success', 'Reset code sent to your email');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Send Reset Code';
        });
        
        // Verify reset code for forgot password
        document.getElementById('verifyResetCodeBtn').addEventListener('click', async function() {
            const code = document.getElementById('forgotVerificationCode').value;
            const email = document.getElementById('forgotEmail').value;
            
            if (!code) {
                showMessage('error', 'Please enter the reset code');
                return;
            }
            
            this.disabled = true;
            this.textContent = 'Verifying...';
            
            const result = await verifyEmailCodeAPI(email, code, 'reset');
            
            if (result.success) {
                document.getElementById('forgotVerificationPopup').classList.remove('show');
                document.getElementById('forgotVerificationCode').value = '';
                
                forgotEmailStep.classList.remove('show');
                forgotResetStep.classList.add('show');
                showMessage('success', 'Code verified successfully');
            } else {
                showMessage('error', result.message);
            }
            
            this.disabled = false;
            this.textContent = 'Verify Code';
        });
        
        // Change forgot email
        document.getElementById('changeForgotEmailLink').addEventListener('click', function() {
            document.getElementById('forgotVerificationPopup').classList.remove('show');
            document.getElementById('forgotVerificationCode').value = '';
            document.getElementById('forgotEmail').focus();
        });
        
        // Reset password form submission
        document.getElementById('resetPasswordForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            clearErrors();
            
            const newPassword = document.getElementById('newPassword');
            const confirmNewPassword = document.getElementById('confirmNewPassword');
            const errorDiv = document.getElementById('resetPasswordError');
            const email = document.getElementById('forgotEmail').value;
            
            let hasError = false;
            
            if (!newPassword.value) {
                showError(newPassword, 'Password is required');
                hasError = true;
            } else if (newPassword.value.length < 8) {
                showError(newPassword, 'Password must be at least 8 characters long');
                hasError = true;
            }
            
            if (!confirmNewPassword.value) {
                showError(confirmNewPassword, 'Please confirm your password');
                hasError = true;
            } else if (newPassword.value !== confirmNewPassword.value) {
                showError(confirmNewPassword, 'Passwords do not match');
                errorDiv.textContent = 'Passwords do not match!';
                errorDiv.style.display = 'block';
                hasError = true;
            }
            
            if (hasError) return;
            
            const result = await resetPasswordAPI(email, newPassword.value);
            
            if (result.success) {
                console.log('Password reset successful for:', email);
                showMessage('success', 'Password reset successfully! You can now login.');
                
                forgotResetStep.classList.remove('show');
                loginContainer.classList.remove('hide');
                document.getElementById('forgotEmailForm').reset();
                document.getElementById('resetPasswordForm').reset();
                clearErrors();
            } else {
                showMessage('error', result.message);
            }
        });

        function resetRegistration() {
            currentStep = 1;
            registrationData = {};
            verificationCodeSent = false;
            emailVerified = false;
            
            showStep(1);
            
            document.getElementById('step1Form').reset();
            document.getElementById('step2Form').reset();
            document.getElementById('step3Form').reset();
            
            document.getElementById('passwordError').style.display = 'none';
            
            clearErrors();
        }
        
        function showError(element, message) {
            element.classList.add('error-input');
            
            let errorText = element.parentElement.querySelector('.error-text');
            if (!errorText) {
                errorText = document.createElement('div');
                errorText.className = 'error-text';
                element.parentElement.insertAdjacentElement('afterend', errorText);
            }
            errorText.textContent = message;
            errorText.style.display = 'block';
        }
        
        function clearErrors() {
            document.querySelectorAll('.error-input').forEach(el => {
                el.classList.remove('error-input');
            });
            document.querySelectorAll('.error-text').forEach(el => {
                el.style.display = 'none';
            });
        }
    </script>
</body>
</html>
>>>>>>> 437af1c6450c2c0e1f8ea3f4895237bcc65a772c:templates/index.html
