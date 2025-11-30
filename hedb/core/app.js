// core/app.js
// 這是主要的邏輯控制中心，負責狀態管理、視圖切換和業務邏輯。

import { apiFetch, uploadFile, deleteFile } from './api.js';
import { showMsg, cleanupDynamicInputs, updateBatchControlVisibility, getCurrentActiveYear } from './utils.js';
import { 
    SYSTEM_FIELDS, MANDATORY_LOGIC_IDS, SYSTEM_CATEGORY_DEFS, ALLOWED_MAPPING_CATEGORY_IDS, 
    SYSTEM_DEFAULT_TYPES, OUTPUT_DISPLAY_FIELDS, 
    DATA_FILE, DEPT_DATA_PATH, DEPT_MASTER_PATH, YEAR_TEMPLATES_BASE_PATH 
} from './constants.js';

// --- Global State Variables (從 admin.html 移過來) ---
window.ghConfig = { user: '', repo: '', path: DATA_FILE, token: '' }; 
window.configData = { globalFields: [], academicYears: [], templateCategories: [], fieldTypes: [], addressRules: {}, allianceModeDepts: {} };
window.yearTemplateData = { fields: [], allianceModeDepts: {} };
window.activeYearId = null;
window.activeCatId = 'all'; 
window.isEditMode = false;
window.moveSrcIndex = -1;
window.moveType = '';
window.targetList = 'global';
window.unsavedChanges = false;
window.configSha = null; 
window.deptDataSha = null;
window.deptMasterSha = null;
window.activeCollegeId = null; 
window.departmentData = []; 
window.deptMasterData = {};
window.editingDeptEntityType = null; 

// --- Internship State Variables ---
window.currentConsolidationYear = null;
window.currentFileHeaders = [];
window.currentMapping = {}; 
window.currentStudentData = null; 
window.currentConsolidatedResults = null;
window.uniqueCourseDepts = []; 
window.currentTemplateFields = [];
window.currentSelectedGroup = null; 

// --- 通用輔助函數 ---
function setUnsaved(val) { 
    window.unsavedChanges = val; 
    document.getElementById('unsaved-badge').classList.toggle('hidden', !val); 
}

// --- GitHub 連線與初始化 ---
export async function connectGitHub() {
    // ... (邏輯與之前 admin.html 中的 connectGitHub 相同)
}

// --- 視圖切換與渲染 ---
export function switchView(v) {
    ['years','fields','types','internship', 'departments'].forEach(x => { 
        document.getElementById(`view-${x}`).classList.toggle('hidden', v!==x); 
        document.getElementById(`view-${x}`).classList.toggle(v!=='years'?'flex':'flex', v===x); 
        document.getElementById(`nav-${x}`).classList.toggle('active', v===x); 
    });
    if(v==='fields') renderGlobalList(); 
    if(v==='types') renderTypeManagerPage(); 
    if(v==='departments') renderDepartmentView();
    if(v==='internship') renderInternshipView();
}

// --- 學年度模組配置邏輯 ---
export async function selectYear(year) {
    // ... (邏輯與之前 admin.html 中的 selectYear 相同)
}

// --- 欄位模板庫邏輯 ---
export function renderGlobalList() {
    // ... (邏輯與之前 admin.html 中的 renderGlobalList 相同)
}

// --- 系所清單管理邏輯 (Q1, Q2, Q3) ---

// Helper to get Dept Full Name for a given year 
export function getDeptFullName(deptId, year) {
    const master = window.deptMasterData[deptId];
    if (!master) return deptId;
    const historicalName = master.historical_names?.[year];
    if (historicalName) return historicalName;
    return master.name || deptId;
}

// Helper to get Dept Display Name (Short or Full) (Q3)
export function getDeptDisplayName(deptId, useShort = true, specificYear = null) {
    const master = window.deptMasterData[deptId];
    if (!master) return deptId;

    if (useShort && master.short_name) return master.short_name;
    
    const targetYear = specificYear || window.currentConsolidationYear || window.activeYearId || (window.configData.academicYears.find(y => y.isDefault)?.year);
    return getDeptFullName(deptId, targetYear);
}

// Helper to get College Full Name for a given year (Q2)
export function getCollegeFullName(colId, year) {
    const college = window.departmentData.find(c => c.id === colId);
    if (!college) return colId;
    return college.historical_names?.[year] || college.name || colId;
}

// Helper to get College Display Name (Short or Full) (Q3)
export function getCollegeDisplayName(colId, useShort = true) {
    const college = window.departmentData.find(c => c.id === colId);
    if (!college) return colId;
    if (useShort && college.short_name) return college.short_name;
    
    const currentYear = getCurrentActiveYear();
    return getCollegeFullName(colId, currentYear);
}

export function renderDepartmentView() {
    // ... (邏輯與之前 admin.html 中的 renderDepartmentView 相同)
}

export function renderCollegeList() {
    // ... (邏輯與之前 admin.html 中的 renderCollegeList 相同)
}

export function selectCollege(id) {
    // ... (邏輯與之前 admin.html 中的 selectCollege 相同)
}

export function renderDepartmentList() {
    // ... (邏輯與之前 admin.html 中的 renderDepartmentList 相同)
}

export function openCollegeConfigModal(id = null) {
    // ... (邏輯與之前 admin.html 中的 openCollegeConfigModal 相同)
}

export function saveCollegeConfig() {
    // ... (邏輯與之前 admin.html 中的 saveCollegeConfig 相同)
}

export function deleteCurrentCollege() {
    // ... (邏輯與之前 admin.html 中的 deleteCurrentCollege 相同)
}

export function openDepartmentConfigModal(id = null) {
    // ... (邏輯與之前 admin.html 中的 openDepartmentConfigModal 相同)
}

export function saveDepartmentConfig() {
    // ... (邏輯與之前 admin.html 中的 saveDepartmentConfig 相同)
}

export function removeDepartment(id) {
    // ... (邏輯與之前 admin.html 中的 removeDepartment 相同)
}

// --- 檔案儲存邏輯 ---
export async function saveAll() {
    const btn=document.getElementById('btn-save');btn.disabled=true;btn.innerHTML='<div class="spinner"></div>';
    try { 
        let deptDataChanged = window.unsavedChanges;
        
        // 1. Save Main Config
        window.configSha = await uploadFile(window.ghConfig.path, window.configData, window.configSha); 
        
        // 2. Save Dept Master Data
        if (deptDataChanged) { // Only save if changes detected
            window.deptMasterSha = await uploadFile(DEPT_MASTER_PATH, window.deptMasterData, window.deptMasterSha);
        }
        
        // 3. Save Dept Grouping Data
        if (window.departmentData.length > 0 && deptDataChanged) {
            window.deptDataSha = await uploadFile(DEPT_DATA_PATH, window.departmentData, window.deptDataSha);
        }
        
        // 4. Save active Year Template
        if(window.activeYearId){
            const p=`${YEAR_TEMPLATES_BASE_PATH}/year_${window.activeYearId}_templates.json`;
            const c=await apiFetch(p);
            // NOTE: yearTemplateData now contains allianceModeDepts
            await uploadFile(p,window.yearTemplateData,c.status===200?c.sha:null);
        } 
        
        setUnsaved(false); 
        showMsg('success', '儲存成功', '所有設定已更新至 GitHub'); 
    }
    catch(e){showMsg('error', '儲存失敗', e.message);} 
    finally{btn.disabled=false;btn.innerHTML='<i class="fas fa-cloud-upload-alt"></i> 儲存設定';}
}

// --- 實習學生名單彙整邏輯 ---
export function renderInternshipView() {
    // ... (邏輯與之前 admin.html 中的 renderInternshipView 相同)
}

// --- 欄位類型管理邏輯 ---
export function renderTypeManagerPage() {
    // ... (邏輯與之前 admin.html 中的 renderTypeManagerPage 相同)
}

// --- 初始化入口 ---
window.onload = function() {
    // 綁定全局函數 (方便 HTML 內聯調用)
    window.connectGitHub = connectGitHub;
    window.saveAll = saveAll;
    window.switchView = switchView;
    window.logout = function() { showMsg('confirm', '確定登出？', '未儲存的變更將會遺失。', null, () => { localStorage.removeItem('gh_creds_safe'); sessionStorage.removeItem('gh_token'); location.reload(); }); };
    
    // 綁定頁面跳轉
    window.openCollegeConfigModal = openCollegeConfigModal;
    window.openDepartmentConfigModal = openDepartmentConfigModal;
    
    // 執行初始載入
    const saved = localStorage.getItem('gh_creds_safe');
    if(saved) { 
        const c = JSON.parse(saved); 
        document.getElementById('gh-user').value = c.user || ''; 
        document.getElementById('gh-repo').value = c.repo || ''; 
    }

    // 可以在這裡初始化其他 UI 綁定
    
    // 由於拆分複雜，需要確保所有函數定義都被 app.js 載入後再綁定。
};

// 為了讓主檔案能存取，將必要的函數掛到 window (簡化處理)
// ... (所有導出的函數和需要被 HTML 內聯調用的函數都需要在這裡重新掛載或修改 HTML 綁定)
window.connectGitHub = connectGitHub; 
window.saveAll = saveAll;
window.switchView = switchView;
window.openCollegeConfigModal = openCollegeConfigModal;
window.openDepartmentConfigModal = openDepartmentConfigModal;
