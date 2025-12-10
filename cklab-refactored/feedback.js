let currentRate = 5; // Default rating

document.addEventListener('DOMContentLoaded', () => {
    // โหลดดาวเริ่มต้น (5 ดาว)
    setRate(5);
});

function setRate(rate) {
    currentRate = rate;
    document.getElementById('rateDisplay').innerText = rate;

    // จัดการสีดาว (Highlight)
    const stars = document.querySelectorAll('#starContainer span');
    stars.forEach((star, index) => {
        if (index < rate) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
}

function submitFeedback() {
    const session = DB.getSession();

    if (session) {
        // 1. คืนสถานะเครื่องเป็น Available
        DB.updatePCStatus(session.pcId, 'available');

        // 2. บันทึก Log การ Check-out
        DB.saveLog({
            action: 'Check-out',
            user: session.user.name,
            userId: session.user.id,
            pcId: session.pcId,
            rating: currentRate
        });

        // 3. ล้าง Session
        DB.clearSession();
    }

    alert('ขอบคุณที่ใช้บริการ CKLab');
    window.location.href = 'index.html';
}