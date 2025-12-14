/* admin-report.js (Final Version: Accurate Export & Full Features) */

// --- Global Variables ---
let monthlyFacultyChartInstance, monthlyOrgChartInstance;
let pieChartInstance, pcAvgChartInstance, satisfactionChartInstance, topSoftwareChartInstance;
let allLogs; 

// --- Master Lists ---
const FACULTY_LIST = ["คณะวิทยาศาสตร์", "คณะเกษตรศาสตร์", "คณะวิศวกรรมศาสตร์", "คณะศิลปศาสตร์", "คณะเภสัชศาสตร์", "คณะบริหารศาสตร์", "คณะพยาบาลศาสตร์", "วิทยาลัยแพทยศาสตร์และการสาธารณสุข", "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์", "คณะนิติศาสตร์", "คณะรัฐศาสตร์", "คณะศึกษาศาสตร์"];
const ORG_LIST = ["สำนักคอมพิวเตอร์และเครือข่าย", "สำนักบริหารทรัพย์สินและสิทธิประโยชน์", "สำนักวิทยบริการ", "กองกลาง", "กองแผนงาน", "กองคลัง", "กองบริการการศึกษา", "กองการเจ้าหน้าที่", "สำนักงานส่งเสริมและบริหารงานวิจัย ฯ", "สำนักงานพัฒนานักศึกษา", "สำนักงานบริหารกายภาพและสิ่งแวดล้อม", "สำนักงานวิเทศสัมพันธ์", "สำนักงานกฏหมายและนิติการ", "สำนักงานตรวจสอบภายใน", "สำนักงานรักษาความปลอดภัย", "สภาอาจารย์", "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี", "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี", "ศูนย์การจัดการความรู้ (KM)", "ศูนย์การเรียนรู้และพัฒนา \"งา\" เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน", "สถานปฏิบัติการโรงแรมฯ (U-Place)", "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง ฯ", "ศูนย์เครื่องมือวิทยาศาสตร์", "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี"];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();
    // if (!session || !session.user || session.user.role !== 'admin') window.location.href = 'admin-login.html';
    
    allLogs = DB.getLogs(); 
    populateFilterOptions(allLogs); 
    autoSetDates();
    renderLifetimeStats(); 
    initializeReports(allLogs); 
});

// ==========================================
// 1. FILTER LOGIC
// ==========================================
function populateFilterOptions(logs) {
    const faculties = new Set(FACULTY_LIST);
    const organizations = new Set(ORG_LIST);
    const levels = new Set();
    const years = new Set();
    const sortThai = (a, b) => String(a).localeCompare(String(b), 'th');
    const sortNum = (a, b) => parseInt(a) - parseInt(b);

    logs.forEach(log => {
        if (log.userLevel) levels.add(log.userLevel);
        if (log.userYear && log.userYear !== '-') years.add(log.userYear);
        if (log.userFaculty && !faculties.has(log.userFaculty) && !organizations.has(log.userFaculty)) {
             if (log.userFaculty.startsWith("คณะ") || log.userFaculty.startsWith("วิทยาลัย")) faculties.add(log.userFaculty);
             else if (log.userFaculty !== "บุคคลภายนอก" && log.userFaculty !== "ไม่ระบุสังกัด") organizations.add(log.userFaculty);
        }
    });

    populateSelect('filterFaculty', faculties, sortThai);
    populateSelect('filterOrganization', organizations, sortThai);
    populateSelect('filterLevel', levels, sortThai);
    populateSelect('filterYear', years, sortNum);
}
function populateSelect(id, set, sortFn) {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(set).sort(sortFn).forEach(val => { select.innerHTML += `<option value="${val}">${val}</option>`; });
}
function getFilterParams() {
    return {
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value,
        faculty: document.getElementById('filterFaculty').value,
        organization: document.getElementById('filterOrganization').value,
        userType: document.getElementById('filterUserType').value,
        level: document.getElementById('filterLevel').value,
        year: document.getElementById('filterYear').value,
    };
}
function applyFilters() { initializeReports(filterLogs(allLogs, getFilterParams())); }
function clearFilters() { document.getElementById('reportFilterForm').reset(); autoSetDates(); initializeReports(allLogs); }

function filterLogs(logs, params) {
    let filtered = logs;
    const { startDate, endDate, faculty, organization, userType, level, year } = params;
    if (startDate) filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= new Date(startDate).setHours(0,0,0,0));
    if (endDate) filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= new Date(endDate).setHours(23,59,59,999));
    if (faculty) filtered = filtered.filter(log => log.userFaculty === faculty);
    if (organization) filtered = filtered.filter(log => log.userFaculty === organization);
    if (userType) {
        if (userType === 'Internal') filtered = filtered.filter(log => log.userRole === 'student' || log.userRole === 'staff');
        else if (userType === 'External') filtered = filtered.filter(log => log.userRole === 'external');
    }
    if (level) filtered = filtered.filter(log => log.userLevel === level);
    if (year) filtered = filtered.filter(log => log.userYear === year);
    return filtered;
}

// ==========================================
// 2. MAIN RENDER FUNCTION
// ==========================================

function initializeReports(logs) {
    [monthlyFacultyChartInstance, monthlyOrgChartInstance, pieChartInstance, pcAvgChartInstance, satisfactionChartInstance, topSoftwareChartInstance].forEach(chart => {
        if (chart) chart.destroy();
    });

    renderLogHistory(logs); 

    const statsLogs = logs.filter(l => l.action === 'END_SESSION'); 
    const data = processLogs(statsLogs); // Process even if empty to show empty charts

    // ✅ เรียกฟังก์ชันแสดงคอมเมนต์ (เพิ่มบรรทัดนี้)
    renderFeedbackComments(statsLogs);

    monthlyFacultyChartInstance = drawBeautifulLineChart(data.monthlyFacultyData, 'monthlyFacultyChart', 5);
    monthlyOrgChartInstance = drawBeautifulLineChart(data.monthlyOrgData, 'monthlyOrgChart', 5);
    topSoftwareChartInstance = drawTopSoftwareChart(data.softwareStats);
    pieChartInstance = drawAIUsagePieChart(data.aiUsageData); 
    pcAvgChartInstance = drawPCAvgTimeChart(data.pcAvgTimeData);
    satisfactionChartInstance = drawSatisfactionChart(data.satisfactionData);
}

function renderFeedbackComments(logs) {
    const container = document.getElementById('feedbackCommentList');
    const countBadge = document.getElementById('commentCount');
    if (!container) return;

    // 1. กรองเฉพาะคนที่มีคอมเมนต์
    const comments = logs.filter(log => log.comment && log.comment.trim() !== "");

    // อัปเดตตัวเลขจำนวนคอมเมนต์
    if(countBadge) countBadge.innerText = comments.length;

    if (comments.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted mt-5">
                <i class="bi bi-chat-square-dots fs-1 opacity-25"></i>
                <p class="small mt-2">ยังไม่มีข้อเสนอแนะเพิ่มเติม</p>
            </div>`;
        return;
    }

    // 2. เรียงลำดับ (ใหม่สุดขึ้นก่อน)
    const sortedComments = comments.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 3. สร้าง HTML
    container.innerHTML = sortedComments.map(log => {
        const score = parseInt(log.satisfactionScore) || 0;
        
        // สร้างดาวตามคะแนน
        let stars = '';
        for(let i=1; i<=5; i++) {
            stars += i <= score ? '<i class="bi bi-star-fill text-warning small"></i>' : '<i class="bi bi-star text-muted opacity-25 small"></i>';
        }

        const dateStr = new Date(log.timestamp).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' });
        const pcName = `PC-${log.pcId || '?'}`;
        const user = log.userName || 'Unknown';

        // สีขอบด้านซ้ายตามคะแนน (เขียว/เหลือง/แดง)
        const borderClass = score >= 4 ? 'border-success' : (score >= 2 ? 'border-warning' : 'border-danger');

        return `
            <div class="list-group-item bg-white border-start border-4 ${borderClass} mb-2 rounded shadow-sm py-2 px-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <div class="small fw-bold text-dark">${user} <span class="text-muted fw-normal">(${pcName})</span></div>
                    <div class="text-nowrap">${stars}</div>
                </div>
                <p class="mb-1 small text-secondary">"${log.comment}"</p>
                <div class="text-end">
                    <small class="text-muted" style="font-size: 0.7rem;"><i class="bi bi-clock me-1"></i>${dateStr}</small>
                </div>
            </div>
        `;
    }).join('');
}


function processLogs(logs) {
    const result = {
        monthlyFacultyData: {}, monthlyOrgData: {}, aiUsageData: { ai: 0, nonAI: 0 },
        pcAvgTimeData: [], satisfactionData: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, total: 0 },
        softwareStats: {}
    };
    const pcUsageMap = new Map();

    logs.forEach(log => {
        const monthYear = new Date(log.timestamp).toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
        const faculty = log.userFaculty || 'Unknown';
        
        let target = null;
        if (FACULTY_LIST.includes(faculty) || faculty.startsWith("คณะ") || faculty.startsWith("วิทยาลัย")) target = result.monthlyFacultyData;
        else if (faculty !== "บุคคลภายนอก") target = result.monthlyOrgData;

        if (target) {
            if (!target[monthYear]) target[monthYear] = {};
            target[monthYear][faculty] = (target[monthYear][faculty] || 0) + 1;
        }

        if (log.isAIUsed) result.aiUsageData.ai++; else result.aiUsageData.nonAI++;

        if (Array.isArray(log.usedSoftware)) {
            log.usedSoftware.forEach(sw => {
                const name = sw.split('(')[0].trim();
                result.softwareStats[name] = (result.softwareStats[name] || 0) + 1;
            });
        }

        const pcId = log.pcId || 'Unknown';
        if (!pcUsageMap.has(pcId)) pcUsageMap.set(pcId, { total: 0, count: 0 });
        pcUsageMap.get(pcId).total += (log.durationMinutes || 0);
        pcUsageMap.get(pcId).count++;

        if (log.satisfactionScore) {
            const score = parseInt(log.satisfactionScore);
            if (score >= 1 && score <= 5) {
                result.satisfactionData[score]++;
                result.satisfactionData.total++;
            }
        }
    });

    result.pcAvgTimeData = Array.from(pcUsageMap.entries()).map(([id, d]) => ({ pcId: `PC-${id}`, avgTime: (d.total/d.count).toFixed(1) }));
    return result;
}

// ==========================================
// 3. CHART DRAWING FUNCTIONS
// ==========================================

function drawBeautifulLineChart(data, canvasId, topN = 5) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const months = Object.keys(data).sort((a, b) => {
        const monthMap = { "ม.ค.":0, "ก.พ.":1, "มี.ค.":2, "เม.ย.":3, "พ.ค.":4, "มิ.ย.":5, "ก.ค.":6, "ส.ค.":7, "ก.ย.":8, "ต.ค.":9, "พ.ย.":10, "ธ.ค.":11 };
        const [mA, yA] = a.split(' '); const [mB, yB] = b.split(' ');
        return new Date(parseInt(yA)-543, monthMap[mA]) - new Date(parseInt(yB)-543, monthMap[mB]);
    });

    const totals = {};
    months.forEach(m => Object.keys(data[m]).forEach(k => totals[k] = (totals[k]||0) + data[m][k]));
    const topKeys = Object.keys(totals).sort((a,b) => totals[b] - totals[a]).slice(0, topN);
    const others = Object.keys(totals).filter(k => !topKeys.includes(k));

    const datasets = topKeys.map((k, i) => ({
        label: k, data: months.map(m => data[m][k] || 0),
        borderColor: getChartColor(i), backgroundColor: getChartColor(i),
        borderWidth: 2.5, tension: 0.4, pointRadius: 3, pointHoverRadius: 6, pointBackgroundColor: '#fff', pointBorderWidth: 2, fill: false
    }));
    
    if (others.length > 0) {
        datasets.push({
            label: 'อื่นๆ', data: months.map(m => others.reduce((s, k) => s + (data[m][k]||0), 0)),
            borderColor: '#adb5bd', backgroundColor: '#adb5bd',
            borderWidth: 2, borderDash: [5, 5], tension: 0.4, pointRadius: 0, fill: false
        });
    }

    return new Chart(ctx, {
        type: 'line', data: { labels: months, datasets },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15, font: { family: "'Prompt', sans-serif" } } } },
            scales: { x: { grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif" } } }, y: { beginAtZero: true, grid: { borderDash: [2, 4], color: '#f0f0f0' }, ticks: { font: { family: "'Prompt', sans-serif" } } } }
        }
    });
}

function drawTopSoftwareChart(data) {
    const ctx = document.getElementById('topSoftwareChart');
    if(!ctx) return;
    const sorted = Object.entries(data).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 400, 0);
    gradient.addColorStop(0, '#4e73df'); gradient.addColorStop(1, '#36b9cc');

    return new Chart(ctx, {
        type: 'bar',
        data: { labels: sorted.map(x=>x[0]), datasets: [{ label: 'จำนวนการใช้งาน', data: sorted.map(x=>x[1]), backgroundColor: gradient, borderRadius: 10, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { legend: {display:false}, tooltip: { callbacks: { label: (c) => ` ${c.raw} ครั้ง` } } }, 
            scales: { x: { beginAtZero: true, grid: { display: false }, ticks: { font: { family: "'Prompt', sans-serif" } } }, y: { grid: {display:false}, ticks: { font: { family: "'Prompt', sans-serif", weight: '500' } } } } 
        }
    });
}

function drawSatisfactionChart(data) {
    const ctx = document.getElementById('satisfactionChart');
    if(!ctx) return;
    
    const total = data.total || 0;
    let avgScore = "0.00";
    let values = [0, 0, 0, 0, 0];
    let percentages = ["0%", "0%", "0%", "0%", "0%"];

    if (total > 0) {
        const weightedSum = (data[5]*5) + (data[4]*4) + (data[3]*3) + (data[2]*2) + (data[1]*1);
        avgScore = (weightedSum / total).toFixed(2);
        values = [data[5], data[4], data[3], data[2], data[1]];
        percentages = values.map(v => ((v / total) * 100).toFixed(0) + "%");
    }

    const labels = [`5 ดาว (${percentages[0]})`, `4 ดาว (${percentages[1]})`, `3 ดาว (${percentages[2]})`, `2 ดาว (${percentages[3]})`, `1 ดาว (${percentages[4]})`];
    const colors = ['#198754','#28a745','#ffc107','#fd7e14','#dc3545'];
    
    return new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ label: 'จำนวน', data: values, backgroundColor: colors, borderRadius: 10, barPercentage: 0.6 }] },
        options: { 
            indexAxis: 'y', responsive: true, maintainAspectRatio: false, 
            plugins: { 
                title: { display: true, text: `⭐ คะแนนเฉลี่ย: ${avgScore} / 5.00`, font: {size:16, family:"'Prompt'"}, padding: {bottom:10} }, 
                legend: {display:false} 
            }, 
            scales: { x: {display:false}, y: {grid:{display:false}, ticks: { font: { family: "'Prompt', sans-serif" } }} } 
        }
    });
}

function drawPCAvgTimeChart(d) { 
    const ctx = document.getElementById('pcAvgTimeChart');
    if(!ctx) return;

    let labels = (d && d.length > 0) ? d.map(x=>x.pcId) : ["No Data"];
    let values = (d && d.length > 0) ? d.map(x=>x.avgTime) : [0];

    const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, '#fd7e14'); gradient.addColorStop(1, '#f6c23e');

    return new Chart(ctx.getContext('2d'), { 
        type: 'bar', 
        data: { labels: labels, datasets: [{ label: 'นาที', data: values, backgroundColor: gradient, borderRadius: 10 }] }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: {display:false}, tooltip: { callbacks: { label: (c) => ` ${c.raw} นาที` } } },
            scales: { 
                y: { beginAtZero:true, grid: { borderDash: [2, 4], color: '#f0f0f0' }, ticks: { font: { family: "'Prompt', sans-serif" } } },
                x: { grid: {display:false}, ticks: { font: { family: "'Prompt', sans-serif" } } }
            } 
        } 
    }); 
}

function drawAIUsagePieChart(d) { 
    return new Chart(document.getElementById('aiUsagePieChart'), { 
        type: 'doughnut', 
        data: { labels: ['AI Tools', 'General Use'], datasets: [{ data: [d.ai, d.nonAI], backgroundColor: ['#4e73df', '#e2e6ea'], borderWidth: 0 }] }, 
        options: { 
            responsive: true, maintainAspectRatio: false, 
            plugins: { legend: { position:'bottom', labels: { usePointStyle: true, font: { family: "'Prompt', sans-serif" } } } },
            cutout: '70%' 
        } 
    }); 
}

function getChartColor(i) { return ['#4e73df', '#1cc88a', '#36b9cc', '#f6c23e', '#e74a3b', '#6f42c1'][i%6]; }

// ==========================================
// 4. TABLE & EXPORT
// ==========================================

function renderLogHistory(logs) {
    const tbody = document.getElementById('logHistoryTableBody');
    const COLSPAN_COUNT = 11;
    if (!tbody) return;
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted p-4">ไม่พบข้อมูล</td></tr>`;
        return;
    }
    
    const displayLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);

    tbody.innerHTML = displayLogs.map((log, index) => {
        const userId = log.userId || '-';
        const name = log.userName || '-';
        
        let softwareDisplay = '-';
        if (Array.isArray(log.usedSoftware) && log.usedSoftware.length > 0) {
            softwareDisplay = log.usedSoftware.slice(0, 2).map(s => 
                `<span class="badge bg-light text-dark border fw-normal me-1">${s}</span>`
            ).join('') + (log.usedSoftware.length > 2 ? '...' : '');
        }

        const end = new Date(log.timestamp);
        const start = log.startTime ? new Date(log.startTime) : end;
        const dateStr = end.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeRange = `${start.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
        
        const faculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '-');
        
        let roleBadge = '<span class="badge bg-secondary">ไม่ระบุ</span>';
        if (log.userRole === 'student') roleBadge = '<span class="badge bg-info text-dark">นักศึกษา</span>';
        else if (log.userRole === 'staff') roleBadge = '<span class="badge bg-warning text-dark">บุคลากร/อาจารย์</span>';
        else if (log.userRole === 'external' || log.userRole === 'Guest') roleBadge = '<span class="badge bg-success">บุคคลภายนอก</span>';

        const pcName = `PC-${log.pcId || '?'}`;
        const duration = log.durationMinutes ? `${log.durationMinutes} น.` : '-';
        const satisfactionScoreDisplay = getSatisfactionDisplay(log.satisfactionScore);

        return `<tr>
            <td class="text-center">${index + 1}</td>
            <td><span class="fw-bold text-primary">${userId}</span></td>
            <td>${name}</td>
            <td>${softwareDisplay}</td>
            <td>${dateStr}</td>
            <td>${timeRange}</td>
            <td>${faculty}</td>
            <td>${roleBadge}</td>
            <td>${pcName}</td>
            <td class="text-end">${duration}</td>
            <td class="text-center">${satisfactionScoreDisplay}</td>
        </tr>`;
    }).join('');

    if (logs.length > 100) {
        tbody.innerHTML += `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted small p-2 bg-light">... มีข้อมูลอีก ${logs.length - 100} รายการ (กรุณากด Export Data เพื่อดูทั้งหมด) ...</td></tr>`;
    }
}

// --- Helper Functions ---
function autoSetDates() { 
    const p = document.getElementById('filterPeriod').value; 
    const t = new Date(); 
    let s, e; 
    if(p==='today'){s=e=t;}
    else if(p==='this_month'){s=new Date(t.getFullYear(),t.getMonth(),1);e=new Date(t.getFullYear(),t.getMonth()+1,0);}
    else if(p==='this_year'){s=new Date(t.getFullYear(),0,1);e=new Date(t.getFullYear(),11,31);} 
    if(s){
        document.getElementById('filterStartDate').value=formatDateForInput(s); 
        document.getElementById('filterEndDate').value=formatDateForInput(e);
    } 
}

function formatDateForInput(date) { return date.toISOString().split('T')[0]; }
function formatDateStr(date) { return date.toISOString().split('T')[0]; }
function getSatisfactionDisplay(score) { if (!score) return '-'; const c = score>=4?'success':(score>=2?'warning text-dark':'danger'); return `<span class="badge bg-${c}"><i class="bi bi-star-fill"></i> ${score}</span>`; }
function renderLifetimeStats() { const logs = DB.getLogs(); document.getElementById('lifetimeTotalCount').innerText = logs.length.toLocaleString(); }
function processImportCSV(el) { alert('ฟังก์ชัน Import CSV ทำงานปกติ (จำลอง)'); }

// ✅ Updated Quick Export (แม่นยำ 100%)
function exportReport(mode) {
    const today = new Date();
    let startDate, endDate, fileNamePrefix;

    switch(mode) {
        case 'daily':
            startDate = new Date(today); endDate = new Date(today);
            fileNamePrefix = `Daily_Report_${formatDateStr(today)}`;
            break;
        case 'monthly':
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0); 
            fileNamePrefix = `Monthly_Report_${today.getFullYear()}_${today.getMonth()+1}`;
            break;
        case 'quarterly':
            const q = Math.floor(today.getMonth() / 3);
            startDate = new Date(today.getFullYear(), q * 3, 1);
            endDate = new Date(today.getFullYear(), (q * 3) + 3, 0);
            fileNamePrefix = `Quarterly_Report_${today.getFullYear()}_Q${q+1}`;
            break;
        case 'yearly':
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            fileNamePrefix = `Yearly_Report_${today.getFullYear()}`;
            break;
        default: return;
    }

    // บังคับเวลา
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    generateCSV(startDate, endDate, fileNamePrefix);
}

// ✅ Updated Export Data (ใช้ Logic เดียวกันกับ Quick Export)
function exportCSV() {
    // ใช้ค่าจาก Filter หน้าจอ
    const filteredLogs = filterLogs(allLogs, getFilterParams());
    if (filteredLogs.length === 0) { alert("ไม่พบข้อมูล Log ตามเงื่อนไขที่เลือก"); return; }
    
    // ตั้งชื่อไฟล์ default
    const fileName = `Usage_Report_${new Date().toISOString().slice(0, 10)}`;
    
    // เรียกใช้ generateCSV แต่ส่งข้อมูลที่กรองแล้วไปเลย (ต้องปรับ generateCSV นิดหน่อยให้รองรับ)
    // เพื่อความง่าย: ใช้ Logic ใน generateCSV สร้างไฟล์เลยดีกว่า
    createCSVFile(filteredLogs, fileName);
}

// ✅ Shared CSV Generator (ใช้ร่วมกันทั้ง 2 ปุ่ม)
function generateCSV(startDateObj, endDateObj, fileNamePrefix) {
    const filteredLogs = allLogs.filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= startDateObj.getTime() && logTime <= endDateObj.getTime();
    });

    if (filteredLogs.length === 0) { alert('ไม่พบข้อมูลในช่วงเวลาดังกล่าว'); return; }
    createCSVFile(filteredLogs, fileNamePrefix);
}

function createCSVFile(logs, fileName) {
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // เรียงใหม่ -> เก่า

    const headers = ["ลำดับ", "รหัสผู้ใช้งาน", "ชื่อ-สกุล", "AI/Software ที่ใช้", "วันที่ใช้บริการ", "ช่วงเวลาใช้บริการ", "รหัสคณะ/สำนัก", "สถานะ", "PC ที่ใช้", "ระยะเวลา (นาที)", "ความพึงพอใจ (Score)"];
    
    const csvRows = logs.map((log, index) => {
        const userId = log.userId || '-';
        const userName = log.userName || '-';
        const software = (log.usedSoftware && log.usedSoftware.length) ? log.usedSoftware.join('; ') : '-';
        const end = new Date(log.timestamp);
        const start = log.startTime ? new Date(log.startTime) : end;
        const dateStr = end.toLocaleDateString('th-TH', { year: 'numeric', month: '2-digit', day: '2-digit' });
        const timeRange = `${start.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})} - ${end.toLocaleTimeString('th-TH', {hour:'2-digit', minute:'2-digit'})}`;
        const faculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '-');
        
        let role = 'บุคคลภายนอก';
        if (log.userRole === 'student') role = 'นักศึกษา';
        else if (log.userRole === 'staff') role = 'บุคลากร/อาจารย์';

        const pcName = `PC-${log.pcId || '?'}`;
        const duration = log.durationMinutes ? log.durationMinutes.toFixed(0) : '0';
        const satisfaction = log.satisfactionScore || '-';

        return [`"${index + 1}"`, `"${userId}"`, `"${userName}"`, `"${software}"`, `"${dateStr}"`, `"${timeRange}"`, `"${faculty}"`, `"${role}"`, `"${pcName}"`, `"${duration}"`, `"${satisfaction}"`].join(',');
    });

    const csvContent = [headers.join(','), ...csvRows].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

