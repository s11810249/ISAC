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
    const btn = document.getElementById('btn-connect'), msg = document.getElementById('login-msg');
    const user = document.getElementById('gh-user').value.trim();
    const repo = document.getElementById('gh-repo').value.trim();
    const token = document.getElementById('gh-token').value.trim();

    if (!user || !repo || !token) { 
        msg.style.opacity = '1'; 
        msg.innerText = '請填寫完整資訊 (Username, Repository, Token)'; 
        return; 
    }

    btn.innerHTML = '<div class="spinner"></div> 連線中...'; 
    btn.disabled = true;
    msg.style.opacity = '0';
    
    window.ghConfig = { user, repo, path: DATA_FILE, token };

    try {
        const res = await apiFetch(window.ghConfig.path);

        if(res.status === 404) { 
            window.configData = { 
                globalFields: [], 
                academicYears: [], 
                templateCategories: [], 
                fieldTypes: [], 
                addressRules: { protected: [], keywords: [], specials: [] }, 
                allianceModeDepts: {}
            }; 
            window.configSha = null; 
        } else if (res.status === 200) { 
            window.configData = res.data; 
            window.configSha = res.sha; 
            
            if(!window.configData.templateCategories) window.configData.templateCategories = []; 
            if(!window.configData.fieldTypes) window.configData.fieldTypes = []; 
            if(!window.configData.addressRules) window.configData.addressRules = { protected: ['五權', '三民', '三多', '一心', '二聖', '七賢', '八德', '九如', '十全'], keywords: ['段', '路', '街', '巷', '弄', '號', '樓', '鄰', '之'], specials: ['東', '南', '西', '北', '區', '道'] };
            
            window.configData.allianceModeDepts = {}; 

            const uniqueTypes = new Map(); 
            [...SYSTEM_DEFAULT_TYPES, ...window.configData.fieldTypes].forEach(t => uniqueTypes.set(t.key, t)); 
            window.configData.fieldTypes = Array.from(uniqueTypes.values()); 
        } else {
            throw new Error(`GitHub API 錯誤碼: ${res.status}`);
        }
        
        SYSTEM_CATEGORY_DEFS.forEach(sysCat => {
            const existingCat = window.configData.templateCategories.find(c => c.id === sysCat.id);
            if (!existingCat) { window.configData.templateCategories.push(sysCat); } 
            else { existingCat.name = sysCat.name; existingCat.isLocked = true; }
        });
        window.configData.templateCategories.forEach((c, i) => { if (c.order === undefined) c.order = i; });

        localStorage.setItem('gh_creds_safe', JSON.stringify({ user, repo })); 
        sessionStorage.setItem('gh_token', token);
        
        // 2. Fetch Dept Master Data
        try {
            const deptMasterRes = await apiFetch(DEPT_MASTER_PATH);
            window.deptMasterData = deptMasterRes.status === 200 ? deptMasterRes.data : {};
            window.deptMasterSha = deptMasterRes.sha || null;
        } catch(e) { console.error("Failed to load department master data:", e); window.deptMasterData = {}; window.deptMasterSha = null; }
        
        // 3. Fetch Dept Grouping Data
        try {
            const deptRes = await apiFetch(DEPT_DATA_PATH);
            window.departmentData = deptRes.status === 200 ? (Array.isArray(deptRes.data) ? deptRes.data : []) : [];
            window.departmentData = window.departmentData.map(c => ({
                ...c,
                id: c.id || ('col_' + Date.now() + Math.random()),
                departments: Array.isArray(c.departments) ? c.departments : [],
                historical_names: c.historical_names || {} // Q2: 初始化學院的歷史名稱
            }));
            window.deptDataSha = deptRes.sha || null;
        } catch(e) { console.error("Failed to load department data:", e); window.departmentData = []; window.deptDataSha = null; }

        // UI Initialization
        document.getElementById('login-screen').classList.add('hidden'); 
        document.getElementById('admin-interface').classList.remove('hidden'); 
        document.getElementById('admin-interface').style.opacity = '1';
        
        await syncYearsFromFiles(); 
        renderYearList(); 
        if(window.configData.academicYears.length > 0) selectYear(window.configData.academicYears[0].year); 
        renderTemplateCats(); 
        renderTypeManagerPage(); 
        renderInternshipView(); 
        renderDepartmentView(); 
        
    } catch (err) { 
        console.error("Login Error:", err); 
        msg.style.opacity = '1'; 
        msg.innerText = err.message.includes('401') ? '登入失敗：Access Token 錯誤或權限不足' : `連線失敗 (詳情請看 Console) - ${err.message || '未知錯誤'}`;
        
    } finally { 
        btn.innerHTML = '<span>登入系統</span><i class="fas fa-arrow-right"></i>';
        btn.disabled = false; 
    }
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
async function syncYearsFromFiles() { 
    try { 
        const dirRes = await apiFetch(`${YEAR_TEMPLATES_BASE_PATH}`); 
        if(dirRes.status !== 200 || !Array.isArray(dirRes.data)) return; 
        
        const fileYears = dirRes.data
            .filter(f => f.name.match(/^year_(.+)_templates\.json$/))
            .map(f => f.name.match(/^year_(.+)_templates\.json$/)[1]); 
            
        let changed = false; 
        
        fileYears.forEach(y => { 
            if(!window.configData.academicYears.some(cy => cy.year === y)) { 
                window.configData.academicYears.push({ year: y, isDefault: false }); 
                changed = true; 
            } 
        }); 
        
        if(changed) { 
            window.configData.academicYears.sort((a,b) => b.year.localeCompare(a.year)); 
            setUnsaved(true); 
            // Don't show msg here, wait for initial load completion
        } 
    } catch(e) {
        console.error("Failed to sync year files:", e);
    } 
}

export async function selectYear(year) {
    window.activeYearId = year; 
    renderYearList(); 
    document.getElementById('current-year-title').innerText = `${year} 學年度`; 
    
    const yConf = window.configData.academicYears.find(y => y.year === year); 
    document.getElementById('is-default-year').checked = yConf.isDefault || false; 
    document.getElementById('default-badge').classList.toggle('hidden', !yConf.isDefault); 
    
    document.getElementById('year-empty-state').classList.add('hidden'); 
    document.getElementById('year-config-panel').classList.remove('hidden'); 
    document.getElementById('year-config-panel').classList.add('flex'); 
    
    // UI Update
    updateYearFilterOptions(); 
    document.getElementById('year-filter-cat').value = 'all'; 
    document.getElementById('year-field-list').innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400"><div class="spinner border-slate-300 border-t-primary mx-auto mb-2"></div>讀取設定中...</td></tr>`; 
    
    try { 
        const res = await apiFetch(`${YEAR_TEMPLATES_BASE_PATH}/year_${year}_templates.json`); 
        window.yearTemplateData = res.status===404 ? {fields:[]} : res.data; 
        
        // Ensure alliance data exists for the selected module (Q2)
        if (!window.yearTemplateData.allianceModeDepts) { 
            window.yearTemplateData.allianceModeDepts = { groups: [], groupingBasis: 'course_dept', unmatchedHandling: 'use_primary' }; 
            setUnsaved(true); // Mark unsaved if we had to initialize it
        } 
        
        renderYearFields(); 
    } catch(e) { 
        document.getElementById('year-field-list').innerHTML = `<tr><td colspan="7" class="p-4 text-red-500 text-center">讀取失敗: ${e.message}</td></tr>`; 
    } 
}

// --- 欄位模板庫邏輯 (大部分邏輯相同，省略) ---
export function renderGlobalList() {
    // ... (實作)
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
    if (window.departmentData.length > 0 && !window.activeCollegeId) {
        window.activeCollegeId = window.departmentData[0].id;
    }
    renderCollegeList();
    if (window.activeCollegeId) {
        selectCollege(window.activeCollegeId);
    } else {
        document.getElementById('dept-config-panel').classList.add('hidden');
        document.getElementById('dept-empty-state').classList.remove('hidden');
    }
}

export function renderCollegeList() {
    const el = document.getElementById('college-list');
    el.innerHTML = '';
    window.departmentData.forEach((c, idx) => {
        const isActive = window.activeCollegeId === c.id;
        const div = document.createElement('div');
        div.className = `list-item group ${isActive ? 'active' : ''}`; 
        div.onclick = () => selectCollege(c.id);
        
        const displayName = getCollegeDisplayName(c.id, true);
        const collegeCode = c.code || '-';
        const idDisplay = `ID: ${c.id}`; 

        const codeBadge = `<span class="code-badge">${collegeCode}</span>`;
        
        const moveControls = `<div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition duration-150 ${isActive ? '!opacity-100' : ''}">
                <button onclick="moveCollege(${idx},-1); event.stopPropagation();" class="text-slate-400 hover:text-primary p-1.5 rounded-lg transition" title="上移"><i class="fas fa-arrow-up text-xs"></i></button>
                <button onclick="moveCollege(${idx},1); event.stopPropagation();" class="text-slate-400 hover:text-primary p-1.5 rounded-lg transition" title="下移"><i class="fas fa-arrow-down text-xs"></i></button>
            </div>`;

        div.innerHTML = `<div class="flex items-center justify-between w-full">
                            <div class="flex items-center gap-2">
                                ${codeBadge}
                                <div class="flex flex-col items-start">
                                    <span class="font-bold text-sm truncate">${displayName}</span>
                                    <span class="text-[10px] text-slate-400 font-mono block">${idDisplay}</span>
                                </div>
                            </div>
                            ${moveControls}
                        </div>`;
        el.appendChild(div);
    });
}

export function selectCollege(id) {
    window.activeCollegeId = id;
    renderCollegeList();
    const college = window.departmentData.find(c => c.id === id);
    if (college) {
        document.getElementById('current-college-title').innerText = getCollegeDisplayName(college.id, false);
        document.getElementById('dept-empty-state').classList.add('hidden');
        document.getElementById('dept-config-panel').classList.remove('hidden');
        document.getElementById('dept-config-panel').classList.add('flex');
        renderDepartmentList();
    }
}

export function renderDepartmentList() {
    const listEl = document.getElementById('department-list-body');
    listEl.innerHTML = '';
    const college = window.departmentData.find(c => c.id === window.activeCollegeId);
    if (!college || !college.departments) return;

    college.departments.forEach((deptId, idx) => {
        const master = window.deptMasterData[deptId] || {};
        
        const deptFullName = getDeptDisplayName(deptId, false, window.activeYearId); 
        const deptDisplayName = getDeptDisplayName(deptId, true); 
        
        const deptCode = master.code || '-';

        const actionBtns = `<button onclick="openDepartmentConfigModal('${deptId}')" class="p-1 hover:bg-slate-200 rounded text-slate-400" title="編輯"><i class="fas fa-pen"></i></button><button onclick="removeDepartment('${deptId}')" class="p-1 hover:bg-red-100 rounded text-slate-400 text-danger" title="移除分組"><i class="fas fa-trash-alt"></i></button>`;
        const moveBtns = `<button onclick="moveDepartment('${deptId}', -1)" class="p-1 hover:bg-slate-200 rounded text-slate-400" title="上移"><i class="fas fa-arrow-up"></i></button><button onclick="moveDepartment('${deptId}', 1)" class="p-1 hover:bg-slate-200 rounded text-slate-400" title="下移"><i class="fas fa-arrow-down"></i></button>`;

        listEl.innerHTML += `<tr class="hover:bg-slate-50 border-b border-slate-100 transition group">
            <td class="w-16 text-center font-mono text-xs text-slate-400 py-3">${idx+1}</td>
            <td class="w-1/2 text-left font-bold text-slate-700 text-sm py-3">
                <div class="flex flex-col items-start justify-center h-full gap-0.5">
                    <span>${deptDisplayName} (${deptFullName})</span>
                    <span class="text-[10px] text-slate-400 font-mono block">${deptId} / CODE: ${deptCode}</span>
                </div>
            </td>
            <td class="w-40 text-center py-3">
                <div class="action-cell-content gap-1 opacity-0 group-hover:opacity-100 transition duration-150">${moveBtns}${actionBtns}</div>
            </td>
        </tr>`;
    });

    if(listEl.innerHTML === '') listEl.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-slate-400">尚未新增系所</td></tr>';
}

export function openCollegeConfigModal(id = null) {
    const isEdit = !!id;
    const college = isEdit ? window.departmentData.find(c => c.id === id) : { id: '', departments: [], historical_names: {} };
    
    window.editingDeptEntityType = 'college';
    document.getElementById('dept-editor-title').innerText = isEdit ? `編輯學院配置：${getCollegeDisplayName(id, false)}` : '新增學院配置';
    
    // Left Panel Setup
    document.getElementById('ed-dept-name-label').innerText = '學院名稱 (全稱) *';
    document.getElementById('ed-dept-name').value = college.name || '';
    document.getElementById('ed-dept-shortname').value = college.short_name || '';
    document.getElementById('ed-dept-id').value = college.id || '';
    document.getElementById('ed-dept-id-display').value = college.id || '請輸入 ID';
    document.getElementById('ed-dept-id-display').readOnly = isEdit;
    document.getElementById('ed-dept-code').value = college.code || '';
    
    // Hide Affiliated College Box for College entity
    document.getElementById('ed-affiliated-college-box').classList.add('hidden');
    
    // Right Panel Control (Q2: 學院歷史名稱)
    document.getElementById('dept-year-name-panel').classList.remove('hidden');
    renderCollegeHistoricalNameEditor(college.id, college.historical_names || {});
    
    document.getElementById('dept-editor-modal').classList.remove('hidden');
}

// Q2: Renders the historical name editing panel for College
function renderCollegeHistoricalNameEditor(colId, historicalNames) {
    const container = document.getElementById('year-name-list');
    const years = window.configData.academicYears.map(y => y.year).sort((a, b) => b - a);
    
    let html = '';
    let defaultName = window.departmentData.find(c => c.id === colId)?.name || '';

    years.forEach(year => {
        const name = historicalNames[year] || '';
        const placeholder = defaultName || '（同基礎名稱）';
        
        const copyOptions = years.filter(y => y !== year).map(y => 
            `<option value="${y}">${y}學年</option>`
        ).join('');
        
        html += `
            <div class="p-3 border border-slate-200 rounded-lg bg-white shadow-sm hist-editor-item">
                <span class="font-bold text-sm text-slate-700">${year}</span>
                <input type="text" 
                       data-year="${year}" 
                       value="${name}" 
                       class="col-span-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-primary outline-none hist-name-input" 
                       placeholder="${placeholder}">
                <div class="flex items-center gap-1 justify-end">
                    <select id="col-copy-from-${year}" class="text-xs border border-slate-300 rounded p-1 w-20" title="複製名稱自...">
                        <option value="">複製自...</option>
                        ${copyOptions}
                    </select>
                    <button onclick="copyCollegeYearName('${colId}', document.getElementById('col-copy-from-${year}').value, '${year}')" class="text-xs bg-primary hover:bg-[#001e3d] text-white px-2 py-1 rounded shadow-sm transition">複製</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

// Q2: Logic to copy historical name (學院)
window.copyCollegeYearName = function(colId, sourceYear, targetYear) {
    if (!sourceYear || sourceYear === targetYear) return;
    const college = window.departmentData.find(c => c.id === colId);
    if (!college) return;

    const sourceName = college.historical_names?.[sourceYear] || college.name;
    if (sourceName) {
        document.querySelector(`#year-name-list input[data-year="${targetYear}"]`).value = sourceName;
    }
}

export function saveCollegeConfig() {
    const id = document.getElementById('ed-dept-id').value.trim();
    const name = document.getElementById('ed-dept-name').value.trim();
    const shortName = document.getElementById('ed-dept-shortname').value.trim();
    const code = document.getElementById('ed-dept-code').value.trim();
    
    if (!name || !id) { return showMsg('error', '儲存失敗', '名稱和 ID 為必填'); }
    
    const isNew = !window.departmentData.find(c => c.id === id);
    if (isNew && window.departmentData.some(c => c.id === id)) return showMsg('error', '錯誤', '學院 ID 已存在');

    const historicalNames = {};
    document.querySelectorAll('#year-name-list input[data-year]').forEach(input => {
        const year = input.dataset.year;
        const histName = input.value.trim();
        if (histName) historicalNames[year] = histName;
    });
    
    const newCollegeData = {
        id: id,
        name: name, // Full name used as the primary display/export name for College in config
        short_name: shortName,
        code: code,
        departments: isNew ? [] : (window.departmentData.find(c => c.id === id)?.departments || []),
        historical_names: historicalNames
    };
    
    if (isNew) {
        window.departmentData.push(newCollegeData);
        selectCollege(id);
    } else {
        const existingCollege = window.departmentData.find(c => c.id === id);
        if (existingCollege) Object.assign(existingCollege, newCollegeData);
    }
    
    setUnsaved(true);
    renderCollegeList();
    document.getElementById('dept-editor-modal').classList.add('hidden');
    document.getElementById('current-college-title').innerText = getCollegeDisplayName(id, false);
    showMsg('success', '儲存成功', '學院設定已暫存。');
}

export function deleteCurrentCollege() {
    showMsg('confirm', '確認刪除學院？', '這將刪除此學院及其下的所有系所分組關係，無法復原。請先確認該學院下的所有系所是否已移出。', null, () => {
        window.departmentData = window.departmentData.filter(c => c.id !== window.activeCollegeId);
        window.activeCollegeId = null;
        renderDepartmentView();
        setUnsaved(true);
        showMsg('success', '成功', '學院已刪除');
    });
}

// Q1: Function to copy the name of the general input to all year inputs
window.copyAllYearNames = function() {
    let sourceName = document.getElementById('ed-dept-name').value.trim();
    if (!sourceName) {
         showMsg('info', '無來源名稱', '請先在左側填寫「全稱/當前學年名稱」作為複製來源。');
         return;
    }
    
    document.querySelectorAll('#year-name-list input[data-year]').forEach(input => {
        input.value = sourceName;
    });
    showMsg('success', '複製成功', '當前名稱已複製到所有學年度輸入框。');
}


export function openDepartmentConfigModal(id = null) {
    const isEdit = !!id;
    const master = isEdit ? window.deptMasterData[id] || { historical_names: {} } : { historical_names: {} };
    const college = window.departmentData.find(c => c.id === window.activeCollegeId);
    if (!college) return showMsg('error', '錯誤', '請先選擇或新增一個學院。');
    
    window.editingDeptEntityType = 'department';
    document.getElementById('dept-editor-title').innerText = isEdit ? `編輯系所配置：${getDeptDisplayName(id, false)}` : '新增系所配置';
    
    // Left Panel Setup
    const currentYear = getCurrentActiveYear();
    const currentYearName = isEdit ? getDeptFullName(id, currentYear) : '';
    
    document.getElementById('ed-dept-name-label').innerText = `系所全稱 (${currentYear}學年名稱) *`;
    document.getElementById('ed-dept-name').value = currentYearName || master.name || '';
    document.getElementById('ed-dept-shortname').value = master.short_name || '';
    
    const idInput = document.getElementById('ed-dept-id');
    idInput.value = isEdit ? id : '';
    document.getElementById('ed-dept-id-display').value = isEdit ? id : '請輸入 ID';
    idInput.readOnly = isEdit; 
    
    document.getElementById('ed-dept-code').value = master.code || '';
    
    // Show Affiliated College Box
    document.getElementById('ed-affiliated-college-box').classList.remove('hidden');
    document.getElementById('ed-dept-college-name').value = getCollegeDisplayName(window.activeCollegeId, false);
    
    // Right Panel Control: Departments have year-specific names.
    document.getElementById('dept-year-name-panel').classList.remove('hidden');
    renderHistoricalNameEditor(id, master.historical_names || {});
    
    document.getElementById('dept-editor-modal').classList.remove('hidden');
}

// NEW: Renders the historical name editing panel (系所)
function renderHistoricalNameEditor(deptId, historicalNames) {
    const container = document.getElementById('year-name-list');
    const years = window.configData.academicYears.map(y => y.year).sort((a, b) => b - a);
    
    let html = '';
    let defaultName = window.deptMasterData[deptId]?.name || '';

    years.forEach(year => {
        const name = historicalNames[year] || '';
        const placeholder = defaultName || '（同基礎名稱）';
        
        const copyOptions = years.filter(y => y !== year).map(y => 
            `<option value="${y}">${y}學年</option>`
        ).join('');
        
        html += `
            <div class="p-3 border border-slate-200 rounded-lg bg-white shadow-sm hist-editor-item">
                <span class="font-bold text-sm text-slate-700">${year}</span>
                <input type="text" 
                       data-year="${year}" 
                       value="${name}" 
                       class="col-span-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-primary outline-none hist-name-input" 
                       placeholder="${placeholder}">
                <div class="flex items-center gap-1 justify-end">
                    <select id="copy-from-${year}" class="text-xs border border-slate-300 rounded p-1 w-20" title="複製名稱自...">
                        <option value="">複製自...</option>
                        ${copyOptions}
                    </select>
                    <button onclick="copyYearName('${deptId}', document.getElementById('copy-from-${year}').value, '${year}')" class="text-xs bg-primary hover:bg-[#001e3d] text-white px-2 py-1 rounded shadow-sm transition">複製</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

export function saveDepartmentConfig() {
    const id = document.getElementById('ed-dept-id').value.trim();
    const name = document.getElementById('ed-dept-name').value.trim();
    const shortName = document.getElementById('ed-dept-shortname').value.trim();
    const code = document.getElementById('ed-dept-code').value.trim();
    
    if (!name || !id) { return showMsg('error', '儲存失敗', '全稱和 ID 為必填項目。'); }
    const isNew = !window.deptMasterData[id];
    if (isNew && window.deptMasterData[id]) { return showMsg('error', '錯誤', '系所 ID 已存在於總表。'); }

    // 1. Collect Historical Names
    const historicalNames = {};
    document.querySelectorAll('#year-name-list input[data-year]').forEach(input => {
        const year = input.dataset.year;
        const yearName = input.value.trim();
        if (yearName) historicalNames[year] = yearName;
    });
    
    // Fallback name is the name in the latest historical record, or the name in the left panel
    const latestYear = Object.keys(historicalNames).sort((a,b) => b - a)[0];
    const currentFullName = latestYear ? historicalNames[latestYear] : name;
    
    if (!currentFullName) {
        return showMsg('error', '錯誤', `請為任一學年度設定一個完整的系所名稱作為基礎名稱。`);
    }

    // 2. Update Dept Master Data
    let newMasterEntry = window.deptMasterData[id] || { historical_names: {} };
    newMasterEntry.code = code || id;
    newMasterEntry.short_name = shortName;
    newMasterEntry.name = currentFullName; 
    newMasterEntry.historical_names = historicalNames;
    
    window.deptMasterData[id] = newMasterEntry;

    // 3. Update College Grouping Data (only if new)
    if (isNew) {
        const college = window.departmentData.find(c => c.id === window.activeCollegeId);
        if (college && !college.departments.includes(id)) {
             college.departments.push(id);
        } else if (!college) {
             return showMsg('error', '錯誤', '無法找到所屬學院');
        }
    }

    setUnsaved(true);
    renderDepartmentList();
    document.getElementById('dept-editor-modal').classList.add('hidden');
    showMsg('success', '儲存成功', `系所 [${currentFullName}] 設定已暫存。`);
}

export function removeDepartment(id) {
    const college = window.departmentData.find(c => c.id === window.activeCollegeId);
    if (!college) return;

    showMsg('confirm', '確認移除系所？', '確定要從此學院分組中移除此系所嗎？它將不再顯示於此列表中，但其主資料仍會保留在系統中。', null, () => {
        college.departments = college.departments.filter(dId => dId !== id);
        renderDepartmentList();
        setUnsaved(true);
        showMsg('success', '成功', '系所已從學院中移除');
    });
}

// --- 檔案儲存邏輯 ---
export async function saveAll() {
    const btn=document.getElementById('btn-save');btn.disabled=true;btn.innerHTML='<div class="spinner"></div>';
    try { 
        let deptDataChanged = window.unsavedChanges;
        
        // 1. Save Main Config
        window.configSha = await uploadFile(window.ghConfig.path, window.configData, window.configSha); 
        
        // 2. Save Dept Master Data
        if (deptDataChanged) { 
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
    // 實作：確保介面內容初始化
    const selectEl = document.getElementById('consolidation-year-select');
    selectEl.innerHTML = window.configData.academicYears.map(y => `<option value="${y.year}">${y.year} 學年度模組</option>`).join(''); 
    
    window.currentSelectedGroup = null; 

    if (window.configData.academicYears.length > 0) {
        window.currentConsolidationYear = selectEl.value;
        // 僅載入 fields，不觸發 mapping
        fetchCurrentTemplateFields(); 
    } 

    document.getElementById('current-internship-group-title').innerText = '實習學生名單彙整';
    document.getElementById('group-detail-subtitle').innerText = '請上傳名單並進行匹配';
    document.getElementById('results-table-container').classList.add('hidden');
    document.getElementById('results-empty-state').classList.remove('hidden');
    document.getElementById('btn-batch-download-all-results-main').classList.add('hidden');
    document.getElementById('btn-reopen-mapping').classList.add('hidden');
    
    // 渲染側邊欄清單
    document.getElementById('internship-group-list').innerHTML = '<div class="list-item active" id="group-all-item" onclick="selectConsolidatedGroup(\'all\')"><span class="font-bold text-sm">全部</span></div>' + 
                                                                 '<div class="p-8 text-center text-slate-400 text-xs" id="group-list-empty-state">無可彙整名單</div>';
    document.getElementById('group-all-item').classList.add('active');
}

// --- 欄位類型管理邏輯 ---
export function renderTypeManagerPage() {
    const el=document.getElementById('type-list-page');
    el.innerHTML='';
    window.configData.fieldTypes.forEach(t=>el.innerHTML+=`<tr class="hover:bg-slate-50"><td class="px-6 py-3 font-mono text-xs text-primary font-bold">${t.key}</td><td class="px-6 py-3 text-xs font-bold">${t.label}</td><td class="px-6 py-3 text-right"><button onclick="editCustomTypePage('${t.key}')" class="text-slate-300 hover:text-primary mr-2"><i class="fas fa-pen"></i></button><button onclick="delCustomTypePage('${t.key}')" class="text-slate-300 hover:text-danger"><i class="fas fa-trash-alt"></i></button></td></tr>`);
}

// --- 初始化入口 ---
window.onload = function() {
    // 綁定全局函數 (方便 HTML 內聯調用)
    window.connectGitHub = connectGitHub;
    window.saveAll = saveAll;
    window.switchView = switchView;
    window.logout = function() { showMsg('confirm', '確定登出？', '未儲存的變更將會遺失。', null, () => { localStorage.removeItem('gh_creds_safe'); sessionStorage.removeItem('gh_token'); location.reload(); }); };
    
    // 綁定頁面跳轉 (Q1 Fix)
    window.openCollegeConfigModal = openCollegeConfigModal;
    window.openDepartmentConfigModal = openDepartmentConfigModal;
    
    // 執行初始載入
    const saved = localStorage.getItem('gh_creds_safe');
    if(saved) { 
        const c = JSON.parse(saved); 
        document.getElementById('gh-user').value = c.user || ''; 
        document.getElementById('gh-repo').value = c.repo || ''; 
    }
};
