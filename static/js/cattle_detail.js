// ===========================
// CATTLE DETAIL — MAIN JS
// ===========================

let milkChart = null;
let scatterChart = null;
let currentPage = 1;
let feedCurrentPage = 1;
let entriesPerPage = 5;
let feedEntriesPerPage = 5;
let allMilkRecords = [];
let allFeedRecords = [];
let feedStockList  = [];        // [{ id, feed_name, quantity, cost_per_kg }]
let currentDays    = 7;
let currentStart   = null;
let currentEnd     = null;

// ===========================
// INIT
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates();
    loadFeedStock();          // load feed dropdown first
    loadBothCharts(7);        // charts + scatter with 7-day default
    loadAllMilkRecords();
    loadAllFeedRecords();
    loadSummary(30);
    setupEventListeners();
});

function setupEventListeners() {
    // Shared chart filter buttons
    document.querySelectorAll('#sharedFilters .filter-btn[data-days]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('#sharedFilters .filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const days = parseInt(this.dataset.days);
            currentDays  = days;
            currentStart = null;
            currentEnd   = null;
            loadBothCharts(days);
        });
    });

    // Summary filter buttons
    document.querySelectorAll('.summary-filter').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.summary-filter').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadSummary(parseInt(this.dataset.days));
        });
    });

    // Record type tabs
    document.querySelectorAll('.record-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.record-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.record-form').forEach(f => f.classList.remove('active'));
            const map = { milk: 'addMilkForm', health: 'addHealthForm', feed: 'addFeedForm' };
            document.getElementById(map[this.dataset.type])?.classList.add('active');
        });
    });

    // Entries per page — milk
    document.getElementById('entriesPerPage')?.addEventListener('change', function () {
        entriesPerPage = parseInt(this.value);
        currentPage = 1;
        displayMilkRecords();
    });

    // Entries per page — feed
    document.getElementById('feedEntriesPerPage')?.addEventListener('change', function () {
        feedEntriesPerPage = parseInt(this.value);
        feedCurrentPage = 1;
        displayFeedRecords();
    });

    // Feed type select → show stock info
    document.getElementById('feedTypeSelect')?.addEventListener('change', function () {
        updateFeedStockInfo(this.value, 'feedStockInfo');
    });
    document.getElementById('editFeedTypeSelect')?.addEventListener('change', function () {
        updateFeedStockInfo(this.value, null);
    });
}

function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const d30   = offsetDate(-30);

    setVal('addMilkForm input[name="date"]', today);
    setVal('addFeedForm input[name="usage_date"]', today);
    setVal('#reportStartDate', d30);
    setVal('#reportEndDate',   today);
    setVal('#customStartDate', d30);
    setVal('#customEndDate',   today);
}

function offsetDate(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
}

function setVal(selector, val) {
    const el = document.querySelector(selector);
    if (el) el.value = val;
}

// ===========================
// FEED STOCK LOADER
// ===========================
function loadFeedStock() {
    fetch('/feed/stock-list')
        .then(r => r.json())
        .then(data => {
            feedStockList = data.success ? (data.feeds || []) : [];
            populateFeedSelect('feedTypeSelect');
            populateFeedSelect('editFeedTypeSelect');
        })
        .catch(() => {
            feedStockList = [];
        });
}

function populateFeedSelect(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">Select feed type...</option>';
    feedStockList.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.textContent = `${f.feed_name} (${parseFloat(f.quantity).toFixed(1)} kg available)`;
        opt.dataset.qty  = f.quantity;
        opt.dataset.cost = f.cost_per_kg;
        sel.appendChild(opt);
    });
}

function updateFeedStockInfo(feedId, infoElId) {
    if (!infoElId) return;
    const info = document.getElementById(infoElId);
    if (!info) return;
    if (!feedId) { info.textContent = 'Select a feed to see available stock'; info.classList.remove('low-stock'); return; }
    const feed = feedStockList.find(f => String(f.id) === String(feedId));
    if (!feed) return;
    const qty = parseFloat(feed.quantity);
    const min = parseFloat(feed.min_quantity || 0);
    info.innerHTML = `<span class="material-symbols-outlined">inventory_2</span><span>Available: <strong>${qty.toFixed(1)} kg</strong> · Min threshold: ${min.toFixed(1)} kg · ₹${parseFloat(feed.cost_per_kg).toFixed(2)}/kg</span>`;
    info.classList.toggle('low-stock', qty <= min);
}

// ===========================
// LOAD BOTH CHARTS (shared filter)
// ===========================
function loadBothCharts(days, start = null, end = null) {
    let milkUrl, feedUrl;
    if (start && end) {
        milkUrl = `/cattle/${CATTLE_ID}/milk-chart?start_date=${start}&end_date=${end}`;
        feedUrl = `/cattle/${CATTLE_ID}/feed-usage?start_date=${start}&end_date=${end}`;
    } else {
        milkUrl = `/cattle/${CATTLE_ID}/milk-chart?days=${days}`;
        feedUrl = `/cattle/${CATTLE_ID}/feed-usage?days=${days}`;
    }

    Promise.all([
        fetch(milkUrl).then(r => r.json()).catch(() => ({ success: false, data: [] })),
        fetch(feedUrl).then(r => r.json()).catch(() => ({ success: false, data: [] }))
    ]).then(([milkRes, feedRes]) => {
        const milkData = milkRes.success ? milkRes.data : [];
        const feedData = feedRes.success ? feedRes.data : [];

        renderMilkLineChart(milkData);
        renderScatterChart(milkData, feedData);
        updateChartStats(milkData, feedData);
    });
}

// ===========================
// LINE CHART
// ===========================
function renderMilkLineChart(data) {
    const ctx = document.getElementById('milkChart');
    if (!ctx) return;
    const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels   = sorted.map(d => fmtShortDate(d.date));
    const milkVals = sorted.map(d => parseFloat(d.milk_liters) || 0);
    const maxVal   = Math.max(...milkVals, 5);

    if (milkChart) milkChart.destroy();

    milkChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Milk (L)',
                data: milkVals,
                borderColor: '#667eea',
                backgroundColor: (ctx2) => {
                    const c = ctx2.chart;
                    if (!c.chartArea) return 'transparent';
                    const g = c.ctx.createLinearGradient(0, c.chartArea.top, 0, c.chartArea.bottom);
                    g.addColorStop(0, 'rgba(102,126,234,0.28)');
                    g.addColorStop(1, 'rgba(102,126,234,0.02)');
                    return g;
                },
                borderWidth: 2.5, fill: true, tension: 0.4,
                pointBackgroundColor: '#667eea', pointBorderColor: '#fff',
                pointBorderWidth: 2, pointRadius: 5, pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937', padding: 10, cornerRadius: 8,
                    callbacks: { label: c => `${c.parsed.y.toFixed(1)} L` }
                }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', maxRotation: 45 } },
                y: {
                    beginAtZero: true, max: Math.ceil(maxVal * 1.2),
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', callback: v => v + ' L' }
                }
            }
        }
    });
}

// ===========================
// SCATTER CHART
// ===========================
function renderScatterChart(milkData, feedData) {
    const ctx = document.getElementById('scatterChart');
    if (!ctx) return;

    // Map by date
    const milkMap = {};
    milkData.forEach(r => { milkMap[r.date] = (milkMap[r.date] || 0) + (parseFloat(r.milk_liters) || 0); });

    const feedMap = {};
    feedData.forEach(r => { feedMap[r.usage_date] = (feedMap[r.usage_date] || 0) + (parseFloat(r.quantity_used) || 0); });

    const allDates = [...new Set([...Object.keys(milkMap), ...Object.keys(feedMap)])].sort();
    const points   = allDates.map(date => ({ x: feedMap[date] || 0, y: milkMap[date] || 0, date }));

    if (scatterChart) scatterChart.destroy();

    scatterChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Feed vs Milk',
                data: points,
                backgroundColor: 'rgba(34,197,94,0.6)',
                borderColor: '#22c55e',
                borderWidth: 1.5,
                pointRadius: 7, pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937', padding: 10, cornerRadius: 8,
                    callbacks: {
                        title: items => items[0].raw.date,
                        label: c => [`Feed: ${c.raw.x.toFixed(1)} kg`, `Milk: ${c.raw.y.toFixed(1)} L`]
                    }
                }
            },
            scales: {
                x: {
                    title: { display: true, text: 'Feed Used (kg)', font: { family: 'Inter', size: 11, weight: '600' }, color: '#6b7280' },
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', callback: v => v + ' kg' }
                },
                y: {
                    title: { display: true, text: 'Milk Produced (L)', font: { family: 'Inter', size: 11, weight: '600' }, color: '#6b7280' },
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Inter', size: 11 }, color: '#6b7280', callback: v => v + ' L' }
                }
            }
        }
    });
}

function updateChartStats(milkData, feedData) {
    const totalMilk = milkData.reduce((s, r) => s + (parseFloat(r.milk_liters) || 0), 0);
    const totalIncome = milkData.reduce((s, r) => s + (parseFloat(r.income) || 0), 0);
    const avgYield = milkData.length ? totalMilk / milkData.length : 0;
    const totalFeed = feedData.reduce((s, r) => s + (parseFloat(r.quantity_used) || 0), 0);

    setInner('avgYieldStat',   `${avgYield.toFixed(1)} L`);
    setInner('totalMilkStat',  `${totalMilk.toFixed(1)} L`);
    setInner('milkIncomeStat', `₹${totalIncome.toFixed(0)}`);
    setInner('feedUsedStat',   `${totalFeed.toFixed(1)} kg`);
}

// ===========================
// CUSTOM RANGE (shared)
// ===========================
function applyCustomRange() {
    const start = document.getElementById('customStartDate')?.value;
    const end   = document.getElementById('customEndDate')?.value;
    if (!start || !end) return;
    if (new Date(start) > new Date(end)) { showNotification('Start must be before end date', 'error'); return; }

    currentStart = start;
    currentEnd   = end;
    document.querySelectorAll('#sharedFilters .filter-btn').forEach(b => b.classList.remove('active'));
    loadBothCharts(null, start, end);

    bootstrap.Modal.getInstance(document.getElementById('customRangeModal'))?.hide();
    showNotification('Custom range applied', 'success');
}

// ===========================
// FINANCIAL SUMMARY
// ===========================
function loadSummary(days) {
    const label = days === 0 ? 'All time' : `Last ${days} days`;
    setInner('summaryPeriodLabel', label);

    const url = `/cattle/${CATTLE_ID}/summary?days=${days}`;
    fetch(url)
        .then(r => r.json())
        .then(d => {
            if (!d.success) return;
            const income      = parseFloat(d.income      || 0);
            const feedCost    = parseFloat(d.feed_cost   || 0);
            const healthCost  = parseFloat(d.health_cost || 0);
            const feedKg      = parseFloat(d.feed_kg     || 0);
            const healthRecs  = parseInt(d.health_records || 0);
            const totalLiters = parseFloat(d.total_liters || 0);
            const profit      = income - feedCost - healthCost;

            setInner('summaryIncome',       `₹${income.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
            setInner('summaryMilkLiters',   `${totalLiters.toFixed(1)} L milk sold`);
            setInner('summaryFeedCost',     `₹${feedCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
            setInner('summaryFeedKg',       `${feedKg.toFixed(1)} kg consumed`);
            setInner('summaryHealthCost',   `₹${healthCost.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`);
            setInner('summaryHealthRecords',`${healthRecs} records`);

            const profitEl = document.getElementById('summaryProfit');
            const cardEl   = document.getElementById('profitCard');
            const iconEl   = document.getElementById('profitIcon');
            if (profitEl) {
                profitEl.textContent = `${profit >= 0 ? '' : '−'}₹${Math.abs(profit).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
                profitEl.style.color = profit >= 0 ? '#059669' : '#dc2626';
            }
            if (cardEl)  cardEl.classList.toggle('is-loss', profit < 0);
            if (iconEl)  iconEl.textContent = profit >= 0 ? 'trending_up' : 'trending_down';
            setInner('summaryProfitSub', `Income ₹${income.toFixed(0)} − Expenses ₹${(feedCost + healthCost).toFixed(0)}`);
        })
        .catch(console.error);
}

// ===========================
// MILK RECORDS TABLE
// ===========================
function loadAllMilkRecords() {
    fetch(`/cattle/${CATTLE_ID}/milk?page=1&per_page=1000`)
        .then(r => r.json())
        .then(res => {
            if (res.success) { allMilkRecords = res.records; displayMilkRecords(); }
        })
        .catch(console.error);
}

function displayMilkRecords() {
    const tbody = document.getElementById('milkRecordsTable');
    const info  = document.getElementById('recordsInfo');
    if (!tbody) return;

    if (!allMilkRecords.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No milk records found</td></tr>';
        if (info) info.textContent = 'Showing 0 entries';
        return;
    }

    const total      = allMilkRecords.length;
    const totalPages = Math.ceil(total / entriesPerPage);
    const start      = (currentPage - 1) * entriesPerPage;
    const end        = Math.min(start + entriesPerPage, total);

    if (info) info.textContent = `Showing entries ${start + 1}–${end} of ${total}`;

    tbody.innerHTML = allMilkRecords.slice(start, end).map(r => `
        <tr>
            <td>${fmtDate(r.date)}</td>
            <td>${parseFloat(r.morning_liters).toFixed(1)}</td>
            <td>${parseFloat(r.evening_liters).toFixed(1)}</td>
            <td class="highlight">${parseFloat(r.milk_liters).toFixed(1)}</td>
            <td>₹${parseFloat(r.rate).toFixed(2)}</td>
            <td class="income">₹${parseFloat(r.income).toFixed(0)}</td>
            <td class="actions-cell">
                <button class="action-btn edit-btn" onclick="editMilkRecord(${r.id})" title="Edit"><span class="material-symbols-outlined">edit</span></button>
                <button class="action-btn delete-btn" onclick="openDelete(${r.id},'milk')" title="Delete"><span class="material-symbols-outlined">delete</span></button>
            </td>
        </tr>`).join('');

    renderPagination('milkPagination', currentPage, totalPages, p => { currentPage = p; displayMilkRecords(); });
}

// ===========================
// FEED RECORDS TABLE
// ===========================
function loadAllFeedRecords() {
    fetch(`/cattle/${CATTLE_ID}/feed-records?page=1&per_page=1000`)
        .then(r => r.json())
        .then(res => {
            if (res.success) { allFeedRecords = res.records; displayFeedRecords(); }
            else { document.getElementById('feedRecordsTable').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No feed records yet</td></tr>'; setInner('feedRecordsInfo', 'Showing 0 entries'); }
        })
        .catch(() => {
            document.getElementById('feedRecordsTable').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No feed records yet</td></tr>';
            setInner('feedRecordsInfo', 'Showing 0 entries');
        });
}

function displayFeedRecords() {
    const tbody = document.getElementById('feedRecordsTable');
    const info  = document.getElementById('feedRecordsInfo');
    if (!tbody) return;

    if (!allFeedRecords.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No feed records found</td></tr>';
        if (info) info.textContent = 'Showing 0 entries';
        return;
    }

    const total      = allFeedRecords.length;
    const totalPages = Math.ceil(total / feedEntriesPerPage);
    const start      = (feedCurrentPage - 1) * feedEntriesPerPage;
    const end        = Math.min(start + feedEntriesPerPage, total);

    if (info) info.textContent = `Showing entries ${start + 1}–${end} of ${total}`;

    tbody.innerHTML = allFeedRecords.slice(start, end).map(r => {
        const costPkg   = parseFloat(r.cost_per_kg  || 0);
        const qty       = parseFloat(r.quantity_used || 0);
        const totalCost = (qty * costPkg).toFixed(2);
        return `
        <tr>
            <td>${fmtDate(r.usage_date)}</td>
            <td><span class="feed-type-badge">${r.feed_name || '—'}</span></td>
            <td>${qty.toFixed(1)}</td>
            <td>₹${costPkg.toFixed(2)}</td>
            <td class="cost-cell">₹${totalCost}</td>
            <td class="actions-cell">
                <button class="action-btn edit-btn" onclick="editFeedRecord(${r.id})" title="Edit"><span class="material-symbols-outlined">edit</span></button>
                <button class="action-btn delete-btn" onclick="openDelete(${r.id},'feed')" title="Delete"><span class="material-symbols-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');

    renderPagination('feedPagination', feedCurrentPage, totalPages, p => { feedCurrentPage = p; displayFeedRecords(); });
}

// ===========================
// PAGINATION HELPER
// ===========================
function renderPagination(containerId, page, totalPages, onChangeFn) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }

    let pages = [];
    if (totalPages <= 7) pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    else if (page <= 3)  pages = [1,2,3,4,'...',totalPages];
    else if (page >= totalPages - 2) pages = [1,'...',totalPages-3,totalPages-2,totalPages-1,totalPages];
    else pages = [1,'...',page-1,page,page+1,'...',totalPages];

    const nums = pages.map(p => p === '...'
        ? `<span class="pagination-ellipsis">...</span>`
        : `<button class="pagination-number ${p === page ? 'active' : ''}" onclick="(${onChangeFn.toString()})(${p})">${p}</button>`
    ).join('');

    container.innerHTML = `
        <div class="pagination-wrapper">
            <button class="pagination-btn" ${page===1?'disabled':''} onclick="(${onChangeFn.toString()})(${page-1})"><span class="material-symbols-outlined">chevron_left</span></button>
            <div class="pagination-numbers">${nums}</div>
            <button class="pagination-btn" ${page===totalPages?'disabled':''} onclick="(${onChangeFn.toString()})(${page+1})"><span class="material-symbols-outlined">chevron_right</span></button>
        </div>`;
}

// ===========================
// EDIT MILK RECORD
// ===========================
function editMilkRecord(id) {
    const r = allMilkRecords.find(x => x.id === id);
    if (!r) return;
    document.getElementById('editMilkRecordId').value = id;
    document.getElementById('editMilkDate').value    = r.date;
    document.getElementById('editMilkMorning').value = parseFloat(r.morning_liters).toFixed(1);
    document.getElementById('editMilkEvening').value = parseFloat(r.evening_liters).toFixed(1);
    document.getElementById('editMilkRate').value    = parseFloat(r.rate).toFixed(2);
    new bootstrap.Modal(document.getElementById('editMilkModal')).show();
}

function saveEditMilkRecord() {
    const id = document.getElementById('editMilkRecordId').value;
    const data = {
        date:           document.getElementById('editMilkDate').value,
        morning_liters: parseFloat(document.getElementById('editMilkMorning').value),
        evening_liters: parseFloat(document.getElementById('editMilkEvening').value),
        rate:           parseFloat(document.getElementById('editMilkRate').value)
    };
    fetch(`/cattle/${CATTLE_ID}/update-milk/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Record updated', 'success'); bootstrap.Modal.getInstance(document.getElementById('editMilkModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Update failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

// ===========================
// EDIT FEED RECORD
// ===========================
function editFeedRecord(id) {
    const r = allFeedRecords.find(x => x.id === id);
    if (!r) return;
    document.getElementById('editFeedRecordId').value = id;
    document.getElementById('editFeedDate').value     = r.usage_date;
    document.getElementById('editFeedQty').value      = parseFloat(r.quantity_used).toFixed(1);

    // Ensure options loaded
    const sel = document.getElementById('editFeedTypeSelect');
    if (sel.options.length <= 1) populateFeedSelect('editFeedTypeSelect');
    sel.value = r.feed_id;

    new bootstrap.Modal(document.getElementById('editFeedModal')).show();
}

function saveEditFeedRecord() {
    const id = document.getElementById('editFeedRecordId').value;
    const data = {
        usage_date:    document.getElementById('editFeedDate').value,
        feed_id:       parseInt(document.getElementById('editFeedTypeSelect').value),
        quantity_used: parseFloat(document.getElementById('editFeedQty').value),
        cattle_id:     CATTLE_ID
    };
    fetch(`/cattle/${CATTLE_ID}/update-feed/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Feed record updated', 'success'); bootstrap.Modal.getInstance(document.getElementById('editFeedModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Update failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

// ===========================
// DELETE
// ===========================
function openDelete(id, type) {
    document.getElementById('deleteRecordId').value   = id;
    document.getElementById('deleteRecordType').value = type;
    new bootstrap.Modal(document.getElementById('deleteConfirmModal')).show();
}

function confirmDelete() {
    const id   = document.getElementById('deleteRecordId').value;
    const type = document.getElementById('deleteRecordType').value;
    const url  = type === 'milk'
        ? `/cattle/${CATTLE_ID}/delete-milk/${id}`
        : `/cattle/${CATTLE_ID}/delete-feed/${id}`;

    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })
        .then(r => r.json())
        .then(res => {
            if (res.success) { showNotification('Record deleted', 'success'); bootstrap.Modal.getInstance(document.getElementById('deleteConfirmModal'))?.hide(); setTimeout(() => location.reload(), 700); }
            else showNotification(res.error || 'Delete failed', 'error');
        }).catch(() => showNotification('Error', 'error'));
}

// ===========================
// UPDATE CATTLE
// ===========================
function updateCattle() {
    const fd = new FormData(document.getElementById('editCattleForm'));
    fetch(`/cattle/${CATTLE_ID}/update`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: fd.get('name'), tag_no: fd.get('tag_no'), breed: fd.get('breed'), age: parseInt(fd.get('age')), gender: fd.get('gender'), health: fd.get('health') })
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Cattle updated', 'success'); bootstrap.Modal.getInstance(document.getElementById('editCattleModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Update failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

// ===========================
// ADD RECORDS (3 tabs)
// ===========================
function submitRecord() {
    const active = document.querySelector('.record-form.active');
    if (!active) return;
    const map = { addMilkForm: submitMilkRecord, addHealthForm: submitHealthRecord, addFeedForm: submitFeedRecord };
    map[active.id]?.();
}

function submitMilkRecord() {
    const form = document.getElementById('addMilkForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    fetch(`/cattle/${CATTLE_ID}/add-milk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: fd.get('date'), morning_liters: parseFloat(fd.get('morning_liters')), evening_liters: parseFloat(fd.get('evening_liters')), rate: parseFloat(fd.get('rate')) })
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Milk record added', 'success'); form.reset(); setDefaultDates(); bootstrap.Modal.getInstance(document.getElementById('addRecordModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

function submitHealthRecord() {
    const form = document.getElementById('addHealthForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    fetch(`/cattle/${CATTLE_ID}/add-health`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issue: fd.get('issue'), treatment: fd.get('treatment'), vet_name: fd.get('vet_name'), next_checkup: fd.get('next_checkup') || null })
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Health record added', 'success'); form.reset(); bootstrap.Modal.getInstance(document.getElementById('addRecordModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

function submitFeedRecord() {
    const form = document.getElementById('addFeedForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    fetch(`/cattle/${CATTLE_ID}/add-feed`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feed_id: parseInt(fd.get('feed_id')), quantity_used: parseFloat(fd.get('quantity_used')), usage_date: fd.get('usage_date'), cattle_id: CATTLE_ID })
    }).then(r => r.json()).then(res => {
        if (res.success) { showNotification('Feed record added', 'success'); form.reset(); setDefaultDates(); bootstrap.Modal.getInstance(document.getElementById('addRecordModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

// ===========================
// GENERATE REPORT
// ===========================
function generateReport() {
    const s = document.getElementById('reportStartDate')?.value;
    const e = document.getElementById('reportEndDate')?.value;
    if (!s || !e) return;
    if (new Date(s) > new Date(e)) { showNotification('Start must be before end date', 'error'); return; }
    showNotification('Generating report…', 'info');
    window.open(`/cattle/${CATTLE_ID}/generate-pdf?start_date=${s}&end_date=${e}`, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('reportModal'))?.hide();
    setTimeout(() => showNotification('Report generated', 'success'), 1200);
}

// ===========================
// HELPERS
// ===========================
function fmtDate(dateStr) {
    const d = new Date(dateStr);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(dateStr) {
    const d = new Date(dateStr);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function setInner(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    const icon = type === 'success' ? 'check_circle' : type === 'error' ? 'error' : 'info';
    n.innerHTML = `<span class="material-symbols-outlined">${icon}</span><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3000);
}