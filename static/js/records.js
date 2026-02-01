// =============================
// TAB + FILTER LOGIC
// =============================
let currentTab = "milk";

function switchTab(event, tabType) {
    currentTab = tabType;

    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    event.target.classList.add("active");

    document.querySelectorAll(".table-section").forEach(s => s.classList.remove("active"));
    document.getElementById(tabType + "Table").classList.add("active");

    updateGenerateButton();
}

function applyFilter() {
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;

    const filterRows = rows => {
        let visibleCount = 0;
        rows.forEach(row => {
            const d = row.dataset.date;
            const isVisible = !startDate || !endDate || (d >= startDate && d <= endDate);
            row.style.display = isVisible ? "" : "none";
            if (isVisible) visibleCount++;
        });
        return visibleCount;
    };

    const milkVisible = filterRows(document.querySelectorAll("#milkRecordsBody tr"));
    const expenseVisible = filterRows(document.querySelectorAll("#expenseRecordsBody tr"));
    
    // Update showing counts
    document.getElementById("milkShowing").textContent = milkVisible;
    document.getElementById("expenseShowing").textContent = expenseVisible;
}

function changeEntriesPerPage() {
    const perPage = document.getElementById("entriesPerPage").value;
    window.location.href = `/records?per_page=${perPage}`;
}

window.onload = function () {
    const today = new Date();
    const lastWeek = new Date(today.getTime() - 7 * 86400000);

    document.getElementById("filterEndDate").valueAsDate = today;
    document.getElementById("filterStartDate").valueAsDate = lastWeek;

    updateGenerateButton();
};

// =============================
// GENERATE BUTTON LOGIC
// =============================
function updateGenerateButton() {
    const btn = document.getElementById("generateReportBtn");

    if (currentTab === "milk") {
        btn.textContent = "📄  Milk Report";
        btn.className = "generate-report-btn milk";
        btn.onclick = generatePDFReport;
    } else {
        btn.textContent = "📄 Expense Report";
        btn.className = "generate-report-btn expense";
        btn.onclick = generatePDFReport;
    }
}

// =============================
// PYTHON PDF GENERATION
// =============================
function generatePDFReport() {
    const startDate = document.getElementById("filterStartDate").value;
    const endDate = document.getElementById("filterEndDate").value;
    
    // Show loading overlay
    document.getElementById("loadingOverlay").style.display = "flex";
    
    fetch("/api/records/generate-pdf", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            report_type: currentTab,
            start_date: startDate,
            end_date: endDate
        })
    })
    .then(response => response.json())
    .then(data => {
        // Hide loading overlay
        document.getElementById("loadingOverlay").style.display = "none";
        
        if (data.success) {
            // Create temporary link and trigger download
            const link = document.createElement('a');
            link.href = data.file_path;
            link.download = data.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Show success message
            showNotification("PDF report generated successfully!", "success");
        } else {
            showNotification(data.error || "Failed to generate PDF", "error");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        document.getElementById("loadingOverlay").style.display = "none";
        showNotification("An error occurred while generating the report", "error");
    });
}

// =============================
// LOAD MORE RECORDS
// =============================
function loadMoreRecords(type) {
    const limit = parseInt(document.getElementById("entriesPerPage").value);
    const offset = type === 'milk' ? milkOffset : expenseOffset;
    
    fetch("/api/records/load-more", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            type: type,
            offset: offset,
            limit: limit
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.records.length > 0) {
            const tbody = document.getElementById(type === 'milk' ? 'milkRecordsBody' : 'expenseRecordsBody');
            
            data.records.forEach(record => {
                const row = document.createElement('tr');
                row.dataset.date = record.date;
                
                if (type === 'milk') {
                    row.innerHTML = `
                        <td>${record.date}</td>
                        <td><strong>${record.cow_name}</strong></td>
                        <td>${record.quantity}L</td>
                        <td>₹${record.rate}</td>
                        <td><strong>₹${record.income}</strong></td>
                    `;
                } else {
                    row.innerHTML = `
                        <td>${record.date}</td>
                        <td><strong>${record.type}</strong></td>
                        <td><strong>₹${record.amount}</strong></td>
                    `;
                }
                
                tbody.appendChild(row);
            });
            
            // Update offset
            if (type === 'milk') {
                milkOffset += data.records.length;
                document.getElementById("milkShowing").textContent = milkOffset;
                
                // Hide button if no more records
                if (milkOffset >= totalMilk) {
                    const container = document.querySelector('#milkTable .load-more-container');
                    if (container) container.style.display = 'none';
                }
            } else {
                expenseOffset += data.records.length;
                document.getElementById("expenseShowing").textContent = expenseOffset;
                
                // Hide button if no more records
                if (expenseOffset >= totalExpenses) {
                    const container = document.querySelector('#expenseTable .load-more-container');
                    if (container) container.style.display = 'none';
                }
            }
            
            showNotification(`Loaded ${data.records.length} more records`, "success");
        } else {
            showNotification("No more records to load", "info");
        }
    })
    .catch(error => {
        console.error("Error:", error);
        showNotification("Failed to load more records", "error");
    });
}

// =============================
// NOTIFICATION SYSTEM
// =============================
function showNotification(message, type = "info") {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.classList.add('fade-out');
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}