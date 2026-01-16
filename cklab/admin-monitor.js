/* admin-monitor.js (Final: Date Picker Support + AI Timeline Display) */

let checkInModal, manageActiveModal;
let currentTab = 'internal';
let verifiedUserData = null;
let currentFilter = 'all'; 
let searchQuery = '';      

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Modals
    const modalEl = document.getElementById('checkInModal');
    if (modalEl) checkInModal = new bootstrap.Modal(modalEl);
    
    const manageEl = document.getElementById('manageActiveModal');
    if (manageEl) manageActiveModal = new bootstrap.Modal(manageEl);

    // 2. Init Date Picker (Set to Today)
    const dateInput = document.getElementById('monitorDate');
    if (dateInput) {
        dateInput.valueAsDate = new Date();
        // เมื่อเปลี่ยนวันที่ ให้รีเฟรชหน้าจอทันที
        dateInput.addEventListener('change', renderMonitor);
    }

    // 3. Start Logic
    if (typeof DB === 'undefined') {
        console.error("Error: DB is not loaded.");
        return;
    }

    renderMonitor();
    updateClock();
    checkAndSwitchBookingQueue(); 

    // 4. Real-time Sync
    window.addEventListener('storage', (e) => {
        if (e.key === 'ck_pcs' || e.key === 'ck_bookings') {
            checkAndSwitchBookingQueue();
            renderMonitor();
        }
    });

    // 5. Auto Refresh
    setInterval(() => {
        const isModalOpen = (modalEl && modalEl.classList.contains('show')) || (manageEl && manageEl.classList.contains('show'));
        if (!isModalOpen) renderMonitor();
    }, 3000); 
    
    setInterval(updateClock, 1000);
    setInterval(checkAndSwitchBookingQueue, 60000); 
});

function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clockDisplay');
    if(clockEl) clockEl.innerText = now.toLocaleTimeString('th-TH');
}

// ==========================================
// 🖥️ Render Monitor Grid (UI)
// ==========================================

function filterPC(status) {
    currentFilter = status;
    updateFilterButtons(status);
    renderMonitor();
}

function searchPC() {
    const input = document.getElementById('searchPC');
    if (input) {
        searchQuery = input.value.trim().toLowerCase();
        renderMonitor();
    }
}

function updateMonitorStats(allPcs) {
    const counts = { available: 0, in_use: 0, reserved: 0, maintenance: 0 };
    allPcs.forEach(pc => {
        if (counts.hasOwnProperty(pc.status)) counts[pc.status]++;
        else counts.maintenance++;
    });

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if(el) {
            el.innerText = val;
            el.style.transition = 'transform 0.2s';
            el.style.transform = 'scale(1.2)';
            setTimeout(() => el.style.transform = 'scale(1)', 200);
        }
    };
    setVal('count-available', counts.available);
    setVal('count-in_use', counts.in_use);
    setVal('count-reserved', counts.reserved);
    setVal('count-maintenance', counts.maintenance);
}

function renderMonitor() {
    const grid = document.getElementById('monitorGrid');
    if(!grid) return;

    const allPcs = DB.getPCs();
    updateMonitorStats(allPcs);

    const bookings = DB.getBookings();
    
    // ✅ ดึงวันที่จาก Date Picker (ถ้าไม่มีให้ใช้วันปัจจุบัน)
    const dateInput = document.getElementById('monitorDate');
    const selectedDateStr = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
    
    const now = new Date();
    const curTimeVal = now.getHours() * 60 + now.getMinutes();

    let displayPcs = allPcs;
    if (currentFilter !== 'all') {
        displayPcs = displayPcs.filter(pc => pc.status === currentFilter);
    }
    if (searchQuery) {
        displayPcs = displayPcs.filter(pc => 
            pc.name.toLowerCase().includes(searchQuery) || 
            (pc.currentUser && pc.currentUser.toLowerCase().includes(searchQuery))
        );
    }

    grid.innerHTML = '';

    if (displayPcs.length === 0) {
        grid.innerHTML = `<div class="col-12 text-center text-muted py-5">ไม่พบข้อมูล</div>`;
        return;
    }

    displayPcs.forEach(pc => {
        let statusClass = '', iconClass = '', label = '', cardBorder = '';
        switch(pc.status) {
            case 'available': statusClass = 'text-success'; cardBorder = 'border-success'; iconClass = 'bi-check-circle'; label = 'ว่าง'; break;
            case 'in_use': statusClass = 'text-danger'; cardBorder = 'border-danger'; iconClass = 'bi-person-workspace'; label = 'ใช้งานอยู่'; break;
            case 'reserved': statusClass = 'text-warning'; cardBorder = 'border-warning'; iconClass = 'bi-bookmark-fill'; label = 'จองแล้ว'; break;
            default: statusClass = 'text-secondary'; cardBorder = 'border-secondary'; iconClass = 'bi-wrench-adjustable'; label = 'แจ้งซ่อม';
        }

        const userDisplay = pc.currentUser ? 
            `<div class="mt-1 fw-bold text-dark text-truncate" title="${pc.currentUser}"><i class="bi bi-person-fill"></i> ${pc.currentUser}</div>` : 
            `<div class="mt-1 text-muted">-</div>`;

        // -- Software Badges (บนการ์ด) --
        let softwareHtml = '';
        if (Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
            softwareHtml = '<div class="mt-2 d-flex flex-wrap justify-content-center gap-1">';
            const showCount = 2; 
            pc.installedSoftware.slice(0, showCount).forEach(sw => {
                const shortName = sw.split('(')[0].trim();
                softwareHtml += `<span class="badge bg-light text-secondary border" style="font-size: 0.65rem;">${shortName}</span>`;
            });
            if (pc.installedSoftware.length > showCount) {
                softwareHtml += `<span class="badge bg-light text-secondary border" style="font-size: 0.65rem;">+${pc.installedSoftware.length - showCount}</span>`;
            }
            softwareHtml += '</div>';
        } else {
            softwareHtml = '<div class="mt-2" style="height: 22px;"></div>';
        }

        // --- Booking Queue / Timeline (อ้างอิงตามวันที่เลือก) ---
        let myBookings = bookings.filter(b => 
            String(b.pcId) === String(pc.id) && 
            b.date === selectedDateStr && // ✅ กรองตามวันที่เลือก
            ['approved', 'pending', 'completed', 'no_show'].includes(b.status)
        );
        myBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let queueHtml = '';
        
        if (myBookings.length > 0) {
            queueHtml = `<div class="mt-3 pt-2 border-top text-start">`;
            
            // ปรับหัวข้อ Timeline ตามวันที่เลือก
            const isTodayView = (selectedDateStr === new Date().toISOString().split('T')[0]);
            const headerText = isTodayView ? 'TIMELINE (วันนี้)' : `TIMELINE (${formatDateShort(selectedDateStr)})`;

            queueHtml += `<div class="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom border-secondary-subtle">
                <small class="fw-bold text-secondary" style="font-size: 0.65rem; letter-spacing: 0.5px;">
                    <i class="bi bi-calendar-week me-1"></i>${headerText}
                </small>
            </div>`;
            
            queueHtml += `<div class="d-flex flex-column gap-1">`;

            myBookings.forEach(b => {
                const [sh, sm] = b.startTime.split(':').map(Number);
                const [eh, em] = b.endTime.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const endMins = eh * 60 + em;
                
                const isNow = isTodayView && (curTimeVal >= startMins && curTimeVal < endMins);
                const isPast = isTodayView && ((curTimeVal >= endMins) || b.status === 'completed');
                const isNoShow = b.status === 'no_show';
                
                let rowClass = "rounded-2 px-2 py-1 d-flex justify-content-between align-items-center";
                let textStyle = "font-size: 0.75rem; color: #495057;";
                let statusBadge = "";
                let rowStyle = ""; 

                // ✅ เพิ่ม Icon สำหรับ AI / Software Booking
                let typeIcon = "";
                if (b.softwareList && b.softwareList.length > 0) {
                    typeIcon = `<i class="bi bi-robot text-primary ms-1" style="font-size: 0.8em;" title="Software: ${b.softwareList.join(', ')}"></i>`;
                } else if (b.type === 'AI') {
                    typeIcon = `<i class="bi bi-cpu text-primary ms-1" style="font-size: 0.8em;" title="AI Workstation"></i>`;
                }

                if (isNoShow) {
                    textStyle = "font-size: 0.75rem; color: #6c757d;";
                    rowStyle = "background-color: #f8f9fa;";
                    statusBadge = '<i class="bi bi-person-slash text-warning ms-1" style="font-size: 0.8em;" title="Missed"></i>';
                } else if (isPast) {
                    textStyle = "font-size: 0.75rem; color: #adb5bd;";
                    statusBadge = '<i class="bi bi-check2 text-success opacity-25 ms-1" style="font-size: 0.9em;"></i>';
                } else if (isNow) {
                    rowClass += " bg-white shadow-sm border-start border-3 border-primary";
                    textStyle = "font-size: 0.75rem; color: #0d6efd; font-weight: bold;";
                    statusBadge = '<div class="spinner-grow text-primary" style="width: 6px; height: 6px;" role="status"></div>';
                }

                queueHtml += `
                <div class="${rowClass}" style="${rowStyle}">
                    <div class="d-flex align-items-center gap-2">
                        <span style="${textStyle} font-family: monospace;">${b.startTime}-${b.endTime}</span>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="text-truncate" style="${textStyle} max-width: 80px;" title="${b.userName}">${b.userName}</span>
                        ${typeIcon}
                        ${statusBadge}
                    </div>
                </div>`;
            });
            queueHtml += `</div></div>`;
        } else {
            queueHtml = `<div class="mt-3 text-center opacity-25">
                <div style="height: 60px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <i class="bi bi-calendar-x" style="font-size: 1.5rem;"></i>
                    <span style="font-size: 0.7rem;">ว่างตลอดวัน</span>
                </div>
            </div>`;
        }

        // --- Time Badge (Unlimited) ---
        let usageTimeBadge = '';
        if (pc.status === 'in_use') {
            usageTimeBadge = `<div class="badge bg-primary mb-1 shadow-sm">Unlimited</div>`;
        } else {
            usageTimeBadge = `<div class="mb-1" style="height: 21px;"></div>`; 
        }

        grid.innerHTML += `
            <div class="col-6 col-md-4 col-lg-3">
                <div class="card h-100 shadow-sm ${cardBorder} position-relative pc-card-hover" 
                      onclick="handlePcClick('${pc.id}')">
                    <div class="card-body text-center p-3 d-flex flex-column">
                        ${pc.installedSoftware && pc.installedSoftware.some(s => s.includes('GPU')) ? 
                            '<div class="position-absolute top-0 end-0 p-2"><i class="bi bi-gpu-card text-primary" title="High Performance"></i></div>' : ''}
                        
                        <i class="bi ${iconClass} display-6 ${statusClass} mb-2"></i>
                        <h5 class="fw-bold mb-0 text-dark">${pc.name}</h5>
                        <div class="badge bg-light text-dark border mb-1 align-self-center">${label}</div>
                        
                        ${usageTimeBadge}
                        ${userDisplay}
                        ${softwareHtml}
                        
                        <div class="mt-auto w-100">
                            ${queueHtml}
                        </div>
                    </div>
                </div>
            </div>`;
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
        openManageActiveModal(pc);
    } else if (pc.status === 'reserved') {
        if(confirm(`🟡 เครื่อง ${pc.name} จองโดย ${pc.currentUser}\n\nต้องการ "ยืนยันการเข้าใช้งาน" (Check-in) หรือไม่?`)) {
            const bookings = DB.getBookings();
            const todayStr = new Date().toLocaleDateString('en-CA');
            const validBooking = bookings.find(b => 
                String(b.pcId) === String(pc.id) && b.date === todayStr && b.status === 'approved' && b.userName === pc.currentUser
            );

            if(validBooking) {
                DB.updateBookingStatus(validBooking.id, 'completed');
            }

            // Unlimited Check-in for Reservation
            DB.updatePCStatus(pc.id, 'in_use', pc.currentUser, { forceEndTime: null });
            
            DB.saveLog({
                action: 'START_SESSION',
                userId: 'Booking', userName: pc.currentUser, pcId: pc.id,
                details: 'User arrived for booking',
                slotId: 'Unlimited'
            });
            renderMonitor();
        }
    } else {
        alert(`เครื่องนี้สถานะ ${pc.status} (แจ้งซ่อม) ไม่สามารถใช้งานได้`);
    }
}

// ==========================================
// 🛠️ Admin Force Check-out
// ==========================================

function openManageActiveModal(pc) {
    document.getElementById('managePcId').value = pc.id;
    document.getElementById('managePcName').innerText = pc.name;
    document.getElementById('manageUserName').innerText = pc.currentUser || 'Unknown';
    if(manageActiveModal) manageActiveModal.show();
}

function confirmForceLogout() {
    const pcId = document.getElementById('managePcId').value;
    if (!pcId) { alert("Error: ไม่พบ ID ของเครื่อง"); return; }

    if(confirm('ยืนยันสั่งเช็คเอ้าท์ (Check-out) ผู้ใช้งานรายนี้?')) {
        performForceCheckout(pcId);
        if(manageActiveModal) manageActiveModal.hide();
    }
}

function performForceCheckout(pcId) {
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));
    const currentUser = pc ? pc.currentUser : 'Unknown';

    // 1. ค้นหา Log การเริ่มใช้งานล่าสุด
    const logs = DB.getLogs();
    let startLog = null;
    
    for (let i = logs.length - 1; i >= 0; i--) {
        if (String(logs[i].pcId) === String(pcId) && logs[i].action === 'START_SESSION') {
            if (logs[i].userName === currentUser) {
                startLog = logs[i];
                break;
            }
        }
    }

    // 2. ดึงข้อมูล User
    const userId = startLog ? startLog.userId : 'Unknown';
    const userName = startLog ? startLog.userName : currentUser;
    const userRole = startLog ? startLog.userRole : 'guest';
    const userFaculty = startLog ? startLog.userFaculty : '-';
    const userLevel = startLog ? startLog.userLevel : '-'; 
    const userYear = startLog ? startLog.userYear : '-';   

    // 3. ดึง Software
    const installedApps = pc && pc.installedSoftware ? pc.installedSoftware : [];
    const isAIUsed = installedApps.some(s => s.toLowerCase().includes('ai') || s.toLowerCase().includes('gpt'));

    // 4. คำนวณเวลา
    const startTime = pc && pc.startTime ? new Date(pc.startTime) : new Date();
    const endTime = new Date();
    const durationMinutes = Math.floor((endTime - startTime) / 60000);

    // 5. บันทึก Log
    DB.saveLog({
        action: 'END_SESSION',   
        userId: userId,          
        userName: userName,   
        userRole: userRole,      
        userFaculty: userFaculty, 
        userLevel: userLevel,     
        userYear: userYear,       
        pcId: pcId,
        startTime: startTime.toISOString(),
        timestamp: endTime.toISOString(),
        durationMinutes: durationMinutes > 0 ? durationMinutes : 0,
        usedSoftware: installedApps,
        isAIUsed: isAIUsed,
        details: 'Admin Forced Logout', 
        satisfactionScore: 5,        
        comment: 'Auto-rated by System (Admin Action)' 
    });

    DB.updatePCStatus(pcId, 'available', null);
    renderMonitor();
}

// ==========================================
// 📝 Auto Booking Switcher (Real-time Clock Only)
// ==========================================
function checkAndSwitchBookingQueue() {
    const pcs = DB.getPCs();
    const bookings = DB.getBookings();
    const todayStr = new Date().toLocaleDateString('en-CA'); // Always check TODAY
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let hasChanges = false;

    pcs.forEach(pc => {
        if (pc.status === 'in_use' || pc.status === 'maintenance') return;

        const activeBooking = bookings.find(b => {
            if (String(b.pcId) !== String(pc.id)) return false;
            if (b.date !== todayStr) return false;
            if (b.status !== 'approved') return false; 

            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            const start = sh * 60 + sm;
            const end = eh * 60 + em;

            if (currentMinutes > (start + 15)) {
                DB.updateBookingStatus(b.id, 'no_show'); 
                hasChanges = true; 
                return false;
            }
            return currentMinutes >= (start - 15) && currentMinutes < end;
        });

        if (activeBooking) {
            if (pc.status !== 'reserved' || pc.currentUser !== activeBooking.userName) {
                DB.updatePCStatus(pc.id, 'reserved', activeBooking.userName);
                hasChanges = true;
            }
        } else {
            if (pc.status === 'reserved') {
                DB.updatePCStatus(pc.id, 'available');
                hasChanges = true;
            }
        }
    });

    if (hasChanges) renderMonitor();
}

// ==========================================
// 📝 Check-in Logic
// ==========================================

function openCheckInModal(pc) {
    document.getElementById('checkInPcId').value = pc.id;
    document.getElementById('modalPcName').innerText = `Station: ${pc.name}`;
    const swContainer = document.getElementById('modalSoftwareTags');
    swContainer.innerHTML = '';
    if (pc.installedSoftware && pc.installedSoftware.length > 0) {
        pc.installedSoftware.forEach(sw => swContainer.innerHTML += `<span class="badge bg-info text-dark me-1 border border-info bg-opacity-25">${sw}</span>`);
    } else { swContainer.innerHTML = '<span class="text-muted small">- ไม่มีข้อมูล Software -</span>'; }
    
    switchTab('internal'); 
    ['ubuUser', 'extIdCard', 'extName', 'extOrg'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('internalVerifyCard').classList.add('d-none');
    document.getElementById('btnConfirm').disabled = true;
    verifiedUserData = null;

    const modalFooter = document.querySelector('#checkInModal .modal-footer');
    if (modalFooter && !document.getElementById('btnAdminExtend')) {
        const adminBtn = document.createElement('button');
        adminBtn.id = 'btnAdminExtend';
        adminBtn.className = 'btn btn-warning me-auto fw-bold text-dark'; 
        adminBtn.innerHTML = '<i class="bi bi-shield-lock-fill"></i> Admin ใช้ต่อ / Maintenance';
        adminBtn.onclick = () => checkInAsAdmin(pc.id);
        modalFooter.prepend(adminBtn);
    }
    if(checkInModal) checkInModal.show();
}

function checkInAsAdmin(pcId) {
    if(!confirm("ยืนยันการเปิดใช้งานในนาม Admin?\n(ระบบจะนับสถิติเป็นครั้งใหม่)")) return;
    
    const adminName = "Admin Extension"; 
    const adminRole = "Staff/Admin"; 
    const adminId = "ADMIN-EXT";         
    
    DB.updatePCStatus(pcId, 'in_use', adminName, { forceEndTime: null });
    
    DB.saveLog({ 
        action: 'START_SESSION', 
        userId: adminId, 
        userName: adminName, 
        userRole: adminRole, 
        userFaculty: 'ศูนย์คอมพิวเตอร์', 
        userLevel: 'Staff', 
        userYear: '-', 
        pcId: pcId, 
        startTime: new Date().toISOString(), 
        details: 'Admin Extended Session (Manual)', 
        slotId: 'Unlimited' 
    });

    if(checkInModal) checkInModal.hide();
    renderMonitor();
}

function switchTab(tabName) {
    currentTab = tabName;
    const btnInt = document.getElementById('tab-internal'); const btnExt = document.getElementById('tab-external');
    const formInt = document.getElementById('formInternal'); const formExt = document.getElementById('formExternal');
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
    if (!userId) { alert('กรุณากรอกรหัสนักศึกษา'); return; }
    
    const user = DB.checkRegAPI(userId); 
    if (user) {
        verifiedUserData = { 
            id: userId, 
            name: user.prefix + user.name, 
            faculty: user.faculty, 
            role: user.role,
            level: user.level, 
            year: user.year    
        };
        document.getElementById('internalVerifyCard').classList.remove('d-none');
        document.getElementById('showName').innerText = verifiedUserData.name;
        document.getElementById('showFaculty').innerText = verifiedUserData.faculty;
        document.getElementById('btnConfirm').disabled = false;
        document.getElementById('btnConfirm').className = 'btn btn-success w-100 py-3 fw-bold shadow-sm';
    } else {
        alert('❌ ไม่พบข้อมูลในระบบ');
        verifiedUserData = null;
    }
}

function confirmCheckIn() {
    const pcId = document.getElementById('checkInPcId').value;
    let finalName = "", userType = "", finalId = "", faculty = "";
    let finalLevel = "-", finalYear = "-"; 

    if (currentTab === 'internal') {
        if (!verifiedUserData) return;
        finalName = verifiedUserData.name; 
        userType = verifiedUserData.role; 
        finalId = verifiedUserData.id;
        faculty = verifiedUserData.faculty;
        finalLevel = verifiedUserData.level; 
        finalYear = verifiedUserData.year;   
    } else {
        const extName = document.getElementById('extName').value.trim();
        if (!extName) { alert('กรุณากรอกชื่อ'); return; }
        finalName = extName; 
        userType = 'Guest'; 
        finalId = 'External';
        faculty = 'บุคคลภายนอก';
        finalLevel = 'บุคคลทั่วไป';
        finalYear = '-';
    }

    DB.updatePCStatus(pcId, 'in_use', finalName, { forceEndTime: null });
    
    DB.saveLog({ 
        action: 'START_SESSION', 
        userId: finalId, 
        userName: finalName, 
        userRole: userType, 
        userFaculty: faculty, 
        userLevel: finalLevel, 
        userYear: finalYear,   
        pcId: pcId, 
        startTime: new Date().toISOString(), 
        details: 'Walk-in User (Admin)', 
        slotId: 'Unlimited' 
    });

    if(checkInModal) checkInModal.hide();
    renderMonitor();
}

function updateFilterButtons(activeStatus) {
    const buttons = ['all', 'available', 'in_use', 'reserved'];
    buttons.forEach(status => {
        const btn = document.getElementById(`btn-${status}`);
        if(btn) {
            btn.className = "btn btn-sm rounded-pill px-3 me-1";
            btn.style.color = status === activeStatus ? 'white' : '';
            if(status === 'all') { btn.style.backgroundColor = status === activeStatus ? '#495057' : 'transparent'; btn.style.border = '1px solid #ced4da'; }
            if(status === 'available') { btn.style.backgroundColor = status === activeStatus ? '#198754' : 'transparent'; btn.style.border = '1px solid #198754'; }
            if(status === 'in_use') { btn.style.backgroundColor = status === activeStatus ? '#dc3545' : 'transparent'; btn.style.border = '1px solid #dc3545'; }
            if(status === 'reserved') { btn.style.backgroundColor = status === activeStatus ? '#ffc107' : 'transparent'; btn.style.border = '1px solid #ffc107'; if(status===activeStatus) btn.style.color='black'; }
        }
    });
}

function formatDateShort(dateStr) {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;
}