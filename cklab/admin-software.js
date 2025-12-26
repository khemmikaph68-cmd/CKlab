/* admin-software.js (Updated: Enable Search by Type) */

let softwareModal;

document.addEventListener('DOMContentLoaded', () => {
    // 1. เช็คสิทธิ์ Admin
    const session = DB.getSession();
    /* if (!session || !session.user || session.user.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    */

    // 2. Init Modal
    const modalEl = document.getElementById('softwareModal');
    if(modalEl) softwareModal = new bootstrap.Modal(modalEl);

    // 3. Render Data
    renderTable();
});

// ==========================================
// 💻 SOFTWARE MANAGEMENT
// ==========================================

function renderTable() {
    const tbody = document.getElementById('softwareTableBody');
    let lib = DB.getSoftwareLib(); 

    // --- 1. Stats ---
    const total = lib.length;
    const aiCount = lib.filter(i => i.type === 'AI').length;
    const swCount = lib.filter(i => i.type === 'Software').length;

    if(document.getElementById('countTotal')) document.getElementById('countTotal').innerText = total;
    if(document.getElementById('countAI')) document.getElementById('countAI').innerText = aiCount;
    if(document.getElementById('countSW')) document.getElementById('countSW').innerText = swCount;

    // --- 2. Search System (แก้ไขแล้ว) ---
    const searchInput = document.getElementById('softwareSearch');
    const searchVal = searchInput ? searchInput.value.toLowerCase() : '';
    
    if (searchVal) {
        lib = lib.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.version.toLowerCase().includes(searchVal) ||
            item.type.toLowerCase().includes(searchVal) // ✅ เพิ่มบรรทัดนี้: ให้ค้นหาจาก Type ได้ด้วย
        );
    }

    // --- 3. Draw Table ---
    tbody.innerHTML = '';

    if (lib.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-5 text-muted">ไม่พบข้อมูล</td></tr>`;
        return;
    }

    lib.forEach(item => {
        let typeBadge = item.type === 'AI' 
            ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-robot me-1"></i>AI Tool</span>' 
            : '<span class="badge bg-secondary-subtle text-secondary border border-secondary-subtle"><i class="bi bi-hdd me-1"></i>Software</span>';

        let expireHtml = '';
        if (item.expire) {
            const today = new Date().toLocaleDateString('en-CA');
            const isExpired = item.expire < today;
            const colorClass = isExpired ? 'text-danger fw-bold' : 'text-muted';
            const icon = isExpired ? 'bi-exclamation-circle-fill' : 'bi-clock-history';
            expireHtml = `<div class="${colorClass} mt-1" style="font-size: 0.75rem;"><i class="bi ${icon} me-1"></i>Exp: ${item.expire}</div>`;
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4">
                    <div class="fw-bold text-dark">${item.name}</div>
                    ${expireHtml}
                </td>
                <td><span class="text-secondary">${item.version}</span></td>
                <td>${typeBadge}</td>
                <td class="text-end pe-4">
                    <button onclick="openModal('${item.id}')" class="btn btn-sm btn-light border text-primary me-1" title="แก้ไข">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button onclick="deleteItem('${item.id}')" class="btn btn-sm btn-light border text-danger" title="ลบ">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

function openModal(id = null) {
    const modalTitle = document.getElementById('modalTitle');
    
    // Reset Form
    document.getElementById('editId').value = '';
    document.getElementById('editName').value = '';
    document.getElementById('editVersion').value = '';
    document.getElementById('editExpire').value = '';
    
    // Reset Type Selection (Default = Software)
    document.getElementById('editType').value = 'Software';
    updateTypeCardUI('Software');

    if (id) {
        modalTitle.innerHTML = '<i class="bi bi-pencil-square me-2"></i>แก้ไขข้อมูล';
        const lib = DB.getSoftwareLib();
        const item = lib.find(i => i.id == id);
        if (item) {
            document.getElementById('editId').value = item.id;
            document.getElementById('editName').value = item.name;
            document.getElementById('editVersion').value = item.version;
            document.getElementById('editExpire').value = item.expire || '';
            
            document.getElementById('editType').value = item.type;
            updateTypeCardUI(item.type);
        }
    } else {
        modalTitle.innerHTML = '<i class="bi bi-plus-lg me-2"></i>เพิ่มรายการใหม่';
    }

    if(softwareModal) softwareModal.show();
}

function updateTypeCardUI(type) {
    const cards = document.querySelectorAll('.software-type-card');
    cards.forEach(card => card.classList.remove('active'));
    
    if (type === 'Software') {
        if(cards[0]) cards[0].classList.add('active');
    } else {
        if(cards[1]) cards[1].classList.add('active');
    }
}

function saveSoftware() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const version = document.getElementById('editVersion').value.trim();
    const type = document.getElementById('editType').value;
    const expire = document.getElementById('editExpire').value;

    if (!name || !version) return alert("กรุณากรอกชื่อและแพ็กเกจให้ครบถ้วน");

    let lib = DB.getSoftwareLib();
    const data = { name, version, type, expire };

    if (id) {
        // Edit
        const idx = lib.findIndex(i => i.id == id);
        if (idx !== -1) {
            lib[idx] = { ...lib[idx], ...data };
        }
    } else {
        // Add
        const newId = 'sw_' + Date.now();
        lib.push({ id: newId, ...data });
    }

    DB.saveSoftwareLib(lib);
    if(softwareModal) softwareModal.hide();
    renderTable();
}

function deleteItem(id) {
    if (confirm('ยืนยันลบรายการนี้?')) {
        let lib = DB.getSoftwareLib().filter(i => i.id != id);
        DB.saveSoftwareLib(lib);
        renderTable();
    }
}