// ════════════════════════════════════════════════════════════════
// CATTLE-CLOUD — expenses.js
// Handles: Metrics, Charts, Transactions, Pagination, Reports
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// GLOBAL VARIABLES & CONFIGURATION
// ════════════════════════════════════════════════════════════════
let cashFlowChart = null;
let revenueDonutChart = null;
let currentPage = 1;
const perPage = 10;
let currentFilter = 'all';
let currentDateRange = {
    from: null,
    to: null
};

// Chart colors
const COLORS = {
    revenue: '#667aea',
    expenses: '#ef4444',
    pieColors: [
        '#10b981', '#ef4444', '#667aea', '#f59e0b', 
        '#8b5cf6', '#ec4899', '#14b8a6', '#764ba2',
        '#f97316', '#06b6d4', '#84cc16', '#a855f7'
    ]
};

// ════════════════════════════════════════════════════════════════
// INITIALIZATION
// ════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', function() {
    initializeDateInputs();
    loadAllData();
    setupEventListeners();
});

function initializeDateInputs() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    
    // Format dates as YYYY-MM-DD
    const fromDate = formatDate(firstDay);
    const toDate = formatDate(today);
    
    // Set default date range
    currentDateRange.from = fromDate;
    currentDateRange.to = toDate;
    
    // Set date inputs
    const rangeFrom = document.getElementById('rangeFrom');
    const rangeTo = document.getElementById('rangeTo');
    const reportFrom = document.getElementById('reportFrom');
    const reportTo = document.getElementById('reportTo');
    
    if (rangeFrom) rangeFrom.value = fromDate;
    if (rangeTo) rangeTo.value = toDate;
    if (reportFrom) reportFrom.value = fromDate;
    if (reportTo) reportTo.value = toDate;
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
// CALCULATE DATE RANGE FOR CHART TYPE
// ════════════════════════════════════════════════════════════════
function getChartTypeAndGrouping(fromDate, toDate) {
    const from = new Date(fromDate);
    const to = new Date(toDate);
    const diffTime = Math.abs(to - from);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffMonths = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
    
    if (diffDays <= 31) {
        return { type: 'line', grouping: 'daily' };
    } else if (diffMonths <= 12) {
        return { type: 'bar', grouping: 'monthly' };
    } else {
        return { type: 'bar', grouping: 'yearly' };
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
    
    // Transaction type filter
    const filterType = document.getElementById('filterType');
    if (filterType) {
        filterType.addEventListener('change', function() {
            currentFilter = this.value;
            currentPage = 1;
            loadTransactions();
        });
    }
    
    // Add expense modal
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    const addExpenseModal = document.getElementById('addExpenseModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const expenseForm = document.getElementById('expenseForm');
    
    if (addExpenseBtn && addExpenseModal) {
        addExpenseBtn.addEventListener('click', () => {
            addExpenseModal.classList.add('show');
            document.getElementById('expenseDate').value = formatDate(new Date());
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            addExpenseModal.classList.remove('show');
            expenseForm.reset();
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            addExpenseModal.classList.remove('show');
            expenseForm.reset();
        });
    }
    
    if (addExpenseModal) {
        addExpenseModal.querySelector('.modal-overlay').addEventListener('click', () => {
            addExpenseModal.classList.remove('show');
            expenseForm.reset();
        });
    }
    
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleAddExpense);
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
}

// ════════════════════════════════════════════════════════════════
// DATA LOADING FUNCTIONS
// ════════════════════════════════════════════════════════════════
function loadAllData() {
    loadMetrics();
    loadCashFlow();
    loadRevenueBreakdown();
    loadTransactions();
}

async function loadMetrics() {
    try {
        const url = `/api/expenses/metrics?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        document.getElementById('totalRevenue').textContent = `₹${formatNumber(data.total_revenue)}`;
        document.getElementById('totalExpenses').textContent = `₹${formatNumber(data.total_expenses)}`;
        document.getElementById('netProfit').textContent = `₹${formatNumber(data.net_profit)}`;
        document.getElementById('pendingInvoices').textContent = data.pending_invoices;
        
        const profitChange = document.getElementById('profitChange');
        const profitIcon = profitChange.querySelector('.material-symbols-outlined');
        
        if (data.net_profit > 0) {
            profitChange.className = 'metric-change positive';
            profitIcon.textContent = 'arrow_upward';
        } else if (data.net_profit < 0) {
            profitChange.className = 'metric-change negative';
            profitIcon.textContent = 'arrow_downward';
        } else {
            profitChange.className = 'metric-change neutral';
            profitIcon.textContent = 'remove';
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
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const periodLabel = document.getElementById('cashFlowPeriodLabel');
        if (periodLabel) {
            const fromDate = formatDateDisplay(data.date_range.from);
            const toDate = formatDateDisplay(data.date_range.to);
            periodLabel.textContent = `${fromDate} - ${toDate}`;
        }
        
        renderCashFlowChart(data.cash_flow);
        
    } catch (error) {
        console.error('Error loading cash flow:', error);
        showNotification('Failed to load cash flow data', 'error');
    }
}

async function loadRevenueBreakdown() {
    try {
        const url = `/api/expenses/metrics?from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
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
        
        // Create breakdown showing Revenue vs Expenses
        const breakdown = [
            { label: 'Revenue', value: data.total_revenue },
            { label: 'Expenses', value: data.total_expenses }
        ];
        
        renderRevenueDonut(breakdown);
        
    } catch (error) {
        console.error('Error loading revenue breakdown:', error);
        showNotification('Failed to load revenue breakdown', 'error');
    }
}

async function loadTransactions() {
    try {
        const url = `/api/expenses/transactions?page=${currentPage}&per_page=${perPage}&type=${currentFilter}&from_date=${currentDateRange.from}&to_date=${currentDateRange.to}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        renderTransactionsTable(data.transactions);
        renderPagination(data.pagination);
        
    } catch (error) {
        console.error('Error loading transactions:', error);
        showNotification('Failed to load transactions', 'error');
        document.getElementById('transactionsTableBody').innerHTML = 
            '<tr><td colspan="6" class="no-data">Failed to load transactions</td></tr>';
    }
}

// ════════════════════════════════════════════════════════════════
// CHART RENDERING
// ════════════════════════════════════════════════════════════════
function renderCashFlowChart(cashFlowData) {
    const ctx = document.getElementById('cashFlowChart');
    if (!ctx) return;
    
    if (cashFlowChart) {
        cashFlowChart.destroy();
    }
    
    const chartConfig = getChartTypeAndGrouping(currentDateRange.from, currentDateRange.to);
    
    const labels = cashFlowData.map(item => formatDateDisplay(item.date));
    const revenueData = cashFlowData.map(item => item.revenue);
    const expensesData = cashFlowData.map(item => item.expenses);
    
    const commonConfig = {
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
                displayColors: true,
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ₹' + formatNumber(context.parsed.y);
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
                        return '₹' + formatNumber(value);
                    }
                }
            }
        }
    };
    
    if (chartConfig.type === 'line') {
        cashFlowChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        backgroundColor: 'rgba(102, 126, 234, 0.1)',
                        borderColor: COLORS.revenue,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        borderColor: COLORS.expenses,
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }
                ]
            },
            options: commonConfig
        });
    } else {
        cashFlowChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Revenue',
                        data: revenueData,
                        backgroundColor: COLORS.revenue,
                        borderRadius: 6,
                        maxBarThickness: 50
                    },
                    {
                        label: 'Expenses',
                        data: expensesData,
                        backgroundColor: COLORS.expenses,
                        borderRadius: 6,
                        maxBarThickness: 50
                    }
                ]
            },
            options: commonConfig
        });
    }
}

function renderRevenueDonut(breakdownData) {
    const ctx = document.getElementById('revenueDonut');
    if (!ctx) return;
    
    if (revenueDonutChart) {
        revenueDonutChart.destroy();
    }
    
    if (!breakdownData || breakdownData.length === 0 || breakdownData.every(item => item.value === 0)) {
        const container = ctx.closest('.chart-container');
        if (container) {
            container.innerHTML = '<p class="no-data" style="text-align: center; padding: 2rem;">No financial data available for this period</p>';
        }
        return;
    }
    
    const labels = breakdownData.map(item => item.label);
    const values = breakdownData.map(item => item.value);
    const colors = [COLORS.pieColors[0], COLORS.pieColors[1]];
    
    revenueDonutChart = new Chart(ctx, {
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
                            return context.label + ': ₹' + formatNumber(context.parsed) + ' (' + percentage + '%)';
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
        const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
        return `
            <div class="legend-item">
                <span class="legend-color" style="background-color: ${colors[index]}"></span>
                <span class="legend-label">${item.label}</span>
                <span class="legend-value">₹${formatNumber(item.value)} (${percentage}%)</span>
            </div>
        `;
    }).join('');
}

// ════════════════════════════════════════════════════════════════
// TRANSACTIONS TABLE WITH EDIT/DELETE
// ════════════════════════════════════════════════════════════════
function renderTransactionsTable(transactions) {
    const tbody = document.getElementById('transactionsTableBody');
    if (!tbody) return;
    
    if (!transactions || transactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="no-data">No transactions found for this period</td></tr>';
        return;
    }
    
    tbody.innerHTML = transactions.map(txn => {
        const amountClass = txn.type === 'income' ? 'amount-positive' : 'amount-negative';
        const amountPrefix = txn.type === 'income' ? '+' : '-';
        const canEdit = txn.type === 'expense';
        
        return `
            <tr>
                <td>${formatDateDisplay(txn.date)}</td>
                <td>${txn.description}</td>
                <td><span class="category-badge">${txn.category}</span></td>
                <td class="${amountClass}">${amountPrefix}₹${formatNumber(txn.amount)}</td>
                <td><span class="status-badge ${txn.status}">${txn.status}</span></td>
                <td>
                    ${canEdit ? `
                        <div class="action-btns">
                            <button class="action-btn edit-btn" onclick="editTransaction(${txn.id || 0}, '${txn.date}', '${txn.category}', '${txn.description}', ${txn.amount})" title="Edit">
                                <span class="material-symbols-outlined">edit</span>
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteTransaction(${txn.id || 0})" title="Delete">
                                <span class="material-symbols-outlined">delete</span>
                            </button>
                        </div>
                    ` : '<span class="text-muted">—</span>'}
                </td>
            </tr>
        `;
    }).join('');
}

// Edit transaction function
window.editTransaction = function(id, date, category, description, amount) {
    // Implementation would open modal with pre-filled data
    showNotification('Edit functionality - Implementation needed', 'info');
};

// Delete transaction function
window.deleteTransaction = async function(id) {
    if (!confirm('Are you sure you want to delete this transaction?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/expenses/delete/${id}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('Failed to delete transaction');
        }
        
        showNotification('Transaction deleted successfully', 'success');
        loadAllData();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showNotification('Failed to delete transaction', 'error');
    }
};

function renderPagination(pagination) {
    const paginationInfo = document.getElementById('paginationInfo');
    const paginationControls = document.getElementById('paginationControls');
    
    if (!paginationInfo || !paginationControls) return;
    
    const start = (pagination.page - 1) * pagination.per_page + 1;
    const end = Math.min(pagination.page * pagination.per_page, pagination.total);
    paginationInfo.textContent = `Showing ${start}-${end} of ${pagination.total} transactions`;
    
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
    loadTransactions();
}

// ════════════════════════════════════════════════════════════════
// ADD EXPENSE
// ════════════════════════════════════════════════════════════════
async function handleAddExpense(e) {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Adding...';
    submitBtn.disabled = true;
    
    try {
        const formData = {
            date: document.getElementById('expenseDate').value,
            category: document.getElementById('expenseCategory').value,
            description: document.getElementById('expenseDescription').value,
            amount: parseFloat(document.getElementById('expenseAmount').value)
        };
        
        const response = await fetch('/api/expenses/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to add expense');
        }
        
        showNotification('Expense added successfully', 'success');
        
        document.getElementById('addExpenseModal').classList.remove('show');
        e.target.reset();
        
        loadAllData();
        
    } catch (error) {
        console.error('Error adding expense:', error);
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
        const reportType = document.querySelector('input[name="reportType"]:checked').value;
        
        if (!fromDate || !toDate) {
            throw new Error('Please select both dates');
        }
        
        if (new Date(fromDate) > new Date(toDate)) {
            throw new Error('From date cannot be after To date');
        }
        
        const url = `/api/expenses/report-data?from_date=${fromDate}&to_date=${toDate}&type=${reportType}`;
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
    
    doc.setFontSize(20);
    doc.setTextColor(102, 126, 234);
    doc.text('Cattle-Cloud Financial Report', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128);
    doc.text(`Period: ${formatDateDisplay(data.date_range.from)} - ${formatDateDisplay(data.date_range.to)}`, 14, 30);
    doc.text(`Report Type: ${capitalizeFirst(data.report_type)}`, 14, 36);
    doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 42);
    
    doc.setFontSize(14);
    doc.setTextColor(31, 41, 55);
    doc.text('Summary', 14, 54);
    
    doc.setFontSize(10);
    const summaryY = 62;
    const lineHeight = 7;
    
    if (data.report_type === 'all' || data.report_type === 'income') {
        doc.setTextColor(16, 185, 129);
        doc.text(`Total Income: ₹${formatNumber(data.summary.total_income)}`, 14, summaryY);
    }
    
    if (data.report_type === 'all' || data.report_type === 'expense') {
        doc.setTextColor(239, 68, 68);
        doc.text(`Total Expenses: ₹${formatNumber(data.summary.total_expense)}`, 14, summaryY + lineHeight);
    }
    
    if (data.report_type === 'all') {
        doc.setTextColor(102, 126, 234);
        doc.text(`Net Profit: ₹${formatNumber(data.summary.net_profit)}`, 14, summaryY + lineHeight * 2);
    }
    
    doc.setTextColor(107, 114, 128);
    doc.text(`Total Transactions: ${data.summary.transaction_count}`, 14, summaryY + lineHeight * 3);
    
    if (data.transactions && data.transactions.length > 0) {
        const tableStartY = summaryY + lineHeight * 4 + 10;
        
        const tableColumn = ['Date', 'Description', 'Category', 'Type', 'Amount'];
        const tableRows = data.transactions.map(txn => [
            formatDateDisplay(txn.date),
            txn.description.substring(0, 30),
            txn.category,
            capitalizeFirst(txn.type),
            `₹${formatNumber(txn.amount)}`
        ]);
        
        doc.autoTable({
            startY: tableStartY,
            head: [tableColumn],
            body: tableRows,
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
            },
            margin: { top: 10, left: 14, right: 14 }
        });
    }
    
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
    
    const fileName = `cattle-cloud-report-${data.date_range.from}-to-${data.date_range.to}.pdf`;
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

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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