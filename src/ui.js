// ui.js — tiny shared UI helpers used across systems:
//   • gameMessage()  — brief OSRS-style notice in the bottom-left
//   • framed parchment tooltips (replaces the browser's native title= boxes)
//   • a live carved-bronze minimap driven by window.eldenmoor
// All purely cosmetic / DOM; no gameplay, networking or 3D logic here.

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

/* ===================== Framed parchment tooltips =====================
   We keep elements' native `title` text (so the data stays where it lives,
   e.g. inventory.js still sets slot.title) but suppress the ugly browser
   tooltip and render our own framed-parchment box instead. A title may be
   "Name — sub line" (en-dash) which we split into a gold title + body.

   showTooltip()/hideTooltip() are exported so other UI (a quest log /
   dialogue box, etc.) can reuse the same look via the .em-tooltip class. */

let tipEl = null;
function ensureTip() {
  if (tipEl) return tipEl;
  tipEl = document.createElement('div');
  tipEl.id = 'em-tooltip';
  tipEl.className = 'em-tooltip';
  document.body.appendChild(tipEl);
  return tipEl;
}

// content: { title, sub, body, hint } OR a plain string.
export function showTooltip(content, x, y) {
  const el = ensureTip();
  if (typeof content === 'string') content = parseTitle(content);
  let html = '';
  if (content.title) html += `<div class="em-tt-title">${esc(content.title)}</div>`;
  if (content.sub)   html += `<div class="em-tt-sub">${esc(content.sub)}</div>`;
  if (content.body)  html += `<div class="em-tt-body">${esc(content.body)}</div>`;
  if (content.hint)  html += `<div class="em-tt-hint">${esc(content.hint)}</div>`;
  el.innerHTML = html || `<div class="em-tt-body">${esc(String(content))}</div>`;
  el.classList.add('show');
  positionTip(el, x, y);
}

export function hideTooltip() { if (tipEl) tipEl.classList.remove('show'); }

function positionTip(el, x, y) {
  // measure then clamp inside the viewport, preferring below-right of cursor
  const r = el.getBoundingClientRect();
  let nx = x + 14, ny = y + 16;
  if (nx + r.width > window.innerWidth - 6) nx = x - r.width - 12;
  if (ny + r.height > window.innerHeight - 6) ny = y - r.height - 12;
  if (nx < 6) nx = 6;
  if (ny < 6) ny = 6;
  el.style.left = nx + 'px';
  el.style.top = ny + 'px';
}

// Split a native title like "Bronze axe — click to equip" into title + body.
function parseTitle(t) {
  const parts = String(t).split(/\s+[—–-]\s+/);
  if (parts.length > 1) return { title: parts[0], body: parts.slice(1).join(' — ') };
  return { title: t };
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Wire delegated hover tooltips for HUD elements carrying `title` text. We
// hoist the title into a data attribute and clear it so the browser's own
// tooltip never appears. Re-reads each hover so re-rendered slots stay correct.
export function initTooltips() {
  const SEL = '.inv-slot, .equip-slot, .skill-cell, .tab, #logout, .npc-label, .player-label, [data-em-tip]';
  let active = null;

  function contentFor(el) {
    if (el.dataset.emTip) return el.dataset.emTip;
    if (el.title) { el.dataset.emTipCache = el.title; el.removeAttribute('title'); }
    return el.dataset.emTipCache || '';
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest && e.target.closest(SEL);
    if (!el) return;
    const c = contentFor(el);
    if (!c) return;
    active = el;
    showTooltip(c, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (!active || !tipEl || !tipEl.classList.contains('show')) return;
    positionTip(tipEl, e.clientX, e.clientY);
  });
  document.addEventListener('mouseout', (e) => {
    if (!active) return;
    const to = e.relatedTarget;
    if (to && active.contains && active.contains(to)) return;
    active = null;
    hideTooltip();
  });
  // hide on any click (e.g. equipping) so a stale tip doesn't linger
  document.addEventListener('click', () => { active = null; hideTooltip(); }, true);
}

/* ===================== Minimap =====================
   Top-down carved-bronze dial. The player stays centred and the map rotates so
   "up" is the direction the camera faces (classic OSRS feel). Draws NPC dots
   (gold = shop, blue = royalty, grey = guards, cream = townsfolk), remote
   players (cyan) and a player heading arrow. One canvas redrawn each frame;
   fully non-interactive (#minimap has pointer-events:none). */
export function initMinimap() {
  const cv = document.getElementById('minimap-canvas');
  const coordsPill = document.getElementById('minimap-coords');
  const floorEl = document.getElementById('minimap-floor');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const cx = W / 2, cy = H / 2;
  const R = W / 2 - 6;          // dial radius in px
  const SCALE = 1.45;           // world-units -> px
  const RANGE = R / SCALE;      // world units from centre to edge

  function dotColor(def) {
    if (!def) return '#e8dcc0';
    if (def.crown || def.type === 'royal') return '#9fe0ff';   // royalty / quest-givers
    if (def.type === 'shop') return '#ffd277';                  // shopkeepers
    if (def.guard) return '#cfd6df';                            // guards
    return '#e8dcc0';                                           // townsfolk
  }

  function frame() {
    requestAnimationFrame(frame);
    const em = window.eldenmoor;
    ctx.clearRect(0, 0, W, H);

    // sunken parchment-dark dial base + faint range rings
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
    g.addColorStop(0, '#1b150c'); g.addColorStop(0.7, '#120d07'); g.addColorStop(1, '#0a0703');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,214,119,0.10)'; ctx.lineWidth = 1;
    for (const rr of [R * 0.4, R * 0.72]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(255,214,119,0.06)';
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();

    if (em && em.player) {
      const px = em.player.position.x, pz = em.player.position.z;
      const heading = em.player.rotation ? em.player.rotation.y : 0;
      const cosH = Math.cos(-heading), sinH = Math.sin(-heading);
      const curFloor = (em.getFloor && em.getFloor()) || 0;

      const plot = (wx, wz) => {
        const dx = wx - px, dz = wz - pz;
        const sx = dx * cosH - dz * sinH;
        const sz = dx * sinH + dz * cosH;
        return { x: cx + sx * SCALE, y: cy + sz * SCALE, dist: Math.hypot(dx, dz) };
      };

      // NPC dots (current floor only)
      if (em.npcs) {
        for (const n of em.npcs) {
          const def = n.def || (n.group && n.group.userData && n.group.userData.def);
          if (!def) continue;
          if ((def.floor || 0) !== curFloor) continue;
          const wx = n.group ? n.group.position.x : def.x;
          const wz = n.group ? n.group.position.z : def.z;
          const p = plot(wx, wz);
          if (p.dist > RANGE * 1.05) continue;
          ctx.fillStyle = dotColor(def);
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1; ctx.stroke();
        }
      }

      // remote players (cyan), if exposed in a friendly shape
      const rp = em.remotePlayers;
      const list = rp && (rp.list || rp.players);
      if (list && typeof list.forEach === 'function') {
        list.forEach((o) => {
          const g2 = o && (o.group || o.mesh || o);
          if (!g2 || !g2.position) return;
          const p = plot(g2.position.x, g2.position.z);
          if (p.dist > RANGE * 1.05) return;
          ctx.fillStyle = '#7fe0ff';
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
        });
      }

      // player heading arrow (centre, pointing up)
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#ffe6a8';
      ctx.strokeStyle = '#5a3d12'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(0, 3); ctx.lineTo(-5, 6); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.restore();

      if (coordsPill && coordsPill.firstChild) coordsPill.firstChild.textContent = `x ${px.toFixed(1)} · z ${pz.toFixed(1)} `;
      if (floorEl) floorEl.textContent = curFloor === 1 ? '· upper' : curFloor === -1 ? '· cellar' : '';
    }
    ctx.restore();
  }
  requestAnimationFrame(frame);
}

/* ===================== Quest journal → panel tab =====================
   The quest system (quests.js) builds a floating #quest-log box plus an
   awkward floating #quest-log-toggle button. We don't own that file, so here
   we RELOCATE its live body element into the #tab-quests page and retire the
   floating chrome. Because quests.js keeps a reference to #quest-log-body and
   re-renders into it, moving the node keeps the journal fully live. We also
   surface a soft gold glow on the Quests tab whenever a quest is available. */
export function initQuestTab() {
  const slot = document.getElementById('quest-tab-body');
  const tab = document.querySelector('.tab[data-tab="quests"]');
  if (!slot || !tab) return;

  // Drive the "quest available" glow from window.eldenmoor.quests.
  function refreshAlert() {
    const q = window.eldenmoor && window.eldenmoor.quests;
    if (!q || !q.QUEST_DEFS || !q.progress) return;
    let active = false;
    for (const id of Object.keys(q.QUEST_DEFS)) {
      if (q.isActive && q.isActive(id)) { active = true; break; }
    }
    // Don't nag while the player is already looking at the tab.
    if (active && !tab.classList.contains('active')) tab.classList.add('quest-alert');
    else if (!active) tab.classList.remove('quest-alert');
  }

  // Wait for quests.js to have built its journal, then move it in.
  let tries = 0;
  function adopt() {
    const log = document.getElementById('quest-log');
    const body = document.getElementById('quest-log-body');
    const toggle = document.getElementById('quest-log-toggle');
    if (body) {
      // Relocate the live journal body into the tab and clear our placeholder.
      slot.innerHTML = '';
      body.removeAttribute('style');      // drop the floating-box inline styles
      slot.appendChild(body);
    }
    if (log) { log.hidden = true; log.style.display = 'none'; }       // retire floating box
    if (toggle) toggle.remove();                                     // remove bad floating button
    refreshAlert();
    if (body) return;                     // done once the body has been adopted
    if (++tries < 60) setTimeout(adopt, 150);
  }
  adopt();

  // Keep the glow honest as quests change (cheap poll; cosmetic only).
  setInterval(refreshAlert, 1500);
}

// Convenience: start the cosmetic HUD systems.
export function initHudExtras() {
  initTooltips();
  initMinimap();
  initQuestTab();
}
