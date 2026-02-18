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
let feedStockList  = [];
let currentDays    = 7;
let currentStart   = null;
let currentEnd     = null;

// ===========================
// INIT
// ===========================
document.addEventListener('DOMContentLoaded', () => {
    setDefaultDates();
    loadFeedStock();
    loadBothCharts(7);
    loadAllMilkRecords();
    loadAllFeedRecords();
    loadSummaryThisMonth();
    setupEventListeners();
    checkLowMilkAlert();
});

function setupEventListeners() {
    document.querySelectorAll('#sharedFilters .filter-btn[data-days]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('#sharedFilters .filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentDays  = parseInt(this.dataset.days);
            currentStart = null;
            currentEnd   = null;
            loadBothCharts(currentDays);
        });
    });

    document.querySelectorAll('.summary-filter[data-mode]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.summary-filter').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const mode = this.dataset.mode;
            if (mode === 'month') loadSummaryThisMonth();
        });
    });

    document.querySelectorAll('.record-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.record-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.record-form').forEach(f => f.classList.remove('active'));
            const map = { milk: 'addMilkForm', health: 'addHealthForm', feed: 'addFeedForm' };
            document.getElementById(map[this.dataset.type])?.classList.add('active');
            if (this.dataset.type !== 'milk') hideMilkDuplicateWarning();
        });
    });

    document.getElementById('milkDateInput')?.addEventListener('change', function () {
        checkMilkDuplicate(this.value);
    });

    document.getElementById('addRecordModal')?.addEventListener('show.bs.modal', function () {
        hideMilkDuplicateWarning();
        const dateEl = document.getElementById('milkDateInput');
        if (dateEl && dateEl.value) checkMilkDuplicate(dateEl.value);
    });

    document.getElementById('entriesPerPage')?.addEventListener('change', function () {
        entriesPerPage = parseInt(this.value);
        currentPage = 1;
        displayMilkRecords();
    });

    document.getElementById('feedEntriesPerPage')?.addEventListener('change', function () {
        feedEntriesPerPage = parseInt(this.value);
        feedCurrentPage = 1;
        displayFeedRecords();
    });

    document.getElementById('feedTypeSelect')?.addEventListener('change', function () {
        updateFeedStockInfo(this.value, 'feedStockInfo');
    });
    document.getElementById('editFeedTypeSelect')?.addEventListener('change', function () {
        updateFeedStockInfo(this.value, null);
    });

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            new bootstrap.Modal(document.getElementById('logoutModal')).show();
        });
    }
}

// ===========================
// MILK DUPLICATE CHECK
// ===========================
function checkMilkDuplicate(selectedDate) {
    if (!selectedDate || !allMilkRecords.length) { hideMilkDuplicateWarning(); return; }
    const existingDates = allMilkRecords.map(r => r.date);
    const hasDuplicate  = existingDates.includes(selectedDate);
    if (hasDuplicate) {
        const count = existingDates.filter(d => d === selectedDate).length;
        const warningEl = document.getElementById('milkDuplicateWarning');
        const msgEl     = document.getElementById('milkDuplicateMsg');
        if (warningEl && msgEl) {
            msgEl.textContent = count > 1
                ? count + ' milk records already exist for this date. Adding another will create a duplicate.'
                : 'A milk record already exists for this date. You may be creating a duplicate.';
            warningEl.style.display = 'flex';
        }
    } else {
        hideMilkDuplicateWarning();
    }
}

function hideMilkDuplicateWarning() {
    const el = document.getElementById('milkDuplicateWarning');
    if (el) el.style.display = 'none';
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
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    setVal('#finCustomStart', monthStart);
    setVal('#finCustomEnd',   today);
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
        .catch(() => { feedStockList = []; });
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
    if (!feedId) {
        info.innerHTML = '<span class="material-symbols-outlined">inventory_2</span><span>Select a feed to see available stock</span>';
        info.classList.remove('low-stock'); return;
    }
    const feed = feedStockList.find(f => String(f.id) === String(feedId));
    if (!feed) return;
    const qty = parseFloat(feed.quantity);
    const min = parseFloat(feed.min_quantity || 0);
    info.innerHTML = `<span class="material-symbols-outlined">inventory_2</span><span>Available: <strong>${qty.toFixed(1)} kg</strong> · Min: ${min.toFixed(1)} kg · ₹${parseFloat(feed.cost_per_kg).toFixed(2)}/kg</span>`;
    info.classList.toggle('low-stock', qty <= min);
}

// ===========================
// LOAD BOTH CHARTS
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
    const sorted   = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels   = sorted.map(d => fmtShortDate(d.date));
    const milkVals = sorted.map(d => parseFloat(d.milk_liters) || 0);
    const maxVal   = Math.max(...milkVals, 5);
    if (milkChart) milkChart.destroy();
    milkChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Milk (L)', data: milkVals,
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
                tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8,
                    callbacks: { label: c => `${c.parsed.y.toFixed(1)} L` } }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false },
                    ticks: { font: { family: 'Lexend', size: 11 }, color: '#6b7280', maxRotation: 45 } },
                y: { beginAtZero: true, max: Math.ceil(maxVal * 1.2),
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Lexend', size: 11 }, color: '#6b7280', callback: v => v + ' L' } }
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
                label: 'Feed vs Milk', data: points,
                backgroundColor: 'rgba(34,197,94,0.6)', borderColor: '#22c55e',
                borderWidth: 1.5, pointRadius: 7, pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#1f2937', padding: 10, cornerRadius: 8,
                    callbacks: { title: items => items[0].raw.date,
                        label: c => [`Feed: ${c.raw.x.toFixed(1)} kg`, `Milk: ${c.raw.y.toFixed(1)} L`] } }
            },
            scales: {
                x: { title: { display: true, text: 'Feed Used (kg)', font: { family: 'Lexend', size: 11, weight: '600' }, color: '#6b7280' },
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Lexend', size: 11 }, color: '#6b7280', callback: v => v + ' kg' } },
                y: { title: { display: true, text: 'Milk Produced (L)', font: { family: 'Lexend', size: 11, weight: '600' }, color: '#6b7280' },
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { font: { family: 'Lexend', size: 11 }, color: '#6b7280', callback: v => v + ' L' } }
            }
        }
    });
}

function updateChartStats(milkData, feedData) {
    const totalMilk   = milkData.reduce((s, r) => s + (parseFloat(r.milk_liters) || 0), 0);
    const totalIncome = milkData.reduce((s, r) => s + (parseFloat(r.income) || 0), 0);
    const avgYield    = milkData.length ? totalMilk / milkData.length : 0;
    const totalFeed   = feedData.reduce((s, r) => s + (parseFloat(r.quantity_used) || 0), 0);
    setInner('avgYieldStat',   `${avgYield.toFixed(1)} L`);
    setInner('totalMilkStat',  `${totalMilk.toFixed(1)} L`);
    setInner('milkIncomeStat', `₹${totalIncome.toFixed(0)}`);
    setInner('feedUsedStat',   `${totalFeed.toFixed(1)} kg`);
}

// ===========================
// CUSTOM RANGE (charts)
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
function loadSummaryByUrl(url, label) {
    setInner('summaryPeriodLabel', label);
    ['summaryIncome','summaryFeedCost','summaryHealthCost','summaryProfit'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '₹—'; el.style.color = ''; }
    });
    fetch(url)
        .then(r => r.json())
        .then(d => {
            if (!d.success) { showNotification('Failed to load financial summary', 'error'); return; }
            const income      = parseFloat(d.income       || 0);
            const feedCost    = parseFloat(d.feed_cost    || 0);
            const healthCost  = parseFloat(d.health_cost  || 0);
            const feedKg      = parseFloat(d.feed_kg      || 0);
            const healthRecs  = parseInt(d.health_records  || 0);
            const totalLiters = parseFloat(d.total_liters  || 0);
            const totalExp    = feedCost + healthCost;
            const profit      = income - totalExp;
            setInner('summaryIncome',        `₹${fmtINR(income)}`);
            setInner('summaryMilkLiters',    `${totalLiters.toFixed(1)} L milk sold`);
            setInner('summaryFeedCost',      `₹${fmtINR(feedCost)}`);
            setInner('summaryFeedKg',        `${feedKg.toFixed(1)} kg consumed`);
            setInner('summaryHealthCost',    `₹${fmtINR(healthCost)}`);
            setInner('summaryHealthRecords', `${healthRecs} record${healthRecs !== 1 ? 's' : ''}`);
            const profitEl = document.getElementById('summaryProfit');
            const cardEl   = document.getElementById('profitCard');
            const iconEl   = document.getElementById('profitIcon');
            if (profitEl) {
                profitEl.textContent = `${profit < 0 ? '−' : ''}₹${fmtINR(Math.abs(profit))}`;
                profitEl.style.color = profit >= 0 ? '#059669' : '#dc2626';
            }
            if (cardEl) cardEl.classList.toggle('is-loss', profit < 0);
            if (iconEl) iconEl.textContent = profit >= 0 ? 'trending_up' : 'trending_down';
            setInner('summaryProfitSub', `Income ₹${fmtINR(income)} − Expenses ₹${fmtINR(totalExp)}`);
        })
        .catch(err => { console.error('Summary error:', err); showNotification('Error loading financial data', 'error'); });
}

function loadSummaryThisMonth() {
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end   = now.toISOString().split('T')[0];
    loadSummaryByUrl(`/cattle/${CATTLE_ID}/summary?start=${start}&end=${end}`, 'This Month');
}

function applyFinCustomRange() {
    const start = document.getElementById('finCustomStart')?.value;
    const end   = document.getElementById('finCustomEnd')?.value;
    if (!start || !end) { showNotification('Please select both dates', 'error'); return; }
    if (new Date(start) > new Date(end)) { showNotification('Start must be before end', 'error'); return; }
    document.querySelectorAll('.summary-filter').forEach(b => b.classList.remove('active'));
    loadSummaryByUrl(`/cattle/${CATTLE_ID}/summary?start=${start}&end=${end}`,
        `${fmtDate(start)} – ${fmtDate(end)}`);
    bootstrap.Modal.getInstance(document.getElementById('finCustomModal'))?.hide();
    showNotification('Custom financial range applied', 'success');
}

// ===========================
// LOW MILK ALERT
// ===========================
function checkLowMilkAlert() {
    fetch(`/cattle/${CATTLE_ID}/milk-chart?days=14`)
        .then(r => r.json())
        .then(res => {
            if (!res.success || !res.data || res.data.length < 4) return;
            const sorted   = [...res.data].sort((a, b) => new Date(a.date) - new Date(b.date));
            const milkVals = sorted.map(d => parseFloat(d.milk_liters) || 0);
            const avg      = milkVals.reduce((s, v) => s + v, 0) / milkVals.length;
            const last3    = milkVals.slice(-3);
            const THRESHOLD = 4;
            const allLow    = last3.every(v => v < avg - THRESHOLD);
            if (!allLow || avg < 1) return;
            const lowestRecent = Math.min(...last3).toFixed(1);
            const alertEl = document.getElementById('lowMilkAlert');
            const msgEl   = document.getElementById('lowMilkAlertMsg');
            if (!alertEl || !msgEl) return;
            const cattleName = typeof CATTLE_NAME !== 'undefined' ? CATTLE_NAME : 'This cattle';
            msgEl.textContent = `${cattleName}'s daily milk has been consistently lower than the average (${avg.toFixed(1)} L) for the last ${last3.length} days — recent yield as low as ${lowestRecent} L. Consider a veterinary checkup or review feed & health status.`;
            alertEl.style.display = 'flex';
        })
        .catch(() => {});
}

// ===========================
// MILK RECORDS TABLE
// ===========================
function loadAllMilkRecords() {
    fetch(`/cattle/${CATTLE_ID}/milk?page=1&per_page=1000`)
        .then(r => r.json())
        .then(res => { if (res.success) { allMilkRecords = res.records; displayMilkRecords(); } })
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
            else {
                document.getElementById('feedRecordsTable').innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No feed records yet</td></tr>';
                setInner('feedRecordsInfo', 'Showing 0 entries');
            }
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
const _pageCallbacks = {};
function renderPagination(containerId, page, totalPages, onChangeFn) {
    const container = document.getElementById(containerId);
    if (!container || totalPages <= 1) { if (container) container.innerHTML = ''; return; }
    _pageCallbacks[containerId] = onChangeFn;
    const cb = `_pageCallbacks['${containerId}']`;
    let pages = [];
    if (totalPages <= 7) pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    else if (page <= 3)  pages = [1,2,3,4,'...',totalPages];
    else if (page >= totalPages - 2) pages = [1,'...',totalPages-3,totalPages-2,totalPages-1,totalPages];
    else pages = [1,'...',page-1,page,page+1,'...',totalPages];
    const nums = pages.map(p => p === '...'
        ? `<span class="pagination-ellipsis">...</span>`
        : `<button class="pagination-number ${p === page ? 'active' : ''}" onclick="${cb}(${p})">${p}</button>`
    ).join('');
    container.innerHTML = `
        <div class="pagination-wrapper">
            <button class="pagination-btn" ${page===1?'disabled':''} onclick="${cb}(${page-1})"><span class="material-symbols-outlined">chevron_left</span></button>
            <div class="pagination-numbers">${nums}</div>
            <button class="pagination-btn" ${page===totalPages?'disabled':''} onclick="${cb}(${page+1})"><span class="material-symbols-outlined">chevron_right</span></button>
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
        if (res.success) { showNotification('Milk record added', 'success'); form.reset(); setDefaultDates(); hideMilkDuplicateWarning(); bootstrap.Modal.getInstance(document.getElementById('addRecordModal'))?.hide(); setTimeout(() => location.reload(), 700); }
        else showNotification(res.error || 'Failed', 'error');
    }).catch(() => showNotification('Error', 'error'));
}

function submitHealthRecord() {
    const form = document.getElementById('addHealthForm');
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const fd = new FormData(form);
    fetch(`/cattle/${CATTLE_ID}/add-health`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            issue:          fd.get('issue'),
            treatment:      fd.get('treatment'),
            vet_name:       fd.get('vet_name'),
            next_checkup:   fd.get('next_checkup') || null,
            treatment_cost: parseFloat(fd.get('treatment_cost') || '0') || 0
        })
    }).then(r => r.json()).then(res => {
        if (res.success) {
            showNotification('Health record added', 'success');
            form.reset();
            bootstrap.Modal.getInstance(document.getElementById('addRecordModal'))?.hide();
            loadSummaryThisMonth();
            setTimeout(() => location.reload(), 700);
        }
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

// ════════════════════════════════════════════════════════════════
//  GENERATE PDF — client-side jsPDF + autoTable
//  Sections: Header · KPI cards · Milk · Feed · Health · Footer
// ════════════════════════════════════════════════════════════════
async function generateReport() {
    const s = document.getElementById('reportStartDate')?.value;
    const e = document.getElementById('reportEndDate')?.value;
    if (!s || !e) { showNotification('Please select both dates', 'error'); return; }
    if (new Date(s) > new Date(e)) { showNotification('Start must be before end date', 'error'); return; }

    showNotification('Generating report…', 'info');

    // ── Fetch all data in parallel ──────────────────────────────
    let milkData = [], feedData = [], healthData = [], summaryData = {};
    try {
        const [mRes, fRes, hRes, sRes] = await Promise.all([
            fetch(`/cattle/${CATTLE_ID}/milk-chart?start_date=${s}&end_date=${e}`).then(r => r.json()),
            fetch(`/cattle/${CATTLE_ID}/feed-records?page=1&per_page=9999`).then(r => r.json()),
            fetch(`/cattle/${CATTLE_ID}/health-records?start_date=${s}&end_date=${e}`).then(r => r.json()),
            fetch(`/cattle/${CATTLE_ID}/summary?start=${s}&end=${e}`).then(r => r.json())
        ]);
        milkData    = mRes.success ? mRes.data    : [];
        feedData    = fRes.success ? fRes.records : [];
        healthData  = hRes.success ? hRes.records : [];
        summaryData = sRes.success ? sRes         : {};
    } catch (err) {
        showNotification('Failed to load data for report', 'error');
        return;
    }

    // Filter feed records to date range client-side
    const filteredFeed = feedData.filter(r => {
        const d = r.usage_date || '';
        return d >= s && d <= e;
    });

    const { jsPDF } = window.jspdf;
    const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const W    = 210;
    const PL   = 14;  // left margin
    const PR   = 196; // right edge
    let   y    = 0;

    // ── helpers ────────────────────────────────────────────────
    function newPageIfNeeded(needed = 20) {
        if (y + needed > 276) { doc.addPage(); y = 18; }
    }

    function sectionHeader(label, accentRGB) {
        newPageIfNeeded(16);
        // left accent bar
        doc.setFillColor(...accentRGB);
        doc.roundedRect(PL, y, 2.5, 7, 0.5, 0.5, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(31, 41, 55);
        doc.text(label, PL + 5, y + 5.5);
        y += 12;
    }

    // ── PAGE HEADER ─────────────────────────────────────────────
    // Top green stripe
    doc.setFillColor(22, 163, 74);
    doc.rect(0, 0, W, 1.5, 'F');

    // White header band
    doc.setFillColor(255, 255, 255);
    doc.rect(0, 1.5, W, 44, 'F');

    // Logo pill
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(PL, 8, 12, 12, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('CC', PL + 3.2, 15.3);

    // App name
    doc.setTextColor(31, 41, 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Cattle-Cloud', PL + 16, 16);

    // Sub-title
    const cName = typeof CATTLE_NAME !== 'undefined' ? CATTLE_NAME : 'Cattle';
    const cTag  = typeof CATTLE_TAG  !== 'undefined' ? CATTLE_TAG  : '';
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Individual Report  ·  ${cName}  (ID: #${cTag})`, PL + 16, 23);

    // Right: period & generated date
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${fmtDate(s)}  –  ${fmtDate(e)}`, PR, 12, { align: 'right' });
    doc.setFontSize(7.5);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, PR, 19, { align: 'right' });

    // Divider
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(0, 45.5, W, 45.5);
    y = 54;

    // ── KPI SUMMARY CARDS ───────────────────────────────────────
    const income     = parseFloat(summaryData.income      || 0);
    const feedCost   = parseFloat(summaryData.feed_cost   || 0);
    const healthCost = parseFloat(summaryData.health_cost || 0);
    const profit     = income - feedCost - healthCost;
    const litres     = parseFloat(summaryData.total_liters || 0);
    const feedKg     = parseFloat(summaryData.feed_kg     || 0);

    const kpis = [
        { label: 'Milk Produced',  val: `${litres.toFixed(1)} L`,             sub: `${milkData.length} records`,           accent: [102, 126, 234] },
        { label: 'Milk Revenue',   val: `Rs.${fmtINR(Math.round(income))}`,   sub: `${litres > 0 ? (income/litres).toFixed(2) : '0'} Rs/L avg`, accent: [34, 197, 94]   },
        { label: 'Total Expenses', val: `Rs.${fmtINR(Math.round(feedCost + healthCost))}`,
                                   sub: `Feed + Vet costs`,                   accent: [234, 88, 12]   },
        { label: 'Net Profit',
          val: `${profit < 0 ? '-' : ''}Rs.${fmtINR(Math.round(Math.abs(profit)))}`,
          sub: profit >= 0 ? 'Profitable period' : 'Expenses exceeded income',
          accent: profit >= 0 ? [21, 128, 61] : [185, 28, 28] }
    ];

    const cW = (PR - PL - 4.5) / 4;
    kpis.forEach((k, i) => {
        const cx = PL + i * (cW + 1.5);
        // card bg
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(...k.accent);
        doc.setLineWidth(0.3);
        doc.roundedRect(cx, y, cW, 22, 2, 2, 'FD');
        // top accent
        doc.setFillColor(...k.accent);
        doc.roundedRect(cx, y, cW, 2.5, 2, 2, 'F');
        doc.rect(cx, y + 1, cW, 1.5, 'F'); // flush bottom of top accent
        // label
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(107, 114, 128);
        doc.text(k.label, cx + cW / 2, y + 8, { align: 'center' });
        // value
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(...k.accent);
        doc.text(k.val, cx + cW / 2, y + 15.5, { align: 'center' });
        // sub
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(156, 163, 175);
        doc.text(k.sub, cx + cW / 2, y + 20, { align: 'center' });
    });
    y += 30;

    // ── TABLE STYLE HELPERS ──────────────────────────────────────
    const baseBody = {
        fontSize: 8,
        textColor: [55, 65, 81],
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
        lineColor: [229, 231, 235],
        lineWidth: 0.15
    };

    function headStyle(rgb) {
        return {
            fillColor: rgb,
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 }
        };
    }

    // ── SECTION 1: MILK PRODUCTION ───────────────────────────────
    if (milkData.length > 0) {
        sectionHeader('Milk Production Records', [34, 197, 94]);

        // Totals row
        const totalMilk   = milkData.reduce((s, r) => s + parseFloat(r.milk_liters  || 0), 0);
        const totalMorn   = milkData.reduce((s, r) => s + parseFloat(r.morning_liters || 0), 0);
        const totalEve    = milkData.reduce((s, r) => s + parseFloat(r.evening_liters || 0), 0);
        const totalIncome = milkData.reduce((s, r) => s + parseFloat(r.income        || 0), 0);

        const sorted = [...milkData].sort((a, b) => new Date(a.date) - new Date(b.date));

        doc.autoTable({
            startY: y,
            head: [['Date', 'Morning (L)', 'Evening (L)', 'Total (L)', 'Rate (Rs/L)', 'Income (Rs)']],
            body: [
                ...sorted.map(r => [
                    fmtDate(r.date),
                    parseFloat(r.morning_liters || 0).toFixed(1),
                    parseFloat(r.evening_liters || 0).toFixed(1),
                    parseFloat(r.milk_liters    || 0).toFixed(1),
                    `Rs. ${parseFloat(r.rate || 0).toFixed(2)}`,
                    `Rs. ${fmtINR(Math.round(r.income || 0))}`
                ]),
                // Totals row
                [
                    { content: 'TOTAL', styles: { fontStyle: 'bold', textColor: [31, 41, 55] } },
                    { content: totalMorn.toFixed(1),   styles: { fontStyle: 'bold', halign: 'right', textColor: [21, 128, 61] } },
                    { content: totalEve.toFixed(1),    styles: { fontStyle: 'bold', halign: 'right', textColor: [21, 128, 61] } },
                    { content: totalMilk.toFixed(1),   styles: { fontStyle: 'bold', halign: 'right', textColor: [21, 128, 61] } },
                    { content: '—',                   styles: { halign: 'right', textColor: [156, 163, 175] } },
                    { content: `Rs. ${fmtINR(Math.round(totalIncome))}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [21, 128, 61] } }
                ]
            ],
            headStyles: headStyle([34, 197, 94]),
            bodyStyles: { ...baseBody },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { halign: 'right' },
                2: { halign: 'right' },
                3: { halign: 'right', fontStyle: 'bold' },
                4: { halign: 'right' },
                5: { halign: 'right', textColor: [21, 128, 61] }
            },
            margin: { left: PL, right: PL },
            tableLineColor: [229, 231, 235],
            tableLineWidth: 0.15,
            didDrawPage: (data) => { y = data.cursor.y; }
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    // ── SECTION 2: FEED USAGE ────────────────────────────────────
    if (filteredFeed.length > 0) {
        newPageIfNeeded(30);
        sectionHeader('Feed Usage Records', [102, 126, 234]);

        const totalFeedQty  = filteredFeed.reduce((s, r) => s + parseFloat(r.quantity_used || 0), 0);
        const totalFeedCost = filteredFeed.reduce((s, r) => s + parseFloat(r.quantity_used || 0) * parseFloat(r.cost_per_kg || 0), 0);

        // Group by feed type for summary mini-table first
        const byType = {};
        filteredFeed.forEach(r => {
            const name = r.feed_name || 'Unknown';
            if (!byType[name]) byType[name] = { qty: 0, cost: 0 };
            byType[name].qty  += parseFloat(r.quantity_used || 0);
            byType[name].cost += parseFloat(r.quantity_used || 0) * parseFloat(r.cost_per_kg || 0);
        });

        // Summary by feed type
        doc.autoTable({
            startY: y,
            head: [['Feed Type', 'Total Qty (kg)', 'Total Cost (Rs)']],
            body: Object.entries(byType).map(([name, d]) => [
                name,
                { content: d.qty.toFixed(1), styles: { halign: 'right' } },
                { content: `Rs. ${fmtINR(Math.round(d.cost))}`, styles: { halign: 'right', textColor: [234, 88, 12] } }
            ]),
            headStyles: headStyle([102, 126, 234]),
            bodyStyles: { ...baseBody, fontSize: 8 },
            alternateRowStyles: { fillColor: [238, 242, 255] },
            columnStyles: { 0: { cellWidth: 70 }, 1: { halign: 'right' }, 2: { halign: 'right' } },
            margin: { left: PL, right: PL },
            tableLineColor: [229, 231, 235], tableLineWidth: 0.15
        });
        y = doc.lastAutoTable.finalY + 6;

        // Detailed records
        const sortedFeed = [...filteredFeed].sort((a, b) => new Date(a.usage_date) - new Date(b.usage_date));
        doc.autoTable({
            startY: y,
            head: [['Date', 'Feed Type', 'Qty Used (kg)', 'Cost / kg (Rs)', 'Total Cost (Rs)']],
            body: [
                ...sortedFeed.map(r => {
                    const qty = parseFloat(r.quantity_used || 0);
                    const cpk = parseFloat(r.cost_per_kg  || 0);
                    return [
                        fmtDate(r.usage_date),
                        r.feed_name || '—',
                        { content: qty.toFixed(1), styles: { halign: 'right' } },
                        { content: `Rs. ${cpk.toFixed(2)}`, styles: { halign: 'right' } },
                        { content: `Rs. ${fmtINR(Math.round(qty * cpk))}`, styles: { halign: 'right', textColor: [234, 88, 12] } }
                    ];
                }),
                // Totals
                [
                    { content: 'TOTAL', styles: { fontStyle: 'bold', textColor: [31, 41, 55] } },
                    { content: '—', styles: { textColor: [156, 163, 175] } },
                    { content: totalFeedQty.toFixed(1), styles: { fontStyle: 'bold', halign: 'right', textColor: [102, 126, 234] } },
                    { content: '—', styles: { halign: 'right', textColor: [156, 163, 175] } },
                    { content: `Rs. ${fmtINR(Math.round(totalFeedCost))}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [234, 88, 12] } }
                ]
            ],
            headStyles: headStyle([102, 126, 234]),
            bodyStyles: { ...baseBody },
            alternateRowStyles: { fillColor: [238, 242, 255] },
            columnStyles: {
                0: { cellWidth: 28 },
                1: { cellWidth: 55 },
                2: { halign: 'right' },
                3: { halign: 'right' },
                4: { halign: 'right' }
            },
            margin: { left: PL, right: PL },
            tableLineColor: [229, 231, 235], tableLineWidth: 0.15
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    // ── SECTION 3: HEALTH & MEDICAL RECORDS ─────────────────────
    if (healthData.length > 0) {
        newPageIfNeeded(30);
        sectionHeader('Health & Medical Records', [239, 68, 68]);

        const totalVetCost = healthData.reduce((s, r) => s + parseFloat(r.treatment_cost || 0), 0);

        doc.autoTable({
            startY: y,
            head: [['Date', 'Issue / Condition', 'Treatment', 'Veterinarian', 'Next Checkup', 'Cost (Rs)']],
            body: [
                ...healthData.map(r => {
                    const cost = parseFloat(r.treatment_cost || 0);
                    return [
                        r.created_at ? fmtDate(r.created_at.split('T')[0] || r.created_at) : '—',
                        r.issue      || '—',
                        r.treatment  || '—',
                        r.vet_name   || '—',
                        r.next_checkup ? fmtDate(r.next_checkup.split('T')[0] || r.next_checkup) : '—',
                        {
                            content: cost > 0 ? `Rs. ${fmtINR(Math.round(cost))}` : '—',
                            styles: { halign: 'right', textColor: cost > 0 ? [185, 28, 28] : [156, 163, 175] }
                        }
                    ];
                }),
                // Totals
                [
                    { content: `TOTAL (${healthData.length} record${healthData.length !== 1 ? 's' : ''})`, colSpan: 5, styles: { fontStyle: 'bold', textColor: [31, 41, 55] } },
                    { content: `Rs. ${fmtINR(Math.round(totalVetCost))}`, styles: { fontStyle: 'bold', halign: 'right', textColor: [185, 28, 28] } }
                ]
            ],
            headStyles: headStyle([239, 68, 68]),
            bodyStyles: { ...baseBody, fontSize: 7.5 },
            alternateRowStyles: { fillColor: [255, 241, 242] },
            columnStyles: {
                0: { cellWidth: 24 },
                1: { cellWidth: 38, overflow: 'linebreak' },
                2: { cellWidth: 48, overflow: 'linebreak' },
                3: { cellWidth: 30 },
                4: { cellWidth: 25 },
                5: { halign: 'right' }
            },
            margin: { left: PL, right: PL },
            tableLineColor: [229, 231, 235], tableLineWidth: 0.15
        });
        y = doc.lastAutoTable.finalY + 10;
    }

    // ── SECTION 4: FINANCIAL SUMMARY ─────────────────────────────
    newPageIfNeeded(50);
    sectionHeader('Financial Summary', [118, 75, 162]);

    const finRows = [
        ['Milk Revenue', `Rs. ${fmtINR(Math.round(income))}`,  `${litres.toFixed(1)} L sold`],
        ['Feed Cost',    `Rs. ${fmtINR(Math.round(feedCost))}`,  `${feedKg.toFixed(1)} kg used`],
        ['Health / Vet Cost', `Rs. ${fmtINR(Math.round(healthCost))}`, `${(summaryData.health_records || 0)} records`],
        ['Total Expenses', `Rs. ${fmtINR(Math.round(feedCost + healthCost))}`, 'Feed + Vet'],
        [
            { content: profit >= 0 ? 'Net Profit' : 'Net Loss', styles: { fontStyle: 'bold', textColor: profit >= 0 ? [21, 128, 61] : [185, 28, 28] } },
            { content: `${profit < 0 ? '-' : ''}Rs. ${fmtINR(Math.round(Math.abs(profit)))}`, styles: { fontStyle: 'bold', textColor: profit >= 0 ? [21, 128, 61] : [185, 28, 28], halign: 'right' } },
            { content: profit >= 0 ? 'Profitable period' : 'Expenses exceeded income', styles: { textColor: profit >= 0 ? [21, 128, 61] : [185, 28, 28] } }
        ]
    ];

    doc.autoTable({
        startY: y,
        head: [['Category', 'Amount', 'Details']],
        body: finRows,
        headStyles: headStyle([118, 75, 162]),
        bodyStyles: { ...baseBody },
        alternateRowStyles: { fillColor: [245, 243, 255] },
        columnStyles: {
            0: { cellWidth: 60 },
            1: { halign: 'right', cellWidth: 50 },
            2: { cellWidth: 72, textColor: [107, 114, 128] }
        },
        margin: { left: PL, right: PL },
        tableLineColor: [229, 231, 235], tableLineWidth: 0.15
    });

    // ── PAGE FOOTERS ─────────────────────────────────────────────
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        // Footer bar
        doc.setFillColor(248, 249, 252);
        doc.rect(0, 284, W, 13, 'F');
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.2);
        doc.line(0, 284, W, 284);
        // Green bottom strip
        doc.setFillColor(22, 163, 74);
        doc.rect(0, 296, W, 1.5, 'F');
        // Footer text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(156, 163, 175);
        doc.text('Cattle-Cloud Farm Management', PL, 291);
        doc.text(`Page ${p} of ${totalPages}`, W / 2, 291, { align: 'center' });
        doc.text(`${new Date().getFullYear()} · Confidential`, PR, 291, { align: 'right' });
    }

    // ── SAVE ─────────────────────────────────────────────────────
    const safeName = cName.replace(/[^a-zA-Z0-9]/g, '_');
    doc.save(`CattleCloud_${safeName}_${s}_to_${e}.pdf`);
    showNotification('Report downloaded!', 'success');
    bootstrap.Modal.getInstance(document.getElementById('reportModal'))?.hide();
}

// ===========================
// HELPERS
// ===========================
function fmtDate(dateStr) {
    if (!dateStr) return '—';
    // Handle ISO datetime strings
    const clean = typeof dateStr === 'string' ? dateStr.split('T')[0] : dateStr;
    const d = new Date(clean);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtShortDate(dateStr) {
    const d = new Date(dateStr);
    d.setMinutes(d.getMinutes() + d.getTimezoneOffset());
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtINR(n) {
    return Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function setInner(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function showNotification(message, type) {
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    n.innerHTML = `<span class="material-symbols-outlined">${icons[type] || 'info'}</span><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 3200);
}