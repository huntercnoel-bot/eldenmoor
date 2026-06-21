// items.js — the catalogue of every item. Inline-SVG icons (no image files).
// `value` = shop price. Equippable items carry a `slot`. Axes carry `wcLevel`
// (Woodcutting level needed to use), `chopTime` (lower = faster), and `headColor`
// (the colour of the blade on the 3D axe your hero holds).

export const ITEMS = {
  coins: {
    id: 'coins', name: 'Coins', stackable: true, value: 1, examine: 'Lovely money!',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="14" cy="27" rx="9" ry="4.5" fill="#caa12a"/><ellipse cx="26" cy="25" rx="9" ry="4.5" fill="#dcb537"/>
      <ellipse cx="20" cy="18" rx="9" ry="4.5" fill="#f2cf4e" stroke="#9c7a1e" stroke-width="1"/><ellipse cx="20" cy="18" rx="4.4" ry="2.1" fill="#fbe488"/></svg>`,
  },

  logs: {
    id: 'logs', name: 'Logs', stackable: true, value: 4, examine: 'A bundle of fresh-cut logs.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-20 20 20)">
      <rect x="7" y="15" width="26" height="11" rx="5.5" fill="#7a5230" stroke="#4a3018" stroke-width="1.4"/>
      <path d="M11 16.5 H31 M11 20 H31 M12 23.4 H30" stroke="#5e3f22" stroke-width="0.8" opacity="0.7"/>
      <ellipse cx="9" cy="20.5" rx="3.4" ry="5.5" fill="#c79a5e" stroke="#4a3018" stroke-width="1.3"/>
      <ellipse cx="9" cy="20.5" rx="2.1" ry="3.4" fill="none" stroke="#9b7038" stroke-width="0.9"/></g></svg>`,
  },

  bronze_axe: {
    id: 'bronze_axe', name: 'Bronze Axe', stackable: false, value: 16,
    equipable: true, slot: 'weapon', tool: 'axe', wcLevel: 1, chopTime: 1.8, headColor: 0xc8842f,
    examine: 'A basic axe. Woodcutting level 1.',
    icon: axeIcon('#c8842f', '#7a4a18', '#f0b25e'),
  },
  steel_axe: {
    id: 'steel_axe', name: 'Steel Axe', stackable: false, value: 120,
    equipable: true, slot: 'weapon', tool: 'axe', wcLevel: 6, chopTime: 1.3, headColor: 0xbcc1c9,
    examine: 'A sturdy steel axe. Woodcutting level 6.',
    icon: axeIcon('#bcc1c9', '#6f747e', '#eef1f6'),
  },
  stormforged_axe: {
    id: 'stormforged_axe', name: 'Stormforged Axe', stackable: false, value: 900,
    equipable: true, slot: 'weapon', tool: 'axe', wcLevel: 30, chopTime: 0.9, headColor: 0x5fb0e6,
    examine: 'Crackling with storm-light. Woodcutting level 30.',
    icon: axeIcon('#6fbdf0', '#2b6da3', '#d6f2ff', true),
  },
  voidcleaver: {
    id: 'voidcleaver', name: 'Voidcleaver', stackable: false, value: 5000,
    equipable: true, slot: 'weapon', tool: 'axe', wcLevel: 50, chopTime: 0.55, headColor: 0x9a6cff,
    examine: 'Forged from a shard of the fractured void. Woodcutting level 50.',
    icon: axeIcon('#a877ff', '#5a32b0', '#e6d6ff', true),
  },

  rope: {
    id: 'rope', name: 'Rope', stackable: true, value: 8, examine: 'Strong hempen rope. Always handy.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g fill="none" stroke="#b58a52" stroke-width="4"><circle cx="20" cy="21" r="12"/><circle cx="20" cy="21" r="6"/></g><path d="M28 12 l5 -4" stroke="#9c733f" stroke-width="3"/></svg>`,
  },
  tinderbox: {
    id: 'tinderbox', name: 'Tinderbox', stackable: false, value: 6, examine: 'Flint and steel for lighting fires.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="8" y="17" width="24" height="15" rx="2" fill="#7a5230" stroke="#4a3018" stroke-width="1.5"/><rect x="8" y="14" width="24" height="6" rx="2" fill="#5e3f22"/><path d="M21 8 l5 7 -9 0 z" fill="#cfd3da"/><circle cx="14" cy="25" r="1.8" fill="#e7b54a"/></svg>`,
  },
  bread: {
    id: 'bread', name: 'Loaf of bread', stackable: true, value: 5, examine: 'A crusty loaf. Smells fresh.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="22" rx="15" ry="9" fill="#d8a55a" stroke="#a06a2a" stroke-width="1.5"/><path d="M11 19 q3 -3 6 0 M20 18 q3 -3 6 0" stroke="#a06a2a" stroke-width="1.2" fill="none"/></svg>`,
  },
  bucket: {
    id: 'bucket', name: 'Bucket', stackable: false, value: 4, examine: 'A sturdy wooden bucket.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M11 15 H29 L26 33 H14 Z" fill="#8a5a30" stroke="#4a3018" stroke-width="1.5"/><path d="M12 19 Q20 9 28 19" stroke="#6b4a2f" stroke-width="2" fill="none"/><path d="M11.5 20 H28.5" stroke="#5e3f22" stroke-width="1"/></svg>`,
  },
  torch: {
    id: 'torch', name: 'Torch', stackable: true, value: 10, examine: 'Lights the darkest cave.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="18" y="18" width="4" height="18" rx="1.5" fill="#6b4a2f"/><path d="M20 5 q7 7 2 13 q-2 3 -6 0 q-3 -6 4 -13" fill="#ff8a2a"/><path d="M20 9 q3 4 1 8 q-3 1 -4 -2 q-1 -3 3 -6" fill="#ffd24a"/></svg>`,
  },
  clay_pot: {
    id: 'clay_pot', name: 'Clay pot', stackable: true, value: 3, examine: 'An empty earthenware pot.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 16 Q11 33 20 33 Q29 33 28 16 Z" fill="#b5713a" stroke="#6b4a2f" stroke-width="1.5"/><ellipse cx="20" cy="15" rx="9" ry="3" fill="#caa05a" stroke="#6b4a2f" stroke-width="1.2"/></svg>`,
  },
  pickaxe: {
    id: 'pickaxe', name: 'Bronze pickaxe', stackable: false, value: 40,
    equipable: true, slot: 'weapon', tool: 'pickaxe', mineLevel: 1, mineTime: 1.8,
    examine: 'For mining ore. Equip it and click a rock node. Mining level 1.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="18.5" y="11" width="3" height="23" rx="1.5" fill="#6b4a2f"/><path d="M7 15 Q20 8 33 15 Q20 12 7 15 Z" fill="#c8842f" stroke="#7a4a18" stroke-width="1"/></svg>`,
  },
  steel_pickaxe: {
    id: 'steel_pickaxe', name: 'Steel pickaxe', stackable: false, value: 200,
    equipable: true, slot: 'weapon', tool: 'pickaxe', mineLevel: 6, mineTime: 1.3,
    examine: 'A sturdy steel pickaxe — swings faster. Mining level 6.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="18.5" y="11" width="3" height="23" rx="1.5" fill="#6b4a2f"/><path d="M7 15 Q20 8 33 15 Q20 12 7 15 Z" fill="#bcc1c9" stroke="#6f747e" stroke-width="1"/></svg>`,
  },
  fishing_rod: {
    id: 'fishing_rod', name: 'Fishing rod', stackable: false, value: 30,
    equipable: true, slot: 'weapon', tool: 'fishing', examine: 'For catching fish. (Fishing coming soon!)',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M8 34 L31 7" stroke="#7a5230" stroke-width="2.5" fill="none"/><path d="M31 7 Q34 14 30 21" stroke="#cfcfcf" stroke-width="1" fill="none"/><circle cx="30" cy="21" r="2" fill="#caa12a"/></svg>`,
  },

  wooden_shield: {
    id: 'wooden_shield', name: 'Wooden shield', stackable: false, value: 12,
    equipable: true, slot: 'shield', examine: 'A simple round shield.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 5 C26 8 32 8 32 8 C32 22 28 31 20 35 C12 31 8 22 8 8 C8 8 14 8 20 5 Z" fill="#8a5a30" stroke="#4a3018" stroke-width="1.5"/>
      <path d="M20 6 V34 M9 12 H31" stroke="#5e3f22" stroke-width="1" opacity="0.55"/><circle cx="20" cy="20" r="3.6" fill="#c9a25a" stroke="#6b4a2f" stroke-width="1"/></svg>`,
  },

  birds_nest: {
    id: 'birds_nest', name: "Bird's nest", stackable: true, value: 25, examine: 'Aw, how cute. There are eggs inside.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="20" cy="25" rx="13" ry="8" fill="#6e4a28" stroke="#4a3018" stroke-width="1"/><ellipse cx="20" cy="23" rx="9.5" ry="5" fill="#33220f"/>
      <path d="M8 24 Q20 30 32 24 M9 21 Q20 26 31 21" stroke="#5a3c20" stroke-width="0.8" fill="none" opacity="0.7"/>
      <ellipse cx="17" cy="23" rx="3" ry="2.6" fill="#ece3d1"/><ellipse cx="22.5" cy="24" rx="3" ry="2.6" fill="#dccfb8"/></svg>`,
  },

  // ---- Wearable steel armour (worn on the 3D hero, see player.js setWornGear) ----
  steel_helm: {
    id: 'steel_helm', name: 'Steel helm', stackable: false, value: 140,
    equipable: true, slot: 'head', examine: 'A sturdy open-faced steel helm.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 22 Q9 9 20 9 Q31 9 31 22 L31 26 Q26 24 20 24 Q14 24 9 26 Z" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <rect x="18.6" y="13" width="2.8" height="12" fill="#9aa0a8"/><path d="M9.5 22 H30.5" stroke="#d8b24a" stroke-width="2"/></svg>`,
  },
  steel_platebody: {
    id: 'steel_platebody', name: 'Steel platebody', stackable: false, value: 320,
    equipable: true, slot: 'body', tabard: 0x6e1f2f, examine: 'A heavy steel breastplate with a tabard.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 11 L20 14 L30 11 L31 30 Q20 35 9 30 Z" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <path d="M16 14 H24 V31 H16 Z" fill="#6e1f2f"/><path d="M10 11 L7 16 M30 11 L33 16" stroke="#6f747e" stroke-width="2.4" fill="none"/></svg>`,
  },
  steel_platelegs: {
    id: 'steel_platelegs', name: 'Steel platelegs', stackable: false, value: 240,
    equipable: true, slot: 'legs', examine: 'Steel plates for the legs.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M11 8 H29 L27 33 H22 L20 18 L18 33 H13 Z" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <path d="M11 12 H29" stroke="#d8b24a" stroke-width="2"/></svg>`,
  },
  steel_gauntlets: {
    id: 'steel_gauntlets', name: 'Steel gauntlets', stackable: false, value: 90,
    equipable: true, slot: 'hands', examine: 'Articulated steel gauntlets.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="16" width="16" height="16" rx="3" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <rect x="13.2" y="10" width="3.2" height="8" rx="1.5" fill="#c2c7ce" stroke="#6f747e" stroke-width="1"/>
      <rect x="17" y="8" width="3.2" height="10" rx="1.5" fill="#c2c7ce" stroke="#6f747e" stroke-width="1"/>
      <rect x="20.8" y="9" width="3.2" height="9" rx="1.5" fill="#c2c7ce" stroke="#6f747e" stroke-width="1"/>
      <rect x="24.6" y="11" width="3" height="7" rx="1.5" fill="#c2c7ce" stroke="#6f747e" stroke-width="1"/>
      <path d="M12 28 H28" stroke="#d8b24a" stroke-width="2"/></svg>`,
  },
  steel_boots: {
    id: 'steel_boots', name: 'Steel boots', stackable: false, value: 90,
    equipable: true, slot: 'feet', examine: 'Plated steel boots.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M15 8 H22 V24 L30 27 V31 H12 V12 Q12 8 15 8 Z" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <path d="M12 27 H30" stroke="#d8b24a" stroke-width="2"/></svg>`,
  },
  steel_kiteshield: {
    id: 'steel_kiteshield', name: 'Steel kiteshield', stackable: false, value: 180,
    equipable: true, slot: 'shield', face: 0x2f5aa0, examine: 'A tall steel kiteshield.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 5 C27 8 33 8 33 8 C33 22 28 32 20 36 C12 32 7 22 7 8 C7 8 13 8 20 5 Z" fill="#c2c7ce" stroke="#6f747e" stroke-width="1.5"/>
      <path d="M20 6 V35 M8 13 H32" stroke="#9aa0a8" stroke-width="1"/><circle cx="20" cy="19" r="3.6" fill="#d8b24a" stroke="#6f747e" stroke-width="1"/></svg>`,
  },
  adventurer_cape: {
    id: 'adventurer_cape', name: "Adventurer's cape", stackable: false, value: 60,
    equipable: true, slot: 'cape', cape: 0xa83232, examine: 'A fine red travelling cape.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 8 Q20 6 28 8 L33 33 Q20 30 7 33 Z" fill="#a83232" stroke="#6e1f2f" stroke-width="1.5"/>
      <path d="M12 8 Q20 12 28 8" fill="none" stroke="#d8b24a" stroke-width="2"/></svg>`,
  },
};

// ---- Combat loot (appended by the Combat Smith; additive only) -------------
ITEMS.rat_tail = {
  id: 'rat_tail', name: 'Rat tail', stackable: true, value: 3, examine: 'The scaly tail of a giant rat. Some folk pay for these.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M9 30 Q14 12 24 14 Q32 15 31 8" fill="none" stroke="#c99a8c" stroke-width="4" stroke-linecap="round"/><circle cx="31" cy="8" r="2.4" fill="#b07868"/></svg>`,
};
ITEMS.raw_rat_meat = {
  id: 'raw_rat_meat', name: 'Raw rat meat', stackable: true, value: 2, examine: 'A scrawny cut of rat. Best cooked. Probably.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="22" rx="13" ry="9" fill="#c0635f" stroke="#7a3530" stroke-width="1.5"/><ellipse cx="17" cy="20" rx="4" ry="3" fill="#d98a86"/><path d="M30 14 l5 -4" stroke="#e6e0d2" stroke-width="2.5" stroke-linecap="round"/></svg>`,
};
ITEMS.goblin_ear = {
  id: 'goblin_ear', name: 'Goblin ear', stackable: true, value: 6, examine: 'A pointed green ear. Trophy of a felled goblin.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 33 Q9 14 28 8 Q22 20 23 33 Z" fill="#6f8f43" stroke="#3f5524" stroke-width="1.6"/><path d="M16 30 Q15 18 25 12" stroke="#52702f" stroke-width="1.2" fill="none"/></svg>`,
};
ITEMS.goblin_charm = {
  id: 'goblin_charm', name: 'Goblin charm', stackable: true, value: 35, examine: 'A crude bone fetish. It hums faintly with goblin magic.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 V14" stroke="#9c8a6a" stroke-width="2"/><circle cx="20" cy="22" r="9" fill="#cdbf95" stroke="#7a6a44" stroke-width="1.6"/><circle cx="20" cy="22" r="3.4" fill="#6f8f43"/><path d="M20 13 l2 4 -4 0 z" fill="#e7dcb8"/></svg>`,
};

// ============================================================================
//  COMBAT DROPS  (appended by the Beast Tamer; additive only)
// ============================================================================
// A full OSRS-style drop economy: every monster always drops BONES, commonly a
// food/material drop, and occasionally a themed trophy or low gear. Icons are
// inline SVG to match the rest of the catalogue (no image files).

// --- Always drops --------------------------------------------------------
ITEMS.bones = {
  id: 'bones', name: 'Bones', stackable: true, value: 1, examine: 'A pile of bones. Buryable, in theory.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#7a6a4a" stroke-width="1.4" fill="#ece3cf">
    <path d="M11 27 l16 -14"/><circle cx="11" cy="27" r="3.4"/><circle cx="8.4" cy="29.4" r="3.2"/>
    <circle cx="27" cy="13" r="3.4"/><circle cx="29.6" cy="10.6" r="3.2"/></g></svg>`,
};
ITEMS.big_bones = {
  id: 'big_bones', name: 'Big bones', stackable: true, value: 3, examine: 'A heavy, thick set of bones from a large beast.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#7a6a4a" stroke-width="2" fill="#ece3cf">
    <path d="M10 28 l18 -16"/><circle cx="10" cy="28" r="4.2"/><circle cx="6.8" cy="31" r="3.8"/>
    <circle cx="28" cy="12" r="4.2"/><circle cx="31.2" cy="9" r="3.8"/></g></svg>`,
};

// --- Common food / materials --------------------------------------------
ITEMS.feather = {
  id: 'feather', name: 'Feather', stackable: true, value: 1, examine: 'A soft white feather. Fletchers and fishers want these.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M30 8 Q14 12 10 32 L13 29 Q22 26 30 8 Z" fill="#f2efe6" stroke="#b9b29c" stroke-width="1.3"/><path d="M28 11 L13 28" stroke="#b9b29c" stroke-width="1"/></svg>`,
};
ITEMS.raw_chicken = {
  id: 'raw_chicken', name: 'Raw chicken', stackable: true, value: 4, examine: 'A plucked raw chicken. Cook it before you eat it!',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="23" rx="12" ry="10" fill="#e7c9a0" stroke="#a47a48" stroke-width="1.5"/><path d="M27 16 l6 -5 M29 18 l6 -3" stroke="#d8c7b0" stroke-width="2.4" stroke-linecap="round"/></svg>`,
};
ITEMS.raw_beef = {
  id: 'raw_beef', name: 'Raw beef', stackable: true, value: 5, examine: 'A thick raw cut of beef.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><ellipse cx="20" cy="22" rx="14" ry="10" fill="#c0635f" stroke="#7a3530" stroke-width="1.5"/><ellipse cx="16" cy="20" rx="5" ry="3.4" fill="#e0a39e"/><ellipse cx="24" cy="24" rx="3.4" ry="2.4" fill="#e0a39e"/></svg>`,
};
ITEMS.raw_meat = {
  id: 'raw_meat', name: 'Raw meat', stackable: true, value: 3, examine: 'A wild cut of raw meat.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M9 24 Q9 13 21 13 Q33 13 31 25 Q30 32 20 32 Q10 32 9 24 Z" fill="#b85a56" stroke="#73302c" stroke-width="1.5"/><circle cx="18" cy="21" r="3.2" fill="#d98a86"/></svg>`,
};
ITEMS.cowhide = {
  id: 'cowhide', name: 'Cowhide', stackable: true, value: 8, examine: 'A rough cowhide. A tanner could make leather from this.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M9 14 Q14 8 20 12 Q26 8 31 14 Q34 22 27 31 Q20 35 13 31 Q6 22 9 14 Z" fill="#cdb89a" stroke="#7a6a4a" stroke-width="1.5"/><path d="M16 17 q3 4 0 8 M24 16 q2 5 -1 9" fill="#5a4a32"/></svg>`,
};
ITEMS.snake_hide = {
  id: 'snake_hide', name: 'Snake hide', stackable: true, value: 14, examine: 'A supple scaled hide, prized by leatherworkers.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M10 30 Q14 14 24 16 Q33 17 30 9" fill="none" stroke="#5f9a52" stroke-width="6" stroke-linecap="round"/><path d="M12 27 l2 -2 M17 20 l2 -2 M23 17 l2 -2" stroke="#34602c" stroke-width="1.4"/></svg>`,
};

// --- Themed trophies -----------------------------------------------------
ITEMS.frog_leg = {
  id: 'frog_leg', name: 'Frog leg', stackable: true, value: 7, examine: 'A plump frog leg. A delicacy in some courts.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M12 30 Q10 20 18 18 Q26 16 24 9" fill="none" stroke="#7fae4b" stroke-width="5" stroke-linecap="round"/><circle cx="24" cy="9" r="3" fill="#5f8a34"/></svg>`,
};
ITEMS.snake_fang = {
  id: 'snake_fang', name: 'Snake fang', stackable: true, value: 22, examine: 'A curved, venom-stained fang. Handy for poisons.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 7 Q26 18 21 33 Q19 24 14 16 Q17 11 20 7 Z" fill="#eee6cf" stroke="#9a8a64" stroke-width="1.3"/><path d="M20 26 q1 4 0 6" stroke="#6f8f43" stroke-width="1.4"/></svg>`,
};
ITEMS.wasp_stinger = {
  id: 'wasp_stinger', name: 'Wasp stinger', stackable: true, value: 18, examine: 'A barbed stinger, still slick with venom.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M9 31 L31 9 L27 9 L7 29 Z" fill="#3a2e12" stroke="#1a1408" stroke-width="1"/><path d="M31 9 L24 11 L29 16 Z" fill="#d8c24a"/></svg>`,
};

// --- Low gear (rare) -----------------------------------------------------
ITEMS.bronze_dagger = {
  id: 'bronze_dagger', name: 'Bronze dagger', stackable: false, value: 10,
  equipable: true, slot: 'weapon', tool: 'sword', chopTime: 1.1, headColor: 0xc8842f,
  examine: 'A short bronze dagger. Fast, but it barely stings.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 L23 22 L17 22 Z" fill="#c8842f" stroke="#7a4a18" stroke-width="1"/><rect x="14" y="22" width="12" height="3" rx="1" fill="#5a3f24"/><rect x="18.5" y="25" width="3" height="9" rx="1.5" fill="#6b4a2f"/></svg>`,
};
ITEMS.bronze_sword = {
  id: 'bronze_sword', name: 'Bronze sword', stackable: false, value: 26,
  equipable: true, slot: 'weapon', tool: 'sword', chopTime: 1.4, headColor: 0xc8842f,
  examine: 'A plain bronze sword. Honest work.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 5 L23 26 L17 26 Z" fill="#c8842f" stroke="#7a4a18" stroke-width="1"/><rect x="12" y="26" width="16" height="3" rx="1.5" fill="#5a3f24"/><rect x="18.5" y="29" width="3" height="7" rx="1.5" fill="#6b4a2f"/></svg>`,
};
ITEMS.iron_dagger = {
  id: 'iron_dagger', name: 'Iron dagger', stackable: false, value: 35,
  equipable: true, slot: 'weapon', tool: 'sword', chopTime: 1.1, headColor: 0x8f949c,
  examine: 'A keen iron dagger.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M20 6 L23 22 L17 22 Z" fill="#8f949c" stroke="#5a5e66" stroke-width="1"/><rect x="14" y="22" width="12" height="3" rx="1" fill="#5a3f24"/><rect x="18.5" y="25" width="3" height="9" rx="1.5" fill="#6b4a2f"/></svg>`,
};
ITEMS.leather_body = {
  id: 'leather_body', name: 'Leather body', stackable: false, value: 28,
  equipable: true, slot: 'body', tabard: 0x6e4a2c, examine: 'A hardened leather tunic.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M10 12 L20 15 L30 12 L31 30 Q20 35 9 30 Z" fill="#8a5a30" stroke="#4a3018" stroke-width="1.5"/><path d="M20 15 V32 M14 18 H26" stroke="#5e3f22" stroke-width="1"/></svg>`,
};
ITEMS.emerald = {
  id: 'emerald', name: 'Emerald', stackable: true, value: 200, examine: 'A flawless green gemstone. Worth a tidy sum.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M14 10 H26 L32 18 L20 34 L8 18 Z" fill="#3fbf6a" stroke="#1e7a3e" stroke-width="1.5"/><path d="M14 10 L20 18 L26 10 M8 18 H32 M20 18 L20 34" stroke="#c8f5d6" stroke-width="1" opacity="0.8"/></svg>`,
};

// ---- Higher-tier logs (appended by the Woodcutting extension; additive only) ----
// Values follow OSRS log spacing scaled down: better wood is worth more. Each
// icon is the same banded log motif tinted to its species so they read at a
// glance in the bag.
ITEMS.oak_logs = {
  id: 'oak_logs', name: 'Oak logs', stackable: true, value: 12, examine: 'Sturdy oak logs. Woodcutting level 15.',
  icon: logIcon('#8a6a3a', '#5a3f20', '#b89060'),
};
ITEMS.willow_logs = {
  id: 'willow_logs', name: 'Willow logs', stackable: true, value: 20, examine: 'Pale, supple willow logs. Woodcutting level 30.',
  icon: logIcon('#9b8a52', '#6a5a2e', '#c8ba84'),
};
ITEMS.maple_logs = {
  id: 'maple_logs', name: 'Maple logs', stackable: true, value: 32, examine: 'Reddish maple logs. Woodcutting level 45.',
  icon: logIcon('#9c5a36', '#6a3520', '#cd8a5e'),
};
ITEMS.yew_logs = {
  id: 'yew_logs', name: 'Yew logs', stackable: true, value: 64, examine: 'Dark, dense yew logs. Woodcutting level 60.',
  icon: logIcon('#5a4a3a', '#332620', '#857060'),
};
ITEMS.magic_logs = {
  id: 'magic_logs', name: 'Magic logs', stackable: true, value: 120, examine: 'Faintly glowing magic logs. They hum with power. Woodcutting level 75.',
  icon: logIcon('#5a6aa8', '#33407a', '#a8b8ff', true),
};

// ---- Fishing & Cooking (appended by the Fishing/Cooking extension; additive) ----
// Each fish has three forms: raw (from Fishing), cooked (from Cooking on a fire/
// range) and burnt (a low-level Cooking mishap). Cooked fish carry a `heal` value
// (HP restored when eaten) and an `eat` flag the inventory/right-click "Eat" uses.
// Values follow OSRS food spacing, scaled to this game. Icons are inline SVG fish
// tinted per species (cooked = warmer/golden, burnt = charred black).
function fishIcon(body, belly, fin) {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-8 20 20)">
    <path d="M7 20 Q16 9 27 13 Q34 16 33 20 Q34 24 27 27 Q16 31 7 20 Z" fill="${body}" stroke="#2a2a2a" stroke-width="1.2"/>
    <path d="M7 20 Q3 15 1 13 Q4 20 1 27 Q3 25 7 20 Z" fill="${fin}" stroke="#2a2a2a" stroke-width="1"/>
    <path d="M12 22 Q19 28 27 25" fill="none" stroke="${belly}" stroke-width="1.4" opacity="0.7"/>
    <circle cx="29" cy="18" r="1.6" fill="#15110c"/></g></svg>`;
}
// Raw fish — cool, fishy tones.
ITEMS.raw_shrimp = {
  id: 'raw_shrimp', name: 'Raw shrimps', stackable: true, value: 3, examine: 'I should try cooking these.',
  icon: fishIcon('#d98f7a', '#f0bfae', '#c97a64'),
};
ITEMS.raw_sardine = {
  id: 'raw_sardine', name: 'Raw sardine', stackable: true, value: 5, examine: 'A small, oily fish. Best cooked.',
  icon: fishIcon('#8fa6b8', '#c7d6e0', '#6f8696'),
};
ITEMS.raw_trout = {
  id: 'raw_trout', name: 'Raw trout', stackable: true, value: 12, examine: 'A fine river trout. Needs cooking.',
  icon: fishIcon('#9bb07f', '#cdd9b8', '#7d9263'),
};
ITEMS.raw_salmon = {
  id: 'raw_salmon', name: 'Raw salmon', stackable: true, value: 20, examine: 'A plump salmon. Cook it for a hearty meal.',
  icon: fishIcon('#e0997a', '#f3c4ab', '#c47a5c'),
};
ITEMS.raw_lobster = {
  id: 'raw_lobster', name: 'Raw lobster', stackable: true, value: 40, examine: 'A live lobster. Cook it before it pinches you.',
  icon: fishIcon('#7d4a9c', '#b88fcf', '#5e3578'),
};
// Cooked fish — golden/warm tones; edible with a heal value.
ITEMS.cooked_shrimp = {
  id: 'cooked_shrimp', name: 'Shrimps', stackable: true, value: 5, heal: 3, eat: true, examine: 'Some nicely cooked shrimps. Heals 3.',
  icon: fishIcon('#f0a05a', '#ffd2a0', '#d8843e'),
};
ITEMS.cooked_sardine = {
  id: 'cooked_sardine', name: 'Sardine', stackable: true, value: 8, heal: 4, eat: true, examine: 'A cooked sardine. Heals 4.',
  icon: fishIcon('#e8b46a', '#ffe2b0', '#c8923f'),
};
ITEMS.cooked_trout = {
  id: 'cooked_trout', name: 'Trout', stackable: true, value: 18, heal: 7, eat: true, examine: 'A well-cooked trout. Heals 7.',
  icon: fishIcon('#e7b878', '#ffe6bc', '#c79850'),
};
ITEMS.cooked_salmon = {
  id: 'cooked_salmon', name: 'Salmon', stackable: true, value: 28, heal: 9, eat: true, examine: 'A hearty cooked salmon. Heals 9.',
  icon: fishIcon('#f0a86a', '#ffd6ad', '#d4894a'),
};
ITEMS.cooked_lobster = {
  id: 'cooked_lobster', name: 'Lobster', stackable: true, value: 55, heal: 12, eat: true, examine: 'A bright red cooked lobster. Heals 12.',
  icon: fishIcon('#e0503a', '#ff9a7a', '#c03828'),
};
// Burnt fish — charred and worthless. A low-level Cooking mishap.
ITEMS.burnt_fish = {
  id: 'burnt_fish', name: 'Burnt fish', stackable: true, value: 1, examine: 'Oops. Charred beyond saving.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-8 20 20)">
    <path d="M7 20 Q16 9 27 13 Q34 16 33 20 Q34 24 27 27 Q16 31 7 20 Z" fill="#3a3330" stroke="#15110c" stroke-width="1.2"/>
    <path d="M7 20 Q3 15 1 13 Q4 20 1 27 Q3 25 7 20 Z" fill="#2a2422" stroke="#15110c" stroke-width="1"/>
    <path d="M12 16 q3 4 0 8 M18 15 q3 5 0 10 M24 16 q2 4 0 8" stroke="#6a5a48" stroke-width="0.8" fill="none" opacity="0.6"/>
    <circle cx="29" cy="18" r="1.4" fill="#0a0806"/></g></svg>`,
};

// ---- Mining ores (appended by the Mining/Smithing extension; additive only) ----
// Ores are stackable raw materials. Each icon is a chunk of rock with a tinted
// vein of the metal showing through so they read at a glance in the bag. Values
// follow OSRS spacing scaled down (coal is cheap, mithril dear).
ITEMS.copper_ore = {
  id: 'copper_ore', name: 'Copper ore', stackable: true, value: 4, examine: 'A lump of copper ore. Mining level 1.',
  icon: oreIcon('#b06a3a', '#7a4520'),
};
ITEMS.tin_ore = {
  id: 'tin_ore', name: 'Tin ore', stackable: true, value: 4, examine: 'A lump of tin ore. Mining level 1.',
  icon: oreIcon('#b6b6c2', '#7a7a86'),
};
ITEMS.iron_ore = {
  id: 'iron_ore', name: 'Iron ore', stackable: true, value: 17, examine: 'A lump of iron ore. Mining level 15.',
  icon: oreIcon('#9a5a48', '#5e3326'),
};
ITEMS.coal = {
  id: 'coal', name: 'Coal', stackable: true, value: 25, examine: 'A lump of coal. Fuel for the hottest forges. Mining level 30.',
  icon: oreIcon('#3a3a40', '#161618'),
};
ITEMS.mithril_ore = {
  id: 'mithril_ore', name: 'Mithril ore', stackable: true, value: 90, examine: 'A lump of mithril ore. It gleams faintly blue. Mining level 55.',
  icon: oreIcon('#3a6aa0', '#22426a'),
};

// ---- Smithing bars (smelted at the furnace) ----
ITEMS.bronze_bar = {
  id: 'bronze_bar', name: 'Bronze bar', stackable: true, value: 12, examine: 'A bar of bronze, ready for the anvil.',
  icon: barIcon('#c8842f', '#7a4a18', '#f0b25e'),
};
ITEMS.iron_bar = {
  id: 'iron_bar', name: 'Iron bar', stackable: true, value: 28, examine: 'A bar of iron, ready for the anvil.',
  icon: barIcon('#9a8f88', '#5e544e', '#cfc6bf'),
};
ITEMS.steel_bar = {
  id: 'steel_bar', name: 'Steel bar', stackable: true, value: 55, examine: 'A bar of steel, ready for the anvil.',
  icon: barIcon('#bcc1c9', '#6f747e', '#eef1f6'),
};
ITEMS.mithril_bar = {
  id: 'mithril_bar', name: 'Mithril bar', stackable: true, value: 160, examine: 'A bar of mithril. Light, strong, faintly blue.',
  icon: barIcon('#5f8fd0', '#2b5a96', '#bcd6ff'),
};

// ---- A smithing hammer (used from the bag at the anvil; not equipped) ----
ITEMS.hammer = {
  id: 'hammer', name: 'Hammer', stackable: false, value: 14, examine: 'A heavy smithing hammer. Used at an anvil.',
  icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="18.5" y="14" width="3.2" height="20" rx="1.5" fill="#6b4a2f" stroke="#3a2a18" stroke-width="0.8"/><rect x="11" y="8" width="18" height="8" rx="2" fill="#8a8f97" stroke="#5a5e66" stroke-width="1.2"/><rect x="13" y="9.4" width="5" height="5" rx="1" fill="#b8bcc4"/></svg>`,
};

// ---- Smithable gear (anvil products). Steel helm/platebody already exist and
// are reused by the steel recipes; here we add bronze/iron/mithril gear plus the
// weapon families (daggers/swords/scimitars). Weapons are equipable melee arms;
// helms/platebodies are wearable armour like the existing steel set. ----
function weapon(id, name, kind, fill, stroke, shine, value, atk) {
  ITEMS[id] = {
    id, name, stackable: false, value, equipable: true, slot: 'weapon', tool: 'sword',
    examine: 'A ' + name.toLowerCase() + '. Smithed at the anvil.',
    icon: bladeIcon(kind, fill, stroke, shine),
  };
}
function helm(id, name, fill, stroke, value) {
  ITEMS[id] = {
    id, name, stackable: false, value, equipable: true, slot: 'head',
    examine: 'A ' + name.toLowerCase() + '. Smithed at the anvil.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M9 22 Q9 9 20 9 Q31 9 31 22 L31 26 Q26 24 20 24 Q14 24 9 26 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><rect x="18.6" y="13" width="2.8" height="12" fill="${stroke}"/></svg>`,
  };
}
function platebody(id, name, fill, stroke, value, tabard) {
  ITEMS[id] = {
    id, name, stackable: false, value, equipable: true, slot: 'body', tabard,
    examine: 'A ' + name.toLowerCase() + '. Smithed at the anvil.',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><path d="M10 11 L20 14 L30 11 L31 30 Q20 35 9 30 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/><path d="M10 11 L7 16 M30 11 L33 16" stroke="${stroke}" stroke-width="2.4" fill="none"/></svg>`,
  };
}
// bronze (warm copper), iron (dull grey), mithril (steely blue). Steel reuses the
// existing steel_helm / steel_platebody items, so it isn't redefined here.
weapon('bronze_dagger',   'Bronze dagger',   'dagger', '#c8842f', '#7a4a18', '#f0b25e', 12, 4);
weapon('bronze_sword',    'Bronze sword',    'sword',  '#c8842f', '#7a4a18', '#f0b25e', 26, 6);
weapon('bronze_scimitar', 'Bronze scimitar', 'scim',   '#c8842f', '#7a4a18', '#f0b25e', 48, 8);
helm('bronze_helm',       'Bronze med helm', '#c8842f', '#7a4a18', 24);
platebody('bronze_platebody', 'Bronze platebody', '#c8842f', '#7a4a18', 120, 0x6e1f2f);

weapon('iron_dagger',     'Iron dagger',     'dagger', '#b8b0a8', '#6f675f', '#e6ddd4', 28, 10);
weapon('iron_sword',      'Iron sword',      'sword',  '#b8b0a8', '#6f675f', '#e6ddd4', 56, 14);
weapon('iron_scimitar',   'Iron scimitar',   'scim',   '#b8b0a8', '#6f675f', '#e6ddd4', 100, 18);
helm('iron_helm',         'Iron med helm',   '#b8b0a8', '#6f675f', 56);
platebody('iron_platebody', 'Iron platebody', '#b8b0a8', '#6f675f', 240, 0x2b3a5a);

weapon('steel_dagger',    'Steel dagger',    'dagger', '#c2c7ce', '#6f747e', '#eef1f6', 75, 20);
weapon('steel_sword',     'Steel sword',     'sword',  '#c2c7ce', '#6f747e', '#eef1f6', 150, 28);
weapon('steel_scimitar',  'Steel scimitar',  'scim',   '#c2c7ce', '#6f747e', '#eef1f6', 280, 36);

weapon('mithril_dagger',  'Mithril dagger',  'dagger', '#6f9bd6', '#2b5a96', '#bcd6ff', 200, 32);
weapon('mithril_sword',   'Mithril sword',   'sword',  '#6f9bd6', '#2b5a96', '#bcd6ff', 400, 44);
weapon('mithril_scimitar','Mithril scimitar','scim',   '#6f9bd6', '#2b5a96', '#bcd6ff', 720, 56);
helm('mithril_helm',      'Mithril med helm', '#6f9bd6', '#2b5a96', 220);
platebody('mithril_platebody', 'Mithril platebody', '#6f9bd6', '#2b5a96', 980, 0x1e3a5a);

// Helper: a chunk-of-ore icon — a rough rock with a tinted metal vein.
function oreIcon(vein, dark) {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 24 L13 13 L26 10 L33 19 L29 31 L15 33 Z" fill="#7a7068" stroke="#4a443e" stroke-width="1.5"/>
    <path d="M16 17 L23 15 L28 21 L22 26 Z" fill="${vein}" stroke="${dark}" stroke-width="1"/>
    <path d="M12 26 l4 -2 M25 28 l3 -3" stroke="${dark}" stroke-width="1" opacity="0.6"/></svg>`;
}
// Helper: a smithing bar icon — a stubby ingot in the metal's colours.
function barIcon(fill, stroke, shine) {
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-12 20 20)">
    <path d="M8 22 L12 17 L32 17 L36 22 L32 27 L12 27 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M12 18.4 L31 18.4" stroke="${shine}" stroke-width="1.4" opacity="0.85"/></g></svg>`;
}
// Helper: a smithed-blade icon for daggers/swords/scimitars.
function bladeIcon(kind, fill, stroke, shine) {
  let blade;
  if (kind === 'dagger') blade = `<path d="M20 6 L23 22 L20 26 L17 22 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><path d="M20 7 L20 24" stroke="${shine}" stroke-width="0.9"/>`;
  else if (kind === 'scim') blade = `<path d="M11 30 Q12 10 31 7 Q22 16 23 28 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.3"/><path d="M14 27 Q15 14 27 9" stroke="${shine}" stroke-width="1" fill="none"/>`;
  else blade = `<path d="M20 4 L23 26 L20 30 L17 26 Z" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><path d="M20 5 L20 28" stroke="${shine}" stroke-width="0.9"/>`;
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${blade}
    <rect x="13" y="29" width="14" height="2.6" rx="1.2" fill="#6b4a2f"/><rect x="18.6" y="30" width="2.8" height="6" rx="1.2" fill="#6b4a2f"/></svg>`;
}

// Helper: a banded bundle-of-logs icon in the given wood colours. `glow` adds a
// soft aura behind the bundle (used by magic logs).
function logIcon(fill, stroke, ring, glow) {
  const g = glow ? `<circle cx="20" cy="20" r="16" fill="#9ab0ff" opacity="0.22"/>` : '';
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${g}<g transform="rotate(-20 20 20)">
    <rect x="7" y="15" width="26" height="11" rx="5.5" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>
    <path d="M11 16.5 H31 M11 20 H31 M12 23.4 H30" stroke="${stroke}" stroke-width="0.8" opacity="0.7"/>
    <ellipse cx="9" cy="20.5" rx="3.4" ry="5.5" fill="${ring}" stroke="${stroke}" stroke-width="1.3"/>
    <ellipse cx="9" cy="20.5" rx="2.1" ry="3.4" fill="none" stroke="${stroke}" stroke-width="0.9"/></g></svg>`;
}

// Helper: a stylized axe icon in the given blade colours.
function axeIcon(fill, stroke, shine, glow) {
  const g = glow ? `<circle cx="25" cy="13" r="11" fill="${fill}" opacity="0.22"/>` : '';
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${g}
    <rect x="18.5" y="9" width="3.6" height="24" rx="1.7" fill="#6b4a2f" stroke="#3a2a18" stroke-width="0.8"/>
    <path d="M19 9 C26 8 31 11 31 16 C31 19 27 20.5 19 18 Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <path d="M22 10.5 C26 10.5 29 12.5 29.6 15" stroke="${shine}" stroke-width="1" fill="none" opacity="0.9"/></svg>`;
}
