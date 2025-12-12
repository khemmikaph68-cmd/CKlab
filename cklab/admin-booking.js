/* admin-booking.js */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // Set Default Date Filter = Today
    const todayStr = new Date().toISOString().split('T')[0];
    const dateFilter = document.getElementById('bookingDateFilter');
    if(dateFilter) dateFilter.value = todayStr;

    // Render
    renderBookings();
});

// --- RENDER TABLE ---
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    if(!tbody) return;

    const bookings = DB.getBookings();
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองในวันนี้</td></tr>`;
        return;
    }

    filtered.sort((a, b) => a.startTime.localeCompare(b.startTime));

    filtered.forEach(b => {
        let badgeClass = '';
        let statusText = '';
        let actionBtns = '';

        switch(b.status) {
            case 'pending':
                badgeClass = 'bg-warning text-dark'; statusText = 'รออนุมัติ';
                actionBtns = `
                    <button class="btn btn-sm btn-success me-1" onclick="updateStatus('${b.id}', 'approved')" title="อนุมัติ"><i class="bi bi-check-lg"></i></button>
                    <button class="btn btn-sm btn-danger" onclick="updateStatus('${b.id}', 'rejected')" title="ปฏิเสธ"><i class="bi bi-x-lg"></i></button>
                `;
                break;
            case 'approved':
                badgeClass = 'bg-success'; statusText = 'อนุมัติแล้ว';
                actionBtns = `<button class="btn btn-sm btn-outline-danger" onclick="updateStatus('${b.id}', 'rejected')">ยกเลิก</button>`;
                break;
            case 'rejected':
                badgeClass = 'bg-secondary'; statusText = 'ไม่อนุมัติ';
                actionBtns = `<button class="btn btn-sm btn-outline-secondary" disabled>ยกเลิกแล้ว</button>`;
                break;
        }

        // แสดง Software ที่จองไว้ด้วย (ถ้ามี)
        let softwareInfo = '';
        if (b.bookedSoftware && b.bookedSoftware.length > 0) {
            softwareInfo = `<div class="mt-1 small text-muted"><i class="bi bi-code-slash me-1"></i>${b.bookedSoftware.join(', ')}</div>`;
        }

        const typeBadge = b.type === 'AI' 
            ? '<span class="badge bg-primary bg-opacity-10 text-primary border border-primary"><i class="bi bi-robot me-1"></i>AI</span>' 
            : '<span class="badge bg-secondary bg-opacity-10 text-secondary border"><i class="bi bi-laptop me-1"></i>General</span>';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold">${b.userName}</div>
                <div class="small text-muted">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td>
                ${typeBadge}
                ${softwareInfo}
            </td> 
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- HELPER: CHECK OVERLAP ---
function checkTimeOverlap(pcId, date, start, end) {
    const bookings = DB.getBookings();
    const toMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    };
    const newStart = toMinutes(start);
    const newEnd = toMinutes(end);

    return bookings.find(b => {
        if (b.pcId === String(pcId) && b.date === date && b.status !== 'rejected') {
            const bStart = toMinutes(b.startTime);
            const bEnd = toMinutes(b.endTime);
            return (newStart < bEnd && newEnd > bStart);
        }
        return false;
    });
}

// --- ACTIONS ---

function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    
    if (index !== -1) {
        bookings[index].status = newStatus;
        DB.saveBookings(bookings);
        
        // ✅ แก้ไข: เพิ่ม Logic คืนสถานะเครื่องเมื่อ "ยกเลิก/ปฏิเสธ"
        if (newStatus === 'rejected') {
             const booking = bookings[index];
             const todayStr = new Date().toISOString().split('T')[0];
             
             // ถ้าเป็นการจองของ "วันนี้"
             if (booking.date === todayStr) {
                 // ตรวจสอบก่อนว่าเครื่องยังเป็น "reserved" อยู่ไหม (เพื่อไม่ให้ไปเตะคนที่กำลังใช้งานจริง)
                 const pcs = DB.getPCs();
                 const pc = pcs.find(p => String(p.id) === String(booking.pcId));
                 
                 if (pc && pc.status === 'reserved') {
                     // คืนสถานะเป็นว่าง
                     DB.updatePCStatus(booking.pcId, 'available'); 
                     // alert(`ยกเลิกการจองและคืนสถานะเครื่อง PC-${pc.name} เรียบร้อยแล้ว`);
                 }
             }
        }
        
        renderBookings();
    }
}

function openBookingModal() {
    const pcs = DB.getPCs();
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '';
    
    pcs.forEach(pc => {
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        select.appendChild(option);
    });

    const now = new Date();
    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').value = now.toISOString().split('T')[0];
    document.getElementById('bkTimeSlot').selectedIndex = 0; 
    document.getElementById('bkType').value = 'General';

    // สร้าง Checkbox รอไว้
    renderBookingSoftwareOptions();
    // รีเซ็ตการแสดงผล Software section
    toggleBookingSoftware();

    if(bookingModal) bookingModal.show();
}

// ✅ สร้าง Checkbox Software ในหน้า Booking
function renderBookingSoftwareOptions() {
    const container = document.getElementById('bkSoftwareList');
    if (!container) return;
    
    // ดึง Software ทั้งหมด
    const lib = (DB.getSoftwareLib && typeof DB.getSoftwareLib === 'function') ? DB.getSoftwareLib() : [];
    container.innerHTML = '';

    if (lib.length === 0) {
        container.innerHTML = '<div class="col-12 text-muted small">ไม่พบรายการ Software</div>';
        return;
    }

    lib.forEach(item => {
        const fullName = `${item.name} (${item.version})`;
        const icon = item.type === 'AI' ? '<i class="bi bi-robot text-primary"></i>' : '<i class="bi bi-hdd-network text-secondary"></i>';
        
        container.innerHTML += `
            <div class="col-md-6">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" name="bkSoftware" value="${fullName}" id="bksw_${item.id}">
                    <label class="form-check-label small cursor-pointer" for="bksw_${item.id}">
                        ${icon} ${item.name}
                    </label>
                </div>
            </div>
        `;
    });
}

// ✅ ฟังก์ชันโชว์/ซ่อน กล่อง Software
function toggleBookingSoftware() {
    const type = document.getElementById('bkType').value;
    const section = document.getElementById('bkSoftwareSection');
    
    if (type === 'AI') {
        section.style.display = 'block';
    } else {
        section.style.display = 'none';
        // เคลียร์ค่าที่ติ๊กไว้ถ้าเปลี่ยนกลับเป็น General
        document.querySelectorAll('input[name="bkSoftware"]').forEach(cb => cb.checked = false);
    }
}

function saveBooking() {
    const pcId = document.getElementById('bkPcSelect').value;
    const date = document.getElementById('bkDate').value;
    const userName = document.getElementById('bkUser').value.trim();
    const timeSlotVal = document.getElementById('bkTimeSlot').value;
    const [start, end] = timeSlotVal.split('-');
    const type = document.getElementById('bkType').value;

    if (!userName || !date) {
        alert("กรุณากรอกข้อมูลให้ครบถ้วน");
        return;
    }

    // ✅ ตรวจสอบเงื่อนไข AI
    let selectedSoftware = [];
    if (type === 'AI') {
        const checkboxes = document.querySelectorAll('input[name="bkSoftware"]:checked');
        selectedSoftware = Array.from(checkboxes).map(cb => cb.value);
        
        if (selectedSoftware.length === 0) {
            alert("⚠️ กรุณาเลือก AI/Software อย่างน้อย 1 รายการ\n(เนื่องจากคุณเลือกประเภทเป็น AI Workstation)");
            return;
        }
    }

    // เช็คจองซ้อน
    const conflict = checkTimeOverlap(pcId, date, start, end);
    if (conflict) {
        alert(`❌ ไม่สามารถจองได้! \nเครื่องนี้ถูกจองแล้วในช่วงเวลา ${conflict.startTime} - ${conflict.endTime}\nโดย: ${conflict.userName}`);
        return;
    }

    const pcs = DB.getPCs();
    const pc = pcs.find(p => String(p.id) === String(pcId));

    const newBooking = {
        id: 'b' + Date.now(),
        userId: 'AdminKey',
        userName: userName,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: date,
        startTime: start,
        endTime: end,
        type: type,
        bookedSoftware: selectedSoftware, // ✅ บันทึก Software ที่เลือกลง Booking
        status: 'approved' 
    };

    let bookings = DB.getBookings();
    bookings.push(newBooking);
    DB.saveBookings(bookings);

    // อัปเดตสถานะเครื่อง (เฉพาะจองของวันนี้)
    const todayStr = new Date().toISOString().split('T')[0];
    if (date === todayStr) {
        DB.updatePCStatus(pcId, 'reserved', userName);
        alert('✅ บันทึกการจองสำเร็จ (อัปเดตสถานะหน้า Monitor แล้ว)');
    } else {
        alert('✅ บันทึกการจองล่วงหน้าสำเร็จ');
    }

    if(bookingModal) bookingModal.hide();
    renderBookings();
}