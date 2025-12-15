/* admin-monitor.js (Final Enhanced Version) */

let checkInModal;
let currentTab = 'internal';
let verifiedUserData = null;
let currentFilter = 'all'; // ตัวแปรเก็บสถานะการกรองปัจจุบัน
let searchQuery = '';      // ตัวแปรเก็บคำค้นหา

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็คสิทธิ์ Admin
    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        // window.location.href = 'admin-login.html'; // Uncomment ในระบบจริง
    }

    // 2. Init Modal
    const modalEl = document.getElementById('checkInModal');
    if (modalEl) {
        checkInModal = new bootstrap.Modal(modalEl);
    }

    // 3. เริ่มทำงาน
    renderMonitor();
    updateClock();
    checkAndSwitchBookingQueue(); // เช็คคิว 1 รอบ

    // Auto Refresh (ทุก 5 วินาที)
    setInterval(() => {
        // อัปเดตเฉพาะตอน Modal ปิดอยู่ เพื่อไม่ให้ขัดจังหวะการกรอกข้อมูล
        if (modalEl && !modalEl.classList.contains('show')) {
            renderMonitor();
        }
    }, 5000);
    
    // นาฬิกา (ทุก 1 วินาที)
    setInterval(updateClock, 1000);
    
    // เช็คคิวจอง (ทุก 1 นาที)
    setInterval(checkAndSwitchBookingQueue, 60000);
});

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clockDisplay');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('th-TH');
}

// ==========================================
// 🔄 Auto Booking Switcher (ฉลาดขึ้น)
// ==========================================
function checkAndSwitchBookingQueue() {
    const pcs = DB.getPCs();
    const bookings = DB.getBookings();
    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let hasChanges = false;

    pcs.forEach(pc => {
        // ข้ามเครื่องที่กำลังใช้งานจริง (In Use) ยกเว้นว่าเป็น Admin อยากให้ระบบทับ
        if (pc.status === 'in_use' || pc.status === 'maintenance') return;

        // หาการจองที่ "Approve" แล้ว ของ "วันนี้" และ "เครื่องนี้"
        const myBookings = bookings.filter(b => 
            String(b.pcId) === String(pc.id) && 
            b.date === todayStr && 
            b.status === 'approved'
        );

        // หา Booking ที่ Active ตอนนี้
        const activeBooking = myBookings.find(b => {
            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            const start = sh * 60 + sm;
            const end = eh * 60 + em;
            // แถมเวลาให้ Check-in ก่อน 15 นาที (Buffer)
            return currentMinutes >= (start - 15) && currentMinutes < end;
        });

        if (activeBooking) {
            // ถึงเวลาจองแล้ว -> เปลี่ยนสถานะเป็น Reserved (ถ้ายังไม่เป็น)
            if (pc.status !== 'reserved' || pc.currentUser !== activeBooking.userName) {
                console.log(`[Auto] Locking PC-${pc.id} for ${activeBooking.userName}`);
                DB.updatePCStatus(pc.id, 'reserved', activeBooking.userName);
                hasChanges = true;
            }
        } else {
            // หมดเวลาจองแล้ว หรือไม่มีคิว -> คืนสถานะว่าง (ถ้าค้างอยู่ที่ Reserved)
            if (pc.status === 'reserved') {
                console.log(`[Auto] Releasing PC-${pc.id} to Available`);
                DB.updatePCStatus(pc.id, 'available');
                hasChanges = true;
            }
        }
    });

    if (hasChanges) renderMonitor();
}

// ==========================================
// 🖥️ Render Monitor Grid (รองรับ Search & Filter)
// ==========================================

// ฟังก์ชันสำหรับปุ่ม Filter (ถ้าจะเพิ่มใน HTML)
function filterPC(status) {
    currentFilter = status;
    renderMonitor();
}

// ฟังก์ชันสำหรับช่อง Search (ถ้าจะเพิ่มใน HTML)
function searchPC() {
    const input = document.getElementById('searchPC');
    if (input) {
        searchQuery = input.value.trim().toLowerCase();
        renderMonitor();
    }
}

function renderMonitor() {
    const grid = document.getElementById('monitorGrid');
    if(!grid) return;

    let pcs = DB.getPCs();
    const bookings = DB.getBookings();
    const todayStr = new Date().toISOString().split('T')[0]; 

    // 1. กรองตามสถานะ (Filter)
    if (currentFilter !== 'all') {
        pcs = pcs.filter(pc => pc.status === currentFilter);
    }

    // 2. กรองตามคำค้นหา (Search)
    if (searchQuery) {
        pcs = pcs.filter(pc => 
            pc.name.toLowerCase().includes(searchQuery) || 
            (pc.currentUser && pc.currentUser.toLowerCase().includes(searchQuery))
        );
    }

    grid.innerHTML = '';

    if (pcs.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center text-muted py-5">ไม่พบข้อมูลเครื่องคอมพิวเตอร์</div>`;
        return;
    }

    pcs.forEach(pc => {
        let statusClass = '', iconClass = '', label = '', cardBorder = '';

        switch(pc.status) {
            case 'available': 
                statusClass = 'text-success'; cardBorder = 'border-success'; iconClass = 'bi-check-circle'; label = 'ว่าง (Available)'; break;
            case 'in_use': 
                statusClass = 'text-danger'; cardBorder = 'border-danger'; iconClass = 'bi-person-workspace'; label = 'ใช้งาน (In Use)'; break;
            case 'reserved': 
                statusClass = 'text-warning'; cardBorder = 'border-warning'; iconClass = 'bi-bookmark-fill'; label = 'จอง (Reserved)'; break;
            default: 
                statusClass = 'text-secondary'; cardBorder = 'border-secondary'; iconClass = 'bi-wrench-adjustable'; label = 'ชำรุด (Maintenance)';
        }

        const userDisplay = pc.currentUser ? 
            `<div class="mt-2 small text-dark fw-bold text-truncate" title="${pc.currentUser}"><i class="bi bi-person-fill"></i> ${pc.currentUser}</div>` : 
            `<div class="mt-2 small text-muted">-</div>`;

        // Active Booking Check
        let activeBooking = bookings.find(b => 
            String(b.pcId) === String(pc.id) && 
            b.date === todayStr && 
            b.status === 'approved' &&
            (pc.currentUser ? b.userName === pc.currentUser : true) // ถ้ามีคนนั่ง ต้องชื่อตรงกัน
        );

        let timeSlotInfo = '';
        if (activeBooking) {
            timeSlotInfo = `<div class="badge bg-warning text-dark mt-1 border"><i class="bi bi-calendar-check"></i> ${activeBooking.startTime} - ${activeBooking.endTime}</div>`;
        } else {
            timeSlotInfo = `<div class="mt-1" style="height: 21px;"></div>`; // Spacer
        }

        // Timer Badge (ถ้าใช้งานอยู่)
        let usageTimeBadge = '';
        if (pc.status === 'in_use' && pc.startTime) {
            const diffMs = Date.now() - pc.startTime;
            const diffMins = Math.floor(diffMs / 60000);
            const hrs = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            const timeTxt = hrs > 0 ? `${hrs}ชม. ${mins}น.` : `${mins} นาที`;
            const badgeColor = hrs >= 3 ? 'bg-danger' : 'bg-primary';
            usageTimeBadge = `<div class="badge ${badgeColor} mt-1 border"><i class="bi bi-stopwatch-fill"></i> ${timeTxt}</div>`;
        } else {
            usageTimeBadge = `<div class="mt-1" style="height: 21px;"></div>`; 
        }

        // Software Tags (Limit 2)
        let softwareHtml = '';
        if (Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
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

        // ⚡️ Card HTML
        grid.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm ${cardBorder} position-relative pc-card-hover" 
                     onclick="handlePcClick('${pc.id}')">
                    <div class="card-body text-center p-3">
                        ${pc.installedSoftware && pc.installedSoftware.some(s => s.includes('GPU')) ? 
                            '<div class="position-absolute top-0 end-0 p-2"><i class="bi bi-gpu-card text-primary" title="High Performance"></i></div>' : ''}
                        
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

// ==========================================
// 🖱️ Interaction Handlers
// ==========================================

function handlePcClick(pcId) {
    const pc = DB.getPCs().find(p => String(p.id) === String(pcId));
    if (!pc) return;

    if (pc.status === 'available') {
        openCheckInModal(pc);
    } else if (pc.status === 'in_use') {
        if(confirm(`⚠️ เครื่อง ${pc.name} กำลังใช้งานโดย ${pc.currentUser}\n\nต้องการ "บังคับ Check-out" (Force Logout) หรือไม่?`)) {
            performForceCheckout(pc.id);
        }
    } else if (pc.status === 'reserved') {
        if(confirm(`🟡 เครื่อง ${pc.name} ถูกจองโดย ${pc.currentUser}\n\nต้องการ "ยืนยันการเข้าใช้งาน" (Check-in) หรือไม่?`)) {
            // จองแล้ว -> เปลี่ยนเป็น In Use ได้เลย
            DB.updatePCStatus(pc.id, 'in_use', pc.currentUser);
            DB.saveLog({
                action: 'START_SESSION',
                userId: 'Booking', userName: pc.currentUser, pcId: pc.id,
                details: 'User arrived for booking'
            });
            renderMonitor();
        }
    } else {
        alert(`เครื่องนี้สถานะ ${pc.status} (แจ้งซ่อม) ไม่สามารถใช้งานได้`);
    }
}

function performForceCheckout(pcId) {
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));
    const currentUser = pc ? pc.currentUser : 'Unknown';
    
    // บันทึก Log ว่าแอดมินเตะออก (ไม่ใส่คะแนน เพื่อไม่ให้กราฟเพี้ยน)
    DB.saveLog({
        action: 'Force Check-out',
        pcId: pcId, 
        userName: currentUser, 
        userRole: 'System',
        details: 'Admin Forced Logout via Monitor',
        satisfactionScore: null // ✅ สำคัญ: ไม่ใส่คะแนนมั่ว
    });

    DB.updatePCStatus(pcId, 'available');
    renderMonitor();
}

// ==========================================
// 📝 Modal & Form Logic (เหมือนเดิม)
// ==========================================

function openCheckInModal(pc) {
    document.getElementById('checkInPcId').value = pc.id;
    document.getElementById('modalPcName').innerText = `Station: ${pc.name}`;
    
    const swContainer = document.getElementById('modalSoftwareTags');
    swContainer.innerHTML = '';
    if (pc.installedSoftware && pc.installedSoftware.length > 0) {
        pc.installedSoftware.forEach(sw => {
            swContainer.innerHTML += `<span class="badge bg-info text-dark me-1 border border-info bg-opacity-25">${sw}</span>`;
        });
    } else {
        swContainer.innerHTML = '<span class="text-muted small">- ไม่มีข้อมูล Software -</span>';
    }
    
    switchTab('internal'); // Reset form
    
    // Clear Inputs
    ['ubuUser', 'extIdCard', 'extName', 'extOrg'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('internalVerifyCard').classList.add('d-none');
    
    const btn = document.getElementById('btnConfirm');
    btn.disabled = true;
    btn.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
    btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>ยืนยัน Check-in';
    
    verifiedUserData = null;
    if(checkInModal) checkInModal.show();
}

function switchTab(tabName) {
    currentTab = tabName;
    const btnInt = document.getElementById('tab-internal');
    const btnExt = document.getElementById('tab-external');
    const formInt = document.getElementById('formInternal');
    const formExt = document.getElementById('formExternal');
    const btnConfirm = document.getElementById('btnConfirm');

    if (tabName === 'internal') {
        btnInt.classList.add('active', 'bg-primary', 'text-white'); btnInt.classList.remove('border');
        btnExt.classList.remove('active', 'bg-primary', 'text-white'); btnExt.classList.add('border');
        formInt.classList.remove('d-none'); formExt.classList.add('d-none');
        btnConfirm.disabled = !verifiedUserData;
        btnConfirm.className = verifiedUserData ? 'btn btn-success w-100 py-3 fw-bold shadow-sm' : 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
    } else {
        btnExt.classList.add('active', 'bg-primary', 'text-white'); btnExt.classList.remove('border');
        btnInt.classList.remove('active', 'bg-primary', 'text-white'); btnInt.classList.add('border');
        formExt.classList.remove('d-none'); formInt.classList.add('d-none');
        btnConfirm.disabled = false;
        btnConfirm.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
    }
}

function verifyUBUUser() {
    const userIdInput = document.getElementById('ubuUser');
    const userId = userIdInput.value.trim();
    if (!userId) { alert('กรุณากรอกรหัสนักศึกษา / บุคลากร'); userIdInput.focus(); return; }
    
    const user = DB.checkRegAPI(userId); // จำลอง API
    if (user) {
        verifiedUserData = { id: userId, name: user.prefix + user.name, faculty: user.faculty, role: user.role };
        document.getElementById('internalVerifyCard').classList.remove('d-none');
        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        
        const btn = document.getElementById('btnConfirm');
        btn.disabled = false;
        btn.className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
    } else {
        alert('❌ ไม่พบข้อมูลในระบบ (ลองใช้รหัส: 66123456)');
        verifiedUserData = null;
        document.getElementById('internalVerifyCard').classList.add('d-none');
        document.getElementById('btnConfirm').disabled = true;
    }
}

function confirmCheckIn() {
    const pcId = document.getElementById('checkInPcId').value;
    let finalName = "", userType = "", finalId = "", faculty = "";

    if (currentTab === 'internal') {
        if (!verifiedUserData) return;
        finalName = verifiedUserData.name; 
        userType = verifiedUserData.role; 
        finalId = verifiedUserData.id;
        faculty = verifiedUserData.faculty;
    } else {
        const extName = document.getElementById('extName').value.trim();
        const extOrg = document.getElementById('extOrg').value.trim();
        const extId = document.getElementById('extIdCard').value.trim();
        if (!extName) { alert('กรุณากรอกชื่อ-นามสกุล'); return; }
        
        finalName = extName + (extOrg ? ` (${extOrg})` : ''); 
        userType = 'Guest'; 
        finalId = extId || 'External';
        faculty = extOrg || 'บุคคลภายนอก';
    }

    DB.updatePCStatus(pcId, 'in_use', finalName);
    
    // บันทึก Log เริ่มใช้งาน
    DB.saveLog({
        action: 'START_SESSION',
        userId: finalId, 
        userName: finalName, 
        userRole: userType, 
        userFaculty: faculty,
        pcId: pcId,
        startTime: new Date().toISOString(), // บันทึกเวลาเริ่มจริงจัง
        details: 'Admin Manual Check-in'
    });

    if(checkInModal) checkInModal.hide();
    renderMonitor();
}

// ✅ ฟังก์ชันจัดการหน้าตาปุ่ม Filter
function updateFilterButtons(activeStatus) {
    const buttons = {
        'all': document.getElementById('btn-all'),
        'available': document.getElementById('btn-available'),
        'in_use': document.getElementById('btn-in_use'),
        'reserved': document.getElementById('btn-reserved')
    };

    // Reset ทุกปุ่มเป็น Outline
    Object.values(buttons).forEach(btn => {
        if(!btn) return;
        btn.className = "btn btn-sm rounded-pill px-3 me-1";
        // Reset Style ตามสีเดิม
        if(btn.id.includes('all')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#495057'; btn.style.border = '1px solid #ced4da'; }
        if(btn.id.includes('available')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#198754'; btn.style.border = '1px solid #198754'; }
        if(btn.id.includes('in_use')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#dc3545'; btn.style.border = '1px solid #dc3545'; }
        if(btn.id.includes('reserved')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#ffc107'; btn.style.border = '1px solid #ffc107'; }
    });

    // Set Active Button (Solid Color)
    const activeBtn = buttons[activeStatus];
    if(activeBtn) {
        activeBtn.style.color = 'white';
        if(activeStatus === 'all') { activeBtn.style.backgroundColor = '#495057'; activeBtn.style.borderColor = '#495057'; }
        if(activeStatus === 'available') { activeBtn.style.backgroundColor = '#198754'; activeBtn.style.borderColor = '#198754'; }
        if(activeStatus === 'in_use') { activeBtn.style.backgroundColor = '#dc3545'; activeBtn.style.borderColor = '#dc3545'; }
        if(activeStatus === 'reserved') { activeBtn.style.backgroundColor = '#ffc107'; activeBtn.style.borderColor = '#ffc107'; activeBtn.style.color = '#000'; } // สีดำสำหรับพื้นเหลือง
    }
}

// ✅ อัปเดตฟังก์ชัน filterPC เดิม ให้เรียกใช้ฟังก์ชันข้างบน
function filterPC(status) {
    currentFilter = status;
    updateFilterButtons(status); // <-- เพิ่มบรรทัดนี้
    renderMonitor();
}