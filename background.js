const PROGRESS_KEY = 'progressByTab';
const LAST_AUTO_BACKUP_AT_MS = 'lastAutoBackupAtMs';
const LAST_AUTO_BACKUP_AT_SH_TEXT = 'lastAutoBackupAtShanghaiText';
const LAST_AUTO_BACKUP_TIME_SOURCE = 'lastAutoBackupTimeSource';

const ALARM_PREFIX = 'backup_delay_for_tab_';

let autoBackupLock = false;

const logger = {
  info: (msg, ...args) => console.log(`%c[Backup Info] ${msg}`, 'color: #00AAFF; font-weight: bold;', ...args),
  success: (msg, ...args) => console.log(`%c[Backup Success] ${msg}`, 'color: #00CC66; font-weight: bold;', ...args),
  warn: (msg, ...args) => console.log(`%c[Backup Warn] ${msg}`, 'color: #FF9900; font-weight: bold;', ...args),
  error: (msg, ...args) => console.log(`%c[Backup Error] ${msg}`, 'color: #FF4444; font-weight: bold;', ...args),
  group: (label) => console.group(`%c🚀 ${label}`, 'color: #ffffff; background: #333; padding: 2px 5px; border-radius: 3px;'),
  groupEnd: () => console.groupEnd()
};

const storageGet = (keys) => new Promise((resolve) => chrome.storage.local.get(keys, resolve));
const storageSet = (obj) => new Promise((resolve) => chrome.storage.local.set(obj, resolve));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function formatShanghai(ms) {
  if (!ms) return '无记录 (Never)';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).format(new Date(ms));
  } catch (e) {
    return new Date(ms).toISOString();
  }
}

function sendMessageToTab(tabId, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        logger.warn(`SendMessage failed: ${chrome.runtime.lastError.message}`);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

async function getNowMsFromTimeIsShanghai() {
  const url = 'https://time.is/Shanghai';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); 

  try {
    let res = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
    clearTimeout(timeoutId);
    let date = res.headers.get('date');
    if (date) return { ms: Date.parse(date), source: 'time.is(HEAD)' };
    
    const controller2 = new AbortController();
    const timeoutId2 = setTimeout(() => controller2.abort(), 3000);
    res = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller2.signal });
    clearTimeout(timeoutId2);
    date = res.headers.get('date');
    if (date) return { ms: Date.parse(date), source: 'time.is(GET)' };

  } catch (e) {
    logger.warn('Time API failed/timeout, utilizing Local System Time.');
  }
  return { ms: Date.now(), source: 'local system' };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'EXPORT_PROGRESS') {
    const tabId = sender && sender.tab ? sender.tab.id : null;
    saveProgress(tabId, request.data);
  }
  if (request.type === 'UPDATE_BACKUP_SETTINGS') {
    logger.info('Settings updated via Popup.');
  }
});

async function saveProgress(tabId, data) {
  try {
    const key = String(tabId ?? 'global');
    const res = await storageGet([PROGRESS_KEY]);
    const map = res[PROGRESS_KEY] || {};
    map[key] = { ...(map[key] || {}), ...(data || {}), updatedAt: Date.now() };
    await storageSet({ [PROGRESS_KEY]: map });
  } catch (e) {}
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;

  const url = changeInfo.url || tab.url;
  if (!url) return;

  if (url.includes('chatgpt.com') || url.includes('chat.openai.com')) {
    const alarmName = ALARM_PREFIX + tabId;
    
    logger.info(`ChatGPT loaded (Tab ${tabId}). Starting 1 min countdown...`);
    
    chrome.alarms.clear(alarmName, () => {
      chrome.alarms.create(alarmName, { delayInMinutes: 1 });
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith(ALARM_PREFIX)) {
    const tabIdStr = alarm.name.replace(ALARM_PREFIX, '');
    const tabId = parseInt(tabIdStr, 10);
    
    logger.info(`⏰ Timer finished for Tab ${tabId}. Running check...`);
    checkAndRunAutoBackup(tabId);
  }
});

async function checkAndRunAutoBackup(tabId) {
  if (autoBackupLock) {
    logger.warn('Skipped: Another backup is currently running (Lock Active).');
    return;
  }

  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab) {
      logger.warn('Skipped: Tab was closed before timer finished.');
      return;
    }
  } catch (e) {
    logger.warn('Skipped: Tab invalid/closed.');
    return;
  }

  autoBackupLock = true;
  
  logger.group('执行自动备份检查 (Auto Backup Check)');

  try {
    const state = await storageGet([
      'backupEnabled',
      'backupInterval',
      'savedMode',
      'savedWorkspaceId',
      LAST_AUTO_BACKUP_AT_MS
    ]);

    if (!state.backupEnabled) {
      console.log('❌ 状态: 未启用 (Disabled)');
      logger.groupEnd();
      return;
    }

    const intervalMin = parseInt(state.backupInterval, 10);
    if (!intervalMin || intervalMin <= 0) {
      console.log('❌ 错误: 时间间隔设置无效');
      logger.groupEnd();
      return;
    }
    
    const intervalMs = intervalMin * 60 * 1000;

    console.log('⏳ 正在同步网络时间 (Syncing time)...');
    const nowObj = await getNowMsFromTimeIsShanghai();
    const nowMs = nowObj.ms;
    const lastMs = typeof state[LAST_AUTO_BACKUP_AT_MS] === 'number' ? state[LAST_AUTO_BACKUP_AT_MS] : 0;

    const nextBackupMs = lastMs ? (lastMs + intervalMs) : 0;
    const diff = nowMs - lastMs;
    const due = !lastMs || (diff >= intervalMs);

    console.log(`----------------------------------------`);
    console.log(`🕒 当前时间 (Now)   : ${formatShanghai(nowMs)} [${nowObj.source}]`);
    console.log(`🔙 上次备份 (Last)  : ${formatShanghai(lastMs)}`);
    console.log(`⏱️ 设定间隔 (Set)   : 每 ${intervalMin} 分钟`);
    
    if (lastMs > 0) {
        console.log(`🔜 下次应备 (Next)  : ${formatShanghai(nextBackupMs)}`);
        const waitMin = ((intervalMs - diff) / 60000).toFixed(1);
        if (!due) console.log(`⏸️ 还需等待 (Wait)  : 约 ${waitMin} 分钟`);
    } else {
        console.log(`🔜 下次应备 (Next)  : 立即 (Immediately - Initial run)`);
    }
    console.log(`----------------------------------------`);

    if (!due) {
      logger.info('条件未满足，本次跳过。');
      logger.groupEnd();
      return;
    }

    logger.success('✅ 时间已到！开始执行备份...');

    await storageSet({
      [LAST_AUTO_BACKUP_AT_MS]: nowMs,
      [LAST_AUTO_BACKUP_AT_SH_TEXT]: formatShanghai(nowMs),
      [LAST_AUTO_BACKUP_TIME_SOURCE]: nowObj.source
    });

    const config = {
      mode: state.savedMode || 'personal',
      workspaceId: state.savedWorkspaceId || '',
      formats: { json: true, markdown: true, html: true },
      limit: 50,
      includeProjects: true,
      silent: true
    };

    const sent = await sendMessageToTab(tabId, { type: 'START_EXPORT', payload: config });
    
    if (sent) {
      logger.success('指令发送成功！请留意下载进度。');
    } else {
      logger.error('指令发送失败！可能是页面正在刷新或脚本未注入。');
    }

  } catch (e) {
    logger.error(`Critical Error: ${e.message}`);
    console.error(e);
  } finally {
    autoBackupLock = false;
    logger.groupEnd();
  }
}
