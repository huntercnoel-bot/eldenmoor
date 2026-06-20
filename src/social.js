// social.js — the Friends tab (add / remove / online status) and private chat.

import { gameMessage } from './ui.js';

function esc(s) { return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }

export function setupSocial(net) {
  const frList = document.getElementById('fr-list');
  const frInput = document.getElementById('fr-input');
  const frAdd = document.getElementById('fr-addbtn');

  const chatEl = document.getElementById('chat');
  const chatLog = document.getElementById('chat-log');
  const chatInput = document.getElementById('chat-input');
  const chatTo = document.getElementById('chat-to');
  const chatClose = document.getElementById('chat-close');
  let chatTarget = null;

  // ---- Friends list ----
  function renderFriends(d) {
    const list = (d && d.list) || [];
    if (!frList) return;
    if (!list.length) {
      frList.innerHTML = '<div class="fr-empty">No friends yet.<br>Add someone by name above!</div>';
      return;
    }
    frList.innerHTML = '';
    for (const f of list) {
      const row = document.createElement('div');
      row.className = 'fr-row';
      row.innerHTML = `<span class="fr-dot ${f.online ? 'on' : 'off'}"></span><span class="fr-name">${esc(f.user)}</span>`;
      const msg = document.createElement('button');
      msg.className = 'fr-btn'; msg.textContent = '💬'; msg.title = 'Message ' + f.user;
      msg.onclick = () => openChat(f.user);
      const rm = document.createElement('button');
      rm.className = 'fr-btn'; rm.textContent = '✕'; rm.title = 'Remove ' + f.user;
      rm.onclick = () => net.send({ t: 'friend_remove', u: f.user });
      row.appendChild(msg); row.appendChild(rm);
      frList.appendChild(row);
    }
  }

  function addFriend() {
    const n = (frInput.value || '').trim();
    if (n) { net.send({ t: 'friend_add', u: n }); frInput.value = ''; }
  }
  if (frAdd) frAdd.onclick = addFriend;
  if (frInput) frInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addFriend(); });

  // ---- Private chat ----
  function openChat(user) {
    chatTarget = user;
    if (chatEl) chatEl.hidden = false;
    if (chatTo) chatTo.textContent = 'To: ' + user;
    if (chatInput) chatInput.focus();
  }
  function appendLine(html) {
    if (!chatLog) return;
    const d = document.createElement('div');
    d.className = 'chat-line'; d.innerHTML = html;
    chatLog.appendChild(d); chatLog.scrollTop = chatLog.scrollHeight;
  }
  if (chatClose) chatClose.onclick = () => { if (chatEl) chatEl.hidden = true; };
  if (chatInput) chatInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !chatInput.value.trim()) return;
    if (!chatTarget) { gameMessage('Open a chat first: click 💬 next to a friend.'); return; }
    net.send({ t: 'chat', to: chatTarget, text: chatInput.value.trim() });
    chatInput.value = '';
  });

  net.on('friends', renderFriends);
  net.on('chat', (d) => {
    if (d.self) {
      appendLine(`<b>You → ${esc(d.to)}:</b> ${esc(d.text)}`);
    } else {
      if (chatEl) chatEl.hidden = false;
      if (!chatTarget) openChat(d.from);
      appendLine(`<b style="color:#7fd0ff">${esc(d.from)}:</b> ${esc(d.text)}`);
      gameMessage('💬 ' + d.from + ': ' + d.text);
    }
  });
  net.on('sys', (d) => gameMessage(d.msg));

  // World (public) chat — everyone on the server sees it.
  const wcLog = document.getElementById('wc-log');
  const wcInput = document.getElementById('wc-input');
  function wcAppend(html) {
    if (!wcLog) return;
    const d = document.createElement('div'); d.className = 'wc-line'; d.innerHTML = html;
    wcLog.appendChild(d);
    while (wcLog.children.length > 50) wcLog.removeChild(wcLog.firstChild);
    wcLog.scrollTop = wcLog.scrollHeight;
  }
  if (wcInput) wcInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && wcInput.value.trim()) { net.send({ t: 'say', text: wcInput.value.trim() }); wcInput.value = ''; }
  });
  net.on('say', (d) => wcAppend(`<b style="color:#ffd87a">${esc(d.from)}:</b> ${esc(d.text)}`));

  net.send({ t: 'friend_list' }); // load the list now
}
