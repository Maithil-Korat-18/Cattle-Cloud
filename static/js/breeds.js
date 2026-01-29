// Combined Breeds Page JavaScript - CattleTrack Pro
        
        // Filter breeds by type
        function filterBreeds(filterType) {
            const breedCards = document.querySelectorAll('.breed-card');
            const filterButtons = document.querySelectorAll('.filter-btn');
            const noResults = document.getElementById('noResults');
            let visibleCount = 0;

            // Update active filter button
            filterButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.filter === filterType) {
                    btn.classList.add('active');
                }
            });

            // Filter cards with animation
            breedCards.forEach((card, index) => {
                const cardType = card.dataset.type;
                
                if (filterType === 'all' || cardType === filterType) {
                    setTimeout(() => {
                        card.style.display = 'block';
                        card.classList.add('fade-in');
                        setTimeout(() => {
                            card.classList.remove('fade-in');
                        }, 500);
                    }, index * 50);
                    visibleCount++;
                } else {
                    card.classList.add('fade-out');
                    setTimeout(() => {
                        card.style.display = 'none';
                        card.classList.remove('fade-out');
                    }, 300);
                }
            });

            // Show/hide no results message
            setTimeout(() => {
                if (visibleCount === 0) {
                    noResults.style.display = 'block';
                } else {
                    noResults.style.display = 'none';
                }
            }, 400);
        }

        // Search breeds by name
        let searchTimeout;
        function searchBreeds() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchInput = document.getElementById('breedSearch');
                const searchTerm = searchInput.value.toLowerCase().trim();
                const breedCards = document.querySelectorAll('.breed-card');
                const noResults = document.getElementById('noResults');
                const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
                let visibleCount = 0;

                breedCards.forEach((card, index) => {
                    const breedName = card.querySelector('.breed-name').textContent.toLowerCase();
                    const cardType = card.dataset.type;
                    const matchesSearch = breedName.includes(searchTerm);
                    const matchesFilter = activeFilter === 'all' || cardType === activeFilter;

                    if (matchesSearch && matchesFilter) {
                        setTimeout(() => {
                            card.style.display = 'block';
                            card.classList.add('fade-in');
                            
                            // Highlight matching text
                            highlightSearchTerm(card, searchTerm);
                            
                            setTimeout(() => {
                                card.classList.remove('fade-in');
                            }, 500);
                        }, index * 30);
                        visibleCount++;
                    } else {
                        card.classList.add('fade-out');
                        setTimeout(() => {
                            card.style.display = 'none';
                            card.classList.remove('fade-out');
                        }, 200);
                    }
                });

                // Show/hide no results message
                setTimeout(() => {
                    if (visibleCount === 0) {
                        noResults.style.display = 'block';
                    } else {
                        noResults.style.display = 'none';
                    }
                }, 300);
            }, 300);
        }

        // Highlight search term in breed name
        function highlightSearchTerm(card, searchTerm) {
            const breedNameElement = card.querySelector('.breed-name');
            const originalText = breedNameElement.getAttribute('data-original-name') || breedNameElement.textContent;
            
            if (!breedNameElement.hasAttribute('data-original-name')) {
                breedNameElement.setAttribute('data-original-name', originalText);
            }
            
            if (searchTerm === '') {
                breedNameElement.innerHTML = originalText;
                return;
            }

            const regex = new RegExp(`(${searchTerm})`, 'gi');
            const highlightedText = originalText.replace(regex, '<span class="highlight">$1</span>');
            breedNameElement.innerHTML = highlightedText;
        }

        // Add hover effects to breed cards
        document.addEventListener('DOMContentLoaded', function() {
            const breedCards = document.querySelectorAll('.breed-card');

            breedCards.forEach(card => {
                card.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-10px) scale(1.02)';
                });

                card.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0) scale(1)';
                });
            });

            // Add focus effect to search input
            const searchInput = document.getElementById('breedSearch');
            if (searchInput) {
                searchInput.addEventListener('focus', function() {
                    this.parentElement.classList.add('search-focused');
                });
                
                searchInput.addEventListener('blur', function() {
                    this.parentElement.classList.remove('search-focused');
                });
            }

            // Keyboard shortcuts
            document.addEventListener('keydown', function(e) {
                // Focus search on Ctrl/Cmd + K
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    searchInput.focus();
                }
                
                // Clear search on Escape
                if (e.key === 'Escape' && document.activeElement === searchInput) {
                    searchInput.value = '';
                    searchBreeds();
                    searchInput.blur();
                }
            });

            console.log('🐄 Breeds page loaded successfully!');
        });