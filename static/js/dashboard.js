// ===========================
// DASHBOARD JAVASCRIPT
// ===========================

// Global Chart Instance
let productionChart = null;

// ===========================
// CHART INITIALIZATION
// ===========================
function initializeChart(weeklyData) {
    const ctx = document.getElementById('productionChart');
    if (!ctx) return;
    
    // Extract labels and values from data
    const labels = weeklyData.map(item => item.day);
    const values = weeklyData.map(item => item.value);
    
    // Find max value for scaling
    const maxValue = Math.max(...values);
    const isToday = (index) => index === values.length - 1;
    
    // Destroy existing chart if it exists
    if (productionChart) {
        productionChart.destroy();
    }
    
    // Create new chart
    productionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: values.map((val, idx) => 
                    isToday(idx) ? 'rgba(102, 126, 234, 0.6)' : 'rgba(102, 126, 234, 0.2)'
                ),
                borderRadius: {
                    topLeft: 8,
                    topRight: 8
                },
                barPercentage: 0.8,
                categoryPercentage: 0.9,
                hoverBackgroundColor: values.map((val, idx) => 
                    isToday(idx) ? 'rgba(102, 126, 234, 0.6)' : 'rgba(102, 126, 234, 0.4)'
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12,
                    titleColor: '#f3f4f6',
                    bodyColor: '#f3f4f6',
                    cornerRadius: 8,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + 'L';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Lexend',
                            size: 10,
                            weight: '700'
                        },
                        color: '#6b7280'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#f3f4f6',
                        drawBorder: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        display: false
                    }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// ===========================
// SIDEBAR BEHAVIOR
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.getElementById('sidebar');
    
    // Sidebar already has CSS :hover state
    // This is just for additional JS-based interactions if needed
    
    // Optional: Add click event for mobile toggle
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            // Remove active class from all items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            this.classList.add('active');
        });
    });
});

// ===========================
// CHART TAB SWITCHING
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const chartTabs = document.querySelectorAll('.chart-tab');
    
    chartTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            chartTabs.forEach(t => t.classList.remove('active'));
            // Add active class to clicked tab
            this.classList.add('active');
            
            // You can add logic here to switch between daily/weekly data
            // For now, it's just visual
        });
    });
});

// ===========================
// MOBILE FAB BUTTON
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const mobileFab = document.querySelector('.mobile-fab');
    
    if (mobileFab) {
        mobileFab.addEventListener('click', function() {
            // Add your quick action logic here
            alert('Quick Record functionality - Add your custom action here!');
        });
    }
});

// ===========================
// SEARCH FUNCTIONALITY
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.querySelector('.search-box input');
    
    if (searchInput) {
        searchInput.addEventListener('input', function(e) {
            const searchTerm = e.target.value.toLowerCase();
            // Add your search logic here
            console.log('Searching for:', searchTerm);
        });
    }
});

// ===========================
// ALERT ITEM INTERACTIONS
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const alertItems = document.querySelectorAll('.alert-item');
    
    alertItems.forEach(item => {
        item.addEventListener('click', function() {
            const alertTitle = this.querySelector('.alert-title').textContent;
            console.log('Alert clicked:', alertTitle);
            // Add your alert action logic here
        });
    });
});

// ===========================
// ACTIVITY ITEM INTERACTIONS
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    const activityItems = document.querySelectorAll('.activity-item');
    
    activityItems.forEach(item => {
        item.addEventListener('click', function() {
            const activityTitle = this.querySelector('.activity-title').textContent;
            console.log('Activity clicked:', activityTitle);
            // Add your activity detail view logic here
        });
    });
});

// ===========================
// RESPONSIVE UTILITIES
// ===========================
function checkMobile() {
    return window.innerWidth < 1024;
}

// Update on resize
window.addEventListener('resize', function() {
    if (productionChart) {
        productionChart.resize();
    }
});

// ===========================
// UTILITY FUNCTIONS
// ===========================
function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric'
    }).format(new Date(date));
}

// ===========================
// EXPORT FOR USE IN TEMPLATES
// ===========================
window.dashboardUtils = {
    initializeChart,
    formatNumber,
    formatCurrency,
    formatDate,
    checkMobile
};