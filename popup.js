document.addEventListener('DOMContentLoaded', () => {

    const PROGRESS_KEY = 'progressByTab';

    const RUNNING_LOCK_MAX_AGE_MS = 2 * 60 * 1000;

    const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

    const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
    const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));

    const getActiveTab = () => new Promise((resolve) => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => resolve(tabs && tabs[0] ? tabs[0] : null));
    });


    function getShanghaiTimeText() {
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
                hour12: false
            }).format(new Date());
        } catch (e) {
            return new Date().toLocaleString();
        }
    }

    async function readProgressForTab(tabId) {
        const res = await storageGet([PROGRESS_KEY]);
        const map = res[PROGRESS_KEY] || {};
        const key = String(tabId ?? 'global');
        return map[key] || null;
    }

    async function writeProgressForTab(tabId, progress) {
        const res = await storageGet([PROGRESS_KEY]);
        const map = res[PROGRESS_KEY] || {};
        const key = String(tabId ?? 'global');
        map[key] = {
            ...(map[key] || {}),
            ...(progress || {}),
            updatedAt: Date.now()
        };
        await storageSet({ [PROGRESS_KEY]: map });
    }

    const progArea = document.getElementById('progress-area');
    const progFill = document.getElementById('prog-fill');
    const statusText = document.getElementById('status-text');

    const exportBtn = document.getElementById('start-btn');
    const wsInput = document.getElementById('workspace-id');
    const limitInput = document.getElementById('limit-count');
    const radioAll = document.querySelector('input[value="all"]');
    const radioRecent = document.querySelector('input[value="recent"]');
    const teamBox = document.getElementById('team-input-box');
    const exportTabs = document.querySelectorAll('#panel-export .tab');

    const backupToggle = document.getElementById('backup-toggle');
    const backupSettings = document.getElementById('backup-settings');
    const backupInterval = document.getElementById('backup-interval');
    const lastBackupTimeLabel = document.getElementById('last-backup-time'); // 上次备份时间显示

    const preventCloseToggle = document.getElementById('prevent-close-toggle');

    const importBtn = document.getElementById('import-btn');
    const fileInput = document.getElementById('file-input');
    const dropZone = document.getElementById('drop-zone');
    const mainTabs = document.querySelectorAll('#main-tabs .tab');
    const panels = document.querySelectorAll('.panel');

    let importFiles = [];

    const hasProgressUI = !!(progArea && progFill && statusText);

    function setProgressUI(percent, text) {
        if (!hasProgressUI) return;
        progArea.style.display = 'block';
        if (typeof percent === 'number') progFill.style.width = clamp(percent, 0, 100) + '%';
        if (typeof text === 'string') statusText.textContent = text;
    }

    async function persistProgress(partial) {
        const tab = await getActiveTab();
        const tabId = tab ? tab.id : null;
        await writeProgressForTab(tabId, partial);
    }


    chrome.storage.local.get([
        'backupEnabled',
        'backupInterval',
        'savedMode',
        'savedWorkspaceId',
        'lastAutoBackupAtShanghaiText',
        'preventCloseEnabled' 
    ], async (result) => {
        if (result.backupEnabled) {
            backupToggle.checked = true;
            backupSettings.classList.remove('hidden');
        } else {
            backupToggle.checked = false;
            backupSettings.classList.add('hidden');
        }

        if (result.backupInterval) backupInterval.value = result.backupInterval;

        if (result.savedWorkspaceId) wsInput.value = result.savedWorkspaceId;
        else detectWorkspaceId();

        exportTabs.forEach(t => t.classList.remove('active'));
        if (result.savedMode === 'team') {
            const teamTab = document.querySelector('[data-mode="team"]');
            if (teamTab) teamTab.classList.add('active');
            teamBox.classList.remove('hidden');
        } else {
            const personalTab = document.querySelector('[data-mode="personal"]');
            if (personalTab) personalTab.classList.add('active');
            teamBox.classList.add('hidden');
        }

        if (lastBackupTimeLabel) {
            if (result.lastAutoBackupAtShanghaiText) {
                lastBackupTimeLabel.textContent = result.lastAutoBackupAtShanghaiText;
            } else {
                lastBackupTimeLabel.textContent = "暂无记录";
            }
        }

        if (result.preventCloseEnabled) {
            preventCloseToggle.checked = true;
        } else {
            preventCloseToggle.checked = false;
        }

        await restoreProgressUI();
    });

    async function restoreProgressUI() {
        if (!hasProgressUI) return;

        const tab = await getActiveTab();
        const tabId = tab ? tab.id : null;

        const p = await readProgressForTab(tabId);
        if (!p) return;

        const percent = typeof p.percent === 'number' ? p.percent : 0;
        const text = typeof p.text === 'string' ? p.text : '';
        setProgressUI(percent, text);

        const age = typeof p.updatedAt === 'number' ? (Date.now() - p.updatedAt) : Number.POSITIVE_INFINITY;
        const running = !(p.done || p.error) && age <= RUNNING_LOCK_MAX_AGE_MS;

        if (running) {
            exportBtn.disabled = true;
            importBtn.disabled = true;
        } else {
            exportBtn.disabled = false;
            importBtn.disabled = importFiles.length === 0;
        }
    }

    function detectWorkspaceId() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('chat')) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_WORKSPACE_ID' }, (response) => {
                    if (response && response.workspaceId) wsInput.value = response.workspaceId;
                });
            }
        });
    }

    function getCurrentState() {
        const activeTab = document.querySelector('#panel-export .tab.active');
        return {
            enabled: backupToggle.checked,
            interval: parseInt(backupInterval.value),
            mode: activeTab ? activeTab.dataset.mode : 'personal',
            workspaceId: wsInput.value.trim()
        };
    }

    function saveSettings() {
        const state = getCurrentState();
        chrome.storage.local.set({
            backupEnabled: state.enabled,
            backupInterval: state.interval,
            savedMode: state.mode,
            savedWorkspaceId: state.workspaceId
        });
        chrome.runtime.sendMessage({ type: 'UPDATE_BACKUP_SETTINGS', payload: state });
    }

    backupToggle.onchange = () => {
        if (backupToggle.checked) backupSettings.classList.remove('hidden');
        else backupSettings.classList.add('hidden');
        saveSettings();
    };
    backupInterval.onchange = saveSettings;
    wsInput.oninput = saveSettings;

    preventCloseToggle.onchange = () => {
        const isEnabled = preventCloseToggle.checked;
        
        chrome.storage.local.set({ preventCloseEnabled: isEnabled });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    type: 'TOGGLE_PREVENT_CLOSE', 
                    enabled: isEnabled 
                });
            }
        });
    };

    mainTabs.forEach(t => t.onclick = () => {
        mainTabs.forEach(x => x.classList.remove('active'));
        panels.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        document.getElementById(t.dataset.target).classList.add('active');
    });

    exportTabs.forEach(t => t.onclick = () => {
        exportTabs.forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        if (t.dataset.mode === 'team') teamBox.classList.remove('hidden');
        else teamBox.classList.add('hidden');
        saveSettings();
    });

    const fmtBtns = document.querySelectorAll('.fmt-item');
    fmtBtns.forEach(btn => btn.onclick = () => btn.classList.toggle('active'));

    const toggleLimit = () => limitInput.disabled = radioAll.checked;
    radioAll.onchange = toggleLimit;
    radioRecent.onchange = toggleLimit;

    exportBtn.onclick = async () => {
        const state = getCurrentState();
        const formats = {
            json: document.getElementById('btn-json').classList.contains('active'),
            markdown: document.getElementById('btn-md').classList.contains('active'),
            html: document.getElementById('btn-html').classList.contains('active')
        };

        if (!Object.values(formats).includes(true)) return alert('请至少选择一种格式');
        if (state.mode === 'team' && !state.workspaceId) return alert('请输入 Team Workspace ID');

        const config = {
            mode: state.mode,
            workspaceId: state.workspaceId,
            formats: formats,
            limit: radioAll.checked ? -1 : (parseInt(limitInput.value) || 20),
            includeProjects: document.getElementById('include-projects').checked
        };

        exportBtn.disabled = true;
        importBtn.disabled = true;

        setProgressUI(5, '开始扫描...');
        await persistProgress({ kind: 'export', percent: 5, text: '开始扫描...', done: false, error: null });

        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'START_EXPORT', payload: config });
        });

        saveSettings();
    };

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
        const rawFiles = Array.from(e.target.files).filter(f => /\.(json|md|html)$/i.test(f.name));
        if (rawFiles.length === 0) return alert('未找到支持的文件 (JSON/MD/HTML)');

        const fileMap = new Map();
        const priority = { 'json': 1, 'md': 2, 'html': 3 };

        rawFiles.forEach(file => {
            const lastDotIndex = file.name.lastIndexOf('.');
            if (lastDotIndex === -1) return;

            const baseName = file.name.substring(0, lastDotIndex);
            const ext = file.name.substring(lastDotIndex + 1).toLowerCase();

            if (fileMap.has(baseName)) {
                const existingFile = fileMap.get(baseName);
                const existingLastDot = existingFile.name.lastIndexOf('.');
                const existingExt = existingFile.name.substring(existingLastDot + 1).toLowerCase();

                if ((priority[ext] || 99) < (priority[existingExt] || 99)) {
                    fileMap.set(baseName, file);
                }
            } else {
                fileMap.set(baseName, file);
            }
        });

        importFiles = Array.from(fileMap.values());

        importBtn.textContent = `开始导入 (${importFiles.length} 个会话)`;
        importBtn.disabled = false;

        const infoText = rawFiles.length === importFiles.length
            ? `已选择 ${importFiles.length} 个文件`
            : `自动优选后 ${importFiles.length} 个文件`;

        setProgressUI(0, infoText);
        await persistProgress({ kind: 'import', percent: 0, text: infoText, done: false, error: null });
    };

    const readFile = (file) => new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsText(file);
    });

    importBtn.onclick = async () => {
        if (!confirm(`即将导入 ${importFiles.length} 个会话。\n请保持页面前台运行，不要操作鼠标。`)) return;
        importBtn.disabled = true;
        exportBtn.disabled = true;

        await persistProgress({ kind: 'import', percent: 0, text: `开始导入 (${importFiles.length})...`, done: false, error: null });
        setProgressUI(0, `开始导入 (${importFiles.length})...`);

        for (let i = 0; i < importFiles.length; i++) {
            const file = importFiles[i];
            const pct = ((i) / importFiles.length) * 100;

            const msgText = `[${i + 1}/${importFiles.length}] 正在导入: ${file.name}`;
            setProgressUI(pct, msgText);
            await persistProgress({ kind: 'import', percent: pct, text: msgText, done: false, error: null });

            try {
                const content = await readFile(file);
                let title = file.name.substring(0, file.name.lastIndexOf('.'));
                let transcript = '';

                if (file.name.toLowerCase().endsWith('.json')) {
                    try {
                        const json = JSON.parse(content);
                        if (json.title) title = json.title;

                        transcript = `[Backup: ${title}]\nDate: ${new Date((json.createTime || 0) * 1000).toLocaleString()}\n\n`;

                        let msgs = json.messages || [];
                        if (!msgs.length && json.mapping) {
                            for (const key in json.mapping) {
                                const msg = json.mapping[key]?.message;
                                if (
                                    msg &&
                                    msg.content &&
                                    msg.content.parts &&
                                    msg.content.parts[0] &&
                                    msg.author &&
                                    msg.author.role !== 'system'
                                ) {
                                    msgs.push({
                                        role: msg.author.role,
                                        content: msg.content.parts.join('\n'),
                                        createTime: msg.create_time
                                    });
                                }
                            }
                            msgs.sort((a, b) => (a.createTime || 0) - (b.createTime || 0));
                        }
                        msgs.forEach(m => transcript += `[${m.role}]: ${m.content}\n\n`);
                    } catch (e) {
                        transcript = content;
                    }
                } else {
                    transcript = content;
                }

                await new Promise(resolve => {
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) {
                            chrome.tabs.sendMessage(tabs[0].id, {
                                type: 'IMPORT_SINGLE_CHAT',
                                payload: { title: title, content: transcript }
                            });
                        }
                        setTimeout(resolve, 15000); // 间隔
                    });
                });

            } catch (e) {
                console.error(e);
                const errText = `导入出错: ${file.name}`;
                setProgressUI(pct, errText);
                await persistProgress({ kind: 'import', percent: pct, text: errText, done: false, error: String(e?.message || e) });
            }
        }

        setProgressUI(100, '全部完成');
        await persistProgress({ kind: 'import', percent: 100, text: '全部完成', done: true, error: null });

        exportBtn.disabled = false;
        importBtn.disabled = false;

        alert('导入结束！');
    };

    chrome.runtime.onMessage.addListener(async (msg) => {
        if (msg.type === 'EXPORT_PROGRESS') {
            const percent = typeof msg.data?.percent === 'number' ? msg.data.percent : 0;
            const text = typeof msg.data?.text === 'string' ? msg.data.text : '';
            setProgressUI(percent, text);

            await persistProgress({
                kind: msg.data?.kind || 'export',
                percent: percent,
                text: text,
                done: !!msg.data?.done,
                error: msg.data?.error || null
            });

            if (msg.data?.done) {
                const nowStr = getShanghaiTimeText();
                
                if (lastBackupTimeLabel) {
                    lastBackupTimeLabel.textContent = nowStr;
                }

                chrome.storage.local.set({
                    lastAutoBackupAtShanghaiText: nowStr,
                    lastAutoBackupAtMs: Date.now(),
                    lastAutoBackupTimeSource: 'manual-popup'
                });

                exportBtn.disabled = false;
                importBtn.disabled = importFiles.length === 0;
            } else if (msg.data?.error) {
                exportBtn.disabled = false;
                importBtn.disabled = importFiles.length === 0;
            }
        }
    });
});
