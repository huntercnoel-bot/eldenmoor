// banking.js — an OSRS-style BANK. Talk to (or right-click) Edra the banker and a
// large parchment vault window opens beside your backpack: DEPOSIT items in from
// the bag, WITHDRAW them back out. The bank is effectively unlimited and STACKS
// everything — even non-stackables pile into a single tab entry, just like OSRS.
//
// Self-contained: this module injects its own CSS + DOM, polls window.eldenmoor
// for the live game (inventory/items/interactions), and wires the banker NPC by
// patching the talk flow and listening for right-clicks. It uses ONLY the
// inventory's existing public API (add / removeN / removeOne / count / slots), so
// inventory.js needs no changes. The only edits elsewhere:
//   • save.js  — serializes/loads window.eldenmoor.bank additively (vault persists
//                per account, exactly like the inventory does).
//   • main.js  — a single import line:  import './banking.js';
//
// Exposes window.eldenmoor.bank = { open, close, deposit, withdraw, serialize, load }.

import { ITEMS } from './items.js';

const BANKER_ID = 'banker';

// The vault: an ordered list of { id, qty } stacks. Order = first-deposited.
let store = [];          // banked stacks
let panel = null, gridEl = null, titleEl = null, closeEl = null, depAllEl = null, emptyEl = null;
let invHookInstalled = false;
let isOpen = false;

// ---- tiny helpers ----------------------------------------------------------
function em() { return window.eldenmoor; }
function inv() { const e = em(); return e && e.inventory; }
function msg(t) { const e = em(); if (e && e.gameMessage) return e.gameMessage(t); const el = document.getElementById('gamemsg'); if (el) { el.textContent = t; el.style.opacity = '1'; setTimeout(() => (el.style.opacity = '0'), 3000); } }
function def(id) { return ITEMS[id]; }
function findStack(id) { return store.find((s) => s.id === id); }

// OSRS-style number shortening (mirrors inventory.js formatQty).
function fmt(n) {
  if (n >= 10000000) return Math.floor(n / 1000000) + 'M';
  if (n >= 1000000) return Math.floor(n / 100000) / 10 + 'M';
  if (n >= 100000) return Math.floor(n / 1000) + 'K';
  if (n >= 1000) return Math.floor(n / 100) / 10 + 'K';
  return '' + n;
}

// ---- core bank operations --------------------------------------------------

// Move `qty` of an item from the bag into the vault. Returns the amount banked.
function deposit(id, qty = 1) {
  const inventory = inv();
  if (!inventory || !def(id)) return 0;
  const have = inventory.count(id);
  const n = Math.min(qty, have);
  if (n <= 0) return 0;
  // pull from the bag (works for stackable + non-stackable alike)
  let removed = 0;
  if (typeof inventory.removeN === 'function' && def(id).stackable) {
    inventory.removeN(id, n); removed = n;
  } else {
    for (let i = 0; i < n; i++) { if (inventory.removeOne(id)) removed++; else break; }
  }
  if (removed <= 0) return 0;
  const stack = findStack(id);
  if (stack) stack.qty += removed; else store.push({ id, qty: removed });
  if (isOpen) render();
  return removed;
}

// Deposit every stack/slot currently in the bag.
function depositAll() {
  const inventory = inv();
  if (!inventory) return;
  // snapshot the distinct ids present, then bank each fully
  const ids = [];
  for (const s of inventory.slots) if (s && !ids.includes(s.id)) ids.push(s.id);
  if (!ids.length) { msg('Your bag is already empty.'); return; }
  let moved = 0;
  for (const id of ids) moved += deposit(id, inventory.count(id));
  if (moved > 0) msg('You deposit everything into the bank.');
}

// Move `qty` of a banked item back into the bag. Returns the amount withdrawn.
function withdraw(id, qty = 1) {
  const inventory = inv();
  const stack = findStack(id);
  if (!inventory || !stack) return 0;
  let n = Math.min(qty, stack.qty);
  if (n <= 0) return 0;
  let added = 0;
  if (def(id).stackable) {
    if (inventory.add(id, n)) added = n;            // one slot, takes the lot
  } else {
    for (let i = 0; i < n; i++) { if (inventory.add(id, 1)) added++; else break; }  // each needs a free slot
  }
  if (added <= 0) { msg('Your bag is full.'); return 0; }
  stack.qty -= added;
  if (stack.qty <= 0) store = store.filter((s) => s !== stack);
  if (added < n) msg('Your bag is full.');
  if (isOpen) render();
  return added;
}

// ---- persistence (called additively from save.js) --------------------------
function serialize() { return store.map((s) => ({ id: s.id, qty: s.qty })); }
function load(data) {
  store = [];
  if (Array.isArray(data)) {
    for (const s of data) {
      if (s && def(s.id) && s.qty > 0) {
        const ex = findStack(s.id);
        if (ex) ex.qty += s.qty; else store.push({ id: s.id, qty: s.qty });
      }
    }
  }
  if (isOpen) render();
}

// ---- UI --------------------------------------------------------------------
function injectStyles() {
  if (document.getElementById('bank-styles')) return;
  const css = document.createElement('style');
  css.id = 'bank-styles';
  css.textContent = `
  #bank { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 21; width: 560px;
    max-width: calc(100vw - 24px); padding: 0; overflow: hidden; color: #3a2a18;
    background: linear-gradient(160deg, #eddcb2 0%, #ddc695 100%);
    border: 5px solid #5a3d22; border-radius: 6px;
    box-shadow: 0 0 0 2px #2a1c10, 0 0 0 4px #8a6030, inset 0 0 60px rgba(120,90,50,0.4), 0 16px 50px rgba(0,0,0,0.75); }
  #bank[hidden] { display: none; }
  .bank-sign { position: relative; text-align: center; padding: 13px 40px 11px; border-bottom: 3px solid #2a1c10;
    background: linear-gradient(180deg, #7a5530, #432d19); }
  .bank-sign::before, .bank-sign::after { content: ''; position: absolute; top: 50%; width: 8px; height: 8px; border-radius: 50%;
    transform: translateY(-50%); background: radial-gradient(circle at 35% 30%, #ffe6a8, #8a6030 65%, #3a2410);
    box-shadow: 0 1px 2px rgba(0,0,0,0.6); }
  .bank-sign::before { left: 13px; } .bank-sign::after { right: 13px; }
  #bank-title { font-family: 'Old English Text MT', 'Blackadder ITC', Georgia, serif; color: #f4dca4;
    font-size: 22px; letter-spacing: 1px; text-shadow: 0 2px 3px #000, 0 0 8px rgba(255,210,119,0.3); }
  #bank-close { position: absolute; top: 9px; right: 11px; background: #4a3018; color: #f4dca4;
    border: 1px solid #2a1c10; border-radius: 5px; width: 26px; height: 26px; cursor: pointer; z-index: 2; font-size: 13px;
    box-shadow: inset 0 1px 0 rgba(255,214,119,0.2); }
  #bank-close:hover { background: #6b4a2a; }
  .bank-hint { text-align: center; font-style: italic; color: #6b4a2a; font-size: 12px; padding: 8px 14px 2px; font-family: Georgia, serif; }
  /* the big scrollable vault grid */
  #bank-grid { display: grid; grid-template-columns: repeat(7, 48px); grid-auto-rows: 48px; gap: 6px;
    justify-content: center; padding: 12px 14px; max-height: 300px; overflow-y: auto; }
  .bank-slot { position: relative; width: 48px; height: 48px; border-radius: 5px; cursor: pointer;
    background: radial-gradient(circle at 50% 38%, #241a0e, #120c06 78%);
    border: 1px solid #8a6d3a; box-shadow: inset 0 0 8px rgba(0,0,0,0.7);
    display: flex; align-items: center; justify-content: center; transition: border-color 0.14s ease, box-shadow 0.16s ease, transform 0.09s ease; }
  .bank-slot:hover { border-color: #ffd277; box-shadow: inset 0 0 8px rgba(0,0,0,0.7), 0 0 9px rgba(255,210,119,0.45); transform: translateY(-1px); }
  .bank-slot:active { transform: translateY(0); }
  .bank-slot svg { width: 38px; height: 38px; display: block; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7)); }
  .bank-qty { position: absolute; top: 1px; left: 3px; font-size: 11px; font-weight: 800; color: #ffd277; text-shadow: 0 1px 2px #000, 0 0 3px #000; }
  .bank-empty { text-align: center; color: #6b5535; font-style: italic; font-size: 13px; padding: 30px 16px; font-family: Georgia, serif; }
  .bank-foot { background: rgba(90,61,34,0.18); border-top: 2px solid #5a3d22; padding: 9px 14px; font-size: 12px;
    color: #5a4326; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .bank-foot .bank-tip { font-style: italic; }
  .bank-btn { background: linear-gradient(180deg, #7a5530, #4a3018); color: #f4dca4; border: 1px solid #2a1c10;
    border-radius: 5px; padding: 6px 14px; cursor: pointer; font-weight: 700; font-size: 12px; font-family: Georgia, serif;
    box-shadow: inset 0 1px 0 rgba(255,214,119,0.25); white-space: nowrap; }
  .bank-btn:hover { background: linear-gradient(180deg, #9a6c38, #5a3d22); box-shadow: inset 0 1px 0 rgba(255,214,119,0.35), 0 0 8px rgba(255,210,119,0.4); }
  #bank-grid::-webkit-scrollbar { width: 8px; }
  #bank-grid::-webkit-scrollbar-track { background: rgba(90,61,34,0.15); }
  #bank-grid::-webkit-scrollbar-thumb { background: #8a6030; border-radius: 4px; }
  #bank:not([hidden]) { animation: em-pop-in 0.18s ease both; }
  /* right-click menus — mirror the world #ctxmenu frame so they look native */
  .bank-ctxmenu { position: fixed; z-index: 50; min-width: 158px; overflow: hidden; font-size: 13px; border-radius: 8px; pointer-events: auto;
    background: linear-gradient(180deg, #36291a 0%, #1d140c 55%, #140d06 100%);
    border: 2px solid #7a5a2c;
    box-shadow: inset 0 0 0 1px rgba(255,214,119,0.10), inset 0 1px 0 rgba(255,214,119,0.16),
      inset 0 0 22px rgba(0,0,0,0.78), 0 0 0 1px #2c1d0e, 0 10px 28px rgba(0,0,0,0.65); }
  `;
  document.head.appendChild(css);
}

function buildDom() {
  if (panel) return;
  injectStyles();
  panel = document.createElement('div');
  panel.id = 'bank';
  panel.hidden = true;
  panel.innerHTML =
    '<button id="bank-close">✕</button>' +
    '<div class="bank-sign"><span id="bank-title">Bank of Eldenmoor</span></div>' +
    '<div class="bank-hint">Click a banked item to <b>withdraw one</b> · right-click for more · click a bag item to <b>deposit</b></div>' +
    '<div id="bank-grid"></div>' +
    '<div class="bank-empty" id="bank-empty" hidden>Your bank is empty. Deposit something from your bag.</div>' +
    '<div class="bank-foot"><span class="bank-tip">Your items are safe here, forever.</span>' +
    '<button class="bank-btn" id="bank-depall">Deposit all</button></div>';
  document.body.appendChild(panel);
  gridEl = panel.querySelector('#bank-grid');
  titleEl = panel.querySelector('#bank-title');
  closeEl = panel.querySelector('#bank-close');
  depAllEl = panel.querySelector('#bank-depall');
  emptyEl = panel.querySelector('#bank-empty');
  closeEl.onclick = close;
  depAllEl.onclick = depositAll;

  // Right-click a banked stack → withdraw-1 / withdraw-all / examine.
  gridEl.addEventListener('contextmenu', (e) => {
    e.preventDefault(); e.stopPropagation();
    const cell = e.target.closest('.bank-slot');
    if (!cell || cell.dataset.id === undefined) return;
    const id = cell.dataset.id;
    bankMenu(e.clientX, e.clientY, id);
  });
}

// A small OSRS-style right-click menu reusing the game's #ctxmenu styling.
function bankMenu(x, y, id) {
  const d = def(id); if (!d) return;
  // A standalone menu that borrows the world #ctxmenu's CSS (via id) but lives
  // as its own node so it never clashes with contextmenu.js's element. We give
  // it the #ctxmenu id only while shown for styling, then remove it.
  let menu = document.getElementById('bank-ctxmenu');
  if (menu) menu.remove();
  menu = document.createElement('div');
  menu.id = 'bank-ctxmenu';
  menu.className = 'bank-ctxmenu';
  document.body.appendChild(menu);
  const head = document.createElement('div'); head.className = 'ctx-head'; head.textContent = d.name; menu.appendChild(head);
  const opts = [
    { label: 'Withdraw <span class="ctx-yellow">1</span>', action: () => withdraw(id, 1) },
    { label: 'Withdraw <span class="ctx-yellow">10</span>', action: () => withdraw(id, 10) },
    { label: 'Withdraw <span class="ctx-yellow">All</span>', action: () => { const s = findStack(id); if (s) withdraw(id, s.qty); } },
    { label: 'Examine', action: () => msg(d.examine || d.name) },
    { label: 'Cancel', action: () => {} },
  ];
  for (const o of opts) {
    const row = document.createElement('div'); row.className = 'ctx-item'; row.innerHTML = o.label;
    row.addEventListener('click', (ev) => { ev.stopPropagation(); menu.remove(); o.action(); });
    menu.appendChild(row);
  }
  menu.hidden = false;
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 6) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 6) + 'px';
  const close1 = () => { menu.remove(); window.removeEventListener('click', close1); };
  setTimeout(() => window.addEventListener('click', close1), 0);
}

function render() {
  if (!gridEl) return;
  gridEl.innerHTML = '';
  if (!store.length) { if (emptyEl) emptyEl.hidden = false; gridEl.style.display = 'none'; return; }
  if (emptyEl) emptyEl.hidden = true;
  gridEl.style.display = 'grid';
  for (const s of store) {
    const d = def(s.id);
    if (!d) continue;
    const cell = document.createElement('div');
    cell.className = 'bank-slot';
    cell.dataset.id = s.id;
    cell.innerHTML = d.icon + `<span class="bank-qty">${fmt(s.qty)}</span>`;
    cell.title = d.name + ' — click to withdraw one';
    cell.onclick = () => withdraw(s.id, 1);
    gridEl.appendChild(cell);
  }
}

// Intercept clicks on bag slots while the bank is open → deposit instead of
// equip/sell. We use a capture-phase listener so we run before inventory.js's
// own per-slot onclick handler, and only swallow the event when the bank is up.
function installInvHook() {
  if (invHookInstalled) return;
  const grid = document.getElementById('inv-grid');
  if (!grid) return;
  invHookInstalled = true;
  grid.addEventListener('click', (e) => {
    if (!isOpen) return;
    const slotEl = e.target.closest('.inv-slot');
    if (!slotEl || slotEl.dataset.slot === undefined) return;
    const inventory = inv(); if (!inventory) return;
    const s = inventory.slots[+slotEl.dataset.slot];
    if (!s) return;
    e.stopPropagation();        // don't equip/sell
    e.preventDefault();
    deposit(s.id, s.qty);       // bank the whole stack/slot of that item
  }, true);
}

function open() {
  buildDom();
  installInvHook();
  isOpen = true;
  // Make sure the character panel (bag) is visible so the player can deposit.
  const p = document.getElementById('panel'); if (p) p.classList.remove('hidden');
  render();
  panel.hidden = false;
}
function close() { isOpen = false; if (panel) panel.hidden = true; }

// ---- NPC wiring ------------------------------------------------------------
// Patch the talk flow so talking to Edra opens the bank, and add a right-click
// "Bank Edra" path. Done by polling for window.eldenmoor and then wrapping.
function wireBanker() {
  const e = em();
  if (!e) return false;

  // 1) talk(): wrap em.talk so the banker opens the bank.
  if (e.talk && !e.talk.__bankWrapped) {
    const orig = e.talk;
    const wrapped = (npcId) => { if (npcId === BANKER_ID) { open(); return; } return orig(npcId); };
    wrapped.__bankWrapped = true;
    e.talk = wrapped;
  }

  // 2) Default left-click / context "Talk-to" routes through interactions ->
  //    npcDefault. We can't see that closure, but the world right-click menu is
  //    built fresh each time in contextmenu.js using interactions.raycastWorld.
  //    Add our own capture-phase contextmenu on the canvas that, when the banker
  //    is the target, opens the bank directly (alongside the normal menu the
  //    player can also just left-click to walk over and talk).
  if (!wireBanker.__clickHooked && e.interactions && e.renderer && e.renderer.domElement) {
    wireBanker.__clickHooked = true;
    const dom = e.renderer.domElement;

    // Right-click the banker → quick "Bank Edra" / "Talk-to Edra" menu (both
    // walk over and open the vault). Capture-phase + stopPropagation so we fully
    // replace the world's default menu for the banker only.
    dom.addEventListener('contextmenu', (ev) => {
      const w = e.interactions.raycastWorld(ev.clientX, ev.clientY);
      if (w.npc && w.npc.userData && w.npc.userData.def && w.npc.userData.def.id === BANKER_ID) {
        ev.preventDefault(); ev.stopPropagation();
        bankerMenu(ev.clientX, ev.clientY, w.npc);
      }
    }, true);

    // Left-click the banker → walk over and open the vault (instead of the old
    // "vaults open soon" dialogue). We mirror interactions.js's own click vs.
    // drag test (>6px = a camera drag, ignore).
    let dx0 = 0, dy0 = 0;
    dom.addEventListener('mousedown', (ev) => { if (ev.button === 0) { dx0 = ev.clientX; dy0 = ev.clientY; } }, true);
    dom.addEventListener('mouseup', (ev) => {
      if (ev.button !== 0) return;
      if (Math.hypot(ev.clientX - dx0, ev.clientY - dy0) > 6) return;
      const w = e.interactions.raycastWorld(ev.clientX, ev.clientY);
      if (w.npc && w.npc.userData && w.npc.userData.def && w.npc.userData.def.id === BANKER_ID) {
        ev.stopPropagation();   // pre-empt interactions.js's own mouseup walk-and-talk
        e.interactions.setNpcTarget(w.npc, open);
      }
    }, true);
  }
  return true;
}

function bankerMenu(x, y, npcGroup) {
  const e = em();
  let menu = document.getElementById('bank-ctxmenu');
  if (menu) menu.remove();
  menu = document.createElement('div');
  menu.id = 'bank-ctxmenu';
  menu.className = 'bank-ctxmenu';
  document.body.appendChild(menu);
  const head = document.createElement('div'); head.className = 'ctx-head'; head.textContent = 'Choose Option'; menu.appendChild(head);
  const walkThenBank = () => { if (e.interactions) e.interactions.setNpcTarget(npcGroup, open); else open(); };
  const opts = [
    { label: 'Bank <span class="ctx-yellow">Edra</span>', action: walkThenBank },
    { label: 'Talk-to <span class="ctx-yellow">Edra</span>', action: walkThenBank },
    { label: 'Examine <span class="ctx-yellow">Edra</span>', action: () => msg((npcGroup.userData.def && npcGroup.userData.def.examine) || 'A sharp-eyed banker.') },
    { label: 'Cancel', action: () => {} },
  ];
  for (const o of opts) {
    const row = document.createElement('div'); row.className = 'ctx-item'; row.innerHTML = o.label;
    row.addEventListener('click', (ev) => { ev.stopPropagation(); menu.remove(); o.action(); });
    menu.appendChild(row);
  }
  menu.style.left = x + 'px'; menu.style.top = y + 'px';
  const r = menu.getBoundingClientRect();
  if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 6) + 'px';
  if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 6) + 'px';
  const close1 = () => { menu.remove(); window.removeEventListener('click', close1); };
  setTimeout(() => window.addEventListener('click', close1), 0);
}

// ---- boot: poll for the live game, then attach -----------------------------
function boot() {
  const e = em();
  if (e && e.inventory && e.interactions) {
    // Expose the API as soon as the game exists (save.js looks for it).
    e.bank = { open, close, deposit, withdraw, depositAll, serialize, load, isOpen: () => isOpen, store: () => store };
    wireBanker();
    buildDom();
    installInvHook();
    // If a save loaded before we attached (load() runs before window.eldenmoor
    // is assigned), pull the banked data it stashed on the standalone global.
    if (Array.isArray(window.__eldenmoorPendingBank)) { load(window.__eldenmoorPendingBank); window.__eldenmoorPendingBank = null; }
    // Close the bank when the player walks away / changes floor isn't tracked,
    // but Escape should dismiss it like other panels.
    window.addEventListener('keydown', (ev) => { if (ev.code === 'Escape' && isOpen) close(); });
    return;
  }
  setTimeout(boot, 200);
}
boot();
