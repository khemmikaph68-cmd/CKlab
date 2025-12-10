/* mock-db.js */

// --- 1. MOCK DATA (ข้อมูลตั้งต้น) ---
const DEFAULT_PCS = [
    { id: 1, name: "PC-01", status: "available", software: [1, 2] },
    { id: 2, name: "PC-02", status: "available", software: [1] },
    { id: 3, name: "PC-03", status: "maintenance", software: [] }, 
    { id: 4, name: "PC-04", status: "in_use", software: [1, 3], currentUser: "นายสมชาย (Demo)", startTime: Date.now() - 3600000 },
    { id: 5, name: "PC-05", status: "available", software: [2, 4] },
    { id: 6, name: "PC-06", status: "reserved", software: [1] }
];

const MOCK_USERS_API = {
    "66123456": { name: "นายสมชาย ใจดี", faculty: "คณะวิศวกรรมศาสตร์", type: "Student" },
    "admin": { name: "Administrator", role: "admin" }
};

const DEFAULT_CONFIG = {
    labName: "ห้องปฏิบัติการคอมพิวเตอร์ CKLab",
    announcement: "ยินดีต้อนรับสู่ CKLab เปิดให้บริการ จันทร์-ศุกร์ 08.00 - 20.00 น."
};

// --- 2. DATABASE SYSTEM (LocalStorage Wrapper) ---
const DB = {
    // --- Basic Storage Helpers ---
    getData: (key, def) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : def;
    },
    setData: (key, val) => localStorage.setItem(key, JSON.stringify(val)),

    // --- PC Management ---
    getPCs: () => DB.getData('ck_pcs', DEFAULT_PCS),
    savePCs: (data) => DB.setData('ck_pcs', data),
    
    updatePCStatus: (id, status, user = null) => {
        let pcs = DB.getPCs();
        let pc = pcs.find(p => p.id == id);
        if (pc) {
            pc.status = status;
            pc.currentUser = user;
            // ถ้าสถานะเป็น in_use ให้เริ่มจับเวลา ถ้าไม่ ให้เคลียร์เวลา
            pc.startTime = (status === 'in_use') ? Date.now() : null;
            DB.savePCs(pcs);
        }
    },

    // --- User & Auth ---
    checkUser: (id) => {
        // จำลองการเช็ค User จาก Mock Data
        return MOCK_USERS_API[id] || null;
    },

    // --- Session Management (สำคัญสำหรับ Multi-page) ---
    // ใช้ sessionStorage เพื่อเก็บข้อมูลชั่วคราวระหว่างเปลี่ยนหน้า (หายเมื่อปิด Browser)
    getSession: () => {
        const s = sessionStorage.getItem('ck_session');
        return s ? JSON.parse(s) : null;
    },
    setSession: (data) => {
        const current = DB.getSession() || {};
        // รวมข้อมูลเก่ากับข้อมูลใหม่ (Merge)
        sessionStorage.setItem('ck_session', JSON.stringify({ ...current, ...data }));
    },
    clearSession: () => sessionStorage.removeItem('ck_session'),

    // --- Logs & History ---
    getLogs: () => DB.getData('ck_logs', []),
    saveLog: (logEntry) => {
        let logs = DB.getLogs();
        logs.push({ 
            ...logEntry, 
            timestamp: new Date().toISOString() 
        });
        DB.setData('ck_logs', logs);
    },

    // --- Config ---
    getConfig: () => DB.getData('ck_config', DEFAULT_CONFIG),
    saveConfig: (data) => DB.setData('ck_config', data)
};