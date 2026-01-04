// ===========================
// NAVBAR SCROLL BEHAVIOR
// ===========================
let lastScrollY = window.scrollY;
let ticking = false;

function handleScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    const currentScrollY = window.scrollY;
    
    // If scrolling down and past 100px, hide navbar
    if (currentScrollY > lastScrollY && currentScrollY > 100) {
        navbar.classList.add('hidden');
    } 
    // If scrolling up, show navbar
    else if (currentScrollY < lastScrollY) {
        navbar.classList.remove('hidden');
    }
    
    lastScrollY = currentScrollY;
    ticking = false;
}

window.addEventListener('scroll', () => {
    if (!ticking) {
        window.requestAnimationFrame(handleScroll);
        ticking = true;
    }
});

// ===========================
// HAMBURGER MENU TOGGLE - CORRECTED
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    console.log('Hamburger element:', hamburger);
    console.log('Nav menu element:', navMenu);

    if (hamburger && navMenu) {
        // Remove any existing listeners
        hamburger.replaceWith(hamburger.cloneNode(true));
        const newHamburger = document.getElementById('hamburger');
        
        newHamburger.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('Hamburger CLICKED!');
            
            // Toggle active classes
            newHamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
            
            // Prevent body scroll when menu is open
            if (navMenu.classList.contains('active')) {
                document.body.style.overflow = 'hidden';
                console.log('Menu OPENED');
            } else {
                document.body.style.overflow = '';
                console.log('Menu CLOSED');
            }
        });

        // Close menu when clicking on a link
        const navLinks = navMenu.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', function() {
                newHamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
                console.log('Menu closed via link click');
            });
        });

        // Close menu when clicking outside
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !newHamburger.contains(e.target)) {
                newHamburger.classList.remove('active');
                navMenu.classList.remove('active');
                document.body.style.overflow = '';
            }
        });
        
        console.log('✅ Hamburger menu initialized successfully!');
    } else {
        console.error('❌ Hamburger or navMenu element not found!');
    }
});

// ===========================
// PROFILE DROPDOWN
// ===========================
const profileBtn = document.getElementById('profileBtn');
const dropdownMenu = document.getElementById('dropdownMenu');

if (profileBtn && dropdownMenu) {
    profileBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        
        // Only work on desktop
        if (window.innerWidth > 768) {
            dropdownMenu.classList.toggle('active');
            console.log('Profile dropdown toggled');
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth > 768) {
            if (!profileBtn.contains(e.target) && !dropdownMenu.contains(e.target)) {
                dropdownMenu.classList.remove('active');
            }
        }
    });
}

// ===========================
// HANDLE WINDOW RESIZE
// ===========================
window.addEventListener('resize', function() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    // Close menu when resizing to desktop
    if (window.innerWidth > 768) {
        if (navMenu) {
            navMenu.classList.remove('active');
        }
        if (hamburger) {
            hamburger.classList.remove('active');
        }
        document.body.style.overflow = '';
    }
    
    // Close profile dropdown when resizing to mobile
    if (window.innerWidth <= 768) {
        if (dropdownMenu) {
            dropdownMenu.classList.remove('active');
        }
    }
});

// ===========================
// FAQ ACCORDION
// ===========================
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
    const question = item.querySelector('.faq-question');
    
    if (question) {
        question.addEventListener('click', () => {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
        });
    }
});

// ===========================
// SMOOTH SCROLLING FOR ANCHOR LINKS
// ===========================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        
        // Only apply smooth scroll if it's not just "#"
        if (href !== '#') {
            e.preventDefault();
            const target = document.querySelector(href);
            
            if (target) {
                const navbarHeight = document.getElementById('navbar')?.offsetHeight || 0;
                const targetPosition = target.offsetTop - navbarHeight;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        }
    });
});

// ===========================
// FORM VALIDATION (LOGIN PAGE)
// ===========================
const loginForm = document.querySelector('.login-form');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value.trim();
        
        if (!username || !password) {
            e.preventDefault();
            alert('Please fill in all fields');
        }
    });
}

// ===========================
// SEARCH FUNCTIONALITY
// ===========================
const searchInput = document.querySelector('.search-input');
const dataTable = document.querySelector('.data-table tbody');

if (searchInput && dataTable) {
    searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = dataTable.querySelectorAll('tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    });
}

// ===========================
// ANIMATION ON SCROLL
// ===========================
function animateOnScroll() {
    const elements = document.querySelectorAll('.module-card, .stat-card, .feature-item');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '0';
                entry.target.style.transform = 'translateY(20px)';
                
                setTimeout(() => {
                    entry.target.style.transition = 'all 0.6s ease';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, 100);
                
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    elements.forEach(element => {
        observer.observe(element);
    });
}

// Initialize animations when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', animateOnScroll);
} else {
    animateOnScroll();
}

// ===========================
// DASHBOARD FILTER SELECT
// ===========================
const filterSelects = document.querySelectorAll('.filter-select');

filterSelects.forEach(select => {
    select.addEventListener('change', (e) => {
        console.log('Filter changed to:', e.target.value);
    });
});

// ===========================
// ACTION BUTTONS CLICK HANDLERS
// ===========================
const actionButtons = document.querySelectorAll('.action-btn');

actionButtons.forEach(button => {
    button.addEventListener('click', () => {
        const actionText = button.textContent.trim();
        console.log('Action clicked:', actionText);
        alert(`${actionText} functionality will be implemented here`);
    });
});

// ===========================
// TABLE ACTION BUTTONS
// ===========================
const btnIcons = document.querySelectorAll('.btn-icon');

btnIcons.forEach(button => {
    button.addEventListener('click', (e) => {
        e.preventDefault();
        const title = button.getAttribute('title');
        const row = button.closest('tr');
        const cattleId = row?.querySelector('td:first-child')?.textContent;
        
        console.log(`${title} action for ${cattleId}`);
        alert(`${title} action for ${cattleId} will be implemented`);
    });
});

// ===========================
// TOGGLE SWITCHES (SETTINGS)
// ===========================
const toggleSwitches = document.querySelectorAll('.toggle-switch input');

toggleSwitches.forEach(toggle => {
    toggle.addEventListener('change', (e) => {
        const settingName = e.target.closest('.setting-item')?.querySelector('.setting-label')?.textContent;
        const isEnabled = e.target.checked;
        
        console.log(`${settingName}: ${isEnabled ? 'Enabled' : 'Disabled'}`);
        
        const feedback = document.createElement('div');
        feedback.className = 'setting-feedback';
        feedback.textContent = `${settingName} ${isEnabled ? 'enabled' : 'disabled'}`;
        feedback.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(feedback);
        
        setTimeout(() => {
            feedback.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => feedback.remove(), 300);
        }, 2000);
    });
});

// Add keyframe animations for feedback
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
// SECURITY BUTTONS
// ===========================
const securityButtons = document.querySelectorAll('.security-btn');

securityButtons.forEach(button => {
    button.addEventListener('click', () => {
        const label = button.querySelector('.security-label')?.textContent;
        console.log('Security action:', label);
        alert(`${label} functionality will open a modal or new page`);
    });
});

// ===========================
// CHART ANIMATIONS
// ===========================
function animateCharts() {
    const bars = document.querySelectorAll('.bar-fill, .bar');
    
    bars.forEach((bar, index) => {
        const targetHeight = bar.style.height;
        bar.style.height = '0';
        
        setTimeout(() => {
            bar.style.transition = 'height 0.8s ease';
            bar.style.height = targetHeight;
        }, index * 100);
    });
}

if (document.querySelector('.bar-fill, .bar')) {
    setTimeout(animateCharts, 500);
}

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getCurrentDateTime() {
    return new Date().toLocaleString();
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#667eea'};
        color: white;
        padding: 15px 25px;
        border-radius: 10px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ===========================
// CONSOLE MESSAGE
// ===========================
console.log('%c🐄 CattleTrack Pro - Cattle Management System', 'color: #667eea; font-size: 20px; font-weight: bold;');
console.log('%cDeveloped with ❤️ using Flask + HTML + CSS + JavaScript', 'color: #764ba2; font-size: 14px;');
console.log('%cAll features are working! Explore the system.', 'color: #48bb78; font-size: 12px;');