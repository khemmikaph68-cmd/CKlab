document.addEventListener('DOMContentLoaded', () => {
    renderMonitor();
    // รีเฟรชอัตโนมัติทุก 3 วินาที
    setInterval(renderMonitor, 3000);
});

function renderMonitor() {
    const grid = document.getElementById('monitorGrid');
    const pcs = DB.getPCs(); // ดึงข้อมูลจาก Mock DB

    grid.innerHTML = '';
    pcs.forEach(pc => {
        // กำหนดสี
        let colorClass = `status-${pc.status}`; // status-available, status-in_use (จาก main.css)
        
        // ปุ่ม Force Stop จะโผล่มาเฉพาะตอน In-use
        let actionBtn = pc.status === 'in_use' 
            ? `<button onclick="forceStop(${pc.id})" class="btn btn-sm btn-light text-danger fw-bold mt-2 shadow-sm">Force Stop</button>` 
            : '';

        let info = pc.currentUser ? `<small class="d-block mt-1 opacity-75">👤 ${pc.currentUser}</small>` : '';

        grid.innerHTML += `
        <div class="col-md-3">
            <div class="pc-box ${colorClass} p-3 text-center" style="cursor: default;">
                <h4 class="m-0">${pc.name}</h4>
                <span class="badge bg-white text-dark mt-1 opacity-75">${pc.status}</span>
                ${info}
                ${actionBtn}
            </div>
        </div>`;
    });
}

function forceStop(id) {
    if(confirm('คุณต้องการสั่งหยุดการใช้งานเครื่องนี้ทันทีใช่หรือไม่?')) {
        DB.updatePCStatus(id, 'available');
        // บันทึก Log ว่า Admin เป็นคนสั่ง
        DB.saveLog({ action: 'Force-Stop', pcId: id, user: 'Admin' });
        renderMonitor();
    }
}