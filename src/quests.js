// quests.js — the quest system: definitions, per-quest state, start/advance/
// complete, a quest log (built as DOM in JS), and persistence through save.js.
//
// A quest has ordered `stages`. Each stage has:
//   { name, journal, objective: { check(ctx) -> bool, hint } }
// The player advances a stage when its objective `check` passes (polled, and
// also re-checked when talking to the relevant NPC). Rewards are handed out by
// `grant(ctx)` on completion. Quest progress is { status, stage } per quest id.
//
// `ctx` exposes the live game systems: { skills, inventory, equipment, flags }.
// `flags` is a small per-quest scratch object persisted with the save (used here
// to record "talked to the cook", etc.).

import { gameMessage } from './ui.js';

export const STATUS = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete' };

// ---------------------------------------------------------------------------
// QUEST DEFINITIONS
// ---------------------------------------------------------------------------
// The King's first quest: a classic OSRS-style starter. Talk to the King, gather
// firewood for the castle hearth (chop logs — reuses Woodcutting), deliver word
// to Bessa the cook, then return to the King for a reward.
export const QUEST_DEFS = {
  king: {
    id: 'king',
    name: "The King's Hearth",
    giver: 'king',
    intro: 'King Aldric has asked you to help warm the great hall before winter.',
    startDialogue: [
      { speaker: 'King Aldric', text: 'Ah, an adventurer! Splendid. You arrive at a fortunate hour — Eldenmoor has need of willing hands.' },
      { speaker: 'King Aldric', text: 'Winter creeps in early this year, and the great hall\'s hearth lies cold. My court shivers in their furs — most undignified.' },
      { speaker: 'King Aldric', text: 'Take an axe to the woods beyond the square and bring me 5 logs for the fire. Do this, and you\'ll have proven yourself a friend of the Crown.' },
    ],
    stages: [
      {
        name: 'Gather firewood',
        journal: 'King Aldric needs 5 logs to warm the great hall. Equip an axe and chop trees near the town square until your bag holds 5 logs.',
        objective: {
          hint: 'Chop trees until you carry 5 logs.',
          check: (ctx) => ctx.inventory.count('logs') >= 5,
        },
        // Re-talking the King while you still owe logs gives a nudge.
        nudge: [
          { speaker: 'King Aldric', text: 'Back so soon? I count fewer than 5 logs about your person. The hearth will not light itself, brave soul.' },
        ],
      },
      {
        name: 'Tell the cook',
        journal: 'You have the firewood. Bessa the castle cook tends the hearth — find her in the keep kitchen and let her know the wood has arrived.',
        objective: {
          hint: 'Speak to Bessa the cook in the castle kitchen.',
          check: (ctx) => !!ctx.flags.toldCook,
        },
        nudge: [
          { speaker: 'King Aldric', text: 'Splendid, the logs are gathered! But cold wood warms no one, brave soul.' },
          { speaker: 'King Aldric', text: 'Take word to Bessa down in the kitchen — she keeps the hearth, and she\'ll know just what to do with your firewood.' },
        ],
      },
      {
        name: 'Return to the King',
        journal: 'The hearth is laid. Return to King Aldric in the great hall to claim your reward.',
        objective: {
          hint: 'Return to King Aldric to claim your reward.',
          check: () => false, // completed by talking to the King (handled in talk flow)
        },
      },
    ],
    // Reward handed out on completion.
    reward: {
      text: '200 coins, a Stormforged axe, and 100 Woodcutting XP',
      grant: (ctx) => {
        ctx.inventory.add('coins', 200);
        ctx.inventory.add('stormforged_axe', 1);
        ctx.skills.addXp('woodcutting', 100);
      },
    },
    completeDialogue: [
      { speaker: 'King Aldric', text: 'You return! And the hall already grows warm — I can feel it from the throne. Marvellous work.' },
      { speaker: 'King Aldric', text: 'Eldenmoor thanks you. Take this purse, and this axe — Stormforged, fit for a friend of the Crown. May it never dull.' },
      { speaker: 'King Aldric', text: 'You\'ve a hero\'s spirit. Go forth — there will be greater tasks for you yet.' },
    ],
    doneDialogue: [
      { speaker: 'King Aldric', text: 'The hearth roars and my court is warm once more. You have my thanks, ever and always.' },
    ],
  },
};

// ---------------------------------------------------------------------------
// QUEST STATE + ENGINE
// ---------------------------------------------------------------------------
export function createQuests({ skills, inventory, equipment }) {
  // progress: { [questId]: { status, stage, flags } }
  const progress = {};
  for (const id of Object.keys(QUEST_DEFS)) progress[id] = { status: STATUS.NOT_STARTED, stage: 0, flags: {} };

  let logEl = null, logBodyEl = null, tabBtn = null;
  let onChange = null;
  const setChangeHandler = (fn) => { onChange = fn; };

  function ctxFor(id) {
    return { skills, inventory, equipment, flags: progress[id].flags };
  }

  function status(id) { return progress[id] ? progress[id].status : STATUS.NOT_STARTED; }
  function stage(id) { return progress[id] ? progress[id].stage : 0; }
  function isComplete(id) { return status(id) === STATUS.COMPLETE; }
  function isActive(id) { return status(id) === STATUS.IN_PROGRESS; }

  function start(id) {
    const p = progress[id];
    if (!p || p.status !== STATUS.NOT_STARTED) return false;
    p.status = STATUS.IN_PROGRESS;
    p.stage = 0;
    gameMessage('Quest started: ' + QUEST_DEFS[id].name);
    renderLog();
    if (onChange) onChange();
    return true;
  }

  // Advance the active quest if the current stage's objective is satisfied.
  // Returns true if a stage actually advanced.
  function tryAdvance(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status !== STATUS.IN_PROGRESS) return false;
    const st = def.stages[p.stage];
    if (!st) return false;
    if (st.objective && st.objective.check(ctxFor(id))) {
      p.stage++;
      gameMessage('Quest updated: ' + def.name);
      renderLog();
      if (onChange) onChange();
      return true;
    }
    return false;
  }

  // Mark a quest flag (e.g. "talked to the cook") and re-evaluate.
  function setFlag(id, key, value = true) {
    const p = progress[id];
    if (!p) return;
    p.flags[key] = value;
    tryAdvance(id);
    renderLog();
  }

  function complete(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status === STATUS.COMPLETE) return false;
    p.status = STATUS.COMPLETE;
    p.stage = def.stages.length;
    if (def.reward && def.reward.grant) def.reward.grant(ctxFor(id));
    gameMessage('Quest complete: ' + def.name + '!');
    renderLog();
    if (onChange) onChange();
    return true;
  }

  // True when the active quest has cleared its last objective stage and is
  // waiting on the giver to hand over the reward.
  function readyToComplete(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status !== STATUS.IN_PROGRESS) return false;
    return p.stage >= def.stages.length - 1;
  }

  // Poll every active quest's objective (called from the game loop, throttled).
  function poll() {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (progress[id].status === STATUS.IN_PROGRESS) tryAdvance(id);
    }
  }

  // ---- Quest log UI (built in JS; the UI Builder can restyle via the IDs) ----
  function ensureLog() {
    if (logEl) return;
    logEl = document.createElement('div');
    logEl.id = 'quest-log';
    logEl.className = 'quest-log';
    logEl.hidden = true;
    logEl.style.cssText = 'position:fixed;top:64px;right:14px;z-index:90;width:300px;max-height:60vh;overflow:auto;' +
      'box-sizing:border-box;padding:12px 14px;background:rgba(20,16,10,0.94);border:2px solid #b9892f;border-radius:10px;' +
      'color:#f3ead3;font:14px/1.45 Georgia,serif;box-shadow:0 6px 24px rgba(0,0,0,0.5);';

    const head = document.createElement('div');
    head.className = 'quest-log-head';
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;color:#ffd100;font-weight:700;font-size:16px;margin-bottom:8px;';
    head.innerHTML = '<span>📜 Quest Journal</span>';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'quest-log-close';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'cursor:pointer;background:none;border:none;color:#b9892f;font-size:16px;';
    closeBtn.onclick = () => toggleLog(false);
    head.appendChild(closeBtn);

    logBodyEl = document.createElement('div');
    logBodyEl.id = 'quest-log-body';
    logBodyEl.className = 'quest-log-body';

    logEl.append(head, logBodyEl);
    document.body.appendChild(logEl);

    // A small toggle button so the log is reachable without console poking.
    tabBtn = document.createElement('button');
    tabBtn.id = 'quest-log-toggle';
    tabBtn.className = 'quest-log-toggle';
    tabBtn.textContent = '📜 Quests';
    tabBtn.title = 'Open quest journal (J)';
    tabBtn.style.cssText = 'position:fixed;top:36px;right:14px;z-index:90;cursor:pointer;padding:5px 10px;' +
      'background:rgba(20,16,10,0.85);border:1px solid #b9892f;border-radius:6px;color:#ffd100;font:600 13px Georgia,serif;';
    tabBtn.onclick = () => toggleLog();
    document.body.appendChild(tabBtn);

    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'KeyJ') toggleLog();
    });
  }

  function toggleLog(force) {
    ensureLog();
    const show = (force === undefined) ? logEl.hidden : force;
    logEl.hidden = !show;
    if (show) renderLog();
  }

  function renderLog() {
    if (!logBodyEl) return;
    let html = '';
    const ids = Object.keys(QUEST_DEFS);
    let any = false;
    for (const id of ids) {
      const p = progress[id], def = QUEST_DEFS[id];
      if (p.status === STATUS.NOT_STARTED) continue;
      any = true;
      const done = p.status === STATUS.COMPLETE;
      html += `<div class="quest-entry" data-quest="${id}" style="margin-bottom:12px;">`;
      html += `<div class="quest-title" style="font-weight:700;color:${done ? '#7ddf7d' : '#ffd100'};">` +
        (done ? '✔ ' : '◆ ') + def.name + (done ? ' (complete)' : '') + '</div>';
      if (!done) {
        const st = def.stages[Math.min(p.stage, def.stages.length - 1)];
        html += `<div class="quest-journal" style="color:#e7dcc0;margin-top:3px;">${st.journal}</div>`;
        html += `<div class="quest-hint" style="color:#b9892f;font-style:italic;margin-top:3px;">› ${st.objective.hint}</div>`;
        // Stage checklist.
        html += '<div class="quest-stages" style="margin-top:5px;font-size:12px;color:#9a8e72;">';
        def.stages.forEach((s, i) => {
          const mark = i < p.stage ? '☑' : (i === p.stage ? '☐' : '·');
          html += `<div>${mark} ${s.name}</div>`;
        });
        html += '</div>';
      } else {
        html += `<div class="quest-journal" style="color:#9a8e72;margin-top:3px;">Reward claimed: ${def.reward ? def.reward.text : '—'}.</div>`;
      }
      html += '</div>';
    }
    logBodyEl.innerHTML = any ? html : '<div style="color:#9a8e72;font-style:italic;">No quests yet. Seek out King Aldric in the great hall.</div>';
  }

  // ---- Persistence (plugs into save.js) ----
  function serialize() {
    const o = {};
    for (const id of Object.keys(progress)) {
      const p = progress[id];
      if (p.status !== STATUS.NOT_STARTED) o[id] = { status: p.status, stage: p.stage, flags: p.flags };
    }
    return o;
  }
  function load(saved) {
    if (!saved) return;
    for (const id of Object.keys(QUEST_DEFS)) {
      const s = saved[id];
      if (s) {
        progress[id].status = s.status || STATUS.NOT_STARTED;
        progress[id].stage = typeof s.stage === 'number' ? s.stage : 0;
        progress[id].flags = s.flags || {};
      }
    }
    renderLog();
    if (onChange) onChange();
  }

  ensureLog();
  renderLog();

  return {
    QUEST_DEFS, STATUS,
    start, complete, tryAdvance, setFlag, poll,
    status, stage, isComplete, isActive, readyToComplete,
    toggleLog, renderLog, serialize, load, setChangeHandler,
    progress,
  };
}
