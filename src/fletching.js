// fletching.js — the Fletching skill. Self-contained & self-initializing (polls
// window.eldenmoor). With a KNIFE in your bag, right-click logs to whittle them
// into arrow shafts or an unstrung bow; right-click shafts (with feathers) to
// fletch arrows; right-click an unstrung bow (with a bow string) to string it.
// Trains Fletching and feeds the Ranged skill with home-made bows + ammo.
// Exposed as window.eldenmoor.fletching.

import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

// Recipes keyed by the inventory item you right-click. Each lists the tool/extra
// item required, the Fletching level + XP, what's produced and how many, and the
// menu label. `per` actions repeat to use up a stack (e.g. shafts->arrows).
const FROM_LOGS = {
  logs: [
    { label: 'Arrow shafts', need: 'knife', level: 1,  xp: 5,    makes: 'arrow_shaft', qty: 15 },
    { label: 'Shortbow (u)', need: 'knife', level: 5,  xp: 5,    makes: 'shortbow_u',  qty: 1 },
  ],
  oak_logs: [
    { label: 'Oak shortbow (u)', need: 'knife', level: 20, xp: 16, makes: 'oak_shortbow_u', qty: 1 },
  ],
};
// "combine" recipes: right-click item A, consume A + B, make C (repeats over the stack)
const COMBINE = {
  arrow_shaft:    { label: 'Bronze arrows', with: 'feather',    level: 1,  xp: 2,  makes: 'bronze_arrow' },
  shortbow_u:     { label: 'String shortbow', with: 'bow_string', level: 5,  xp: 5,  makes: 'shortbow' },
  oak_shortbow_u: { label: 'String oak shortbow', with: 'bow_string', level: 20, xp: 16, makes: 'oak_shortbow' },
};

function startFletching(em) {
  const { skills, inventory } = em;
  const lvl = () => (skills.state.fletching && skills.state.fletching.level) || 1;

  function makeFromLogs(logId, r) {
    if (inventory.count(r.need) < 1) { gameMessage('You need a ' + ITEMS[r.need].name.toLowerCase() + ' to do that.'); return; }
    if (lvl() < r.level) { gameMessage('You need Fletching level ' + r.level + ' to make a ' + ITEMS[r.makes].name.toLowerCase() + '.'); return; }
    if (!inventory.removeOne(logId)) return;
    inventory.add(r.makes, r.qty);
    const res = skills.addXp('fletching', r.xp);
    gameMessage('You carve the ' + ITEMS[logId].name.toLowerCase() + ' into ' + (r.qty > 1 ? r.qty + ' ' : 'a ') + ITEMS[r.makes].name.toLowerCase() + '.');
    if (em.audio && em.audio.play) em.audio.play('chop');
    if (res && res.leveledUp) gameMessage('Congratulations, your Fletching is now level ' + res.level + '!');
  }

  function combine(itemId, r) {
    if (inventory.count(r.with) < 1) { gameMessage('You need ' + ITEMS[r.with].name.toLowerCase() + ' for that.'); return; }
    if (lvl() < r.level) { gameMessage('You need Fletching level ' + r.level + ' to make ' + ITEMS[r.makes].name.toLowerCase() + '.'); return; }
    // make as many as the two stacks allow, up to a sensible batch
    const batch = Math.min(15, inventory.count(itemId), inventory.count(r.with));
    if (batch < 1) return;
    let made = 0, leveled = null;
    for (let i = 0; i < batch; i++) {
      if (!inventory.removeOne(itemId)) break;
      if (!inventory.removeOne(r.with)) { inventory.add(itemId, 1); break; }
      inventory.add(r.makes, 1);
      const res = skills.addXp('fletching', r.xp);
      if (res && res.leveledUp) leveled = res.level;
      made++;
    }
    if (made) {
      gameMessage('You fletch ' + made + ' ' + ITEMS[r.makes].name.toLowerCase() + (made > 1 ? '' : '') + '.');
      if (em.audio && em.audio.play) em.audio.play('chop');
      if (leveled) gameMessage('Congratulations, your Fletching is now level ' + leveled + '!');
    }
  }

  // ---- our own little context menu (mirrors contextmenu.js's look) ----------
  let menuEl = null;
  function showMenu(x, y, title, options) {
    if (!menuEl) {
      menuEl = document.createElement('div');
      menuEl.id = 'fletch-ctxmenu';
      menuEl.className = 'frame';
      menuEl.style.cssText = 'position:fixed;z-index:50;min-width:160px;overflow:hidden;font-size:13px;border-radius:6px;pointer-events:auto;';
      document.body.appendChild(menuEl);
      window.addEventListener('click', () => { if (menuEl) menuEl.hidden = true; });
    }
    menuEl.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'ctx-head'; head.textContent = title;
    menuEl.appendChild(head);
    for (const opt of options.concat([{ label: 'Cancel' }])) {
      const row = document.createElement('div');
      row.className = 'ctx-item'; row.innerHTML = opt.label;
      row.addEventListener('click', (ev) => { ev.stopPropagation(); menuEl.hidden = true; if (opt.action) opt.action(); });
      menuEl.appendChild(row);
    }
    menuEl.style.left = x + 'px'; menuEl.style.top = y + 'px'; menuEl.hidden = false;
    const r = menuEl.getBoundingClientRect();
    if (r.right > window.innerWidth) menuEl.style.left = (window.innerWidth - r.width - 6) + 'px';
    if (r.bottom > window.innerHeight) menuEl.style.top = (window.innerHeight - r.height - 6) + 'px';
  }

  const invGrid = document.getElementById('inv-grid');
  if (invGrid) invGrid.addEventListener('contextmenu', (e) => {
    const slotEl = e.target.closest('.inv-slot');
    if (!slotEl || slotEl.dataset.slot === undefined) return;
    const s = inventory.slots[+slotEl.dataset.slot];
    if (!s) return;
    let opts = null, title = ITEMS[s.id] ? ITEMS[s.id].name : '';
    if (FROM_LOGS[s.id] && inventory.count('knife') > 0) {
      opts = FROM_LOGS[s.id].map((r) => ({ label: 'Fletch <span class="ctx-yellow">' + r.label + '</span>', action: () => makeFromLogs(s.id, r) }));
    } else if (COMBINE[s.id] && inventory.count(COMBINE[s.id].with) > 0) {
      const r = COMBINE[s.id];
      opts = [{ label: 'Fletch <span class="ctx-yellow">' + r.label + '</span>', action: () => combine(s.id, r) }];
    }
    if (!opts) return;
    e.preventDefault(); e.stopPropagation();
    showMenu(e.clientX, e.clientY, title, opts);
  }, true);

  return { makeFromLogs, combine };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.fletching = startFletching(em); }
      catch (err) { console.error('[fletching] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
