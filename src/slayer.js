// slayer.js — the Slayer skill / task master. Self-contained & self-initializing
// (polls window.eldenmoor). Click "New task" to be assigned a hunt — "kill N of
// monster X" — drawn from the world's monsters. Each qualifying kill (counted via
// combat.js's onKill hook) ticks the task and grants Slayer XP; finishing the
// task pays a Slayer XP bonus + coins. Exposed as window.eldenmoor.slayer.

import { gameMessage } from './ui.js';

// The pool of assignable targets, low -> high. `count` scales the hunt size and
// `xp` is the Slayer XP per kill (a completion bonus is added on top).
const TASK_POOL = [
  { id: 'giant_rat',        min: 8,  max: 15, xp: 6 },
  { id: 'frog',             min: 8,  max: 15, xp: 7 },
  { id: 'chicken',          min: 6,  max: 12, xp: 4 },
  { id: 'goblin',           min: 10, max: 18, xp: 12 },
  { id: 'wasp',             min: 10, max: 18, xp: 12 },
  { id: 'snake',            min: 12, max: 20, xp: 18 },
  { id: 'skeleton',         min: 12, max: 22, xp: 24 },
  { id: 'zombie',           min: 12, max: 20, xp: 26 },
  { id: 'skeleton_warrior', min: 10, max: 16, xp: 36 },
];

function startSlayer(em) {
  const { skills, inventory } = em;
  let task = null;   // { id, name, remaining, total, xp }

  function monsterName(id) {
    try { const t = em.monsters && em.monsters.MONSTER_TYPES && em.monsters.MONSTER_TYPES[id]; return (t && t.name) || id; }
    catch (e) { return id; }
  }

  function newTask() {
    if (task) { gameMessage('Finish your current task first: ' + task.remaining + ' ' + task.name + ' left.'); return; }
    const pick = TASK_POOL[Math.floor(Math.random() * TASK_POOL.length)];
    const total = pick.min + Math.floor(Math.random() * (pick.max - pick.min + 1));
    task = { id: pick.id, name: monsterName(pick.id), remaining: total, total, xp: pick.xp };
    gameMessage('Slayer task: defeat ' + total + ' ' + task.name + '.');
    if (em.audio && em.audio.play) em.audio.play('click');
    refresh();
  }

  function onKill(typeId) {
    if (!task || typeId !== task.id) return;
    task.remaining = Math.max(0, task.remaining - 1);
    const r = skills.addXp('slayer', task.xp);
    if (r && r.leveledUp) gameMessage('Congratulations, your Slayer is now level ' + r.level + '!');
    if (task.remaining <= 0) {
      const bonus = 25 + task.total * 3;
      const coins = 20 + task.total * 5;
      skills.addXp('slayer', bonus);
      inventory.add('coins', coins);
      gameMessage('Slayer task complete! +' + bonus + ' Slayer xp and ' + coins + ' coins.');
      if (em.audio && em.audio.play) em.audio.play('levelup');
      task = null;
    }
    refresh();
  }

  function cancelTask() { if (task) { gameMessage('You abandon your Slayer task.'); task = null; refresh(); } }

  // --- compact HUD panel (bottom-left) --------------------------------------
  const panel = document.createElement('div');
  panel.id = 'slayer-panel';
  panel.style.cssText = 'position:fixed;left:12px;bottom:14px;z-index:24;font-family:Georgia,serif;' +
    'background:rgba(20,16,24,0.62);border:1px solid #7a5a8a;border-radius:9px;padding:6px 9px;' +
    'color:#e7d8f0;font-size:12.5px;text-shadow:0 1px 2px #000;min-width:150px;user-select:none;';
  document.body.appendChild(panel);
  function refresh() {
    if (task) {
      panel.innerHTML = '<div style="font-weight:700;margin-bottom:3px">💀 Slayer task</div>' +
        '<div>' + (task.total - task.remaining) + ' / ' + task.total + ' <b>' + task.name + '</b></div>' +
        '<div id="slayer-cancel" style="margin-top:4px;cursor:pointer;color:#c79be0;font-size:11px">✖ Abandon task</div>';
      const c = panel.querySelector('#slayer-cancel'); if (c) c.onclick = cancelTask;
    } else {
      panel.innerHTML = '<div style="font-weight:700;margin-bottom:3px">💀 Slayer</div>' +
        '<div id="slayer-new" style="cursor:pointer;color:#d8b6f0">＋ Get a new task</div>';
      const n = panel.querySelector('#slayer-new'); if (n) n.onclick = newTask;
    }
  }
  refresh();

  return { newTask, onKill, cancelTask, get task() { return task; } };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.slayer = startSlayer(em); }
      catch (err) { console.error('[slayer] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
