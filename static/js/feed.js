// ════════════════════════════════════════════════════════════════
// CATTLE-CLOUD — feed.js
// Bar chart matches dashboard style exactly
// ════════════════════════════════════════════════════════════════

let feedUsageChart     = null;
let feedTypeDonutChart = null;
let currentPage        = 1;
let stockPage          = 1;
const perPage          = 5;
const stockPerPage     = 5;
let currentFeedTypeFilter = 'all';
let currentCattleFilter   = 'all';
let currentDateRange = { from: null, to: null };
let feedStockList    = [];
let cattleList       = [];

const COLORS = {
    primary: '#667eea',
    pieColors: [
        '#10b981','#667eea','#f59e0b','#ef4444',
        '#8b5cf6','#ec4899','#14b8a6','#06b6d4',
        '#84cc16','#a855f7','#f97316','#764ba2'
    ]
};

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
    initializeDateInputs();
    loadDropdownData();
    loadAllData();
    loadStockTable();
    setupEventListeners();
    setupStockModalLogic();

    // Logout confirm modal
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            new bootstrap.Modal(document.getElementById('logoutModal')).show();
        });
    }
});

function initializeDateInputs() {
    const today    = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    currentDateRange.from = formatDate(firstDay);
    currentDateRange.to   = formatDate(today);
    setVal('rangeFrom',  currentDateRange.from);
    setVal('rangeTo',    currentDateRange.to);
    setVal('reportFrom', currentDateRange.from);
    setVal('reportTo',   currentDateRange.to);
    setVal('feedDate',   formatDate(today));
}

function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val; }

function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDateDisplay(s) {
    return new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ════════════════════════════════════════════════════════════════
// DROPDOWN DATA
// ════════════════════════════════════════════════════════════════
async function loadDropdownData() {
    try {
        const [fr, cr] = await Promise.all([
            fetch('/feed/stock-list'),
            fetch('/api/cattle-list')
        ]);
        if (fr.ok) {
            const data = await fr.json();
            feedStockList = data.feeds || data.stock_list || [];
            populateFeedDropdowns();
        }
        if (cr.ok) {
            const data = await cr.json();
            cattleList = data.cattle || data.cattle_list || [];
            populateCattleDropdowns();
        }
    } catch (e) { console.error('Dropdown error:', e); }
}

function populateFeedDropdowns() {
    // Feed entry modal dropdown
    const sel = document.getElementById('feedType');
    if (sel) {
        sel.innerHTML = '<option value="">Select feed type</option>';
        feedStockList.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id;
            o.textContent = `${f.feed_name || f.name} (${parseFloat(f.quantity).toFixed(1)} kg available)`;
            o.dataset.quantity = f.quantity;
            o.dataset.cost     = f.cost_per_kg;
            sel.appendChild(o);
        });
    }
    // Filter dropdown
    const ff = document.getElementById('filterFeedType');
    if (ff) {
        ff.innerHTML = '<option value="all">All Feed Types</option>';
        [...new Set(feedStockList.map(f => f.feed_name || f.name))].forEach(n => {
            const o = document.createElement('option'); o.value = n; o.textContent = n; ff.appendChild(o);
        });
    }
    // Refill dropdown
    const refillSel = document.getElementById('refillFeedSelect');
    if (refillSel) {
        refillSel.innerHTML = '<option value="">Select feed to refill</option>';
        feedStockList.forEach(f => {
            const o = document.createElement('option');
            o.value = f.id;
            o.textContent = `${f.feed_name || f.name} (${parseFloat(f.quantity).toFixed(1)} kg in stock)`;
            o.dataset.cost = f.cost_per_kg;
            refillSel.appendChild(o);
        });
    }
}

function populateCattleDropdowns() {
    const fc = document.getElementById('feedCattle');
    if (fc) {
        fc.innerHTML = '<option value="">General Stock</option>';
        cattleList.forEach(c => {
            const o = document.createElement('option');
            o.value = c.id;
            o.textContent = c.name + (c.tag_no ? ` (${c.tag_no})` : '');
            fc.appendChild(o);
        });
    }
    const fl = document.getElementById('filterCattle');
    if (fl) {
        fl.innerHTML = '<option value="all">All Cattle</option>';
        cattleList.forEach(c => {
            const o = document.createElement('option'); o.value = c.name; o.textContent = c.name; fl.appendChild(o);
        });
    }
}

// ════════════════════════════════════════════════════════════════
// STOCK MODAL — Add vs Refill toggle
// ════════════════════════════════════════════════════════════════
function setupStockModalLogic() {
    const typeSelect    = document.getElementById('stockActionType');
    const addSection    = document.getElementById('addStockSection');
    const refillSection = document.getElementById('refillStockSection');
    const refillSel     = document.getElementById('refillFeedSelect');
    if (!typeSelect) return;

    typeSelect.addEventListener('change', function () {
        if (this.value === 'refill') {
            addSection.style.display    = 'none';
            refillSection.style.display = 'block';
        } else {
            addSection.style.display    = 'block';
            refillSection.style.display = 'none';
        }
        updateTotalStockCost();
    });

    if (refillSel) {
        refillSel.addEventListener('change', function () {
            const opt = this.options[this.selectedIndex];
            const cpk = document.getElementById('refillCostPerKg');
            if (cpk && opt.dataset.cost) cpk.value = opt.dataset.cost;
            updateRefillTotal();
        });
    }

    ['refillQuantity', 'refillCostPerKg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateRefillTotal);
    });
}

function updateRefillTotal() {
    const qty = parseFloat(document.getElementById('refillQuantity')?.value || 0);
    const cpk = parseFloat(document.getElementById('refillCostPerKg')?.value || 0);
    const el  = document.getElementById('refillTotalCost');
    if (el) el.textContent = `₹${formatNumber(qty * cpk)}`;
}

// ════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════════════
function setupEventListeners() {
    on('applyRangeBtn', 'click', function () {
        const from = document.getElementById('rangeFrom').value;
        const to   = document.getElementById('rangeTo').value;
        if (!from || !to) { showNotification('Please select both dates', 'error'); return; }
        if (new Date(from) > new Date(to)) { showNotification('From cannot be after To', 'error'); return; }
        currentDateRange.from = from;
        currentDateRange.to   = to;
        currentPage = 1;
        loadAllData();
    });

    on('filterFeedType', 'change', () => { currentFeedTypeFilter = document.getElementById('filterFeedType').value; currentPage = 1; loadFeedHistory(); });
    on('filterCattle',   'change', () => { currentCattleFilter   = document.getElementById('filterCattle').value;   currentPage = 1; loadFeedHistory(); });

    on('feedType',     'change', updateStockAndCost);
    on('feedQuantity', 'input',  updateStockAndCost);

    onModal('addFeedBtn', 'addFeedModal', 'closeModal', 'cancelBtn');
    on('feedForm', 'submit', handleAddFeed);

    on('generateReportBtn', 'click', () => { show('reportModal'); setVal('reportFrom', currentDateRange.from); setVal('reportTo', currentDateRange.to); });
    on('closeReportModal',  'click', () => hide('reportModal'));
    on('cancelReportBtn',   'click', () => hide('reportModal'));
    on('downloadPdfBtn',    'click', handleGenerateReport);
    overlay('reportModal');

    on('addFeedStockBtn', 'click', () => { show('addFeedStockModal'); populateFeedDropdowns(); });
    on('closeStockModal',  'click', closeStockModal);
    on('cancelStockBtn',   'click', closeStockModal);
    on('feedStockForm',    'submit', handleAddFeedStock);
    overlay('addFeedStockModal');

    on('stockQuantity',  'input', updateTotalStockCost);
    on('stockCostPerKg', 'input', updateTotalStockCost);
}

function on(id, ev, fn) { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); }
function show(id) { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function hide(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }
function overlay(modalId) {
    const m = document.getElementById(modalId);
    if (m) { const ov = m.querySelector('.modal-overlay'); if (ov) ov.addEventListener('click', () => hide(modalId)); }
}
function onModal(btnId, modalId, closeId, cancelId) {
    on(btnId,    'click', () => { show(modalId); setVal('feedDate', formatDate(new Date())); });
    on(closeId,  'click', () => { hide(modalId); resetFeedForm(); });
    on(cancelId, 'click', () => { hide(modalId); resetFeedForm(); });
    overlay(modalId);
}
function closeStockModal() { hide('addFeedStockModal'); document.getElementById('feedStockForm')?.reset(); resetStockForm(); }

function updateStockAndCost() {
    const sel   = document.getElementById('feedType');
    const qty   = parseFloat(document.getElementById('feedQuantity')?.value || 0);
    const opt   = sel?.options[sel.selectedIndex];
    const stock = opt?.dataset.quantity || 0;
    const cpk   = opt?.dataset.cost || 0;
    setInner('stockHint', sel?.value ? `Available: ${parseFloat(stock).toFixed(1)} kg` : 'Available: -- kg');
    setInner('estimatedCost', `₹${formatNumber(qty * parseFloat(cpk))}`);
}
function setInner(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function resetFeedForm() { setInner('stockHint', 'Available: -- kg'); setInner('estimatedCost', '₹0.00'); }
function resetStockForm() {
    setInner('totalStockCost', '₹0.00');
    setInner('refillTotalCost', '₹0.00');
    const t = document.getElementById('stockActionType');
    if (t) {
        t.value = 'add';
        document.getElementById('addStockSection').style.display    = 'block';
        document.getElementById('refillStockSection').style.display = 'none';
    }
}
function updateTotalStockCost() {
    const qty = parseFloat(document.getElementById('stockQuantity')?.value || 0);
    const cpk = parseFloat(document.getElementById('stockCostPerKg')?.value || 0);
    setInner('totalStockCost', `₹${formatNumber(qty * cpk)}`);
}

// ════════════════════════════════════════════════════════════════
// LOAD ALL DATA
// ════════════════════════════════════════════════════════════════
function loadAllData() {
    loadMetrics();
    loadUsageTimeline();
    loadTypeDistribution();
    loadFeedHistory();
}

async function loadMetrics() {
    try {
        const data = await fetchJSON(`/api/feed/metrics?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`);
        setInner('totalFeedUsed',  `${formatNumber(data.total_feed_used)} kg`);
        setInner('totalFeedCost',  `₹${formatNumber(data.total_feed_cost)}`);
        setInner('avgPerCattle',   `${formatNumber(data.avg_per_cattle)} kg`);
        setInner('lowStockAlerts', data.low_stock_alerts);
    } catch (e) { console.error('Metrics error:', e); }
}

async function loadUsageTimeline() {
    try {
        const data = await fetchJSON(`/api/feed/usage-timeline?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`);
        const lbl = document.getElementById('timelinePeriodLabel');
        if (lbl) lbl.textContent = `${formatDateDisplay(data.date_range.from)} – ${formatDateDisplay(data.date_range.to)}`;
        renderBarChart(data.timeline);
    } catch (e) { console.error('Timeline error:', e); }
}

async function loadTypeDistribution() {
    try {
        const data = await fetchJSON(`/api/feed/type-distribution?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`);
        const lbl = document.getElementById('piePeriodLabel');
        if (lbl) lbl.textContent = `${formatDateDisplay(data.date_range.from)} – ${formatDateDisplay(data.date_range.to)}`;
        renderFeedTypeDonut(data.distribution);
    } catch (e) { console.error('Distribution error:', e); }
}

async function loadFeedHistory() {
    try {
        const data = await fetchJSON(
            `/api/feed/history?page=${currentPage}&per_page=${perPage}` +
            `&feed_type=${currentFeedTypeFilter}&cattle=${currentCattleFilter}` +
            `&from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`
        );
        renderFeedHistoryTable(data.history);
        renderPagination(data.pagination, 'feedPaginationInfo', 'feedPaginationControls', goToPage);
    } catch (e) {
        console.error('History error:', e);
        document.getElementById('feedTableBody').innerHTML = '<tr><td colspan="5" class="no-data">Failed to load feed history</td></tr>';
    }
}

// ════════════════════════════════════════════════════════════════
// STOCK TABLE
// ════════════════════════════════════════════════════════════════
async function loadStockTable() {
    try {
        const res = await fetch('/api/feed/stock-list-full');
        if (res.ok) {
            const data = await res.json();
            renderStockTable(data.feeds || [], stockPage);
        } else {
            // fallback
            const res2  = await fetch('/feed/stock-list');
            const data2 = await res2.json();
            const mapped = (data2.feeds || data2.stock_list || []).map(f => ({
                id: f.id, feed_name: f.feed_name || f.name,
                quantity: f.quantity, min_quantity: f.min_quantity || 0, cost_per_kg: f.cost_per_kg
            }));
            renderStockTable(mapped, stockPage);
        }
    } catch (e) { console.error('Stock table error:', e); }
}

function renderStockTable(feeds, page) {
    const tbody      = document.getElementById('stockTableBody');
    const total      = feeds.length;
    const totalPages = Math.max(1, Math.ceil(total / stockPerPage));
    stockPage        = Math.max(1, Math.min(page, totalPages));

    const start = (stockPage - 1) * stockPerPage;
    const slice = feeds.slice(start, start + stockPerPage);

    if (!slice.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No feed stock found. Add your first stock above.</td></tr>';
    } else {
        tbody.innerHTML = slice.map(f => {
            const qty    = parseFloat(f.quantity)     || 0;
            const minQty = parseFloat(f.min_quantity) || 0;
            const cpk    = parseFloat(f.cost_per_kg)  || 0;
            const isLow  = qty <= minQty;
            const badge  = isLow
                ? '<span class="stock-badge low">Low Stock</span>'
                : '<span class="stock-badge ok">In Stock</span>';
            const name = (f.feed_name || f.name || '—').replace(/'/g, "\\'");
            return `<tr>
                <td><span class="feed-name-cell">${name}</span></td>
                <td>${formatNumber(qty)} kg</td>
                <td>${formatNumber(minQty)} kg</td>
                <td>₹${formatNumber(cpk)}</td>
                <td>${badge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn edit-action-btn" title="Refill Stock"
                            onclick="openRefillQuick(${f.id}, '${name}', ${cpk})">
                            <span class="material-symbols-outlined">add_circle</span>
                        </button>
                        <button class="action-btn delete-action-btn" title="Delete Stock"
                            onclick="deleteFeedStock(${f.id}, '${name}')">
                            <span class="material-symbols-outlined">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    renderPagination(
        { page: stockPage, per_page: stockPerPage, total, total_pages: totalPages },
        'stockPaginationInfo', 'stockPaginationControls', goToStockPage
    );

    window._stockFeeds = feeds;
}

function openRefillQuick(id, name, cpk) {
    show('addFeedStockModal');
    populateFeedDropdowns();
    setTimeout(() => {
        const t = document.getElementById('stockActionType');
        if (t) { t.value = 'refill'; t.dispatchEvent(new Event('change')); }
        const sel = document.getElementById('refillFeedSelect');
        if (sel) { sel.value = id; sel.dispatchEvent(new Event('change')); }
        const cpkEl = document.getElementById('refillCostPerKg');
        if (cpkEl) cpkEl.value = cpk;
    }, 50);
}

async function deleteFeedStock(id, name) {
    if (!confirm(`Delete "${name}" stock?\n\nThis will also remove related expense entries.`)) return;
    try {
        const res  = await fetch(`/api/feed/delete-stock/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        showNotification(`"${name}" deleted`, 'success');
        await loadDropdownData();
        loadAllData();
        loadStockTable();
    } catch (err) { showNotification(err.message, 'error'); }
}

// ════════════════════════════════════════════════════════════════
// BAR CHART — matches dashboard style exactly
// Last bar highlighted, same opacity/color as dashboard
// ════════════════════════════════════════════════════════════════
function renderBarChart(timelineData) {
    const ctx = document.getElementById('feedUsageChart');
    if (!ctx) return;
    if (feedUsageChart) feedUsageChart.destroy();

    if (!timelineData || !timelineData.length) {
        const container = ctx.closest('.chart-container');
        if (container) container.innerHTML = '<p class="no-data">No usage data for this period</p>';
        return;
    }

    const from     = new Date(currentDateRange.from);
    const to       = new Date(currentDateRange.to);
    const diffDays = (to - from) / (1000 * 60 * 60 * 24);

    const labels = timelineData.map(item => {
        const d = new Date(item.date + 'T00:00:00');
        if (diffDays <= 31)  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        if (diffDays <= 365) return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
        return d.getFullYear().toString();
    });

    const values  = timelineData.map(i => i.quantity);
    const lastIdx = values.length - 1;

    feedUsageChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                // Matches dashboard: last bar is 0.75, others 0.2
                backgroundColor: values.map((_, i) =>
                    i === lastIdx ? 'rgba(102,126,234,0.75)' : 'rgba(102,126,234,0.2)'
                ),
                hoverBackgroundColor: values.map((_, i) =>
                    i === lastIdx ? 'rgba(102,126,234,0.9)' : 'rgba(102,126,234,0.45)'
                ),
                borderRadius: { topLeft: 8, topRight: 8 },
                barPercentage: 0.75,
                categoryPercentage: 0.85
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12, cornerRadius: 8,
                    titleColor: '#f3f4f6', bodyColor: '#f3f4f6',
                    displayColors: false,
                    titleFont: { family: 'Lexend', weight: '700' },
                    bodyFont:  { family: 'Lexend' },
                    callbacks: {
                        label: ctx => ctx.parsed.y.toFixed(1) + ' kg'
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false }, border: { display: false },
                    ticks: {
                        font: { family: 'Lexend', size: 9, weight: '600' },
                        color: '#6b7280',
                        maxRotation: 0,
                        minRotation: 0
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' }, border: { display: false },
                    ticks: { display: false }
                }
            },
            animation: { duration: 700, easing: 'easeInOutQuart' }
        }
    });
}

// ════════════════════════════════════════════════════════════════
// DONUT CHART
// ════════════════════════════════════════════════════════════════
function renderFeedTypeDonut(distributionData) {
    const ctx = document.getElementById('feedTypeDonut');
    if (!ctx) return;
    if (feedTypeDonutChart) feedTypeDonutChart.destroy();

    if (!distributionData || !distributionData.length) {
        const container = ctx.closest('.pie-container');
        if (container) container.innerHTML = '<p class="no-data">No feed usage data for this period</p>';
        return;
    }

    const labels = distributionData.map(i => i.label);
    const values = distributionData.map(i => i.value);
    const colors = COLORS.pieColors.slice(0, distributionData.length);
    const total  = values.reduce((a, b) => a + b, 0);

    feedTypeDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: values, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 1,
            cutout: '58%',
            layout: { padding: 40 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12, cornerRadius: 8,
                    titleColor: '#f3f4f6', bodyColor: '#f3f4f6',
                    displayColors: false,
                    titleFont: { family: 'Lexend', weight: '700' },
                    bodyFont:  { family: 'Lexend' },
                    callbacks: {
                        label: ctx => {
                            const pct = ((ctx.parsed / total) * 100).toFixed(1);
                            return `${ctx.label}: ${formatNumber(ctx.parsed)} kg (${pct}%)`;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'sliceLabels',
            afterDatasetDraw(chart) {
                const { ctx: c, data } = chart;
                const ds   = data.datasets[0];
                const meta = chart.getDatasetMeta(0);
                c.save();
                meta.data.forEach((arc, i) => {
                    const pct    = (ds.data[i] / total) * 100;
                    const angle  = (arc.startAngle + arc.endAngle) / 2;
                    const outerR = arc.outerRadius;
                    const innerR = arc.innerRadius;
                    const midR   = (outerR + innerR) / 2;

                    if (pct >= 8) {
                        const ix = arc.x + Math.cos(angle) * midR;
                        const iy = arc.y + Math.sin(angle) * midR;
                        c.fillStyle = '#fff';
                        c.font = 'bold 11px Lexend,sans-serif';
                        c.textAlign = 'center'; c.textBaseline = 'middle';
                        c.fillText(`${pct.toFixed(1)}%`, ix, iy);
                    }

                    const labelR = outerR + 24;
                    const lx     = arc.x + Math.cos(angle) * labelR;
                    const ly     = arc.y + Math.sin(angle) * labelR;
                    const isRight = lx >= arc.x;

                    c.strokeStyle = colors[i]; c.lineWidth = 1.5; c.globalAlpha = 0.7;
                    c.beginPath();
                    c.moveTo(arc.x + Math.cos(angle) * (outerR + 4), arc.y + Math.sin(angle) * (outerR + 4));
                    c.lineTo(arc.x + Math.cos(angle) * (outerR + 18), arc.y + Math.sin(angle) * (outerR + 18));
                    c.stroke();
                    c.globalAlpha = 1;

                    c.fillStyle = '#1f2937';
                    c.font = '600 10px Lexend,sans-serif';
                    c.textAlign = isRight ? 'left' : 'right';
                    c.textBaseline = 'middle';
                    c.fillText(labels[i], lx, ly);
                });
                c.restore();
            }
        }]
    });

    renderDonutLegend(distributionData, colors, total);
}

function renderDonutLegend(distributionData, colors, total) {
    const el = document.getElementById('donutLegend');
    if (!el) return;
    el.innerHTML = distributionData.map((item, i) => {
        const pct = ((item.value / total) * 100).toFixed(1);
        return `<div class="legend-item">
            <span class="legend-color" style="background:${colors[i]}"></span>
            <span class="legend-label">${item.label}</span>
            <span class="legend-value">${pct}%</span>
        </div>`;
    }).join('');
}

// ════════════════════════════════════════════════════════════════
// FEED HISTORY TABLE
// ════════════════════════════════════════════════════════════════
function renderFeedHistoryTable(history) {
    const tbody = document.getElementById('feedTableBody');
    if (!history || !history.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No feed history for this period</td></tr>';
        return;
    }
    tbody.innerHTML = history.map(r => `
        <tr>
            <td>${formatDateDisplay(r.date)}</td>
            <td>${r.cattle_name}</td>
            <td><span class="category-badge">${r.feed_type}</span></td>
            <td>${formatNumber(r.quantity)} kg</td>
            <td>₹${formatNumber(r.cost)}</td>
        </tr>`).join('');
}

// ════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════
const _paginationCallbacks = {};

function renderPagination(pg, infoId, ctrlId, onPage) {
    const infoEl = document.getElementById(infoId);
    const ctrlEl = document.getElementById(ctrlId);
    if (!infoEl || !ctrlEl) return;

    _paginationCallbacks[ctrlId] = onPage;

    const start = (pg.page - 1) * pg.per_page + 1;
    const end   = Math.min(pg.page * pg.per_page, pg.total);
    infoEl.textContent = pg.total ? `Showing ${start}–${end} of ${pg.total} records` : 'No records';

    if (pg.total_pages <= 1) { ctrlEl.innerHTML = ''; return; }

    const cb = `_paginationCallbacks['${ctrlId}']`;
    let html = `<button class="page-btn" ${pg.page === 1 ? 'disabled' : ''} onclick="${cb}(${pg.page - 1})">
        <span class="material-symbols-outlined">chevron_left</span></button>`;

    const max = 5;
    const sp  = Math.max(1, pg.page - Math.floor(max / 2));
    const ep  = Math.min(pg.total_pages, sp + max - 1);

    if (sp > 1) { html += `<button class="page-btn" onclick="${cb}(1)">1</button>`; if (sp > 2) html += '<span style="padding:0 .5rem">…</span>'; }
    for (let i = sp; i <= ep; i++) html += `<button class="page-btn ${i === pg.page ? 'active' : ''}" onclick="${cb}(${i})">${i}</button>`;
    if (ep < pg.total_pages) { if (ep < pg.total_pages - 1) html += '<span style="padding:0 .5rem">…</span>'; html += `<button class="page-btn" onclick="${cb}(${pg.total_pages})">${pg.total_pages}</button>`; }
    html += `<button class="page-btn" ${pg.page === pg.total_pages ? 'disabled' : ''} onclick="${cb}(${pg.page + 1})">
        <span class="material-symbols-outlined">chevron_right</span></button>`;
    ctrlEl.innerHTML = html;
}

function goToPage(p) { currentPage = p; loadFeedHistory(); }
function goToStockPage(p) { if (window._stockFeeds) renderStockTable(window._stockFeeds, p); }

// ════════════════════════════════════════════════════════════════
// ADD FEED ENTRY
// ════════════════════════════════════════════════════════════════
async function handleAddFeed(e) {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent; btn.textContent = 'Adding…'; btn.disabled = true;
    try {
        const res = await fetch('/api/feed/add-entry', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                date:      document.getElementById('feedDate').value,
                cattle_id: document.getElementById('feedCattle').value || null,
                feed_id:   document.getElementById('feedType').value,
                quantity:  parseFloat(document.getElementById('feedQuantity').value)
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');
        showNotification('Feed entry added successfully', 'success');
        hide('addFeedModal'); e.target.reset(); resetFeedForm();
        await loadDropdownData(); loadAllData(); loadStockTable();
    } catch (err) { showNotification(err.message, 'error'); }
    finally { btn.textContent = orig; btn.disabled = false; }
}

// ════════════════════════════════════════════════════════════════
// ADD / REFILL FEED STOCK
// ════════════════════════════════════════════════════════════════
async function handleAddFeedStock(e) {
    e.preventDefault();
    const btn  = e.target.querySelector('button[type="submit"]');
    const orig = btn.textContent; btn.textContent = 'Saving…'; btn.disabled = true;

    try {
        const actionType = document.getElementById('stockActionType').value;
        let body, feedName, qty, cpk;

        if (actionType === 'refill') {
            const feedId = document.getElementById('refillFeedSelect').value;
            qty  = parseFloat(document.getElementById('refillQuantity').value);
            cpk  = parseFloat(document.getElementById('refillCostPerKg').value);
            if (!feedId || !qty || !cpk) throw new Error('Please fill all refill fields');
            const opt = document.getElementById('refillFeedSelect').options[document.getElementById('refillFeedSelect').selectedIndex];
            feedName = opt.textContent.split(' (')[0];
            body = { feed_name: feedName, quantity: qty, min_quantity: 0, cost_per_kg: cpk, is_refill: true, refill_feed_id: feedId };
        } else {
            feedName      = document.getElementById('stockFeedName').value;
            qty           = parseFloat(document.getElementById('stockQuantity').value);
            const minQty  = parseFloat(document.getElementById('stockMinQuantity').value);
            cpk           = parseFloat(document.getElementById('stockCostPerKg').value);
            body = { feed_name: feedName, quantity: qty, min_quantity: minQty, cost_per_kg: cpk };
        }

        const res  = await fetch('/api/feed/add-stock', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed');

        showNotification(`${data.message || 'Stock updated'} — ₹${formatNumber(qty * cpk)} logged to expenses`, 'success');
        closeStockModal(); e.target.reset(); resetStockForm();
        await loadDropdownData(); loadAllData(); loadStockTable();
    } catch (err) { showNotification(err.message, 'error'); }
    finally { btn.textContent = orig; btn.disabled = false; }
}

// ════════════════════════════════════════════════════════════════
// GENERATE PDF REPORT
// ════════════════════════════════════════════════════════════════
async function handleGenerateReport() {
    const btn  = document.getElementById('downloadPdfBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Generating…';
    btn.disabled = true;
    try {
        const from = document.getElementById('reportFrom').value;
        const to   = document.getElementById('reportTo').value;
        if (!from || !to) throw new Error('Please select both dates');
        if (new Date(from) > new Date(to)) throw new Error('From cannot be after To');

        const [reportData, stockRes] = await Promise.all([
            fetchJSON(`/api/feed/report-data?from_date=${from}&to_date=${to}`),
            fetch('/api/feed/stock-list-full').then(r => r.ok ? r.json() : fetch('/feed/stock-list').then(r2 => r2.json()))
        ]);

        const stockFeeds = stockRes.feeds || (stockRes.stock_list || []).map(f => ({
            feed_name: f.feed_name || f.name, quantity: f.quantity, min_quantity: 0, cost_per_kg: f.cost_per_kg
        }));

        generatePDF(reportData, stockFeeds);
        hide('reportModal');
        showNotification('Report generated successfully', 'success');
    } catch (err) { showNotification(err.message, 'error'); }
    finally { btn.innerHTML = orig; btn.disabled = false; }
}

function generatePDF(data, stockFeeds) {
    const { jsPDF } = window.jspdf;
    const doc    = new jsPDF();
    const indigo = [102, 126, 234];

    // Header stripe
    doc.setFillColor(...indigo);
    doc.rect(0, 0, 210, 2, 'F');

    doc.setFontSize(20); doc.setTextColor(...indigo);
    doc.text('Cattle-Cloud — Feed Management Report', 14, 22);
    doc.setFontSize(10); doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${formatDateDisplay(data.date_range.from)} → ${formatDateDisplay(data.date_range.to)}`, 14, 30);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 36);

    doc.setFontSize(13); doc.setTextColor(31, 41, 55);
    doc.text('Summary', 14, 48);
    doc.setFontSize(10);
    doc.setTextColor(34, 197, 94);  doc.text(`Total Feed Used: ${formatNumber(data.summary.total_quantity)} kg`, 14, 56);
    doc.setTextColor(239, 68, 68);  doc.text(`Total Cost: ₹${formatNumber(data.summary.total_cost)}`, 14, 63);
    doc.setTextColor(107, 114, 128); doc.text(`Total Records: ${data.summary.record_count}`, 14, 70);

    let y = 82;

    if (data.breakdown?.length) {
        doc.setFontSize(12); doc.setTextColor(31, 41, 55);
        doc.text('Feed Type Breakdown', 14, y); y += 6;
        doc.autoTable({
            startY: y,
            head: [['Feed Type', 'Quantity (kg)', 'Total Cost']],
            body: data.breakdown.map(r => [r.feed_name, formatNumber(r.quantity) + ' kg', '₹' + formatNumber(r.cost)]),
            headStyles: { fillColor: indigo, textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: 50 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    if (stockFeeds?.length) {
        doc.setFontSize(12); doc.setTextColor(31, 41, 55);
        doc.text('Current Feed Stock', 14, y); y += 6;
        doc.autoTable({
            startY: y,
            head: [['Feed Name', 'Qty (kg)', 'Min Qty', 'Cost/kg', 'Status']],
            body: stockFeeds.map(f => [
                f.feed_name || f.name,
                formatNumber(f.quantity),
                formatNumber(f.min_quantity || 0),
                '₹' + formatNumber(f.cost_per_kg),
                parseFloat(f.quantity) <= parseFloat(f.min_quantity || 0) ? '⚠ Low Stock' : '✓ OK'
            ]),
            headStyles: { fillColor: [34, 197, 94], textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: 50 },
            alternateRowStyles: { fillColor: [240, 253, 244] },
            margin: { left: 14, right: 14 }
        });
        y = doc.lastAutoTable.finalY + 12;
    }

    if (data.history?.length) {
        doc.setFontSize(12); doc.setTextColor(31, 41, 55);
        doc.text('Detailed Feed History', 14, y); y += 6;
        doc.autoTable({
            startY: y,
            head: [['Date', 'Cattle', 'Feed Type', 'Quantity', 'Cost']],
            body: data.history.map(r => [formatDateDisplay(r.date), r.cattle_name, r.feed_type, formatNumber(r.quantity) + ' kg', '₹' + formatNumber(r.cost)]),
            headStyles: { fillColor: indigo, textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: 50 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: 14, right: 14 }
        });
    }

    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i); doc.setFontSize(8); doc.setTextColor(156, 163, 175);
        doc.text(`Page ${i} of ${pages}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`cattle-cloud-feed-report-${data.date_range.from}-to-${data.date_range.to}.pdf`);
}

// ════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════
async function fetchJSON(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

function formatNumber(n) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function showNotification(message, type = 'info') {
    const colors = { success: '#22c55e', error: '#ef4444', info: '#667eea' };
    const icons  = { success: 'check_circle', error: 'error', info: 'info' };
    const c  = colors[type] || colors.info;
    const ic = icons[type]  || icons.info;

    const t = document.createElement('div');
    t.style.cssText = [
        'position:fixed', 'top:20px', 'right:20px', 'z-index:9999',
        'background:#fff', 'padding:.875rem 1.25rem', 'border-radius:10px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
        'display:flex', 'align-items:center', 'gap:.75rem',
        "font-family:'Lexend',sans-serif", 'font-weight:500', 'font-size:.9375rem',
        `border-left:4px solid ${c}`, `color:${c}`,
        'transform:translateX(420px)', 'opacity:0',
        'transition:all .3s ease', 'max-width:340px'
    ].join(';');
    t.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${ic}</span><span>${message}</span>`;
    document.body.appendChild(t);

    setTimeout(() => { t.style.transform = 'translateX(0)'; t.style.opacity = '1'; }, 10);
    setTimeout(() => {
        t.style.transform = 'translateX(420px)'; t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}

window.addEventListener('resize', () => { if (feedUsageChart) feedUsageChart.resize(); });