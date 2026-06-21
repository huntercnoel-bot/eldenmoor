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
// The King's first quest: a classic OSRS-style starter and the player's first
// real taste of Eldenmoor. King Aldric's three-hundred-year-old great-hall hearth
// has gone cold as an early winter bites. The quest walks the player through the
// whole Woodcutting loop, then escalates into a small "lay and light the fire"
// payoff:
//   0) Gather firewood from the woods (reuses Woodcutting + an equipped axe).
//   1) Carry the firewood down to Bessa the cook, who keeps the hearth.
//   2) Return to the King — the fire is laid and lit, the hall is warm again.
// The reward is tuned for a brand-new adventurer: starter coins, a healthy slice
// of Woodcutting XP for the work, a steel axe to grow into, and a tinderbox for
// the road.
//
// NOTE: the stage layout (logs at stage 0, cook at stage 1, King at the last
// stage) is what the talk flow in main.js keys off, so it is kept stable — the
// craft here is in making every beat feel alive without changing that shape.
const LOGS_NEEDED = 5;

export const QUEST_DEFS = {
  king: {
    id: 'king',
    name: "The King's Hearth",
    giver: 'king',
    // City/area this quest belongs to. The journal groups quests by `city`, so a
    // future city's quests slot into the same panel automatically just by setting
    // this field. Unset quests fall back to 'Eldenmoor'.
    city: 'Eldenmoor',
    intro: 'The great hall\'s ancient hearth has gone cold, and King Aldric seeks a willing soul to warm it before winter truly sets in.',
    startDialogue: [
      { speaker: 'King Aldric', text: 'Ah — a new face, and an able-looking one. Come closer, adventurer; the throne is draughty and my voice is not what it was.' },
      { speaker: 'King Aldric', text: 'Winter has come early and unkind to Eldenmoor. Worse still, the great hall\'s hearth lies cold — the first time in three hundred years its fire has died.' },
      { speaker: 'King Aldric', text: 'My court shivers in their furs, my steward grumbles over his ledgers, and I — sovereign of this realm — can no longer feel my royal toes. It simply will not do.' },
      { speaker: 'King Aldric', text: 'Take an axe to the woods beyond the square and cut me ' + LOGS_NEEDED + ' good logs for the fire. A small thing — but do it well, and you\'ll have proven yourself a true friend of the Crown.' },
    ],
    stages: [
      {
        name: 'Gather firewood',
        journal: 'King Aldric\'s great hall has gone cold. Equip an axe and chop trees in the woods beyond the square until you carry ' + LOGS_NEEDED + ' logs for the hearth.',
        objective: {
          hint: 'Chop trees until you carry ' + LOGS_NEEDED + ' logs.',
          check: (ctx) => ctx.inventory.count('logs') >= LOGS_NEEDED,
        },
        // Re-talking the King while you still owe logs gives a gentle nudge.
        nudge: [
          { speaker: 'King Aldric', text: 'Back already? Let me see... no, no — your bag wants for firewood yet. I count fewer than ' + LOGS_NEEDED + ' logs upon you.' },
          { speaker: 'King Aldric', text: 'Hilda by the square sells a fine axe if you\'ve none, and the woods are thick beyond the gate. The hearth will not light itself, brave soul — though heaven knows I\'ve sat here willing it to.' },
        ],
      },
      {
        name: 'Take the wood to Bessa',
        journal: 'You have the firewood. Bessa the castle cook keeps the great-hall hearth — carry the logs down to the keep kitchen and tell her the wood has come at last.',
        objective: {
          hint: 'Carry the logs to Bessa the cook in the castle kitchen.',
          check: (ctx) => !!ctx.flags.toldCook,
        },
        nudge: [
          { speaker: 'King Aldric', text: 'Splendid — fresh-cut logs, and good ones too! I can almost feel the warmth already. Almost.' },
          { speaker: 'King Aldric', text: 'But cold wood warms no one, eh? Take it down to Bessa in the kitchen — she has kept that hearth since my father\'s day and will lay the fire properly. Then return, and we\'ll see it lit together.' },
        ],
      },
      {
        name: 'Return to the King',
        journal: 'Bessa has laid the fire and the kindling has caught. Return to King Aldric in the great hall to see the hearth roar — and to claim his thanks.',
        objective: {
          hint: 'Return to King Aldric in the great hall.',
          check: () => false, // completed by talking to the King (handled in the talk flow)
        },
        // Shown if the player re-opens the King on the final stage before the talk
        // flow hands in (kept for completeness — the talk flow normally turns in).
        nudge: [
          { speaker: 'King Aldric', text: 'The fire is laid below and the kindling has caught — I can smell the woodsmoke on the air. Stand a moment, and watch an old hearth wake.' },
        ],
      },
    ],
    // Reward handed out on completion. Takes the firewood the player carried up
    // (so the delivery feels real) and pays out something an early adventurer can
    // genuinely use: starter coins, a healthy slice of Woodcutting XP, and a steel
    // axe with a tinderbox for the road.
    reward: {
      text: '300 coins, 250 Woodcutting XP, a Steel Axe, and a Tinderbox',
      grant: (ctx) => {
        // Consume the firewood you brought — the hearth devours it gladly.
        ctx.inventory.removeN('logs', LOGS_NEEDED);
        ctx.inventory.add('coins', 300);
        ctx.inventory.add('steel_axe', 1);
        ctx.inventory.add('tinderbox', 1);
        ctx.skills.addXp('woodcutting', 250);
      },
    },
    completeDialogue: [
      { speaker: 'King Aldric', text: 'You return! And — ah, do you hear it? The crackle, the snap of dry wood catching. Bessa has worked her quiet magic, and the great hall breathes warm once more.' },
      { speaker: 'King Aldric', text: 'Three hundred years that fire has burned, and tonight it owes its life to you. The whole court can feel it — even my steward managed something close to a smile. A rare omen indeed.' },
      { speaker: 'King Aldric', text: 'A friend of the Crown does not go unthanked. Here — a purse to set you on your way, and a steel axe; sturdier than whatever you swung in my woods today. Take a tinderbox, too, so you need never be cold on the road.' },
      { speaker: 'King Aldric', text: 'Go now, and warm yourself by the fire you saved. There will be greater trials than cold toes ahead — and when they come, brave soul, I shall know whose name to call.' },
    ],
    doneDialogue: [
      { speaker: 'King Aldric', text: 'The hearth roars, the hall is warm, and my toes — bless them — have feeling once more. You have the lasting thanks of the Crown, friend.' },
      { speaker: 'King Aldric', text: 'Sit by the fire whenever you pass. You, of all who walk these halls, have earned a place beside it.' },
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

  // A quest can be started if it exists and has not yet been begun.
  function canStart(id) {
    return !!QUEST_DEFS[id] && status(id) === STATUS.NOT_STARTED;
  }

  // True when *any* quest is startable or waiting to be handed in. The HUD reads
  // this to make a tab/button glow ("you have something to do").
  function anyAvailable() {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (canStart(id) || readyToComplete(id)) return true;
    }
    return false;
  }

  // WoW-style marker state for a given giver NPC id:
  //   'available'   → a "!"  (a quest you can start)
  //   'in-progress' → a grey "?" (the quest is on, objectives still underway)
  //   'ready'       → a bright "?" (objectives done — return to hand it in)
  //   null          → no marker
  // `def.quest` (or a quest's `giver`) maps an NPC to its quest.
  function questIdForGiver(npcId) {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (QUEST_DEFS[id].giver === npcId || id === npcId) return id;
    }
    return null;
  }
  function markerFor(npcId) {
    const id = questIdForGiver(npcId);
    if (!id) return null;
    if (canStart(id)) return 'available';
    if (readyToComplete(id)) return 'ready';     // objectives cleared, awaiting turn-in
    if (isActive(id)) return 'in-progress';
    return null; // complete or otherwise → no marker
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

  // The city/area a quest belongs to (defaults to 'Eldenmoor').
  function cityOf(def) { return def.city || def.area || 'Eldenmoor'; }

  // Render one quest entry's HTML. Includes a per-quest status word so the panel
  // reads as a proper journal (available / in progress / complete).
  function questEntryHtml(id) {
    const p = progress[id], def = QUEST_DEFS[id];
    const done = p.status === STATUS.COMPLETE;
    const started = p.status === STATUS.IN_PROGRESS;
    const statusWord = done ? 'complete' : (started ? 'in progress' : 'available');
    const statusColor = done ? '#7ddf7d' : (started ? '#ffd100' : '#cfe2ff');
    let html = `<div class="quest-entry quest-${done ? 'complete' : started ? 'in-progress' : 'available'}" data-quest="${id}" style="margin-bottom:12px;">`;
    html += `<div class="quest-title" style="font-weight:700;color:${statusColor};">` +
      (done ? '✔ ' : started ? '◆ ' : '! ') + def.name +
      ` <span class="quest-status" style="font-weight:400;font-size:12px;opacity:0.85;">(${statusWord})</span></div>`;
    if (started) {
      const st = def.stages[Math.min(p.stage, def.stages.length - 1)];
      html += `<div class="quest-journal" style="color:#e7dcc0;margin-top:3px;">${st.journal}</div>`;
      html += `<div class="quest-hint" style="color:#b9892f;font-style:italic;margin-top:3px;">› ${st.objective.hint}</div>`;
      html += '<div class="quest-stages" style="margin-top:5px;font-size:12px;color:#9a8e72;">';
      def.stages.forEach((s, i) => {
        const mark = i < p.stage ? '☑' : (i === p.stage ? '☐' : '·');
        html += `<div>${mark} ${s.name}</div>`;
      });
      html += '</div>';
    } else if (done) {
      html += `<div class="quest-journal" style="color:#9a8e72;margin-top:3px;">Reward claimed: ${def.reward ? def.reward.text : '—'}.</div>`;
    } else {
      // Available but not yet started — tease the quest and where to begin it.
      html += `<div class="quest-journal" style="color:#cfe2ff;margin-top:3px;">${def.intro || 'A new quest awaits.'}</div>`;
    }
    html += '</div>';
    return html;
  }

  // City-grouped journal. Every defined quest is shown under its city heading,
  // so a future city's quests slot in automatically (just give them a `city`).
  function renderLog() {
    if (!logBodyEl) return;
    // Group quest ids by city, preserving definition order within each city.
    const byCity = new Map();
    for (const id of Object.keys(QUEST_DEFS)) {
      const city = cityOf(QUEST_DEFS[id]);
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push(id);
    }
    let html = '';
    let anyShown = false;
    for (const [city, ids] of byCity) {
      const entries = ids.map(questEntryHtml).join('');
      if (!entries) continue;
      anyShown = true;
      html += `<div class="quest-city" data-city="${city}" style="margin-bottom:16px;">`;
      html += `<div class="quest-city-head" style="color:#d9b85a;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #5a4a28;padding-bottom:3px;margin-bottom:8px;">⚑ ${city}</div>`;
      html += entries;
      html += '</div>';
    }
    logBodyEl.innerHTML = anyShown ? html : '<div style="color:#9a8e72;font-style:italic;">No quests yet. Seek out King Aldric in the great hall.</div>';
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
    canStart, anyAvailable, markerFor, questIdForGiver,
    toggleLog, renderLog, serialize, load, setChangeHandler,
    progress,
  };
}
