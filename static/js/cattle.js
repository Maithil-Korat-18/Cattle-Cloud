// ===========================
// CATTLE HERD JAVASCRIPT
// ===========================

let currentFilter = 'all';
let searchTimeout = null;

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    initializeSearch();
    initializeFilters();
    initializeKeyboardShortcuts();
    
    // Get current filter from page
    if (window.currentFilter) {
        currentFilter = window.currentFilter;
    }
});

// ===========================
// SEARCH FUNCTIONALITY
// ===========================
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value);
            }, 500);
        });
    }
}

function performSearch(query) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('search', query);
    urlParams.set('filter', currentFilter);
    urlParams.set('page', '1');
    
    window.location.href = `/cattle?${urlParams.toString()}`;
}

// ===========================
// FILTER FUNCTIONALITY
// ===========================
function initializeFilters() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const filter = this.getAttribute('data-filter');
            applyFilter(filter);
        });
    });
}

function applyFilter(filter) {
    currentFilter = filter;
    
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('filter', filter);
    urlParams.set('page', '1');
    
    // Preserve search query if exists
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) {
        urlParams.set('search', searchInput.value);
    }
    
    window.location.href = `/cattle?${urlParams.toString()}`;
}

// ===========================
// PAGINATION
// ===========================
function changePage(pageNum) {
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('page', pageNum);
    
    window.location.href = `/cattle?${urlParams.toString()}`;
}

// ===========================
// ADD CATTLE MODAL
// ===========================
function submitCattle() {
    const form = document.getElementById('addCattleForm');
    
    // Validate form
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const submitBtn = event.target;
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding...';
    submitBtn.disabled = true;
    
    fetch('/cattle/add', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            // Close modal
            const modalElement = document.getElementById('addCattleModal');
            const modal = bootstrap.Modal.getInstance(modalElement);
            modal.hide();
            
            // Reset form
            form.reset();
            
            // Show success message
            showNotification('Cattle added successfully!', 'success');
            
            // Reload page after short delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(data.message || 'Error adding cattle', 'error');
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred while adding cattle', 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// ===========================
// NOTIFICATION SYSTEM
// ===========================
function showNotification(message, type) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} notification-toast`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// ===========================
// KEYBOARD SHORTCUTS
// ===========================
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        
        // Ctrl/Cmd + N to open add cattle modal
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            const addButton = document.querySelector('[data-bs-target="#addCattleModal"]');
            if (addButton) addButton.click();
        }
    });
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}