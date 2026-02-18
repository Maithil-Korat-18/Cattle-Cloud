// ════════════════════════════════════════════════════════════════
// CATTLE-CLOUD — milk_records.js
// ════════════════════════════════════════════════════════════════

let currentPage = 1;
let currentSearch = '';
let currentStartDate = '';
let currentEndDate = '';
let deleteRecordId = null;

document.addEventListener('DOMContentLoaded', function () {
    // ── CRITICAL ORDER: set dates FIRST, then load cattle ──
    // If loadCattleList() fires before the date input has a value,
    // the API defaults to server-side "today" which may differ and
    // causes stale "all recorded" state on page refresh.
    setDefaultDates();
    loadSummary();
    loadRecords();
    loadCattleList(); // now runs AFTER setDefaultDates()
    setupEventListeners();
    setupLogout();
});

// ════════════════════════════════════════════════════════════════
// SET DEFAULT DATES — must run before loadCattleList()
// ════════════════════════════════════════════════════════════════
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];

    // Add record form date
    const addDateInput = document.querySelector('#addRecordForm input[name="date"]');
    if (addDateInput) addDateInput.value = today;

    // Generate report defaults
    const reportStart = new Date();
    reportStart.setDate(reportStart.getDate() - 7);
    const rptS = document.querySelector('#generateReportForm input[name="start_date"]');
    const rptE = document.querySelector('#generateReportForm input[name="end_date"]');
    if (rptS) rptS.value = reportStart.toISOString().split('T')[0];
    if (rptE) rptE.value = today;
}

// ════════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ════════════════════════════════════════════════════════════════
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', function (e) {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentSearch = e.target.value;
                currentPage = 1;
                loadRecords();
            }, 500);
        });
    }

    // Delete confirm
    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function () {
            if (deleteRecordId) deleteRecord(deleteRecordId);
        });
    }

    // Clear filter
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', clearDateFilter);
    }

    // Reload cattle list when add-record date changes
    const addDateInput = document.querySelector('#addRecordForm input[name="date"]');
    if (addDateInput) {
        addDateInput.addEventListener('change', function () {
            loadCattleList(this.value);
        });
    }

    // Reset cattle dropdown when add-record modal is re-opened
    const addModal = document.getElementById('addRecordModal');
    if (addModal) {
        addModal.addEventListener('show.bs.modal', function () {
            // Always re-fetch with current date value when modal opens
            const dateInput = document.querySelector('#addRecordForm input[name="date"]');
            const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            loadCattleList(date);
        });
    }
}

// ════════════════════════════════════════════════════════════════
// LOGOUT
// ════════════════════════════════════════════════════════════════
function setupLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            new bootstrap.Modal(document.getElementById('logoutModal')).show();
        });
    }
}

// ════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════
function loadSummary() {
    fetch('/milk/summary')
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;

            document.getElementById('todayTotal').innerHTML = `${data.today_total} <span class="unit">L</span>`;
            document.getElementById('avgPerCow').innerHTML  = `${data.avg_per_cow} <span class="unit">L</span>`;
            document.getElementById('morningYield').textContent = `${data.morning_total} L`;
            document.getElementById('eveningYield').textContent = `${data.evening_total} L`;

            const targetEl = document.getElementById('avgTarget');
            if (targetEl) targetEl.textContent = `Daily Avg: ${data.last_month_avg} L`;

            const changeEl = document.getElementById('todayChange');
            const pct = data.change_percent;
            if (pct > 0) {
                changeEl.className = 'card-change positive';
                changeEl.innerHTML = `<span class="material-symbols-outlined">trending_up</span><span>+${pct.toFixed(1)}% from yesterday</span>`;
            } else if (pct < 0) {
                changeEl.className = 'card-change negative';
                changeEl.innerHTML = `<span class="material-symbols-outlined">trending_down</span><span>${pct.toFixed(1)}% from yesterday</span>`;
            } else {
                changeEl.className = 'card-change neutral';
                changeEl.innerHTML = `<span class="material-symbols-outlined">remove</span><span>Same as yesterday</span>`;
            }
        })
        .catch(e => console.error('Summary error:', e));
}

// ════════════════════════════════════════════════════════════════
// TABLE
// ════════════════════════════════════════════════════════════════
function loadRecords() {
    const params = new URLSearchParams({ page: currentPage, per_page: 10, search: currentSearch });
    if (currentStartDate && currentEndDate) {
        params.append('start_date', currentStartDate);
        params.append('end_date', currentEndDate);
    }
    fetch(`/milk/data?${params}`)
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                renderTable(data.records);
                updatePagination(data.page, data.total_pages, data.total);
            }
        })
        .catch(e => {
            console.error(e);
            document.getElementById('recordsTableBody').innerHTML =
                '<tr><td colspan="7" class="text-center py-5 text-danger">Error loading records</td></tr>';
        });
}

const BREED_COLOR = {
    'gir':        'avatar-gir',
    'jersey':     'avatar-jersey',
    'holstein':   'avatar-holstein',
    'sahiwal':    'avatar-sahiwal',
    'red sindhi': 'avatar-sindhi',
    'crossbreed': 'avatar-cross',
};
function breedClass(breed) {
    return breed ? (BREED_COLOR[breed.toLowerCase()] || 'avatar-default') : 'avatar-default';
}

function renderTable(records) {
    const tbody = document.getElementById('recordsTableBody');
    if (!records.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-5" style="color:#6b7280">No records found</td></tr>';
        return;
    }
    tbody.innerHTML = records.map(r => {
        const date     = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const initials = r.breed ? r.breed.substring(0, 2).toUpperCase() : 'NA';
        return `
        <tr>
            <td class="fw-medium">${date}</td>
            <td>
                <div class="cattle-cell">
                    <div class="cattle-avatar ${breedClass(r.breed)}">${initials}</div>
                    <span class="cattle-tag">${r.tag_no || 'C-' + r.cattle_id}</span>
                </div>
            </td>
            <td>${parseFloat(r.morning_liters).toFixed(1)}</td>
            <td>${parseFloat(r.evening_liters).toFixed(1)}</td>
            <td class="fw-bold">${parseFloat(r.milk_liters).toFixed(1)}</td>
            <td>₹ ${parseFloat(r.rate).toFixed(2)}</td>
            <td class="text-end">
                <div class="action-buttons">
                    <button class="action-btn edit-action-btn" title="Edit"
                        onclick="openEditModal(${r.id}, '${r.date}', ${r.morning_liters}, ${r.evening_liters}, ${r.rate})">
                        <span class="material-symbols-outlined">edit</span>
                    </button>
                    <button class="action-btn delete-action-btn" title="Delete"
                        onclick="openDeleteModal(${r.id})">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

function updatePagination(page, totalPages, total) {
    document.getElementById('showingFrom').textContent  = total > 0 ? (page - 1) * 10 + 1 : 0;
    document.getElementById('showingTo').textContent    = Math.min(page * 10, total);
    document.getElementById('totalRecords').textContent = total;

    const ctrl = document.getElementById('paginationControls');
    if (!totalPages) { ctrl.innerHTML = ''; return; }

    let html = `<button class="pagination-btn" ${page === 1 ? 'disabled' : ''} onclick="changePage(${page - 1})">
        <span class="material-symbols-outlined">chevron_left</span></button>`;

    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        html += `<button class="pagination-btn ${i === page ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }
    if (totalPages > 5) {
        html += `<span class="pagination-ellipsis">…</span>
                 <button class="pagination-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }
    html += `<button class="pagination-btn" ${page === totalPages ? 'disabled' : ''} onclick="changePage(${page + 1})">
        <span class="material-symbols-outlined">chevron_right</span></button>`;
    ctrl.innerHTML = html;
}

function changePage(p) { currentPage = p; loadRecords(); }

// ════════════════════════════════════════════════════════════════
// CATTLE DROPDOWN
// ════════════════════════════════════════════════════════════════
// BUG FIX: Accept explicit date param so we never rely on the
// input's value being set *after* this function is called.
// On DOMContentLoaded, setDefaultDates() runs first so the input
// already has today's value when loadCattleList() fires.
function loadCattleList(dateOverride) {
    const addDateInput = document.querySelector('#addRecordForm input[name="date"]');

    // Use explicit param > input value > today
    const selectedDate = dateOverride
        || (addDateInput && addDateInput.value)
        || new Date().toISOString().split('T')[0];

    fetch(`/milk/available-cattle?date=${selectedDate}`)
        .then(r => r.json())
        .then(data => {
            if (!data.success) return;

            // Report dropdown: always all cattle
            const reportSelect = document.querySelector('#generateReportForm select[name="cattle_id"]');
            if (reportSelect && data.all) {
                reportSelect.innerHTML =
                    '<option value="all">All Cattle</option>' +
                    data.all.map(c =>
                        `<option value="${c.id}">${c.tag_no || 'C-' + c.id} – ${c.name}</option>`
                    ).join('');
            }

            // Add dropdown: only unrecorded cattle for this date
            const addSelect = document.querySelector('#addRecordForm select[name="cattle_id"]');
            if (!addSelect) return;

            if (data.available.length === 0) {
                addSelect.innerHTML = '<option value="">— All cattle already recorded —</option>';
                addSelect.disabled = true;
                showCattleMsg('All cattle milk records are already done for this date.', 'info');
            } else {
                addSelect.disabled = false;
                addSelect.innerHTML =
                    '<option value="">Select Cattle</option>' +
                    data.available.map(c =>
                        `<option value="${c.id}">${c.tag_no || 'C-' + c.id} – ${c.name}</option>`
                    ).join('');
                hideCattleMsg();
            }
        })
        .catch(e => console.error('Cattle list error:', e));
}

function showCattleMsg(msg, type) {
    let el = document.getElementById('addCattleMsg');
    if (!el) {
        el = document.createElement('p');
        el.id = 'addCattleMsg';
        const sel = document.querySelector('#addRecordForm select[name="cattle_id"]');
        sel.parentNode.insertBefore(el, sel.nextSibling);
    }
    el.className = `cattle-info-msg cattle-msg-${type}`;
    el.textContent = msg;
}

function hideCattleMsg() {
    const el = document.getElementById('addCattleMsg');
    if (el) el.remove();
}

// ════════════════════════════════════════════════════════════════
// ADD RECORD
// ════════════════════════════════════════════════════════════════
function submitAddRecord() {
    const form = document.getElementById('addRecordForm');
    const fd   = new FormData(form);
    const data = {
        cattle_id:      fd.get('cattle_id'),
        date:           fd.get('date'),
        morning_liters: fd.get('morning_liters'),
        evening_liters: fd.get('evening_liters'),
        rate:           fd.get('rate')
    };

    if (!data.cattle_id) { showNotification('Please select a cattle', 'error'); return; }

    fetch('/milk/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                showNotification('Record added successfully', 'success');
                bootstrap.Modal.getInstance(document.getElementById('addRecordModal')).hide();
                form.reset();
                setDefaultDates();
                loadCattleList(); // refresh with today
                loadRecords();
                loadSummary();
            } else {
                showNotification(result.error || 'Failed to add record', 'error');
            }
        })
        .catch(() => showNotification('An error occurred', 'error'));
}

// ════════════════════════════════════════════════════════════════
// EDIT RECORD — pre-fills date in modal
// ════════════════════════════════════════════════════════════════
function openEditModal(id, date, morning, evening, rate) {
    const form = document.getElementById('editRecordForm');
    form.querySelector('input[name="record_id"]').value     = id;
    form.querySelector('input[name="date"]').value          = date;
    form.querySelector('input[name="morning_liters"]').value = morning;
    form.querySelector('input[name="evening_liters"]').value = evening;
    form.querySelector('input[name="rate"]').value          = rate;
    new bootstrap.Modal(document.getElementById('editRecordModal')).show();
}

function submitEditRecord() {
    const form = document.getElementById('editRecordForm');
    const fd   = new FormData(form);
    const id   = fd.get('record_id');
    const data = {
        date:           fd.get('date'),
        morning_liters: fd.get('morning_liters'),
        evening_liters: fd.get('evening_liters'),
        rate:           fd.get('rate')
    };

    fetch(`/milk/update/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    })
        .then(r => r.json())
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
        .catch(() => showNotification('An error occurred', 'error'));
}

// ════════════════════════════════════════════════════════════════
// DELETE
// ════════════════════════════════════════════════════════════════
function openDeleteModal(id) {
    deleteRecordId = id;
    new bootstrap.Modal(document.getElementById('deleteModal')).show();
}

function deleteRecord(id) {
    fetch(`/milk/delete/${id}`, { method: 'DELETE' })
        .then(r => r.json())
        .then(result => {
            if (result.success) {
                showNotification('Record deleted successfully', 'success');
                bootstrap.Modal.getInstance(document.getElementById('deleteModal')).hide();
                loadRecords();
                loadSummary();
                loadCattleList(); // refresh so deleted cattle reappears if it was today
                deleteRecordId = null;
            } else {
                showNotification(result.error || 'Failed to delete record', 'error');
            }
        })
        .catch(() => showNotification('An error occurred', 'error'));
}

// ════════════════════════════════════════════════════════════════
// DATE FILTER
// ════════════════════════════════════════════════════════════════
function applyDateFilter() {
    const fd = new FormData(document.getElementById('dateRangeForm'));
    currentStartDate = fd.get('start_date');
    currentEndDate   = fd.get('end_date');
    currentPage = 1;

    if (!currentStartDate || !currentEndDate) {
        showNotification('Please select both dates', 'error');
        return;
    }

    const s = new Date(currentStartDate), e = new Date(currentEndDate);
    document.getElementById('dateRangeText').textContent =
        `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} – ` +
        `${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    document.getElementById('clearFilterBtn').style.display = 'inline-flex';

    bootstrap.Modal.getInstance(document.getElementById('dateRangeModal')).hide();
    loadRecords();
}

function clearDateFilter() {
    currentStartDate = '';
    currentEndDate   = '';
    currentPage = 1;
    document.getElementById('dateRangeText').textContent = 'Select date range';
    document.getElementById('clearFilterBtn').style.display = 'none';
    const sf = document.querySelector('#dateRangeForm input[name="start_date"]');
    const ef = document.querySelector('#dateRangeForm input[name="end_date"]');
    if (sf) sf.value = '';
    if (ef) ef.value = '';
    loadRecords();
}

// ════════════════════════════════════════════════════════════════
// GENERATE REPORT
// ════════════════════════════════════════════════════════════════
function submitGenerateReport() {
    const fd        = new FormData(document.getElementById('generateReportForm'));
    const startDate = fd.get('start_date');
    const endDate   = fd.get('end_date');

    if (!startDate || !endDate) { showNotification('Please select both dates', 'error'); return; }
    showNotification('Generating PDF report…', 'info');

    fetch('/milk/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            start_date: startDate,
            end_date:   endDate,
            cattle_id:  fd.get('cattle_id'),
            report_type: 'daily',
            format: 'pdf'
        })
    })
        .then(r => {
            if (!r.ok) return r.json().then(e => { throw new Error(e.error || 'Failed'); });
            return r.blob();
        })
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const a   = document.createElement('a');
            a.href = url;
            a.download = `milk_report_${startDate}_to_${endDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showNotification('Report generated successfully', 'success');
            bootstrap.Modal.getInstance(document.getElementById('generateReportModal')).hide();
        })
        .catch(e => showNotification(e.message || 'Failed to generate report', 'error'));
}

// ════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ════════════════════════════════════════════════════════════════
function showNotification(message, type) {
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const n = document.createElement('div');
    n.className = `notification notification-${type}`;
    n.innerHTML = `<span class="material-symbols-outlined">${icons[type] || 'info'}</span><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => {
        n.classList.remove('show');
        setTimeout(() => n.remove(), 300);
    }, 3000);
}