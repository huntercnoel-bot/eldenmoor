// skills.js — every skill the character has (XP + level), the Hitpoints/HP bar,
// the always-on "currently training" panel (Woodcutting), and the Skills tab.

const SKILL_DEFS = [
  { id: 'attack',     name: 'Attack',     icon: '⚔️', base: 1 },
  { id: 'strength',   name: 'Strength',   icon: '💪', base: 1 },
  { id: 'defence',    name: 'Defence',    icon: '🛡️', base: 1 },
  { id: 'hitpoints',  name: 'Hitpoints',  icon: '❤️', base: 10 }, // OSRS starts at 10
  { id: 'mining',     name: 'Mining',     icon: '⛏️', base: 1 },
  { id: 'fishing',    name: 'Fishing',    icon: '🎣', base: 1 },
  { id: 'woodcutting',name: 'Woodcutting',icon: '🪓', base: 1 },
  { id: 'cooking',    name: 'Cooking',    icon: '🍳', base: 1 },
  { id: 'firemaking', name: 'Firemaking', icon: '🔥', base: 1 },
];

// --- The Old School RuneScape experience formula ---
function xpForLevel(level) {
  let total = 0;
  for (let n = 1; n < level; n++) total += Math.floor(n + 300 * Math.pow(2, n / 7));
  return Math.floor(total / 4);
}
function levelForXp(xp) {
  let level = 1;
  while (level < 99 && xpForLevel(level + 1) <= xp) level++;
  return level;
}

export function createSkills() {
  const state = {};
  for (const d of SKILL_DEFS) {
    const xp = xpForLevel(d.base);
    state[d.id] = { xp, level: d.base };
  }

  const elWcLevel = document.getElementById('wc-level');
  const elWcBar = document.getElementById('wc-bar');
  const elWcXp = document.getElementById('wc-xp');
  const elHpBar = document.getElementById('hp-bar');
  const elHpText = document.getElementById('hp-text');
  const tabEl = document.getElementById('skills-tab');

  function totalLevel() { return SKILL_DEFS.reduce((n, d) => n + state[d.id].level, 0); }
  function maxHp() { return state.hitpoints.level; }
  function combatLevel() {
    const base = 0.25 * (state.defence.level + state.hitpoints.level);
    const melee = 0.325 * (state.attack.level + state.strength.level);
    return Math.floor(base + melee);
  }

  // Top-left vitals: the HP bar + the Woodcutting "currently training" readout.
  function refreshVitals() {
    const wc = state.woodcutting;
    const into = wc.xp - xpForLevel(wc.level);
    const span = Math.max(1, xpForLevel(wc.level + 1) - xpForLevel(wc.level));
    if (elWcLevel) elWcLevel.textContent = wc.level;
    if (elWcBar) elWcBar.style.width = (wc.level >= 99 ? 100 : Math.min(100, (into / span) * 100)) + '%';
    if (elWcXp) elWcXp.textContent = Math.floor(wc.xp).toLocaleString() + ' xp';
    const hp = maxHp();
    if (elHpText) elHpText.textContent = hp + ' / ' + hp;
    if (elHpBar) elHpBar.style.width = '100%';
  }

  // The Skills tab: a grid of every skill with its level, plus totals.
  function renderSkillsTab() {
    if (!tabEl) return;
    let html = '<div class="skills-grid">';
    for (const d of SKILL_DEFS) {
      html += `<div class="skill-cell" title="${d.name} ${state[d.id].level}">
        <span class="sc-icon">${d.icon}</span><span class="sc-lv">${state[d.id].level}</span></div>`;
    }
    html += '</div>';
    html += `<div class="skills-foot">Total level <b>${totalLevel()}</b> &nbsp;·&nbsp; Combat <b>${combatLevel()}</b></div>`;
    tabEl.innerHTML = html;
  }

  function addXp(id, amount) {
    const s = state[id];
    if (!s) return { leveledUp: false };
    s.xp += amount;
    const newLevel = levelForXp(s.xp);
    const leveledUp = newLevel > s.level;
    s.level = newLevel;
    refreshVitals();
    renderSkillsTab();
    return { leveledUp, level: newLevel };
  }

  // Award one chop's worth of Woodcutting XP.
  function chopReward() {
    const r = addXp('woodcutting', 25);
    return { xp: 25, leveledUp: r.leveledUp, level: r.level };
  }

  // --- Save support ---
  function serialize() {
    const o = {};
    for (const d of SKILL_DEFS) o[d.id] = state[d.id].xp;
    return o;
  }
  function load(saved) {
    for (const d of SKILL_DEFS) {
      const xp = saved && typeof saved[d.id] === 'number' ? saved[d.id] : xpForLevel(d.base);
      state[d.id].xp = xp;
      state[d.id].level = levelForXp(xp);
    }
    refreshVitals();
    renderSkillsTab();
  }

  refreshVitals();
  renderSkillsTab();
  return { state, addXp, chopReward, totalLevel, combatLevel, maxHp, serialize, load, renderSkillsTab };
}
