/* admin-booking.js */

let bookingModal;

document.addEventListener('DOMContentLoaded', () => {
    // Init Modal
    const modalEl = document.getElementById('bookingModal');
    if (modalEl) bookingModal = new bootstrap.Modal(modalEl);

    // Set Default Date Filter = Today
    document.getElementById('bookingDateFilter').valueAsDate = new Date();

    // Render
    renderBookings();
});

// --- RENDER TABLE ---
function renderBookings() {
    const tbody = document.getElementById('bookingTableBody');
    const bookings = DB.getBookings();
    
    // Get Filters
    const filterDate = document.getElementById('bookingDateFilter').value;
    const filterStatus = document.getElementById('bookingStatusFilter').value;

    tbody.innerHTML = '';

    // Filter Logic
    const filtered = bookings.filter(b => {
        if (filterDate && b.date !== filterDate) return false;
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-4">ไม่มีรายการจองในวันนี้</td></tr>`;
        return;
    }

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

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="fw-bold text-primary">${b.startTime} - ${b.endTime}</td>
            <td>
                <div class="fw-bold">${b.userName}</div>
                <div class="small text-muted">${b.userId}</div>
            </td>
            <td><span class="badge bg-light text-dark border">${b.pcName}</span></td>
            <td class="small text-muted">${b.note || '-'}</td>
            <td><span class="badge ${badgeClass}">${statusText}</span></td>
            <td class="text-end pe-4">${actionBtns}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS ---

// อัปเดตสถานะ (Approve / Reject)
function updateStatus(id, newStatus) {
    let bookings = DB.getBookings();
    const index = bookings.findIndex(b => b.id === id);
    if (index !== -1) {
        bookings[index].status = newStatus;
        DB.saveBookings(bookings);
        renderBookings();
    }
}

// เปิด Modal เพิ่มจอง
function openBookingModal() {
    // 1. โหลดรายชื่อ PC ลง Select
    const pcs = DB.getPCs();
    const select = document.getElementById('bkPcSelect');
    select.innerHTML = '';
    
    pcs.forEach(pc => {
        // แสดงชื่อ PC และสถานะ
        const option = document.createElement('option');
        option.value = pc.id;
        option.text = `${pc.name} (${pc.status})`;
        select.appendChild(option);
    });

    // 2. Set Default Values
    document.getElementById('bkUser').value = '';
    document.getElementById('bkDate').valueAsDate = new Date();
    document.getElementById('bkTimeStart').value = '09:00';
    document.getElementById('bkTimeEnd').value = '12:00';
    document.getElementById('bkNote').value = '';

    bookingModal.show();
}

// บันทึกการจองใหม่
function saveBooking() {
    const pcs = DB.getPCs();
    const pcId = document.getElementById('bkPcSelect').value;
    const pc = pcs.find(p => String(p.id) === String(pcId));

    const newBooking = {
        id: 'b' + Date.now(),
        userId: 'AdminKey',
        userName: document.getElementById('bkUser').value,
        pcId: pcId,
        pcName: pc ? pc.name : 'Unknown',
        date: document.getElementById('bkDate').value,
        startTime: document.getElementById('bkTimeStart').value,
        endTime: document.getElementById('bkTimeEnd').value,
        note: document.getElementById('bkNote').value,
        status: 'approved' // ถ้า Admin จองให้เอง ถือว่า Approved เลย
    };

    let bookings = DB.getBookings();
    bookings.push(newBooking);
    DB.saveBookings(bookings);

    bookingModal.hide();
    renderBookings();
    alert('✅ บันทึกการจองสำเร็จ');
}