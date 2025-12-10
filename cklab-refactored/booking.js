let currentSession = null;
let selectedPC = null;

document.addEventListener('DOMContentLoaded', () => {
    // 1. ดึงข้อมูล Session
    currentSession = DB.getSession();

    // ถ้าไม่มีข้อมูล หรือไม่ได้เลือกเครื่อง ให้ดีดกลับ
    if (!currentSession || !currentSession.user || !currentSession.pcId) {
        alert('ข้อมูลไม่ครบถ้วน กรุณาทำรายการใหม่');
        window.location.href = 'index.html';
        return;
    }

    // 2. ค้นหาข้อมูลเครื่องจาก DB (เพื่อให้แน่ใจว่าเครื่องยังว่างอยู่)
    const pcs = DB.getPCs();
    selectedPC = pcs.find(p => p.id == currentSession.pcId);

    // กรณีเครื่องหาย หรือถูกคนอื่นแย่งจองไปเสี้ยววินาทีก่อนหน้านี้
    if (!selectedPC) {
        alert('เกิดข้อผิดพลาดไม่พบเครื่องนี้');
        window.location.href = 'map.html';
        return;
    }
    if (selectedPC.status !== 'available') {
        alert('ขออภัย เครื่องนี้เพิ่งถูกจองไป กรุณาเลือกเครื่องใหม่');
        window.location.href = 'map.html';
        return;
    }

    // 3. แสดงผลหน้าจอ
    document.getElementById('confirmUser').innerText = currentSession.user.name;
    document.getElementById('confirmId').innerText = currentSession.user.id;
    document.getElementById('confirmPC').innerText = selectedPC.name;
});

function confirmBooking() {
    if (!selectedPC || !currentSession) return;

    // A. อัปเดตสถานะเครื่องใน DB เป็น 'in_use'
    // ส่งชื่อผู้ใช้เข้าไปด้วย เพื่อให้ Admin เห็นว่าใครนั่งอยู่
    DB.updatePCStatus(selectedPC.id, 'in_use', currentSession.user.name);

    // B. เริ่มต้นเวลา (Start Time)
    const startTime = Date.now();
    // อัปเดต Session เพิ่มเวลาเข้าไป
    DB.setSession({ startTime: startTime });

    // C. บันทึก Log การเข้าใช้งาน (Check-in Log)
    DB.saveLog({
        action: 'Check-in',
        user: currentSession.user.name,
        userId: currentSession.user.id,
        userType: currentSession.user.userType || 'unknown',
        pcId: selectedPC.id,
        pcName: selectedPC.name
    });

    // D. ไปยังหน้าจับเวลา (Step 4)
    window.location.href = 'timer.html';
}