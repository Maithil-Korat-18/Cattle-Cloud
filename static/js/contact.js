/* ===========================
   CONTACT PAGE JAVASCRIPT
   =========================== */

// Character counter for message textarea
const messageTextarea = document.getElementById('message');
const charCount = document.getElementById('charCount');

if (messageTextarea && charCount) {
    messageTextarea.addEventListener('input', function() {
        const count = this.value.length;
        charCount.textContent = count;
        
        // Change color based on length
        if (count < 10) {
            charCount.style.color = '#f56565';
        } else if (count < 50) {
            charCount.style.color = '#ed8936';
        } else {
            charCount.style.color = '#48bb78';
        }
    });
}

// Handle form submission
function handleSubmit(event) {
    event.preventDefault();
    
    // Get form data
    const form = event.target;
    const submitBtn = document.getElementById('submitBtn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    
    // Get form values
    const formData = {
        fullName: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value.trim()
    };
    
    // Basic validation
    if (!formData.fullName || formData.fullName.length < 3) {
        showError('Please enter your full name (at least 3 characters)');
        return;
    }
    
    if (!formData.email || !validateEmail(formData.email)) {
        showError('Please enter a valid email address');
        return;
    }
    
    if (!formData.subject) {
        showError('Please select a subject');
        return;
    }
    
    if (!formData.message || formData.message.length < 10) {
        showError('Please enter a message (at least 10 characters)');
        return;
    }
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoader.style.display = 'flex';
    
    // Hide any existing alerts
    closeAlert();
    closeErrorAlert();
    
    // Simulate form submission (replace with actual API call if needed)
    setTimeout(() => {
        // Log form data to console (for development)
        console.log('Form submitted with data:', formData);
        
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        
        // Show success message
        showSuccess();
        
        // Reset form
        form.reset();
        
        // Reset character count
        if (charCount) {
            charCount.textContent = '0';
            charCount.style.color = '#a0aec0';
        }
        
        // Scroll to success message
        document.getElementById('successAlert').scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
        });
    }, 1500);
}

// Validate email format
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

// Show success alert
function showSuccess() {
    const successAlert = document.getElementById('successAlert');
    successAlert.style.display = 'flex';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeAlert();
    }, 5000);
}

// Show error alert
function showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.textContent = message;
    errorAlert.style.display = 'flex';
    
    // Scroll to error message
    errorAlert.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
    });
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        closeErrorAlert();
    }, 5000);
}

// Close success alert
function closeAlert() {
    const successAlert = document.getElementById('successAlert');
    if (successAlert) {
        successAlert.style.display = 'none';
    }
}

// Close error alert
function closeErrorAlert() {
    const errorAlert = document.getElementById('errorAlert');
    if (errorAlert) {
        errorAlert.style.display = 'none';
    }
}

// Real-time validation feedback
document.addEventListener('DOMContentLoaded', function() {
    // Email field validation
    const emailInput = document.getElementById('email');
    if (emailInput) {
        emailInput.addEventListener('blur', function() {
            if (this.value && !validateEmail(this.value)) {
                this.style.borderColor = '#f56565';
            } else if (this.value) {
                this.style.borderColor = '#48bb78';
            }
        });
        
        emailInput.addEventListener('input', function() {
            if (this.style.borderColor === 'rgb(245, 101, 101)') {
                this.style.borderColor = '#e2e8f0';
            }
        });
    }
    
    // Full name validation
    const fullNameInput = document.getElementById('fullName');
    if (fullNameInput) {
        fullNameInput.addEventListener('blur', function() {
            if (this.value && this.value.length < 3) {
                this.style.borderColor = '#f56565';
            } else if (this.value) {
                this.style.borderColor = '#48bb78';
            }
        });
        
        fullNameInput.addEventListener('input', function() {
            if (this.style.borderColor === 'rgb(245, 101, 101)') {
                this.style.borderColor = '#e2e8f0';
            }
        });
    }
    
    // Message validation
    const messageInput = document.getElementById('message');
    if (messageInput) {
        messageInput.addEventListener('blur', function() {
            if (this.value && this.value.length < 10) {
                this.style.borderColor = '#f56565';
            } else if (this.value) {
                this.style.borderColor = '#48bb78';
            }
        });
        
        messageInput.addEventListener('input', function() {
            if (this.style.borderColor === 'rgb(245, 101, 101)') {
                this.style.borderColor = '#e2e8f0';
            }
        });
    }
    
    // Subject validation
    const subjectSelect = document.getElementById('subject');
    if (subjectSelect) {
        subjectSelect.addEventListener('change', function() {
            if (this.value) {
                this.style.borderColor = '#48bb78';
            }
        });
    }
});

// Prevent form resubmission on page refresh
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Add smooth animation to form elements
const formInputs = document.querySelectorAll('.form-input, .form-textarea');
formInputs.forEach(input => {
    input.addEventListener('focus', function() {
        this.style.transform = 'scale(1.01)';
    });
    
    input.addEventListener('blur', function() {
        this.style.transform = 'scale(1)';
    });
});

// Log when contact page is loaded
console.log('📧 Contact Page Loaded Successfully!');
console.log('Form is ready to accept submissions.');

// Handle phone number clicks (add country code if needed)
const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
phoneLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        console.log('Phone link clicked:', this.href);
    });
});

// Handle email clicks
const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
emailLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        console.log('Email link clicked:', this.href);
    });
});

// Smooth scroll for any anchor links on the page
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});