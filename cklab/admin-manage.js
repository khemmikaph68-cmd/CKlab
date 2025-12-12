/* admin-manage.js */

let pcModal; // ตัวแปรเก็บ Modal

document.addEventListener('DOMContentLoaded', () => {
    // 1. ตรวจสอบ DB และ Session
    if (typeof DB === 'undefined') {
        console.error("Critical: mock-db.js not loaded.");
        alert("Error: ไม่พบไฟล์ mock-db.js");
        return;
    }

    const session = DB.getSession();
    if (!session || !session.user || session.user.role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    // 2. เตรียม Modal
    const modalEl = document.getElementById('pcModal');
    if (modalEl) {
        pcModal = new bootstrap.Modal(modalEl);
    }

    // 3. วาดตารางข้อมูล
    renderPCTable();
});

// --- 1. RENDER TABLE (แสดงตารางรายชื่อ PC) ---
function renderPCTable() {
    const tbody = document.getElementById('pcTableBody');
    if (!tbody) return;

    const pcs = Array.isArray(DB.getPCs()) ? DB.getPCs() : [];
    
    tbody.innerHTML = '';

    if (pcs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-5 text-muted">ไม่พบข้อมูล (กดปุ่ม "เพิ่มเครื่องใหม่")</td></tr>`;
        return;
    }

    pcs.forEach(pc => {
        const id = pc.id || '?';
        const name = pc.name || 'Unknown';
        const status = pc.status || 'maintenance';
        
        // ✅ ข้อมูลใหม่
        const type = pc.pcType === 'AI' 
            ? '<span class="badge bg-primary"><i class="bi bi-robot me-1"></i>AI Station</span>' 
            : '<span class="badge bg-secondary">General</span>';
        const timeSlot = pc.timeSlot || '<span class="text-muted">-</span>';
        
        let badgeClass = 'bg-secondary';
        if (status === 'available') badgeClass = 'bg-success';
        if (status === 'in_use') badgeClass = 'bg-danger';
        if (status === 'reserved') badgeClass = 'bg-warning text-dark';
        
        // จัดการรายชื่อ Software
        let softBadges = '<span class="text-muted small">-</span>';
        if (Array.isArray(pc.installedSoftware) && pc.installedSoftware.length > 0) {
            softBadges = pc.installedSoftware.map(s => {
                let sName = s || "";
                let isAI = sName.toLowerCase().includes('gpt') || sName.toLowerCase().includes('ai') || sName.toLowerCase().includes('gemini');
                let color = isAI ? 'bg-primary bg-opacity-10 text-primary border border-primary' : 'bg-light text-dark border';
                return `<span class="badge ${color} me-1 mb-1 fw-normal">${sName}</span>`;
            }).join('');
        }

        tbody.innerHTML += `
            <tr>
                <td class="ps-4 fw-bold text-muted">#${id}</td>
                <td><span class="fw-bold text-primary">${name}</span></td>
                <td><span class="badge ${badgeClass}">${status.toUpperCase()}</span></td>
                <td>${type}</td> <td class="small">${timeSlot}</td> <td>${softBadges}</td>
                <td class="text-end pe-4">
                    <button onclick="openPCModal('${id}')" class="btn btn-sm btn-outline-primary me-1"><i class="bi bi-pencil-fill"></i></button>
                    <button onclick="deletePC('${id}')" class="btn btn-sm btn-outline-danger"><i class="bi bi-trash-fill"></i></button>
                </td>
            </tr>
        `;
    });
}

// --- 2. OPEN MODAL (เปิดหน้าต่างเพิ่ม/แก้ไข) ---
function openPCModal(id = null) {
    if (!pcModal) return;

    const modalTitle = document.getElementById('pcModalTitle');
    
    // เคลียร์ค่าเดิม
    document.getElementById('editPcId').value = '';
    document.getElementById('editPcName').value = '';
    document.getElementById('editPcStatus').value = 'available';
    document.getElementById('editPcType').value = 'General'; // Default
    document.getElementById('editPcTime').value = '';

    // สร้าง Checkbox รอไว้
    renderSoftwareCheckboxes(id);

    if (id) {
        // แก้ไข
        modalTitle.innerText = `แก้ไข PC-${id.toString().padStart(2,'0')}`;
        const pcs = Array.isArray(DB.getPCs()) ? DB.getPCs() : [];
        const pc = pcs.find(p => p.id == id);
        if (pc) {
            document.getElementById('editPcId').value = pc.id;
            document.getElementById('editPcName').value = pc.name;
            document.getElementById('editPcStatus').value = pc.status;
            // ✅ ใส่ค่าเดิมกลับเข้าไป
            document.getElementById('editPcType').value = pc.pcType || 'General';
            document.getElementById('editPcTime').value = pc.timeSlot || '';
        }
    } else {
        // เพิ่มใหม่
        modalTitle.innerText = 'เพิ่มเครื่องใหม่';
        const pcs = Array.isArray(DB.getPCs()) ? DB.getPCs() : [];
        let maxId = 0;
        pcs.forEach(p => { let num = parseInt(p.id); if (!isNaN(num) && num > maxId) maxId = num; });
        document.getElementById('editPcName').value = `PC-${(maxId + 1).toString().padStart(2,'0')}`;
    }
    
    toggleSoftwareRequire(); // เช็คสถานะ UI
    pcModal.show();
}

// --- 3. SOFTWARE CHECKBOXES (ดึง AI มาให้ติ๊กเลือก) ---
function renderSoftwareCheckboxes(pcId) {
    const listContainer = document.getElementById('softwareCheckboxList');
    if (!listContainer) return;

    const lib = (DB.getSoftwareLib && typeof DB.getSoftwareLib === 'function') ? DB.getSoftwareLib() : []; 
    
    let installed = [];
    if (pcId) {
        const pcs = Array.isArray(DB.getPCs()) ? DB.getPCs() : [];
        const pc = pcs.find(p => p.id == pcId);
        if (pc && Array.isArray(pc.installedSoftware)) installed = pc.installedSoftware;
    }

    listContainer.innerHTML = '';
    
    if (lib.length === 0) {
        listContainer.innerHTML = '<div class="col-12 text-muted small text-center p-3">ไม่พบรายการ Software</div>';
        return;
    }

    lib.forEach(item => {
        const fullName = `${item.name} (${item.version})`;
        const isChecked = installed.includes(fullName) ? 'checked' : '';
        
        const icon = item.type === 'AI' 
            ? '<i class="bi bi-robot text-primary"></i>' 
            : '<i class="bi bi-hdd-network text-secondary"></i>';

        listContainer.innerHTML += `
            <div class="col-md-6">
                <div class="form-check bg-white p-2 rounded border h-100">
                    <input class="form-check-input ms-1" type="checkbox" name="pcSoftware" value="${fullName}" id="sw_${item.id}" ${isChecked}>
                    <label class="form-check-label ms-2 small fw-bold w-100 cursor-pointer" for="sw_${item.id}">
                        ${icon} ${item.name} <span class="text-muted fw-normal">v.${item.version}</span>
                    </label>
                </div>
            </div>
        `;
    });
}

// ✅ ฟังก์ชันปรับ UI เมื่อเลือก Type
function toggleSoftwareRequire() {
    const type = document.getElementById('editPcType').value;
    const box = document.getElementById('softwareCheckboxList').parentElement;
    
    // ถ้าเป็น AI ให้ขอบกล่องเป็นสีน้ำเงิน เพื่อเน้นว่าต้องเลือก
    if (type === 'AI') {
        box.classList.add('border-primary', 'shadow-sm');
        box.classList.remove('border-0');
    } else {
        box.classList.remove('border-primary', 'shadow-sm');
        box.classList.add('border-0');
    }
}

// --- 4. SAVE DATA (บันทึก) ---
function savePC() {
    const id = document.getElementById('editPcId').value;
    const name = document.getElementById('editPcName').value.trim();
    const status = document.getElementById('editPcStatus').value;
    // ✅ รับค่าใหม่
    const type = document.getElementById('editPcType').value;
    const timeSlot = document.getElementById('editPcTime').value.trim();

    if (!name) { alert("กรุณาระบุชื่อเครื่อง"); return; }

    // ดึงค่า Checkbox ที่ถูกเลือก
    const checkboxes = document.querySelectorAll('input[name="pcSoftware"]:checked');
    const selectedSoftware = Array.from(checkboxes).map(cb => cb.value);

    // ✅ Validation: ถ้าเป็น AI ต้องเลือก Software อย่างน้อย 1 ตัว
    if (type === 'AI' && selectedSoftware.length === 0) {
        alert("⚠️ สำหรับเครื่องประเภท AI Workstation\nกรุณาเลือก Software/AI ที่ติดตั้งอย่างน้อย 1 รายการ");
        return; 
    }

    let pcs = Array.isArray(DB.getPCs()) ? DB.getPCs() : [];

    // เตรียม Object ข้อมูลที่จะบันทึก
    const pcData = {
        name, 
        status, 
        pcType: type,       // บันทึก Type
        timeSlot: timeSlot, // บันทึก Time Slot
        installedSoftware: selectedSoftware
    };

    if (id) {
        // Update
        const index = pcs.findIndex(p => p.id == id);
        if (index !== -1) {
            // Merge ข้อมูลเดิมเข้ากับข้อมูลใหม่
            pcs[index] = { ...pcs[index], ...pcData };
            
            if(status === 'available') { 
                pcs[index].currentUser = null; 
                pcs[index].startTime = null; 
            } else if (status === 'in_use' && !pcs[index].currentUser) {
                 pcs[index].currentUser = "Admin Set";
                 pcs[index].startTime = Date.now();
            }
        }
    } else {
        // Create New
        let maxId = 0;
        pcs.forEach(p => { let num = parseInt(p.id); if (!isNaN(num) && num > maxId) maxId = num; });
        const newId = (maxId + 1).toString();

        pcs.push({
            id: newId, 
            ...pcData,
            currentUser: (status === 'in_use') ? "Admin Set" : null, 
            startTime: (status === 'in_use') ? Date.now() : null
        });
    }

    DB.savePCs(pcs);
    if(pcModal) pcModal.hide();
    renderPCTable();
    // alert("บันทึกข้อมูลเรียบร้อย");
}

// --- 5. DELETE DATA (ลบ) ---
function deletePC(id) {
    if(confirm('ยืนยันการลบเครื่องนี้?')) {
        let pcs = DB.getPCs().filter(p => p.id != id);
        DB.savePCs(pcs);
        renderPCTable();
    }
}