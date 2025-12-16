(function() {
    'use strict';

    const WIDGET_ID = 'gpt-backup-status-widget';

    function formatTimeShort(ms) {
        if (!ms) return '无记录';
        try {
            const date = new Date(ms);
            // 格式：12/13 22:46
            return `${date.getMonth()+1}/${date.getDate()} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`;
        } catch (e) { return '无记录'; }
    }

    function getShanghaiTimeFull() {
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

    function createWidget() {
        if (document.getElementById(WIDGET_ID)) return;

        const div = document.createElement('div');
        div.id = WIDGET_ID;
        
        div.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            width: 240px;
            background: rgba(32, 33, 35, 0.90);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 14px;
            padding: 14px;
            color: #ececf1;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.4);
            transition: opacity 0.3s;
            user-select: none;
        `;

        const githubIcon = `
            <a href="https://github.com/Roymod" target="_blank" title="访问 Github" style="
                display: inline-flex; 
                align-items: center; 
                color: rgba(255,255,255,0.8); 
                text-decoration: none; 
                margin-right: 6px; 
                transition: color 0.2s;
            " onmouseover="this.style.color='white'" onmouseout="this.style.color='rgba(255,255,255,0.8)'">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
            </a>
        `;

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <div style="display:flex; align-items:center;">
                    ${githubIcon}
                    <span style="font-weight:600; color:#10a37f;">自动备份状态</span>
                </div>
                <span id="${WIDGET_ID}-status" style="font-size:10px; opacity:0.7;">检测中...</span>
            </div>
            
            <div style="line-height: 1.8; color:rgba(255,255,255,0.75); font-size:11px; margin-bottom:12px;">
                <div style="display:flex; justify-content:space-between;">
                    <span>上次备份:</span>
                    <span id="${WIDGET_ID}-last" style="font-family:monospace; color:#fff;">--</span>
                </div>
                <div style="display:flex; justify-content:space-between;">
                    <span>下次计划:</span>
                    <span id="${WIDGET_ID}-next" style="font-family:monospace; color:#fff;">--</span>
                </div>
            </div>

            <button id="${WIDGET_ID}-btn" style="
                width: 100%;
                background: linear-gradient(135deg, #10a37f 0%, #0d8a6c 100%);
                color: white;
                border: none;
                border-radius: 8px;
                padding: 8px;
                cursor: pointer;
                font-size: 12px;
                font-weight: 600;
                transition: all 0.2s;
                box-shadow: 0 2px 6px rgba(16,163,127,0.3);
            ">立即备份</button>

            <!-- 进度条区域 -->
            <div id="${WIDGET_ID}-progress-container" style="display:none; margin-top:12px; animation: fadeIn 0.3s ease;">
                <div style="
                    height: 6px; 
                    background: rgba(255,255,255,0.1); 
                    border-radius: 3px; 
                    overflow: hidden;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
                ">
                    <div id="${WIDGET_ID}-progress-bar" style="
                        width: 0%; 
                        height: 100%; 
                        border-radius: 3px;
                        background: linear-gradient(90deg, #4299e1, #9f7aea, #ed8936, #4299e1);
                        background-size: 200% 100%;
                        animation: gradientMove 2s linear infinite;
                        transition: width 0.3s ease;
                    "></div>
                </div>
                <div id="${WIDGET_ID}-progress-text" style="
                    font-size: 10px; 
                    color: rgba(255,255,255,0.6); 
                    margin-top: 4px; 
                    text-align: center;
                ">准备开始...</div>
            </div>
            
            <style>
                @keyframes gradientMove { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }
            </style>
        `;

        const btn = div.querySelector(`#${WIDGET_ID}-btn`);
        btn.onmouseover = () => { btn.style.filter = 'brightness(1.1)'; };
        btn.onmouseout = () => { btn.style.filter = 'brightness(1.0)'; };
        
        btn.onclick = async () => {
            btn.disabled = true;
            btn.style.opacity = '0.6';
            btn.style.cursor = 'not-allowed';

            const data = await new Promise(r => chrome.storage.local.get(null, r));
            
            const config = {
                mode: data.savedMode || 'personal',
                workspaceId: data.savedWorkspaceId || '',
                formats: { json: true, markdown: true, html: true },
                limit: -1, 
                includeProjects: true,
                silent: false 
            };

            window.postMessage({ type: 'GPT_CMD_START', config: config }, '*');
        };

        document.body.appendChild(div);
        refreshWidgetData();
    }

    async function refreshWidgetData() {
        const uiLast = document.getElementById(`${WIDGET_ID}-last`);
        const uiNext = document.getElementById(`${WIDGET_ID}-next`);
        const uiStatus = document.getElementById(`${WIDGET_ID}-status`);
        
        if (!uiLast) return;

        const data = await new Promise(r => chrome.storage.local.get([
            'backupEnabled', 
            'backupInterval', 
            'lastAutoBackupAtMs'
        ], r));

        if (!data.backupEnabled) {
            uiStatus.textContent = '已禁用';
            uiStatus.style.color = '#ff6b6b';
            uiNext.textContent = '未开启';
            uiLast.textContent = data.lastAutoBackupAtMs ? formatTimeShort(data.lastAutoBackupAtMs) : '无';
            return;
        }

        uiStatus.textContent = '运行中';
        uiStatus.style.color = '#10a37f';

        const lastMs = data.lastAutoBackupAtMs || 0;
        const intervalMin = parseInt(data.backupInterval || 0);
        
        uiLast.textContent = lastMs ? formatTimeShort(lastMs) : '从未';

        if (lastMs && intervalMin) {
            const nextMs = lastMs + (intervalMin * 60 * 1000);
            const now = Date.now();
            
            if (now > nextMs) {
                uiNext.textContent = '等待触发...';
                uiNext.style.color = '#ff9f43';
            } else {
                uiNext.textContent = formatTimeShort(nextMs);
                uiNext.style.color = 'inherit';
            }
        } else {
            uiNext.textContent = '待定';
        }
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            refreshWidgetData();
        }
    });

    window.addEventListener('message', (event) => {
        if (event.data?.type === 'GPT_To_Extension_Progress') {
            const payload = event.data.payload;
            const percent = payload.percent || 0;
            const text = payload.text || '';
            const isDone = payload.done;
            const isError = payload.error;

            const container = document.getElementById(`${WIDGET_ID}-progress-container`);
            const bar = document.getElementById(`${WIDGET_ID}-progress-bar`);
            const txt = document.getElementById(`${WIDGET_ID}-progress-text`);
            const btn = document.getElementById(`${WIDGET_ID}-btn`);

            if (container && bar && txt) {
                container.style.display = 'block';
                bar.style.width = `${Math.max(5, percent)}%`;
                txt.textContent = text;

                if (isError) {
                    bar.style.background = '#ff6b6b';
                    bar.style.animation = 'none';
                }

                if (isDone || isError) {
                    if (isDone) {
                        const nowMs = Date.now();
                        const nowStr = getShanghaiTimeFull();
                        
                        chrome.storage.local.set({
                            lastAutoBackupAtMs: nowMs,
                            lastAutoBackupAtShanghaiText: nowStr,
                            lastAutoBackupTimeSource: 'manual-widget'
                        });
                    }

                    setTimeout(() => {
                        container.style.display = 'none';
                        bar.style.width = '0%';
                        bar.style.background = 'linear-gradient(90deg, #4299e1, #9f7aea, #ed8936, #4299e1)';
                        bar.style.animation = 'gradientMove 2s linear infinite';
                        txt.textContent = '准备开始...';

                        if (btn) {
                            btn.disabled = false;
                            btn.style.opacity = '1';
                            btn.style.cursor = 'pointer';
                        }
                        
                        refreshWidgetData();
                    }, 2500);
                }
            }
        }
    });

    setTimeout(createWidget, 1500);
    setInterval(createWidget, 5000);

})();
