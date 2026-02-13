// ===========================
// CATTLE DETAIL PAGE JS
// ===========================

let milkChart = null;
let currentPage = 1;
let currentDays = 7;
let entriesPerPage = 10;
let allMilkRecords = [];

// ===========================
// INITIALIZATION
// ===========================
document.addEventListener('DOMContentLoaded', function() {
    initializeMilkChart(INITIAL_CHART_DATA);
    setupEventListeners();
    setDefaultDates();
    loadAllMilkRecords();
});

function setupEventListeners() {
    // Chart filter buttons
    document.querySelectorAll('.filter-btn[data-days]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.filter-btn:not([data-bs-toggle])').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const days = parseInt(this.getAttribute('data-days'));
            currentDays = days;
            loadChartData(days);
        });
    });
    
    // Record type tabs
    document.querySelectorAll('.record-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.record-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            const type = this.getAttribute('data-type');
            document.querySelectorAll('.record-form').forEach(form => {
                form.classList.remove('active');
            });
            
            if (type === 'milk') {
                document.getElementById('addMilkForm').classList.add('active');
            } else {
                document.getElementById('addHealthForm').classList.add('active');
            }
        });
    });
    
    // Entries per page selector
    const entriesSelect = document.getElementById('entriesPerPage');
    if (entriesSelect) {
        entriesSelect.addEventListener('change', function() {
            entriesPerPage = parseInt(this.value);
            currentPage = 1;
            displayMilkRecords();
        });
    }
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    
    // Set default date for milk record
    const milkDateInput = document.querySelector('#addMilkForm input[name="date"]');
    if (milkDateInput) {
        milkDateInput.value = today;
    }
    
    // Set default dates for report (last 30 days)
    const reportEndDate = document.getElementById('reportEndDate');
    const reportStartDate = document.getElementById('reportStartDate');
    if (reportEndDate && reportStartDate) {
        reportEndDate.value = today;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        reportStartDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
    
    // Set default dates for custom chart range (last 30 days)
    const customEndDate = document.getElementById('customEndDate');
    const customStartDate = document.getElementById('customStartDate');
    if (customEndDate && customStartDate) {
        customEndDate.value = today;
        
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        customStartDate.value = thirtyDaysAgo.toISOString().split('T')[0];
    }
}

// ===========================
// CHART INITIALIZATION
// ===========================
function initializeMilkChart(data) {
    const ctx = document.getElementById('milkChart');
    if (!ctx) return;
    
    // Sort data by date
    const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const labels = sortedData.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const milkData = sortedData.map(d => parseFloat(d.milk_liters) || 0);
    const maxValue = Math.max(...milkData, 10);
    
    if (milkChart) {
        milkChart.destroy();
    }
    
    milkChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Milk Production (L)',
                data: milkData,
                backgroundColor: 'rgba(102, 126, 234, 0.8)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 0,
                borderRadius: 8,
                barPercentage: 0.7
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
                    cornerRadius: 8,
                    titleFont: {
                        family: 'Inter',
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 13
                    },
                    callbacks: {
                        label: function(context) {
                            return 'Production: ' + context.parsed.y.toFixed(1) + ' L';
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
                            family: 'Inter',
                            size: 12,
                            weight: '500'
                        },
                        color: '#6b7280',
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    max: Math.ceil(maxValue * 1.1),
                    grid: {
                        color: '#f3f4f6',
                        drawBorder: false
                    },
                    border: {
                        display: false
                    },
                    ticks: {
                        font: {
                            family: 'Inter',
                            size: 12
                        },
                        color: '#6b7280',
                        stepSize: Math.ceil(maxValue / 5),
                        callback: function(value) {
                            return value + ' L';
                        }
                    }
                }
            }
        }
    });
}

// ===========================
// CHART DATA LOADING
// ===========================
function loadChartData(days, startDate = null, endDate = null) {
    let url = `/cattle/${CATTLE_ID}/milk-chart?days=${days}`;
    
    if (startDate && endDate) {
        url = `/cattle/${CATTLE_ID}/milk-chart?start_date=${startDate}&end_date=${endDate}`;
    }
    
    fetch(url)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                initializeMilkChart(result.data);
            } else {
                showNotification('Error loading chart data', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showNotification('Failed to load chart data', 'error');
        });
}

function applyCustomRange() {
    const form = document.getElementById('customRangeForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    
    if (new Date(startDate) > new Date(endDate)) {
        showNotification('Start date must be before end date', 'error');
        return;
    }
    
    // Remove active class from all filter buttons
    document.querySelectorAll('.filter-btn:not([data-bs-toggle])').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Load chart with custom range
    loadChartData(null, startDate, endDate);
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('customRangeModal'));
    modal.hide();
    
    showNotification('Custom range applied', 'success');
}

// ===========================
// MILK RECORDS
// ===========================
function loadAllMilkRecords() {
    fetch(`/cattle/${CATTLE_ID}/milk?page=1&per_page=1000`)
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                allMilkRecords = result.records;
                displayMilkRecords();
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

function displayMilkRecords() {
    const tbody = document.getElementById('milkRecordsTable');
    const recordsInfo = document.getElementById('recordsInfo');
    
    if (allMilkRecords.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">No milk records found</td></tr>';
        recordsInfo.textContent = 'Showing 0 entries';
        return;
    }
    
    // Calculate pagination
    const totalRecords = allMilkRecords.length;
    const totalPages = Math.ceil(totalRecords / entriesPerPage);
    const startIndex = (currentPage - 1) * entriesPerPage;
    const endIndex = Math.min(startIndex + entriesPerPage, totalRecords);
    const recordsToShow = allMilkRecords.slice(startIndex, endIndex);
    
    // Update records info
    recordsInfo.textContent = `Showing entries ${startIndex + 1}-${endIndex} of ${totalRecords}`;
    
    // Update table
    tbody.innerHTML = recordsToShow.map(record => {
        const date = new Date(record.date);
        const formattedDate = date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        return `
            <tr>
                <td>${formattedDate}</td>
                <td>${parseFloat(record.morning_liters).toFixed(1)}</td>
                <td>${parseFloat(record.evening_liters).toFixed(1)}</td>
                <td class="highlight">${parseFloat(record.milk_liters).toFixed(1)}</td>
                <td>₹${parseFloat(record.rate).toFixed(2)}</td>
                <td class="income">₹${parseFloat(record.income).toFixed(0)}</td>
            </tr>
        `;
    }).join('');
    
    // Update pagination
    updatePagination(currentPage, totalPages);
}

// ===========================
// PAGINATION
// ===========================
function updatePagination(page, totalPages) {
    const container = document.getElementById('milkPagination');
    
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }
    
    let html = '<div class="pagination-wrapper">';
    
    // Previous button
    html += `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} 
             onclick="changePage(${page - 1})">
             <span class="material-symbols-outlined">chevron_left</span>
             </button>`;
    
    // Page numbers
    html += '<div class="pagination-numbers">';
    
    let pages = [];
    if (totalPages <= 7) {
        pages = Array.from({length: totalPages}, (_, i) => i + 1);
    } else {
        if (page <= 3) {
            pages = [1, 2, 3, 4, '...', totalPages];
        } else if (page >= totalPages - 2) {
            pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
            pages = [1, '...', page - 1, page, page + 1, '...', totalPages];
        }
    }
    
    for (let p of pages) {
        if (p === '...') {
            html += '<span class="pagination-ellipsis">...</span>';
        } else {
            html += `<button class="pagination-number ${p === page ? 'active' : ''}" 
                     onclick="changePage(${p})">${p}</button>`;
        }
    }
    
    html += '</div>';
    
    // Next button
    html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} 
             onclick="changePage(${page + 1})">
             <span class="material-symbols-outlined">chevron_right</span>
             </button>`;
    
    html += '</div>';
    
    container.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    displayMilkRecords();
    
    // Scroll to table
    document.querySelector('.table-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ===========================
// UPDATE CATTLE
// ===========================
function updateCattle() {
    const form = document.getElementById('editCattleForm');
    const formData = new FormData(form);
    
    const data = {
        name: formData.get('name'),
        tag_no: formData.get('tag_no'),
        breed: formData.get('breed'),
        age: parseInt(formData.get('age')),
        gender: formData.get('gender'),
        health: formData.get('health')
    };
    
    fetch(`/cattle/${CATTLE_ID}/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Cattle updated successfully', 'success');
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('editCattleModal'));
            modal.hide();
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(result.error || 'Failed to update cattle', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

// ===========================
// ADD RECORDS
// ===========================
function submitRecord() {
    const activeForm = document.querySelector('.record-form.active');
    const formId = activeForm.id;
    
    if (formId === 'addMilkForm') {
        submitMilkRecord();
    } else {
        submitHealthRecord();
    }
}

function submitMilkRecord() {
    const form = document.getElementById('addMilkForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    
    const data = {
        date: formData.get('date'),
        morning_liters: parseFloat(formData.get('morning_liters')),
        evening_liters: parseFloat(formData.get('evening_liters')),
        rate: parseFloat(formData.get('rate'))
    };
    
    fetch(`/cattle/${CATTLE_ID}/add-milk`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Milk record added successfully', 'success');
            
            form.reset();
            setDefaultDates();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRecordModal'));
            modal.hide();
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(result.error || 'Failed to add milk record', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

function submitHealthRecord() {
    const form = document.getElementById('addHealthForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    
    const data = {
        issue: formData.get('issue'),
        treatment: formData.get('treatment'),
        vet_name: formData.get('vet_name'),
        next_checkup: formData.get('next_checkup') || null
    };
    
    fetch(`/cattle/${CATTLE_ID}/add-health`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Health record added successfully', 'success');
            
            form.reset();
            
            const modal = bootstrap.Modal.getInstance(document.getElementById('addRecordModal'));
            modal.hide();
            
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            showNotification(result.error || 'Failed to add health record', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

// ===========================
// GENERATE REPORT
// ===========================
function generateReport() {
    const form = document.getElementById('reportForm');
    
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    const formData = new FormData(form);
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    
    if (new Date(startDate) > new Date(endDate)) {
        showNotification('Start date must be before end date', 'error');
        return;
    }
    
    showNotification('Generating report...', 'info');
    
    // Open PDF in new window
    window.open(`/cattle/${CATTLE_ID}/generate-pdf?start_date=${startDate}&end_date=${endDate}`, '_blank');
    
    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
    modal.hide();
    
    setTimeout(() => {
        showNotification('Report generated successfully', 'success');
    }, 1000);
}

// ===========================
// NOTIFICATIONS
// ===========================
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="material-symbols-outlined">
            ${type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info'}
        </span>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 3000);
}