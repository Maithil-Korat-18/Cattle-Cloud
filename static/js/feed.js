let currentUsagePage = 1;

document.addEventListener('DOMContentLoaded', function() {
    loadInventory();
    loadSummary();
    loadUsageTimeline();
});

function loadInventory() {
    fetch('/feed/inventory')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderStockTable(data.inventory);
            }
        })
        .catch(error => console.error('Error loading inventory:', error));
}

function loadSummary() {
    fetch('/feed/inventory')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderSummaryCards(data.inventory);
            }
        })
        .catch(error => console.error('Error loading summary:', error));
    
    fetch('/feed/stock-value')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                updateInventoryValue(data.value_data);
            }
        })
        .catch(error => console.error('Error loading stock value:', error));
}

function renderSummaryCards(inventory) {
    const grid = document.getElementById('summaryGrid');
    
    let fodderItem = inventory.find(item => item.feed_name.toLowerCase().includes('fodder'));
    let wheatItem = inventory.find(item => item.feed_name.toLowerCase().includes('wheat') || item.feed_name.toLowerCase().includes('whaet'));
    
    let fodderPercent = fodderItem ? Math.min(fodderItem.stock_percentage, 100) : 0;
    let wheatPercent = wheatItem ? Math.min(wheatItem.stock_percentage, 100) : 0;
    
    let fodderStatus = fodderPercent >= 50 ? 'healthy' : 'low';
    let wheatStatus = wheatPercent >= 50 ? 'healthy' : 'low';
    
    grid.innerHTML = `
        <div class="summary-card">
            <div class="card-content">
                <p class="card-label">Fodder Level</p>
                <h3 class="card-value">${Math.round(fodderPercent)}%</h3>
                <div class="card-badge ${fodderStatus}">
                    <span class="material-symbols-outlined">${fodderStatus === 'healthy' ? 'trending_up' : 'warning'}</span>
                    <span>${fodderStatus === 'healthy' ? 'Healthy' : 'Low Stock'}</span>
                </div>
            </div>
            <div class="progress-circle">
                <svg viewBox="0 0 36 36">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3"/>
                    <path class="circle-progress ${fodderStatus}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-dasharray="${fodderPercent}, 100" stroke-linecap="round" stroke-width="3"/>
                </svg>
            </div>
        </div>
        
        <div class="summary-card">
            <div class="card-content">
                <p class="card-label">Wheat Level</p>
                <h3 class="card-value">${Math.round(wheatPercent)}%</h3>
                <div class="card-badge ${wheatStatus}">
                    <span class="material-symbols-outlined">${wheatStatus === 'healthy' ? 'trending_up' : 'warning'}</span>
                    <span>${wheatStatus === 'healthy' ? 'Healthy' : 'Low Stock'}</span>
                </div>
            </div>
            <div class="progress-circle">
                <svg viewBox="0 0 36 36">
                    <path class="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-width="3"/>
                    <path class="circle-progress ${wheatStatus}" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke-dasharray="${wheatPercent}, 100" stroke-linecap="round" stroke-width="3"/>
                </svg>
            </div>
        </div>
        
        <div class="summary-card value-card">
            <div class="icon-badge">
                <span class="material-symbols-outlined">payments</span>
            </div>
            <div class="card-content">
                <p class="card-label">Inventory Value</p>
                <h3 class="card-value" id="totalValue">$0</h3>
            </div>
        </div>
        
        <div class="summary-card value-card">
            <div class="icon-badge violet">
                <span class="material-symbols-outlined">local_shipping</span>
            </div>
            <div class="card-content">
                <p class="card-label">Next Delivery</p>
                <h3 class="card-value">Tomorrow</h3>
            </div>
        </div>
    `;
}

function updateInventoryValue(valueData) {
    document.getElementById('totalValue').textContent = '$' + valueData.total_value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0});
}

function renderStockTable(inventory) {
    const tbody = document.getElementById('stockTableBody');
    const tableInfo = document.getElementById('tableInfo');
    
    if (inventory.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No stock items found</td></tr>';
        tableInfo.textContent = 'Showing 0 items';
        return;
    }
    
    const categories = {
        'fodder': 'Forage',
        'wheat': 'Grain',
        'whaet': 'Grain',
        'grain': 'Grain',
        'silage': 'Silage',
        'soybean': 'Protein Mix',
        'mineral': 'Supplements'
    };
    
    tbody.innerHTML = inventory.map(item => {
        let category = 'Feed';
        for (let key in categories) {
            if (item.feed_name.toLowerCase().includes(key)) {
                category = categories[key];
                break;
            }
        }
        
        const statusClass = item.is_low ? 'low' : 'healthy';
        const statusText = item.is_low ? 'Low Stock' : 'Healthy';
        const qtyClass = item.is_low ? 'text-warning fw-bold' : '';
        
        return `
            <tr>
                <td class="fw-semibold">${item.feed_name}</td>
                <td class="text-muted">${category}</td>
                <td class="${qtyClass}">${item.quantity.toFixed(1)} kg</td>
                <td class="text-muted">${item.min_quantity.toFixed(1)} kg</td>
                <td>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </td>
            </tr>
        `;
    }).join('');
    
    tableInfo.textContent = `Showing ${inventory.length} items`;
}

function loadUsageTimeline() {
    fetch('/feed/usage?per_page=4')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderUsageTimeline(data.usage);
            }
        })
        .catch(error => console.error('Error loading usage:', error));
}

function renderUsageTimeline(usage) {
    const timeline = document.getElementById('usageTimeline');
    
    if (usage.length === 0) {
        timeline.innerHTML = '<p class="text-center text-muted py-4">No recent activity</p>';
        return;
    }
    
    timeline.innerHTML = `
        <ul class="timeline">
            ${usage.map((item, index) => {
                const colorClass = index % 2 === 0 ? 'primary' : 'violet';
                const cattleInfo = item.cattle_name || item.tag_no || 'Unknown';
                
                let timeAgo = 'Recently';
                if (item.usage_date_str) {
                    const date = new Date(item.usage_date_str);
                    const now = new Date();
                    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) {
                        timeAgo = item.usage_time || 'Today';
                    } else if (diffDays === 1) {
                        timeAgo = 'Yesterday';
                    } else {
                        timeAgo = `${diffDays} days ago`;
                    }
                }
                
                return `
                    <li class="timeline-item">
                        <div class="timeline-dot ${colorClass}">
                            <div class="dot-inner"></div>
                        </div>
                        <div class="timeline-content">
                            <p class="timeline-title">${item.quantity_used}kg ${item.feed_name || 'Feed'} Used</p>
                            <p class="timeline-subtitle">Allocated to ${cattleInfo}</p>
                            <p class="timeline-time">${timeAgo}</p>
                        </div>
                    </li>
                `;
            }).join('')}
        </ul>
    `;
}

function submitAddStock() {
    const form = document.getElementById('addStockForm');
    const formData = new FormData(form);
    
    const data = {
        feed_name: formData.get('feed_name'),
        quantity: formData.get('quantity'),
        min_quantity: formData.get('min_quantity'),
        cost_per_kg: formData.get('cost_per_kg')
    };
    
    fetch('/feed/add-stock', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(data)
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showNotification('Feed stock added successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addStockModal')).hide();
            form.reset();
            loadInventory();
            loadSummary();
        } else {
            showNotification(result.error || 'Failed to add stock', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showNotification('An error occurred', 'error');
    });
}

document.getElementById('usageModal').addEventListener('show.bs.modal', function() {
    loadUsageTable(1);
});

function loadUsageTable(page) {
    currentUsagePage = page;
    
    fetch(`/feed/usage?page=${page}&per_page=10`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                renderUsageTable(data.usage);
                renderUsagePagination(data.page, data.total_pages);
            }
        })
        .catch(error => console.error('Error loading usage table:', error));
}

function renderUsageTable(usage) {
    const tbody = document.getElementById('usageTableBody');
    
    if (usage.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No usage records found</td></tr>';
        return;
    }
    
    tbody.innerHTML = usage.map(item => {
        return `
            <tr>
                <td>${item.usage_date_str || 'N/A'}</td>
                <td class="fw-semibold">${item.feed_name || 'N/A'}</td>
                <td class="text-muted">${item.cattle_name || item.tag_no || 'N/A'}</td>
                <td>${item.quantity_used} kg</td>
                <td>${item.usage_time || 'N/A'}</td>
            </tr>
        `;
    }).join('');
}

function renderUsagePagination(page, totalPages) {
    const container = document.getElementById('usagePagination');
    
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `
        <button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="loadUsageTable(${page - 1})">
            <span class="material-symbols-outlined">chevron_left</span>
        </button>
    `;
    
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `
            <button class="pagination-btn ${i === page ? 'active' : ''}" onclick="loadUsageTable(${i})">
                ${i}
            </button>
        `;
    }
    
    if (totalPages > 5) {
        html += `<span class="pagination-ellipsis">...</span>`;
        html += `
            <button class="pagination-btn" onclick="loadUsageTable(${totalPages})">
                ${totalPages}
            </button>
        `;
    }
    
    html += `
        <button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="loadUsageTable(${page + 1})">
            <span class="material-symbols-outlined">chevron_right</span>
        </button>
    `;
    
    container.innerHTML = html;
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