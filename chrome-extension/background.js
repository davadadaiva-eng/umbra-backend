/**
 * Umbra Browser Link — Background Service Worker
 *
 * Tracks:
 *   1. Cookies — captured on every navigation + periodic sweep
 *   2. Tabs — lifecycle events (created, updated, removed, activated)
 *   3. Web requests — login-form POSTs, OAuth redirects, SSO callbacks
 *   4. Activity — aggregate session telemetry
 *
 * Sends batched payloads to Umbra at http://127.0.0.1:8787/api/chrome/telemetry
 */

const UMBRA_HOST = 'http://127.0.0.1:8787';
const FLUSH_INTERVAL_MS = 5_000;       // flush every 5 s
const COOKIE_SWEEP_INTERVAL_MS = 30_000; // full cookie sweep every 30 s
const BATCH_CAP = 200;                  // max events queued before force-flush

// ── State ───────────────────────────────────────────────────
let enabled = true;
let sessionId = `chrome-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
let eventQueue = [];
let cookieSnapshot = {};                // domain → cookie[]
let tabState = {};                      // tabId → { url, title, favIconUrl, lastActive }
let activeTabId = null;

// ── Bootstrap ───────────────────────────────────────────────
(async () => {
  const stored = await chrome.storage.local.get(['umbraEnabled', 'umbraHost']);
  if (stored.umbraEnabled === false) enabled = false;
  if (stored.umbraHost) UMBRA_HOST_OVERRIDE = stored.umbraHost;

  chrome.alarms.create('umbra-flush', { periodInMinutes: FLUSH_INTERVAL_MS / 60_000 });
  chrome.alarms.create('umbra-cookie-sweep', { periodInMinutes: COOKIE_SWEEP_INTERVAL_MS / 60_000 });

  chrome.alarms.onAlarm.addListener(handleAlarm);
  chrome.tabs.onCreated.addListener(onTabCreated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);
  chrome.tabs.onRemoved.addListener(onTabRemoved);
  chrome.tabs.onActivated.addListener(onTabActivated);
  chrome.webNavigation.onBeforeSubmit.addListener(onFormSubmit);
  chrome.webNavigation.onCompleted.addListener(onNavigationComplete);

  // Initial cookie sweep
  await sweepCookies();
  // Snapshot existing tabs
  const tabs = await chrome.tabs.query({});
  for (const t of tabs) {
    tabState[t.id] = { url: t.url, title: t.title, favIconUrl: t.favIconUrl, lastActive: Date.now() };
    if (t.active) activeTabId = t.id;
  }

  queueEvent({ type: 'session:start', sessionId, ts: Date.now() });
})();

let UMBRA_HOST_OVERRIDE = '';

function host() { return UMBRA_HOST_OVERRIDE || UMBRA_HOST; }

// ── Alarm handler ───────────────────────────────────────────
function handleAlarm(alarm) {
  if (alarm.name === 'umbra-flush') flushEvents();
  if (alarm.name === 'umbra-cookie-sweep') sweepCookies();
}

// ── Event queue ─────────────────────────────────────────────
function queueEvent(event) {
  if (!enabled) return;
  event.sessionId = sessionId;
  event.ts = event.ts || Date.now();
  eventQueue.push(event);
  if (eventQueue.length >= BATCH_CAP) flushEvents();
}

async function flushEvents() {
  if (eventQueue.length === 0) return;
  const batch = eventQueue.splice(0);
  try {
    await fetch(`${host()}/api/chrome/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch, sessionId, cookieSnapshot }),
    });
  } catch (err) {
    // Umbra may not be running — re-queue the batch (cap at 500)
    eventQueue.unshift(...batch);
    if (eventQueue.length > 500) eventQueue.splice(500);
  }
}

// ── Cookie sweep ────────────────────────────────────────────
async function sweepCookies() {
  if (!enabled) return;
  const domains = {};
  try {
    const cookies = await chrome.cookies.getAll({});
    for (const c of cookies) {
      const domain = c.domain.startsWith('.') ? c.domain.slice(1) : c.domain;
      if (!domains[domain]) domains[domain] = [];
      domains[domain].push({
        name: c.name,
        // Never exfiltrate the raw value — store a presence marker + flags
        hasValue: c.value.length > 0,
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
        path: c.path,
        expires: c.expirationDate || -1,
        session: c.session,
      });
    }
  } catch (err) {
    // cookie permission may be missing
  }
  cookieSnapshot = domains;
  queueEvent({ type: 'cookies:sweep', domainCount: Object.keys(domains).length, cookieCount: Object.values(domains).reduce((s, a) => s + a.length, 0) });
}

// ── Tab events ──────────────────────────────────────────────
function onTabCreated(tab) {
  queueEvent({ type: 'tab:created', tabId: tab.id, url: tab.url || '', title: tab.title || '' });
}

function onTabUpdated(tabId, changeInfo, tab) {
  const prev = tabState[tabId];
  const now = { url: tab.url, title: tab.title, favIconUrl: tab.favIconUrl, lastActive: Date.now() };
  tabState[tabId] = now;

  if (changeInfo.url) {
    queueEvent({ type: 'tab:navigate', tabId, url: tab.url, prevUrl: prev?.url || '', title: tab.title || '' });
    // Detect OAuth / SSO redirects
    detectOAuthRedirect(tab.url, prev?.url);
  }
  if (changeInfo.title) {
    queueEvent({ type: 'tab:title', tabId, title: tab.title });
  }
}

function onTabRemoved(tabId) {
  const prev = tabState[tabId];
  delete tabState[tabId];
  queueEvent({ type: 'tab:removed', tabId, url: prev?.url || '' });
}

function onTabActivated(activeInfo) {
  const prev = activeTabId;
  activeTabId = activeInfo.tabId;
  queueEvent({ type: 'tab:activate', tabId: activeTabId, prevTabId: prev });
}

// ── Form submission / navigation ────────────────────────────
function onFormSubmit(details) {
  if (!details.url) return;
  const url = details.url;
  // Detect login-related POST submissions
  const isLoginLike = /login|signin|auth|oauth|saml|sso|session|callback|token|consent/i.test(url);
  queueEvent({
    type: 'form:submit',
    tabId: details.tabId,
    url,
    isLoginLike,
    frameId: details.frameId,
  });
}

function onNavigationComplete(details) {
  if (details.frameId !== 0) return; // only top-level
  queueEvent({
    type: 'nav:complete',
    tabId: details.tabId,
    url: details.url,
  });
}

// ── OAuth / SSO detection ───────────────────────────────────
const OAUTH_PATTERNS = [
  /accounts\.google\.com\/o\/oauth/i,
  /login\.microsoftonline\.com/i,
  /github\.com\/login\/oauth/i,
  /auth0\.com\/authorize/i,
  /facebook\.com\/v\d+\/dialog\/oauth/i,
  /api\.twitter\.com\/oauth/i,
  /linkedin\.com\/oauth/i,
  /appleid\.apple\.com\/auth/i,
  /id\.apple\.com/i,
  /oauth\.twitter\.com/i,
  /discord\.com\/api\/oauth/i,
  /paypal\.com\/signin/i,
  /okta\.com\/oauth/i,
  /onelogin\.com/i,
  /ping\.com\/federation/i,
  /saml/i,
];

function detectOAuthRedirect(url, prevUrl) {
  if (!url) return;
  const isOAuth = OAUTH_PATTERNS.some(p => p.test(url));
  if (isOAuth) {
    queueEvent({
      type: 'oauth:detected',
      url,
      prevUrl,
      provider: extractOAuthProvider(url),
    });
  }
}

function extractOAuthProvider(url) {
  if (/google/i.test(url)) return 'google';
  if (/microsoft|live\.com|azure/i.test(url)) return 'microsoft';
  if (/github/i.test(url)) return 'github';
  if (/facebook/i.test(url)) return 'facebook';
  if (/twitter|x\.com/i.test(url)) return 'twitter';
  if (/linkedin/i.test(url)) return 'linkedin';
  if (/apple/i.test(url)) return 'apple';
  if (/auth0/i.test(url)) return 'auth0';
  if (/okta/i.test(url)) return 'okta';
  if (/discord/i.test(url)) return 'discord';
  if (/paypal/i.test(url)) return 'paypal';
  return 'unknown';
}

// ── Message handling (from content scripts / popup) ─────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'login:detected') {
    queueEvent({
      type: 'login:detected',
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      formAction: msg.action,
      fieldCount: msg.fieldCount,
      hasPasswordField: msg.hasPassword,
      hasUsernameField: msg.hasUsername,
      provider: detectLoginProvider(sender.tab?.url, msg),
    });
    sendResponse({ ok: true });
  }

  if (msg.type === 'login:submitted') {
    queueEvent({
      type: 'login:submitted',
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      formAction: msg.action,
      fieldCount: msg.fieldCount,
      // NEVER include password values
      hasPassword: msg.hasPassword,
      hasUsername: msg.hasUsername,
    });
    sendResponse({ ok: true });
  }

  if (msg.type === 'activity:heartbeat') {
    queueEvent({
      type: 'activity:heartbeat',
      tabId: sender.tab?.id,
      url: sender.tab?.url,
      title: sender.tab?.title,
      scrollY: msg.scrollY,
      viewportHeight: msg.viewportHeight,
      linkCount: msg.linkCount,
      formCount: msg.formCount,
    });
    sendResponse({ ok: true });
  }

  if (msg.type === 'popup:getStatus') {
    sendResponse({ enabled, sessionId, eventCount: eventQueue.length, tabCount: Object.keys(tabState).length });
    return true;
  }

  if (msg.type === 'popup:toggle') {
    enabled = msg.enabled;
    chrome.storage.local.set({ umbraEnabled: enabled });
    sendResponse({ enabled });
    return true;
  }

  if (msg.type === 'popup:setHost') {
    UMBRA_HOST_OVERRIDE = msg.host || '';
    chrome.storage.local.set({ umbraHost: UMBRA_HOST_OVERRIDE });
    sendResponse({ ok: true });
    return true;
  }
});

function detectLoginProvider(pageUrl, formData) {
  if (!pageUrl) return 'unknown';
  const u = pageUrl.toLowerCase();
  if (/google|gmail|accounts\.google/i.test(u)) return 'google';
  if (/microsoft|live\.com|outlook|office/i.test(u)) return 'microsoft';
  if (/github\.com/i.test(u)) return 'github';
  if (/facebook|fb\.com/i.test(u)) return 'facebook';
  if (/twitter|x\.com/i.test(u)) return 'twitter';
  if (/linkedin/i.test(u)) return 'linkedin';
  if (/apple|icloud/i.test(u)) return 'apple';
  if (/amazon/i.test(u)) return 'amazon';
  return 'unknown';
}
