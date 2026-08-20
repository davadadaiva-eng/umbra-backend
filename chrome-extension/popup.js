/**
 * Umbra Browser Link — Popup Script
 */

const toggle = document.getElementById('toggle');
const connStatus = document.getElementById('connStatus');
const sessionId = document.getElementById('sessionId');
const hostInput = document.getElementById('hostInput');
const statEvents = document.getElementById('statEvents');
const statTabs = document.getElementById('statTabs');

// Load current state from background
chrome.runtime.sendMessage({ type: 'popup:getStatus' }, (res) => {
  if (!res) return;
  toggle.classList.toggle('on', res.enabled);
  sessionId.textContent = res.sessionId || '—';
  statEvents.textContent = res.eventCount || 0;
  statTabs.textContent = res.tabCount || 0;
});

// Toggle tracking
toggle.addEventListener('click', () => {
  const isOn = toggle.classList.contains('on');
  chrome.runtime.sendMessage({ type: 'popup:toggle', enabled: !isOn }, (res) => {
    if (res) toggle.classList.toggle('on', res.enabled);
  });
});

// Save host on enter
hostInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    chrome.runtime.sendMessage({ type: 'popup:setHost', host: hostInput.value.trim() });
    hostInput.blur();
  }
});

// Check Umbra connection
async function checkConnection() {
  try {
    const res = await fetch('http://127.0.0.1:8787/api/health', { method: 'GET' });
    if (res.ok) {
      connStatus.textContent = '● Connected';
      connStatus.className = 'status-value connected';
    } else {
      throw new Error('non-200');
    }
  } catch {
    connStatus.textContent = '● Disconnected';
    connStatus.className = 'status-value disconnected';
  }
}

checkConnection();
setInterval(checkConnection, 10_000);

// Periodic stats refresh
setInterval(() => {
  chrome.runtime.sendMessage({ type: 'popup:getStatus' }, (res) => {
    if (!res) return;
    statEvents.textContent = res.eventCount || 0;
    statTabs.textContent = res.tabCount || 0;
  });
}, 3_000);
