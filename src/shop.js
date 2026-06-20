// shop.js — proper medieval shops. Each has a sign, a shopkeeper's greeting, and
// a list of wares (icon · name · description · price · Buy). Click an item in your
// bag while a shop is open to sell it.

import { ITEMS } from './items.js';
import { gameMessage } from './ui.js';

const SHOPS = {
  general: {
    name: "Bramble's General Store",
    greet: '"Welcome, traveller! Wares for every journey — have a look around."',
    stock: ['rope', 'tinderbox', 'torch', 'bucket', 'bread', 'clay_pot', 'pickaxe', 'fishing_rod', 'wooden_shield'],
  },
  axes: {
    name: "Hilda's Fine Axes",
    greet: '"A sharp axe makes light work, love. Finest blades in all Eldenmoor."',
    stock: ['bronze_axe', 'steel_axe', 'stormforged_axe', 'voidcleaver'],
  },
  armoury: {
    name: "Garrett's Armoury",
    greet: '"Fresh off the anvil — wear it well, and mind the dents."',
    stock: ['steel_helm', 'steel_platebody', 'steel_platelegs', 'steel_gauntlets', 'steel_boots', 'steel_kiteshield', 'adventurer_cape'],
  },
};

export function createShop(inventory) {
  const panel = document.getElementById('shop');
  const titleEl = document.getElementById('shop-title');
  const greetEl = document.getElementById('shop-greet');
  const gridEl = document.getElementById('shop-grid');
  const coinsEl = document.getElementById('shop-coins');
  const closeEl = document.getElementById('shop-close');
  let current = null;
  if (closeEl) closeEl.onclick = close;

  const buyPrice = (id) => ITEMS[id].value || 1;
  const sellPrice = (id) => Math.max(1, Math.floor((ITEMS[id].value || 1) * 0.6));

  function open(shopId) {
    current = SHOPS[shopId];
    if (!current || !panel) return;
    if (titleEl) titleEl.textContent = current.name;
    if (greetEl) greetEl.textContent = current.greet;
    render();
    panel.hidden = false;
  }
  function close() { if (panel) panel.hidden = true; current = null; }
  function isOpen() { return !!current && panel && !panel.hidden; }

  function render() {
    if (!gridEl || !current) return;
    if (coinsEl) coinsEl.textContent = inventory.count('coins').toLocaleString();
    gridEl.innerHTML = '';
    for (const id of current.stock) {
      const def = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shop-row';
      row.innerHTML =
        `<div class="shop-ic">${def.icon}</div>` +
        `<div class="shop-info"><div class="shop-nm">${def.name}</div><div class="shop-desc">${def.examine || ''}</div></div>` +
        `<div class="shop-buy"><div class="shop-pr">${buyPrice(id).toLocaleString()} 🪙</div></div>`;
      const btn = document.createElement('button');
      btn.className = 'shop-buybtn';
      btn.textContent = 'Buy';
      btn.onclick = () => buy(id);
      row.querySelector('.shop-buy').appendChild(btn);
      gridEl.appendChild(row);
    }
  }

  function buy(id) {
    const price = buyPrice(id);
    if (inventory.count('coins') < price) { gameMessage('You need ' + price + ' coins for that.'); return; }
    if (!inventory.add(id, 1)) { gameMessage('Your bag is full.'); return; }
    inventory.removeN('coins', price);
    render();
    gameMessage('You buy ' + ITEMS[id].name + ' for ' + price + ' coins.');
  }

  // Called when an inventory item is clicked while the shop is open.
  function sell(id) {
    if (!isOpen() || id === 'coins') return false;
    const price = sellPrice(id);
    if (!inventory.removeOne(id)) return false;
    inventory.add('coins', price);
    render();
    gameMessage('You sell ' + ITEMS[id].name + ' for ' + price + ' coins.');
    return true;
  }

  return { open, close, sell, isOpen, render };
}
