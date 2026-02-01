// Global variables
let currentViewType = 'last_7';
let currentData = [];
let currentReportData = null;
let cattleId = null;
let milkChart = null;
function drawLineChart(data) {
    if (!data || data.length === 0) return;

    const dates = data.map(d => d.date);
    const values = data.map(d => Number(d.quantity));

    const options = {
        chart: {
            type: 'area',
            height: 350,
            toolbar: { show: false },
            animations: { enabled: false }
        },
        series: [{
            name: 'Milk (Liters)',
            data: values
        }],
        xaxis: {
            categories: dates,
            labels: { rotate: -45 }
        },
        stroke: {
            curve: 'straight',
            width: 3
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 0,
                opacityFrom: 0.50,
                opacityTo: 0.25,
                stops: [0, 90, 100]
            }
        },
dataLabels: {
    enabled: false   // 🔥 THIS HIDES VALUES
},
        markers: {
            size: 6,
            strokeWidth: 2,
            hover: { size: 6 }
        },
        colors: ['#4F46E5'],
        grid: {
            borderColor: '#e5e7eb',
            strokeDashArray: 4
        },
        yaxis: {
            title: { text: 'Liters' }
        },
        tooltip: {
            theme: 'light'
        }
    };

    if (milkChart) milkChart.destroy();

    milkChart = new ApexCharts(
        document.querySelector("#milkChart"),
        options
    );
    milkChart.render();
}

// Initialize on page load
window.onload = function() {
    console.log('Page loaded, initializing...');
    
    // Get cattle ID and initial data from page
    const pageData = document.getElementById('pageData');
    if (pageData) {
        cattleId = pageData.dataset.cattleId;
        console.log('Cattle ID:', cattleId);
        
        const defaultHistory = pageData.dataset.history;
        console.log('Default history data:', defaultHistory);
        
        if (defaultHistory) {
            try {
                currentData = JSON.parse(defaultHistory);
                console.log('Parsed data:', currentData);
                
                if (currentData && currentData.length > 0) {
                    drawLineChart(currentData);
                } else {
                    console.warn('No data available in default history');
                }
            } catch (e) {
                console.error('Error parsing default history:', e);
                console.error('Raw data:', defaultHistory);
            }
        } else {
            console.warn('No default history data attribute found');
        }
    } else {
        console.error('pageData element not found!');
    }
    
    setupNavigation();
    setMaxDate();
}

// Setup navigation dropdown
function setupNavigation() {
    const profileBtn = document.getElementById('profileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (profileBtn && dropdownMenu) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', function() {
            dropdownMenu.classList.remove('show');
        });
    }

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
}

// Set max date for date inputs
function setMaxDate() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate) startDate.max = today;
    if (endDate) endDate.max = today;
}

// Change view handler
function changeView(event, viewType) {
    currentViewType = viewType;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show/hide custom range filter
    const customRange = document.getElementById('customRangeFilter');
    if (viewType === 'custom') {
        customRange.classList.add('show');
        return;
    } else {
        customRange.classList.remove('show');
    }
    
    // Fetch data from backend
    fetchFilteredData(viewType);
}

// Apply custom date range
function applyCustomRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    if (startDate > endDate) {
        alert('Start date must be before end date');
        return;
    }
    
    fetchFilteredData('custom', startDate, endDate);
}

// Fetch filtered data from backend
function fetchFilteredData(viewType, startDate = null, endDate = null) {
    const requestData = {
        view_type: viewType
    };
    
    if (viewType === 'custom') {
        requestData.start_date = startDate;
        requestData.end_date = endDate;
    }
    
    console.log('Fetching data:', requestData);
    
    fetch(`/api/cattle/${cattleId}/filter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('API Response:', result);
       
        if (result.success && result.data) {
            currentData = result.data.history || [];
            updateDisplay(result.data, viewType);
	    drawLineChart(result.data.history);

        } else {
            console.error('API returned success=false or missing data');
            showSuccess('Error: Could not load data');
        }
    })
    .catch(error => {
        console.error('Fetch error:', error);
        showSuccess('Error connecting to server: ' + error.message);
    });
}

// Update display with new data
function updateDisplay(data, viewType) {
    // Update average display
    const avgLabel = document.getElementById('averageLabel');
    const avgValue = document.getElementById('averageValue');
    
    if (viewType === 'last_7') {
        avgLabel.textContent = 'Average Milk (Last 7 Days)';
    } else if (viewType === 'all_time') {
        avgLabel.textContent = 'Average Milk (All Time)';
    } else {
        avgLabel.textContent = 'Average Milk (Custom Range)';
    }
    avgValue.textContent = data.avg_milk + ' Liters/day';
    
    // Update chart title
    const chartTitle = document.getElementById('chartTitle');
    if (viewType === 'last_7') {
        chartTitle.textContent = 'Milk Performance (Last 7 Days)';
    } else if (viewType === 'all_time') {
        chartTitle.textContent = 'Milk Performance (All Time)';
    } else {
        chartTitle.textContent = 'Milk Performance (Custom Range)';
    }
drawLineChart(data.history);
}

// Open report modal
function openReportModal() {
    // Check if we have cattle ID
    if (!cattleId) {
        console.error('No cattle ID found');
        showSuccess('Error: Cattle ID not found');
        return;
    }
    const total = currentData.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
);

const average = (total / currentData.length).toFixed(1);

const highest = currentData.reduce(
    (max, item) =>
        Number(item.quantity) > Number(max.quantity) ? item : max,
    currentData[0]
);
    // Use current data if available, otherwise fetch from backend
    if (currentData && currentData.length > 0) {
        // Calculate statistics from current data
        const total = currentData.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
);
        const average = (total / currentData.length).toFixed(1);
        const highest = currentData.reduce((max, item) => 
    Number(item.quantity) > Number(max.quantity) ? item : max,
    currentData[0]
);
        
        const pageData = document.getElementById('pageData');
        const cattleName = pageData ? pageData.dataset.cattleName : 'Cattle';
        
        // Update modal content
        document.getElementById('modalCattleName').textContent = cattleName;
        document.getElementById('reportTotal').textContent = total.toFixed(1) + 'L';
        document.getElementById('reportAverage').textContent = average + 'L';
        document.getElementById('reportHighest').textContent = 
            highest?.quantity || 0 + 'L on ' + formatDate(highest?.date || new Date());
        document.getElementById('reportCount').textContent = currentData.length;
        
        // Store report data for download
        currentReportData = {
            cattleName: cattleName,
            total: total.toFixed(1),
            average: average,
            highest: highest,
            recordCount: currentData.length,
            viewType: currentViewType,
            data: currentData
        };
        
        document.getElementById('reportModal').classList.add('show');
        return;
    }
    
    // Fetch fresh data from backend if no current data
    const requestData = {
        view_type: currentViewType
    };
    
    console.log('Fetching report data for cattle:', cattleId);
    
    fetch(`/api/cattle/${cattleId}/filter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('API Response:', result);
        
        if (result.success && result.data) {
            const data = result.data;
            const pageData = document.getElementById('pageData');
            const cattleName = pageData ? pageData.dataset.cattleName : 'Cattle';
            
            // Update modal content
            document.getElementById('modalCattleName').textContent = cattleName;
            document.getElementById('reportTotal').textContent = 
                (data.total_milk || 0).toFixed(1) + 'L';
            document.getElementById('reportAverage').textContent = 
                (data.avg_milk || 0) + 'L';
            document.getElementById('reportHighest').textContent = 
                (data.highest_day.quantity || 0) + 'L on ' + 
                formatDate(data.highest_day.date || 'N/A');
            document.getElementById('reportCount').textContent = 
                data.record_count || 0;
            
            // Store report data for download
            currentReportData = {
                cattleName: cattleName,
                total: (data.total_milk || 0).toFixed(1),
                average: data.avg_milk || 0,
                highest: data.highest_day || { date: 'N/A', quantity: 0 },
                recordCount: data.record_count || 0,
                viewType: currentViewType,
                data: data.history || []
            };
            
            document.getElementById('reportModal').classList.add('show');
        } else {
            console.error('Invalid response format:', result);
            showSuccess('Error: Invalid response from server');
        }
    })
    .catch(error => {
        console.error('Error loading report:', error);
        showSuccess('Error loading report data: ' + error.message);
    });
}
function downloadReport() {
    closeModal();

    const params = new URLSearchParams({
        view_type: currentViewType
    });

    if (currentViewType === 'custom') {
        params.append('start_date', document.getElementById('startDate').value);
        params.append('end_date', document.getElementById('endDate').value);
    }

    setTimeout(() => {
        window.location.href = `/cattle/${cattleId}/report?` + params.toString();
    }, 300);
}
// Close modal
function closeModal() {
    document.getElementById('reportModal').classList.remove('show');
}

// Format date for display
function formatDate(dateStr) {
    if (typeof dateStr === 'string' && dateStr.includes(' ')) {
        return dateStr;
    }

    const date = new Date(dateStr);
    if (isNaN(date)) return dateStr;

    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

// Helper functions for report generation
function getViewTypeName(viewType) {
    switch(viewType) {
        case 'last_7': return 'Last 7 Days';
        case 'last_30': return 'Last 30 Days';
        case 'all_time': return 'All Time';
        case 'custom': return 'Custom Date Range';
        default: return 'Unknown';
    }
}

function getPerformanceRating(average) {
    average = parseFloat(average);
    if (average >= 25) return 'Excellent - Above industry average';
    if (average >= 20) return 'Good - Meeting expectations';
    if (average >= 15) return 'Average - Room for improvement';
    return 'Below Average - Attention required';
}

function getTrendAnalysis(data) {
    if (data.length < 3) return 'Insufficient data for trend analysis.';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, item) => sum + item.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + item.quantity, 0) / secondHalf.length;
    
    const diff = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
    
    if (diff > 5) return `Positive trend: Production increased by ${diff}% in recent period.`;
    if (diff < -5) return `Declining trend: Production decreased by ${Math.abs(diff)}% in recent period.`;
    return `Stable: Production remained consistent with ${Math.abs(diff)}% variation.`;
}

function getRecommendations(average, breed) {
    average = parseFloat(average);
    let recommendations = [];
    
    if (average < 20) {
        recommendations.push('• Consider reviewing nutrition plan with a veterinarian');
        recommendations.push('• Ensure adequate water intake (cows need 30-50 gallons/day)');
        recommendations.push('• Check for signs of stress or illness');
    }
    
    if (breed === 'Holstein') {
        recommendations.push('• Holstein cows typically produce 25-30L/day at peak lactation');
        recommendations.push('• Ensure high-quality forage and balanced mineral supplements');
    }
    
    recommendations.push('• Maintain regular milking schedule (2-3 times daily)');
    recommendations.push('• Monitor udder health and cleanliness');
    recommendations.push('• Keep detailed records for veterinary consultation');
    
    return recommendations.join('\n');
}

// Success message
function showSuccess(message) {
    const msg = document.getElementById('successMessage');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal();
    }
}

// Handle window resize for responsive chart
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (currentData.length > 0) {
            drawChart(currentData);
        }
    }, 250);
});
// Modal Toggle Functions
function openEditModal() {
    document.getElementById('editModal').classList.add('show');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
}

// Handle Form Submission
document.getElementById('editCattleForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const updatedData = {
        name: document.getElementById('editName').value,
        breed: document.getElementById('editBreed').value,
        age: document.getElementById('editAge').value,
        health: document.getElementById('editHealth').value
    };

    fetch(`/api/cattle/${cattleId}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showSuccess('Cattle details updated successfully!');
            setTimeout(() => location.reload(), 1000); // Reload to reflect changes
        } else {
            showSuccess('Error: Could not update details');
        }
    })
    .catch(err => console.error('Error:', err));
});