document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();

    // 1. Check Session: ถ้าไม่มี Session หรือเวลาเริ่ม ให้กลับไปหน้าแรก
    if (!session || !session.startTime) {
        window.location.href = 'index.html';
        return;
    }

    // 2. แสดงข้อมูล
    document.getElementById('userDisplay').innerText = session.user.name;
    
    // ดึงชื่อเครื่องจาก DB หรือ Session (ถ้าใน Session ไม่ได้เก็บชื่อไว้ ให้ดึงจาก ID)
    const pcId = session.pcId;
    const pc = DB.getPCs().find(p => p.id == pcId);
    document.getElementById('pcNameDisplay').innerText = pc ? pc.name : `PC-${pcId}`;

    // 3. เริ่มจับเวลา
    startTimer(session.startTime);
});

function startTimer(startTime) {
    // อัปเดตทุก 1 วินาที
    setInterval(() => {
        const now = Date.now();
        const diff = now - startTime;

        // คำนวณ ชั่วโมง:นาที:วินาที
        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');

        const timerEl = document.getElementById('timer');
        if (timerEl) timerEl.innerText = `${h}:${m}:${s}`;
    }, 1000);
}

function checkout() {
    if (confirm('คุณต้องการเลิกใช้งานและออกจากระบบใช่หรือไม่?')) {
        // ไปหน้าประเมินความพึงพอใจ
        window.location.href = 'feedback.html';
    }
}