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
>>>>>>> 437af1c6450c2c0e1f8ea3f4895237bcc65a772c:templates/index.html
