/* admin-report.js (Updated: เพิ่ม Master List คณะ/หน่วยงาน ในตัวกรอง) */

// Global variables
let monthlyChartInstance, pieChartInstance, pcAvgChartInstance; 
let allLogs; 

// ✅ 1. รายชื่อคณะ/หน่วยงานทั้งหมด (Master List)
const MASTER_FACULTIES = [
    "กองกลาง",
    "กองการเจ้าหน้าที่",
    "กองคลัง",
    "กองบริการการศึกษา",
    "กองแผนงาน",
    "คณะนิติศาสตร์",
    "คณะบริหารศาสตร์",
    "คณะพยาบาลศาสตร์",
    "คณะเภสัชศาสตร์",
    "คณะรัฐศาสตร์",
    "คณะวิทยาศาสตร์",
    "คณะวิศวกรรมศาสตร์",
    "คณะศิลปศาสตร์",
    "คณะศิลปประยุกต์และสถาปัตยกรรมศาสตร์",
    "คณะศึกษาศาสตร์",
    "คณะเกษตรศาสตร์",
    "สถานปฏิบัติการโรงแรมฯ (U-Place)",
    "สภาอาจารย์",
    "สำนักงานตรวจสอบภายใน",
    "สำนักงานนิติการ / สำนักงานกฎหมาย",
    "สำนักงานบริหารกายภาพและสิ่งแวดล้อม",
    "สำนักงานพัฒนานักศึกษา",
    "สำนักงานวิเทศสัมพันธ์",
    "สำนักงานส่งเสริมและบริหารงานวิจัย",
    "สำนักงานรักษาความปลอดภัย",
    "ศูนย์การจัดการความรู้ (KM)",
    "ศูนย์การเรียนรู้และพัฒนา 'งา' เชิงเกษตรอุตสาหกรรมครัวเรือนแบบยั่งยืน",
    "ศูนย์เครื่องมือวิทยาศาสตร์",
    "ศูนย์วิจัยสังคมอนุภาคลุ่มน้ำโขง",
    "สหกรณ์ออมทรัพย์มหาวิทยาลัยอุบลราชธานี",
    "สำนักคอมพิวเตอร์และเครือข่าย",
    "สำนักบริหารทรัพย์สินและสิทธิประโยชน์",
    "สำนักวิทยบริการ",
    "อุทยานวิทยาศาสตร์มหาวิทยาลัยอุบลราชธานี",
    "โรงพิมพ์มหาวิทยาลัยอุบลราชธานี",
    "วิทยาลัยแพทยศาสตร์และการสาธารณสุข"
];

document.addEventListener('DOMContentLoaded', () => {
    // Auth Check
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        console.log("Admin session not found.");
    }
    
    allLogs = DB.getLogs(); 
    populateFilterOptions(allLogs); // สร้างตัวเลือกใน Dropdown
    initializeReports(allLogs); 
});

// ==========================================
// 0. FILTER LOGIC & INITIALIZATION
// ==========================================

function populateFilterOptions(logs) {
    // ✅ ใช้ Set โดยเริ่มจาก MASTER_FACULTIES เพื่อให้มีครบทุกคณะแน่นอน
    const faculties = new Set(MASTER_FACULTIES);
    
    const levels = new Set();
    const years = new Set();
    
    const sortAlphabetically = (a, b) => String(a).localeCompare(String(b), 'th', { sensitivity: 'base' });
    const sortNumerically = (a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        if (isNaN(numA) || isNaN(numB)) return sortAlphabetically(a, b);
        return numA - numB;
    };

    // วนลูป Log เพื่อเก็บข้อมูล Level และ Year (และ Faculty เพิ่มเติมถ้ามีนอกเหนือจาก Master List)
    logs.forEach(log => {
        if (log.userFaculty) faculties.add(log.userFaculty);
        if (log.userLevel) levels.add(log.userLevel);
        if (log.userYear && log.userYear !== '-') years.add(log.userYear);
    });

    // 1. สร้าง Dropdown คณะ (เรียงตามตัวอักษร)
    const facultySelect = document.getElementById('filterFaculty');
    facultySelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(faculties).sort(sortAlphabetically).forEach(f => {
        facultySelect.innerHTML += `<option value="${f}">${f}</option>`;
    });

    // 2. สร้าง Dropdown ระดับการศึกษา
    const levelSelect = document.getElementById('filterLevel');
    levelSelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(levels).sort(sortAlphabetically).forEach(l => {
        levelSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });
    
    // 3. สร้าง Dropdown ชั้นปี
    const yearSelect = document.getElementById('filterYear');
    yearSelect.innerHTML = '<option value="">-- ทั้งหมด --</option>';
    Array.from(years).sort(sortNumerically).forEach(y => {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    });
}

function getFilterParams() {
    return {
        startDate: document.getElementById('filterStartDate').value,
        endDate: document.getElementById('filterEndDate').value,
        faculty: document.getElementById('filterFaculty').value,
        userType: document.getElementById('filterUserType').value,
        level: document.getElementById('filterLevel').value,
        year: document.getElementById('filterYear').value,
    };
}

function applyFilters() {
    const params = getFilterParams();
    const filteredLogs = filterLogs(allLogs, params);
    initializeReports(filteredLogs); 
    console.log(`Reports updated with ${filteredLogs.length} logs.`);
}

function clearFilters() {
    document.getElementById('reportFilterForm').reset();
    initializeReports(allLogs);
}

function filterLogs(logs, params) {
    let filtered = logs;
    const { startDate, endDate, faculty, userType, level, year } = params;
    
    // 1. Date Range
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filtered = filtered.filter(log => new Date(log.timestamp).getTime() >= start.getTime());
    }
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(log => new Date(log.timestamp).getTime() <= end.getTime());
    }

    // 2. Faculty
    if (faculty) {
        filtered = filtered.filter(log => log.userFaculty === faculty);
    }
    
    // 3. User Type
    if (userType) {
        if (userType === 'Internal') {
            filtered = filtered.filter(log => log.userRole === 'student' || log.userRole === 'staff');
        } else if (userType === 'External') {
            filtered = filtered.filter(log => log.userRole === 'external');
        }
    }

    // 4. Level
    if (level) {
        filtered = filtered.filter(log => log.userLevel === level);
    }
    
    // 5. Year
    if (year) {
        filtered = filtered.filter(log => log.userYear === year);
    }

    return filtered;
}

// ... (ส่วน initializeReports, processLogs, Chart Functions และ renderLogHistory คงเดิม ไม่ต้องแก้) ...
// เพื่อความสะดวก ผมรวมฟังก์ชันที่เหลือไว้ให้ครบถ้วนด้านล่างนี้เลยครับ

function initializeReports(logs) {
    if (monthlyChartInstance) monthlyChartInstance.destroy();
    if (pieChartInstance) pieChartInstance.destroy();
    if (pcAvgChartInstance) pcAvgChartInstance.destroy();
    
    renderLogHistory(logs); 

    const statsLogs = logs.filter(l => l.action === 'END_SESSION'); 
    
    if (statsLogs.length === 0) {
        return; 
    }

    const processedData = processLogs(statsLogs);
    
    monthlyChartInstance = drawMonthlyUserChart(processedData.monthlyFacultyData); 
    pieChartInstance = drawAIUsagePieChart(processedData.aiUsageData); 
    pcAvgChartInstance = drawPCAvgTimeChart(processedData.pcAvgTimeData);
}

function processLogs(filteredStatsLogs) {
    const monthlyFacultyData = {};
    const aiUsageData = { ai: 0, nonAI: 0 };
    const pcUsageMap = new Map();

    filteredStatsLogs.forEach(log => {
        const date = new Date(log.timestamp);
        const monthYear = date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short' });
        const faculty = log.userFaculty || 'Unknown';
        const duration = log.durationMinutes || 0;
        const pcId = log.pcId || 'Unknown';
        
        if (!monthlyFacultyData[monthYear]) monthlyFacultyData[monthYear] = {};
        monthlyFacultyData[monthYear][faculty] = (monthlyFacultyData[monthYear][faculty] || 0) + 1;

        if (log.isAIUsed) {
            aiUsageData.ai += 1;
        } else {
            aiUsageData.nonAI += 1;
        }

        if (!pcUsageMap.has(pcId)) {
            pcUsageMap.set(pcId, { totalDuration: 0, count: 0 });
        }
        pcUsageMap.get(pcId).totalDuration += duration;
        pcUsageMap.get(pcId).count += 1;
    });

    const pcAvgTimeData = Array.from(pcUsageMap.entries()).map(([pcId, data]) => ({
        pcId: `PC-${pcId}`,
        avgTime: (data.totalDuration / data.count).toFixed(1)
    }));

    return { monthlyFacultyData, aiUsageData, pcAvgTimeData };
}

const CHART_COLORS = [
    'rgba(255, 99, 132, 0.8)', 'rgba(54, 162, 235, 0.8)', 'rgba(255, 206, 86, 0.8)', 
    'rgba(75, 192, 192, 0.8)', 'rgba(153, 102, 255, 0.8)', 'rgba(255, 159, 64, 0.8)',
    'rgba(199, 199, 199, 0.8)', 'rgba(83, 109, 254, 0.8)', 'rgba(255, 99, 71, 0.8)'
];

function drawMonthlyUserChart(data) {
    const ctx = document.getElementById('monthlyUserChart').getContext('2d');
    const labels = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));
    const allFaculties = Array.from(new Set(Object.values(data).flatMap(Object.keys)));
    
    const datasets = allFaculties.map((faculty, index) => {
        return {
            label: faculty,
            data: labels.map(month => data[month][faculty] || 0),
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
            stack: 'Stack 0',
        };
    });

    return new Chart(ctx, {
        type: 'bar',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, title: { display: true, text: 'เดือน' } },
                y: { stacked: true, beginAtZero: true, title: { display: true, text: 'จำนวนครั้ง (Sessions)' } }
            },
            plugins: { legend: { display: allFaculties.length > 1 } }
        }
    });
}

function drawAIUsagePieChart(data) {
    const ctx = document.getElementById('aiUsagePieChart').getContext('2d');
    const total = data.ai + data.nonAI;
    const labels = [
        `ใช้ AI Tools (${((data.ai/total)*100).toFixed(1)}%)`, 
        `ใช้ Software ทั่วไป (${((data.nonAI/total)*100).toFixed(1)}%)`
    ];
    
    return new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: [data.ai, data.nonAI],
                backgroundColor: ['#42A5F5', '#FF6384'],
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}

function drawPCAvgTimeChart(data) {
    const ctx = document.getElementById('pcAvgTimeChart').getContext('2d');
    const labels = data.map(d => d.pcId);
    const avgTimes = data.map(d => d.avgTime);

    return new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'เวลาใช้งานเฉลี่ย (นาที)',
                data: avgTimes,
                backgroundColor: 'rgba(75, 192, 192, 0.8)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, title: { display: true, text: 'นาที' } }
            }
        }
    });
}

function formatLogDate(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString); 
    return date.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatLogTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString); 
    return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function getSatisfactionDisplay(score) {
    if (score === undefined || score === null) return '<span class="text-muted">-</span>';
    const scoreNum = parseFloat(score);
    if (scoreNum >= 4) return `<span class="badge bg-success fw-bold"><i class="bi bi-star-fill"></i> ${score}</span>`;
    else if (scoreNum >= 2) return `<span class="badge bg-warning text-dark"><i class="bi bi-star-half"></i> ${score}</span>`;
    else return `<span class="badge bg-danger"><i class="bi bi-star"></i> ${score}</span>`;
}

function renderLogHistory(logs) {
    const tbody = document.getElementById('logHistoryTableBody');
    const COLSPAN_COUNT = 10;
    
    if (!tbody) return;

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${COLSPAN_COUNT}" class="text-center text-muted p-4">ไม่พบข้อมูลประวัติการใช้งาน</td></tr>`;
        return;
    }

    // เรียงลำดับจาก ใหม่ -> เก่า (เหมือนเดิม)
    const sortedLogs = logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    tbody.innerHTML = sortedLogs.map((log, index) => {
        
        // 1. User Info
        const displayNameOrId = log.userName || log.userId || 'N/A';
        const displayFaculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : 'ไม่ระบุสังกัด');
        
        const userNameDisplay = `
            <span class="fw-bold text-dark">${displayNameOrId}</span>
            <br>
            <span class="small text-muted">${displayFaculty}</span>
        `;
        
        // 2. Status
        let statusText = log.action || 'Undefined';
        let statusClass = 'bg-secondary';
        let rowClass = '';

        switch(log.action) {
            case 'START_SESSION':
                statusText = 'Check in';
                statusClass = 'bg-primary';
                rowClass = 'table-info bg-opacity-10';
                break;
            case 'END_SESSION':
                statusText = 'Check out';
                statusClass = 'bg-success';
                rowClass = 'table-success bg-opacity-10'; 
                break;
            case 'Admin Check-in':
                statusText = 'Admin Check-in';
                statusClass = 'bg-warning text-dark';
                rowClass = 'table-warning bg-opacity-10';
                break;
            case 'Force Check-out':
                statusText = 'Force Check-out';
                statusClass = 'bg-danger';
                rowClass = 'table-danger bg-opacity-10';
                break;
            default:
                 statusClass = 'bg-secondary';
                 statusText = log.action;
        }
        
        // 3. Software/AI Used
        let softUsedDisplay = '<span class="text-muted">-</span>';
        if (Array.isArray(log.usedSoftware) && log.usedSoftware.length > 0) {
            softUsedDisplay = log.usedSoftware.map(s => {
                let isAI = s.toLowerCase().includes('gpt') || s.toLowerCase().includes('ai') || s.toLowerCase().includes('gemini');
                let color = isAI ? 'bg-info text-dark border-info' : 'bg-light text-dark border';
                return `<span class="badge ${color} border fw-normal mb-1 me-1">${s}</span>`;
            }).join('');
        }
        
        // 4. Time, Duration, Score
        const startTime = log.startTime || log.timestamp;
        const endTime = log.timestamp;
        const durationText = log.durationMinutes ? `${log.durationMinutes.toFixed(0)} min` : '-';
        const satisfactionScoreDisplay = getSatisfactionDisplay(log.satisfactionScore);
        
        return `
            <tr class="${rowClass}">
                <td class="text-center">${index + 1}</td> 
                
                <td class="small text-nowrap">${formatLogDate(endTime)}</td>
                <td class="small text-nowrap">${formatLogTime(startTime)}</td>
                <td class="small text-nowrap">${formatLogTime(endTime)}</td>
                <td>${userNameDisplay}</td>
                <td><span class="badge bg-dark fw-normal">PC-${log.pcId || '-'}</span></td>
                <td>${softUsedDisplay}</td>
                <td><span class="badge ${statusClass} fw-normal">${statusText}</span></td>
                <td class="text-end text-nowrap">${durationText}</td>
                <td class="text-center">${satisfactionScoreDisplay}</td>
            </tr>
        `;
    }).join('');
}

function formatExportDateTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }) + ' ' +
           date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatSoftwareForCSV(softwareArray) {
    if (!Array.isArray(softwareArray) || softwareArray.length === 0) return '';
    return softwareArray.join('; '); 
}

function exportCSV() {
    // 1. ดึง Log ที่ถูกกรองอยู่ในปัจจุบัน
    const filteredLogs = filterLogs(allLogs, getFilterParams());
    
    if (filteredLogs.length === 0) {
        alert("ไม่พบข้อมูล Log ตามเงื่อนไขที่เลือกสำหรับดาวน์โหลด");
        return;
    }

    // 2. HARDCODE: กำหนดหัวตาราง
    const headers = [
        "ลำดับ", 
        "วันที่", 
        "เวลาเข้า", 
        "เวลาออก", 
        "ผู้ใช้ / ID", 
        "คณะ / สังกัด", 
        "PC ที่ใช้", 
        "AI/Software ที่ใช้", 
        "สถานะ", 
        "ระยะเวลา (นาที)", 
        "ความพึงพอใจ (Score)"
    ];
    
    // 3. Map ข้อมูล Log ให้ตรงกับหัวตาราง
    const csvRows = filteredLogs.map((log, index) => {
        
        const startTimeStr = log.startTime ? formatExportDateTime(log.startTime) : formatExportDateTime(log.timestamp);
        const endTimeStr = formatExportDateTime(log.timestamp);
        const userNameDisplay = log.userName || log.userId || '';
        const userFaculty = log.userFaculty || (log.userRole === 'external' ? 'บุคคลภายนอก' : '');
        const pcName = `PC-${log.pcId || 'N/A'}`;
        const softwareList = formatSoftwareForCSV(log.usedSoftware);
        
        // ✅ FIX: แปลงสถานะให้เป็นคำที่อ่านง่าย
        let statusText = log.action;
        if (log.action === 'START_SESSION') statusText = 'Check in';
        else if (log.action === 'END_SESSION') statusText = 'Check out';
        else if (!statusText) statusText = 'Undefined';

        const durationMinutes = log.durationMinutes ? log.durationMinutes.toFixed(0) : '';
        const satisfactionScore = log.satisfactionScore !== undefined ? log.satisfactionScore : '';

        // สร้างแถวข้อมูลตามลำดับ Header
        return [
            `"${index + 1}"`, 
            `"${endTimeStr.split(' ')[0]}"`, 
            `"${startTimeStr.split(' ')[1]}"`, 
            `"${endTimeStr.split(' ')[1]}"`, 
            `"${userNameDisplay}"`, 
            `"${userFaculty}"`,
            `"${pcName}"`, 
            `"${softwareList}"`, 
            `"${statusText}"`, // ✅ ใช้ค่าที่แปลงแล้ว
            `"${durationMinutes}"`,
            `"${satisfactionScore}"`
        ].join(',');
    });

    // 4. รวม Header กับ Rows
    const csvContent = [
        headers.join(','),
        ...csvRows
    ].join('\n');

    // 5. สร้าง Blob และ Force Download
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) { 
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `Usage_Report_Filtered_${new Date().toISOString().slice(0, 10)}.csv`); 
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        alert(`✅ ดาวน์โหลดไฟล์ CSV ${filteredLogs.length} รายการ เรียบร้อยแล้ว`);
    }
}

function exportReport(mode) {
    const today = new Date();
    let startDate, endDate, fileNamePrefix;

    // 1. คำนวณช่วงเวลา
    switch(mode) {
        case 'daily':
            // วันนี้ (เริ่ม 00:00 - จบ 23:59 ของวันนี้)
            startDate = new Date(today);
            endDate = new Date(today);
            fileNamePrefix = `Daily_Report_${formatDateStr(today)}`;
            break;

        case 'monthly':
            // ต้นเดือน - ปลายเดือน
            startDate = new Date(today.getFullYear(), today.getMonth(), 1);
            endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            fileNamePrefix = `Monthly_Report_${today.getFullYear()}_${today.getMonth()+1}`;
            break;

        case 'yearly':
            // 1 ม.ค. - 31 ธ.ค.
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            fileNamePrefix = `Yearly_Report_${today.getFullYear()}`;
            break;
            
        default: // กรณี Custom Filter (ใช้ฟังก์ชัน exportCSV เดิม)
            exportCSV(); 
            return;
    }

    // 2. เรียกฟังก์ชันสร้างไฟล์ CSV โดยส่งวันที่ที่คำนวณได้ไปให้
    generateCSV(startDate, endDate, fileNamePrefix);
}

// ฟังก์ชันสร้างไฟล์ CSV (แยกออกมาเพื่อให้ใช้ร่วมกันได้)
function generateCSV(startDateObj, endDateObj, fileNamePrefix) {
    const allLogs = DB.getLogs();

    // กรองข้อมูลตามช่วงเวลา
    const filteredLogs = allLogs.filter(log => {
        const logDate = new Date(log.timestamp).setHours(0,0,0,0);
        return logDate >= startDateObj.setHours(0,0,0,0) && 
               logDate <= endDateObj.setHours(0,0,0,0);
    });

    if (filteredLogs.length === 0) {
        alert('ไม่พบข้อมูลในช่วงเวลาดังกล่าว');
        return;
    }

    // สร้างเนื้อหา CSV Header
    let csvContent = "ลำดับ,วันที่,เวลาเข้า,เวลาออก,ชื่อผู้ใช้,รหัส/ID,คณะ/หน่วยงาน,ประเภท,PC ID,Software/AI ที่ใช้,ระยะเวลา(นาที),ความพึงพอใจ\n";

    // วนลูปสร้างแถวข้อมูล
    filteredLogs.forEach((log, index) => {
        const dateStr = new Date(log.timestamp).toLocaleDateString('th-TH');
        const timeIn = log.startTime ? new Date(log.startTime).toLocaleTimeString('th-TH') : '-';
        const timeOut = new Date(log.timestamp).toLocaleTimeString('th-TH');
        
        let swStr = (log.usedSoftware && log.usedSoftware.length > 0) ? log.usedSoftware.join('; ') : "-";
        const clean = (text) => text ? String(text).replace(/,/g, " ") : "-";

        const row = [
            index + 1,
            dateStr,
            timeIn,
            timeOut,
            clean(log.userName),
            clean(log.userId),
            clean(log.userFaculty),
            clean(getUserType(log)),
            clean(log.pcId),
            `"${swStr}"`,
            log.durationMinutes || 0,
            log.satisfactionScore || "-"
        ];
        csvContent += row.join(",") + "\n";
    });

    // ดาวน์โหลดไฟล์
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileNamePrefix}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Helper: แปลง Date เป็น string สั้นๆ สำหรับตั้งชื่อไฟล์
function formatDateStr(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// Helper: แยกประเภทผู้ใช้ (ถ้ามีอยู่แล้วไม่ต้องใส่ซ้ำ)
function getUserType(log) {
    if (log.userRole === 'external' || log.userRole === 'Guest') return 'External';
    return 'Internal';
}

/* admin-report.js */

// เพิ่มบรรทัดนี้ใน document.addEventListener('DOMContentLoaded', ...)
document.addEventListener('DOMContentLoaded', () => {
    // ... โค้ดเดิม ...
    renderLifetimeStats(); // <--- เรียกฟังก์ชันนี้ให้ทำงาน
});

// --- ฟังก์ชันคำนวณยอดสะสมทั้งหมด ---
function renderLifetimeStats() {
    const allLogs = DB.getLogs(); // ดึง Log ทั้งหมดจาก Database
    const total = allLogs.length;

    // นับแยกประเภท (Internal vs External)
    let internalCount = 0;
    let externalCount = 0;

    allLogs.forEach(log => {
        if (log.userRole === 'external' || log.userRole === 'Guest') {
            externalCount++;
        } else {
            internalCount++;
        }
    });

    // แสดงตัวเลข (ใส่ลูกน้ำคั่นหลักพัน)
    document.getElementById('lifetimeTotalCount').innerText = total.toLocaleString();
    document.getElementById('lifetimeInternal').innerText = internalCount.toLocaleString();
    document.getElementById('lifetimeExternal').innerText = externalCount.toLocaleString();

    // คำนวณ % เพื่อทำหลอดพลัง (Progress Bar)
    const intPercent = total > 0 ? (internalCount / total) * 100 : 0;
    const extPercent = total > 0 ? (externalCount / total) * 100 : 0;

    document.getElementById('progInternal').style.width = `${intPercent}%`;
    document.getElementById('progExternal').style.width = `${extPercent}%`;
}

// --- ฟังก์ชัน IMPORT CSV ---
function processImportCSV(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = function(e) {
        const text = e.target.result;
        parseAndSaveCSV(text);
    };
    
    // อ่านไฟล์เป็น Text
    reader.readAsText(file);
    
    // Reset input เพื่อให้เลือกไฟล์เดิมซ้ำได้ถ้าต้องการ
    inputElement.value = ''; 
}

function parseAndSaveCSV(csvText) {
    // 1. แยกบรรทัด (รองรับทั้ง Windows \r\n และ Unix \n)
    const lines = csvText.split(/\r\n|\n/);
    
    // ตรวจสอบว่ามีข้อมูลไหม
    if (lines.length < 2) {
        alert("ไฟล์ CSV ว่างเปล่าหรือรูปแบบไม่ถูกต้อง");
        return;
    }

    let successCount = 0;
    
    // 2. วนลูปทีละบรรทัด (เริ่มที่ i=1 เพื่อข้าม Header บรรทัดแรก)
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 3. แยก Column (ระวังเรื่องเครื่องหมายจุลภาคใน "Software")
        // Logic: ถ้าเจอ "..." ให้ถือว่าเป็นก้อนเดียวกัน
        const columns = parseCSVLine(line);

        // ตรวจสอบความครบถ้วนของข้อมูล (อย่างน้อยต้องมี วันที่, ชื่อ, PC ID)
        if (columns.length < 9) continue; 

        // 4. แมพข้อมูลกลับเป็น Object (ต้องตรงกับลำดับในไฟล์ Export)
        // ลำดับ: ลำดับ, วันที่, เวลาเข้า, เวลาออก, ชื่อ, ID, คณะ, ประเภท, PC ID, Software, ...
        
        const dateStr = columns[1];     // วันที่ (DD/MM/YYYY)
        const timeOutStr = columns[3];  // เวลาออก (HH:mm:ss)
        const timestamp = convertToISO(dateStr, timeOutStr); // แปลงกลับเป็น ISO String

        // แปลงรายการ Software จาก String กลับเป็น Array
        // ตัวอย่าง: "ChatGPT; Claude" -> ["ChatGPT", "Claude"]
        let softwareArr = [];
        let cleanSoftwareStr = columns[9].replace(/^"|"$/g, ''); // ลบ "" ที่หัวท้ายออก
        if (cleanSoftwareStr && cleanSoftwareStr !== '-') {
            softwareArr = cleanSoftwareStr.split(';').map(s => s.trim());
        }

        const newLog = {
            action: 'Imported Log',
            timestamp: timestamp, // ใช้เวลาออกเป็น timestamp หลัก
            startTime: convertToISO(dateStr, columns[2]), // เวลาเข้า
            
            userName: columns[4],
            userId: columns[5],
            userFaculty: columns[6],
            userRole: columns[7] === 'External' ? 'Guest' : 'student', // แปลงกลับคร่าวๆ
            
            pcId: columns[8],
            usedSoftware: softwareArr,
            
            durationMinutes: parseInt(columns[11]) || 0,
            satisfactionScore: parseInt(columns[12]) || null
        };

        // 5. บันทึกลง DB
        DB.saveLog(newLog);
        successCount++;
    }

    // 6. แจ้งเตือนและรีเฟรช
    alert(`✅ นำเข้าข้อมูลสำเร็จ ${successCount} รายการ`);
    
    // โหลดหน้าใหม่เพื่อแสดงข้อมูลล่าสุด
    location.reload(); 
}

// Helper: แกะบรรทัด CSV โดยไม่สน comma ที่อยู่ในเครื่องหมายคำพูด ""
function parseCSVLine(text) {
    const result = [];
    let start = 0;
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        if (text[i] === '"') {
            inQuotes = !inQuotes; // สลับสถานะเมื่อเจอ "
        } else if (text[i] === ',' && !inQuotes) {
            // ถ้าเจอ , และไม่ได้อยู่ใน " ให้ตัดคำ
            result.push(text.substring(start, i));
            start = i + 1;
        }
    }
    // เก็บคำสุดท้าย
    result.push(text.substring(start));
    return result;
}

// Helper: แปลงวันที่จาก CSV (31/12/2025) กลับเป็น ISO Date object
function convertToISO(dateStr, timeStr) {
    if (!dateStr || dateStr === '-') return new Date().toISOString();
    
    try {
        const [day, month, year] = dateStr.split('/'); // 31, 12, 2568
        let jsYear = parseInt(year);
        // เช็คว่าเป็น พ.ศ. หรือ ค.ศ. (ถ้า > 2400 น่าจะเป็น พ.ศ.)
        if (jsYear > 2400) jsYear -= 543;

        // ถ้าไม่มีเวลา ให้ใช้เวลาปัจจุบัน
        const timePart = (timeStr && timeStr !== '-') ? timeStr : "00:00:00";
        
        // สร้าง Date Object: "2025-12-31T12:00:00"
        return new Date(`${jsYear}-${month}-${day}T${timePart}`).toISOString();
    } catch (e) {
        return new Date().toISOString();
    }
}