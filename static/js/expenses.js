document.addEventListener('DOMContentLoaded', function() {
    loadMetrics();
    loadCashFlow();
    loadTransactions();
    loadRevenueBreakdown();
    
    const addExpenseBtn = document.getElementById('addExpenseBtn');
    const addExpenseModal = document.getElementById('addExpenseModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const expenseForm = document.getElementById('expenseForm');
    const generateReportBtn = document.getElementById('generateReportBtn');
    const filterType = document.getElementById('filterType');
    
    addExpenseBtn.addEventListener('click', () => {
        addExpenseModal.classList.add('show');
        document.getElementById('expenseDate').valueAsDate = new Date();
    });
    
    closeModal.addEventListener('click', () => {
        addExpenseModal.classList.remove('show');
    });
    
    cancelBtn.addEventListener('click', () => {
        addExpenseModal.classList.remove('show');
    });
    
    expenseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addExpense();
    });
    
    generateReportBtn.addEventListener('click', () => {
        window.location.href = '/expenses/report';
    });
    
    filterType.addEventListener('change', () => {
        loadTransactions();
    });
});

async function loadMetrics() {
    try {
        const response = await fetch('/expenses/metrics');
        const data = await response.json();
        
        document.getElementById('totalRevenue').textContent = formatCurrency(data.revenue);
        document.getElementById('totalExpenses').textContent = formatCurrency(data.total_expenses);
        document.getElementById('netProfit').textContent = formatCurrency(data.net_profit);
        document.getElementById('pendingInvoices').textContent = data.pending_count;
        
        const profitChangeEl = document.getElementById('profitChange');
        if (data.net_profit > 0) {
            profitChangeEl.classList.add('positive');
            profitChangeEl.classList.remove('negative', 'neutral');
            profitChangeEl.querySelector('.material-symbols-outlined').textContent = 'arrow_upward';
        } else if (data.net_profit < 0) {
            profitChangeEl.classList.add('negative');
            profitChangeEl.classList.remove('positive', 'neutral');
            profitChangeEl.querySelector('.material-symbols-outlined').textContent = 'arrow_downward';
        }
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

async function loadCashFlow() {
    try {
        const response = await fetch('/expenses/cashflow');
        const data = await response.json();
        
        renderCashFlowChart(data);
    } catch (error) {
        console.error('Error loading cash flow:', error);
    }
}

function renderCashFlowChart(data) {
    const svg = document.getElementById('cashFlowChart');
    const width = svg.clientWidth;
    const height = 300;
    const padding = 40;
    
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';
    
    if (data.length === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', width / 2);
        text.setAttribute('y', height / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#9ca3af');
        text.textContent = 'No data available';
        svg.appendChild(text);
        return;
    }
    
    const maxValue = Math.max(...data.map(d => Math.max(d.revenue, d.expenses))) || 100;
    const stepX = (width - padding * 2) / (data.length - 1 || 1);
    const stepY = (height - padding * 2) / maxValue;
    
    const revenuePoints = data.map((d, i) => {
        const x = padding + i * stepX;
        const y = height - padding - d.revenue * stepY;
        return `${x},${y}`;
    }).join(' ');
    
    const expensesPoints = data.map((d, i) => {
        const x = padding + i * stepX;
        const y = height - padding - d.expenses * stepY;
        return `${x},${y}`;
    }).join(' ');
    
    const revenueLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    revenueLine.setAttribute('points', revenuePoints);
    revenueLine.setAttribute('fill', 'none');
    revenueLine.setAttribute('stroke', '#667aea');
    revenueLine.setAttribute('stroke-width', '3');
    revenueLine.setAttribute('stroke-linecap', 'round');
    revenueLine.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(revenueLine);
    
    const expensesLine = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    expensesLine.setAttribute('points', expensesPoints);
    expensesLine.setAttribute('fill', 'none');
    expensesLine.setAttribute('stroke', '#ef4444');
    expensesLine.setAttribute('stroke-width', '3');
    expensesLine.setAttribute('stroke-linecap', 'round');
    expensesLine.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(expensesLine);
    
    data.forEach((d, i) => {
        const x = padding + i * stepX;
        
        const revY = height - padding - d.revenue * stepY;
        const revCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        revCircle.setAttribute('cx', x);
        revCircle.setAttribute('cy', revY);
        revCircle.setAttribute('r', '4');
        revCircle.setAttribute('fill', '#667aea');
        svg.appendChild(revCircle);
        
        const expY = height - padding - d.expenses * stepY;
        const expCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        expCircle.setAttribute('cx', x);
        expCircle.setAttribute('cy', expY);
        expCircle.setAttribute('r', '4');
        expCircle.setAttribute('fill', '#ef4444');
        svg.appendChild(expCircle);
        
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', x);
        label.setAttribute('y', height - 10);
        label.setAttribute('text-anchor', 'middle');
        label.setAttribute('font-size', '11');
        label.setAttribute('fill', '#6b7280');
        const monthLabel = new Date(d.month + '-01').toLocaleDateString('en-US', { month: 'short' });
        label.textContent = monthLabel;
        svg.appendChild(label);
    });
}

async function loadRevenueBreakdown() {
    try {
        const response = await fetch('/expenses/revenue-breakdown');
        const data = await response.json();
        
        const chartData = [
            { name: 'Milk Sales', value: data.milk_sales, color: '#667aea' },
            { name: 'Cattle Sales', value: data.cattle_sales, color: '#764ba2' }
        ];
        
        data.categories.forEach((cat, i) => {
            const colors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
            chartData.push({
                name: cat.name,
                value: cat.value,
                color: colors[i % colors.length]
            });
        });
        
        renderDonutChart(chartData);
    } catch (error) {
        console.error('Error loading revenue breakdown:', error);
    }
}

function renderDonutChart(data) {
    const svg = document.getElementById('revenueDonut');
    const legend = document.getElementById('donutLegend');
    const width = 300;
    const height = 300;
    const radius = 100;
    const innerRadius = 60;
    const centerX = width / 2;
    const centerY = height / 2;
    
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.innerHTML = '';
    legend.innerHTML = '';
    
    const total = data.reduce((sum, d) => sum + d.value, 0);
    
    if (total === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', centerX);
        text.setAttribute('y', centerY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#9ca3af');
        text.textContent = 'No data';
        svg.appendChild(text);
        return;
    }
    
    let currentAngle = -Math.PI / 2;
    
    data.forEach(item => {
        const percentage = (item.value / total);
        const angle = percentage * 2 * Math.PI;
        
        const startX = centerX + radius * Math.cos(currentAngle);
        const startY = centerY + radius * Math.sin(currentAngle);
        const endX = centerX + radius * Math.cos(currentAngle + angle);
        const endY = centerY + radius * Math.sin(currentAngle + angle);
        
        const innerStartX = centerX + innerRadius * Math.cos(currentAngle);
        const innerStartY = centerY + innerRadius * Math.sin(currentAngle);
        const innerEndX = centerX + innerRadius * Math.cos(currentAngle + angle);
        const innerEndY = centerY + innerRadius * Math.sin(currentAngle + angle);
        
        const largeArc = angle > Math.PI ? 1 : 0;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = `
            M ${startX} ${startY}
            A ${radius} ${radius} 0 ${largeArc} 1 ${endX} ${endY}
            L ${innerEndX} ${innerEndY}
            A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStartX} ${innerStartY}
            Z
        `;
        path.setAttribute('d', d);
        path.setAttribute('fill', item.color);
        path.setAttribute('stroke', '#ffffff');
        path.setAttribute('stroke-width', '2');
        svg.appendChild(path);
        
        currentAngle += angle;
        
        const legendItem = document.createElement('div');
        legendItem.className = 'legend-item';
        legendItem.innerHTML = `
            <span class="legend-color" style="background: ${item.color}"></span>
            <span class="legend-label">${item.name}</span>
            <span class="legend-value">${formatCurrency(item.value)}</span>
        `;
        legend.appendChild(legendItem);
    });
    
    const centerText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerText.setAttribute('x', centerX);
    centerText.setAttribute('y', centerY - 10);
    centerText.setAttribute('text-anchor', 'middle');
    centerText.setAttribute('font-size', '12');
    centerText.setAttribute('fill', '#6b7280');
    centerText.textContent = 'Total';
    svg.appendChild(centerText);
    
    const centerValue = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    centerValue.setAttribute('x', centerX);
    centerValue.setAttribute('y', centerY + 10);
    centerValue.setAttribute('text-anchor', 'middle');
    centerValue.setAttribute('font-size', '16');
    centerValue.setAttribute('font-weight', '700');
    centerValue.setAttribute('fill', '#111827');
    centerValue.textContent = formatCurrency(total);
    svg.appendChild(centerValue);
}

async function loadTransactions() {
    try {
        const response = await fetch('/expenses/transactions');
        const data = await response.json();
        
        const filterType = document.getElementById('filterType').value;
        const filteredData = filterType === 'all' 
            ? data 
            : data.filter(t => t.type === filterType);
        
        renderTransactionsTable(filteredData);
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function renderTransactionsTable(data) {
    const tbody = document.getElementById('transactionsTableBody');
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="no-data">No transactions found</td></tr>';
        return;
    }
    
    data.forEach(txn => {
        const row = document.createElement('tr');
        
        const dateCell = document.createElement('td');
        dateCell.textContent = new Date(txn.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        row.appendChild(dateCell);
        
        const descCell = document.createElement('td');
        descCell.textContent = txn.description;
        row.appendChild(descCell);
        
        const catCell = document.createElement('td');
        catCell.innerHTML = `<span class="category-badge">${txn.category}</span>`;
        row.appendChild(catCell);
        
        const amountCell = document.createElement('td');
        amountCell.className = txn.amount >= 0 ? 'amount-positive' : 'amount-negative';
        amountCell.textContent = formatCurrency(Math.abs(txn.amount));
        row.appendChild(amountCell);
        
        const statusCell = document.createElement('td');
        statusCell.innerHTML = `<span class="status-badge ${txn.status.toLowerCase()}">${txn.status}</span>`;
        row.appendChild(statusCell);
        
        tbody.appendChild(row);
    });
}

async function addExpense() {
    const date = document.getElementById('expenseDate').value;
    const category = document.getElementById('expenseCategory').value;
    const description = document.getElementById('expenseDescription').value;
    const amount = document.getElementById('expenseAmount').value;
    
    try {
        const response = await fetch('/expenses/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ date, category, description, amount })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('addExpenseModal').classList.remove('show');
            document.getElementById('expenseForm').reset();
            
            loadMetrics();
            loadCashFlow();
            loadTransactions();
            loadRevenueBreakdown();
        } else {
            alert(result.error || 'Failed to add expense');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        alert('An error occurred while adding the expense');
    }
}

function formatCurrency(amount) {
    return '₹' + parseFloat(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}