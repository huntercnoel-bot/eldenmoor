// save.js — keeps your progress between sessions using the browser's
// localStorage: every skill's XP, your whole inventory, and your worn equipment.
// Auto-saves whenever something changes and again right before you close the tab.

export function createSave(skills, inventory, equipment, user, quests) {
  // Each account gets its own save slot.
  const KEY = 'eldenmoor.save.v2.' + (user || 'guest');
  let lastJson = '';

  function save() {
    try {
      // Bank lives on window.eldenmoor.bank (banking.js, self-contained); read
      // it additively if present so the vault persists alongside the inventory.
      const bank = (typeof window !== 'undefined' && window.eldenmoor && window.eldenmoor.bank) || null;
      const json = JSON.stringify({
        skills: skills.serialize(),
        slots: inventory.slots,
        equip: equipment.serialize(),
        quests: quests ? quests.serialize() : undefined,
        bank: bank ? bank.serialize() : undefined,
      });
      if (json === lastJson) return;
      lastJson = json;
      localStorage.setItem(KEY, json);
      flashSaved();
    } catch (e) { /* storage unavailable — just skip */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      lastJson = raw;
      const data = JSON.parse(raw);

      // Skills: new format is { skills:{id:xp} }; migrate the old { wcXp } format.
      let skillsData = data.skills;
      if (!skillsData && typeof data.wcXp === 'number') skillsData = { woodcutting: data.wcXp };
      if (skillsData) skills.load(skillsData);

      if (Array.isArray(data.slots)) inventory.load(data.slots);
      if (data.equip) equipment.load(data.equip);
      if (quests && data.quests) quests.load(data.quests);
      // Bank: hand it to banking.js if it's attached yet, otherwise stash the
      // raw data on a global so banking.js can pick it up once it boots. (load()
      // runs before window.eldenmoor is assigned, so we use a standalone global.)
      if (data.bank !== undefined && typeof window !== 'undefined') {
        const bank = window.eldenmoor && window.eldenmoor.bank;
        if (bank && bank.load) bank.load(data.bank);
        else window.__eldenmoorPendingBank = data.bank;
      }
      return true;
    } catch (e) { return false; }
  }

  function clear() {
    try { localStorage.removeItem(KEY); lastJson = ''; } catch (e) {}
  }

  setInterval(save, 3000);
  window.addEventListener('beforeunload', save);

  return { save, load, clear };
}

let savedEl = null, savedTimer = null;
function flashSaved() {
  if (!savedEl) savedEl = document.getElementById('saved');
  if (!savedEl) return;
  savedEl.style.opacity = '1';
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { savedEl.style.opacity = '0'; }, 1100);
}
