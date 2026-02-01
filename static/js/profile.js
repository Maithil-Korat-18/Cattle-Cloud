// Profile Page JavaScript with Email Verification

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeProfilePage();
});

function initializeProfilePage() {
    setupEditButtons();
    setupPasswordStrengthIndicator();
    setupPasswordForm();
}

// ===========================
// EDIT FUNCTIONALITY
// ===========================

function setupEditButtons() {
    document.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', function() {
            const section = this.closest('.info-section');
            toggleEditMode(section);
        });
    });
}

function toggleEditMode(section) {
    const isEditMode = section.classList.contains('edit-mode');
    
    if (!isEditMode) {
        section.classList.add('edit-mode');
        
        section.querySelectorAll('.form-value').forEach(value => {
            const field = value.getAttribute('data-field');
            if (field !== 'email') { // Don't make email editable here
                value.style.display = 'none';
            }
        });
        
        section.querySelectorAll('.form-input').forEach(input => {
            input.style.display = 'block';
        });
        
        const formActions = section.querySelector('.form-actions');
        if (formActions) {
            formActions.style.display = 'flex';
        }
        
        setupFormActions(section);
    }
}

function setupFormActions(section) {
    const cancelBtn = section.querySelector('.cancel-btn');
    const saveBtn = section.querySelector('.save-btn');
    
    if (cancelBtn) {
        cancelBtn.onclick = function() {
            exitEditMode(section);
        };
    }
    
    if (saveBtn) {
        saveBtn.onclick = function() {
            saveChanges(section);
        };
    }
}

function exitEditMode(section) {
    section.classList.remove('edit-mode');
    
    section.querySelectorAll('.form-input').forEach(input => {
        input.style.display = 'none';
    });
    
    section.querySelectorAll('.form-value').forEach(value => {
        value.style.display = 'block';
    });
    
    const formActions = section.querySelector('.form-actions');
    if (formActions) {
        formActions.style.display = 'none';
    }
}

function saveChanges(section) {
    const formData = {};
    
    section.querySelectorAll('.form-input').forEach(input => {
        const fieldName = input.getAttribute('data-field');
        if (fieldName !== 'email') { // Email is changed separately
            formData[fieldName] = input.value;
        }
    });
    
    const saveBtn = section.querySelector('.save-btn');
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    fetch('/api/profile/update', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            section.querySelectorAll('.form-input').forEach(input => {
                const fieldName = input.getAttribute('data-field');
                const displayElement = section.querySelector(`.form-value[data-field="${fieldName}"]`);
                if (displayElement && fieldName !== 'email') {
                    displayElement.textContent = input.value;
                }
            });
            
            if (formData.full_name) {
                document.querySelector('.user-details h2').textContent = formData.full_name;
                document.querySelector('.avatar-placeholder').textContent = formData.full_name[0].toUpperCase();
            }
            
            showToast('Profile updated successfully!', 'success');
            exitEditMode(section);
        } else {
            showToast(data.message || 'Update failed', 'error');
        }
    })
    .catch(err => {
        console.error('Update error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        saveBtn.disabled = false;
        saveBtn.textContent = originalText;
    });
}

// ===========================
// EMAIL CHANGE FLOW
// ===========================

function openEmailChangeModal() {
    const modal = document.getElementById('emailChangeModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Reset to first step
        document.getElementById('emailStep').style.display = 'block';
        document.getElementById('emailOtpStep').style.display = 'none';
        document.getElementById('newEmail').value = '';
        document.getElementById('emailOtp').value = '';
    }
}

function closeEmailChangeModal() {
    const modal = document.getElementById('emailChangeModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function requestEmailChange() {
    const newEmail = document.getElementById('newEmail').value.trim();
    
    if (!newEmail) {
        showToast('Please enter a new email address', 'error');
        return;
    }
    
    if (!isValidEmail(newEmail)) {
        showToast('Please enter a valid email address', 'error');
        return;
    }
    
    const btn = document.querySelector('#emailStep .modal-btn.primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    fetch('/api/profile/request-email-change', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ new_email: newEmail })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('newEmailDisplay').textContent = newEmail;
            document.getElementById('emailStep').style.display = 'none';
            document.getElementById('emailOtpStep').style.display = 'block';
            showToast(data.message, 'success');
        } else {
            showToast(data.message || 'Failed to send verification code', 'error');
        }
    })
    .catch(err => {
        console.error('Email change request error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = originalText;
    });
}

function verifyEmailChange() {
    const otp = document.getElementById('emailOtp').value.trim();
    
    if (!otp || otp.length !== 6) {
        showToast('Please enter a valid 6-digit code', 'error');
        return;
    }
    
    const btn = document.querySelector('#emailOtpStep .modal-btn.primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    
    fetch('/api/profile/verify-email-change', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            // Update email display
            const emailElements = document.querySelectorAll('[data-field="email"]');
            emailElements.forEach(el => {
                if (el.classList.contains('form-value')) {
                    const changeBtn = el.querySelector('.change-email-btn');
                    el.textContent = data.email;
                    if (changeBtn) {
                        el.appendChild(changeBtn);
                    }
                }
            });
            document.getElementById('userEmail').textContent = data.email;
            
            showToast('Email updated successfully!', 'success');
            closeEmailChangeModal();
        } else {
            showToast(data.message || 'Verification failed', 'error');
        }
    })
    .catch(err => {
        console.error('Email verification error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = originalText;
    });
}

function backToEmailStep() {
    document.getElementById('emailOtpStep').style.display = 'none';
    document.getElementById('emailStep').style.display = 'block';
}

// ===========================
// PASSWORD CHANGE FLOW
// ===========================

function openPasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.add('show');
        document.body.style.overflow = 'hidden';
        
        // Reset to first step
        document.getElementById('passwordRequestStep').style.display = 'block';
        document.getElementById('passwordOtpStep').style.display = 'none';
        document.getElementById('passwordForm').style.display = 'none';
        
        // Clear all inputs
        document.getElementById('passwordOtp').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
        resetPasswordStrength();
    }
}

function closePasswordModal() {
    const modal = document.getElementById('passwordModal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
}

function requestPasswordChange() {
    const btn = document.querySelector('#passwordRequestStep .modal-btn.primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Sending...';
    
    fetch('/api/profile/request-password-change', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('passwordRequestStep').style.display = 'none';
            document.getElementById('passwordOtpStep').style.display = 'block';
            showToast(data.message, 'success');
        } else {
            showToast(data.message || 'Failed to send verification code', 'error');
        }
    })
    .catch(err => {
        console.error('Password change request error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = originalText;
    });
}

function verifyPasswordOtp() {
    const otp = document.getElementById('passwordOtp').value.trim();
    
    if (!otp || otp.length !== 6) {
        showToast('Please enter a valid 6-digit code', 'error');
        return;
    }
    
    const btn = document.querySelector('#passwordOtpStep .modal-btn.primary');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    
    fetch('/api/profile/verify-password-otp', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ otp: otp })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById('passwordOtpStep').style.display = 'none';
            document.getElementById('passwordForm').style.display = 'block';
            showToast(data.message, 'success');
        } else {
            showToast(data.message || 'Verification failed', 'error');
        }
    })
    .catch(err => {
        console.error('OTP verification error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        btn.disabled = false;
        btn.textContent = originalText;
    });
}

function backToPasswordRequest() {
    document.getElementById('passwordOtpStep').style.display = 'none';
    document.getElementById('passwordRequestStep').style.display = 'block';
}

function setupPasswordForm() {
    const passwordForm = document.getElementById('passwordForm');
    
    if (passwordForm) {
        passwordForm.addEventListener('submit', function(e) {
            e.preventDefault();
            changePassword();
        });
    }
}

function changePassword() {
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (!newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    if (newPassword.length < 8) {
        showToast('Password must be at least 8 characters long', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('#passwordForm .modal-btn.primary');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';
    
    fetch('/api/profile/change-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            new_password: newPassword,
            confirm_password: confirmPassword
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            showToast('Password changed successfully!', 'success');
            closePasswordModal();
        } else {
            showToast(data.message || 'Password change failed', 'error');
        }
    })
    .catch(err => {
        console.error('Password change error:', err);
        showToast('Server error occurred', 'error');
    })
    .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    });
}

// ===========================
// PASSWORD STRENGTH INDICATOR
// ===========================

function setupPasswordStrengthIndicator() {
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    
    if (newPasswordInput) {
        newPasswordInput.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            updatePasswordStrength(strength);
        });
    }
    
    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', function() {
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = this.value;
            const matchElement = document.getElementById('passwordMatch');
            
            if (confirmPassword === '') {
                matchElement.textContent = '';
                matchElement.style.color = '';
            } else if (newPassword === confirmPassword) {
                matchElement.textContent = '✓ Passwords match';
                matchElement.style.color = '#10b981';
            } else {
                matchElement.textContent = '✗ Passwords do not match';
                matchElement.style.color = '#ef4444';
            }
        });
    }
}

function calculatePasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
}

function updatePasswordStrength(strength) {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    
    const colors = ['#ef4444', '#f59e0b', '#eab308', '#84cc16', '#10b981'];
    const texts = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const widths = ['20%', '40%', '60%', '80%', '100%'];
    
    if (strength === 0) {
        strengthFill.style.width = '0%';
        strengthText.textContent = 'Password strength';
        strengthText.style.color = 'var(--text-secondary)';
    } else {
        strengthFill.style.width = widths[strength - 1];
        strengthFill.style.backgroundColor = colors[strength - 1];
        strengthText.textContent = texts[strength - 1];
        strengthText.style.color = colors[strength - 1];
    }
}

function resetPasswordStrength() {
    const strengthFill = document.getElementById('strengthFill');
    const strengthText = document.getElementById('strengthText');
    const matchElement = document.getElementById('passwordMatch');
    
    if (strengthFill) strengthFill.style.width = '0%';
    if (strengthText) {
        strengthText.textContent = 'Password strength';
        strengthText.style.color = 'var(--text-secondary)';
    }
    if (matchElement) matchElement.textContent = '';
}

// ===========================
// VALIDATION HELPERS
// ===========================

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================

function showToast(message, type = 'info') {
    const toast = document.getElementById('successMessage');
    if (!toast) return;
    
    toast.textContent = message;
    toast.className = `toast-message show ${type}`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ===========================
// KEYBOARD SHORTCUTS
// ===========================

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        const emailModal = document.getElementById('emailChangeModal');
        const passwordModal = document.getElementById('passwordModal');
        
        if (emailModal && emailModal.classList.contains('show')) {
            closeEmailChangeModal();
            return;
        }
        
        if (passwordModal && passwordModal.classList.contains('show')) {
            closePasswordModal();
            return;
        }
        
        const editModeSection = document.querySelector('.edit-mode');
        if (editModeSection) {
            exitEditMode(editModeSection);
        }
    }
});

// Close modals when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal-overlay')) {
        if (e.target.id === 'emailChangeModal') {
            closeEmailChangeModal();
        } else if (e.target.id === 'passwordModal') {
            closePasswordModal();
        }
    }
});