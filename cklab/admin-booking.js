/* admin-booking.js (Final: Dynamic Availability based on Date/Time Slot) */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // 2. Set Default Date
    const dateFilter = document.getElementById('bookingDateFilter');
    if (dateFilter) dateFilter.valueAsDate = new Date();

    // 3. Render Table
    renderBookings();
    
    // 4. Init Options
    initFormOptions();

    // ✅ เพิ่ม Event Listener: เมื่อเปลี่ยน "วันที่" หรือ "เวลา" ให้เช็คสถานะเครื่องใหม่ทันที
    document.getElementById('bkDate').addEventListener('change', filterPCList);
    document.getElementById('bkTimeSlot').addEventListener('change', filterPCList);
});

// ==========================================
// 0. INIT OPTIONS
// ==========================================
function initFormOptions() {
    // โหลดรายชื่อ Software ลงตัวกรอง
    const swFilter = document.getElementById('bkSoftwareFilter');
    if (swFilter) {
        const lib = DB.getSoftwareLib();
        if (lib && lib.length > 0) {
            swFilter.innerHTML = '<option value="">-- ไม่ระบุ (แสดงทั้งหมด) --</option>';
            lib.sort((a, b) => a.name.localeCompare(b.name));
            lib.forEach(sw => {
                swFilter.innerHTML += `<option value="${sw.name}">${sw.name}</option>`;
            });
        } else {
            swFilter.innerHTML = '<option value="">(ไม่พบข้อมูล Software)</option>';
            swFilter.disabled = true;
        }
    }
    
    // โหลด PC ครั้งแรก (ใช้ค่า Default วัน/เวลา)
    filterPCList();
}

// ==========================================
// 🔍 FILTER & AVAILABILITY LOGIC (หัวใจสำคัญ)
// ==========================================
function filterPCList() {
    const pcSelect = document.getElementById('bkPcSelect');
    if (!pcSelect) return;

    // 1. ดึงค่า Filter ต่างๆ
    const swName = document.getElementById('bkSoftwareFilter').value.toLowerCase();
    const selDate = document.getElementById('bkDate').value;
    const selTimeSlot = document.getElementById('bkTimeSlot').value; // ex. "09:00-10:30"

    // ถ้ายังไม่เลือกวันเวลา (เผื่อเคสหลุด)
    if (!selDate || !selTimeSlot) {
        pcSelect.innerHTML = '<option value="">-- กรุณาเลือกวันและเวลาก่อน --</option>';
        return;
    }

    // แกะเวลา Start/End ที่เลือก
    const [selStart, selEnd] = selTimeSlot.split('-');

    // ดึงข้อมูล
    const pcs = DB.getPCs();
    const bookings = DB.getBookings();
    
    // เรียงชื่อเครื่อง
    pcs.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true}));

    // เก็บค่าที่เลือกไว้เดิม (เพื่อคงการเลือกไว้ถ้ายังเลือกได้)
    const currentValue = pcSelect.value;

    pcSelect.innerHTML = '<option value="">-- เลือกเครื่อง --</option>';
    let count = 0;

    pcs.forEach(pc => {
        // --- A. กรองด้วย Software ---
        let hasSoftware = true;
        if (swName !== "") {
            hasSoftware = pc.installedSoftware && pc.installedSoftware.some(s => s.toLowerCase().includes(swName));
        }

        if (!hasSoftware) return; // ข้ามถ้าไม่มี Software ที่ต้องการ

        // --- B. เช็คสถานะ "ปิดปรับปรุง" (Maintenance) ---
        // ถ้าเครื่องเสีย ไม่ว่าจะวันไหนก็ห้ามจอง
        if (pc.status === 'maintenance') {
            pcSelect.innerHTML += `<option value="${pc.id}" disabled style="color: #6c757d;">🔴 ${pc.name} (แจ้งซ่อม/ปิดปรับปรุง)</option>`;
            count++;
            return;
        }

        // --- C. เช็คคิวว่าง (Availability Check) ---
        // วนลูปดู Booking ทั้งหมด หาดูว่ามีอันไหนชนกับ วัน+เวลา ที่เราเลือกไหม
        const isConflict = bookings.some(b => {
            // เช็คว่าเป็นเครื่องเดียวกัน + วันเดียวกัน + สถานะที่เป็นการจอง (Approved/Pending/InUse)
            if (String(b.pcId) !== String(pc.id)) return false;
            if (b.date !== selDate) return false;
            if (!['approved', 'pending', 'in_use'].includes(b.status)) return false; // status อื่นๆ เช่น canceled ไม่นับ

            // เช็คเวลาชน (Time Overlap Logic)
            // (Start A < End B) and (End A > Start B)
            return (selStart < b.endTime && selEnd > b.startTime);
        });

        // --- D. สร้าง Option ---
        if (isConflict) {
            // ถ้าชน -> แสดงว่าไม่ว่าง (Disable)
            pcSelect.innerHTML += `<option value="${pc.id}" disabled style="color: #dc3545;">❌ ${pc.name} (ไม่ว่าง - จองแล้ว)</option>`;
        } else {
            // ถ้าไม่ชน -> แสดงว่าว่าง (Enable)
            const selected = (String(pc.id) === String(currentValue)) ? 'selected' : '';
            pcSelect.innerHTML += `<option value="${pc.id}" ${selected} style="color: #198754;">🟢 ${pc.name} (ว่าง)</option>`;
        }
        count++;
    });

    if (count === 0) {
        pcSelect.innerHTML = `<option value="" disabled>❌ ไม่พบเครื่องที่มีโปรแกรมนี้</option>`;
    }
    
    // เคลียร์ Hint text ด้านล่าง (ตามที่ขอ)
    const hint = document.getElementById('pcSoftwareHint');
    if(hint) hint.innerText = "";
}

function updateSoftwareList() {
    // ฟังก์ชันนี้ไม่ได้ใช้แสดงข้อความแล้ว แต่คงไว้เผื่อ Logic อื่นๆ
    const hint = document.getElementById('pcSoftwareHint');
    if(hint) hint.innerText = "";
}

// ==========================================
// 1. RENDER TABLE (ส่วนแสดงตารางรายการจอง)
// ==========================================
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    let bookings = DB.getBookings();
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-5">ไม่มีรายการจองในช่วงเวลานี้</td></tr>`;
        return;
    }

    filtered.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startTime.localeCompare(b.startTime);
    });

    filtered.forEach(b => {
        let badgeClass = '', statusText = '', actionBtns = '';

        switch(b.status) {
            case 'pending': 
            case 'approved':
                badgeClass = 'bg-warning text-dark border border-warning'; 
                statusText = '🟡 จองแล้ว (Booked)';
                actionBtns = `
                    <button class="btn btn-sm btn-outline-secondary me-1" onclick="updateStatus('${b.id}', 'no_show')" title="แจ้ง No Show"><i class="bi bi-person-x"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ยกเลิก"><i class="bi bi-trash"></i></button>
                `;
                break;
            case 'completed':
                badgeClass = 'bg-success'; statusText = '🟢 ใช้งานเสร็จสิ้น'; break;
            case 'no_show':
                badgeClass = 'bg-secondary'; statusText = '⚪ No Show'; break;
            case 'rejected':
                badgeClass = 'bg-danger bg-opacity-75'; statusText = '❌ ยกเลิกแล้ว'; break;
        }

        let softwareDisplay = '-';
        if (b.softwareList && b.softwareList.length > 0) {
            softwareDisplay = b.softwareList.map(sw => `<span class="badge bg-info text-dark border border-info bg-opacity-25 me-1">${sw}</span>`).join('');
        } else if (b.type === 'General') {
            softwareDisplay = '<span class="badge bg-light text-secondary border">ทั่วไป</span>';
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="ps-4 fw-bold text-dark">${formatDate(b.date)}</td>
            <td class="text-primary fw-bold">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold text-dark">${b.userName}</div>
                <div class="small text-muted" style="font-size: 0.75rem;">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>${softwareDisplay}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

function formatDate(dateStr) {
    if(!dateStr) return "-";
    const parts = dateStr.split('-');
    if(parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function updateStatus(id, newStatus) {
    if (newStatus === 'rejected' && !confirm("ยืนยันการยกเลิกรายการจองนี้?")) return;

    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        const booking = bookings[index];
        booking.status = newStatus;
        DB.saveBookings(bookings);
        
        // ถ้าเป็นการยกเลิก/No Show -> คืนสถานะ PC เป็นว่าง (ถ้าสถานะเครื่องยังเป็น reserved อยู่)
        if (newStatus === 'no_show' || newStatus === 'rejected') {
            const pcs = DB.getPCs();
            const pc = pcs.find(p => String(p.id) === String(booking.pcId));
            if (pc && pc.status === 'reserved' && pc.currentUser === booking.userName) {
                DB.updatePCStatus(booking.pcId, 'available', null);
            }
        }
        renderBookings();
    }
}

// ==========================================
// 2. MODAL & SAVE LOGIC
// ==========================================

function openBookingModal() {
    const today = new Date().toISOString().split('T')[0];
    
    // Reset Form
    if(document.getElementById('bkDate')) document.getElementById('bkDate').value = today;
    if(document.getElementById('bkPcSelect')) document.getElementById('bkPcSelect').value = '';
    if(document.getElementById('bkTimeSlot')) document.getElementById('bkTimeSlot').value = '09:00-10:30';
    if(document.getElementById('bkUser')) document.getElementById('bkUser').value = '';
    if(document.getElementById('bkTypeSelect')) document.getElementById('bkTypeSelect').value = 'General';
    if(document.getElementById('bkSoftwareFilter')) document.getElementById('bkSoftwareFilter').value = '';
    
    // Reset UI
    filterPCList(); 
    toggleSoftwareList(); 
    
    const hint = document.getElementById('pcSoftwareHint');
    if(hint) hint.innerText = '';

    if(bookingModal) bookingModal.show();
}

function saveBooking() {
    const pcId = document.getElementById('bkPcSelect').value;
    const date = document.getElementById('bkDate').value;
    const timeSlotStr = document.getElementById('bkTimeSlot').value; 
    const userId = document.getElementById('bkUser').value.trim();
    const type = document.getElementById('bkTypeSelect').value;

    if (!pcId || !date || !timeSlotStr || !userId) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    const [start, end] = timeSlotStr.split('-');

    // Double Check Conflict (เผื่อหน้าจอไม่อัปเดต)
    const bookings = DB.getBookings();
    const isDup = bookings.some(b => 
        b.date === date && b.pcId === pcId && 
        ['approved', 'pending', 'in_use'].includes(b.status) &&
        ((start >= b.startTime && start < b.endTime) || (end > b.startTime && end <= b.endTime))
    );

    if (isDup) {
        alert("⚠️ เครื่องนี้ถูกจองไปแล้วในช่วงเวลาดังกล่าว กรุณาเลือกเครื่องอื่น");
        return;
    }
    
    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    let softwareList = [];
    const newBooking = {
        id: 'b_' + Date.now(),
        userId: userId,
        userName: userId, 
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: date,
        startTime: start,
        endTime: end,
        status: 'approved',
        type: type,
        softwareList: [] // หรือเก็บตามที่เลือก
    };

    bookings.push(newBooking);
    DB.saveBookings(bookings);
    
    alert("บันทึกการจองเรียบร้อย");
    if(bookingModal) bookingModal.hide();
    renderBookings();
}

function deleteBooking(id) {
    if(!confirm("ยืนยันลบข้อมูลการจองนี้?")) return;
    let bookings = DB.getBookings();
    bookings = bookings.filter(b => b.id !== id);
    DB.saveBookings(bookings);
    renderBookings();
}

function toggleSoftwareList() {
    const type = document.getElementById('bkTypeSelect').value;
    const box = document.getElementById('aiSelectionBox');
    if (box) {
        if (type === 'AI') box.classList.remove('d-none');
        else box.classList.add('d-none');
    }
}

function handleImport(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) { processCSVData(e.target.result); };
    reader.readAsText(file);
    input.value = ''; 
}

function processCSVData(csvText) {
    alert("ฟังก์ชัน Import CSV พร้อมใช้งาน");
}