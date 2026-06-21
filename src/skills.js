// skills.js — every skill the character has (XP + level), the Hitpoints/HP bar,
// the always-on "currently training" panel (Woodcutting), and the Skills tab.

const SKILL_DEFS = [
  { id: 'attack',     name: 'Attack',     icon: '⚔️', base: 1 },
  { id: 'strength',   name: 'Strength',   icon: '💪', base: 1 },
  { id: 'defence',    name: 'Defence',    icon: '🛡️', base: 1 },
  { id: 'hitpoints',  name: 'Hitpoints',  icon: '❤️', base: 10 }, // OSRS starts at 10
  { id: 'mining',     name: 'Mining',     icon: '⛏️', base: 1 },
  { id: 'fishing',    name: 'Fishing',    icon: '🎣', base: 1 },
  { id: 'smithing',   name: 'Smithing',   icon: '🔨', base: 1 },
  { id: 'woodcutting',name: 'Woodcutting',icon: '🪓', base: 1 },
  { id: 'cooking',    name: 'Cooking',    icon: '🍳', base: 1 },
  { id: 'firemaking', name: 'Firemaking', icon: '🔥', base: 1 },
];

// --- Tree tiers (Woodcutting) -------------------------------------------------
// Modelled on OSRS conventions, scaled down for this small game. Each tier has a
// Woodcutting level gate, the log it yields, the XP that log grants, and a base
// per-tick success chance (your odds of getting a log on a given chop tick). The
// per-tick chance scales gently with your level over the tier's "mastery" band so
// higher tiers feel slow at the gate and smooth out as you grow into them — the
// same satisfying curve OSRS gets from its hidden roll. Ordered low -> high.
//
// OSRS reference (XP/log): normal 25, oak 37.5, willow 67.5, maple 100, yew 175,
// magic 250. We round to whole numbers and keep the relative spacing.
export const TREE_TIERS = [
  { id: 'normal', name: 'Tree',        level: 1,  log: 'logs',        xp: 25,  base: 0.70, mastery: 15, color: 0x6a8d3a, axe: 'a tree' },
  { id: 'oak',    name: 'Oak',         level: 15, log: 'oak_logs',    xp: 38,  base: 0.55, mastery: 35, color: 0x5f7e2e, axe: 'an oak' },
  { id: 'willow', name: 'Willow',      level: 30, log: 'willow_logs', xp: 68,  base: 0.45, mastery: 50, color: 0x7fa64a, axe: 'a willow' },
  { id: 'maple',  name: 'Maple',       level: 45, log: 'maple_logs',  xp: 100, base: 0.38, mastery: 65, color: 0xc25a2a, axe: 'a maple' },
  { id: 'yew',    name: 'Yew',         level: 60, log: 'yew_logs',    xp: 175, base: 0.30, mastery: 80, color: 0x2f4a33, axe: 'a yew' },
  { id: 'magic',  name: 'Magic',       level: 75, log: 'magic_logs',  xp: 250, base: 0.22, mastery: 95, color: 0x4a78c8, axe: 'a magic tree' },
];
const TIER_BY_ID = Object.fromEntries(TREE_TIERS.map((t) => [t.id, t]));
export function treeTier(id) { return TIER_BY_ID[id] || TREE_TIERS[0]; }

// --- Ore tiers (Mining) -------------------------------------------------------
// Same shape + curve as TREE_TIERS but for Mining: a level gate, the ore it
// yields, Mining XP per ore, a base per-swing success chance, and a "mastery"
// band over which that chance eases up to ~0.95. OSRS reference (XP/ore):
// copper/tin 17.5, iron 35, coal 50, mithril 80. Rounded, spacing preserved.
// `rock` is how the gate message reads ("...to mine this rock"). Ordered low→high.
export const ORE_TIERS = [
  { id: 'copper',  name: 'Copper rock',  level: 1,  ore: 'copper_ore',  xp: 18, base: 0.65, mastery: 20, color: 0xb06a3a },
  { id: 'tin',     name: 'Tin rock',     level: 1,  ore: 'tin_ore',     xp: 18, base: 0.65, mastery: 20, color: 0x9a9aa6 },
  { id: 'iron',    name: 'Iron rock',    level: 15, ore: 'iron_ore',    xp: 35, base: 0.50, mastery: 40, color: 0x8a5a4a },
  { id: 'coal',    name: 'Coal rock',    level: 30, ore: 'coal',        xp: 50, base: 0.40, mastery: 55, color: 0x2b2b30 },
  { id: 'mithril', name: 'Mithril rock', level: 55, ore: 'mithril_ore', xp: 80, base: 0.28, mastery: 85, color: 0x3a6aa0 },
];
const ORE_BY_ID = Object.fromEntries(ORE_TIERS.map((t) => [t.id, t]));
export function oreTier(id) { return ORE_BY_ID[id] || ORE_TIERS[0]; }

// --- Smithing -----------------------------------------------------------------
// Furnace smelting: ores -> bars. Each recipe lists the ore cost (id->count), the
// bar produced, the Smithing level gate and the Smithing XP. OSRS bar XP: bronze
// 6.2, iron 12.5, steel 17.5, mithril 30. Rounded.
export const SMELT_RECIPES = [
  { id: 'bronze_bar', name: 'Bronze bar', level: 1,  xp: 6,  bar: 'bronze_bar', cost: { copper_ore: 1, tin_ore: 1 } },
  { id: 'iron_bar',   name: 'Iron bar',   level: 15, xp: 13, bar: 'iron_bar',   cost: { iron_ore: 1 } },
  { id: 'steel_bar',  name: 'Steel bar',  level: 30, xp: 18, bar: 'steel_bar',  cost: { iron_ore: 1, coal: 2 } },
  { id: 'mithril_bar',name: 'Mithril bar',level: 50, xp: 30, bar: 'mithril_bar',cost: { mithril_ore: 1, coal: 4 } },
];

// Anvil smithing: bar(s) + hammer -> gear. Each recipe lists the bar used, how
// many bars, the Smithing level gate, the Smithing XP, and the item produced.
// XP follows OSRS (~25 per bar worked). Grouped by metal so the UI can section it.
export const SMITH_RECIPES = [
  // bronze
  { id: 'bronze_dagger',    name: 'Bronze dagger',    bar: 'bronze_bar',  bars: 1, level: 1,  xp: 13,  makes: 'bronze_dagger' },
  { id: 'bronze_sword',     name: 'Bronze sword',     bar: 'bronze_bar',  bars: 1, level: 4,  xp: 13,  makes: 'bronze_sword' },
  { id: 'bronze_scimitar',  name: 'Bronze scimitar',  bar: 'bronze_bar',  bars: 2, level: 5,  xp: 25,  makes: 'bronze_scimitar' },
  { id: 'bronze_helm',      name: 'Bronze med helm',  bar: 'bronze_bar',  bars: 1, level: 7,  xp: 13,  makes: 'bronze_helm' },
  { id: 'bronze_platebody', name: 'Bronze platebody', bar: 'bronze_bar',  bars: 5, level: 18, xp: 63,  makes: 'bronze_platebody' },
  // iron
  { id: 'iron_dagger',      name: 'Iron dagger',      bar: 'iron_bar',    bars: 1, level: 15, xp: 25,  makes: 'iron_dagger' },
  { id: 'iron_sword',       name: 'Iron sword',       bar: 'iron_bar',    bars: 1, level: 19, xp: 25,  makes: 'iron_sword' },
  { id: 'iron_scimitar',    name: 'Iron scimitar',    bar: 'iron_bar',    bars: 2, level: 20, xp: 50,  makes: 'iron_scimitar' },
  { id: 'iron_helm',        name: 'Iron med helm',    bar: 'iron_bar',    bars: 1, level: 22, xp: 25,  makes: 'iron_helm' },
  { id: 'iron_platebody',   name: 'Iron platebody',   bar: 'iron_bar',    bars: 5, level: 33, xp: 125, makes: 'iron_platebody' },
  // steel
  { id: 'steel_dagger',     name: 'Steel dagger',     bar: 'steel_bar',   bars: 1, level: 30, xp: 38,  makes: 'steel_dagger' },
  { id: 'steel_sword',      name: 'Steel sword',      bar: 'steel_bar',   bars: 1, level: 34, xp: 38,  makes: 'steel_sword' },
  { id: 'steel_scimitar',   name: 'Steel scimitar',   bar: 'steel_bar',   bars: 2, level: 35, xp: 75,  makes: 'steel_scimitar' },
  { id: 'smith_steel_helm', name: 'Steel med helm',   bar: 'steel_bar',   bars: 1, level: 37, xp: 38,  makes: 'steel_helm' },
  { id: 'smith_steel_plate',name: 'Steel platebody',  bar: 'steel_bar',   bars: 5, level: 48, xp: 188, makes: 'steel_platebody' },
  // mithril
  { id: 'mithril_dagger',   name: 'Mithril dagger',   bar: 'mithril_bar', bars: 1, level: 50, xp: 50,  makes: 'mithril_dagger' },
  { id: 'mithril_sword',    name: 'Mithril sword',    bar: 'mithril_bar', bars: 1, level: 54, xp: 50,  makes: 'mithril_sword' },
  { id: 'mithril_scimitar', name: 'Mithril scimitar', bar: 'mithril_bar', bars: 2, level: 55, xp: 100, makes: 'mithril_scimitar' },
  { id: 'mithril_helm',     name: 'Mithril med helm', bar: 'mithril_bar', bars: 1, level: 57, xp: 50,  makes: 'mithril_helm' },
  { id: 'mithril_platebody',name: 'Mithril platebody',bar: 'mithril_bar', bars: 5, level: 68, xp: 250, makes: 'mithril_platebody' },
];

// The Old School RuneScape experience formula ---------------------------------
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
    // HP text/bar is driven live by combat.js (current / max). Only seed it
    // here as a fallback if combat hasn't taken over yet (text still default).
    const hp = maxHp();
    if (elHpText && /^\s*10 \/ 10\s*$/.test(elHpText.textContent)) {
      elHpText.textContent = hp + ' / ' + hp;
      if (elHpBar) elHpBar.style.width = '100%';
    }
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

  // Can the player even attempt this tier? (Used by world.js so a too-low player
  // gets a clear message instead of silently chopping for nothing.)
  function canChopTier(tierId) {
    const t = treeTier(tierId);
    return (state.woodcutting.level || 1) >= t.level;
  }

  // The per-tick "do I get a log this swing?" roll. Like OSRS, success isn't
  // guaranteed every tick: it starts at the tier's base chance at the level gate
  // and eases up to a near-certain ~0.95 by the tier's mastery level, so harder
  // trees feel meatier and progress smooths out as you grow into them.
  function chopSuccess(tierId) {
    const t = treeTier(tierId);
    const lvl = state.woodcutting.level || 1;
    const span = Math.max(1, t.mastery - t.level);
    const f = Math.max(0, Math.min(1, (lvl - t.level) / span));
    const chance = t.base + (0.95 - t.base) * f;
    return Math.random() < chance;
  }

  // Award one successful chop's worth of Woodcutting XP for the given tier.
  // Called with no argument it falls back to a normal tree (keeps the original
  // interactions.js call site working unchanged).
  function chopReward(tierId) {
    const t = treeTier(tierId);
    const r = addXp('woodcutting', t.xp);
    return { xp: t.xp, log: t.log, tier: t.id, leveledUp: r.leveledUp, level: r.level };
  }

  // --- Mining (mirrors the Woodcutting helpers above) ---------------------
  // Can the player attempt this ore tier yet?
  function canMineTier(tierId) {
    const t = oreTier(tierId);
    return (state.mining.level || 1) >= t.level;
  }
  // Per-swing "do I get an ore this swing?" roll, easing from the tier's base
  // chance at the gate to ~0.95 by its mastery level — same curve as chopping.
  function mineSuccess(tierId) {
    const t = oreTier(tierId);
    const lvl = state.mining.level || 1;
    const span = Math.max(1, t.mastery - t.level);
    const f = Math.max(0, Math.min(1, (lvl - t.level) / span));
    const chance = t.base + (0.95 - t.base) * f;
    return Math.random() < chance;
  }
  // Award one successful mine's worth of Mining XP for the given ore tier.
  function mineReward(tierId) {
    const t = oreTier(tierId);
    const r = addXp('mining', t.xp);
    return { xp: t.xp, ore: t.ore, tier: t.id, leveledUp: r.leveledUp, level: r.level };
  }

  // --- Smithing -----------------------------------------------------------
  function canSmith(level) { return (state.smithing.level || 1) >= (level || 1); }
  // Grant Smithing XP for a completed smelt / smithing action.
  function smithReward(xp) {
    const r = addXp('smithing', xp);
    return { xp, leveledUp: r.leveledUp, level: r.level };
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
  return { state, addXp, chopReward, chopSuccess, canChopTier, treeTier, TREE_TIERS,
    mineReward, mineSuccess, canMineTier, oreTier, ORE_TIERS,
    smithReward, canSmith, SMELT_RECIPES, SMITH_RECIPES,
    totalLevel, combatLevel, maxHp, serialize, load, renderSkillsTab };
}
