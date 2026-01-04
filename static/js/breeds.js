/* ===========================
   BREEDS PAGE JAVASCRIPT
   =========================== */

// Filter breeds by type (all, indian, foreign)
function filterBreeds(type) {
    const cards = document.querySelectorAll('.breed-card');
    const filterButtons = document.querySelectorAll('.filter-btn');
    const noResults = document.getElementById('noResults');
    let visibleCount = 0;
    
    // Update active button
    filterButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-filter') === type) {
            btn.classList.add('active');
        }
    });
    
    // Filter cards
    cards.forEach(card => {
        const cardType = card.getAttribute('data-type');
        
        if (type === 'all') {
            card.classList.remove('hidden');
            card.style.display = 'block';
            visibleCount++;
        } else if (cardType === type) {
            card.classList.remove('hidden');
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.classList.add('hidden');
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    if (visibleCount === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
    }
    
    // Log filter action
    console.log(`Filtered by: ${type} - Showing ${visibleCount} breeds`);
}

// Search breeds by name
function searchBreeds() {
    const searchInput = document.getElementById('breedSearch');
    const searchTerm = searchInput.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.breed-card');
    const noResults = document.getElementById('noResults');
    const activeFilter = document.querySelector('.filter-btn.active').getAttribute('data-filter');
    let visibleCount = 0;
    
    cards.forEach(card => {
        const breedName = card.querySelector('.breed-name').textContent.toLowerCase();
        const cardType = card.getAttribute('data-type');
        
        // Check if card matches both search and filter
        const matchesSearch = breedName.includes(searchTerm);
        const matchesFilter = activeFilter === 'all' || cardType === activeFilter;
        
        if (matchesSearch && matchesFilter) {
            card.classList.remove('hidden');
            card.style.display = 'block';
            visibleCount++;
        } else {
            card.classList.add('hidden');
            card.style.display = 'none';
        }
    });
    
    // Show/hide no results message
    if (visibleCount === 0) {
        noResults.style.display = 'block';
    } else {
        noResults.style.display = 'none';
    }
    
    // Log search action
    if (searchTerm) {
        console.log(`Searched for: "${searchTerm}" - Found ${visibleCount} breeds`);
    }
}

// Update breed counts on page load
function updateBreedCounts() {
    const allCards = document.querySelectorAll('.breed-card');
    const indianCards = document.querySelectorAll('.breed-card[data-type="indian"]');
    const foreignCards = document.querySelectorAll('.breed-card[data-type="foreign"]');
    
    document.getElementById('count-all').textContent = allCards.length;
    document.getElementById('count-indian').textContent = indianCards.length;
    document.getElementById('count-foreign').textContent = foreignCards.length;
    
    console.log(`Total breeds: ${allCards.length} (${indianCards.length} Indian, ${foreignCards.length} Foreign)`);
}

// Smooth scroll animation for cards
function observeCards() {
    const cards = document.querySelectorAll('.breed-card');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '0';
                    entry.target.style.transform = 'translateY(20px)';
                    
                    setTimeout(() => {
                        entry.target.style.transition = 'all 0.5s ease';
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, 50);
                }, index * 100);
                
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1
    });
    
    cards.forEach(card => {
        observer.observe(card);
    });
}

// Clear search when filter changes
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const searchInput = document.getElementById('breedSearch');
        if (searchInput) {
            searchInput.value = '';
        }
    });
});

// Add hover effect sound feedback (visual only, no actual sound)
document.addEventListener('DOMContentLoaded', function() {
    const cards = document.querySelectorAll('.breed-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.cursor = 'pointer';
        });
        
        // Optional: Click to expand details
        card.addEventListener('click', function(e) {
            // Prevent click if user is selecting text
            if (window.getSelection().toString()) {
                return;
            }
            
            console.log(`Clicked on: ${this.querySelector('.breed-name').textContent}`);
            // You can add modal or expanded view here
        });
    });
    
    // Update counts on load
    updateBreedCounts();
    
    // Observe cards for animation
    observeCards();
    
    // Log page load
    console.log('🐄 Breeds Page Loaded Successfully!');
    console.log('Available filters: All Breeds, Indian Breeds, Foreign Breeds');
});

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Press '/' to focus search
    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('breedSearch').focus();
    }
    
    // Press 'Escape' to clear search
    if (e.key === 'Escape') {
        const searchInput = document.getElementById('breedSearch');
        if (searchInput.value) {
            searchInput.value = '';
            searchBreeds();
        }
    }
    
    // Press 1, 2, 3 for filter shortcuts
    if (e.key === '1') {
        filterBreeds('all');
    } else if (e.key === '2') {
        filterBreeds('indian');
    } else if (e.key === '3') {
        filterBreeds('foreign');
    }
});

// Add search icon animation
const searchInput = document.getElementById('breedSearch');
const searchIcon = document.querySelector('.search-icon');

if (searchInput && searchIcon) {
    searchInput.addEventListener('focus', function() {
        searchIcon.style.transform = 'translateY(-50%) scale(1.2)';
        searchIcon.style.color = '#667eea';
    });
    
    searchInput.addEventListener('blur', function() {
        searchIcon.style.transform = 'translateY(-50%) scale(1)';
        searchIcon.style.color = '#a0aec0';
    });
}

// Highlight matching text in search results (optional enhancement)
function highlightSearchText() {
    const searchTerm = document.getElementById('breedSearch').value.toLowerCase().trim();
    
    if (!searchTerm) return;
    
    const visibleCards = document.querySelectorAll('.breed-card:not(.hidden)');
    
    visibleCards.forEach(card => {
        const breedName = card.querySelector('.breed-name');
        const originalText = breedName.textContent;
        const lowerText = originalText.toLowerCase();
        
        if (lowerText.includes(searchTerm)) {
            const startIndex = lowerText.indexOf(searchTerm);
            const endIndex = startIndex + searchTerm.length;
            
            const highlightedText = 
                originalText.substring(0, startIndex) +
                '<span style="background: #fef5e7; color: #667eea; font-weight: 700;">' +
                originalText.substring(startIndex, endIndex) +
                '</span>' +
                originalText.substring(endIndex);
            
            breedName.innerHTML = highlightedText;
        }
    });
}

// Reset breed names to original text
function resetBreedNames() {
    const breedNames = document.querySelectorAll('.breed-name');
    breedNames.forEach(name => {
        const text = name.textContent; // This gets the text without HTML
        name.textContent = text;
    });
}

// Update search function to include highlighting
const originalSearchBreeds = searchBreeds;
searchBreeds = function() {
    resetBreedNames();
    originalSearchBreeds();
    // Uncomment to enable search highlighting:
    // highlightSearchText();
};

// Lazy load images (optional performance enhancement)
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    });
    
    // Observe all images (if you want to implement lazy loading)
    // document.querySelectorAll('.breed-image img').forEach(img => {
    //     imageObserver.observe(img);
    // });
}

// Export filter and search functions for potential use in other scripts
window.filterBreeds = filterBreeds;
window.searchBreeds = searchBreeds;