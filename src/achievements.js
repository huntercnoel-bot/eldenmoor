// achievements.js — an OSRS×WoW-style ACHIEVEMENTS / TASK DIARY. A panel of
// milestone tasks that auto-complete as you play, each with a satisfying unlock
// toast. Fully SELF-CONTAINED: it injects its own CSS + DOM, polls
// window.eldenmoor for the live game, evaluates each achievement's check(em)
// predicate every ~1.5s, and persists unlocked tasks in localStorage so they
// stay earned across reloads. The ONLY edit elsewhere is a single import line in
// main.js (next to banking/minimap). It edits NO gameplay file and reads only
// the public window.eldenmoor API (skills/inventory/equipment/bank/monsters).
//
// Opened via a 🏆 button it adds to the DOM (bottom-right, above the tabbed
// panel). Toggle open/closed; Escape closes it.

const STORE_KEY = 'eldenmoor.achievements';

// ---- the diary -------------------------------------------------------------
// Each entry: { id, cat, name, desc, check(em) -> bool }. Keep every check inside
// its own try/catch at call time so a missing API never breaks the poll.
const ACHIEVEMENTS = [
  // --- Combat ---
  { id: 'first_blood', cat: 'Combat', name: 'First Blood',
    desc: 'Land a hit in battle — earn any combat XP.',
    check: (em) => combatXpGained(em) > 0 },
  { id: 'combatant', cat: 'Combat', name: 'Combatant',
    desc: 'Reach combat level 20.',
    check: (em) => em.skills.combatLevel() >= 20 },
  { id: 'boss_slayer', cat: 'Combat', name: 'Boss Slayer',
    desc: 'Claim a relic of the Hollow King.',
    check: (em) => owns(em, 'crown_of_the_hollow') || owns(em, 'hollow_blade') },

  // --- Levelling ---
  { id: 'apprentice', cat: 'Levelling', name: 'Apprentice',
    desc: 'Reach level 10 in any skill.',
    check: (em) => maxSkillLevel(em) >= 10 },
  { id: 'journeyman', cat: 'Levelling', name: 'Journeyman',
    desc: 'Reach a total level of 50.',
    check: (em) => em.skills.totalLevel() >= 50 },
  { id: 'adept', cat: 'Levelling', name: 'Adept',
    desc: 'Reach a total level of 150.',
    check: (em) => em.skills.totalLevel() >= 150 },

  // --- Skills ---
  { id: 'miner', cat: 'Skills', name: 'Miner',
    desc: 'Reach Mining level 10.', check: (em) => lvl(em, 'mining') >= 10 },
  { id: 'angler', cat: 'Skills', name: 'Angler',
    desc: 'Reach Fishing level 10.', check: (em) => lvl(em, 'fishing') >= 10 },
  { id: 'lumberjack', cat: 'Skills', name: 'Lumberjack',
    desc: 'Reach Woodcutting level 15.', check: (em) => lvl(em, 'woodcutting') >= 15 },
  { id: 'blacksmith', cat: 'Skills', name: 'Blacksmith',
    desc: 'Reach Smithing level 10.', check: (em) => lvl(em, 'smithing') >= 10 },
  { id: 'pyromancer', cat: 'Skills', name: 'Pyromancer',
    desc: 'Reach Magic level 10.', check: (em) => lvl(em, 'magic') >= 10 },
  { id: 'marksman', cat: 'Skills', name: 'Marksman',
    desc: 'Reach Ranged level 10.', check: (em) => lvl(em, 'ranged') >= 10 },
  { id: 'faithful', cat: 'Skills', name: 'Faithful',
    desc: 'Reach Prayer level 10.', check: (em) => lvl(em, 'prayer') >= 10 },
  { id: 'chef', cat: 'Skills', name: 'Chef',
    desc: 'Reach Cooking level 10.', check: (em) => lvl(em, 'cooking') >= 10 },

  // --- Wealth & Gear ---
  { id: 'geared_up', cat: 'Wealth & Gear', name: 'Geared Up',
    desc: 'Equip gear worth 30+ total combat bonus.',
    check: (em) => bonusTotal(em) >= 30 },
  { id: 'rich', cat: 'Wealth & Gear', name: 'Rich',
    desc: 'Hold 1,000 coins at once.',
    check: (em) => coins(em) >= 1000 },
  { id: 'banker', cat: 'Wealth & Gear', name: 'Banker',
    desc: 'Stash an item in the Bank of Eldenmoor.',
    check: (em) => bankHasItems(em) },
];

const CATEGORIES = ['Combat', 'Levelling', 'Skills', 'Wealth & Gear'];

// ---- tiny safe accessors ---------------------------------------------------
function em() { return window.eldenmoor; }
function lvl(e, id) { const s = e.skills.state[id]; return s ? s.level : 1; }
function maxSkillLevel(e) { let m = 0; for (const k in e.skills.state) m = Math.max(m, e.skills.state[k].level); return m; }
function owns(e, id) { return (e.inventory && e.inventory.count(id) > 0) || bankCount(e, id) > 0; }
function coins(e) { return (e.inventory && e.inventory.count('coins')) || 0; }
function bonusTotal(e) {
  const b = e.equipment && e.equipment.getBonuses ? e.equipment.getBonuses() : null;
  if (!b) return 0;
  return (b.attack || 0) + (b.strength || 0) + (b.defence || 0);
}
function bankCount(e, id) {
  try {
    if (!e.bank || !e.bank.store) return 0;
    const st = e.bank.store();
    const s = Array.isArray(st) && st.find((x) => x.id === id);
    return s ? s.qty : 0;
  } catch (err) { return 0; }
}
function bankHasItems(e) {
  try { return !!(e.bank && e.bank.store && e.bank.store().length > 0); } catch (err) { return false; }
}
// Combat XP relative to a fresh character. attack/strength/defence start at
// level 1 (0 xp) and hitpoints at level 10 (~1154 xp), so any gain over those
// baselines means a blow was struck.
const HP_BASE_XP = 1154; // xp for level 10 (OSRS formula) — hitpoints' starting xp
function combatXpGained(e) {
  const st = e.skills.state;
  let g = 0;
  for (const id of ['attack', 'strength', 'defence']) if (st[id]) g += st[id].xp;
  if (st.hitpoints) g += Math.max(0, st.hitpoints.xp - HP_BASE_XP);
  return g;
}

// ---- persistence -----------------------------------------------------------
let unlocked = {};   // id -> true
function loadUnlocked() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) { const o = JSON.parse(raw); if (o && typeof o === 'object') unlocked = o; }
  } catch (err) { /* localStorage may be blocked */ }
}
function saveUnlocked() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(unlocked)); } catch (err) { /* ignore */ }
}

// ---- styles ----------------------------------------------------------------
function injectStyles() {
  if (document.getElementById('ach-styles')) return;
  const css = document.createElement('style');
  css.id = 'ach-styles';
  css.textContent = `
  /* 🏆 toggle button — sits bottom-right above the tabbed panel, styled like the game's bronze buttons */
  #ach-toggle { position: fixed; right: 12px; bottom: 248px; z-index: 30; width: 40px; height: 40px;
    display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 19px;
    background: linear-gradient(180deg, #36291a 0%, #1d140c 55%, #140d06 100%);
    color: #ffd277; border: 2px solid #7a5a2c; border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255,214,119,0.18), inset 0 0 18px rgba(0,0,0,0.6), 0 4px 12px rgba(0,0,0,0.5);
    transition: border-color 0.14s ease, box-shadow 0.16s ease, transform 0.08s ease; }
  #ach-toggle:hover { border-color: #ffd277; box-shadow: inset 0 1px 0 rgba(255,214,119,0.3), 0 0 12px rgba(255,210,119,0.45); transform: translateY(-1px); }
  #ach-toggle:active { transform: translateY(0); }
  #ach-toggle .ach-badge { position: absolute; top: -6px; right: -6px; min-width: 17px; height: 17px; padding: 0 3px;
    border-radius: 9px; background: linear-gradient(180deg,#c9962f,#7a5a2c); color: #1d140c; font: 800 10px Georgia,serif;
    display: flex; align-items: center; justify-content: center; border: 1px solid #2c1d0e; }

  /* the diary panel */
  #ach-panel { position: fixed; right: 12px; bottom: 296px; z-index: 31; width: 320px; max-width: calc(100vw - 24px);
    max-height: 62vh; display: flex; flex-direction: column; overflow: hidden; color: #ecd9b0;
    background: linear-gradient(180deg, #36291a 0%, #1d140c 55%, #140d06 100%);
    border: 2px solid #7a5a2c; border-radius: 10px;
    box-shadow: inset 0 0 0 1px rgba(255,214,119,0.10), inset 0 1px 0 rgba(255,214,119,0.16),
      inset 0 0 26px rgba(0,0,0,0.7), 0 0 0 1px #2c1d0e, 0 14px 36px rgba(0,0,0,0.7); }
  #ach-panel[hidden] { display: none; }
  .ach-head { display: flex; align-items: center; gap: 8px; padding: 10px 12px 9px; border-bottom: 2px solid #5a3d22;
    background: linear-gradient(180deg, rgba(122,90,44,0.30), rgba(0,0,0,0.0)); }
  .ach-head .ach-title { font-family: Georgia, serif; font-weight: 800; font-size: 15px; letter-spacing: 0.5px;
    color: #ffd277; text-shadow: 0 1px 2px #000; flex: 1; }
  .ach-head .ach-count { font: 700 12px Georgia,serif; color: #ecd9b0; opacity: 0.85; }
  .ach-head .ach-x { cursor: pointer; color: #ecd9b0; border: 1px solid #5a3d22; border-radius: 5px; width: 22px; height: 22px;
    display: flex; align-items: center; justify-content: center; font-size: 12px; background: rgba(0,0,0,0.25); }
  .ach-head .ach-x:hover { color: #ffd277; border-color: #7a5a2c; }
  .ach-list { overflow-y: auto; padding: 6px 8px 10px; }
  .ach-cat { font: 700 11px Georgia,serif; letter-spacing: 1px; text-transform: uppercase; color: #c79a52;
    padding: 9px 4px 4px; opacity: 0.9; }
  .ach-row { display: flex; align-items: flex-start; gap: 8px; padding: 7px 7px; margin: 3px 2px; border-radius: 7px;
    border: 1px solid rgba(122,90,44,0.35); background: rgba(20,13,6,0.5); }
  .ach-row.done { border-color: rgba(201,150,47,0.7); background: linear-gradient(180deg, rgba(122,90,44,0.28), rgba(20,13,6,0.5)); }
  .ach-mark { font-size: 15px; line-height: 1.1; flex: none; width: 18px; text-align: center; }
  .ach-row.done .ach-mark { filter: drop-shadow(0 0 4px rgba(255,210,119,0.55)); }
  .ach-body { flex: 1; min-width: 0; }
  .ach-name { font: 700 13px Georgia,serif; color: #ecd9b0; }
  .ach-row.done .ach-name { color: #ffe6a8; }
  .ach-row:not(.done) .ach-name { color: #b6a888; }
  .ach-desc { font: 400 11px Georgia,serif; color: #b6a07a; margin-top: 1px; line-height: 1.3; }
  .ach-list::-webkit-scrollbar { width: 8px; }
  .ach-list::-webkit-scrollbar-track { background: rgba(0,0,0,0.25); }
  .ach-list::-webkit-scrollbar-thumb { background: #7a5a2c; border-radius: 4px; }

  /* the celebratory unlock toast — slides down from top-center */
  #ach-toasts { position: fixed; top: 54px; left: 50%; transform: translateX(-50%); z-index: 60;
    display: flex; flex-direction: column; align-items: center; gap: 8px; pointer-events: none; }
  .ach-toast { min-width: 260px; max-width: 380px; padding: 11px 18px 12px; border-radius: 10px; text-align: center;
    color: #fff3d6; background: linear-gradient(180deg, #6e512a 0%, #3a2914 60%, #241708 100%);
    border: 2px solid #ffd277; box-shadow: inset 0 1px 0 rgba(255,236,168,0.4), 0 0 18px rgba(255,210,119,0.4), 0 10px 30px rgba(0,0,0,0.6);
    animation: ach-slide-in 0.4s cubic-bezier(0.2,1.2,0.4,1) both; }
  .ach-toast.out { animation: ach-slide-out 0.45s ease forwards; }
  .ach-toast .ach-toast-top { font: 700 11px Georgia,serif; letter-spacing: 1.5px; text-transform: uppercase; color: #ffd277; }
  .ach-toast .ach-toast-name { font: 800 17px Georgia,serif; color: #fff3d6; text-shadow: 0 1px 3px #000; margin-top: 2px; }
  .ach-toast .ach-toast-desc { font: 400 11px Georgia,serif; color: #f0dcb4; opacity: 0.92; margin-top: 3px; }
  @keyframes ach-slide-in { from { opacity: 0; transform: translateY(-26px) scale(0.92); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes ach-slide-out { to { opacity: 0; transform: translateY(-22px) scale(0.96); } }
  `;
  document.head.appendChild(css);
}

// ---- DOM -------------------------------------------------------------------
let toggleBtn = null, badgeEl = null, panel = null, listEl = null, countEl = null, toastWrap = null;
let isOpen = false;

function buildDom() {
  if (panel) return;
  injectStyles();

  toggleBtn = document.createElement('div');
  toggleBtn.id = 'ach-toggle';
  toggleBtn.title = 'Achievements';
  toggleBtn.innerHTML = '🏆<span class="ach-badge" id="ach-badge">0</span>';
  toggleBtn.onclick = (e) => { e.stopPropagation(); toggle(); };
  document.body.appendChild(toggleBtn);
  badgeEl = toggleBtn.querySelector('#ach-badge');

  panel = document.createElement('div');
  panel.id = 'ach-panel';
  panel.hidden = true;
  panel.innerHTML =
    '<div class="ach-head"><span class="ach-title">🏆 Achievement Diary</span>' +
    '<span class="ach-count" id="ach-count"></span><div class="ach-x" id="ach-x">✕</div></div>' +
    '<div class="ach-list" id="ach-list"></div>';
  document.body.appendChild(panel);
  listEl = panel.querySelector('#ach-list');
  countEl = panel.querySelector('#ach-count');
  panel.querySelector('#ach-x').onclick = (e) => { e.stopPropagation(); close(); };

  toastWrap = document.createElement('div');
  toastWrap.id = 'ach-toasts';
  document.body.appendChild(toastWrap);

  renderBadge();
}

function unlockedCount() { let n = 0; for (const a of ACHIEVEMENTS) if (unlocked[a.id]) n++; return n; }

function renderBadge() {
  if (badgeEl) badgeEl.textContent = String(unlockedCount());
}

function renderPanel() {
  if (!listEl) return;
  const total = ACHIEVEMENTS.length, done = unlockedCount();
  if (countEl) countEl.textContent = done + ' / ' + total;
  let html = '';
  for (const cat of CATEGORIES) {
    const inCat = ACHIEVEMENTS.filter((a) => a.cat === cat);
    if (!inCat.length) continue;
    html += `<div class="ach-cat">${cat}</div>`;
    for (const a of inCat) {
      const got = !!unlocked[a.id];
      html += `<div class="ach-row ${got ? 'done' : ''}">` +
        `<span class="ach-mark">${got ? '✅' : '⬜'}</span>` +
        `<div class="ach-body"><div class="ach-name">${a.name}</div>` +
        `<div class="ach-desc">${a.desc}</div></div></div>`;
    }
  }
  listEl.innerHTML = html;
}

function toggle() { isOpen ? close() : open(); }
function open() { buildDom(); isOpen = true; renderPanel(); panel.hidden = false; }
function close() { isOpen = false; if (panel) panel.hidden = true; }

// ---- toast -----------------------------------------------------------------
function showToast(a) {
  if (!toastWrap) return;
  const t = document.createElement('div');
  t.className = 'ach-toast';
  t.innerHTML =
    '<div class="ach-toast-top">🏆 Achievement Unlocked</div>' +
    `<div class="ach-toast-name">${a.name}</div>` +
    `<div class="ach-toast-desc">${a.desc}</div>`;
  toastWrap.appendChild(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => { if (t.parentNode) t.parentNode.removeChild(t); }, 500);
  }, 4200);
}

// ---- the poll --------------------------------------------------------------
function poll() {
  const e = em();
  if (!e || !e.skills) return;
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (unlocked[a.id]) continue;
    let pass = false;
    try { pass = !!a.check(e); } catch (err) { pass = false; }
    if (pass) {
      unlocked[a.id] = true;
      changed = true;
      try { if (e.audio && e.audio.play) e.audio.play('levelup'); } catch (err) { /* ignore */ }
      try { if (typeof e.gameMessage === 'function') e.gameMessage('🏆 Achievement unlocked: ' + a.name + '!'); } catch (err) { /* ignore */ }
      showToast(a);
    }
  }
  if (changed) {
    saveUnlocked();
    renderBadge();
    if (isOpen) renderPanel();
  }
}

// ---- boot: load saved state, draw UI, then poll the live game --------------
// Saved unlocks are loaded BEFORE the first poll, so already-earned tasks are
// skipped by the `if (unlocked[a.id]) continue;` guard and never re-toast.
function boot() {
  loadUnlocked();
  buildDom();
  window.addEventListener('keydown', (ev) => { if (ev.code === 'Escape' && isOpen) close(); });

  let attached = false;
  setInterval(() => {
    const e = em();
    if (!e || !e.skills) return;
    if (!attached) {
      attached = true;
      // Expose a small read-only API for debugging / other modules.
      try { e.achievements = { poll, list: () => ACHIEVEMENTS.map((a) => ({ id: a.id, name: a.name, unlocked: !!unlocked[a.id] })), open, close }; } catch (err) { /* ignore */ }
    }
    poll();
  }, 1500);
}
boot();
