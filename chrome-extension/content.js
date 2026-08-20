/**
 * Umbra Browser Link — Content Script
 *
 * Injected into every page. Detects:
 *   1. Login forms (password fields, sign-in buttons)
 *   2. Form submissions with credentials
 *   3. OAuth/SSO redirect triggers
 *   4. Periodic heartbeat with page metadata
 */

(() => {
  'use strict';

  const HEARTBEAT_INTERVAL_MS = 30_000;
  const PASSWORD_SELECTORS = 'input[type="password"], input[name*="pass"], input[name*="pwd"], input[id*="pass"]';
  const USERNAME_SELECTORS = 'input[type="email"], input[type="text"][name*="user"], input[type="text"][name*="login"], input[type="text"][name*="email"], input[type="text"][id*="user"], input[type="text"][id*="login"], input[type="email"][id*="email"]';
  const SUBMIT_SELECTORS = 'button[type="submit"], input[type="submit"], button[name*="login"], button[name*="signin"], button[id*="login"], button[id*="signin"]';

  // ── Login form detection ──────────────────────────────────
  function detectLoginForm() {
    const passwords = document.querySelectorAll(PASSWORD_SELECTORS);
    const usernames = document.querySelectorAll(USERNAME_SELECTORS);
    const submits = document.querySelectorAll(SUBMIT_SELECTORS);

    if (passwords.length === 0) return null;

    // Find the form containing the password field
    const form = passwords[0].closest('form');
    const action = form?.action || '';

    return {
      hasPassword: true,
      hasUsername: usernames.length > 0,
      fieldCount: form ? form.querySelectorAll('input').length : 0,
      action,
    };
  }

  // ── Observe DOM for login forms ───────────────────────────
  let reportedForm = false;

  function checkForLoginForm() {
    const detected = detectLoginForm();
    if (detected && !reportedForm) {
      reportedForm = true;
      chrome.runtime.sendMessage({ type: 'login:detected', ...detected });
    }
  }

  // MutationObserver to catch dynamically rendered login forms
  const observer = new MutationObserver(() => {
    checkForLoginForm();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Initial check
  checkForLoginForm();

  // ── Form submission interception ───────────────────────────
  document.addEventListener('submit', (e) => {
    const form = e.target;
    if (!(form instanceof HTMLFormElement)) return;

    const hasPassword = form.querySelector(PASSWORD_SELECTORS) !== null;
    const hasUsername = form.querySelector(USERNAME_SELECTORS) !== null;

    if (hasPassword || hasUsername) {
      chrome.runtime.sendMessage({
        type: 'login:submitted',
        action: form.action || '',
        fieldCount: form.querySelectorAll('input').length,
        hasPassword,
        hasUsername,
      });
    }
  }, true); // capture phase to fire before navigation

  // ── OAuth / SSO link clicks ───────────────────────────────
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor) return;
    const href = anchor.href || '';
    if (/oauth|sso|signin|login|auth\/|openid/i.test(href)) {
      chrome.runtime.sendMessage({
        type: 'login:detected',
        action: href,
        fieldCount: 0,
        hasPassword: false,
        hasUsername: false,
      });
    }
  }, true);

  // ── Page activity heartbeat ────────────────────────────────
  function sendHeartbeat() {
    const forms = document.querySelectorAll('form');
    const links = document.querySelectorAll('a[href]');
    chrome.runtime.sendMessage({
      type: 'activity:heartbeat',
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
      linkCount: links.length,
      formCount: forms.length,
    }).catch(() => {}); // background may be asleep
  }

  setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
  sendHeartbeat(); // immediate first beat

  // ── Reset on SPA navigation ───────────────────────────────
  let lastUrl = location.href;
  const urlObserver = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      reportedForm = false;
      checkForLoginForm();
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });
})();
