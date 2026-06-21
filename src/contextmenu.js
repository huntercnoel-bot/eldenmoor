// contextmenu.js — Old School RuneScape-style right-click menus.
// Right-click the world (talk/trade NPCs, chop/examine trees, walk here),
// an inventory item (equip / examine / drop), or worn gear (unequip / examine).

import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

export function setupContextMenu({ dom, interactions, inventory, equipment, onTalk, onTrade }) {
  const menu = document.createElement('div');
  menu.id = 'ctxmenu';
  menu.hidden = true;
  document.body.appendChild(menu);

  const hide = () => { menu.hidden = true; };
  window.addEventListener('click', hide);
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') hide(); });
  document.addEventListener('contextmenu', (e) => e.preventDefault()); // no browser menu in-game

  function show(x, y, title, options) {
    menu.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'ctx-head';
    head.textContent = title;
    menu.appendChild(head);
    for (const opt of options) {
      const row = document.createElement('div');
      row.className = 'ctx-item';
      row.innerHTML = opt.label;
      row.addEventListener('click', (ev) => { ev.stopPropagation(); hide(); if (opt.action) opt.action(); });
      menu.appendChild(row);
    }
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 6) + 'px';
    if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 6) + 'px';
  }

  // --- Right-click the 3D world ---
  dom.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const w = interactions.raycastWorld(e.clientX, e.clientY);
    const options = [];
    if (w.monster) {
      const md = w.monster.userData.monster;
      const mname = (md && md.type && md.type.name) || 'Monster';
      const lvlTxt = md && md.type && md.type.combatLevel ? ' <span class="ctx-lvl">(level ' + md.type.combatLevel + ')</span>' : '';
      options.push({ label: 'Attack <span class="ctx-yellow">' + mname + '</span>' + lvlTxt, action: () => { const c = window.eldenmoor && window.eldenmoor.combat; if (c && c.attack) c.attack(w.monster); } });
      options.push({ label: 'Examine <span class="ctx-yellow">' + mname + '</span>', action: () => gameMessage('A ' + mname.toLowerCase() + '. It looks hostile.') });
    }
    if (w.npc) {
      const def = w.npc.userData.def;
      options.push({ label: 'Talk-to <span class="ctx-yellow">' + def.name + '</span>', action: () => interactions.setNpcTarget(w.npc, () => onTalk && onTalk(def)) });
      if (def.type === 'shop') options.push({ label: 'Trade with <span class="ctx-yellow">' + def.name + '</span>', action: () => interactions.setNpcTarget(w.npc, () => onTrade && onTrade(def)) });
      options.push({ label: 'Pickpocket <span class="ctx-yellow">' + def.name + '</span>', action: () => { try { window.eldenmoor.thieving && window.eldenmoor.thieving.pickpocket(w.npc, def); } catch (err) {} } });
      options.push({ label: 'Examine <span class="ctx-yellow">' + def.name + '</span>', action: () => gameMessage(def.examine) });
    }
    if (w.tree) {
      options.push({ label: 'Chop down <span class="ctx-yellow">Tree</span>', action: () => interactions.setChopTarget(w.tree) });
      options.push({ label: 'Examine Tree', action: () => gameMessage('A sturdy tree, ripe for woodcutting.') });
    }
    if (w.rock) {
      options.push({ label: 'Examine <span class="ctx-yellow">Rock</span>', action: () => gameMessage('A heavy boulder — you sense ore within. (Mining coming soon.)') });
    }
    if (w.point) {
      options.push({ label: 'Walk here', action: () => interactions.setWalkTarget(w.point) });
    }
    options.push({ label: 'Cancel', action: hide });
    show(e.clientX, e.clientY, 'Choose Option', options);
  });

  // --- Right-click an inventory item ---
  const invGrid = document.getElementById('inv-grid');
  if (invGrid) invGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const slotEl = e.target.closest('.inv-slot');
    if (!slotEl || slotEl.dataset.slot === undefined) return;
    const s = inventory.slots[+slotEl.dataset.slot];
    if (!s) return;
    const def = ITEMS[s.id];
    const options = [];
    if (def.equipable) options.push({ label: 'Equip <span class="ctx-yellow">' + def.name + '</span>', action: () => equipment.equip(s.id) });
    if (def.buryXp) options.push({ label: 'Bury <span class="ctx-yellow">' + def.name + '</span>', action: () => { try { window.eldenmoor.prayer && window.eldenmoor.prayer.bury(s.id); } catch (e) {} } });
    options.push({ label: 'Examine', action: () => gameMessage(def.examine) });
    options.push({ label: 'Drop <span class="ctx-yellow">' + def.name + '</span>', action: () => { inventory.removeOne(s.id); gameMessage('You drop the ' + def.name + '.'); } });
    options.push({ label: 'Cancel', action: hide });
    show(e.clientX, e.clientY, def.name, options);
  });

  // --- Right-click a worn item ---
  const eqGrid = document.getElementById('equip-grid');
  if (eqGrid) eqGrid.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const cell = e.target.closest('.equip-slot');
    if (!cell || cell.dataset.slot === undefined) return;
    const itemId = equipment.slots[cell.dataset.slot];
    if (!itemId) return;
    const def = ITEMS[itemId];
    show(e.clientX, e.clientY, def.name, [
      { label: 'Unequip <span class="ctx-yellow">' + def.name + '</span>', action: () => equipment.unequip(cell.dataset.slot) },
      { label: 'Examine', action: () => gameMessage(def.examine) },
      { label: 'Cancel', action: hide },
    ]);
  });
}
