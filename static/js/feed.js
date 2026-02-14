// ════════════════════════════════════════════════════════════════
// CATTLE-CLOUD — feed.js
// Handles: Metrics, Charts, Feed History, Pagination, Reports
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES & CONFIGURATION
// ════════════════════════════════════════════════════════════════
let feedUsageChart = null;
let feedTypeDonutChart = null;
let currentPage = 1;
const perPage = 10;
let currentFeedTypeFilter = 'all';
let currentCattleFilter = 'all';
let currentDateRange = {
    from: null,
    to: null
};
let feedStockList = [];
let cattleList = [];

// Chart colors
const COLORS = {
    primary: '#667aea',
    pieColors: [
        '#10b981', '#667aea', '#f59e0b', '#ef4444',
        '#8b5cf6', '#ec4899', '#14b8a6', '#06b6d4',
        '#84cc16', '#a855f7', '#f97316', '#764ba2'
    ]
};

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
    initializeDateInputs();
    loadDropdownData();
    loadAllData();
    setupEventListeners();
});

function initializeDateInputs() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    const fromDate = formatDate(firstDay);
    const toDate = formatDate(today);
    
    currentDateRange.from = fromDate;
    currentDateRange.to = toDate;
    
    const rangeFrom = document.getElementById('rangeFrom');
    const rangeTo = document.getElementById('rangeTo');
    const reportFrom = document.getElementById('reportFrom');
    const reportTo = document.getElementById('reportTo');
    const feedDate = document.getElementById('feedDate');
    
    if (rangeFrom) rangeFrom.value = fromDate;
    if (rangeTo) rangeTo.value = toDate;
    if (reportFrom) reportFrom.value = fromDate;
    if (reportTo) reportTo.value = toDate;
    if (feedDate) feedDate.value = formatDate(today);
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr) {
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-IN', options);
}

// ════════════════════════════════════════════════════════════════
// LOAD DROPDOWN DATA
// ════════════════════════════════════════════════════════════════
async function loadDropdownData() {
    try {
        // Load feed stock list
        const feedResponse = await fetch('/api/feed/stock-list');
        if (feedResponse.ok) {
            const feedData = await feedResponse.json();
            feedStockList = feedData.stock_list;
            populateFeedDropdowns();
        }
        
        // Load cattle list
        const cattleResponse = await fetch('/api/feed/cattle-list');
        if (cattleResponse.ok) {
            const cattleData = await cattleResponse.json();
            cattleList = cattleData.cattle_list;
            populateCattleDropdowns();
        }
    } catch (error) {
        console.error('Error loading dropdown data:', error);
    }
}

function populateFeedDropdowns() {
    // Populate feed type dropdown in modal
    const feedTypeSelect = document.getElementById('feedType');
    if (feedTypeSelect) {
        feedTypeSelect.innerHTML = '<option value="">Select feed type</option>';
        feedStockList.forEach(feed => {
            const option = document.createElement('option');
            option.value = feed.id;
            option.textContent = `${feed.name} (${feed.quantity} kg available)`;
            option.dataset.quantity = feed.quantity;
            option.dataset.cost = feed.cost_per_kg;
            feedTypeSelect.appendChild(option);
        });
    }
    
    // Populate filter dropdown
    const filterFeedType = document.getElementById('filterFeedType');
    if (filterFeedType) {
        filterFeedType.innerHTML = '<option value="all">All Feed Types</option>';
        const uniqueFeeds = [...new Set(feedStockList.map(f => f.name))];
        uniqueFeeds.forEach(feedName => {
            const option = document.createElement('option');
            option.value = feedName;
            option.textContent = feedName;
            filterFeedType.appendChild(option);
        });
    }
}

function populateCattleDropdowns() {
    // Populate cattle dropdown in modal
    const feedCattleSelect = document.getElementById('feedCattle');
    if (feedCattleSelect) {
        feedCattleSelect.innerHTML = '<option value="">General Stock</option>';
        cattleList.forEach(cattle => {
            const option = document.createElement('option');
            option.value = cattle.id;
            option.textContent = cattle.name + (cattle.tag_no ? ` (${cattle.tag_no})` : '');
            feedCattleSelect.appendChild(option);
        });
    }
    
    // Populate filter dropdown
    const filterCattle = document.getElementById('filterCattle');
    if (filterCattle) {
        filterCattle.innerHTML = '<option value="all">All Cattle</option>';
        cattleList.forEach(cattle => {
            const option = document.createElement('option');
            option.value = cattle.name;
            option.textContent = cattle.name;
            filterCattle.appendChild(option);
        });
    }
}

// ════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════════════
function setupEventListeners() {
    // Date range apply button
    const applyRangeBtn = document.getElementById('applyRangeBtn');
    if (applyRangeBtn) {
        applyRangeBtn.addEventListener('click', function() {
            const from = document.getElementById('rangeFrom').value;
            const to = document.getElementById('rangeTo').value;
            
            if (!from || !to) {
                showNotification('Please select both dates', 'error');
                return;
            }
            
            if (new Date(from) > new Date(to)) {
                showNotification('From date cannot be after To date', 'error');
                return;
            }
            
            currentDateRange.from = from;
            currentDateRange.to = to;
            currentPage = 1;
            loadAllData();
        });
    }
    
    // Feed type filter
    const filterFeedType = document.getElementById('filterFeedType');
    if (filterFeedType) {
        filterFeedType.addEventListener('change', function() {
            currentFeedTypeFilter = this.value;
            currentPage = 1;
            loadFeedHistory();
        });
    }
    
    // Cattle filter
    const filterCattle = document.getElementById('filterCattle');
    if (filterCattle) {
        filterCattle.addEventListener('change', function() {
            currentCattleFilter = this.value;
            currentPage = 1;
            loadFeedHistory();
        });
    }
    
    // Feed type selector - update stock info and cost
    const feedTypeSelect = document.getElementById('feedType');
    if (feedTypeSelect) {
        feedTypeSelect.addEventListener('change', updateStockAndCost);
    }
    
    // Quantity input - update cost
    const feedQuantityInput = document.getElementById('feedQuantity');
    if (feedQuantityInput) {
        feedQuantityInput.addEventListener('input', updateStockAndCost);
    }
    
    // Add feed modal
    const addFeedBtn = document.getElementById('addFeedBtn');
    const addFeedModal = document.getElementById('addFeedModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const feedForm = document.getElementById('feedForm');
    
    if (addFeedBtn && addFeedModal) {
        addFeedBtn.addEventListener('click', () => {
            addFeedModal.classList.add('show');
            document.getElementById('feedDate').value = formatDate(new Date());
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            addFeedModal.classList.remove('show');
            feedForm.reset();
            resetFeedForm();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            addFeedModal.classList.remove('show');
            feedForm.reset();
            resetFeedForm();
        });
    }
    
    if (addFeedModal) {
        addFeedModal.querySelector('.modal-overlay').addEventListener('click', () => {
            addFeedModal.classList.remove('show');
            feedForm.reset();
            resetFeedForm();
        });
    }
    
    if (feedForm) {
        feedForm.addEventListener('submit', handleAddFeed);
    }
    
    // Generate report modal
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportModal = document.getElementById('reportModal');
    const closeReportModal = document.getElementById('closeReportModal');
    const cancelReportBtn = document.getElementById('cancelReportBtn');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    
    if (generateReportBtn && reportModal) {
        generateReportBtn.addEventListener('click', () => {
            reportModal.classList.add('show');
            document.getElementById('reportFrom').value = currentDateRange.from;
            document.getElementById('reportTo').value = currentDateRange.to;
        });
    }
    
    if (closeReportModal) {
        closeReportModal.addEventListener('click', () => {
            reportModal.classList.remove('show');
        });
    }
    
    if (cancelReportBtn) {
        cancelReportBtn.addEventListener('click', () => {
            reportModal.classList.remove('show');
        });
    }
    
    if (reportModal) {
        reportModal.querySelector('.modal-overlay').addEventListener('click', () => {
            reportModal.classList.remove('show');
        });
    }
    
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', handleGenerateReport);
    }
    
    // Add feed stock modal
    const addFeedStockBtn = document.getElementById('addFeedStockBtn');
    const addFeedStockModal = document.getElementById('addFeedStockModal');
    const closeStockModal = document.getElementById('closeStockModal');
    const cancelStockBtn = document.getElementById('cancelStockBtn');
    const feedStockForm = document.getElementById('feedStockForm');
    
    if (addFeedStockBtn && addFeedStockModal) {
        addFeedStockBtn.addEventListener('click', () => {
            addFeedStockModal.classList.add('show');
        });
    }
    
    if (closeStockModal) {
        closeStockModal.addEventListener('click', () => {
            addFeedStockModal.classList.remove('show');
            feedStockForm.reset();
            resetStockForm();
        });
    }
    
    if (cancelStockBtn) {
        cancelStockBtn.addEventListener('click', () => {
            addFeedStockModal.classList.remove('show');
            feedStockForm.reset();
            resetStockForm();
        });
    }
    
    if (addFeedStockModal) {
        addFeedStockModal.querySelector('.modal-overlay').addEventListener('click', () => {
            addFeedStockModal.classList.remove('show');
            feedStockForm.reset();
            resetStockForm();
        });
    }
    
    if (feedStockForm) {
        feedStockForm.addEventListener('submit', handleAddFeedStock);
    }
    
    // Update total stock cost when quantity or cost changes
    const stockQuantityInput = document.getElementById('stockQuantity');
    const stockCostInput = document.getElementById('stockCostPerKg');
    
    if (stockQuantityInput && stockCostInput) {
        stockQuantityInput.addEventListener('input', updateTotalStockCost);
        stockCostInput.addEventListener('input', updateTotalStockCost);
    }
}

function updateStockAndCost() {
    const feedTypeSelect = document.getElementById('feedType');
    const quantityInput = document.getElementById('feedQuantity');
    const stockHint = document.getElementById('stockHint');
    const estimatedCost = document.getElementById('estimatedCost');
    
    const selectedOption = feedTypeSelect.options[feedTypeSelect.selectedIndex];
    const availableStock = selectedOption.dataset.quantity || 0;
    const costPerKg = selectedOption.dataset.cost || 0;
    const quantity = parseFloat(quantityInput.value) || 0;
    
    if (feedTypeSelect.value) {
        stockHint.textContent = `Available: ${availableStock} kg`;
        const totalCost = quantity * parseFloat(costPerKg);
        estimatedCost.textContent = `₹${formatNumber(totalCost)}`;
    } else {
        stockHint.textContent = 'Available: -- kg';
        estimatedCost.textContent = '₹0.00';
    }
}

function resetFeedForm() {
    document.getElementById('stockHint').textContent = 'Available: -- kg';
    document.getElementById('estimatedCost').textContent = '₹0.00';
}

function resetStockForm() {
    document.getElementById('totalStockCost').textContent = '₹0.00';
}

function updateTotalStockCost() {
    const quantity = parseFloat(document.getElementById('stockQuantity').value) || 0;
    const costPerKg = parseFloat(document.getElementById('stockCostPerKg').value) || 0;
    const totalCost = quantity * costPerKg;
    
    document.getElementById('totalStockCost').textContent = `₹${formatNumber(totalCost)}`;
}

// ════════════════════════════════════════════════════════════════
// DATA LOADING FUNCTIONS
// ════════════════════════════════════════════════════════════════
function loadAllData() {
    loadMetrics();
    loadUsageTimeline();
    loadTypeDistribution();
    loadFeedHistory();
}

async function loadMetrics() {
    try {
        const url = `/api/feed/metrics?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        document.getElementById('totalFeedUsed').textContent = `${formatNumber(data.total_feed_used)} kg`;
        document.getElementById('totalFeedCost').textContent = `₹${formatNumber(data.total_feed_cost)}`;
        document.getElementById('avgPerCattle').textContent = `${formatNumber(data.avg_per_cattle)} kg`;
        document.getElementById('lowStockAlerts').textContent = data.low_stock_alerts;
        
    } catch (error) {
        console.error('Error loading metrics:', error);
        showNotification('Failed to load feed metrics', 'error');
    }
}

async function loadUsageTimeline() {
    try {
        const url = `/api/feed/usage-timeline?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const periodLabel = document.getElementById('timelinePeriodLabel');
        if (periodLabel) {
            const fromDate = formatDateDisplay(data.date_range.from);
            const toDate = formatDateDisplay(data.date_range.to);
            periodLabel.textContent = `${fromDate} - ${toDate}`;
        }
        
        renderFeedUsageChart(data.timeline);
        
    } catch (error) {
        console.error('Error loading usage timeline:', error);
        showNotification('Failed to load usage timeline', 'error');
    }
}

async function loadTypeDistribution() {
    try {
        const url = `/api/feed/type-distribution?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const periodLabel = document.getElementById('piePeriodLabel');
        if (periodLabel) {
            const fromDate = formatDateDisplay(data.date_range.from);
            const toDate = formatDateDisplay(data.date_range.to);
            periodLabel.textContent = `${fromDate} - ${toDate}`;
        }
        
        renderFeedTypeDonut(data.distribution);
        
    } catch (error) {
        console.error('Error loading type distribution:', error);
        showNotification('Failed to load feed type distribution', 'error');
    }
}

async function loadFeedHistory() {
    try {
        const url = `/api/feed/history?page=${currentPage}&per_page=${perPage}&feed_type=${currentFeedTypeFilter}&cattle=${currentCattleFilter}&from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        renderFeedHistoryTable(data.history);
        renderPagination(data.pagination);
        
    } catch (error) {
        console.error('Error loading feed history:', error);
        showNotification('Failed to load feed history', 'error');
        document.getElementById('feedTableBody').innerHTML = 
            '<tr><td colspan="5" class="no-data">Failed to load feed history</td></tr>';
    }
}

// ════════════════════════════════════════════════════════════════
// CHART RENDERING
// ════════════════════════════════════════════════════════════════
function renderFeedUsageChart(timelineData) {
    const ctx = document.getElementById('feedUsageChart');
    if (!ctx) return;
    
    if (feedUsageChart) {
        feedUsageChart.destroy();
    }
    
    const labels = timelineData.map(item => formatDateDisplay(item.date));
    const quantities = timelineData.map(item => item.quantity);
    
    feedUsageChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Feed Usage (kg)',
                data: quantities,
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderColor: COLORS.primary,
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: COLORS.primary,
                pointBorderColor: '#fff',
                pointBorderWidth: 2
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
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return 'Feed Used: ' + formatNumber(context.parsed.y) + ' kg';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    },
                    ticks: {
                        callback: function(value) {
                            return value + ' kg';
                        }
                    }
                }
            }
        }
    });
}

function renderFeedTypeDonut(distributionData) {
    const ctx = document.getElementById('feedTypeDonut');
    if (!ctx) return;
    
    if (feedTypeDonutChart) {
        feedTypeDonutChart.destroy();
    }
    
    if (!distributionData || distributionData.length === 0) {
        const container = ctx.closest('.chart-container');
        if (container) {
            container.innerHTML = '<p class="no-data" style="text-align: center; padding: 2rem;">No feed usage data available for this period</p>';
        }
        return;
    }
    
    const labels = distributionData.map(item => item.label);
    const values = distributionData.map(item => item.value);
    const colors = COLORS.pieColors.slice(0, distributionData.length);
    
    feedTypeDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: '65%',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(17, 24, 39, 0.95)',
                    padding: 12,
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return context.label + ': ' + formatNumber(context.parsed) + ' kg (' + percentage + '%)';
                        }
                    }
                }
            }
        }
    });
    
    renderDonutLegend(distributionData, colors);
}

function renderDonutLegend(distributionData, colors) {
    const legendContainer = document.getElementById('donutLegend');
    if (!legendContainer) return;
    
    const total = distributionData.reduce((sum, item) => sum + item.value, 0);
    
    legendContainer.innerHTML = distributionData.map((item, index) => {
        const percentage = ((item.value / total) * 100).toFixed(1);
        return `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${colors[index]}"></span>
                <span class="legend-label">${item.label}</span>
                <span class="legend-value">${percentage}%</span>
            </div>
        `;
    }).join('');
}

// ════════════════════════════════════════════════════════════════
// FEED HISTORY TABLE
// ════════════════════════════════════════════════════════════════
function renderFeedHistoryTable(history) {
    const tbody = document.getElementById('feedTableBody');
    if (!tbody) return;
    
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No feed history found for this period</td></tr>';
        return;
    }
    
    tbody.innerHTML = history.map(record => `
        <tr>
            <td>${formatDateDisplay(record.date)}</td>
            <td>${record.cattle_name}</td>
            <td><span class="category-badge">${record.feed_type}</span></td>
            <td>${formatNumber(record.quantity)} kg</td>
            <td>₹${formatNumber(record.cost)}</td>
        </tr>
    `).join('');
}

function renderPagination(pagination) {
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    
    if (!paginationInfo || !paginationControls) return;
    
    const start = (pagination.page - 1) * pagination.per_page + 1;
    const end = Math.min(pagination.page * pagination.per_page, pagination.total);
    paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} records`;
    
    let controlsHTML = '';
    
    controlsHTML += `
        <button class="page-btn" ${pagination.page === 1 ? 'disabled' : ''} onclick="goToPage(${pagination.page - 1})">
            <span class="material-symbols-outlined">chevron_left</span>
        </button>
    `;
    
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.total_pages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }
    
    if (startPage > 1) {
        controlsHTML += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            controlsHTML += `<span style="padding: 0 0.5rem;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === pagination.page ? 'active' : '';
        controlsHTML += `<button class="page-btn ${activeClass}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    if (endPage < pagination.total_pages) {
        if (endPage < pagination.total_pages - 1) {
            controlsHTML += `<span style="padding: 0 0.5rem;">...</span>`;
        }
        controlsHTML += `<button class="page-btn" onclick="goToPage(${pagination.total_pages})">${pagination.total_pages}</button>`;
    }
    
    controlsHTML += `
        <button class="page-btn" ${pagination.page === pagination.total_pages ? 'disabled' : ''} onclick="goToPage(${pagination.page + 1})">
            <span class="material-symbols-outlined">chevron_right</span>
        </button>
    `;
    
    paginationControls.innerHTML = controlsHTML;
}

function goToPage(page) {
    currentPage = page;
    loadFeedHistory();
}

// ════════════════════════════════════════════════════════════════
// ADD FEED ENTRY
// ════════════════════════════════════════════════════════════════
async function handleAddFeed(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;
    
    try {
        const formData = {
            date: document.getElementById('feedDate').value,
            cattle_id: document.getElementById('feedCattle').value || null,
            feed_id: document.getElementById('feedType').value,
            quantity: parseFloat(document.getElementById('feedQuantity').value)
        };
        
        const response = await fetch('/api/feed/add-entry', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add feed entry');
        }
        
        showNotification('Feed entry added successfully', 'success');
        
        document.getElementById('addFeedModal').classList.remove('show');
        e.target.reset();
        resetFeedForm();
        
        // Reload data
        await loadDropdownData();
        loadAllData();
        
    } catch (error) {
        console.error('Error adding feed entry:', error);
        showNotification(error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════
// ADD FEED STOCK
// ════════════════════════════════════════════════════════════════
async function handleAddFeedStock(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;
    
    try {
        const formData = {
            feed_name: document.getElementById('stockFeedName').value,
            quantity: parseFloat(document.getElementById('stockQuantity').value),
            min_quantity: parseFloat(document.getElementById('stockMinQuantity').value),
            cost_per_kg: parseFloat(document.getElementById('stockCostPerKg').value)
        };
        
        const response = await fetch('/api/feed/add-stock', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add feed stock');
        }
        
        showNotification('Feed stock added successfully', 'success');
        
        document.getElementById('addFeedStockModal').classList.remove('show');
        e.target.reset();
        resetStockForm();
        
        // Reload data
        await loadDropdownData();
        loadAllData();
        
    } catch (error) {
        console.error('Error adding feed stock:', error);
        showNotification(error.message, 'error');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════
// GENERATE PDF REPORT
// ════════════════════════════════════════════════════════════════
async function handleGenerateReport() {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    const originalHTML = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Generating...';
    downloadBtn.disabled = true;
    
    try {
        const fromDate = document.getElementById('reportFrom').value;
        const toDate = document.getElementById('reportTo').value;
        
        if (!fromDate || !toDate) {
            throw new Error('Please select both dates');
        }
        
        if (new Date(fromDate) > new Date(toDate)) {
            throw new Error('From date cannot be after To date');
        }
        
        const url = `/api/feed/report-data?from_date=${fromDate}&to_date=${toDate}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch report data');
        }
        
        const data = await response.json();
        
        generatePDF(data);
        
        document.getElementById('reportModal').classList.remove('show');
        
        showNotification('Report generated successfully', 'success');
        
    } catch (error) {
        console.error('Error generating report:', error);
        showNotification(error.message, 'error');
    } finally {
        downloadBtn.innerHTML = originalHTML;
        downloadBtn.disabled = false;
    }
}

function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    // Title
    doc.setFontSize(20);
    doc.setTextColor(102, 126, 234);
    doc.text('Cattle-Cloud Feed Management Report', 14, 22);
    
    // Date range
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${formatDateDisplay(data.date_range.from)} - ${formatDateDisplay(data.date_range.to)}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 36);
    
    // Summary section
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('Summary', 14, 48);
    
    doc.setFontSize(10);
    doc.setTextColor(16, 185, 129);
    doc.text(`Total Feed Used: ${formatNumber(data.summary.total_quantity)} kg`, 14, 56);
    doc.setTextColor(239, 68, 68);
    doc.text(`Total Cost: ₹${formatNumber(data.summary.total_cost)}`, 14, 63);
    doc.setTextColor(107, 114, 128);
    doc.text(`Total Records: ${data.summary.record_count}`, 14, 70);
    
    // Feed type breakdown
    if (data.breakdown && data.breakdown.length > 0) {
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text('Feed Type Breakdown', 14, 82);
        
        const breakdownRows = data.breakdown.map(item => [
            item.feed_name,
            formatNumber(item.quantity) + ' kg',
            '₹' + formatNumber(item.cost)
        ]);
        
        doc.autoTable({
            startY: 88,
            head: [['Feed Type', 'Quantity', 'Cost']],
            body: breakdownRows,
            theme: 'grid',
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: 50
            }
        });
    }
    
    // Feed history
    if (data.history && data.history.length > 0) {
        const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 100;
        
        doc.setFontSize(12);
        doc.setTextColor(31, 41, 55);
        doc.text('Detailed Feed History', 14, finalY);
        
        const historyRows = data.history.map(record => [
            formatDateDisplay(record.date),
            record.cattle_name,
            record.feed_type,
            formatNumber(record.quantity) + ' kg',
            '₹' + formatNumber(record.cost)
        ]);
        
        doc.autoTable({
            startY: finalY + 6,
            head: [['Date', 'Cattle', 'Feed Type', 'Quantity', 'Cost']],
            body: historyRows,
            theme: 'grid',
            headStyles: {
                fillColor: [102, 126, 234],
                textColor: 255,
                fontSize: 9,
                fontStyle: 'bold'
            },
            bodyStyles: {
                fontSize: 8,
                textColor: 50
            },
            alternateRowStyles: {
                fillColor: [249, 250, 251]
            }
        });
    }
    
    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(
            `Page ${i} of ${pageCount}`,
            doc.internal.pageSize.width / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
        );
    }
    
    const fileName = `cattle-cloud-feed-report-${data.date_range.from}-to-${data.date_range.to}.pdf`;
    doc.save(fileName);
}

// ════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ════════════════════════════════════════════════════════════════
function formatNumber(num) {
    return new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#667aea'};
        color: white;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
        z-index: 9999;
        font-weight: 500;
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
`;
document.head.appendChild(style);