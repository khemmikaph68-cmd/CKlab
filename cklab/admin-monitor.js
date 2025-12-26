/* admin-monitor.js (Final Full Version: Real-time, Queue, Smart Extend) */

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

    // 2. Start Logic
    if (typeof DB === 'undefined') {
        console.error("Error: DB is not loaded.");
        return;
    }

    renderMonitor();
    updateClock();
    checkAndSwitchBookingQueue(); // เช็คสถานะการจองทันที

    // 3. Real-time Sync (ข้ามแท็บ & อัปเดตทันที)
    window.addEventListener('storage', (e) => {
        if (e.key === 'ck_pcs' || e.key === 'ck_bookings' || e.key === 'ck_ai_slots') {
            console.log('🔄 Data changed. Recalculating status...');
            checkAndSwitchBookingQueue(); // คำนวณสถานะใหม่
            renderMonitor();              // วาดหน้าจอใหม่
        }
    });

    // 4. Auto Refresh Loop
    setInterval(() => {
        // อัปเดตหน้าจอเฉพาะตอนที่ไม่ได้เปิด Modal อยู่
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
// 🔄 Auto Booking Switcher (Logic เปลี่ยนสถานะ)
// ==========================================
function checkAndSwitchBookingQueue() {
    const pcs = DB.getPCs();
    const bookings = DB.getBookings();
    const todayStr = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let hasChanges = false;

    pcs.forEach(pc => {
        if (pc.status === 'in_use' || pc.status === 'maintenance') return;

        // หาการจองที่ Active ในเวลานี้ (เฉพาะ Approved)
        const activeBooking = bookings.find(b => {
            if (String(b.pcId) !== String(pc.id)) return false;
            if (b.date !== todayStr) return false;
            if (b.status !== 'approved') return false; 

            const [sh, sm] = b.startTime.split(':').map(Number);
            const [eh, em] = b.endTime.split(':').map(Number);
            const start = sh * 60 + sm;
            const end = eh * 60 + em;

            // Late > 15 mins -> No Show
            if (currentMinutes > (start + 15)) {
                DB.updateBookingStatus(b.id, 'no_show'); 
                hasChanges = true; 
                return false;
            }
            
            // Active Period: 15 mins before start -> End time
            return currentMinutes >= (start - 15) && currentMinutes < end;
        });

        if (activeBooking) {
            // ✅ เปลี่ยนเป็น Reserved ทันทีเมื่อถึงเวลา
            if (pc.status !== 'reserved' || pc.currentUser !== activeBooking.userName) {
                DB.updatePCStatus(pc.id, 'reserved', activeBooking.userName);
                hasChanges = true;
            }
        } else {
            // ❌ หมดเวลาจอง -> คืนสถานะ Available
            if (pc.status === 'reserved') {
                DB.updatePCStatus(pc.id, 'available');
                hasChanges = true;
            }
        }
    });

    if (hasChanges) renderMonitor();
}

// ==========================================
// 🖥️ Render Monitor Grid (แสดงผล)
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
    const todayStr = new Date().toISOString().split('T')[0]; 
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
        // --- 1. Status Styling ---
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

        // --- 2. Show AI / Software ---
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

let myBookings = bookings.filter(b => 
            String(b.pcId) === String(pc.id) && 
            b.date === todayStr && 
            ['approved', 'pending', 'completed', 'no_show'].includes(b.status)
        );
        myBookings.sort((a, b) => a.startTime.localeCompare(b.startTime));

        let queueHtml = '';
        
        if (myBookings.length > 0) {
            // Container: พื้นหลังโปร่งใส ขอบบนบางๆ
            queueHtml = `<div class="mt-3 pt-2 border-top text-start">`;
            
            // Header
            queueHtml += `<div class="d-flex justify-content-between align-items-center mb-2">
                <span class="text-secondary fw-bold" style="font-size: 0.65rem; letter-spacing: 0.5px; opacity: 0.8;">
                    <i class="bi bi-list-task me-1"></i>TIMELINE
                </span>
            </div>`;
            
            queueHtml += `<div class="d-flex flex-column gap-1">`;

            myBookings.forEach(b => {
                const [sh, sm] = b.startTime.split(':').map(Number);
                const [eh, em] = b.endTime.split(':').map(Number);
                const startMins = sh * 60 + sm;
                const endMins = eh * 60 + em;
                
                const isNow = (curTimeVal >= startMins && curTimeVal < endMins);
                const isPast = (curTimeVal >= endMins) || b.status === 'completed';
                const isNoShow = b.status === 'no_show';
                
                // --- 🎨 STYLE CONFIGURATION ---
                let rowClass = "rounded-2 px-2 py-1 d-flex justify-content-between align-items-center";
                let textStyle = "font-size: 0.75rem;";
                let statusIcon = "";
                let rowStyle = ""; // Custom inline style

                if (isNoShow) {
                    // No Show: สีเทาเข้ม + ไอคอนส้ม (ดูสุภาพกว่าแดง)
                    textStyle += " color: #6c757d;"; // เทาเข้ม
                    rowStyle = "background-color: #f8f9fa;"; // พื้นหลังเทาจางๆ
                    statusIcon = '<i class="bi bi-person-slash text-warning ms-1" style="font-size: 0.8em;" title="Missed"></i>';
                
                } else if (isPast) {
                    // Past: สีเทาจางๆ (ไม่ขีดฆ่า)
                    textStyle += " color: #adb5bd;"; // เทาอ่อน
                    statusIcon = '<i class="bi bi-check2 text-success opacity-25 ms-1" style="font-size: 0.9em;"></i>';
                
                } else if (isNow) {
                    // NOW: สีน้ำเงิน + พื้นหลังขาว + เงา (Pop out)
                    rowClass += " bg-white shadow-sm border-start border-3 border-primary";
                    textStyle += " color: #0d6efd; font-weight: bold;";
                    statusIcon = '<span class="spinner-grow spinner-grow-sm text-primary ms-1" style="width: 5px; height: 5px;" role="status"></span>';
                
                } else {
                    // Future: สีดำปกติ
                    textStyle += " color: #212529;";
                }

                // สร้าง HTML
                queueHtml += `
                <div class="${rowClass}" style="${rowStyle}">
                    <div class="d-flex align-items-center gap-2">
                        <span style="${textStyle} font-family: monospace;">${b.startTime}-${b.endTime}</span>
                        ${statusIcon}
                    </div>
                    <span class="text-truncate" style="${textStyle} max-width: 80px;" title="${b.userName}">
                        ${b.userName}
                    </span>
                </div>`;
            });
            queueHtml += `</div></div>`;
        } else {
            // Empty State
            queueHtml = `<div class="mt-3 pt-3 border-top text-center">
                <div class="text-muted opacity-25 small" style="height: 60px; display:flex; flex-direction:column; align-items:center; justify-content:center;">
                    <i class="bi bi-calendar-minus fs-5 mb-1"></i>
                    <span style="font-size: 0.7rem;">ว่างตลอดวัน</span>
                </div>
            </div>`;
        }

        // --- 4. Timer Badge ---
        let usageTimeBadge = '';
        if (pc.status === 'in_use' && pc.forceEndTime) {
            const h = Math.floor(pc.forceEndTime / 60).toString().padStart(2, '0');
            const m = (pc.forceEndTime % 60).toString().padStart(2, '0');
            usageTimeBadge = `<div class="badge bg-danger mb-1 shadow-sm"><i class="bi bi-stopwatch-fill"></i> หมดเวลา: ${h}:${m}</div>`;
        } else if (pc.status === 'in_use') {
            usageTimeBadge = `<div class="badge bg-primary mb-1 shadow-sm">Unlimited</div>`;
        } else {
            usageTimeBadge = `<div class="mb-1" style="height: 21px;"></div>`; 
        }

        // --- 5. Assemble HTML ---
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

            const slotEndTime = getSlotEndTime();
            DB.updatePCStatus(pc.id, 'in_use', pc.currentUser, { forceEndTime: slotEndTime });
            
            DB.saveLog({
                action: 'START_SESSION',
                userId: 'Booking', userName: pc.currentUser, pcId: pc.id,
                details: 'User arrived for booking',
                slotId: slotEndTime ? 'Auto-Slot' : null
            });
            renderMonitor();
        }
    } else {
        alert(`เครื่องนี้สถานะ ${pc.status} (แจ้งซ่อม) ไม่สามารถใช้งานได้`);
    }
}

// ==========================================
// 🛠️ Admin Management Tools (Smart Extend)
// ==========================================

function openManageActiveModal(pc) {
    document.getElementById('managePcId').value = pc.id;
    document.getElementById('managePcName').innerText = pc.name;
    document.getElementById('manageUserName').innerText = pc.currentUser || 'Unknown';
    
    let endTimeText = "ไม่กำหนด (Unlimited)";
    if (pc.forceEndTime) {
        const h = Math.floor(pc.forceEndTime / 60).toString().padStart(2, '0');
        const m = (pc.forceEndTime % 60).toString().padStart(2, '0');
        endTimeText = `${h}:${m}`;
    }
    document.getElementById('manageEndTime').innerText = endTimeText;

    const nextQueueInfo = getNextQueueInfo(pc.id, pc.forceEndTime);
    const btnExtend = document.getElementById('btnExtendAdmin');
    
    if (nextQueueInfo.hasQueue) {
        btnExtend.className = 'btn btn-warning w-100 fw-bold shadow-sm';
        btnExtend.innerHTML = `<i class="bi bi-exclamation-triangle-fill me-2"></i>มีคิวต่อ: ${nextQueueInfo.user} (${nextQueueInfo.time})`;
    } else {
        btnExtend.className = 'btn btn-success w-100 fw-bold shadow-sm';
        btnExtend.innerHTML = `<i class="bi bi-clock-history me-2"></i>ต่อเวลา (+1 Slot)`;
    }

    if(manageActiveModal) manageActiveModal.show();
}

function getNextQueueInfo(pcId, currentEndTimeInt) {
    if (!currentEndTimeInt) return { hasQueue: false };

    const bookings = DB.getBookings();
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    const nextBooking = bookings.find(b => {
        if (String(b.pcId) !== String(pcId)) return false;
        if (b.date !== todayStr) return false;
        if (!['approved', 'pending'].includes(b.status)) return false;

        const [sh, sm] = b.startTime.split(':').map(Number);
        const startInt = sh * 60 + sm;
        
        // ยอมรับ gap เล็กน้อย +/- 5 นาที
        return Math.abs(startInt - currentEndTimeInt) <= 5;
    });

    if (nextBooking) {
        return { hasQueue: true, user: nextBooking.userName, time: nextBooking.startTime };
    }
    return { hasQueue: false };
}

function extendSessionByAdmin() {
    const pcId = document.getElementById('managePcId').value;
    const pc = DB.getPCs().find(p => String(p.id) === String(pcId));
    if (!pc) return;

    const currentEndTime = pc.forceEndTime;
    if (!currentEndTime) {
        alert("⚠️ เครื่องนี้เป็น Unlimited ไม่สามารถต่อรอบเวลาได้");
        return;
    }

    const allSlots = DB.getAiTimeSlots ? DB.getAiTimeSlots() : [];
    const activeSlots = allSlots.filter(s => s.active);
    
    const endH = Math.floor(currentEndTime / 60).toString().padStart(2, '0');
    const endM = (currentEndTime % 60).toString().padStart(2, '0');
    const timeString = `${endH}:${endM}`;

    // หารอบถัดไป
    const nextSlot = activeSlots.find(s => s.start === timeString);

    if (!nextSlot) {
        alert("⛔ ไม่พบรอบให้บริการถัดไป (หรือจบวันแล้ว)");
        return;
    }

    const queueInfo = getNextQueueInfo(pcId, currentEndTime);
    if (queueInfo.hasQueue) {
        if(!confirm(`⚠️ คำเตือน: มีคิวจองรออยู่!\n\nผู้จอง: ${queueInfo.user}\nเวลา: ${queueInfo.time}\n\nยืนยันจะ "ลัดคิว" ให้ผู้ใช้เดิมต่อเวลาหรือไม่?`)) {
            return;
        }
    }

    const [nextEh, nextEm] = nextSlot.end.split(':').map(Number);
    const newForceEndTime = nextEh * 60 + nextEm;

    DB.updatePCStatus(pcId, 'in_use', pc.currentUser, { forceEndTime: newForceEndTime });
    
    DB.saveLog({
        action: 'EXTEND_SESSION',
        userId: 'Admin', userName: 'Administrator', pcId: pcId,
        details: `Admin Extended for ${pc.currentUser} to ${nextSlot.end}`
    });

    alert(`✅ ต่อเวลาสำเร็จ! หมดเวลาใหม่: ${nextSlot.end}`);
    if(manageActiveModal) manageActiveModal.hide();
    renderMonitor();
}

function confirmForceLogout() {
    const pcId = document.getElementById('managePcId').value;
    if(confirm('ยืนยันบังคับให้ออก (Force Logout)?')) {
        performForceCheckout(pcId);
        if(manageActiveModal) manageActiveModal.hide();
    }
}

function performForceCheckout(pcId) {
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));
    const currentUser = pc ? pc.currentUser : 'Unknown';
    
    DB.saveLog({
        action: 'Force Check-out',
        pcId: pcId, userName: currentUser, userRole: 'System',
        details: 'Admin Forced Logout via Monitor',
        satisfactionScore: null 
    });

    DB.updatePCStatus(pcId, 'available');
    renderMonitor();
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
        pc.installedSoftware.forEach(sw => {
            swContainer.innerHTML += `<span class="badge bg-info text-dark me-1 border border-info bg-opacity-25">${sw}</span>`;
        });
    } else {
        swContainer.innerHTML = '<span class="text-muted small">- ไม่มีข้อมูล Software -</span>';
    }
    
    switchTab('internal'); 
    ['ubuUser', 'extIdCard', 'extName', 'extOrg'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('internalVerifyCard').classList.add('d-none');
    
    const btn = document.getElementById('btnConfirm');
    btn.disabled = true;
    btn.className = 'btn btn-secondary w-100 py-3 fw-bold shadow-sm';
    btn.innerHTML = '<i class="bi bi-check-circle-fill me-2"></i>ยืนยัน Check-in';
    
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

function getSlotEndTime() {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const allSlots = (DB.getAiTimeSlots && typeof DB.getAiTimeSlots === 'function') ? DB.getAiTimeSlots() : [];
    const activeSlots = allSlots.filter(s => s.active);

    if (activeSlots.length > 0) {
        const activeSlot = activeSlots.find(s => {
            const [sh, sm] = s.start.split(':').map(Number);
            const [eh, em] = s.end.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;
            return cur >= (startMins - 15) && cur < endMins;
        });

        if (activeSlot) {
            const [eh, em] = activeSlot.end.split(':').map(Number);
            return eh * 60 + em; 
        }
    }
    return null;
}

function checkInAsAdmin(pcId) {
    if(!confirm("ยืนยันการเปิดใช้งานในนาม Admin?\n(ระบบจะนับสถิติเป็นครั้งใหม่)")) return;

    const adminName = "Admin Extension"; 
    const adminRole = "Staff/Admin";     
    const adminId = "ADMIN-EXT";         
    const slotEndTime = getSlotEndTime();

    DB.updatePCStatus(pcId, 'in_use', adminName, { forceEndTime: slotEndTime });
    
    DB.saveLog({
        action: 'START_SESSION',
        userId: adminId, userName: adminName, userRole: adminRole, 
        userFaculty: 'ศูนย์คอมพิวเตอร์', pcId: pcId,
        startTime: new Date().toISOString(), details: 'Admin Extended Session (Manual)',
        slotId: slotEndTime ? 'Auto-Slot' : null 
    });

    if(checkInModal) checkInModal.hide();
    renderMonitor();
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
    
    const user = DB.checkRegAPI(userId); 
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

    const bookings = DB.getBookings(); 
    const todayStr = new Date().toLocaleDateString('en-CA');
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const validBooking = bookings.find(b => 
        String(b.pcId) === String(pcId) &&
        b.date === todayStr &&
        b.status === 'approved' &&
        b.userName === finalName
    );

    let usageDetail = 'Walk-in User'; 

    if (validBooking) {
        const [startH, startM] = validBooking.startTime.split(':').map(Number);
        const bookingStartMins = startH * 60 + startM;

        if (currentMinutes < (bookingStartMins - 15)) {
            alert(`⚠️ ยังไม่ถึงเวลาจอง!\n\nคิวจองของคุณคือ ${validBooking.startTime} - ${validBooking.endTime}\nกรุณารอสักครู่ หรือเข้าใช้งานแบบ Walk-in (หากเครื่องว่าง)`);
        } else {
            usageDetail = 'Check-in from Booking';
            DB.updateBookingStatus(validBooking.id, 'completed');
        }
    }

    const slotEndTime = getSlotEndTime();

    DB.updatePCStatus(pcId, 'in_use', finalName, { forceEndTime: slotEndTime });
    
    DB.saveLog({
        action: 'START_SESSION',
        userId: finalId, userName: finalName, userRole: userType, userFaculty: faculty,
        pcId: pcId, startTime: new Date().toISOString(), details: usageDetail,
        slotId: slotEndTime ? 'Auto-Slot' : null
    });

    if(checkInModal) checkInModal.hide();
    renderMonitor();
}

function updateFilterButtons(activeStatus) {
    const buttons = {
        'all': document.getElementById('btn-all'),
        'available': document.getElementById('btn-available'),
        'in_use': document.getElementById('btn-in_use'),
        'reserved': document.getElementById('btn-reserved')
    };

    Object.values(buttons).forEach(btn => {
        if(!btn) return;
        btn.className = "btn btn-sm rounded-pill px-3 me-1";
        if(btn.id.includes('all')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#495057'; btn.style.border = '1px solid #ced4da'; }
        if(btn.id.includes('available')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#198754'; btn.style.border = '1px solid #198754'; }
        if(btn.id.includes('in_use')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#dc3545'; btn.style.border = '1px solid #dc3545'; }
        if(btn.id.includes('reserved')) { btn.style.backgroundColor = 'transparent'; btn.style.color = '#ffc107'; btn.style.border = '1px solid #ffc107'; }
    });

    const activeBtn = buttons[activeStatus];
    if(activeBtn) {
        activeBtn.style.color = 'white';
        if(activeStatus === 'all') { activeBtn.style.backgroundColor = '#495057'; activeBtn.style.borderColor = '#495057'; }
        if(activeStatus === 'available') { activeBtn.style.backgroundColor = '#198754'; activeBtn.style.borderColor = '#198754'; }
        if(activeStatus === 'in_use') { activeBtn.style.backgroundColor = '#dc3545'; activeBtn.style.borderColor = '#dc3545'; }
        if(activeStatus === 'reserved') { activeBtn.style.backgroundColor = '#ffc107'; activeBtn.style.borderColor = '#ffc107'; activeBtn.style.color = '#000'; } 
    }
}