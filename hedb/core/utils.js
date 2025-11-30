// core/utils.js

/**
 * 彈出通用的訊息或確認/提示 Modal
 * @param {string} type - 'success', 'error', 'info', 'confirm', 'prompt'
 * @param {string} title - Modal 標題
 * @param {string} desc - Modal 描述內容
 * @param {object | null} inputConfig - 配置 prompt 模式下的輸入框
 * @param {Function | null} onConfirm - 確認按鈕的回調函數
 */
export function showMsg(type, title, desc, inputConfig = null, onConfirm = null) {
    const modal = document.getElementById('msg-modal'), 
          icon = document.getElementById('msg-icon'), 
          btns = document.getElementById('msg-btns'), 
          inputArea = document.getElementById('msg-input-area');
    
    // --- 確保清理動態輸入 ---
    cleanupDynamicInputs();
    // --- 確保清理動態輸入 ---

    document.getElementById('msg-title').innerText = title; 
    document.getElementById('msg-desc').innerText = desc;
    inputArea.classList.add('hidden'); 
    
    let iconClass = '', iconHtml = '';
    if(type === 'success') { iconClass = 'bg-emerald-100 text-emerald-600'; iconHtml = '<i class="fas fa-check"></i>'; }
    else if(type === 'error') { iconClass = 'bg-red-100 text-red-600'; iconHtml = '<i class="fas fa-times"></i>'; }
    else if(type === 'info') { iconClass = 'bg-blue-100 text-blue-600'; iconHtml = '<i class="fas fa-info"></i>'; }
    else if(type === 'confirm' || type === 'prompt') { iconClass = 'bg-amber-100 text-amber-600'; iconHtml = '<i class="fas fa-question"></i>'; }
    
    icon.className = `w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl shadow-sm ${iconClass}`; 
    icon.innerHTML = iconHtml;
    
    if(type === 'prompt' && inputConfig) { 
        inputArea.classList.remove('hidden'); 
        
        // Primary input (already exists in HTML)
        const inp = document.getElementById('msg-input'); 
        document.getElementById('msg-input-label').innerText = inputConfig.label || '名稱'; 
        inp.value = inputConfig.value || ''; 
        
        const inputContainer = document.getElementById('msg-input-area');
        
        // Helper function to inject fields
        const injectInput = (label, id, value, isMonospace = false) => {
            const inputHtml = `<div class="mt-3"><label class="block text-xs font-bold text-slate-400 uppercase mb-1">${label}</label><input type="text" id="${id}" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm ${isMonospace ? 'font-mono' : ''} focus:ring-2 focus:ring-primary outline-none text-slate-700" value="${value || ''}"></div>`;
            inputContainer.insertAdjacentHTML('beforeend', inputHtml);
        };

        // Handle Secondary input for Short Name/Code
        if(inputConfig.secondaryLabel) { injectInput(inputConfig.secondaryLabel, 'msg-secondary-input', inputConfig.secondaryValue); }
        // Handle Tertiary input for ID
        if(inputConfig.tertiaryLabel) { injectInput(inputConfig.tertiaryLabel, 'msg-tertiary-input', inputConfig.tertiaryValue, true); }
        // Handle Fourth input for Code
        if(inputConfig.fourthLabel) { injectInput(inputConfig.fourthLabel, 'msg-fourth-input', inputConfig.fourthValue); }

        if(inputConfig.showSelect) { 
            const selectAreaHtml = `<div id="msg-select-area" class="mt-3"><label class="block text-xs font-bold text-slate-400 uppercase mb-1">複製來源</label><select id="msg-select" class="w-full border border-slate-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-primary outline-none"></select></div>`;
            inputContainer.insertAdjacentHTML('beforeend', selectAreaHtml);
            const sel = document.getElementById('msg-select'); 
            sel.innerHTML = '<option value="">不複製 (空白)</option>'; 
            window.configData.academicYears.forEach(y => sel.innerHTML += `<option value="${y.year}">複製 ${y.year}</option>`); 
        } 
        setTimeout(() => inp.focus(), 50); 
    }
    
    btns.innerHTML = '';
    const cancelBtn = document.createElement('button'); 
    cancelBtn.className = 'px-5 py-2.5 rounded-lg border border-slate-300 font-bold text-slate-600 hover:bg-slate-50 transition text-sm'; 
    cancelBtn.innerText = type === 'success' || type === 'info' ? '關閉' : '取消'; 
    cancelBtn.onclick = () => { modal.classList.add('hidden'); modal.classList.remove('opacity-100'); }; 
    btns.appendChild(cancelBtn);
    
    if(type === 'confirm' || type === 'prompt') { 
        const okBtn = document.createElement('button'); 
        okBtn.className = `px-5 py-2.5 rounded-lg font-bold text-white shadow-md transition text-sm ${type==='prompt' ? 'bg-primary' : 'bg-danger'}`; 
        okBtn.innerText = '確認'; 
        okBtn.onclick = async () => { 
            modal.classList.add('hidden'); modal.classList.remove('opacity-100'); 
            if(onConfirm) { 
                const primaryValue = document.getElementById('msg-input').value.trim();
                const secondaryValue = document.getElementById('msg-secondary-input')?.value.trim();
                const tertiaryValue = document.getElementById('msg-tertiary-input')?.value.trim();
                const fourthValue = document.getElementById('msg-fourth-input')?.value.trim();
                const selectValue = document.getElementById('msg-select')?.value;
                
                if(type === 'prompt') await onConfirm(primaryValue, secondaryValue, tertiaryValue, fourthValue, selectValue); 
                else await onConfirm(); 
            } 
        }; 
        btns.appendChild(okBtn); 
    }
    
    modal.classList.remove('hidden'); 
    setTimeout(() => { 
        modal.classList.add('opacity-100'); 
        document.getElementById('msg-panel').classList.remove('scale-95'); 
        document.getElementById('msg-panel').classList.add('scale-100'); 
    }, 10);
}


/**
 * 刪除動態輸入框，防止 Modal 重複渲染問題 (Q3)
 */
export function cleanupDynamicInputs() {
    const inputArea = document.getElementById('msg-input-area');
    if (inputArea) {
        // 移除動態添加的所有 div (從第三個子元素開始，因為前兩個是主輸入框及其標籤)
        const childrenToKeep = 2;
        while (inputArea.children.length > childrenToKeep) {
            inputArea.lastChild.remove();
        }
    }
}

/**
 * 更新批次操作計數器顯示
 * @param {string} type - 'global' 或 'year'
 */
export function updateBatchControlVisibility(type) {
    const checkboxClass = type === 'global' ? '.global-check' : '.year-check';
    const controlContainer = document.getElementById(type + '-batch-controls');
    const countSpan = document.getElementById(type + '-batch-count');
    const checkedCount = document.querySelectorAll(checkboxClass + ':checked').length;

    if (checkedCount > 0) {
        controlContainer.classList.remove('hidden');
        if (countSpan) countSpan.innerText = checkedCount;
    } else {
        controlContainer.classList.add('hidden');
    }
}

/**
 * 取得 acadamic year 的字串 (用於 Dept/College 名稱查找)
 * @returns {string} 當前有效的學年度字串
 */
export function getCurrentActiveYear() {
    return window.activeYearId || (window.configData.academicYears.find(y => y.isDefault)?.year || 'current');
}
