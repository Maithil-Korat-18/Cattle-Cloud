let currentPage = 1;
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';
let deleteRecordId = null;

document.addEventListener('DOMContentLoaded', function() {
    loadSummary();
    loadRecords();
    loadCattleList();
    setupEventListeners();
    setDefaultDates();
});

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = e.target.value;
            currentPage = 1;
            loadRecords();
        }, 500);
    });
    
    document.getElementById('confirmDeleteBtn').addEventListener('click', function() {
        if (deleteRecordId) {
            deleteRecord(deleteRecordId);
        }
    });
    
    // Clear filter button
    document.getElementById('clearFilterBtn').addEventListener('click', function() {
        clearDateFilter();
    });
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    
    document.querySelector('#addRecordForm input[name="date"]').value = today;
    
    const reportStartDate = new Date();
    reportStartDate.setDate(reportStartDate.getDate() - 7);
    document.querySelector('#generateReportForm input[name="start_date"]').value = reportStartDate.toISOString().split('T')[0];
    document.querySelector('#generateReportForm input[name="end_date"]').value = today;
}

function loadSummary() {
    fetch('/milk/summary')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('todayTotal').innerHTML = `${data.today_total} <span class="unit">L</span>`;
                document.getElementById('avgPerCow').innerHTML = `${data.avg_per_cow} <span class="unit">L</span>`;
                document.getElementById('morningYield').textContent = `${data.morning_total} L`;
                document.getElementById('eveningYield').textContent = `${data.evening_total} L`;
                
                const changeElement = document.getElementById('todayChange');
                const changePercent = data.change_percent;
                
                if (changePercent >= 0) {
                    changeElement.className = 'card-change positive';
                    changeElement.innerHTML = `
                        <span class="material-symbols-outlined">trending_up</span>
                        <span>+${changePercent.toFixed(1)}% from yesterday</span>
                    `;
                } else {
                    changeElement.className = 'card-change negative';
                    changeElement.innerHTML = `
                        <span class="material-symbols-outlined">trending_down</span>
                        <span>${changePercent.toFixed(1)}% from yesterday</span>
                    `;
                }
            }
        })
        .catch(error => {
            console.error('Error loading summary:', error);
        });
}

function loadRecords() {
    const params = new URLSearchParams({
        page: currentPage,
        per_page: 10,
        search: currentSearch
    });
    
    if (currentStartDate && currentEndDate) {
        params.append('start_date', currentStartDate);
        params.append('end_date', currentEndDate);
    }
    
    fetch(`/milk/data?${params.toString()}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderTable(data.records);
                updatePagination(data.page, data.total_pages, data.total);
            }
        })
        .catch(error => {
            console.error('Error loading records:', error);
            document.getElementById('recordsTableBody').innerHTML = `
                <tr><td colspan="7" class="text-center py-5 text-danger">Error loading records</td></tr>
            `;
        });
}

function renderTable(records) {
    const tbody = document.getElementById('recordsTableBody');
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5">No records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = records.map(record => {
        const date = new Date(record.date);
        const formattedDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        const breedInitials = record.breed ? record.breed.substring(0, 2).toUpperCase() : 'NA';
        const colors = ['indigo', 'violet', 'amber'];
        const colorClass = colors[Math.floor(Math.random() * colors.length)];
        
        return `
            <tr class="table-row">
                <td class="fw-medium">${formattedDate}</td>
                <td>
                    <div class="cattle-cell">
                        <div class="cattle-avatar ${colorClass}">${breedInitials}</div>
                        <span class="cattle-tag">${record.tag_no || 'C-' + record.cattle_id}</span>
                    </div>
                </td>
                <td>${parseFloat(record.morning_liters).toFixed(1)}</td>
                <td>${parseFloat(record.evening_liters).toFixed(1)}</td>
                <td class="fw-bold">${parseFloat(record.milk_liters).toFixed(1)}</td>
                <td>₹ ${parseFloat(record.rate).toFixed(2)}</td>
                <td class="text-end">
                    <div class="action-buttons">
                        <button class="action-btn" onclick="openEditModal(${record.id}, '${record.date}', ${record.morning_liters}, ${record.evening_liters}, ${record.rate})">
                            <span class="material-symbols-outlined">edit</span>
                        </button>
                        <button class="action-btn delete-btn" onclick="openDeleteModal(${record.id})">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function updatePagination(page, totalPages, total) {
    document.getElementById('showingFrom').textContent = total > 0 ? ((page - 1) * 10) + 1 : 0;
    document.getElementById('showingTo').textContent = Math.min(page * 10, total);
    document.getElementById('totalRecords').textContent = total;
    
    const controls = document.getElementById('paginationControls');
    
    if (totalPages === 0) {
        controls.innerHTML = '';
        return;
    }
    
    let html = `
        <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">
            <span class="material-symbols-outlined">chevron_left</span>
        </button>
    `;
    
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `
            <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (totalPages > 5) {
        html += `
            <span class="pagination-ellipsis">...</span>
            <button class="pagination-btn" onclick="changePage(${totalPages})">
                ${totalPages}
            </button>
        `;
    }
    
    html += `
        <button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="changePage(${page + 1})">
            <span class="material-symbols-outlined">chevron_right</span>
        </button>
    `;
    
    controls.innerHTML = html;
}

function changePage(page) {
    currentPage = page;
    loadRecords();
}

function loadCattleList() {
    fetch('/milk/cattle-list')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const addSelect = document.querySelector('#addRecordForm select[name="cattle_id"]');
                const reportSelect = document.querySelector('#generateReportForm select[name="cattle_id"]');
                
                const options = data.cattle.map(c => 
                    `<option value="${c.id}">${c.tag_no || 'C-' + c.id} - ${c.name}</option>`
                ).join('');
                
                addSelect.innerHTML = '<option value="">Select Cattle</option>' + options;
                reportSelect.innerHTML = '<option value="all">All Cattle</option>' + options;
            }
        })
        .catch(error => {
            console.error('Error loading cattle list:', error);
        });
}

function submitAddRecord() {
    const form = document.getElementById('addRecordForm');
    const formData = new FormData(form);
    
    const data = {
        cattle_id: formData.get('cattle_id'),
        date: formData.get('date'),
        morning_liters: formData.get('morning_liters'),
        evening_liters: formData.get('evening_liters'),
        rate: formData.get('rate')
    };
    
    fetch('/milk/add', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Record added successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addRecordModal')).hide();
            form.reset();
            setDefaultDates();
            loadRecords();
            loadSummary();
        } else {
            showNotification(result.error || 'Failed to add record', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

function openEditModal(id, date, morning, evening, rate) {
    const form = document.getElementById('editRecordForm');
    form.querySelector('input[name="record_id"]').value = id;
    form.querySelector('input[name="date"]').value = date;
    form.querySelector('input[name="morning_liters"]').value = morning;
    form.querySelector('input[name="evening_liters"]').value = evening;
    form.querySelector('input[name="rate"]').value = rate;
    
    new bootstrap.Modal(document.getElementById('editRecordModal')).show();
}

function submitEditRecord() {
    const form = document.getElementById('editRecordForm');
    const formData = new FormData(form);
    
    const id = formData.get('record_id');
    const data = {
        date: formData.get('date'),
        morning_liters: formData.get('morning_liters'),
        evening_liters: formData.get('evening_liters'),
        rate: formData.get('rate')
    };
    
    fetch(`/milk/update/${id}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Record updated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editRecordModal')).hide();
            loadRecords();
            loadSummary();
        } else {
            showNotification(result.error || 'Failed to update record', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

function openDeleteModal(id) {
    deleteRecordId = id;
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function deleteRecord(id) {
    fetch(`/milk/delete/${id}`, {
        method: 'DELETE'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Record deleted successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
            loadRecords();
            loadSummary();
            deleteRecordId = null;
        } else {
            showNotification(result.error || 'Failed to delete record', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

function applyDateFilter() {
    const form = document.getElementById('dateRangeForm');
    const formData = new FormData(form);
    
    currentStartDate = formData.get('start_date');
    currentEndDate = formData.get('end_date');
    currentPage = 1;
    
    if (!currentStartDate || !currentEndDate) {
        showNotification('Please select both start and end dates', 'error');
        return;
    }
    
    const startDate = new Date(currentStartDate);
    const endDate = new Date(currentEndDate);
    
    const dateRangeText = `${startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})} - ${endDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}`;
    
    document.getElementById('dateRangeText').textContent = dateRangeText;
    document.getElementById('clearFilterBtn').style.display = 'inline-flex';
    
    bootstrap.Modal.getInstance(document.getElementById('dateRangeModal')).hide();
    loadRecords();
}

function clearDateFilter() {
    currentStartDate = '';
    currentEndDate = '';
    currentPage = 1;
    
    document.getElementById('dateRangeText').textContent = 'Select date range';
    document.getElementById('clearFilterBtn').style.display = 'none';
    
    // Clear the date inputs
    document.querySelector('#dateRangeForm input[name="start_date"]').value = '';
    document.querySelector('#dateRangeForm input[name="end_date"]').value = '';
    
    loadRecords();
}

function submitGenerateReport() {
    const form = document.getElementById('generateReportForm');
    const formData = new FormData(form);
    
    const startDate = formData.get('start_date');
    const endDate = formData.get('end_date');
    
    if (!startDate || !endDate) {
        showNotification('Please select both start and end dates', 'error');
        return;
    }
    
    const data = {
        start_date: startDate,
        end_date: endDate,
        cattle_id: formData.get('cattle_id'),
        report_type: formData.get('report_type'),
        format: 'pdf'
    };
    
    showNotification('Generating PDF report...', 'info');
    
    fetch('/milk/report', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(err => {
                throw new Error(err.error || 'Failed to generate report');
            });
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `milk_report_${startDate}_to_${endDate}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Report generated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('generateReportModal')).hide();
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification(error.message || 'Failed to generate report', 'error');
    });
}

function exportData() {
    let startDate = currentStartDate;
    let endDate = currentEndDate;
    
    if (!startDate || !endDate) {
        const today = new Date();
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        startDate = lastWeek.toISOString().split('T')[0];
        endDate = today.toISOString().split('T')[0];
    }
    
    const data = {
        start_date: startDate,
        end_date: endDate,
        cattle_id: 'all',
        report_type: 'daily',
        format: 'pdf'
    };
    
    showNotification('Exporting data...', 'info');
    
    fetch('/milk/report', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to export data');
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `milk_export_${startDate}_to_${endDate}.pdf`;
        
        document.body.appendChild(a);
        a.click();
        
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showNotification('Data exported successfully', 'success');
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('Failed to export data', 'error');
    });
}

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
    
    setTimeout(() => notification.classList.add('show'), 10);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}