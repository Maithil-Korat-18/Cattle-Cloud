// Global variables
let currentViewType = 'last_7';
let currentData = [];
let currentReportData = null;
let cattleId = null;

// Initialize on page load
window.onload = function() {
    console.log('Page loaded, initializing...');
    
    // Get cattle ID and initial data from page
    const pageData = document.getElementById('pageData');
    if (pageData) {
        cattleId = pageData.dataset.cattleId;
        console.log('Cattle ID:', cattleId);
        
        const defaultHistory = pageData.dataset.history;
        console.log('Default history data:', defaultHistory);
        
        if (defaultHistory) {
            try {
                currentData = JSON.parse(defaultHistory);
                console.log('Parsed data:', currentData);
                
                if (currentData && currentData.length > 0) {
                    drawChart(currentData);
                } else {
                    console.warn('No data available in default history');
                }
            } catch (e) {
                console.error('Error parsing default history:', e);
                console.error('Raw data:', defaultHistory);
            }
        } else {
            console.warn('No default history data attribute found');
        }
    } else {
        console.error('pageData element not found!');
    }
    
    setupNavigation();
    setMaxDate();
}

// Setup navigation dropdown
function setupNavigation() {
    const profileBtn = document.getElementById('profileBtn');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');

    if (profileBtn && dropdownMenu) {
        profileBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        });

        document.addEventListener('click', function() {
            dropdownMenu.classList.remove('show');
        });
    }

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }
}

// Set max date for date inputs
function setMaxDate() {
    const today = new Date().toISOString().split('T')[0];
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    if (startDate) startDate.max = today;
    if (endDate) endDate.max = today;
}

// Change view handler
function changeView(event, viewType) {
    currentViewType = viewType;
    
    // Update button states
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show/hide custom range filter
    const customRange = document.getElementById('customRangeFilter');
    if (viewType === 'custom') {
        customRange.classList.add('show');
        return;
    } else {
        customRange.classList.remove('show');
    }
    
    // Fetch data from backend
    fetchFilteredData(viewType);
}

// Apply custom date range
function applyCustomRange() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        alert('Please select both start and end dates');
        return;
    }
    
    if (startDate > endDate) {
        alert('Start date must be before end date');
        return;
    }
    
    fetchFilteredData('custom', startDate, endDate);
}

// Fetch filtered data from backend
function fetchFilteredData(viewType, startDate = null, endDate = null) {
    const requestData = {
        view_type: viewType
    };
    
    if (viewType === 'custom') {
        requestData.start_date = startDate;
        requestData.end_date = endDate;
    }
    
    console.log('Fetching data:', requestData);
    
    fetch(`/api/cattle/${cattleId}/filter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('API Response:', result);
        
        if (result.success && result.data) {
            currentData = result.data.history || [];
            updateDisplay(result.data, viewType);
        } else {
            console.error('API returned success=false or missing data');
            showSuccess('Error: Could not load data');
        }
    })
    .catch(error => {
        console.error('Fetch error:', error);
        showSuccess('Error connecting to server: ' + error.message);
    });
}

// Update display with new data
function updateDisplay(data, viewType) {
    // Update average display
    const avgLabel = document.getElementById('averageLabel');
    const avgValue = document.getElementById('averageValue');
    
    if (viewType === 'last_7') {
        avgLabel.textContent = 'Average Milk (Last 7 Days)';
    } else if (viewType === 'last_30') {
        avgLabel.textContent = 'Average Milk (Last 30 Days)';
    } else if (viewType === 'all_time') {
        avgLabel.textContent = 'Average Milk (All Time)';
    } else {
        avgLabel.textContent = 'Average Milk (Custom Range)';
    }
    avgValue.textContent = data.avg_milk + ' Liters/day';
    
    // Update chart title
    const chartTitle = document.getElementById('chartTitle');
    if (viewType === 'last_7') {
        chartTitle.textContent = 'Milk Performance (Last 7 Days)';
    } else if (viewType === 'last_30') {
        chartTitle.textContent = 'Milk Performance (Last 30 Days)';
    } else if (viewType === 'all_time') {
        chartTitle.textContent = 'Milk Performance (All Time)';
    } else {
        chartTitle.textContent = 'Milk Performance (Custom Range)';
    }
    
    // Redraw chart
    drawChart(data.history);
}

// Enhanced chart drawing with attractive styling
function drawChart(data) {
    const svg = document.getElementById('milkChart');
    const width = svg.clientWidth;
    const height = svg.clientHeight;
    const padding = { top: 40, right: 40, bottom: 80, left: 80 };
    
    // Clear previous chart
    svg.innerHTML = '';
    
    if (!data || data.length === 0) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', width / 2);
        text.setAttribute('y', height / 2);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#718096');
        text.setAttribute('font-size', '18');
        text.textContent = 'No data available for selected range';
        svg.appendChild(text);
        return;
    }
    
    // Calculate scales
    const maxMilk = Math.max(...data.map(d => d.quantity));
    const minMilk = Math.min(...data.map(d => d.quantity));
    const range = maxMilk - minMilk;
    const yMax = maxMilk + (range * 0.2); // Add 20% padding
    const yMin = Math.max(0, minMilk - (range * 0.1)); // Add 10% padding below
    
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const xStep = chartWidth / (data.length - 1);
    const yScale = chartHeight / (yMax - yMin);
    
    // Create gradient for area fill
    const gradient = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const linearGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    linearGradient.setAttribute('id', 'areaGradient');
    linearGradient.setAttribute('x1', '0%');
    linearGradient.setAttribute('y1', '0%');
    linearGradient.setAttribute('x2', '0%');
    linearGradient.setAttribute('y2', '100%');
    
    const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop1.setAttribute('offset', '0%');
    stop1.setAttribute('style', 'stop-color:#667eea;stop-opacity:0.3');
    
    const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    stop2.setAttribute('offset', '100%');
    stop2.setAttribute('style', 'stop-color:#764ba2;stop-opacity:0.05');
    
    linearGradient.appendChild(stop1);
    linearGradient.appendChild(stop2);
    gradient.appendChild(linearGradient);
    svg.appendChild(gradient);
    
    // Draw grid lines
    const gridSteps = 5;
    for (let i = 0; i <= gridSteps; i++) {
        const y = padding.top + (chartHeight / gridSteps) * i;
        
        const gridLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        gridLine.setAttribute('x1', padding.left);
        gridLine.setAttribute('y1', y);
        gridLine.setAttribute('x2', width - padding.right);
        gridLine.setAttribute('y2', y);
        gridLine.setAttribute('stroke', '#e2e8f0');
        gridLine.setAttribute('stroke-width', '1');
        gridLine.setAttribute('stroke-dasharray', '5,5');
        svg.appendChild(gridLine);
        
        // Y-axis labels
        const value = yMax - (yMax - yMin) * (i / gridSteps);
        const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        label.setAttribute('x', padding.left - 15);
        label.setAttribute('y', y + 5);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('font-size', '12');
        label.setAttribute('fill', '#718096');
        label.setAttribute('font-weight', '600');
        label.textContent = value.toFixed(0) + 'L';
        svg.appendChild(label);
    }
    
    // Draw axes
    const xAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    xAxis.setAttribute('x1', padding.left);
    xAxis.setAttribute('y1', height - padding.bottom);
    xAxis.setAttribute('x2', width - padding.right);
    xAxis.setAttribute('y2', height - padding.bottom);
    xAxis.setAttribute('stroke', '#cbd5e0');
    xAxis.setAttribute('stroke-width', '2');
    svg.appendChild(xAxis);
    
    const yAxis = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    yAxis.setAttribute('x1', padding.left);
    yAxis.setAttribute('y1', padding.top);
    yAxis.setAttribute('x2', padding.left);
    yAxis.setAttribute('y2', height - padding.bottom);
    yAxis.setAttribute('stroke', '#cbd5e0');
    yAxis.setAttribute('stroke-width', '2');
    svg.appendChild(yAxis);
    
    // Build path data for line and area
    let linePath = '';
    let areaPath = '';
    
    data.forEach((record, index) => {
        const x = padding.left + (index * xStep);
        const y = height - padding.bottom - ((record.quantity - yMin) * yScale);
        
        if (index === 0) {
            linePath += `M ${x} ${y}`;
            areaPath += `M ${x} ${height - padding.bottom} L ${x} ${y}`;
        } else {
            linePath += ` L ${x} ${y}`;
            areaPath += ` L ${x} ${y}`;
        }
        
        if (index === data.length - 1) {
            areaPath += ` L ${x} ${height - padding.bottom} Z`;
        }
    });
    
    // Draw area fill
    const area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    area.setAttribute('d', areaPath);
    area.setAttribute('fill', 'url(#areaGradient)');
    area.setAttribute('class', 'chart-area');
    svg.appendChild(area);
    
    // Draw line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    line.setAttribute('d', linePath);
    line.setAttribute('stroke', 'url(#lineGradient)');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('fill', 'none');
    line.setAttribute('class', 'chart-line');
    
    // Create gradient for line
    const lineGrad = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    lineGrad.setAttribute('id', 'lineGradient');
    lineGrad.setAttribute('x1', '0%');
    lineGrad.setAttribute('y1', '0%');
    lineGrad.setAttribute('x2', '100%');
    lineGrad.setAttribute('y2', '0%');
    
    const lineStop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    lineStop1.setAttribute('offset', '0%');
    lineStop1.setAttribute('style', 'stop-color:#667eea;stop-opacity:1');
    
    const lineStop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
    lineStop2.setAttribute('offset', '100%');
    lineStop2.setAttribute('style', 'stop-color:#764ba2;stop-opacity:1');
    
    lineGrad.appendChild(lineStop1);
    lineGrad.appendChild(lineStop2);
    gradient.appendChild(lineGrad);
    
    svg.appendChild(line);
    
    // Draw points and labels
    data.forEach((record, index) => {
        const x = padding.left + (index * xStep);
        const y = height - padding.bottom - ((record.quantity - yMin) * yScale);
        
        // Draw point with glow effect
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', x);
        circle.setAttribute('cy', y);
        circle.setAttribute('r', '6');
        circle.setAttribute('fill', '#667eea');
        circle.setAttribute('class', 'chart-point');
        circle.setAttribute('stroke', 'white');
        circle.setAttribute('stroke-width', '3');
        
        // Add tooltip on hover
        circle.addEventListener('mouseenter', function() {
            showTooltip(x, y, record.quantity, record.date);
        });
        circle.addEventListener('mouseleave', hideTooltip);
        
        svg.appendChild(circle);
        
        // Draw value label (show every nth point for clarity)
        const showInterval = Math.max(1, Math.floor(data.length / 10));
        if (index % showInterval === 0 || index === data.length - 1) {
            const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            label.setAttribute('x', x);
            label.setAttribute('y', y - 15);
            label.setAttribute('text-anchor', 'middle');
            label.setAttribute('font-size', '12');
            label.setAttribute('fill', '#2d3748');
            label.setAttribute('font-weight', '700');
            label.textContent = record.quantity + 'L';
            svg.appendChild(label);
        }
        
        // Draw date label (show every nth date for clarity)
        if (index % showInterval === 0 || index === data.length - 1) {
            const dateLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            dateLabel.setAttribute('x', x);
            dateLabel.setAttribute('y', height - padding.bottom + 25);
            dateLabel.setAttribute('text-anchor', 'middle');
            dateLabel.setAttribute('font-size', '11');
            dateLabel.setAttribute('fill', '#718096');
            dateLabel.setAttribute('font-weight', '600');
            
            // Format date based on data length
            let dateText = record.date.substring(5); // MM-DD
            if (data.length > 30) {
                dateText = record.date.substring(2); // YY-MM-DD
            }
            dateLabel.textContent = dateText;
            svg.appendChild(dateLabel);
        }
    });
}

// Tooltip functions
function showTooltip(x, y, quantity, date) {
    const svg = document.getElementById('milkChart');
    const tooltip = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    tooltip.setAttribute('id', 'chartTooltip');
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x - 60);
    rect.setAttribute('y', y - 60);
    rect.setAttribute('width', '120');
    rect.setAttribute('height', '45');
    rect.setAttribute('fill', 'white');
    rect.setAttribute('stroke', '#667eea');
    rect.setAttribute('stroke-width', '2');
    rect.setAttribute('rx', '8');
    rect.setAttribute('filter', 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))');
    
    const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text1.setAttribute('x', x);
    text1.setAttribute('y', y - 35);
    text1.setAttribute('text-anchor', 'middle');
    text1.setAttribute('font-size', '14');
    text1.setAttribute('fill', '#2d3748');
    text1.setAttribute('font-weight', '700');
    text1.textContent = quantity + ' Liters';
    
    const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text2.setAttribute('x', x);
    text2.setAttribute('y', y - 20);
    text2.setAttribute('text-anchor', 'middle');
    text2.setAttribute('font-size', '12');
    text2.setAttribute('fill', '#718096');
    text2.textContent = date;
    
    tooltip.appendChild(rect);
    tooltip.appendChild(text1);
    tooltip.appendChild(text2);
    svg.appendChild(tooltip);
}

function hideTooltip() {
    const tooltip = document.getElementById('chartTooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Open report modal
function openReportModal() {
    // Check if we have cattle ID
    if (!cattleId) {
        console.error('No cattle ID found');
        showSuccess('Error: Cattle ID not found');
        return;
    }
    const total = currentData.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
);

const average = (total / currentData.length).toFixed(1);

const highest = currentData.reduce(
    (max, item) =>
        Number(item.quantity) > Number(max.quantity) ? item : max,
    currentData[0]
);
    // Use current data if available, otherwise fetch from backend
    if (currentData && currentData.length > 0) {
        // Calculate statistics from current data
        const total = currentData.reduce(
    (sum, item) => sum + Number(item.quantity),
    0
);
        const average = (total / currentData.length).toFixed(1);
        const highest = currentData.reduce((max, item) => 
    Number(item.quantity) > Number(max.quantity) ? item : max,
    currentData[0]
);
        
        const pageData = document.getElementById('pageData');
        const cattleName = pageData ? pageData.dataset.cattleName : 'Cattle';
        
        // Update modal content
        document.getElementById('modalCattleName').textContent = cattleName;
        document.getElementById('reportTotal').textContent = total.toFixed(1) + 'L';
        document.getElementById('reportAverage').textContent = average + 'L';
        document.getElementById('reportHighest').textContent = 
            highest?.quantity || 0 + 'L on ' + formatDate(highest?.date || new Date());
        document.getElementById('reportCount').textContent = currentData.length;
        
        // Store report data for download
        currentReportData = {
            cattleName: cattleName,
            total: total.toFixed(1),
            average: average,
            highest: highest,
            recordCount: currentData.length,
            viewType: currentViewType,
            data: currentData
        };
        
        document.getElementById('reportModal').classList.add('show');
        return;
    }
    
    // Fetch fresh data from backend if no current data
    const requestData = {
        view_type: currentViewType
    };
    
    console.log('Fetching report data for cattle:', cattleId);
    
    fetch(`/api/cattle/${cattleId}/filter`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        console.log('Response status:', response.status);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(result => {
        console.log('API Response:', result);
        
        if (result.success && result.data) {
            const data = result.data;
            const pageData = document.getElementById('pageData');
            const cattleName = pageData ? pageData.dataset.cattleName : 'Cattle';
            
            // Update modal content
            document.getElementById('modalCattleName').textContent = cattleName;
            document.getElementById('reportTotal').textContent = 
                (data.total_milk || 0).toFixed(1) + 'L';
            document.getElementById('reportAverage').textContent = 
                (data.avg_milk || 0) + 'L';
            document.getElementById('reportHighest').textContent = 
                (data.highest_day.quantity || 0) + 'L on ' + 
                formatDate(data.highest_day.date || 'N/A');
            document.getElementById('reportCount').textContent = 
                data.record_count || 0;
            
            // Store report data for download
            currentReportData = {
                cattleName: cattleName,
                total: (data.total_milk || 0).toFixed(1),
                average: data.avg_milk || 0,
                highest: data.highest_day || { date: 'N/A', quantity: 0 },
                recordCount: data.record_count || 0,
                viewType: currentViewType,
                data: data.history || []
            };
            
            document.getElementById('reportModal').classList.add('show');
        } else {
            console.error('Invalid response format:', result);
            showSuccess('Error: Invalid response from server');
        }
    })
    .catch(error => {
        console.error('Error loading report:', error);
        showSuccess('Error loading report data: ' + error.message);
    });
}

// Close modal
function closeModal() {
    document.getElementById('reportModal').classList.remove('show');
}

// Format date for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// PDF download functionality using jsPDF
function downloadReport() {
    if (!currentReportData) {
        showSuccess('No report data available');
        return;
    }
    
    const pageData = document.getElementById('pageData');
    const cattleBreed = pageData?.dataset?.cattleBreed || 'Unknown';
const cattleAge = pageData?.dataset?.cattleAge || 'Unknown';
const cattleHealth = pageData?.dataset?.cattleHealth || 'Unknown';
    
    // Check if jsPDF is available
    if (!window.jspdf || !window.jspdf.jsPDF) {
    console.error("jsPDF not loaded");
    downloadReportAsText(currentReportData, cattleBreed, cattleAge, cattleHealth);
    return;
}
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let yPos = 20;
    const lineHeight = 7;
    const margin = 20;
    
    // Helper function to check if we need a new page
    function checkNewPage(requiredSpace = 10) {
        if (yPos + requiredSpace > pageHeight - 20) {
            doc.addPage();
            yPos = 20;
            return true;
        }
        return false;
    }
    
    // Title
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('CATTLE TRACK PRO', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(16);
    doc.text('Cow Performance Report', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 
        pageWidth / 2, 32, { align: 'center' });
    
    yPos = 50;
    doc.setTextColor(0, 0, 0);
    
    // Cattle Information Section
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(247, 250, 252);
    doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 10, 'F');
    doc.text('Cattle Information', margin, yPos);
    yPos += 12;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Name: ${currentReportData.cattleName}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Breed: ${cattleBreed}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Age: ${cattleAge} years`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Health Status: ${cattleHealth}`, margin, yPos);
    yPos += lineHeight + 5;
    
    // Production Summary Section
    checkNewPage(50);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(247, 250, 252);
    doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 10, 'F');
    doc.text('Milk Production Summary', margin, yPos);
    yPos += 12;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Period: ${getViewTypeName(currentReportData.viewType)}`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Records Analyzed: ${currentReportData.recordCount} days`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Total Milk Produced: ${currentReportData.total} Liters`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Average Production/Day: ${currentReportData.average} Liters`, margin, yPos);
    yPos += lineHeight;
    doc.text(`Highest Production Day: ${currentReportData.highest?.quantity || 0} Liters (${formatDate(currentReportData.highest?.date || new Date())})`, 
        margin, yPos);
    yPos += lineHeight + 5;
    
    // Performance Rating
    checkNewPage(30);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(247, 250, 252);
    doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 10, 'F');
    doc.text('Performance Analysis', margin, yPos);
    yPos += 12;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const rating = getPerformanceRating(currentReportData.average);
    doc.text(`Rating: ${rating}`, margin, yPos);
    yPos += lineHeight + 3;
    
    const trend = getTrendAnalysis(currentReportData.data);
    doc.text('Trend:', margin, yPos);
    yPos += lineHeight;
    const trendLines = doc.splitTextToSize(trend, pageWidth - 2 * margin - 10);
    doc.text(trendLines, margin + 10, yPos);
    yPos += trendLines.length * lineHeight + 5;
    
    // Recommendations
    checkNewPage(40);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.setFillColor(247, 250, 252);
    doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 10, 'F');
    doc.text('Recommendations', margin, yPos);
    yPos += 12;
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    const recommendations = getRecommendations(currentReportData.average, cattleBreed);
    const recLines = recommendations.split('\n');
    recLines.forEach(line => {
        checkNewPage(10);
        const wrapped = doc.splitTextToSize(line, pageWidth - 2 * margin - 10);
        doc.text(wrapped, margin, yPos);
        yPos += wrapped.length * lineHeight;
    });
    yPos += 5;
    
    // Daily Records Table
    if (currentReportData.data.length <= 30) {
        checkNewPage(50);
        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        doc.setFillColor(247, 250, 252);
        doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 10, 'F');
        doc.text('Daily Production Records', margin, yPos);
        yPos += 12;
        
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('Date', margin, yPos);
        doc.text('Quantity (Liters)', pageWidth / 2, yPos);
        yPos += lineHeight;
        
        doc.setFont(undefined, 'normal');
        doc.setDrawColor(200, 200, 200);
        
        currentReportData.data.forEach((record, index) => {
            checkNewPage(10);
            
            if (index % 2 === 0) {
                doc.setFillColor(249, 250, 251);
                doc.rect(margin - 5, yPos - 5, pageWidth - 2 * margin + 10, 8, 'F');
            }
            
            doc.text(formatDate(record.date), margin, yPos);
            doc.text(record.quantity.toString(), pageWidth / 2, yPos);
            yPos += lineHeight;
        });
    }
    
    // Footer on last page
    const footerY = pageHeight - 15;
    doc.setFontSize(9);
    doc.setTextColor(128, 128, 128);
    doc.setFont(undefined, 'italic');
    doc.text(`Report ID: CTR-${cattleId}-${Date.now()}`, margin, footerY);
    doc.text(`© 2024 CattleTrack Pro. All rights reserved.`, 
        pageWidth - margin, footerY, { align: 'right' });
    
    // Save the PDF
    const fileName = `${currentReportData.cattleName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    showSuccess('Report downloaded successfully!');
    setTimeout(() => closeModal(), 1000);
}

// Fallback text download if jsPDF is not available
function downloadReportAsText(reportData, breed, age, health) {
    const pdfContent = generateTextContent(reportData, breed, age, health);
    
    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportData.cattleName.replace(/\s+/g, '_')}_Report_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSuccess('Report downloaded as text file!');
    setTimeout(() => closeModal(), 1000);
}

// Generate text content for fallback
function generateTextContent(reportData, breed, age, health) {
    const today = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    let content = `
================================================================================
                         CATTLETRACK PRO - COW REPORT
================================================================================

Report Generated: ${today}

--------------------------------------------------------------------------------
                              CATTLE INFORMATION
--------------------------------------------------------------------------------

Name:           ${reportData.cattleName}
Breed:          ${breed}
Age:            ${age} years
Health Status:  ${health}

--------------------------------------------------------------------------------
                            MILK PRODUCTION SUMMARY
--------------------------------------------------------------------------------

Period:         ${getViewTypeName(reportData.viewType)}
Records:        ${reportData.recordCount} days
Total Milk:     ${reportData.total} Liters
Average/Day:    ${reportData.average} Liters
Highest Day:    ${reportData.highest?.quantity || 0} Liters (${formatDate(reportData.highest?.date || new Date())})

--------------------------------------------------------------------------------
                           DAILY PRODUCTION RECORDS
--------------------------------------------------------------------------------

Date                Quantity (Liters)
------------------------------------------------
`;

    reportData.data.forEach(record => {
        const dateFormatted = formatDate(record.date);
        const spaces = ' '.repeat(20 - dateFormatted.length);
        content += `${dateFormatted}${spaces}${record.quantity}\n`;
    });

    content += `
--------------------------------------------------------------------------------
                                ANALYSIS
--------------------------------------------------------------------------------

Performance Rating: ${getPerformanceRating(reportData.average)}

Trend Analysis:
${getTrendAnalysis(reportData.data)}

Recommendations:
${getRecommendations(reportData.average, breed)}

--------------------------------------------------------------------------------
                                 NOTES
--------------------------------------------------------------------------------

This report is generated automatically by CattleTrack Pro. All measurements
are in liters. For questions or concerns, please contact your veterinarian
or agricultural consultant.

Report ID: CTR-${cattleId}-${Date.now()}

================================================================================
                     © 2024 CattleTrack Pro. All rights reserved.
================================================================================
`;

    return content;
}

// Helper functions for report generation
function getViewTypeName(viewType) {
    switch(viewType) {
        case 'last_7': return 'Last 7 Days';
        case 'last_30': return 'Last 30 Days';
        case 'all_time': return 'All Time';
        case 'custom': return 'Custom Date Range';
        default: return 'Unknown';
    }
}

function getPerformanceRating(average) {
    average = parseFloat(average);
    if (average >= 25) return 'Excellent - Above industry average';
    if (average >= 20) return 'Good - Meeting expectations';
    if (average >= 15) return 'Average - Room for improvement';
    return 'Below Average - Attention required';
}

function getTrendAnalysis(data) {
    if (data.length < 3) return 'Insufficient data for trend analysis.';
    
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, item) => sum + item.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, item) => sum + item.quantity, 0) / secondHalf.length;
    
    const diff = ((secondAvg - firstAvg) / firstAvg * 100).toFixed(1);
    
    if (diff > 5) return `Positive trend: Production increased by ${diff}% in recent period.`;
    if (diff < -5) return `Declining trend: Production decreased by ${Math.abs(diff)}% in recent period.`;
    return `Stable: Production remained consistent with ${Math.abs(diff)}% variation.`;
}

function getRecommendations(average, breed) {
    average = parseFloat(average);
    let recommendations = [];
    
    if (average < 20) {
        recommendations.push('• Consider reviewing nutrition plan with a veterinarian');
        recommendations.push('• Ensure adequate water intake (cows need 30-50 gallons/day)');
        recommendations.push('• Check for signs of stress or illness');
    }
    
    if (breed === 'Holstein') {
        recommendations.push('• Holstein cows typically produce 25-30L/day at peak lactation');
        recommendations.push('• Ensure high-quality forage and balanced mineral supplements');
    }
    
    recommendations.push('• Maintain regular milking schedule (2-3 times daily)');
    recommendations.push('• Monitor udder health and cleanliness');
    recommendations.push('• Keep detailed records for veterinary consultation');
    
    return recommendations.join('\n');
}

// Success message
function showSuccess(message) {
    const msg = document.getElementById('successMessage');
    msg.textContent = message;
    msg.classList.add('show');
    setTimeout(() => msg.classList.remove('show'), 3000);
}

// Close modal on outside click
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        closeModal();
    }
}

// Handle window resize for responsive chart
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (currentData.length > 0) {
            drawChart(currentData);
        }
    }, 250);
});