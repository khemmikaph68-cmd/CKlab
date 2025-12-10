document.addEventListener('DOMContentLoaded', () => {
    // 1. ตรวจสอบว่า Login มาหรือยัง
    const session = DB.getSession();
    if (!session || !session.user) {
        alert("กรุณาเข้าสู่ระบบก่อน");
        window.location.href = 'index.html';
        return;
    }

    // 2. แสดงชื่อผู้ใช้ที่ Navbar
    document.getElementById('navUserDisplay').innerText = session.user.name;

    // 3. วาดผังเครื่อง
    renderMap();

    // 4. (Optional) Auto-refresh สถานะเครื่องทุก 5 วินาที เพื่อให้เห็น Real-time
    setInterval(renderMap, 5000);
});

function renderMap() {
    const grid = document.getElementById('pcGrid');
    // ดึงข้อมูลเครื่องล่าสุดจาก DB
    const pcs = DB.getPCs(); 
    
    // เก็บ HTML ที่จะสร้าง
    let htmlContent = '';

    pcs.forEach(pc => {
        // กำหนด Class สีและสถานะการกด
        let statusClass = `status-${pc.status}`;
        let isDisabled = pc.status !== 'available' ? 'disabled' : '';
        let clickAction = pc.status === 'available' ? `onclick="selectPC(${pc.id})"` : '';
        
        // เพิ่มไอคอนตามสถานะ
        let icon = '🖥️';
        if (pc.status === 'maintenance') icon = '🔧';
        if (pc.status === 'in_use') icon = '⛔';

        htmlContent += `
        <div class="col-6 col-md-4 col-lg-3">
            <button class="pc-box ${statusClass} ${isDisabled}" ${clickAction}>
                <div class="fs-2 mb-1">${icon}</div>
                <h5 class="m-0">${pc.name}</h5>
                <small class="opacity-75 text-uppercase" style="font-size: 0.75rem;">${pc.status}</small>
            </button>
        </div>`;
    });

    grid.innerHTML = htmlContent;
}

function selectPC(pcId) {
    // บันทึก ID เครื่องที่เลือกลง Session
    DB.setSession({ pcId: pcId });
    // ไปหน้ายืนยัน
    window.location.href = 'confirm.html';
}

function cancelSession() {
    if(confirm('ต้องการยกเลิกและกลับไปหน้าแรก?')) {
        DB.clearSession();
        window.location.href = 'index.html';
    }
}