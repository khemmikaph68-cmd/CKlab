document.addEventListener('DOMContentLoaded', () => {
    renderLogs();
    renderChart();
});

function renderLogs() {
    const logs = DB.getLogs(); // ดึง Logs จาก mock-db
    const tbody = document.getElementById('logTable');
    
    // เรียงจากใหม่ไปเก่า และตัดมาแค่ 20 รายการ
    const recentLogs = logs.slice().reverse().slice(0, 20);

    tbody.innerHTML = '';
    recentLogs.forEach(log => {
        // จัดรูปแบบวันที่
        const timeStr = new Date(log.timestamp).toLocaleString('th-TH');
        
        tbody.innerHTML += `
            <tr>
                <td>${timeStr}</td>
                <td><span class="badge bg-info text-dark">${log.action}</span></td>
                <td>${log.user || '-'}</td>
                <td>PC-${log.pcId || '?'}</td>
                <td>${log.rating ? '⭐ '+log.rating : ''}</td>
            </tr>
        `;
    });
}

function renderChart() {
    const logs = DB.getLogs();
    const pcs = DB.getPCs();
    
    // นับจำนวนการ Check-in ของแต่ละเครื่อง
    const pcUsage = {};
    pcs.forEach(p => pcUsage[p.name] = 0); // Init 0

    logs.forEach(log => {
        if(log.action === 'Check-in' && log.pcName) {
            pcUsage[log.pcName] = (pcUsage[log.pcName] || 0) + 1;
        }
    });

    const ctx = document.getElementById('usageChart');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(pcUsage),
            datasets: [{
                label: 'จำนวนครั้งที่ใช้งาน',
                data: Object.values(pcUsage),
                backgroundColor: '#0d6efd'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}