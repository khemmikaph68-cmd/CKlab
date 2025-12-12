/* admin-monitor.js */

let checkInModal; // ตัวแปรเก็บ Modal Object
let currentTab = 'internal'; // สถานะ Tab ปัจจุบัน (internal/external)
let verifiedUserData = null; // เก็บข้อมูลผู้ใช้ที่ตรวจสอบผ่านแล้ว

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็คสิทธิ์ Admin
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    // 2. Init Modal
    const modalEl = document.getElementById('checkInModal');
    if (modalEl) {
        checkInModal = new bootstrap.Modal(modalEl);
    }

    // 3. เริ่ม Render
    renderMonitor();
    updateClock();
    
    // Auto Refresh ทุก 3 วินาที (เพื่อให้เวลาเดิน)
    setInterval(() => {
        if (modalEl && !modalEl.classList.contains('show')) {
            renderMonitor();
        }
    }, 3000);
    
    setInterval(updateClock, 1000);
});

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clockDisplay');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('th-TH');
}

// --- 1. RENDER GRID (แสดงหน้าจอ Monitor) ---
function renderMonitor() {
    const grid = document.getElementById('monitorGrid');
    if(!grid) return;

    const pcs = DB.getPCs();
    const bookings = (DB.getBookings && typeof DB.getBookings === 'function') ? DB.getBookings() : []; // ดึงข้อมูลการจอง
    const todayStr = new Date().toISOString().split('T')[0]; // วันที่ปัจจุบัน YYYY-MM-DD

    grid.innerHTML = '';

    pcs.forEach(pc => {
        let statusClass = '';
        let iconClass = '';
        let label = '';
        let cardBorder = '';

        // Map status
        switch(pc.status) {
            case 'available': 
                statusClass = 'text-success'; 
                cardBorder = 'border-success';
                iconClass = 'bi-check-circle'; 
                label = 'ว่าง (Available)';
                break;
            case 'in_use': 
                statusClass = 'text-danger'; 
                cardBorder = 'border-danger';
                iconClass = 'bi-person-workspace'; 
                label = 'ใช้งาน (In Use)';
                break;
            case 'reserved': 
                statusClass = 'text-warning'; 
                cardBorder = 'border-warning';
                iconClass = 'bi-bookmark-fill'; 
                label = 'จอง (Reserved)';
                break;
            default: 
                statusClass = 'text-secondary'; 
                cardBorder = 'border-secondary';
                iconClass = 'bi-wrench-adjustable'; 
                label = 'ชำรุด (Maintenance)';
        }

        const userDisplay = pc.currentUser ? 
            `<div class="mt-2 small text-dark fw-bold text-truncate"><i class="bi bi-person-fill"></i> ${pc.currentUser}</div>` : 
            `<div class="mt-2 small text-muted">-</div>`;

        // --- ส่วนที่ 1: แสดงรอบเวลา (Booking Slot) ---
        // หาการจองที่ตรงกับเครื่องนี้, วันนี้, และสถานะ approved
        // (ถ้ามีคนใช้งานอยู่ พยายามหาอันที่ชื่อตรงกันก่อน ถ้าไม่มีเอาอันแรกที่เจอ)
        let activeBooking = bookings.find(b => 
            b.pcId == pc.id && 
            b.date === todayStr && 
            b.status === 'approved' &&
            (pc.currentUser ? b.userName === pc.currentUser : true)
        );

        let timeSlotInfo = '';
        if (activeBooking) {
            timeSlotInfo = `<div class="d-flex align-items-center justify-content-center text-primary mt-1" style="font-size: 0.75rem;">
                <i class="bi bi-calendar-check me-1"></i> จอง: ${activeBooking.startTime} - ${activeBooking.endTime}
            </div>`;
        } else if (pc.status === 'in_use') {
             timeSlotInfo = `<div class="text-muted mt-1" style="font-size: 0.75rem;">(Walk-in)</div>`;
        } else {
             timeSlotInfo = `<div class="text-muted mt-1" style="font-size: 0.75rem; visibility: hidden;">-</div>`; // เว้นที่ไว้
        }

        // --- ส่วนที่ 2: แสดงเวลาที่ใช้ไป (Usage Duration) ---
        let usageTimeBadge = '';
        if (pc.status === 'in_use' && pc.startTime) {
            const diffMs = Date.now() - pc.startTime;
            const diffMins = Math.floor(diffMs / 60000);
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            const timeTxt = hrs > 0 ? `${hrs}ชม. ${mins}น.` : `${mins} นาที`;
            
            // เปลี่ยนสีถ้าใช้นานเกิน 3 ชม.
            const badgeColor = hrs >= 3 ? 'bg-danger' : 'bg-warning text-dark';
            
            usageTimeBadge = `<div class="badge ${badgeColor} mt-1 border" title="เริ่มเมื่อ ${new Date(pc.startTime).toLocaleTimeString('th-TH')}">
                <i class="bi bi-stopwatch-fill"></i> ใช้ไป ${timeTxt}
            </div>`;
        } else {
            // ใส่ช่องว่างไว้ไม่ให้การ์ดกระตุกเวลาสถานะเปลี่ยน
            usageTimeBadge = `<div class="mt-1" style="height: 21px;"></div>`; 
        }

        // --- ส่วนที่ 3: Software Badges ---
        let softwareHtml = '';
        if (pc.installedSoftware && Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
            softwareHtml = '<div class="mt-2 pt-2 border-top d-flex flex-wrap justify-content-center gap-1">';
            const showCount = 2; 
            pc.installedSoftware.slice(0, showCount).forEach(sw => {
                softwareHtml += `<span class="badge bg-light text-secondary border" style="font-size: 0.65rem;">${sw}</span>`;
            });
            if (pc.installedSoftware.length > showCount) {
                softwareHtml += `<span class="badge bg-light text-secondary border" style="font-size: 0.65rem;">+${pc.installedSoftware.length - showCount}</span>`;
            }
            softwareHtml += '</div>';
        } else {
             softwareHtml = '<div class="mt-2 pt-2 border-top" style="height: 29px;"></div>';
        }

        // สร้าง HTML Card
        grid.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm ${cardBorder}" style="cursor: pointer; transition: transform 0.2s;" 
                     onclick="handlePcClick('${pc.id}')" onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
                    <div class="card-body text-center p-3">
                        <div class="d-flex justify-content-between align-items-start position-absolute top-0 end-0 p-2">
                             ${pc.installedSoftware && pc.installedSoftware.includes('GPU') ? '<i class="bi bi-gpu-card text-primary" title="High Perf"></i>' : ''}
                        </div>

                        <i class="bi ${iconClass} display-6 ${statusClass} mb-2"></i>
                        <h5 class="fw-bold mb-0 text-dark">${pc.name}</h5>
                        <div class="badge bg-light text-dark border mb-1">${label}</div>
                        
                        ${userDisplay}
                        
                        ${timeSlotInfo}
                        ${usageTimeBadge}

                        ${softwareHtml} 
                    </div>
                </div>
            </div>
        `;
    });
}

// --- 2. HANDLE CLICK (จัดการเมื่อคลิกเครื่อง) ---
function handlePcClick(pcId) {
    const pc = DB.getPCs().find(p => String(p.id) === String(pcId));
    if (!pc) return;

    if (pc.status === 'available') {
        openCheckInModal(pc);
    } else if (pc.status === 'in_use') {
        if(confirm(`⚠️ เครื่อง ${pc.name} กำลังใช้งานโดย ${pc.currentUser}\nต้องการบังคับออกจากระบบ (Force Logout) หรือไม่?`)) {
            performForceCheckout(pc.id);
        }
    } else {
        alert(`เครื่องนี้สถานะ ${pc.status} ไม่สามารถดำเนินการได้ในขณะนี้`);
    }
}

// --- 3. MODAL LOGIC (เปิดหน้าต่าง Check-in) ---
function openCheckInModal(pc) {
    document.getElementById('checkInPcId').value = pc.id;
    document.getElementById('modalPcName').innerText = `Station: ${pc.name}`;
    
    const swContainer = document.getElementById('modalSoftwareTags');
    swContainer.innerHTML = '';
    
    if (pc.installedSoftware && Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
        pc.installedSoftware.forEach(sw => {
            swContainer.innerHTML += `<span class="badge bg-info text-dark me-1 border border-info bg-opacity-25">${sw}</span>`;
        });
    } else {
        swContainer.innerHTML = '<span class="text-muted small">- ไม่มีข้อมูล Software -</span>';
    }

    switchTab('internal');
    document.getElementById('ubuUser').value = '';
    document.getElementById('extIdCard').value = '';
    document.getElementById('extName').value = '';
    document.getElementById('extOrg').value = '';
    document.getElementById('internalVerifyCard').classList.add('d-none');
    
    const btnConfirm = document.getElementById('btnConfirm');
    btnConfirm.disabled = true;
    btnConfirm.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
    btnConfirm.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>ยืนยัน Check-in';
    
    verifiedUserData = null;
    if(checkInModal) checkInModal.show();
}

// --- 4. TAB SWITCHING (สลับแท็บ) ---
function switchTab(tabName) {
    currentTab = tabName;
    const btnInternal = document.getElementById('tab-internal');
    const btnExternal = document.getElementById('tab-external');
    const formInternal = document.getElementById('formInternal');
    const formExternal = document.getElementById('formExternal');
    const btnConfirm = document.getElementById('btnConfirm');

    if (tabName === 'internal') {
        btnInternal.classList.add('active', 'bg-primary', 'text-white');
        btnInternal.classList.remove('border');
        btnExternal.classList.remove('active', 'bg-primary', 'text-white');
        btnExternal.classList.add('border');
        
        formInternal.classList.remove('d-none');
        formExternal.classList.add('d-none');
        
        btnConfirm.disabled = !verifiedUserData;
        if(verifiedUserData) {
            btnConfirm.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
        } else {
            btnConfirm.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
        }

    } else {
        btnExternal.classList.add('active', 'bg-primary', 'text-white');
        btnExternal.classList.remove('border');
        btnInternal.classList.remove('active', 'bg-primary', 'text-white');
        btnInternal.classList.add('border');
        
        formExternal.classList.remove('d-none');
        formInternal.classList.add('d-none');
        
        btnConfirm.disabled = false;
        btnConfirm.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
    }
}

// --- 5. VERIFY USER (ตรวจสอบรหัส) ---
function verifyUBUUser() {
    const userIdInput = document.getElementById('ubuUser');
    const userId = userIdInput.value.trim();
    if (!userId) { 
        alert('กรุณากรอกรหัสนักศึกษา / บุคลากร'); 
        userIdInput.focus();
        return; 
    }

    const user = DB.checkRegAPI(userId);

    if (user) {
        verifiedUserData = {
            id: userId,
            name: user.prefix + user.name,
            faculty: user.faculty,
            role: user.role
        };
        document.getElementById('internalVerifyCard').classList.remove('d-none');
        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        
        const btnConfirm = document.getElementById('btnConfirm');
        btnConfirm.disabled = false;
        btnConfirm.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
    } else {
        alert('❌ ไม่พบข้อมูลในระบบ (ลองใช้รหัส: 66123456)');
        verifiedUserData = null;
        document.getElementById('internalVerifyCard').classList.add('d-none');
        const btnConfirm = document.getElementById('btnConfirm');
        btnConfirm.disabled = true;
        btnConfirm.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
    }
}

// --- 6. CONFIRM CHECK-IN (บันทึกข้อมูล) ---
function confirmCheckIn() {
    const pcId = document.getElementById('checkInPcId').value;
    let finalName = "";
    let userType = "";
    let finalId = "";

    if (currentTab === 'internal') {
        if (!verifiedUserData) return;
        finalName = verifiedUserData.name;
        userType = verifiedUserData.role;
        finalId = verifiedUserData.id;
    } else {
        const extName = document.getElementById('extName').value.trim();
        const extOrg = document.getElementById('extOrg').value.trim();
        const extId = document.getElementById('extIdCard').value.trim();
        
        if (!extName) { 
            alert('กรุณากรอกชื่อ-นามสกุล'); 
            document.getElementById('extName').focus();
            return; 
        }
        finalName = extName + (extOrg ? ` (${extOrg})` : '');
        userType = 'Guest';
        finalId = extId || 'N/A';
    }

    // อัปเดตสถานะเป็น in_use
    DB.updatePCStatus(pcId, 'in_use', finalName);
    
    DB.saveLog({
        action: 'Admin Check-in',
        userId: finalId,
        userName: finalName,
        userRole: userType,
        pcId: pcId,
        details: 'Manual check-in by Admin'
    });
    
    if(checkInModal) checkInModal.hide();
    renderMonitor();
}

// --- 7. FORCE CHECK-OUT (บันทึกคะแนน 5) ---
function performForceCheckout(pcId) {
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));
    const currentUser = pc ? pc.currentUser : 'Unknown';

    DB.updatePCStatus(pcId, 'available');
    
    DB.saveLog({
        action: 'Force Check-out',
        pcId: pcId,
        user: currentUser,
        userRole: 'System Admin',
        details: 'Forced logout via Monitor (Auto Rating 5/5)',
        satisfactionScore: 5 
    });

    renderMonitor();
}