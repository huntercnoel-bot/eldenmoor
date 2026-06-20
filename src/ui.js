// ui.js — tiny shared UI helpers used across systems.

let msgEl = null, msgTimer = null;

// Show a brief Old School-style message in the bottom-left chatbox line.
export function gameMessage(text) {
  if (!msgEl) msgEl = document.getElementById('gamemsg');
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.style.opacity = '1';
  clearTimeout(msgTimer);
  msgTimer = setTimeout(() => { msgEl.style.opacity = '0'; }, 3500);
}
