// save.js — keeps your progress between sessions using the browser's
// localStorage: every skill's XP, your whole inventory, and your worn equipment.
// Auto-saves whenever something changes and again right before you close the tab.

export function createSave(skills, inventory, equipment, user, quests) {
  // Each account gets its own save slot.
  const KEY = 'eldenmoor.save.v2.' + (user || 'guest');
  let lastJson = '';

  function save() {
    try {
      const json = JSON.stringify({
        skills: skills.serialize(),
        slots: inventory.slots,
        equip: equipment.serialize(),
        quests: quests ? quests.serialize() : undefined,
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
