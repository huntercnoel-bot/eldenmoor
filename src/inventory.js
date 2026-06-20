// inventory.js — a 28-slot backpack (like Old School RuneScape) and its UI.
// Stackable items pile into one slot with a count; click an item to use/equip it.

import { ITEMS } from './items.js';

const SLOTS = 28;

export function createInventory() {
  const slots = new Array(SLOTS).fill(null); // each slot: null or { id, qty }
  const gridEl = document.getElementById('inv-grid');
  let onClick = null; // set by the game: called when a slot is clicked

  function setClickHandler(fn) { onClick = fn; }

  function count(itemId) {
    return slots.reduce((n, s) => n + (s && s.id === itemId ? s.qty : 0), 0);
  }

  // Add an item. Returns true if it fit, false if the bag was full.
  function add(itemId, qty = 1) {
    const def = ITEMS[itemId];
    if (!def) return false;
    if (def.stackable) {
      const existing = slots.find((s) => s && s.id === itemId);
      if (existing) { existing.qty += qty; render(); return true; }
      const empty = slots.indexOf(null);
      if (empty < 0) return false;
      slots[empty] = { id: itemId, qty };
    } else {
      for (let i = 0; i < qty; i++) {
        const empty = slots.indexOf(null);
        if (empty < 0) { render(); return false; }
        slots[empty] = { id: itemId, qty: 1 };
      }
    }
    render();
    return true;
  }

  // Remove one of an item (used when equipping). Returns true if something left.
  function removeOne(itemId) {
    for (let i = 0; i < SLOTS; i++) {
      const s = slots[i];
      if (s && s.id === itemId) {
        s.qty -= 1;
        if (s.qty <= 0) slots[i] = null;
        render();
        return true;
      }
    }
    return false;
  }

  // Redraw the 28 slots from the current contents.
  function render() {
    const coinEl = document.getElementById('coin-count');
    if (coinEl) coinEl.textContent = count('coins').toLocaleString();
    if (!gridEl) return;
    gridEl.innerHTML = '';
    for (let i = 0; i < SLOTS; i++) {
      const slot = document.createElement('div');
      slot.className = 'inv-slot';
      slot.dataset.slot = i;
      const s = slots[i];
      if (s) {
        const def = ITEMS[s.id];
        slot.innerHTML = def.icon + (s.qty > 1 ? `<span class="inv-qty">${formatQty(s.qty)}</span>` : '');
        slot.title = def.name + (def.equipable ? ' — click to equip' : ' — ' + def.examine);
        slot.classList.add('filled');
        slot.onclick = () => { if (onClick) onClick(s.id, def); };
      }
      gridEl.appendChild(slot);
    }
  }

  function load(savedSlots) {
    for (let i = 0; i < SLOTS; i++) {
      const s = savedSlots[i];
      slots[i] = (s && ITEMS[s.id]) ? { id: s.id, qty: s.qty } : null;
    }
    render();
  }

  render();
  // Remove N of a stackable item (used to pay coins). Returns true if all removed.
  function removeN(itemId, n) {
    let left = n;
    for (let i = 0; i < SLOTS && left > 0; i++) {
      const s = slots[i];
      if (s && s.id === itemId) {
        const take = Math.min(s.qty, left);
        s.qty -= take; left -= take;
        if (s.qty <= 0) slots[i] = null;
      }
    }
    render();
    return left === 0;
  }

  return { add, removeOne, removeN, count, slots, render, load, setClickHandler };
}

// OSRS-style number shortening (e.g. 1500 -> "1.5K").
function formatQty(n) {
  if (n >= 1000000) return Math.floor(n / 100000) / 10 + 'M';
  if (n >= 1000) return Math.floor(n / 100) / 10 + 'K';
  return '' + n;
}
