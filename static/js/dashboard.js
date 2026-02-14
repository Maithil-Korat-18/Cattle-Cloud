// ===========================
// DASHBOARD JAVASCRIPT
// ===========================

// Global Chart Instance
let productionChart = null;
let feedStockCache  = [];   // feed stock list for QR modal

// ===========================
// CHART INITIALIZATION
// (unchanged from original)
// ===========================
function initializeChart(weeklyData) {
    const ctx = document.getElementById('productionChart');
    if (!ctx) return;

    const labels    = weeklyData.map(item => item.day);
    const values    = weeklyData.map(item => item.value);
    const isToday   = (index) => index === values.length - 1;

    if (productionChart) {
        productionChart.destroy();
    }

    productionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: values.map((val, idx) =>
                    isToday(idx) ? 'rgba(102, 126, 234, 0.6)' : 'rgba(102, 126, 234, 0.2)'
                ),
                borderRadius: {
                    topLeft: 8,
                    topRight: 8
                },
                barPercentage: 0.8,
                categoryPercentage: 0.9,
                hoverBackgroundColor: values.map((val, idx) =>
                    isToday(idx) ? 'rgba(102, 126, 234, 0.6)' : 'rgba(102, 126, 234, 0.4)'
                )
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    padding: 12,
                    titleColor: '#f3f4f6',
                    bodyColor: '#f3f4f6',
                    cornerRadius: 8,
                    displayColors: false,
                    titleFont:  { family: 'Lexend', weight: '700' },
                    bodyFont:   { family: 'Lexend' },
                    callbacks: {
                        label: function(context) {
                            return context.parsed.y.toFixed(1) + ' L';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        font: { family: 'Lexend', size: 10, weight: '700' },
                        color: '#6b7280'
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' },
                    border: { display: false },
                    ticks: { display: false }
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// ===========================
// DOM READY
// ===========================
document.addEventListener('DOMContentLoaded', function () {

    // ── Chart tab switching ──
    document.querySelectorAll('.chart-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Nav active state ──
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // ── Search ──
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            console.log('Searching:', e.target.value.toLowerCase());
        });
    }

    // ── Load Quick Record modal data ──
    loadCattleList();
    loadFeedStock();

    // ── QR tab switching ──
    document.querySelectorAll('.qr-tab').forEach(tab => {
        tab.addEventListener('click', function () {
            document.querySelectorAll('.qr-tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.qr-form').forEach(f => f.classList.remove('active'));
            const formMap = { milk: 'qrMilkForm', health: 'qrHealthForm', feed: 'qrFeedForm' };
            const formEl = document.getElementById(formMap[this.dataset.type]);
            if (formEl) formEl.classList.add('active');
            clearQrError();
        });
    });

    // ── Feed type change → show stock ──
    document.getElementById('qrFeedTypeSelect')?.addEventListener('change', function () {
        updateQrStockInfo(this.value);
    });

    // ── Set today's date defaults ──
    const today = new Date().toISOString().split('T')[0];
    ['qrMilkDate', 'qrFeedDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = today;
    });

    // ── Report modal defaults ──
    const rptS = document.getElementById('rptStart');
    const rptE = document.getElementById('rptEnd');
    if (rptS) rptS.value = nDaysAgo(30);
    if (rptE) rptE.value = today;
});

// ===========================
// HELPERS
// ===========================
function nDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}

// ===========================
// LOAD CATTLE LIST FOR MODAL
// ===========================
function loadCattleList() {
    fetch('/api/cattle-list')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            const sel = document.getElementById('qrCattleSelect');
            if (!sel) return;
            sel.innerHTML = '<option value="">Select cattle...</option>';
            data.cattle.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name}${c.tag_no ? ' (#' + c.tag_no + ')' : ''} — ${c.breed}`;
                sel.appendChild(opt);
            });
        })
        .catch(() => {
            const sel = document.getElementById('qrCattleSelect');
            if (sel) sel.innerHTML = '<option value="">Failed to load cattle</option>';
        });
}

// ===========================
// LOAD FEED STOCK FOR MODAL
// ===========================
function loadFeedStock() {
    fetch('/feed/stock-list')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;
            feedStockCache = data.feeds || [];
            const sel = document.getElementById('qrFeedTypeSelect');
            if (!sel) return;
            sel.innerHTML = '<option value="">Select feed type...</option>';
            feedStockCache.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f.id;
                opt.textContent = `${f.feed_name} (${parseFloat(f.quantity).toFixed(1)} kg available)`;
                opt.dataset.qty      = f.quantity;
                opt.dataset.cost     = f.cost_per_kg;
                opt.dataset.minqty   = f.min_quantity || 0;
                sel.appendChild(opt);
            });
        })
        .catch(() => {
            const sel = document.getElementById('qrFeedTypeSelect');
            if (sel) sel.innerHTML = '<option value="">Failed to load feeds</option>';
        });
}

function updateQrStockInfo(feedId) {
    const info = document.getElementById('qrStockInfo');
    const txt  = document.getElementById('qrStockText');
    if (!info || !txt) return;

    if (!feedId) {
        txt.textContent = 'Select a feed to see available stock';
        info.classList.remove('low-stock');
        return;
    }

    const feed = feedStockCache.find(f => String(f.id) === String(feedId));
    if (!feed) return;

    const qty    = parseFloat(feed.quantity);
    const minQty = parseFloat(feed.min_quantity || 0);
    const low    = qty <= minQty;

    txt.textContent = `Available: ${qty.toFixed(1)} kg  ·  ₹${parseFloat(feed.cost_per_kg).toFixed(2)}/kg${low ? '  ⚠ Low stock' : ''}`;
    info.classList.toggle('low-stock', low);
}

// ===========================
// SUBMIT QUICK RECORD
// ===========================
function submitQuickRecord() {
    clearQrError();

    const cattleId = document.getElementById('qrCattleSelect')?.value;
    if (!cattleId) {
        showQrError('Please select a cattle first.');
        return;
    }

    const activeType = document.querySelector('.qr-tab.active')?.dataset.type;
    if (activeType === 'milk')   submitQrMilk(cattleId);
    else if (activeType === 'health') submitQrHealth(cattleId);
    else if (activeType === 'feed')   submitQrFeed(cattleId);
}

function submitQrMilk(cattleId) {
    const date    = document.getElementById('qrMilkDate')?.value;
    const morning = parseFloat(document.getElementById('qrMilkMorning')?.value || '');
    const evening = parseFloat(document.getElementById('qrMilkEvening')?.value || '');
    const rate    = parseFloat(document.getElementById('qrMilkRate')?.value    || '');

    if (!date)              { showQrError('Please select a date.'); return; }
    if (isNaN(morning))     { showQrError('Please enter morning liters.'); return; }
    if (isNaN(evening))     { showQrError('Please enter evening liters.'); return; }
    if (isNaN(rate) || rate <= 0) { showQrError('Please enter a valid rate.'); return; }

    postJson(`/cattle/${cattleId}/add-milk`, {
        date, morning_liters: morning, evening_liters: evening, rate
    }).then(res => {
        if (res.success) {
            closeQrModal();
            showToast('Milk record added successfully!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showQrError(res.error || 'Failed to save milk record.');
        }
    });
}

function submitQrHealth(cattleId) {
    const issue  = document.getElementById('qrHealthIssue')?.value?.trim();
    const treat  = document.getElementById('qrHealthTreatment')?.value?.trim();
    const vet    = document.getElementById('qrHealthVet')?.value?.trim();
    const nextCh = document.getElementById('qrHealthNextCheckup')?.value || null;

    if (!issue) { showQrError('Please describe the issue.'); return; }
    if (!treat) { showQrError('Please describe the treatment.'); return; }
    if (!vet)   { showQrError('Please enter the veterinarian name.'); return; }

    postJson(`/cattle/${cattleId}/add-health`, {
        issue, treatment: treat, vet_name: vet, next_checkup: nextCh
    }).then(res => {
        if (res.success) {
            closeQrModal();
            showToast('Health record added successfully!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showQrError(res.error || 'Failed to save health record.');
        }
    });
}

function submitQrFeed(cattleId) {
    const feedId  = document.getElementById('qrFeedTypeSelect')?.value;
    const qty     = parseFloat(document.getElementById('qrFeedQty')?.value || '');
    const date    = document.getElementById('qrFeedDate')?.value;

    if (!date)   { showQrError('Please select a date.'); return; }
    if (!feedId) { showQrError('Please select a feed type.'); return; }
    if (isNaN(qty) || qty <= 0) { showQrError('Please enter a valid quantity.'); return; }

    postJson(`/cattle/${cattleId}/add-feed`, {
        feed_id: parseInt(feedId), quantity_used: qty,
        usage_date: date, cattle_id: parseInt(cattleId)
    }).then(res => {
        if (res.success) {
            closeQrModal();
            showToast('Feed record added successfully!', 'success');
            setTimeout(() => location.reload(), 1000);
        } else {
            showQrError(res.error || 'Failed to save feed record.');
        }
    });
}

// ===========================
// OVERVIEW REPORT
// ===========================
function openReportModal() {
    new bootstrap.Modal(document.getElementById('reportRangeModal')).show();
}

function downloadOverviewReport() {
    const s = document.getElementById('rptStart')?.value;
    const e = document.getElementById('rptEnd')?.value;

    if (!s || !e) { showToast('Please select both dates.', 'error'); return; }
    if (new Date(s) > new Date(e)) { showToast('Start date must be before end date.', 'error'); return; }

    window.open(`/dashboard/report?start_date=${s}&end_date=${e}`, '_blank');
    bootstrap.Modal.getInstance(document.getElementById('reportRangeModal'))?.hide();
}

// ===========================
// UTILITY — POST JSON
// ===========================
function postJson(url, payload) {
    return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(r => r.json())
    .catch(() => ({ success: false, error: 'Network error. Please try again.' }));
}

// ===========================
// QR MODAL HELPERS
// ===========================
function closeQrModal() {
    const modalEl = document.getElementById('quickRecordModal');
    const m = bootstrap.Modal.getInstance(modalEl);
    if (m) m.hide();
}

function showQrError(msg) {
    const bar = document.getElementById('qrErrorBar');
    const txt = document.getElementById('qrErrorMsg');
    if (bar && txt) {
        txt.textContent = msg;
        bar.style.display = 'flex';
    }
}

function clearQrError() {
    const bar = document.getElementById('qrErrorBar');
    if (bar) { bar.style.display = 'none'; }
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, type) {
    const toast = document.createElement('div');
    const color  = type === 'success' ? '#22c55e' : '#ef4444';
    const icon   = type === 'success' ? 'check_circle' : 'error';

    toast.style.cssText = [
        'position:fixed', 'top:20px', 'right:20px', 'z-index:9999',
        'background:#fff', 'padding:0.875rem 1.25rem', 'border-radius:10px',
        'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
        'display:flex', 'align-items:center', 'gap:0.75rem',
        `font-family:'Lexend',sans-serif`, 'font-weight:500', 'font-size:0.9375rem',
        `border-left:4px solid ${color}`, `color:${color}`,
        'transform:translateX(420px)', 'opacity:0', 'transition:all 0.3s ease',
        'max-width:340px'
    ].join(';');

    toast.innerHTML = `<span class="material-symbols-outlined" style="font-size:20px">${icon}</span><span>${message}</span>`;
    document.body.appendChild(toast);

    setTimeout(() => { toast.style.transform = 'translateX(0)'; toast.style.opacity = '1'; }, 10);
    setTimeout(() => {
        toast.style.transform = 'translateX(420px)';
        toast.style.opacity   = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ===========================
// RESPONSIVE
// ===========================
window.addEventListener('resize', function () {
    if (productionChart) productionChart.resize();
});

// ===========================
// EXPORTS
// ===========================
window.dashboardUtils = {
    initializeChart,
    openReportModal,
    downloadOverviewReport
};