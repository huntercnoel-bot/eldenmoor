// quests.js — the quest system: definitions, per-quest state, start/advance/
// complete, a quest log (built as DOM in JS), and persistence through save.js.
//
// A quest has ordered `stages`. Each stage has:
//   { name, journal, objective: { check(ctx) -> bool, hint } }
// The player advances a stage when its objective `check` passes (polled, and
// also re-checked when talking to the relevant NPC). Rewards are handed out by
// `grant(ctx)` on completion. Quest progress is { status, stage } per quest id.
//
// `ctx` exposes the live game systems: { skills, inventory, equipment, flags }.
// `flags` is a small per-quest scratch object persisted with the save (used here
// to record "talked to the cook", etc.).

import { gameMessage } from './ui.js';

export const STATUS = { NOT_STARTED: 'not_started', IN_PROGRESS: 'in_progress', COMPLETE: 'complete' };

// ---------------------------------------------------------------------------
// QUEST DEFINITIONS
// ---------------------------------------------------------------------------
// The King's first quest: a classic OSRS-style starter, and the player's first
// real taste of Eldenmoor. King Aldric's three-hundred-year-old great-hall hearth
// has gone cold as an early winter bites. What begins as a simple firewood errand
// turns, halfway through, into a small mystery: the fresh wood Bessa lays keeps
// guttering out, because the chimney flue is choked with damp, season-old soot.
// No firewood in the realm will hold a flame until the flue is scoured clean and
// the kindling struck anew. So the quest grows from a plain fetch into a little
// story, with a reveal at the kitchen hearth and a shopping run to put it right:
//   0) Gather firewood from the woods (reuses Woodcutting + an equipped axe).
//   1) Carry the firewood down to Bessa the cook, who keeps the hearth — and there
//      learn the wood alone won't do it: the flue is fouled and won't draw.
//   2) Fetch what's needed to set it right — a Bucket to scour the damp soot from
//      the flue and a Tinderbox to strike a fresh flame (both sold by Bramble at
//      the general store on the square). A real little shopping beat for variety.
//   3) Return to the King — the flue is cleared, the fire is lit, the hall is warm.
// The reward is tuned for a brand-new adventurer and stays usable at low level:
// starter coins, a Steel Axe to grow into, a healthy slice of Woodcutting XP for
// the work, a first taste of Firemaking XP for the relighting, and a fresh
// Tinderbox for the road.
//
// NOTE: the stage layout is what the talk flow in main.js keys off and is kept
// stable: firewood at stage 0, Bessa the cook at stage 1 (her delivery sets the
// `toldCook` flag), and the King at the LAST stage (he hands in the reward when
// `readyToComplete` is true). The new soot/relight beat slots in as a poll-checked
// fetch stage BETWEEN the cook and the King, so the existing talk plumbing never
// has to change — the craft is in making every beat feel alive within that shape.
const LOGS_NEEDED = 5;

export const QUEST_DEFS = {
  king: {
    id: 'king',
    name: "The King's Hearth",
    giver: 'king',
    // City/area this quest belongs to. The journal groups quests by `city`, so a
    // future city's quests slot into the same panel automatically just by setting
    // this field. Unset quests fall back to 'Eldenmoor'.
    city: 'Eldenmoor',
    intro: 'The great hall\'s ancient hearth has gone cold, and King Aldric seeks a willing soul to warm it before winter truly sets in.',
    startDialogue: [
      { speaker: 'King Aldric', text: 'Ah — a new face, and an able-looking one. Come closer, adventurer; the throne is draughty and my voice is not what it was.' },
      { speaker: 'King Aldric', text: 'Winter has come early and unkind to Eldenmoor. Worse still, the great hall\'s hearth lies cold — the first time in three hundred years its fire has died.' },
      { speaker: 'King Aldric', text: 'My court shivers in their furs, my steward grumbles over his ledgers, and I — sovereign of this realm — can no longer feel my royal toes. It simply will not do.' },
      { speaker: 'King Aldric', text: 'Take an axe to the woods beyond the square and cut me ' + LOGS_NEEDED + ' good logs for the fire. A small thing — but do it well, and you\'ll have proven yourself a true friend of the Crown.' },
    ],
    stages: [
      {
        name: 'Gather firewood',
        journal: 'King Aldric\'s great hall has gone cold. Equip an axe and chop trees in the woods beyond the square until you carry ' + LOGS_NEEDED + ' logs for the hearth.',
        objective: {
          hint: 'Chop trees until you carry ' + LOGS_NEEDED + ' logs.',
          check: (ctx) => ctx.inventory.count('logs') >= LOGS_NEEDED,
        },
        // Re-talking the King while you still owe logs gives a gentle nudge.
        nudge: [
          { speaker: 'King Aldric', text: 'Back already? Let me see... no, no — your bag wants for firewood yet. I count fewer than ' + LOGS_NEEDED + ' logs upon you.' },
          { speaker: 'King Aldric', text: 'Hilda by the square sells a fine axe if you\'ve none, and the woods are thick beyond the gate. The hearth will not light itself, brave soul — though heaven knows I\'ve sat here willing it to.' },
        ],
      },
      {
        name: 'Take the wood to Bessa',
        journal: 'You have the firewood. Bessa the castle cook keeps the great-hall hearth — carry the logs down to the keep kitchen and tell her the wood has come at last.',
        objective: {
          hint: 'Carry the logs to Bessa the cook in the castle kitchen.',
          check: (ctx) => !!ctx.flags.toldCook,
        },
        nudge: [
          { speaker: 'King Aldric', text: 'Splendid — fresh-cut logs, and good ones too! I can almost feel the warmth already. Almost.' },
          { speaker: 'King Aldric', text: 'But cold wood warms no one, eh? Take it down to Bessa in the kitchen — she has kept that hearth since my father\'s day and will lay the fire properly. Then return, and we\'ll see it lit together.' },
        ],
      },
      {
        // THE REVEAL. Bessa has laid the wood but the fire smokes and dies: the
        // flue is choked with damp, season-old soot and won't draw a flame. The
        // fix is a small shopping run to Bramble on the square — a Bucket to scour
        // the soot and a Tinderbox to strike a fresh light. Poll-checked, so it
        // advances the moment the player carries both, with no talk-flow changes.
        name: 'Clear and relight the hearth',
        journal: 'Bessa laid the wood — but the fire smokes and dies. The chimney flue is choked with damp, season-old soot and won\'t draw a flame. She needs a Bucket to scour the flue clean and a Tinderbox to strike the kindling fresh. Bramble at the general store on the square sells both.',
        objective: {
          hint: 'Buy a Bucket and a Tinderbox from Bramble\'s general store on the square.',
          check: (ctx) => ctx.inventory.count('bucket') >= 1 && ctx.inventory.count('tinderbox') >= 1,
        },
        // Re-talking the King between Bessa's discovery and your return. He has
        // had her word, and now lets the player in on the twist — turning the
        // fetch-quest into a small mystery to put right.
        nudge: [
          { speaker: 'King Aldric', text: 'Ah, you\'re back — but Bessa reached me first, by the kitchen boy. Grim news from the hearth, I\'m afraid.' },
          { speaker: 'King Aldric', text: 'Your wood is dry and sound, she says — but the fire will not hold. It catches, smokes, gutters, and dies. The flue itself is fouled: a season\'s damp soot, packed black and choking the draw.' },
          { speaker: 'King Aldric', text: 'So THAT is why my hearth went cold — not for want of wood at all, but a chimney left too long untended. Three hundred years it drew clean, and we let it clog in a single careless autumn. For shame.' },
          { speaker: 'King Aldric', text: 'Bessa needs a stout bucket to scour the flue clean, and a tinderbox to strike the kindling anew. Bramble keeps both at the general store on the square — fetch them, carry them down to her, and we\'ll have a true fire by nightfall.' },
        ],
      },
      {
        name: 'Return to the King',
        journal: 'The flue is scoured clean, the kindling has caught, and the great hall breathes warm once more. Return to King Aldric in the throne room to share in the fire you saved — and to claim his thanks.',
        objective: {
          hint: 'Return to King Aldric in the great hall.',
          check: () => false, // completed by talking to the King (handled in the talk flow)
        },
        // Shown if the player re-opens the King on the final stage before the talk
        // flow hands in (kept for completeness — the talk flow normally turns in).
        nudge: [
          { speaker: 'King Aldric', text: 'The flue draws clean, the kindling has caught, and I can smell true woodsmoke on the air at last. Stand a moment by the throne, and watch an old hearth wake.' },
        ],
      },
    ],
    // Reward handed out on completion. Takes the bucket and tinderbox the player
    // carried up (they go into clearing and lighting the hearth, so the fix feels
    // real), then pays out something a brand-new adventurer can genuinely use:
    // starter coins, a slice of Woodcutting XP for the cutting, a first taste of
    // Firemaking XP for the relighting, a Steel Axe to grow into, and a fresh
    // tinderbox for the road ahead.
    reward: {
      text: '300 coins, a Steel Axe, 250 Woodcutting XP, 120 Firemaking XP, and a Tinderbox',
      grant: (ctx) => {
        // The bucket and tinderbox you brought are spent setting the hearth right.
        ctx.inventory.removeN('bucket', 1);
        ctx.inventory.removeN('tinderbox', 1);
        ctx.inventory.add('coins', 300);
        ctx.inventory.add('steel_axe', 1);
        ctx.inventory.add('tinderbox', 1); // a fresh one for your own campfires
        ctx.skills.addXp('woodcutting', 250);
        ctx.skills.addXp('firemaking', 120);
      },
    },
    completeDialogue: [
      { speaker: 'King Aldric', text: 'You return! And — ah, do you hear it? The crackle, the snap of dry wood catching, the long clean breath of a chimney that draws at last. Bessa has worked her quiet magic, and the great hall is warm once more.' },
      { speaker: 'King Aldric', text: 'A scoured flue and a struck flame — who would have thought it? Three hundred years that fire has burned, and tonight it owes its life to your two willing hands. Even my steward managed something close to a smile. A rare omen indeed.' },
      { speaker: 'King Aldric', text: 'A friend of the Crown does not go unthanked. Here — a purse to set you on your way, and a steel axe; sturdier than whatever you swung in my woods today. Take a fresh tinderbox, too, so you need never sit cold on the road.' },
      { speaker: 'King Aldric', text: 'Go now, and warm yourself by the fire you saved. There will be greater trials than cold toes ahead, brave soul — goblins in the hills, whispers from the cellar, roads that want walking — and when they come, I shall know whose name to call.' },
    ],
    doneDialogue: [
      { speaker: 'King Aldric', text: 'The hearth roars, the flue draws clean, and my toes — bless them — have feeling once more. You have the lasting thanks of the Crown, friend.' },
      { speaker: 'King Aldric', text: 'Sit by the fire whenever you pass. You, of all who walk these halls, have earned a place beside it. And keep that axe sharp — adventure has a way of finding the warm and the willing.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 2 — "Vermin and Vandals" (COMBAT). Pell the farmer's harvest is under
  // siege: giant rats in the grain stores, then goblins bold enough to raid the
  // field itself. A two-stage cull that teaches the player to fight, tracked live
  // through window.eldenmoor.quests.onMonsterKill(typeId) (combat.js calls it on
  // every kill). Rewards lean martial: a shield, coins, real combat XP, and a
  // loaf for the road.
  // -------------------------------------------------------------------------
  pell: {
    id: 'pell',
    name: 'Vermin and Vandals',
    giver: 'farmer',
    city: 'Eldenmoor',
    intro: 'Pell the farmer\'s harvest is besieged — rats in the grain and goblins in the field. He could use a willing hand and a sharp blade.',
    // Data-driven offer (read by the generic quest-giver flow in main.js).
    startConfirm: {
      prompt: 'So — will you take up a blade and clear old Pell\'s land?',
      yes: 'Aye, Pell. I\'ll thin out the vermin for you.',
      no: 'I\'ve other roads to walk first.',
      more: 'Tell me about these pests.',
      moreDialogue: [
        { speaker: 'Pell', text: 'Giant rats, first — big as terriers and twice as bold, gorging in my grain store till there\'ll be nowt left for the castle ovens.' },
        { speaker: 'Pell', text: 'And then the goblins. Little green devils crept down from the hills, trampling my wheat and pinching my turnips. A scarecrow won\'t scare THAT lot. But a blade might.' },
      ],
      noReply: 'Fair enough. But the rats won\'t wait, and nor will the goblins. Come back when your courage\'s up, eh?',
      yesReply: [
        { speaker: 'Pell', text: 'Ha! Knew you had iron in you. Right — start with the grain store. Four of those great rats at least, or it\'s no good.' },
        { speaker: 'Pell', text: 'You\'ll find \'em skulking about the fields and the castle approach. Off you pop, and mind their teeth!' },
      ],
    },
    startDialogue: [
      { speaker: 'Pell', text: 'Oh — thank the King, a face with some fight in it! You there, adventurer — got a moment for a farmer in a fix?' },
      { speaker: 'Pell', text: 'Good harvest this year, I\'ll not lie — but I\'ll lose the lot if these pests have their way. Giant rats in my grain, and now GOBLINS, bold as you like, stamping through my wheat.' },
      { speaker: 'Pell', text: 'I\'m too old to swing a blade and too stubborn to watch it all spoil. You\'ve an axe and a strong arm — would you clear \'em out for me? I\'ll see you well paid.' },
    ],
    stages: [
      {
        name: 'Cull the giant rats',
        journal: 'Pell\'s grain store is overrun with giant rats. Hunt down and slay 4 giant rats around the fields and the castle approach.',
        objective: {
          hint: 'Slay giant rats (0 / 4). Track: kill them anywhere in Eldenmoor.',
          check: (ctx) => (ctx.flags.ratKills || 0) >= 4,
        },
        // The hint updates live as you cull, so the journal counts up with you.
        progressHint: (ctx) => 'Slay giant rats (' + Math.min(ctx.flags.ratKills || 0, 4) + ' / 4).',
        nudge: [
          { speaker: 'Pell', text: 'Still rats in the grain, by the squeaking of it. Four of the great brutes, mind — fewer won\'t do. Get after \'em!' },
        ],
      },
      {
        name: 'Drive off the goblins',
        journal: 'The grain store is clearing — but goblins are trampling the wheat. Slay 3 goblins to drive the green devils off Pell\'s land.',
        objective: {
          hint: 'Slay goblins (0 / 3).',
          check: (ctx) => (ctx.flags.goblinKills || 0) >= 3,
        },
        progressHint: (ctx) => 'Slay goblins (' + Math.min(ctx.flags.goblinKills || 0, 3) + ' / 3).',
        nudge: [
          { speaker: 'Pell', text: 'The rats are seen to — bless you! — but those goblins are still at my turnips. Three of \'em down ought to send the rest scurrying back to their hills.' },
        ],
      },
      {
        name: 'Return to Pell',
        journal: 'The rats are culled and the goblins driven off. Return to Pell at his field, south of the square, to claim your reward.',
        objective: { hint: 'Return to Pell at his field.', check: () => false },
        nudge: [
          { speaker: 'Pell', text: 'Quiet at last! Not a rat squeaking nor a goblin stamping. Come here and let me thank you proper.' },
        ],
      },
    ],
    // Combat-flavoured reward: a shield, a fair purse, a slice of real combat XP
    // across the melee skills, and a loaf for the long walk home.
    reward: {
      text: '250 coins, a Wooden shield, combat XP (Attack/Strength/Defence/Hitpoints), and a Loaf of bread',
      grant: (ctx) => {
        ctx.inventory.add('coins', 250);
        ctx.inventory.add('wooden_shield', 1);
        ctx.inventory.add('bread', 1);
        ctx.skills.addXp('attack', 160);
        ctx.skills.addXp('strength', 160);
        ctx.skills.addXp('defence', 120);
        ctx.skills.addXp('hitpoints', 90);
      },
    },
    completeDialogue: [
      { speaker: 'Pell', text: 'There she is — my hero in muddy boots! Not a rat squeaking, not a goblin stamping. You\'ve saved this whole harvest, and the castle\'s winter bread with it.' },
      { speaker: 'Pell', text: 'Take this purse — earned every copper. And a shield off my late brother\'s wall; he\'d want a fighter to carry it, not a nail. Here\'s a fresh loaf too, for the road.' },
      { speaker: 'Pell', text: 'You\'ve the makings of a proper warrior, that\'s plain. Keep that arm strong — Eldenmoor\'s got worse things than rats in its hills, mark old Pell.' },
    ],
    doneDialogue: [
      { speaker: 'Pell', text: 'Grain\'s safe, wheat\'s standing tall, and the turnips are mine again — all thanks to you. Off you pop now, and mind the scarecrow!' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 3 — "Forge and Firewood" (GATHER / CRAFT). Garrett the blacksmith has
  // run his charcoal dry and cracked his quenching bucket. He needs the player to
  // gather raw materials — logs to burn down for charcoal and a stout bucket to
  // hold the quench — then deliver them so he can fire the forge anew. A simple,
  // satisfying gather-and-deliver loop using items that already exist.
  // -------------------------------------------------------------------------
  garrett: {
    id: 'garrett',
    name: 'Forge and Firewood',
    giver: 'smith',
    city: 'Eldenmoor',
    intro: 'Garrett\'s forge has gone cold — out of charcoal and short a bucket. He needs firewood and a fresh bucket to get the coals glowing again.',
    startConfirm: {
      prompt: 'What do you say — will you stock my forge for me?',
      yes: 'Consider it done. Wood and a bucket, coming up.',
      no: 'Not just now, smith.',
      more: 'Why do you need logs, exactly?',
      moreDialogue: [
        { speaker: 'Garrett', text: 'Charcoal, friend. You burn good dry logs down slow in the pit and they char to charcoal — hotter and cleaner than raw wood. No charcoal, no forge.' },
        { speaker: 'Garrett', text: 'And the bucket\'s for the quench — plunging hot steel to harden it. Mine cracked clean through last week. Bring me 6 logs and a sound bucket and I\'m back in business.' },
      ],
      noReply: 'No matter. But a cold forge helps no one — no fresh armour for the road, eh? Come back when you\'ve a mind to.',
      yesReply: [
        { speaker: 'Garrett', text: 'Good lad. Six logs for the charcoal pit, and one stout bucket for the quench. Hilda or the woods\'ll sort you for wood; Bramble on the square keeps buckets.' },
        { speaker: 'Garrett', text: 'Bring \'em back here to the anvil and we\'ll have this forge roaring by supper.' },
      ],
    },
    startDialogue: [
      { speaker: 'Garrett', text: 'Step up to the anvil, friend — though I\'ll warn you, the forge is stone cold and I\'m in a foul mood about it.' },
      { speaker: 'Garrett', text: 'Run clean out of charcoal, I have, and to top it my quenching bucket cracked through. A smith with no fire and no quench is just a fellow with a heavy hammer and nothing to hit.' },
      { speaker: 'Garrett', text: 'I\'d fetch it myself, but I can\'t leave the shop. Would you gather what I need? Good logs to char, and a sound bucket. I\'ll pay you in coin and good steel.' },
    ],
    stages: [
      {
        name: 'Gather logs and a bucket',
        journal: 'Garrett needs raw materials for his forge: 6 logs to burn down for charcoal, and 1 sturdy bucket for the quench. Chop trees in the woods (or buy logs) and pick up a bucket from Bramble\'s general store on the square.',
        objective: {
          hint: 'Gather 6 logs and 1 bucket.',
          check: (ctx) => ctx.inventory.count('logs') >= 6 && ctx.inventory.count('bucket') >= 1,
        },
        progressHint: (ctx) => 'Logs (' + Math.min(ctx.inventory.count('logs'), 6) + ' / 6) and a Bucket (' + Math.min(ctx.inventory.count('bucket'), 1) + ' / 1).',
        nudge: [
          { speaker: 'Garrett', text: 'Forge\'s still cold, friend. Six logs and a bucket — that\'s the order. The woods are thick and Bramble\'s shop is right on the square.' },
        ],
      },
      {
        name: 'Deliver the materials to Garrett',
        journal: 'You have the logs and the bucket. Carry them back to Garrett at his anvil so he can char his charcoal and ready the quench.',
        objective: { hint: 'Bring the logs and bucket to Garrett at the anvil.', check: () => false },
        nudge: [
          { speaker: 'Garrett', text: 'You\'ve got the wood and the bucket — bring \'em here to the anvil and I\'ll get to work!' },
        ],
      },
    ],
    // Takes the gathered materials (they go into the forge) and pays out gear a
    // low-level smith-customer can use, plus a little Woodcutting/Firemaking XP
    // for the wood-work and a fair purse.
    reward: {
      text: 'Steel boots, 180 coins, 120 Woodcutting XP, and 80 Firemaking XP',
      grant: (ctx) => {
        ctx.inventory.removeN('logs', 6);
        ctx.inventory.removeN('bucket', 1);
        ctx.inventory.add('steel_boots', 1);
        ctx.inventory.add('coins', 180);
        ctx.skills.addXp('woodcutting', 120);
        ctx.skills.addXp('firemaking', 80);
      },
    },
    completeDialogue: [
      { speaker: 'Garrett', text: 'Ahh — there it is! Six good logs and a bucket that\'ll hold water. You\'ve no idea what a sight that is to a forge-bound smith.' },
      { speaker: 'Garrett', text: 'Listen — the coals are catching already. (clang, clang) Hear that? That\'s a working forge again, and it\'s your doing.' },
      { speaker: 'Garrett', text: 'Here — a pair of steel boots, fresh off the bench, and your coin. Keep your feet shod and your fire stoked, friend. A smith never forgets who warmed his forge.' },
    ],
    doneDialogue: [
      { speaker: 'Garrett', text: 'Forge is roaring, charcoal\'s charring sweet, and the quench is full. Step up any time you need good steel — your coin\'s as welcome as your help was.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 4 — "The Prisoner's Supper" (DELIVERY / MYSTERY). Kindly Old Tomas asks
  // the player to carry a humble loaf down to Old Hagen, the wretch in the castle
  // cellar — "an old friend, wrongly jailed." But when the player delivers it,
  // Hagen lets slip the twist: the loaf is a SIGNAL between two old thieves, and
  // there's buried coin behind it. Carry the countersign back to Tomas and the
  // sweet old man drops his act. A talk-to delivery with a small reveal — no new
  // systems, all dialogue beats.
  // -------------------------------------------------------------------------
  tomas: {
    id: 'tomas',
    name: 'The Prisoner\'s Supper',
    giver: 'tomas',
    city: 'Eldenmoor',
    intro: 'Old Tomas keeps a soft spot for a prisoner in the castle cellar, and a loaf he\'d dearly love delivered. A simple kindness... isn\'t it?',
    startConfirm: {
      prompt: 'Would you carry a poor old prisoner his supper? It would mean the world.',
      yes: 'Of course. I\'ll take the loaf down to him.',
      no: 'I\'d rather not get tangled in cellar business.',
      more: 'Who is this prisoner to you?',
      moreDialogue: [
        { speaker: 'Old Tomas', text: 'An old, old friend — Hagen\'s his name. We were boys together in this very square, sixty year gone. He fell on hard times and worse company, and now he rots in the cellar over some nonsense with a goat.' },
        { speaker: 'Old Tomas', text: 'The jailer Grix won\'t let ME down there — old grudge, long story. But a sprightly adventurer like you? You\'ll walk right past him. Just slip Hagen the loaf, there\'s a good soul.' },
      ],
      noReply: 'Ah. Well. No matter, no matter. An old man\'s sentiment, is all. Forget I asked, young\'un.',
      yesReply: [
        { speaker: 'Old Tomas', text: 'Bless your heart! Here — take this loaf. Fresh baked, still warm. Carry it down to the cellar, find Hagen behind the bars, and put it straight in his hands. His OWN hands, mind — that\'s important.' },
        { speaker: 'Old Tomas', text: 'Down the stairs in the keep, past the jailer. And — er — no need to mention to Grix where it came from, eh? Off you go.' },
      ],
      // Items handed to the player when they accept (delivered later).
      onAccept: (ctx) => { ctx.inventory.add('bread', 1); },
    },
    startDialogue: [
      { speaker: 'Old Tomas', text: 'Pssst. You — the adventurer. Sixty year I\'ve watched this square, and I\'ve a fair eye for a trustworthy face. You\'ve got one. Come closer.' },
      { speaker: 'Old Tomas', text: 'I\'ve a small kindness wants doing, and these old legs won\'t manage the cellar stairs. There\'s a prisoner down there — poor Hagen — and not a soul brings him a decent crust.' },
      { speaker: 'Old Tomas', text: 'I\'ve a fresh loaf with his name on it, near enough. Would you carry it down to him? A small thing, to warm an old wretch\'s belly... and an old man\'s conscience.' },
    ],
    stages: [
      {
        name: 'Deliver the loaf to Hagen',
        journal: 'Old Tomas gave you a loaf of bread for Old Hagen, the prisoner in the castle cellar. Take the stairs down in the keep, find Hagen behind the bars, and hand him the loaf yourself.',
        objective: {
          hint: 'Carry the loaf to Old Hagen, the prisoner in the cellar.',
          check: (ctx) => !!ctx.flags.gaveBread,
        },
        nudge: [
          { speaker: 'Old Tomas', text: 'Still got the loaf, I see. The cellar\'s down the keep stairs, past Grix. Put it in Hagen\'s own hands — he\'ll know what to do with it.' },
        ],
      },
      {
        name: 'Carry the countersign back to Tomas',
        journal: 'Hagen wasn\'t the helpless wretch you were told. He gave you a strange message for Tomas — "the crow flies at dusk" — and a knowing wink. Carry his words back to Old Tomas in the square and see what the old man has to say for himself.',
        objective: { hint: 'Take Hagen\'s message back to Old Tomas in the square.', check: () => false },
        nudge: [
          { speaker: 'Old Tomas', text: 'Well? Did you see him? Did he... say anything? Anything to pass along to old Tomas, hm?' },
        ],
      },
    ],
    // A roguish little payout — coins, a clay pot and a coil of rope from Hagen
    // and Tomas's old "trade," plus a pinch of Firemaking XP for keeping secrets warm.
    reward: {
      text: '150 coins, a Coil of rope, a Clay pot, and 40 Firemaking XP',
      grant: (ctx) => {
        ctx.inventory.removeN('bread', 1); // the loaf, long since delivered
        ctx.inventory.add('coins', 150);
        ctx.inventory.add('rope', 1);
        ctx.inventory.add('clay_pot', 1);
        ctx.skills.addXp('firemaking', 40);
      },
    },
    completeDialogue: [
      { speaker: 'Old Tomas', text: '"The crow flies at dusk," you say? ...Ha. HA! After all these years, the old dog remembered the words. Bless him.' },
      { speaker: 'Old Tomas', text: 'All right, all right — I\'ll come clean, you\'ve earned it. Hagen and I weren\'t just boyhood friends. We were the slipperiest pair of cutpurses this square ever saw. That loaf? Our old signal. "The crow flies at dusk" means the coin\'s still safe where we buried it.' },
      { speaker: 'Old Tomas', text: 'The goat business that got him jailed — that was a cover, and a poor one. But the stash is real, and a share of it\'s yours for keeping an old man\'s secret. Here — coin, a length of good rope, and a pot to keep your finds in.' },
      { speaker: 'Old Tomas', text: 'Not a word to Grix, eh? Sixty year I\'ve watched this square, and I\'ll watch it sixty more — a reformed man, mostly. Off you pop, young\'un. And thank you.' },
    ],
    doneDialogue: [
      { speaker: 'Old Tomas', text: 'The crow flies at dusk, friend — and our little secret\'s safe with you. Watch the square with me sometime. It\'s mostly pigeons, but every now and then... it\'s interesting.' },
    ],
    // Delivery beats handled generically by main.js: when the player talks to the
    // listed NPC while the quest is at `stage`, show `dialogue` then run `onDone`.
    delivers: [
      {
        npc: 'prisoner',
        stage: 0,
        requires: (ctx) => ctx.inventory.count('bread') >= 1,
        dialogue: [
          { speaker: 'Old Hagen', text: 'Psst — a loaf? For ME? Bless you, friend, I\'m fair starved. Hand it here, hand it...' },
          { speaker: 'Old Hagen', text: '...Hold on. Where\'d you come by this? This particular loaf? ...You\'ve been talking to Tomas. HA! The old crook sent it, didn\'t he. After all this time.' },
          { speaker: 'Old Hagen', text: 'Listen close, friend, and never mind the goat — that\'s a long story and a poor one. You go back to Tomas and you tell him five words, exact: "the crow flies at dusk." He\'ll know. He\'ll KNOW.' },
          { speaker: 'Old Hagen', text: 'And here — take my thanks now, for there\'s a share in this for a clever messenger. Off you go before Grix gets nosy. The crow, mind. At dusk.' },
        ],
        // Sets the flag the stage-0 objective checks, which advances the quest.
        onDone: (quests) => quests.setFlag('tomas', 'gaveBread', true),
        // Missing the item: a gentle reminder rather than the delivery.
        missing: [
          { speaker: 'Old Hagen', text: 'Empty-handed, eh? A pity. They DID say there might be a loaf coming my way... go on, fetch it, and we\'ll talk proper.' },
        ],
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// QUEST STATE + ENGINE
// ---------------------------------------------------------------------------
export function createQuests({ skills, inventory, equipment }) {
  // progress: { [questId]: { status, stage, flags } }
  const progress = {};
  for (const id of Object.keys(QUEST_DEFS)) progress[id] = { status: STATUS.NOT_STARTED, stage: 0, flags: {} };

  let logEl = null, logBodyEl = null, tabBtn = null;
  let onChange = null;
  const setChangeHandler = (fn) => { onChange = fn; };

  function ctxFor(id) {
    return { skills, inventory, equipment, flags: progress[id].flags };
  }

  function status(id) { return progress[id] ? progress[id].status : STATUS.NOT_STARTED; }
  function stage(id) { return progress[id] ? progress[id].stage : 0; }
  function isComplete(id) { return status(id) === STATUS.COMPLETE; }
  function isActive(id) { return status(id) === STATUS.IN_PROGRESS; }

  function start(id) {
    const p = progress[id];
    if (!p || p.status !== STATUS.NOT_STARTED) return false;
    p.status = STATUS.IN_PROGRESS;
    p.stage = 0;
    gameMessage('Quest started: ' + QUEST_DEFS[id].name);
    renderLog();
    if (onChange) onChange();
    return true;
  }

  // Advance the active quest if the current stage's objective is satisfied.
  // Returns true if a stage actually advanced.
  function tryAdvance(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status !== STATUS.IN_PROGRESS) return false;
    const st = def.stages[p.stage];
    if (!st) return false;
    if (st.objective && st.objective.check(ctxFor(id))) {
      p.stage++;
      gameMessage('Quest updated: ' + def.name);
      renderLog();
      if (onChange) onChange();
      return true;
    }
    return false;
  }

  // Mark a quest flag (e.g. "talked to the cook") and re-evaluate.
  function setFlag(id, key, value = true) {
    const p = progress[id];
    if (!p) return;
    p.flags[key] = value;
    tryAdvance(id);
    renderLog();
  }

  // ADDITIVE combat hook. combat.js's killMonster should call this once per kill:
  //     if (em.quests && em.quests.onMonsterKill) em.quests.onMonsterKill(md.typeId);
  // We tally kills per monster type into the flags of every active quest, then
  // re-evaluate objectives. Quests that don't care simply never read the tally.
  // The mapping below routes a monster typeId to the flag a quest objective reads.
  const KILL_FLAG = { giant_rat: 'ratKills', goblin: 'goblinKills' };
  function onMonsterKill(typeId) {
    const flag = KILL_FLAG[typeId];
    if (!flag) return;
    let changed = false;
    for (const id of Object.keys(QUEST_DEFS)) {
      const p = progress[id];
      if (p.status !== STATUS.IN_PROGRESS) continue;
      p.flags[flag] = (p.flags[flag] || 0) + 1;
      changed = true;
      tryAdvance(id);
    }
    if (changed) renderLog();
  }

  function complete(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status === STATUS.COMPLETE) return false;
    p.status = STATUS.COMPLETE;
    p.stage = def.stages.length;
    if (def.reward && def.reward.grant) def.reward.grant(ctxFor(id));
    gameMessage('Quest complete: ' + def.name + '!');
    renderLog();
    if (onChange) onChange();
    return true;
  }

  // True when the active quest has cleared its last objective stage and is
  // waiting on the giver to hand over the reward.
  function readyToComplete(id) {
    const p = progress[id];
    const def = QUEST_DEFS[id];
    if (!p || !def || p.status !== STATUS.IN_PROGRESS) return false;
    return p.stage >= def.stages.length - 1;
  }

  // A quest can be started if it exists and has not yet been begun.
  function canStart(id) {
    return !!QUEST_DEFS[id] && status(id) === STATUS.NOT_STARTED;
  }

  // True when *any* quest is startable or waiting to be handed in. The HUD reads
  // this to make a tab/button glow ("you have something to do").
  function anyAvailable() {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (canStart(id) || readyToComplete(id)) return true;
    }
    return false;
  }

  // WoW-style marker state for a given giver NPC id:
  //   'available'   → a "!"  (a quest you can start)
  //   'in-progress' → a grey "?" (the quest is on, objectives still underway)
  //   'ready'       → a bright "?" (objectives done — return to hand it in)
  //   null          → no marker
  // `def.quest` (or a quest's `giver`) maps an NPC to its quest.
  function questIdForGiver(npcId) {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (QUEST_DEFS[id].giver === npcId || id === npcId) return id;
    }
    return null;
  }
  function markerFor(npcId) {
    const id = questIdForGiver(npcId);
    if (!id) return null;
    if (canStart(id)) return 'available';
    if (readyToComplete(id)) return 'ready';     // objectives cleared, awaiting turn-in
    if (isActive(id)) return 'in-progress';
    return null; // complete or otherwise → no marker
  }

  // Poll every active quest's objective (called from the game loop, throttled).
  function poll() {
    for (const id of Object.keys(QUEST_DEFS)) {
      if (progress[id].status === STATUS.IN_PROGRESS) tryAdvance(id);
    }
  }

  // ---- Quest log UI (built in JS; the UI Builder can restyle via the IDs) ----
  function ensureLog() {
    if (logEl) return;
    logEl = document.createElement('div');
    logEl.id = 'quest-log';
    logEl.className = 'quest-log';
    logEl.hidden = true;
    logEl.style.cssText = 'position:fixed;top:64px;right:14px;z-index:90;width:300px;max-height:60vh;overflow:auto;' +
      'box-sizing:border-box;padding:12px 14px;background:rgba(20,16,10,0.94);border:2px solid #b9892f;border-radius:10px;' +
      'color:#f3ead3;font:14px/1.45 Georgia,serif;box-shadow:0 6px 24px rgba(0,0,0,0.5);';

    const head = document.createElement('div');
    head.className = 'quest-log-head';
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;color:#ffd100;font-weight:700;font-size:16px;margin-bottom:8px;';
    head.innerHTML = '<span>📜 Quest Journal</span>';
    const closeBtn = document.createElement('button');
    closeBtn.id = 'quest-log-close';
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = 'cursor:pointer;background:none;border:none;color:#b9892f;font-size:16px;';
    closeBtn.onclick = () => toggleLog(false);
    head.appendChild(closeBtn);

    logBodyEl = document.createElement('div');
    logBodyEl.id = 'quest-log-body';
    logBodyEl.className = 'quest-log-body';

    logEl.append(head, logBodyEl);
    document.body.appendChild(logEl);

    // A small toggle button so the log is reachable without console poking.
    tabBtn = document.createElement('button');
    tabBtn.id = 'quest-log-toggle';
    tabBtn.className = 'quest-log-toggle';
    tabBtn.textContent = '📜 Quests';
    tabBtn.title = 'Open quest journal (J)';
    tabBtn.style.cssText = 'position:fixed;top:36px;right:14px;z-index:90;cursor:pointer;padding:5px 10px;' +
      'background:rgba(20,16,10,0.85);border:1px solid #b9892f;border-radius:6px;color:#ffd100;font:600 13px Georgia,serif;';
    tabBtn.onclick = () => toggleLog();
    document.body.appendChild(tabBtn);

    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'KeyJ') toggleLog();
    });
  }

  function toggleLog(force) {
    ensureLog();
    const show = (force === undefined) ? logEl.hidden : force;
    logEl.hidden = !show;
    if (show) renderLog();
  }

  // The city/area a quest belongs to (defaults to 'Eldenmoor').
  function cityOf(def) { return def.city || def.area || 'Eldenmoor'; }

  // Render one quest entry's HTML. Includes a per-quest status word so the panel
  // reads as a proper journal (available / in progress / complete).
  function questEntryHtml(id) {
    const p = progress[id], def = QUEST_DEFS[id];
    const done = p.status === STATUS.COMPLETE;
    const started = p.status === STATUS.IN_PROGRESS;
    const statusWord = done ? 'complete' : (started ? 'in progress' : 'available');
    const statusColor = done ? '#7ddf7d' : (started ? '#ffd100' : '#cfe2ff');
    let html = `<div class="quest-entry quest-${done ? 'complete' : started ? 'in-progress' : 'available'}" data-quest="${id}" style="margin-bottom:12px;">`;
    html += `<div class="quest-title" style="font-weight:700;color:${statusColor};">` +
      (done ? '✔ ' : started ? '◆ ' : '! ') + def.name +
      ` <span class="quest-status" style="font-weight:400;font-size:12px;opacity:0.85;">(${statusWord})</span></div>`;
    if (started) {
      const st = def.stages[Math.min(p.stage, def.stages.length - 1)];
      // A live progress hint (e.g. "Slay goblins (2 / 3)") wins over the static
      // objective hint when the stage provides one — so counters tick in the log.
      const hint = (typeof st.progressHint === 'function') ? st.progressHint(ctxFor(id)) : st.objective.hint;
      html += `<div class="quest-journal" style="color:#e7dcc0;margin-top:3px;">${st.journal}</div>`;
      html += `<div class="quest-hint" style="color:#b9892f;font-style:italic;margin-top:3px;">› ${hint}</div>`;
      html += '<div class="quest-stages" style="margin-top:5px;font-size:12px;color:#9a8e72;">';
      def.stages.forEach((s, i) => {
        const mark = i < p.stage ? '☑' : (i === p.stage ? '☐' : '·');
        html += `<div>${mark} ${s.name}</div>`;
      });
      html += '</div>';
    } else if (done) {
      html += `<div class="quest-journal" style="color:#9a8e72;margin-top:3px;">Reward claimed: ${def.reward ? def.reward.text : '—'}.</div>`;
    } else {
      // Available but not yet started — tease the quest and where to begin it.
      html += `<div class="quest-journal" style="color:#cfe2ff;margin-top:3px;">${def.intro || 'A new quest awaits.'}</div>`;
    }
    html += '</div>';
    return html;
  }

  // City-grouped journal. Every defined quest is shown under its city heading,
  // so a future city's quests slot in automatically (just give them a `city`).
  function renderLog() {
    if (!logBodyEl) return;
    // Group quest ids by city, preserving definition order within each city.
    const byCity = new Map();
    for (const id of Object.keys(QUEST_DEFS)) {
      const city = cityOf(QUEST_DEFS[id]);
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push(id);
    }
    let html = '';
    let anyShown = false;
    for (const [city, ids] of byCity) {
      const entries = ids.map(questEntryHtml).join('');
      if (!entries) continue;
      anyShown = true;
      html += `<div class="quest-city" data-city="${city}" style="margin-bottom:16px;">`;
      html += `<div class="quest-city-head" style="color:#d9b85a;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;border-bottom:1px solid #5a4a28;padding-bottom:3px;margin-bottom:8px;">⚑ ${city}</div>`;
      html += entries;
      html += '</div>';
    }
    logBodyEl.innerHTML = anyShown ? html : '<div style="color:#9a8e72;font-style:italic;">No quests yet. Seek out King Aldric in the great hall.</div>';
  }

  // ---- Persistence (plugs into save.js) ----
  function serialize() {
    const o = {};
    for (const id of Object.keys(progress)) {
      const p = progress[id];
      if (p.status !== STATUS.NOT_STARTED) o[id] = { status: p.status, stage: p.stage, flags: p.flags };
    }
    return o;
  }
  function load(saved) {
    if (!saved) return;
    for (const id of Object.keys(QUEST_DEFS)) {
      const s = saved[id];
      if (s) {
        progress[id].status = s.status || STATUS.NOT_STARTED;
        progress[id].stage = typeof s.stage === 'number' ? s.stage : 0;
        progress[id].flags = s.flags || {};
      }
    }
    renderLog();
    if (onChange) onChange();
  }

  ensureLog();
  renderLog();

  // Expose the live ctx for a quest (read-only use: deliver beats check items).
  function ctx(id) { return ctxFor(id); }

  return {
    QUEST_DEFS, STATUS,
    start, complete, tryAdvance, setFlag, poll, onMonsterKill,
    status, stage, isComplete, isActive, readyToComplete,
    canStart, anyAvailable, markerFor, questIdForGiver,
    toggleLog, renderLog, serialize, load, setChangeHandler,
    progress, ctx,
  };
}
