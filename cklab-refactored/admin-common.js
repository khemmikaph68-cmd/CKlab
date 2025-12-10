/* admin-common.js */
document.addEventListener('DOMContentLoaded', () => {
    checkAdminAuth();
    renderSidebar();
});

function checkAdminAuth() {
    // ยกเว้นหน้า Login ไม่ต้องเช็ค
    if (window.location.pathname.includes('admin-login.html')) return;

    const session = DB.getSession();
    // ตรวจสอบว่าเป็น Admin หรือไม่ (ใน mock-db เราตั้ง role: 'admin' ไว้)
    if (!session || !session.user || session.user.role !== 'admin') {
        alert('กรุณาเข้าสู่ระบบผู้ดูแลระบบ');
        window.location.href = 'admin-login.html';
    }
}

function renderSidebar() {
    const sidebar = document.getElementById('sidebar-container');
    if (!sidebar) return;

    const page = window.location.pathname.split("/").pop(); // ชื่อไฟล์ปัจจุบัน

    // HTML ของ Sidebar
    sidebar.innerHTML = `
        <div class="d-flex flex-column flex-shrink-0 p-3 bg-white shadow-sm h-100" style="min-height: 100vh;">
            <a href="#" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-decoration-none text-dark">
                <span class="fs-4 fw-bold text-primary">🛠️ CKLab Admin</span>
            </a>
            <hr>
            <ul class="nav nav-pills flex-column mb-auto">
                <li class="nav-item">
                    <a href="admin-monitor.html" class="nav-link ${page.includes('monitor') ? 'active' : 'link-dark'}">
                        📊 Monitor (ภาพรวม)
                    </a>
                </li>
                <li>
                    <a href="admin-manage.html" class="nav-link ${page.includes('manage') ? 'active' : 'link-dark'}">
                        🖥️ จัดการเครื่อง (Manage)
                    </a>
                </li>
                <li>
                    <a href="admin-report.html" class="nav-link ${page.includes('report') ? 'active' : 'link-dark'}">
                        📈 รายงาน (Reports)
                    </a>
                </li>
            </ul>
            <hr>
            <button onclick="adminLogout()" class="btn btn-outline-danger w-100">
                ออกจากระบบ
            </button>
        </div>
    `;
}

function adminLogout() {
    if(confirm('ยืนยันออกจากระบบ?')) {
        DB.clearSession();
        window.location.href = 'index.html'; // กลับไปหน้าแรกของ User
    }
}   