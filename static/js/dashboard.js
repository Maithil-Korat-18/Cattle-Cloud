    // ===========================
    // DASHBOARD JAVASCRIPT
    // ===========================

    let productionChart  = null;
    let feedStockCache   = [];
    let allCattleCache   = [];        // full list
    let milkTodaySet     = new Set(); // cattle IDs that already have milk record today
    let feedTodaySet     = new Set(); // cattle IDs that already have feed record today
    let currentPeriod    = 'weekly';

    // ===========================
    // CHART — supports weekly & monthly
    // ===========================
    function initializeChart(data, period) {
        const ctx = document.getElementById('productionChart');
        if (!ctx) return;

        currentPeriod = period;

        const labels = data.map(d => d.label || d.day);
        const values = data.map(d => parseFloat(d.value));
        const maxVal = Math.max(...values, 1);

        // Highlight last bar for weekly, last month for monthly
        const lastIdx = values.length - 1;

        if (productionChart) productionChart.destroy();

        productionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    data: values,
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
                            label: ctx => ctx.parsed.y.toFixed(1) + ' L'
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

    // ===========================
    // CHART TAB SWITCHING (Monthly removed — always 7-day view)
    // ===========================
    document.addEventListener('DOMContentLoaded', function () {
        // Setup rest of page
        setupQrModal();
        loadCattleList();
        loadFeedStock();
        setDefaultDates();

        // Report defaults
        const rptS = document.getElementById('rptStart');
        const rptE = document.getElementById('rptEnd');
        const today = new Date().toISOString().split('T')[0];
        if (rptS) rptS.value = nDaysAgo(30);
        if (rptE) rptE.value = today;
    });

    function nDaysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return d.toISOString().split('T')[0];
    }

    function setDefaultDates() {
        const today = new Date().toISOString().split('T')[0];
        const qrM = document.getElementById('qrMilkDate');
        const qrF = document.getElementById('qrFeedDate');
        if (qrM) qrM.value = today;
        if (qrF) qrF.value = today;
    }

    // ===========================
    // LOGOUT — show confirm modal
    // ===========================
    document.addEventListener('DOMContentLoaded', function () {
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function (e) {
                e.preventDefault();
                new bootstrap.Modal(document.getElementById('logoutModal')).show();
            });
        }
    });

    // ===========================
    // LOAD CATTLE — fetch + filter today's milk/feed
    // ===========================
    function loadCattleList() {
        fetch('/api/cattle-list')
            .then(r => r.json())
            .then(data => {
                if (!data.success) return;
                allCattleCache = data.cattle;
                // cattle IDs already recorded today
                milkTodaySet = new Set((data.milk_today_ids  || []).map(String));
                feedTodaySet = new Set((data.feed_today_ids  || []).map(String));
                refreshCattleDropdown();
            })
            .catch(() => {
                const sel = document.getElementById('qrCattleSelect');
                if (sel) sel.innerHTML = '<option value="">Failed to load cattle</option>';
            });
    }

    function refreshCattleDropdown() {
        const activeType = document.querySelector('.qr-tab.active')?.dataset.type || 'milk';
        populateCattleForType(activeType);
    }

    function populateCattleForType(type) {
        const sel  = document.getElementById('qrCattleSelect');
        const hint = document.getElementById('qrCattleHint');
        if (!sel) return;

        sel.innerHTML = '<option value="">Select cattle...</option>';

        // Which set to check for today's records
        const todaySet = type === 'milk' ? milkTodaySet : type === 'feed' ? feedTodaySet : new Set();

        let hiddenCount = 0;
        allCattleCache.forEach(c => {
            if ((type === 'milk' || type === 'feed') && todaySet.has(String(c.id))) {
                hiddenCount++;
                return; // skip — already recorded today
            }
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = `${c.name}${c.tag_no ? ' (#' + c.tag_no + ')' : ''} — ${c.breed}`;
            sel.appendChild(opt);
        });

    
    }

    // ===========================
    // LOAD FEED STOCK
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
                    opt.dataset.qty     = f.quantity;
                    opt.dataset.cost    = f.cost_per_kg;
                    opt.dataset.minqty  = f.min_quantity || 0;
                    sel.appendChild(opt);
                });
            })
            .catch(() => {});
    }

    // ===========================
    // QUICK RECORD MODAL SETUP
    // ===========================
    function setupQrModal() {
        // Tab switching
        document.querySelectorAll('.qr-tab').forEach(tab => {
            tab.addEventListener('click', function () {
                document.querySelectorAll('.qr-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.qr-form').forEach(f => f.classList.remove('active'));
                const formMap = { milk: 'qrMilkForm', health: 'qrHealthForm', feed: 'qrFeedForm' };
                document.getElementById(formMap[this.dataset.type])?.classList.add('active');
                clearQrError();
                // Refresh dropdown filter when tab changes
                populateCattleForType(this.dataset.type);
            });
        });

        // Feed type change → show stock info
        document.getElementById('qrFeedTypeSelect')?.addEventListener('change', function () {
            updateQrStockInfo(this.value);
        });

        // When date changes for milk, re-check if cattle needs re-filtering
        // (only same-day logic matters; other dates show all cattle)
        document.getElementById('qrMilkDate')?.addEventListener('change', function () {
            checkDateAndRefreshDropdown('milk', this.value);
        });
        document.getElementById('qrFeedDate')?.addEventListener('change', function () {
            checkDateAndRefreshDropdown('feed', this.value);
        });
    }

    function checkDateAndRefreshDropdown(type, selectedDate) {
        const today = new Date().toISOString().split('T')[0];
        const activeType = document.querySelector('.qr-tab.active')?.dataset.type;
        if (activeType !== type) return;

        const sel  = document.getElementById('qrCattleSelect');
        const hint = document.getElementById('qrCattleHint');
        if (!sel) return;

        if (selectedDate === today) {
            // Re-apply today's filter
            populateCattleForType(type);
        } else {
            // Past/future date — show ALL cattle
            sel.innerHTML = '<option value="">Select cattle...</option>';
            allCattleCache.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = `${c.name}${c.tag_no ? ' (#' + c.tag_no + ')' : ''} — ${c.breed}`;
                sel.appendChild(opt);
            });
            if (hint) hint.textContent = '';
        }
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
        const qty  = parseFloat(feed.quantity);
        const min  = parseFloat(feed.min_quantity || 0);
        const low  = qty <= min;
        txt.textContent = `Available: ${qty.toFixed(1)} kg  ·  ₹${parseFloat(feed.cost_per_kg).toFixed(2)}/kg${low ? '  ⚠ Low stock' : ''}`;
        info.classList.toggle('low-stock', low);
    }

    // ===========================
    // SUBMIT QUICK RECORD
    // ===========================
    function submitQuickRecord() {
        clearQrError();
        const cattleId = document.getElementById('qrCattleSelect')?.value;
        if (!cattleId) { showQrError('Please select a cattle first.'); return; }

        const type = document.querySelector('.qr-tab.active')?.dataset.type;
        if (type === 'milk')   submitQrMilk(cattleId);
        else if (type === 'health') submitQrHealth(cattleId);
        else if (type === 'feed')   submitQrFeed(cattleId);
    }

    function submitQrMilk(cattleId) {
        const date    = document.getElementById('qrMilkDate')?.value;
        const morning = parseFloat(document.getElementById('qrMilkMorning')?.value || '');
        const evening = parseFloat(document.getElementById('qrMilkEvening')?.value || '');
        const rate    = parseFloat(document.getElementById('qrMilkRate')?.value    || '');

        if (!date)               { showQrError('Please select a date.'); return; }
        if (isNaN(morning))      { showQrError('Please enter morning liters.'); return; }
        if (isNaN(evening))      { showQrError('Please enter evening liters.'); return; }
        if (isNaN(rate)||rate<=0){ showQrError('Please enter a valid rate.'); return; }

        postJson(`/cattle/${cattleId}/add-milk`, { date, morning_liters: morning, evening_liters: evening, rate })
            .then(res => {
                if (res.success) {
                    closeQrModal();
                    showToast('Milk record added!', 'success');
                    setTimeout(() => location.reload(), 900);
                } else { showQrError(res.error || 'Failed to save.'); }
            });
    }

    function submitQrHealth(cattleId) {
        const issue = document.getElementById('qrHealthIssue')?.value?.trim();
        const treat = document.getElementById('qrHealthTreatment')?.value?.trim();
        const vet   = document.getElementById('qrHealthVet')?.value?.trim();
        const next  = document.getElementById('qrHealthNextCheckup')?.value || null;
        const cost  = parseFloat(document.getElementById('qrHealthCost')?.value || '0') || 0;

        if (!issue) { showQrError('Please describe the issue.'); return; }
        if (!treat) { showQrError('Please describe the treatment.'); return; }
        if (!vet)   { showQrError('Please enter veterinarian name.'); return; }

        postJson(`/cattle/${cattleId}/add-health`, { issue, treatment: treat, vet_name: vet, next_checkup: next, treatment_cost: cost })
            .then(res => {
                if (res.success) { closeQrModal(); showToast('Health record added!', 'success'); setTimeout(() => location.reload(), 900); }
                else { showQrError(res.error || 'Failed.'); }
            });
    }

    function submitQrFeed(cattleId) {
        const feedId = document.getElementById('qrFeedTypeSelect')?.value;
        const qty    = parseFloat(document.getElementById('qrFeedQty')?.value || '');
        const date   = document.getElementById('qrFeedDate')?.value;

        if (!date)            { showQrError('Please select a date.'); return; }
        if (!feedId)          { showQrError('Please select a feed type.'); return; }
        if (isNaN(qty)||qty<=0){ showQrError('Please enter a valid quantity.'); return; }

        postJson(`/cattle/${cattleId}/add-feed`, { feed_id: parseInt(feedId), quantity_used: qty, usage_date: date, cattle_id: parseInt(cattleId) })
            .then(res => {
                if (res.success) { closeQrModal(); showToast('Feed record added!', 'success'); setTimeout(() => location.reload(), 900); }
                else { showQrError(res.error || 'Failed.'); }
            });
    }

    // ===========================
    // REPORT MODAL
    // ===========================
    function openReportModal() {
        new bootstrap.Modal(document.getElementById('reportRangeModal')).show();
    }

    // ===========================
    // jsPDF REPORT — client-side, attractive
    // ===========================
    async function generateJsPdfReport() {
        const startStr = document.getElementById('rptStart')?.value;
        const endStr   = document.getElementById('rptEnd')?.value;

        if (!startStr || !endStr) { showToast('Please select both dates.', 'error'); return; }
        if (new Date(startStr) > new Date(endStr)) { showToast('Start date must be before end date.', 'error'); return; }

        showToast('Generating report…', 'info');

        let cattleData = [], milkSummary = [], feedData = [];
        try {
            const [cattleRes, milkRes, feedRes] = await Promise.all([
                fetch('/api/cattle-list').then(r => r.json()),
                fetch(`/api/report-data?start=${startStr}&end=${endStr}`).then(r => r.json()),
                fetch(`/api/report-data?start=${startStr}&end=${endStr}`).then(r => r.json())
            ]);
            cattleData  = cattleRes.cattle  || [];
            milkSummary = milkRes.milk_summary   || [];
            feedData    = milkRes.feed_summary   || [];
        } catch (e) {
            showToast('Could not fetch report data.', 'error');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        const W  = 210;
        const PL = 14;
        const PR = W - PL;
        let y = 0;

        // ── totals ──────────────────────────────
        const totalMilk     = milkSummary.reduce((s, r) => s + parseFloat(r.total_milk   || 0), 0);
        const totalIncome   = milkSummary.reduce((s, r) => s + parseFloat(r.total_income || 0), 0);
        const totalFeedCost = feedData.reduce((s, r)    => s + parseFloat(r.total_cost   || 0), 0);
        const netProfit     = totalIncome - totalFeedCost;

        // ── helpers ──────────────────────────────
        function checkBreak(needed) {
            if (y + needed > 272) { doc.addPage(); y = 16; }
        }

        // ════════════════════════════════════════
        // HEADER — white bg, indigo top stripe
        // matches the reference HTML aesthetic
        // ════════════════════════════════════════
        // top indigo stripe
        doc.setFillColor(102, 126, 234);
        doc.rect(0, 0, W, 2, 'F');

        // white header area
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 2, W, 38, 'F');

        // logo pill (gradient-brand style)
        doc.setFillColor(102, 126, 234);
        doc.roundedRect(PL, 8, 10, 10, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('CC', PL + 2.2, 14.5);

        // brand name
        doc.setTextColor(31, 41, 55);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('Cattle-Cloud', PL + 13, 15);

        // report subtitle
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text('Farm Overview Report', PL + 13, 21);

        // right — date range
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(`Period:  ${fmtDate(startStr)}  –  ${fmtDate(endStr)}`, PR, 13, { align: 'right' });
        doc.setFontSize(7.5);
        doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}`, PR, 19, { align: 'right' });

        // divider under header
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.line(0, 40, W, 40);

        y = 50;

        // ════════════════════════════════════════
        // STAT CARDS — 4 across, white bg, border
        // exact same card style as reference HTML
        // ════════════════════════════════════════
        const stats = [
            { label: 'Total Cattle',  val: String(cattleData.length), unit: 'head',   accent: [102,126,234] },
            { label: 'Milk Produced', val: `${totalMilk.toFixed(1)} L`, unit: '',     accent: [118,75,162] },
            { label: 'Milk Revenue',  val: `Rs.${fmt(Math.round(totalIncome))}`, unit:'', accent: [34,197,94] },
            { label: 'Net Profit',
            val: `${netProfit < 0 ? '-' : ''}Rs.${fmt(Math.round(Math.abs(netProfit)))}`,
            unit: '', accent: netProfit >= 0 ? [34,197,94] : [239,68,68] },
        ];

        const cW = (PR - PL - 6) / 4;
        stats.forEach((s, i) => {
            const cx = PL + i * (cW + 2);
            // card white bg + border
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.25);
            doc.roundedRect(cx, y, cW, 20, 1.5, 1.5, 'FD');
            // label
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(107, 114, 128);
            doc.text(s.label, cx + cW / 2, y + 6.5, { align: 'center' });
            // value
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...s.accent);
            doc.text(s.val, cx + cW / 2, y + 14, { align: 'center' });
            // unit
            if (s.unit) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(6);
                doc.setTextColor(156, 163, 175);
                doc.text(s.unit, cx + cW / 2, y + 18.5, { align: 'center' });
            }
        });

        y += 28;

        // ════════════════════════════════════════
        // SECTION TITLE helper — matches HTML h2
        // ════════════════════════════════════════
        function sectionTitle(label) {
            checkBreak(18);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(31, 41, 55);
            doc.text(label, PL, y);
            // underline
            doc.setDrawColor(102, 126, 234);
            doc.setLineWidth(0.5);
            doc.line(PL, y + 1.5, PL + doc.getTextWidth(label), y + 1.5);
            y += 8;
        }

        const headStyle = (bg, fg) => ({
            fillColor: bg, textColor: fg,
            fontStyle: 'bold', fontSize: 8,
            halign: 'left', cellPadding: 3
        });
        const bodyStyle = {
            fontSize: 7.5, textColor: [55, 65, 81],
            cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 }
        };

        // ════════════════════════════════════════
        // MILK PRODUCTION
        // ════════════════════════════════════════
        if (milkSummary.length > 0) {
            checkBreak(45);
            sectionTitle('Milk Production');
            doc.autoTable({
                startY: y,
                head: [['Cattle', 'Tag No', 'Total Milk (L)', 'Avg/Day (L)', 'Revenue (Rs.)', 'Records']],
                body: milkSummary.map(r => [
                    r.name,
                    r.tag_no || '—',
                    parseFloat(r.total_milk  || 0).toFixed(1),
                    parseFloat(r.avg_milk    || 0).toFixed(1),
                    `Rs. ${fmt(Math.round(r.total_income || 0))}`,
                    String(r.records || 0)
                ]),
                headStyles: headStyle([102, 126, 234], [255, 255, 255]),
                bodyStyles: bodyStyle,
                alternateRowStyles: { fillColor: [248, 249, 252] },
                columnStyles: {
                    2: { halign: 'right' }, 3: { halign: 'right' },
                    4: { halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] },
                    5: { halign: 'center' }
                },
                margin: { left: PL, right: PL },
                tableLineColor: [229, 231, 235], tableLineWidth: 0.15,
            });
            y = doc.lastAutoTable.finalY + 12;
        }

        // ════════════════════════════════════════
        // FEED USAGE
        // ════════════════════════════════════════
        if (feedData.length > 0) {
            checkBreak(45);
            sectionTitle('Feed Usage');
            doc.autoTable({
                startY: y,
                head: [['Feed Type', 'Total Used (kg)', 'Rate (Rs./kg)', 'Total Cost (Rs.)']],
                body: feedData.map(r => [
                    r.feed_name,
                    parseFloat(r.total_qty  || 0).toFixed(1),
                    `Rs. ${parseFloat(r.cost_per_kg || 0).toFixed(2)}`,
                    `Rs. ${fmt(Math.round(r.total_cost || 0))}`
                ]),
                headStyles: headStyle([118, 75, 162], [255, 255, 255]),
                bodyStyles: bodyStyle,
                alternateRowStyles: { fillColor: [250, 248, 255] },
                columnStyles: {
                    1: { halign: 'right' },
                    2: { halign: 'right' },
                    3: { halign: 'right', fontStyle: 'bold' }
                },
                margin: { left: PL, right: PL },
                tableLineColor: [229, 231, 235], tableLineWidth: 0.15,
            });
            y = doc.lastAutoTable.finalY + 12;
        }

        // ════════════════════════════════════════
        // CATTLE REGISTRY
        // ════════════════════════════════════════
        checkBreak(45);
        sectionTitle('Cattle Registry');
        doc.autoTable({
            startY: y,
            head: [['Name', 'Tag No', 'Breed', 'Age', 'Gender', 'Health Status']],
            body: cattleData.map(c => [
                c.name, c.tag_no || '—', c.breed || '—',
                c.age ? `${c.age} yrs` : '—', c.gender || '—', c.health || 'Healthy'
            ]),
            headStyles: headStyle([31, 41, 55], [255, 255, 255]),
            bodyStyles: bodyStyle,
            alternateRowStyles: { fillColor: [249, 250, 251] },
            margin: { left: PL, right: PL },
            tableLineColor: [229, 231, 235], tableLineWidth: 0.15,
        });
        y = doc.lastAutoTable.finalY + 12;

        // ════════════════════════════════════════
        // FOOTER — every page
        // ════════════════════════════════════════
        const totalPages = doc.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setFillColor(248, 249, 252);
            doc.rect(0, 285, W, 12, 'F');
            doc.setDrawColor(229, 231, 235);
            doc.setLineWidth(0.2);
            doc.line(0, 285, W, 285);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(156, 163, 175);
            doc.text('Cattle-Cloud Farm Management', PL, 291);
            doc.text(`Page ${p} of ${totalPages}`, W / 2, 291, { align: 'center' });
            doc.text(`${new Date().getFullYear()} · Confidential`, PR, 291, { align: 'right' });
        }

        doc.save(`CattleCloud_Report_${startStr}_to_${endStr}.pdf`);
        showToast('Report downloaded!', 'success');
        bootstrap.Modal.getInstance(document.getElementById('reportRangeModal'))?.hide();
    }

    function fmt(n) {
        return Number(n).toLocaleString('en-IN');
    }

    function fmtDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    // ===========================
    // UTILITIES
    // ===========================
    function postJson(url, payload) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => r.json()).catch(() => ({ success: false, error: 'Network error.' }));
    }

    function closeQrModal() {
        bootstrap.Modal.getInstance(document.getElementById('quickRecordModal'))?.hide();
    }

    function showQrError(msg) {
        const bar = document.getElementById('qrErrorBar');
        const txt = document.getElementById('qrErrorMsg');
        if (bar && txt) { txt.textContent = msg; bar.style.display = 'flex'; }
    }

    function clearQrError() {
        const bar = document.getElementById('qrErrorBar');
        if (bar) bar.style.display = 'none';
    }

    function showToast(message, type) {
        const colors = { success: '#22c55e', error: '#ef4444', info: '#667eea' };
        const icons  = { success: 'check_circle', error: 'error', info: 'info' };
        const c = colors[type] || colors.info;
        const ic = icons[type] || icons.info;

        const t = document.createElement('div');
        t.style.cssText = [
            'position:fixed','top:20px','right:20px','z-index:9999',
            'background:#fff','padding:.875rem 1.25rem','border-radius:10px',
            'box-shadow:0 4px 20px rgba(0,0,0,0.12)',
            'display:flex','align-items:center','gap:.75rem',
            "font-family:'Lexend',sans-serif",'font-weight:500','font-size:.9375rem',
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

    window.addEventListener('resize', () => { if (productionChart) productionChart.resize(); });