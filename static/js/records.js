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
        rows.forEach(row => {
            const d = row.dataset.date;
            row.style.display =
                !startDate || !endDate || (d >= startDate && d <= endDate)
                    ? ""
                    : "none";
        });
    };

    filterRows(document.querySelectorAll("#milkRecordsBody tr"));
    filterRows(document.querySelectorAll("#expenseRecordsBody tr"));
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
        btn.textContent = "Generate Milk Report";
        btn.className = "generate-report-btn milk";
        btn.onclick = generateMilkReportFiltered;
    } else {
        btn.textContent = "Generate Expense Report";
        btn.className = "generate-report-btn expense";
        btn.onclick = generateExpenseReportFiltered;
    }
}

// =============================
// FILTERED REPORT GENERATION
// =============================
function generateMilkReportFiltered() {
    const rows = Array.from(document.querySelectorAll("#milkRecordsBody tr"))
        .filter(r => r.style.display !== "none");

    if (!rows.length) return alert("No milk records available");
    generateMilkPDF(rows);
}

function generateExpenseReportFiltered() {
    const rows = Array.from(document.querySelectorAll("#expenseRecordsBody tr"))
        .filter(r => r.style.display !== "none");

    if (!rows.length) return alert("No expense records available");
    generateExpensePDF(rows);
}

// =============================
// PDF GENERATION
// =============================
function generateMilkPDF(rows) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 50, totalMilk = 0, totalIncome = 0;
    let page = 1;

    // ===== Header =====
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, "bold");
    doc.text("CattleTrack Pro", 105, 18, { align: "center" });

    doc.setFontSize(14);
    doc.setFont(undefined, "normal");
    doc.text("Milk Records Report", 105, 30, { align: "center" });

    doc.setTextColor(0);

    // ===== Table Header =====
    const drawTableHeader = () => {
        doc.setFillColor(237, 242, 247);
        doc.rect(10, y - 7, 190, 10, "F");

        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("Date", 12, y);
        doc.text("Cow", 45, y);
        doc.text("Milk (L)", 95, y);
        doc.text("Rate (₹)", 125, y);
        doc.text("Income (₹)", 160, y);

        y += 8;
        doc.setFont(undefined, "normal");
    };

    drawTableHeader();

    // ===== Table Rows =====
    rows.forEach((row, i) => {
        const cols = row.querySelectorAll("td");

        const milk = parseFloat(cols[2].innerText.replace("L", ""));
        const rate = parseFloat(cols[3].innerText.replace("₹", ""));
        const income = parseFloat(cols[4].innerText.replace("₹", ""));

        totalMilk += milk;
        totalIncome += income;

        if (y > 270) {
            doc.text(`Page ${page}`, 190, 290);
            doc.addPage();
            page++;
            y = 30;
            drawTableHeader();
        }

        if (i % 2 === 0) {
            doc.setFillColor(249, 250, 251);
            doc.rect(10, y - 6, 190, 8, "F");
        }

        doc.text(cols[0].innerText, 12, y);
        doc.text(cols[1].innerText, 45, y);
        doc.text(milk.toString(), 95, y);
        doc.text(rate.toString(), 125, y);
        doc.text(income.toString(), 160, y);

        y += 8;
    });

    // ===== Summary Box =====
    y += 8;
    doc.setFillColor(247, 250, 252);
    doc.rect(10, y, 190, 20, "F");

    doc.setFont(undefined, "bold");
    doc.text(`Total Milk Produced: ${totalMilk.toFixed(1)} L`, 15, y + 8);
    doc.text(`Total Income: ₹${totalIncome.toFixed(2)}`, 120, y + 8);

    doc.text(`Page ${page}`, 190, 290);
    doc.save("Milk_Report.pdf");
}
function generateExpensePDF(rows) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    let y = 50, total = 0;
    let page = 1;

    // ===== Header =====
    doc.setFillColor(72, 187, 120);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont(undefined, "bold");
    doc.text("CattleTrack Pro", 105, 18, { align: "center" });

    doc.setFontSize(14);
    doc.setFont(undefined, "normal");
    doc.text("Expense Records Report", 105, 30, { align: "center" });

    doc.setTextColor(0);

    // ===== Table Header =====
    const drawTableHeader = () => {
        doc.setFillColor(237, 247, 242);
        doc.rect(20, y - 7, 170, 10, "F");

        doc.setFontSize(11);
        doc.setFont(undefined, "bold");
        doc.text("Date", 22, y);
        doc.text("Expense Type", 90, y);
        doc.text("Amount (₹)", 160, y);

        y += 8;
        doc.setFont(undefined, "normal");
    };

    drawTableHeader();

    // ===== Rows =====
    rows.forEach((row, i) => {
        const cols = row.querySelectorAll("td");
        const amount = parseFloat(cols[2].innerText.replace("₹", ""));
        total += amount;

        if (y > 270) {
            doc.text(`Page ${page}`, 190, 290);
            doc.addPage();
            page++;
            y = 30;
            drawTableHeader();
        }

        if (i % 2 === 0) {
            doc.setFillColor(249, 252, 250);
            doc.rect(20, y - 6, 170, 8, "F");
        }

        doc.text(cols[0].innerText, 22, y);
        doc.text(cols[1].innerText, 90, y);
        doc.text(amount.toString(), 160, y);

        y += 8;
    });

    // ===== Summary =====
    y += 8;
    doc.setFillColor(240, 253, 244);
    doc.rect(20, y, 170, 15, "F");

    doc.setFont(undefined, "bold");
    doc.text(`Total Expense: ₹${total.toFixed(2)}`, 30, y + 10);

    doc.text(`Page ${page}`, 190, 290);
    doc.save("Expense_Report.pdf");
}
