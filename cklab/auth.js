/* auth.js - Fixed Station Version (Updated for Booking Check-in) */

// ==========================================
// 🔧 SYSTEM CONFIG: ดึงเลขเครื่องจาก URL
// ==========================================
function getSystemPCId() {
    if (window.location.hash) {
        let id = window.location.hash.replace('#', '').replace(/pc-/i, '');
        return parseInt(id).toString();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('pc');
}

const FIXED_PC_ID = getSystemPCId(); 
// ==========================================

let verifiedUserData = null;
let activeTab = 'internal';

document.addEventListener('DOMContentLoaded', () => {
    // เช็ค PC ID
    if (!FIXED_PC_ID || isNaN(parseInt(FIXED_PC_ID))) {
        document.body.innerHTML = `
            <div class="d-flex justify-content-center align-items-center vh-100 flex-column text-center">
                <h2 class="text-danger">⚠️ ไม่พบหมายเลขเครื่อง (PC ID)</h2>
                <p class="text-muted">กรุณาระบุเลขเครื่องใน URL<br>ตัวอย่าง: <code>index.html?pc=1</code></p>
                <a href="index.html?pc=1" class="btn btn-primary mt-3">เข้าใช้งานเครื่องที่ 1</a>
            </div>
        `;
        return;
    }

    checkMachineStatus();

    const extInputs = document.querySelectorAll('#formExternal input');
    extInputs.forEach(input => {
        input.addEventListener('input', validateForm);
    });
});

function checkMachineStatus() {
    const displayId = document.getElementById('fixedPcIdDisplay');
    if(displayId) displayId.innerText = `PC-${FIXED_PC_ID.padStart(2, '0')}`;

    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    if (!pc) {
        alert(`System Error: ไม่พบข้อมูลเครื่อง PC-${FIXED_PC_ID}`);
        return;
    }
    
    // Status Indicator
    const indicator = document.querySelector('.status-indicator');
    if(indicator) {
        indicator.className = 'status-indicator';
        indicator.classList.add(
            `bg-${pc.status === 'available' ? 'success' : 
                   pc.status === 'in_use' ? 'danger' : 
                   pc.status === 'reserved' ? 'warning' : 'secondary'}`
        );
        indicator.title = pc.status.toUpperCase();
    }

    // Auto Resume Session
    if (pc.status === 'in_use') {
         const currentSession = DB.getSession();
         if (!currentSession || currentSession.pcId != FIXED_PC_ID) {
              DB.setSession({
                   pcId: FIXED_PC_ID,
                   user: { name: pc.currentUser || 'Unknown User' },
                   startTime: pc.startTime || Date.now()
              });
         }
         window.location.href = 'timer.html';
    } 
}

function switchTab(type) {
    activeTab = type;
    verifiedUserData = null;
    document.getElementById('tab-internal').classList.toggle('active', type === 'internal');
    document.getElementById('tab-external').classList.toggle('active', type === 'external');
    document.getElementById('formInternal').classList.toggle('d-none', type !== 'internal');
    document.getElementById('formExternal').classList.toggle('d-none', type !== 'external');
    document.getElementById('internalVerifyCard').style.display = 'none';
    
    if (type === 'internal') {
        document.getElementById('ubuUser').value = '';
    }
    validateForm();
}

function verifyUBUUser() {
    const id = document.getElementById('ubuUser').value.trim();
    if(!id) return alert("กรุณากรอกรหัส");
    
    const user = DB.checkRegAPI(id);
    const verifyCard = document.getElementById('internalVerifyCard');
    
    if (user) {
        verifiedUserData = { 
            id: id, 
            name: user.prefix + user.name, 
            faculty: user.faculty, 
            role: user.role, 
            level: user.level, 
            year: user.year 
        };

        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        document.getElementById('showRole').innerText = verifiedUserData.role.toUpperCase();
        
        verifyCard.style.display = 'block';
        validateForm();
    } else {
        alert("❌ ไม่พบข้อมูลในระบบ");
        verifyCard.style.display = 'none';
        verifiedUserData = null;
        validateForm();
    }
}

function validateForm() {
    let isUserValid = false;
    const btn = document.getElementById('btnConfirm');
    
    if (activeTab === 'internal') {
        isUserValid = (verifiedUserData !== null);
    } else {
        const id = document.getElementById('extIdCard').value.trim();
        const name = document.getElementById('extName').value.trim();
        isUserValid = (id !== '' && name !== '');
    }
    
    const pc = DB.getPCs().find(p => p.id == FIXED_PC_ID);
    
    // อนุญาตให้ปุ่มทำงานได้ ถ้าเครื่องว่าง OR ถูกจองไว้ (reserved)
    const isAccessible = pc && (pc.status === 'available' || pc.status === 'reserved');

    if (isUserValid && isAccessible) {
        btn.disabled = false;
        btn.classList.replace('btn-secondary', 'btn-success');
        
        if (pc.status === 'reserved') {
            btn.innerHTML = `<i class="bi bi-calendar-check me-2"></i>ยืนยันการเข้าใช้งาน (จองไว้)`;
        } else {
            btn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>เข้าสู่ระบบและเริ่มใช้งาน`;
        }
    } else {
        btn.disabled = true;
        btn.classList.replace('btn-success', 'btn-secondary');
        if (!isAccessible) {
            btn.textContent = `❌ เครื่องไม่ว่าง (${pc.status})`;
        } else {
            btn.textContent = 'กรุณากรอกข้อมูลให้ครบ';
        }
    }
}

// ✅ ฟังก์ชันยืนยันการเข้าใช้งาน (Check-in) ที่เพิ่ม Logic ตรวจสอบการจอง
function confirmCheckIn() {
    // 1. ตรวจสอบว่ามีข้อมูลผู้ใช้ที่ Verify ผ่านแล้วหรือไม่
    if (!verifiedUserData && activeTab === 'internal') {
        alert('กรุณาตรวจสอบข้อมูลผู้ใช้ก่อน (กดปุ่มตรวจสอบ)');
        return;
    }

    // เตรียมข้อมูลผู้ใช้กรณี External
    if (activeTab === 'external') {
        verifiedUserData = {
            id: document.getElementById('extIdCard').value.trim(),
            name: document.getElementById('extName').value.trim(),
            faculty: document.getElementById('extOrg').value.trim() || 'บุคคลทั่วไป',
            role: 'external',
            level: 'N/A',
            year: 'N/A'
        };
    }

    // 2. ใช้ PC ID ที่ได้จาก URL (FIXED_PC_ID)
    const pcId = FIXED_PC_ID; 

    // 3. ✅ ตรวจสอบประเภทการใช้งาน (Walk-in vs Booking)
    const usageTypeEl = document.querySelector('input[name="usageType"]:checked');
    const usageType = usageTypeEl ? usageTypeEl.value : 'walkin';

    if (usageType === 'booking') {
        const bookings = DB.getBookings(); // ดึงข้อมูลการจองทั้งหมด
        const todayStr = new Date().toLocaleDateString('en-CA');
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // ค้นหา Booking ที่ตรงเงื่อนไข
        const validBooking = bookings.find(b => 
            String(b.pcId) === String(pcId) &&      // ตรงเครื่อง
            b.date === todayStr &&                   // ตรงวัน
            b.status === 'approved' &&               // สถานะอนุมัติ
            b.userName === verifiedUserData.name     // ชื่อตรงกับที่ Verify
        );

        if (!validBooking) {
            alert(`⚠️ ไม่พบข้อมูลการจอง!\n\nคุณ ${verifiedUserData.name} ไม่ได้จองเครื่อง PC-${pcId} ไว้ในวันนี้\n\nกรุณาเลือก "Walk-in" หรือตรวจสอบเครื่องที่ท่านจองครับ`);
            return; // ❌ หยุดการทำงานทันที
        }

        // (Optional) เช็คเวลาเข้าสาย/ก่อนเวลา
        const [startH, startM] = validBooking.startTime.split(':').map(Number);
        const bookingStartMins = startH * 60 + startM;
        
        // ยอมให้เข้าก่อนเวลา 15 นาที
        if (currentMinutes < (bookingStartMins - 15)) {
            alert(`⏳ ยังไม่ถึงเวลาจอง\nคิวของคุณคือ ${validBooking.startTime} - ${validBooking.endTime}`);
            return;
        }
    }
    // ✅ จบส่วนที่เพิ่ม

    // 4. บันทึก Session และเปลี่ยนหน้า
    const sessionData = {
        user: {
            id: verifiedUserData.id,
            name: verifiedUserData.name,
            userType: verifiedUserData.role,
            faculty: verifiedUserData.faculty
        },
        pcId: pcId,
        startTime: Date.now(),
        loginMethod: usageType
    };

    DB.setSession(sessionData); // บันทึก Session ลง LocalStorage
    DB.updatePCStatus(pcId, 'in_use', verifiedUserData.name); // อัปเดตสถานะเครื่องใน DB

    // บันทึก Log
    DB.saveLog({
        action: 'START_SESSION',
        userId: verifiedUserData.id,
        userName: verifiedUserData.name,
        userRole: verifiedUserData.role,
        userFaculty: verifiedUserData.faculty,
        pcId: pcId,
        startTime: new Date().toISOString(),
        details: usageType === 'booking' ? 'User Check-in (Booking)' : 'User Check-in (Walk-in)'
    });

    // ไปยังหน้าจับเวลา
    window.location.href = 'timer.html';
}