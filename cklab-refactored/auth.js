/* auth.js */

// ฟังก์ชันสลับแท็บ (Display Toggle)
function switchTab(type) {
    // 1. จัดการปุ่มกด (Active State)
    document.getElementById('tab-internal').classList.toggle('active', type === 'internal');
    document.getElementById('tab-external').classList.toggle('active', type === 'external');

    // 2. ซ่อน/แสดงฟอร์ม
    document.getElementById('formInternal').style.display = (type === 'internal') ? 'block' : 'none';
    document.getElementById('formExternal').style.display = (type === 'external') ? 'block' : 'none';
}

// Login: ผู้ใช้ภายใน (เหมือนเดิม)
function loginInternal() {
    const idInput = document.getElementById('intId');
    const id = idInput.value.trim();

    if (!id) return alert("กรุณากรอกรหัสนักศึกษา");

    const user = DB.checkUser(id); // เช็คจาก mock-db.js

    if (user) {
        // บันทึก Session (type: internal)
        DB.setSession({ 
            user: { ...user, id: id, userType: 'internal' } 
        });
        window.location.href = 'map.html';
    } else {
        alert("ไม่พบข้อมูล (Hint: ลองใช้รหัส 66123456)");
        idInput.value = '';
    }
}

// Login: บุคคลภายนอก (ใหม่)
function loginExternal() {
    const card = document.getElementById('extCard').value.trim();
    const name = document.getElementById('extName').value.trim();
    const org = document.getElementById('extOrg').value.trim();

    if (!card || !name || !org) {
        return alert("กรุณากรอกข้อมูลให้ครบถ้วน");
    }

    // สร้าง User Object สำหรับบุคคลภายนอก
    const guestUser = {
        id: card,           // ใช้เลขบัตรแทนรหัสนักศึกษา
        name: name,
        faculty: org,       // ใช้ชื่อหน่วยงานแทนคณะ
        userType: 'external',
        role: 'guest'
    };

    // บันทึก Session และไปต่อ
    DB.setSession({ user: guestUser });
    window.location.href = 'map.html';
}

// Auto Redirect ถ้ามี Session ค้าง (Optional)
document.addEventListener('DOMContentLoaded', () => {
    const session = DB.getSession();
    if(session && session.user && !session.pcId) {
        // window.location.href = 'map.html'; 
    }
});