// core/api.js

/**
 * GitHub API 存取配置
 */
window.ghConfig = window.ghConfig || {};

/**
 * 遠端讀取 GitHub 檔案內容
 * @param {string} path - 檔案路徑
 * @returns {Promise<{status: number, data: any, sha?: string}>}
 */
export async function apiFetch(path) {
    const token = window.sessionStorage.getItem('gh_token') || window.ghConfig.token;
    if (!token) throw new Error("Missing GitHub token.");

    const url = `https://api.github.com/repos/${window.ghConfig.user}/${window.ghConfig.repo}/contents/${path}?t=${Date.now()}`;
    
    const headers = {
        'Authorization': `token ${token}`,
        'Accept': 'application/vnd.github.v3+json'
    };
    
    let r;
    try {
        r = await fetch(url, { headers: headers, cache: 'no-store' });
    } catch (networkError) {
        throw new Error(`網路連線錯誤: ${networkError.message}`);
    }

    if (!r.ok) {
        let errorMsg = `HTTP 錯誤碼: ${r.status}`;
        if (r.status === 401) throw new Error("認證失敗: Access Token 錯誤或權限不足");
        if (r.status === 404) return { status: 404 };
        if (r.status === 403) throw new Error("禁止訪問: 權限不足或超出速率限制");
        throw new Error(errorMsg);
    }

    const d = await r.json();

    if (Array.isArray(d)) {
        return { status: 200, data: d };
    }

    if (d.content) {
        try {
            const c = decodeURIComponent(escape(window.atob(d.content.replace(/\n/g, ""))));
            return { status: 200, data: JSON.parse(c), sha: d.sha };
        } catch (decodeError) {
            // If JSON parsing fails, return raw content for debugging/code editing
            const c = decodeURIComponent(escape(window.atob(d.content.replace(/\n/g, ""))));
            return { status: 200, data: c, sha: d.sha, isRaw: true };
        }
    }
    
    return { status: 200, data: d, sha: d.sha };
}

/**
 * 上傳檔案至 GitHub
 * @param {string} path - 檔案路徑
 * @param {object | string} data - 要上傳的資料 (如果是物件，會自動轉為 JSON 字串)
 * @param {string | null} sha - 檔案現有的 SHA，用於更新
 * @returns {Promise<string>} 新檔案的 SHA
 */
export async function uploadFile(path, data, sha) {
    const content = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    const bodyContent = btoa(unescape(encodeURIComponent(content)));

    const body = {
        message: `Update ${path}`,
        content: bodyContent,
        branch: 'main'
    };
    if (sha) body.sha = sha;

    const r = await fetch(`https://api.github.com/repos/${window.ghConfig.user}/${window.ghConfig.repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
            'Authorization': `token ${window.ghConfig.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (!r.ok) throw new Error(`上傳檔案失敗 (${path})：${r.statusText}`);
    const d = await r.json();
    return d.content.sha;
}

/**
 * 刪除 GitHub 檔案
 * @param {string} path - 檔案路徑
 * @param {string} sha - 檔案現有的 SHA
 * @returns {Promise<void>}
 */
export async function deleteFile(path, sha) {
    const r = await fetch(`https://api.github.com/repos/${window.ghConfig.user}/${window.ghConfig.repo}/contents/${path}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `token ${window.ghConfig.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: `Delete ${path}`, sha: sha, branch: 'main' })
    });
    if (!r.ok) throw new Error(`刪除檔案失敗 (${path})：${r.statusText}`);
}
