// ===========================
// CATTLE HERD JAVASCRIPT
// ===========================

let searchTimeout = null;

// ===========================
// DOMContentLoaded — single listener
// ===========================
document.addEventListener('DOMContentLoaded', function () {

    // Logout confirm modal
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            new bootstrap.Modal(document.getElementById('logoutModal')).show();
        });
    }

    // Core inits
    injectBreedImages();
    initializeSearch();
    initializeFilters();
    initializeKeyboardShortcuts();
});

// ===========================
// BREED IMAGE INJECTION
// ===========================
function injectBreedImages() {
    if (typeof BREED_IMAGES === 'undefined') return;

    // Find all cattle cards and set image based on breed text
    document.querySelectorAll('.cattle-card').forEach(card => {
        const detailEl = card.querySelector('.cattle-details');
        if (!detailEl) return;

        // Format: "Name • Breed"
        const parts = detailEl.textContent.split('•');
        if (parts.length < 2) return;

        const breed = parts[1].trim();
        const img   = card.querySelector('.cattle-avatar img');
        if (!img) return;

        // Only override if the server didn't already provide a real image
        // (server sets cattle.image_url; if it's a placeholder/empty, replace)
        const src = img.getAttribute('src') || '';
        const isPlaceholder = !src ||
            src.includes('placeholder') ||
            src.includes('via.placeholder') ||
            src.includes('picsum') ||
            src.includes('lorempixel') ||
            src === '' || src === '#';

        if (isPlaceholder || true) {
            // Always use breed-specific image — looks much better
            const breedImg = BREED_IMAGES[breed] || BREED_IMAGES['default'];
            img.src = breedImg;
        }

        // Fallback on error
        img.onerror = function () {
            this.src = BREED_IMAGES['default'];
            this.onerror = null;
        };
    });
}

// ===========================
// SEARCH
// ===========================
function initializeSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
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
    urlParams.set('filter', window.currentFilter || 'all');
    urlParams.set('page', '1');
    window.location.href = `/cattle?${urlParams.toString()}`;
}

// ===========================
// FILTERS
// ===========================
function initializeFilters() {
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            applyFilter(this.getAttribute('data-filter'));
        });
    });
}

function applyFilter(filter) {
    window.currentFilter = filter;
    const urlParams = new URLSearchParams(window.location.search);
    urlParams.set('filter', filter);
    urlParams.set('page', '1');
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value) urlParams.set('search', searchInput.value);
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
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const formData   = new FormData(form);
    const submitBtn  = document.querySelector('#addCattleModal .btn-primary');
    const origText   = submitBtn.innerHTML;

    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Adding…';
    submitBtn.disabled  = true;

    fetch('/cattle/add', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                bootstrap.Modal.getInstance(document.getElementById('addCattleModal')).hide();
                form.reset();
                showNotification('Cattle added successfully!', 'success');
                setTimeout(() => window.location.reload(), 900);
            } else {
                showNotification(data.message || 'Error adding cattle', 'error');
                submitBtn.innerHTML = origText;
                submitBtn.disabled  = false;
            }
        })
        .catch(() => {
            showNotification('Network error. Please try again.', 'error');
            submitBtn.innerHTML = origText;
            submitBtn.disabled  = false;
        });
}

// ===========================
// NOTIFICATIONS — matches dashboard toast style
// ===========================
function showNotification(message, type) {
    const colors = { success: '#22c55e', error: '#ef4444', info: '#667eea' };
    const icons  = { success: 'check_circle', error: 'error', info: 'info' };
    const c  = colors[type] || colors.info;
    const ic = icons[type]  || icons.info;

    const t = document.createElement('div');
    t.style.cssText = [
        'position:fixed', 'top:20px', 'right:20px', 'z-index:9999',
        'background:#fff', 'padding:.875rem 1.25rem', 'border-radius:10px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
        'display:flex', 'align-items:center', 'gap:.75rem',
        "font-family:'Lexend',sans-serif", 'font-weight:500', 'font-size:.9375rem',
        `border-left:4px solid ${c}`, `color:${c}`,
        'transform:translateX(420px)', 'opacity:0',
        'transition:all .3s ease', 'max-width:340px'
    ].join(';');
    t.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${ic}</span><span>${message}</span>`;
    document.body.appendChild(t);

    setTimeout(() => { t.style.transform = 'translateX(0)'; t.style.opacity = '1'; }, 10);
    setTimeout(() => {
        t.style.transform = 'translateX(420px)'; t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

// ===========================
// KEYBOARD SHORTCUTS
// ===========================
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('searchInput')?.focus();
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            document.querySelector('[data-bs-target="#addCattleModal"]')?.click();
        }
    });
}