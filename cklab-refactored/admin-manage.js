let pcModal;

document.addEventListener('DOMContentLoaded', () => {
    pcModal = new bootstrap.Modal(document.getElementById('pcModal'));
    renderTable();
});

function renderTable() {
    const tbody = document.getElementById('pcTable');
    tbody.innerHTML = '';
    const pcs = DB.getPCs();

    pcs.forEach(pc => {
        tbody.innerHTML += `
            <tr>
                <td>${pc.id}</td>
                <td class="fw-bold">${pc.name}</td>
                <td><span class="badge bg-secondary">${pc.status}</span></td>
                <td class="text-end">
                    <button onclick="openModal(${pc.id})" class="btn btn-sm btn-warning">แก้ไข</button>
                    <button onclick="deletePC(${pc.id})" class="btn btn-sm btn-outline-danger">ลบ</button>
                </td>
            </tr>
        `;
    });
}

function openModal(id = null) {
    document.getElementById('editId').value = id || '';
    if (id) {
        const pc = DB.getPCs().find(p => p.id == id);
        document.getElementById('editName').value = pc.name;
        document.getElementById('editStatus').value = pc.status;
    } else {
        document.getElementById('editName').value = '';
        document.getElementById('editStatus').value = 'available';
    }
    pcModal.show();
}

function savePC() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value;
    const status = document.getElementById('editStatus').value;
    
    let pcs = DB.getPCs();
    
    if (id) {
        // Edit
        let pc = pcs.find(p => p.id == id);
        if(pc) { pc.name = name; pc.status = status; }
    } else {
        // Add New
        const newId = pcs.length > 0 ? Math.max(...pcs.map(p=>p.id)) + 1 : 1;
        pcs.push({ id: newId, name, status, software: [] });
    }
    
    DB.savePCs(pcs);
    pcModal.hide();
    renderTable();
}

function deletePC(id) {
    if(confirm('ยืนยันลบข้อมูล?')) {
        const pcs = DB.getPCs().filter(p => p.id != id);
        DB.savePCs(pcs);
        renderTable();
    }
}