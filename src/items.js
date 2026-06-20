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
    equipable: true, slot: 'weapon', tool: 'pickaxe', examine: 'For mining ore. (Mining coming soon!)',
    icon: `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><rect x="18.5" y="11" width="3" height="23" rx="1.5" fill="#6b4a2f"/><path d="M7 15 Q20 8 33 15 Q20 12 7 15 Z" fill="#c8842f" stroke="#7a4a18" stroke-width="1"/></svg>`,
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

// Helper: a stylized axe icon in the given blade colours.
function axeIcon(fill, stroke, shine, glow) {
  const g = glow ? `<circle cx="25" cy="13" r="11" fill="${fill}" opacity="0.22"/>` : '';
  return `<svg viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">${g}
    <rect x="18.5" y="9" width="3.6" height="24" rx="1.7" fill="#6b4a2f" stroke="#3a2a18" stroke-width="0.8"/>
    <path d="M19 9 C26 8 31 11 31 16 C31 19 27 20.5 19 18 Z" fill="${fill}" stroke="${stroke}" stroke-width="1"/>
    <path d="M22 10.5 C26 10.5 29 12.5 29.6 15" stroke="${shine}" stroke-width="1" fill="none" opacity="0.9"/></svg>`;
}
