// thieving.js — the Thieving skill. Self-contained & self-initializing (polls
// window.eldenmoor). Right-click a townsperson and choose "Pickpocket": you roll
// against your Thieving level for a purse of coins (and the occasional trinket).
// Fail and they catch you — you're stunned for a moment and take a small knock.
// contextmenu.js adds the Pickpocket option, which calls em.thieving.pickpocket.
// Exposed as window.eldenmoor.thieving.

import { gameMessage } from './ui.js';

const PICK_RANGE = 2.6;       // must be close to pickpocket
const STUN_TIME = 2.8;        // seconds you're frozen out after being caught
const COOLDOWN = 0.7;         // min seconds between attempts

function startThieving(em) {
  const { player, skills, inventory } = em;
  let stunnedUntil = 0, lastTry = 0;
  const lvl = () => (skills.state.thieving && skills.state.thieving.level) || 1;

  // Coins scale gently with your Thieving level; XP per successful dip.
  function loot() {
    const l = lvl();
    const base = 3 + Math.floor(l * 0.8);
    const coins = base + Math.floor(Math.random() * (base + 2));
    const xp = 8 + Math.floor(l * 0.6);
    return { coins, xp };
  }

  function pickpocket(npc, def) {
    const now = performance.now() / 1000;
    if (now < stunnedUntil) { gameMessage('You are still recovering — wait a moment.'); return; }
    if (now - lastTry < COOLDOWN) return;
    lastTry = now;
    // proximity check (walk closer if needed)
    if (npc && npc.position) {
      const d = Math.hypot(npc.position.x - player.position.x, npc.position.z - player.position.z);
      if (d > PICK_RANGE) {
        gameMessage('You need to be closer to pickpocket ' + def.name + '.');
        if (em.interactions && em.interactions.setNpcTarget) em.interactions.setNpcTarget(npc, () => {});
        return;
      }
    }
    // success chance climbs with level: ~60% at level 1 up to ~92%.
    const chance = Math.min(0.92, 0.6 + (lvl() - 1) * 0.012);
    if (Math.random() < chance) {
      const r = loot();
      inventory.add('coins', r.coins);
      const res = skills.addXp('thieving', r.xp);
      gameMessage('You pick ' + def.name + "'s pocket and find " + r.coins + ' coins.');
      if (em.audio && em.audio.play) em.audio.play('pickup');
      // a rare trinket from wealthier-looking folk
      if (Math.random() < 0.05) { inventory.add('emerald', 1); gameMessage('Your nimble fingers also lift an emerald!'); }
      if (res && res.leveledUp) gameMessage('Congratulations, your Thieving is now level ' + res.level + '!');
    } else {
      // caught: brief stun + a small knock via combat if available
      stunnedUntil = now + STUN_TIME;
      gameMessage(def.name + ' catches you red-handed and shoves you back!');
      if (em.audio && em.audio.play) em.audio.play('hit');
      try {
        const ps = player.userData && player.userData.combat;
        if (ps && em.combat && em.combat.setPlayerHp) em.combat.setPlayerHp(Math.max(1, ps.hp - 1));
      } catch (e) {}
    }
  }

  return { pickpocket, isStunned: () => performance.now() / 1000 < stunnedUntil };
}

// ----- self-initialize ------------------------------------------------------
(function boot() {
  let tries = 0;
  const iv = setInterval(() => {
    tries++;
    const em = window.eldenmoor;
    if (em && em.player && em.skills && em.inventory) {
      clearInterval(iv);
      try { em.thieving = startThieving(em); }
      catch (err) { console.error('[thieving] failed to start', err); }
    } else if (tries > 600) { clearInterval(iv); }
  }, 100);
})();
