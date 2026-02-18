// ════════════════════════════════════════════════════════════════
// CATTLE-CLOUD — expenses.js
// ════════════════════════════════════════════════════════════════

let cashFlowChart = null;
let revenueDonutChart = null;
let currentPage = 1;
const perPage = 10;
let currentFilter = 'all';
let currentDateRange = { from: null, to: null };

const COLORS = {
    revenue: '#667aea',
    expenses: '#ef4444',
    pieColors: [
        '#10b981', // Milk Sales — green
        '#ef4444', // Feed — red
        '#f59e0b', // Health / Veterinary — amber
        '#667aea', // Labor — indigo
        '#8b5cf6', // Equipment — violet
        '#ec4899', // Utilities — pink
        '#14b8a6', // Maintenance — teal
        '#f97316', // Other — orange
        '#06b6d4', // extra
        '#84cc16', // extra
        '#a855f7', // extra
        '#764ba2', // extra
    ]
};

// ════════════════════════════════════════════════════════════════
// OUTER LABEL PLUGIN for Chart.js doughnut
// Draws label lines + text outside each slice
// ════════════════════════════════════════════════════════════════
const outerLabelPlugin = {
    id: 'outerLabels',
    afterDraw(chart) {
        if (chart.config.type !== 'doughnut') return;
        const { ctx, chartArea, data } = chart;
        const dataset = data.datasets[0];
        const total = dataset.data.reduce((a, b) => a + b, 0);
        if (!total) return;

        const meta = chart.getDatasetMeta(0);
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        const outerRadius = meta.data[0]?.outerRadius || 100;

        // How far the leader line goes beyond the arc
        const lineLen1 = 14;  // first segment (from arc)
        const lineLen2 = 22;  // second segment (horizontal)

        ctx.save();

        meta.data.forEach((arc, i) => {
            const pct = (dataset.data[i] / total) * 100;
            if (pct < 2) return; // skip tiny slices to avoid clutter

            const startAngle = arc.startAngle;
            const endAngle   = arc.endAngle;
            const midAngle   = (startAngle + endAngle) / 2;

            const cos = Math.cos(midAngle);
            const sin = Math.sin(midAngle);

            // Point on the arc edge
            const x1 = cx + (outerRadius + 4) * cos;
            const y1 = cy + (outerRadius + 4) * sin;

            // End of first line segment
            const x2 = cx + (outerRadius + lineLen1) * cos;
            const y2 = cy + (outerRadius + lineLen1) * sin;

            // End of horizontal segment (left or right depending on side)
            const isRight = cos >= 0;
            const x3 = x2 + (isRight ? lineLen2 : -lineLen2);
            const y3 = y2;

            const color = COLORS.pieColors[i % COLORS.pieColors.length];
            const label = data.labels[i];
            const pctText = pct.toFixed(1) + '%';

            // Leader line
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.lineTo(x3, y3);
            ctx.strokeStyle = color;
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Dot at arc
            ctx.beginPath();
            ctx.arc(x1, y1, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            // Label text
            const textAlign = isRight ? 'left' : 'right';
            const textX = isRight ? x3 + 5 : x3 - 5;

            ctx.textAlign = textAlign;
            ctx.textBaseline = 'middle';

            // Category name (bold, slightly larger)
            ctx.font = 'bold 10px Lexend, sans-serif';
            ctx.fillStyle = '#1f2937';
            ctx.fillText(label, textX, y3 - 7);

            // Percentage (lighter)
            ctx.font = '9px Lexend, sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(pctText, textX, y3 + 5);
        });

        ctx.restore();
    }
};

// Register the plugin globally
Chart.register(outerLabelPlugin);

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function () {
    initializeDateInputs();
    loadAllData();
    setupEventListeners();
    setupLogout();
});

function initializeDateInputs() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const fromDate = formatDate(firstDay);
    const toDate = formatDate(today);

    currentDateRange.from = fromDate;
    currentDateRange.to = toDate;

    setVal('rangeFrom', fromDate);
    setVal('rangeTo', toDate);
    setVal('reportFrom', fromDate);
    setVal('reportTo', toDate);
}

function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = val;
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateDisplay(dateStr) {
    if (!dateStr || dateStr === '—') return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getChartTypeAndGrouping(fromDate, toDate) {
    const from = new Date(fromDate);
    const to   = new Date(toDate);
    const diffDays   = Math.ceil(Math.abs(to - from) / (1000 * 60 * 60 * 24));
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    if (diffDays <= 31)   return { type: 'line', grouping: 'daily' };
    if (diffMonths <= 12) return { type: 'bar',  grouping: 'monthly' };
    return { type: 'bar', grouping: 'yearly' };
}

// ════════════════════════════════════════════════════════════════
// LOGOUT — Bootstrap modal confirm
// ════════════════════════════════════════════════════════════════
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            const logoutModal = document.getElementById('logoutModal');
            if (logoutModal && typeof bootstrap !== 'undefined') {
                new bootstrap.Modal(logoutModal).show();
            }
        });
    }
}

// ════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════════════
function setupEventListeners() {
    const applyRangeBtn = document.getElementById('applyRangeBtn');
    if (applyRangeBtn) {
        applyRangeBtn.addEventListener('click', function () {
            const from = document.getElementById('rangeFrom').value;
            const to   = document.getElementById('rangeTo').value;
            if (!from || !to) { showNotification('Please select both dates', 'error'); return; }
            if (new Date(from) > new Date(to)) { showNotification('From date cannot be after To date', 'error'); return; }
            currentDateRange.from = from;
            currentDateRange.to   = to;
            currentPage = 1;
            loadAllData();
        });
    }

    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', function () {
            currentFilter = this.value;
            currentPage = 1;
            loadTransactions();
        });
    }

    // Add Expense Modal
    const addExpenseBtn   = document.getElementById('addExpenseBtn');
    const addExpenseModal = document.getElementById('addExpenseModal');
    const closeModal      = document.getElementById('closeModal');
    const cancelBtn       = document.getElementById('cancelBtn');
    const expenseForm     = document.getElementById('expenseForm');

    if (addExpenseBtn && addExpenseModal) {
        addExpenseBtn.addEventListener('click', () => {
            addExpenseModal.classList.add('show');
            document.getElementById('expenseDate').value = formatDate(new Date());
        });
    }
    if (closeModal) closeModal.addEventListener('click', () => { addExpenseModal.classList.remove('show'); expenseForm.reset(); });
    if (cancelBtn)  cancelBtn.addEventListener('click',  () => { addExpenseModal.classList.remove('show'); expenseForm.reset(); });
    if (addExpenseModal) {
        addExpenseModal.querySelector('.modal-overlay').addEventListener('click', () => { addExpenseModal.classList.remove('show'); expenseForm.reset(); });
    }
    if (expenseForm) expenseForm.addEventListener('submit', handleAddExpense);

    // Report Modal
    const generateReportBtn = document.getElementById('generateReportBtn');
    const reportModal       = document.getElementById('reportModal');
    const closeReportModal  = document.getElementById('closeReportModal');
    const cancelReportBtn   = document.getElementById('cancelReportBtn');
    const downloadPdfBtn    = document.getElementById('downloadPdfBtn');

    if (generateReportBtn && reportModal) {
        generateReportBtn.addEventListener('click', () => {
            reportModal.classList.add('show');
            setVal('reportFrom', currentDateRange.from);
            setVal('reportTo',   currentDateRange.to);
        });
    }
    if (closeReportModal) closeReportModal.addEventListener('click', () => reportModal.classList.remove('show'));
    if (cancelReportBtn)  cancelReportBtn.addEventListener('click',  () => reportModal.classList.remove('show'));
    if (reportModal) {
        reportModal.querySelector('.modal-overlay').addEventListener('click', () => reportModal.classList.remove('show'));
    }
    if (downloadPdfBtn) downloadPdfBtn.addEventListener('click', handleGenerateReport);
}

// ════════════════════════════════════════════════════════════════
// DATA LOADING
// ════════════════════════════════════════════════════════════════
function loadAllData() {
    loadMetrics();
    loadCashFlow();
    loadMoneyBreakdown();
    loadTransactions();
}

async function loadMetrics() {
    try {
        const url = `/api/expenses/metrics?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        document.getElementById('totalRevenue').textContent  = `₹${formatNumber(data.total_revenue)}`;
        document.getElementById('totalExpenses').textContent = `₹${formatNumber(data.total_expenses)}`;
        document.getElementById('netProfit').textContent     = `₹${formatNumber(data.net_profit)}`;

        const milk      = data.milk_sold;
        const milkEl    = document.getElementById('milkSoldValue');
        const milkSubEl = document.getElementById('milkSoldSub');
        if (milkEl)    milkEl.textContent    = `${formatNum(milk.liters)}L`;
        if (milkSubEl) milkSubEl.textContent = milk.avg_rate > 0
            ? `Avg ₹${formatNum(milk.avg_rate)}/L this period`
            : 'No milk sales this period';

        const profitChange = document.getElementById('profitChange');
        const profitIcon   = profitChange.querySelector('.material-symbols-outlined');
        if (data.net_profit > 0) {
            profitChange.className    = 'metric-change positive';
            profitIcon.textContent    = 'arrow_upward';
        } else if (data.net_profit < 0) {
            profitChange.className    = 'metric-change negative';
            profitIcon.textContent    = 'arrow_downward';
        } else {
            profitChange.className    = 'metric-change neutral';
            profitIcon.textContent    = 'remove';
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
        showNotification('Failed to load financial metrics', 'error');
    }
}

async function loadCashFlow() {
    try {
        const url = `/api/expenses/cashflow?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const periodLabel = document.getElementById('cashFlowPeriodLabel');
        if (periodLabel) {
            periodLabel.textContent = `${formatDateDisplay(data.date_range.from)} – ${formatDateDisplay(data.date_range.to)}`;
        }

        renderCashFlowChart(data.cash_flow);
    } catch (error) {
        console.error('Error loading cash flow:', error);
    }
}

async function loadMoneyBreakdown() {
    try {
        const url = `/api/expenses/money-breakdown?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        const periodLabel = document.getElementById('piePeriodLabel');
        if (periodLabel) {
            periodLabel.textContent = `${formatDateDisplay(data.date_range.from)} – ${formatDateDisplay(data.date_range.to)}`;
        }

        renderRevenueDonut(data.breakdown);
    } catch (error) {
        console.error('Error loading money breakdown:', error);
    }
}

async function loadTransactions() {
    try {
        const url = `/api/expenses/transactions?page=${currentPage}&per_page=${perPage}&type=${currentFilter}&from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        renderTransactionsTable(data.transactions);
        renderPagination(data.pagination);
    } catch (error) {
        console.error('Error loading transactions:', error);
        showNotification('Failed to load transactions', 'error');
        document.getElementById('transactionsTableBody').innerHTML =
            '<tr><td colspan="5" class="no-data">Failed to load transactions</td></tr>';
    }
}

// ════════════════════════════════════════════════════════════════
// CASH FLOW CHART
// ════════════════════════════════════════════════════════════════
function renderCashFlowChart(cashFlowData) {
    const ctx = document.getElementById('cashFlowChart');
    if (!ctx) return;
    if (cashFlowChart) cashFlowChart.destroy();

    const chartConfig   = getChartTypeAndGrouping(currentDateRange.from, currentDateRange.to);
    const labels        = cashFlowData.map(item => formatDateDisplay(item.date));
    const revenueData   = cashFlowData.map(item => item.revenue);
    const expensesData  = cashFlowData.map(item => item.expenses);

    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(17,24,39,0.95)',
                padding: 12, titleColor: '#fff', bodyColor: '#fff',
                borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                callbacks: {
                    label: ctx => ctx.dataset.label + ': ₹' + formatNumber(ctx.parsed.y)
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { maxRotation: 45, minRotation: 45, font: { family: 'Lexend' } } },
            y: {
                beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: { callback: v => '₹' + formatNumber(v), font: { family: 'Lexend' } }
            }
        }
    };

    if (chartConfig.type === 'line') {
        cashFlowChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Revenue',  data: revenueData,  backgroundColor: 'rgba(102,126,234,0.1)', borderColor: COLORS.revenue,  borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6 },
                    { label: 'Expenses', data: expensesData, backgroundColor: 'rgba(239,68,68,0.1)',   borderColor: COLORS.expenses, borderWidth: 3, fill: true, tension: 0.4, pointRadius: 4, pointHoverRadius: 6 }
                ]
            },
            options: commonOptions
        });
    } else {
        cashFlowChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Revenue',  data: revenueData,  backgroundColor: COLORS.revenue,  borderRadius: 6, maxBarThickness: 50 },
                    { label: 'Expenses', data: expensesData, backgroundColor: COLORS.expenses, borderRadius: 6, maxBarThickness: 50 }
                ]
            },
            options: commonOptions
        });
    }
}

// ════════════════════════════════════════════════════════════════
// DONUT CHART — with outer labels via plugin
// ════════════════════════════════════════════════════════════════
function renderRevenueDonut(breakdownData) {
    const ctx = document.getElementById('revenueDonut');
    if (!ctx) return;
    if (revenueDonutChart) revenueDonutChart.destroy();

    const container = ctx.closest('.pie-chart-wrapper') || ctx.closest('.chart-container');

    if (!breakdownData || breakdownData.length === 0 || breakdownData.every(item => item.value === 0)) {
        if (container) container.innerHTML = '<p class="no-data" style="text-align:center;padding:2rem;color:#6b7280;">No financial data for this period</p>';
        return;
    }

    const labels = breakdownData.map(item => item.label);
    const values = breakdownData.map(item => item.value);
    const colors = breakdownData.map((_, i) => COLORS.pieColors[i % COLORS.pieColors.length]);

    revenueDonutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff',
                hoverBorderWidth: 3,
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            // Shrink the chart area so outer labels have room
            layout: {
                padding: {
                    top: 40,
                    bottom: 40,
                    left: 70,
                    right: 70
                }
            },
            cutout: '58%',
            plugins: {
                legend: { display: false },
                outerLabels: true,   // activate our custom plugin
                tooltip: {
                    backgroundColor: 'rgba(17,24,39,0.95)',
                    padding: 12, titleColor: '#fff', bodyColor: '#fff',
                    borderColor: 'rgba(255,255,255,0.1)', borderWidth: 1,
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const pct = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ₹${formatNumber(context.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });

    renderDonutLegend(breakdownData, colors);
}

function renderDonutLegend(breakdownData, colors) {
    const legendContainer = document.getElementById('donutLegend');
    if (!legendContainer) return;

    const total = breakdownData.reduce((sum, item) => sum + item.value, 0);

    legendContainer.innerHTML = breakdownData.map((item, index) => {
        const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
        const kindBadge = item.kind === 'income'
            ? '<span style="font-size:0.65rem;background:#d1fae5;color:#065f46;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:4px;">IN</span>'
            : '<span style="font-size:0.65rem;background:#fee2e2;color:#991b1b;padding:1px 5px;border-radius:4px;font-weight:700;margin-left:4px;">OUT</span>';
        return `
            <div class="legend-item">
                <span class="legend-color" style="background-color:${colors[index]}"></span>
                <span class="legend-label">${item.label}${kindBadge}</span>
                <span class="legend-value">₹${formatNumber(item.value)} <span style="color:#9ca3af;font-weight:400;">(${pct}%)</span></span>
            </div>
        `;
    }).join('');
}

// ════════════════════════════════════════════════════════════════
// TRANSACTIONS TABLE
// ════════════════════════════════════════════════════════════════
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;

    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No transactions found for this period</td></tr>';
        return;
    }

    tbody.innerHTML = transactions.map(txn => {
        const amountClass  = txn.type === 'income' ? 'amount-positive' : 'amount-negative';
        const amountPrefix = txn.type === 'income' ? '+' : '−';
        const canEdit      = txn.type === 'expense';

        return `
            <tr>
                <td>${formatDateDisplay(txn.date)}</td>
                <td>${txn.description}</td>
                <td><span class="category-badge">${txn.category}</span></td>
                <td class="${amountClass}">${amountPrefix}₹${formatNumber(txn.amount)}</td>
                <td>
                    ${canEdit ? `
                        <div class="action-btns">
                            <button class="action-btn edit-btn"
                                onclick="editTransaction(${txn.id}, '${txn.date}', '${txn.category}', \`${txn.description.replace(/`/g, "'")}\`, ${txn.amount})"
                                title="Edit">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteTransaction(${txn.id})" title="Delete">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    ` : '<span class="text-muted">—</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

window.editTransaction = function (id, date, category, description, amount) {
    showNotification('Edit functionality — coming soon', 'info');
};

window.deleteTransaction = async function (id) {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
        const response = await fetch(`/api/expenses/delete/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete');
        showNotification('Transaction deleted successfully', 'success');
        loadAllData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showNotification('Failed to delete transaction', 'error');
    }
};

// ════════════════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════════════════
function renderPagination(pagination) {
    const paginationInfo     = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    if (!paginationInfo || !paginationControls) return;

    const start = (pagination.page - 1) * pagination.per_page + 1;
    const end   = Math.min(pagination.page * pagination.per_page, pagination.total);
    paginationInfo.textContent = `Showing ${start}–${end} of ${pagination.total} transactions`;

    let html = `<button class="page-btn" ${pagination.page === 1 ? 'disabled' : ''} onclick="goToPage(${pagination.page - 1})">
        <span class="material-symbols-outlined">chevron_left</span></button>`;

    const max = 5;
    let start_ = Math.max(1, pagination.page - Math.floor(max / 2));
    let end_   = Math.min(pagination.total_pages, start_ + max - 1);
    if (end_ - start_ < max - 1) start_ = Math.max(1, end_ - max + 1);

    if (start_ > 1) {
        html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
        if (start_ > 2) html += `<span style="padding:0 .5rem">…</span>`;
    }
    for (let i = start_; i <= end_; i++) {
        html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    if (end_ < pagination.total_pages) {
        if (end_ < pagination.total_pages - 1) html += `<span style="padding:0 .5rem">…</span>`;
        html += `<button class="page-btn" onclick="goToPage(${pagination.total_pages})">${pagination.total_pages}</button>`;
    }

    html += `<button class="page-btn" ${pagination.page === pagination.total_pages ? 'disabled' : ''} onclick="goToPage(${pagination.page + 1})">
        <span class="material-symbols-outlined">chevron_right</span></button>`;

    paginationControls.innerHTML = html;
}

function goToPage(page) { currentPage = page; loadTransactions(); }

// ════════════════════════════════════════════════════════════════
// ADD EXPENSE
// ════════════════════════════════════════════════════════════════
async function handleAddExpense(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const orig = submitBtn.textContent;
    submitBtn.textContent = 'Adding…';
    submitBtn.disabled = true;

    try {
        const formData = {
            date:        document.getElementById('expenseDate').value,
            category:    document.getElementById('expenseCategory').value,
            description: document.getElementById('expenseDescription').value,
            amount:      parseFloat(document.getElementById('expenseAmount').value)
        };

        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to add expense');

        showNotification('Expense added successfully', 'success');
        document.getElementById('addExpenseModal').classList.remove('show');
        e.target.reset();
        loadAllData();
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        submitBtn.textContent = orig;
        submitBtn.disabled = false;
    }
}

// ════════════════════════════════════════════════════════════════
// GENERATE PDF REPORT
// ════════════════════════════════════════════════════════════════
async function handleGenerateReport() {
    const downloadBtn = document.getElementById('downloadPdfBtn');
    const orig = downloadBtn.innerHTML;
    downloadBtn.innerHTML = '<span class="material-symbols-outlined">hourglass_empty</span> Generating…';
    downloadBtn.disabled = true;

    try {
        const fromDate   = document.getElementById('reportFrom').value;
        const toDate     = document.getElementById('reportTo').value;
        const reportType = document.querySelector('input[name="reportType"]:checked').value;

        if (!fromDate || !toDate)              throw new Error('Please select both dates');
        if (new Date(fromDate) > new Date(toDate)) throw new Error('From date cannot be after To date');

        const response = await fetch(`/api/expenses/report-data?from_date=${fromDate}&to_date=${toDate}&type=${reportType}`);
        if (!response.ok) throw new Error('Failed to fetch report data');
        const data = await response.json();

        generatePDF(data);
        document.getElementById('reportModal').classList.remove('show');
        showNotification('Report generated successfully', 'success');
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        downloadBtn.innerHTML = orig;
        downloadBtn.disabled  = false;
    }
}

function generatePDF(data) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(102, 126, 234);
    doc.text('Cattle-Cloud Financial Report', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${formatDateDisplay(data.date_range.from)} – ${formatDateDisplay(data.date_range.to)}`, 14, 30);
    doc.text(`Report Type: ${capitalizeFirst(data.report_type)}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 42);

    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('Summary', 14, 54);

    const summaryY = 62;
    const lh = 7;
    doc.setFontSize(10);

    if (['all', 'income'].includes(data.report_type)) {
        doc.setTextColor(16, 185, 129);
        doc.text(`Total Income: ₹${formatNumber(data.summary.total_income)}`, 14, summaryY);
    }
    if (['all', 'expense'].includes(data.report_type)) {
        doc.setTextColor(239, 68, 68);
        doc.text(`Total Expenses: ₹${formatNumber(data.summary.total_expense)}`, 14, summaryY + lh);
    }
    if (data.report_type === 'all') {
        doc.setTextColor(102, 126, 234);
        doc.text(`Net Profit: ₹${formatNumber(data.summary.net_profit)}`, 14, summaryY + lh * 2);
    }
    doc.setTextColor(107, 114, 128);
    doc.text(`Total Transactions: ${data.summary.transaction_count}`, 14, summaryY + lh * 3);

    if (data.transactions && data.transactions.length > 0) {
        doc.autoTable({
            startY: summaryY + lh * 4 + 10,
            head: [['Date', 'Description', 'Category', 'Type', 'Amount']],
            body: data.transactions.map(txn => [
                formatDateDisplay(txn.date),
                txn.description.substring(0, 30),
                txn.category,
                capitalizeFirst(txn.type),
                `₹${formatNumber(txn.amount)}`
            ]),
            theme: 'grid',
            headStyles: { fillColor: [102, 126, 234], textColor: 255, fontSize: 9, fontStyle: 'bold' },
            bodyStyles: { fontSize: 8, textColor: 50 },
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { top: 10, left: 14, right: 14 }
        });
    }

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    doc.save(`cattle-cloud-report-${data.date_range.from}-to-${data.date_range.to}.pdf`);
}

// ════════════════════════════════════════════════════════════════
// UTILITIES
// ════════════════════════════════════════════════════════════════
function formatNumber(num) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
}
function formatNum(num) {
    return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(num);
}
function capitalizeFirst(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function showNotification(message, type = 'info') {
    const colors = { success: '#22c55e', error: '#ef4444', info: '#667aea' };
    const icons  = { success: 'check_circle', error: 'error', info: 'info' };
    const c  = colors[type] || colors.info;
    const ic = icons[type]  || icons.info;

    const t = document.createElement('div');
    t.style.cssText = [
        'position:fixed','top:20px','right:20px','z-index:9999',
        'background:#fff','padding:.875rem 1.25rem','border-radius:10px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
        'display:flex','align-items:center','gap:.75rem',
        "font-family:'Lexend',sans-serif",'font-weight:500','font-size:.9rem',
        `border-left:4px solid ${c}`,`color:${c}`,
        'transform:translateX(420px)','opacity:0','transition:all .3s ease','max-width:340px'
    ].join(';');
    t.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${ic}</span><span>${message}</span>`;
    document.body.appendChild(t);

    setTimeout(() => { t.style.transform = 'translateX(0)'; t.style.opacity = '1'; }, 10);
    setTimeout(() => {
        t.style.transform = 'translateX(420px)'; t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3500);
}