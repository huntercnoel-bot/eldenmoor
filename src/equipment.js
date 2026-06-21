// equipment.js — what the hero is wearing. Click a bag item to equip it; click a
// worn item to take it off. Notifies a listener whenever the weapon changes (so
// the hero's hand can hold the right axe).

import { ITEMS } from './items.js';

const SLOT_DEFS = [
  { id: 'head',   name: 'Head',   icon: '🪖' },
  { id: 'cape',   name: 'Cape',   icon: '🧣' },
  { id: 'amulet', name: 'Amulet', icon: '📿' },
  { id: 'weapon', name: 'Weapon', icon: '🗡️' },
  { id: 'body',   name: 'Body',   icon: '👕' },
  { id: 'shield', name: 'Shield', icon: '🛡️' },
  { id: 'legs',   name: 'Legs',   icon: '👖' },
  { id: 'hands',  name: 'Hands',  icon: '🧤' },
  { id: 'feet',   name: 'Feet',   icon: '🥾' },
  { id: 'ring',   name: 'Ring',   icon: '💍' },
];

// WoW-style paper-doll: gear down the left + right columns, a character
// silhouette in the middle, and the weapon/shield across the bottom.
const LAYOUT = [
  'head',   null, 'hands',
  'amulet', null, 'legs',
  'cape',   null, 'feet',
  'body',   null, 'ring',
  'weapon', null, 'shield',
];

export function createEquipment(inventory) {
  const slots = {};
  for (const d of SLOT_DEFS) slots[d.id] = null;
  const gridEl = document.getElementById('equip-grid');
  let onEquipChange = null;

  function getWeapon() { return slots.weapon ? ITEMS[slots.weapon] : null; }

  // Sum the combat bonuses of everything worn into one {attack,strength,defence}.
  // Drives accuracy, max hit and damage reduction over in combat.js.
  function getBonuses() {
    const total = { attack: 0, strength: 0, defence: 0 };
    for (const d of SLOT_DEFS) {
      const itemId = slots[d.id];
      const b = itemId && ITEMS[itemId] && ITEMS[itemId].bonuses;
      if (b) { total.attack += b.attack || 0; total.strength += b.strength || 0; total.defence += b.defence || 0; }
    }
    return total;
  }

  // Tell the listener a slot's worn item changed, so the 3D hero can update.
  function emit(slotId) { if (onEquipChange) onEquipChange(slotId, slots[slotId] ? ITEMS[slots[slotId]] : null); }
  function emitAll() { if (onEquipChange) for (const d of SLOT_DEFS) emit(d.id); }
  function setEquipChangeHandler(fn) { onEquipChange = fn; emitAll(); }

  function equip(itemId) {
    const def = ITEMS[itemId];
    if (!def || !def.equipable) return false;
    if (!inventory.removeOne(itemId)) return false;
    const previous = slots[def.slot];
    slots[def.slot] = itemId;
    if (previous) inventory.add(previous, 1);
    render(); emit(def.slot);
    return true;
  }

  function unequip(slotId) {
    const itemId = slots[slotId];
    if (!itemId) return false;
    if (!inventory.add(itemId, 1)) return false;
    slots[slotId] = null;
    render(); emit(slotId);
    return true;
  }

  function render() {
    if (!gridEl) return;
    gridEl.innerHTML = '';
    for (const slotId of LAYOUT) {
      if (!slotId) { const sp = document.createElement('div'); sp.className = 'equip-spacer'; gridEl.appendChild(sp); continue; }
      const def = SLOT_DEFS.find((d) => d.id === slotId);
      const cell = document.createElement('div');
      cell.className = 'equip-slot';
      cell.dataset.slot = slotId;
      const itemId = slots[slotId];
      if (itemId) {
        cell.innerHTML = ITEMS[itemId].icon;
        cell.title = ITEMS[itemId].name + ' — click to unequip';
        cell.classList.add('filled');
        cell.onclick = () => unequip(slotId);
      } else {
        cell.innerHTML = `<span class="equip-empty">${def.icon}</span>`;
        cell.title = def.name + ' slot';
      }
      gridEl.appendChild(cell);
    }
    // Total worn bonuses, OSRS equipment-stats style.
    const b = getBonuses();
    const stats = document.createElement('div');
    stats.className = 'equip-bonuses';
    stats.innerHTML =
      `<span title="Attack bonus">⚔️ +${b.attack}</span>` +
      `<span title="Strength bonus">💪 +${b.strength}</span>` +
      `<span title="Defence bonus">🛡️ +${b.defence}</span>`;
    gridEl.appendChild(stats);
  }

  function serialize() { return Object.assign({}, slots); }
  function load(saved) {
    for (const d of SLOT_DEFS) {
      const v = saved && saved[d.id];
      slots[d.id] = (v && ITEMS[v] && ITEMS[v].equipable) ? v : null;
    }
    render(); emitAll();
  }

  render();
  return { slots, equip, unequip, getWeapon, getBonuses, render, serialize, load, setEquipChangeHandler };
}
