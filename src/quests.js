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

  // -------------------------------------------------------------------------
  // QUEST 5 — "Sparks of the Arcane" (MAGIC TUTOR). Lady Maelis, the King's
  // advisor, reads more than maps — she keeps the old arcane lore of the court,
  // and frets that no living soul in Eldenmoor can so much as light a candle with
  // a word. She takes the player on as a pupil: first, prove you can channel a
  // spell by casting until the Magic skill stirs (we snapshot your Magic XP when
  // you accept and watch it climb — no hook into magic.js needed); then bring her
  // a handful of mind runes to stock her teaching-coffer. A skill-tutor quest that
  // sends the player to the spellbook, rewarding runes, a Magic XP lamp, and coin.
  // -------------------------------------------------------------------------
  maelis: {
    id: 'maelis',
    name: 'Sparks of the Arcane',
    giver: 'advisor',
    city: 'Eldenmoor',
    intro: 'Lady Maelis keeps the court\'s old arcane lore, and frets that magic is fading from Eldenmoor. She\'d take a willing pupil — if one can be found with a spark in them.',
    startConfirm: {
      prompt: 'So — shall I take you on as a pupil of the arcane?',
      yes: 'Teach me, my lady. I\'ll learn the spellbook.',
      no: 'Sorcery can wait. I\'ve other roads.',
      more: 'How does one cast a spell?',
      moreDialogue: [
        { speaker: 'Lady Maelis', text: 'Open your spellbook — there, on the left of your sight. Arm a spell with a touch, and it glows; then loose it upon a foe with a strike, as you would a blade.' },
        { speaker: 'Lady Maelis', text: 'Each spell drinks runes — Wind Strike needs but an air rune and a mind rune, and is the place to begin. The magic stall on the square will sell you a pouch of both. Cast, and feel the skill wake in you.' },
      ],
      noReply: 'A pity. Steel rusts, my dear — but a spell, once learned, is yours till your last breath. Return when you\'ve a mind to kindle one.',
      yesReply: [
        { speaker: 'Lady Maelis', text: 'Then we begin where every mage begins: by DOING. Arm a strike spell, find yourself a rat or a goblin, and loose it. Cast until I can feel the Art stir in you — it won\'t take long if you\'ve the spark.' },
        { speaker: 'Lady Maelis', text: 'Mind your runes, and don\'t singe the King\'s tapestries. Off you go, apprentice.' },
      ],
      // Snapshot the pupil's Magic XP at the moment they enrol, so "cast spells
      // until the skill stirs" can be checked purely by watching the XP climb —
      // no hook into magic.js required.
      onAccept: (ctx) => { ctx.flags.magicXpBase = (ctx.skills.state.magic && ctx.skills.state.magic.xp) || 0; },
    },
    startDialogue: [
      { speaker: 'Lady Maelis', text: 'A moment, adventurer. Of all who tramp through this hall, you alone paused at my maps — and I have learned to trust a curious eye.' },
      { speaker: 'Lady Maelis', text: 'I keep more than charts up here. I keep what little arcane lore the court remembers — and it grows littler each year. No one in Eldenmoor can light so much as a candle with a word any more. It shames us.' },
      { speaker: 'Lady Maelis', text: 'You have a spark about you. I would teach you the spellbook — to channel the elements as the old mages did. Will you be my pupil?' },
    ],
    stages: [
      {
        name: 'Channel the spellbook',
        journal: 'Lady Maelis has taken you on as a pupil of the arcane. Buy runes at the magic stall, arm a strike spell in your spellbook (left of your sight), and cast it on monsters until the Magic skill stirs in you. Gain roughly 50 Magic XP.',
        objective: {
          hint: 'Cast spells on monsters until you gain ~50 Magic XP.',
          check: (ctx) => {
            const xp = (ctx.skills.state.magic && ctx.skills.state.magic.xp) || 0;
            const base = ctx.flags.magicXpBase || 0;
            return (xp - base) >= 50;
          },
        },
        progressHint: (ctx) => {
          const xp = (ctx.skills.state.magic && ctx.skills.state.magic.xp) || 0;
          const base = ctx.flags.magicXpBase || 0;
          return 'Magic XP channelled (' + Math.min(Math.floor(xp - base), 50) + ' / 50).';
        },
        nudge: [
          { speaker: 'Lady Maelis', text: 'I do not yet feel the Art moving in you, apprentice. Arm a strike spell and LOOSE it — on a rat, a goblin, anything that won\'t mind. The skill wakes only with the casting.' },
        ],
      },
      {
        name: 'Stock the teaching-coffer',
        journal: 'The Art has woken in you — Lady Maelis felt it stir. Now she asks you to restock her teaching-coffer: bring her 8 mind runes, the rune every novice mage burns through first. The magic stall on the square sells them.',
        objective: {
          hint: 'Bring Lady Maelis 8 mind runes.',
          check: (ctx) => ctx.inventory.count('mind_rune') >= 8,
        },
        progressHint: (ctx) => 'Mind runes (' + Math.min(ctx.inventory.count('mind_rune'), 8) + ' / 8).',
        nudge: [
          { speaker: 'Lady Maelis', text: 'The spark is lit — well done! But my coffer wants for mind runes still. Eight of them, apprentice, to teach the next who comes. The magic stall keeps them cheap.' },
        ],
      },
      {
        name: 'Return to Lady Maelis',
        journal: 'You have the mind runes and the spark to match. Return to Lady Maelis on the royal floor to complete your first lesson — and claim a mage\'s due.',
        objective: { hint: 'Return to Lady Maelis on the royal floor.', check: () => false },
        nudge: [
          { speaker: 'Lady Maelis', text: 'You have the runes and the spark both. Step up to my table and we\'ll close the lesson properly.' },
        ],
      },
    ],
    // Takes the mind runes for her coffer, then pays a fledgling mage's due: a
    // pouch of starter runes to keep casting, a slug of Magic XP (the "lamp"),
    // and coin. Mind runes are spent into her teaching-coffer.
    reward: {
      text: '200 coins, a pouch of runes (30 air, 15 mind, 10 chaos), and 250 Magic XP',
      grant: (ctx) => {
        ctx.inventory.removeN('mind_rune', 8); // into the teaching-coffer
        ctx.inventory.add('coins', 200);
        ctx.inventory.add('air_rune', 30);
        ctx.inventory.add('mind_rune', 15);
        ctx.inventory.add('chaos_rune', 10);
        ctx.skills.addXp('magic', 250); // a Magic XP "lamp" for the lesson learned
      },
    },
    completeDialogue: [
      { speaker: 'Lady Maelis', text: 'There — feel that? The runes in your hand, the spark behind your eyes. A week ago you could not have lit a candle. Now you loose Wind Strike like you were born to it.' },
      { speaker: 'Lady Maelis', text: 'My coffer is stocked, and my heart is lighter than it\'s been in years. The Art does not die in Eldenmoor today — not while there\'s a pupil with your spark.' },
      { speaker: 'Lady Maelis', text: 'Take these — a pouch of runes to keep your hand in, and coin besides. And here, the last of a lesson I cannot bottle: hold what I taught you close. Magic favours the diligent.' },
      { speaker: 'Lady Maelis', text: 'Go and practise, apprentice. There are spells in the higher pages that would make the King\'s guards weep with envy — and one day, perhaps, you\'ll teach them to the next curious eye that lingers at my maps.' },
    ],
    doneDialogue: [
      { speaker: 'Lady Maelis', text: 'My finest pupil. The coffer\'s full, the Art lives on, and you\'ve a spellbook of your own now. Keep casting — a mage who rests goes rusty as any blade.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 6 — "The Quiet Pilgrimage" (PRAYER). Sister Adela of the chapel sends
  // the player on a small rite: gather and bury the bones of the fallen so their
  // spirits rest, then kneel at the chapel altar to receive the Light's blessing.
  // Burying is verified by watching Prayer XP climb from a snapshot taken at the
  // start (no hook into prayer.js); the altar-visit is folded into that same XP
  // climb (the altar grants no XP, so the bones must do the work — and the journal
  // points the pilgrim there to recharge for the kneeling). Rewards Prayer XP,
  // bones to keep the rite going, and a blessing-token.
  // -------------------------------------------------------------------------
  adela: {
    id: 'adela',
    name: 'The Quiet Pilgrimage',
    giver: 'nun',
    city: 'Eldenmoor',
    intro: 'Sister Adela tends the chapel and grieves for the unburied dead beyond the walls. She seeks a gentle soul to lay their bones to rest and walk a small pilgrimage of the Light.',
    startConfirm: {
      prompt: 'Will you walk this quiet pilgrimage for the Light, and for the fallen?',
      yes: 'I will, Sister. I\'ll lay them to rest.',
      no: 'My road runs elsewhere for now.',
      more: 'How does one bury bones?',
      moreDialogue: [
        { speaker: 'Sister Adela', text: 'When a beast or brigand falls, it leaves its bones behind. Take them up, and from your pack choose to bury them — a moment\'s kindness that frees the spirit and lifts your own Prayer besides.' },
        { speaker: 'Sister Adela', text: 'Rats and goblins beyond the gate leave bones aplenty. Bury them as you go, and when your Prayer feels spent, kneel at our altar by the chapel door to be made whole again. That is the whole of the rite.' },
      ],
      noReply: 'Go gently all the same, child. The fallen will wait — they are patient, the dead. Return when your heart is quiet enough for the work.',
      yesReply: [
        { speaker: 'Sister Adela', text: 'Bless you. Then go out beyond the gate, and where the fallen leave their bones, bury them with a kind word. Do it until the Light grows bright in you — your Prayer will tell you when.' },
        { speaker: 'Sister Adela', text: 'And when you are weary of spirit, kneel at our altar to be restored. Walk softly, pilgrim. The Light goes with you.' },
      ],
      // Snapshot Prayer XP at enrolment, so "bury the fallen" can be measured by
      // the Prayer XP that burying grants — no hook into prayer.js required.
      onAccept: (ctx) => { ctx.flags.prayerXpBase = (ctx.skills.state.prayer && ctx.skills.state.prayer.xp) || 0; },
    },
    startDialogue: [
      { speaker: 'Sister Adela', text: 'Peace be with you, traveller. You\'ve the muddy boots of one who walks beyond the walls — and so you\'ll have seen what grieves me most.' },
      { speaker: 'Sister Adela', text: 'The fallen out there — rats, brigands, goblins, it matters not — lie unburied, their bones bleaching in the cold. No spirit rests easy so. The Light asks that we tend even the least of the dead.' },
      { speaker: 'Sister Adela', text: 'These chapel knees are too old for the long walk now. Would you go in my stead — gather the bones of the fallen, bury them kindly, and walk the altar-rite of the Light? It is a quiet pilgrimage, but a holy one.' },
    ],
    stages: [
      {
        name: 'Lay the fallen to rest',
        journal: 'Sister Adela asks you to bury the bones of the fallen. Hunt beasts beyond the gate, take up the bones they leave, and bury them from your pack until the Light grows bright in you — gain roughly 30 Prayer XP. When weary of spirit, kneel at the chapel altar to be restored.',
        objective: {
          hint: 'Bury bones until you gain ~30 Prayer XP.',
          check: (ctx) => {
            const xp = (ctx.skills.state.prayer && ctx.skills.state.prayer.xp) || 0;
            const base = ctx.flags.prayerXpBase || 0;
            return (xp - base) >= 30;
          },
        },
        progressHint: (ctx) => {
          const xp = (ctx.skills.state.prayer && ctx.skills.state.prayer.xp) || 0;
          const base = ctx.flags.prayerXpBase || 0;
          return 'Prayer earned by burial (' + Math.min(Math.floor(xp - base), 30) + ' / 30).';
        },
        nudge: [
          { speaker: 'Sister Adela', text: 'The fallen still lie unburied, child — I feel it. Take up their bones and bury them, one kind act at a time. The Light grows in you with each. And rest at the altar when your spirit tires.' },
        ],
      },
      {
        name: 'Bring an offering of bones',
        journal: 'The fallen are tended, and the Light burns bright in you. Now Sister Adela asks for a small offering for the chapel reliquary: bring her 5 bones, blessed by your own hand, to keep the rite alive for pilgrims to come.',
        objective: {
          hint: 'Bring Sister Adela 5 bones for the reliquary.',
          check: (ctx) => ctx.inventory.count('bones') >= 5,
        },
        progressHint: (ctx) => 'Bones for the reliquary (' + Math.min(ctx.inventory.count('bones'), 5) + ' / 5).',
        nudge: [
          { speaker: 'Sister Adela', text: 'You\'ve done the kind work — I feel the peace of it. But the reliquary wants its offering still: five bones, blessed by your hand. Then the pilgrimage is whole.' },
        ],
      },
      {
        name: 'Return to Sister Adela',
        journal: 'You carry the offering and the Light\'s peace both. Return to Sister Adela at the chapel to close the pilgrimage and receive her blessing.',
        objective: { hint: 'Return to Sister Adela at the chapel.', check: () => false },
        nudge: [
          { speaker: 'Sister Adela', text: 'You have the offering and the peace of the work upon you. Kneel a moment, and let me give you the Light\'s thanks properly.' },
        ],
      },
    ],
    // Takes the offering of bones for the reliquary, then gives a pilgrim's due:
    // a generous slug of Prayer XP for the rite walked, a fresh supply of big
    // bones to keep training Prayer, coins, and a blessing-token (clay pot of
    // holy water, represented by a clay pot — the only blessing-vessel that exists).
    reward: {
      text: '180 coins, 3 Big bones, a blessed Clay pot, and 200 Prayer XP',
      grant: (ctx) => {
        ctx.inventory.removeN('bones', 5); // laid in the reliquary
        ctx.inventory.add('coins', 180);
        ctx.inventory.add('big_bones', 3); // to keep the rite — and your Prayer — going
        ctx.inventory.add('clay_pot', 1); // a vessel for holy water — her blessing-token
        ctx.skills.addXp('prayer', 200);
      },
    },
    completeDialogue: [
      { speaker: 'Sister Adela', text: 'You return, and the Light returns with you — I can see it on you, soft as candleglow. The fallen rest easy tonight, every one, because a stranger thought them worth a kind word.' },
      { speaker: 'Sister Adela', text: 'Your offering goes in the reliquary, where pilgrims will honour it for years. And the peace of the work — that stays in you, where no thief can reach it.' },
      { speaker: 'Sister Adela', text: 'Take these with my blessing: coin for your road, a few good bones to keep the rite alive in you, and a vessel of holy water against the dark places. You will find dark places, pilgrim. We all do.' },
      { speaker: 'Sister Adela', text: 'Go gently, return safely, and be kinder than you must. The Light asks little else of those it loves. ...And do wipe your boots before the altar next time.' },
    ],
    doneDialogue: [
      { speaker: 'Sister Adela', text: 'Peace be with you, pilgrim. The fallen rest, the reliquary is full, and the Light is the brighter for your hands. Kneel at the altar whenever your spirit tires — its door is always open to you.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 7 — "Hilda's Hot Commission" (MINE / SMELT / SMITH). Hilda the axe-smith
  // has a rush order she can't meet: she's out of bronze and her old back won't
  // bear the mine. She sends the player the full smith's loop — mine copper and tin
  // ore, smelt them to bronze bars at the furnace, hammer a bronze dagger on the
  // anvil, and bring it back. Every beat is verified by checking the bag when the
  // pupil talks to Hilda (low coupling — no hook into mining/smithing). Rewards a
  // steel pickaxe to mine on with, a smithing hammer, coin, and Smithing XP.
  // -------------------------------------------------------------------------
  hilda: {
    id: 'hilda',
    name: 'Hilda\'s Hot Commission',
    giver: 'hilda',
    city: 'Eldenmoor',
    intro: 'Hilda the axe-smith has a commission she can\'t fill — out of bronze and short of back. She needs a willing pair of hands to mine, smelt, and forge in her stead.',
    startConfirm: {
      prompt: 'So — will you work the whole loop for me? Mine, smelt, and forge?',
      yes: 'Aye, Hilda. Ore to bar to blade — I\'ll do the lot.',
      no: 'That\'s a deal of hammering. Another day.',
      more: 'Walk me through the work.',
      moreDialogue: [
        { speaker: 'Hilda', text: 'Three steps, love, same as any smith learns. First the MINE: take a pickaxe to the copper and tin rocks and dig out the ore. You\'ll want enough for a couple of bars.' },
        { speaker: 'Hilda', text: 'Then the FURNACE: smelt copper and tin together — that\'s bronze. Two bronze bars is what I need. Last, the ANVIL: with a hammer, hammer a bar into a bronze dagger. Bring me that dagger and we\'re square.' },
        { speaker: 'Hilda', text: 'Furnace and anvil are both by Garrett\'s forge. Borrow a pickaxe and a hammer if you\'ve none — Bramble or the general lot keep them. Simple as that, once your arms learn the rhythm.' },
      ],
      noReply: 'Ha! Fair enough — it\'s honest sweat, smithing, and not for everyone. The commission\'ll keep a while. Come back when your arms are up for it.',
      yesReply: [
        { speaker: 'Hilda', text: 'That\'s the spirit, love! Right — first things first: get yourself to the rocks and mine copper and tin ore. Enough for two bronze bars, so a few lumps of each.' },
        { speaker: 'Hilda', text: 'Don\'t come back till you\'ve dirt under your nails. Off you pop — the forge waits for no one and neither does my customer.' },
      ],
    },
    startDialogue: [
      { speaker: 'Hilda', text: 'Just the arms I wanted! Come here, love — I\'m in a fix and you\'ve the look of someone who can swing a tool without losing a finger.' },
      { speaker: 'Hilda', text: 'Got a rush commission — a blade, due yesterday — and I\'m clean out of bronze, my ore-pile\'s bare, and my back won\'t bear the mine any more. A smith with no metal\'s just a loud woman with a hammer.' },
      { speaker: 'Hilda', text: 'I can\'t leave the shop, but you can work the whole loop for me: mine the ore, smelt the bars, forge the blade. Do it and I\'ll set you up proper — good steel and good coin. What d\'you say?' },
    ],
    stages: [
      {
        name: 'Mine copper and tin ore',
        journal: 'Hilda needs bronze. Equip a pickaxe and mine the copper and tin rocks until you carry 2 copper ore and 2 tin ore — enough for two bronze bars.',
        objective: {
          hint: 'Mine 2 copper ore and 2 tin ore.',
          check: (ctx) => ctx.inventory.count('copper_ore') >= 2 && ctx.inventory.count('tin_ore') >= 2,
        },
        progressHint: (ctx) => 'Copper ore (' + Math.min(ctx.inventory.count('copper_ore'), 2) + ' / 2) and Tin ore (' + Math.min(ctx.inventory.count('tin_ore'), 2) + ' / 2).',
        nudge: [
          { speaker: 'Hilda', text: 'No ore yet, love? The copper and tin rocks won\'t mine themselves. Equip a pickaxe and dig — two of each, that\'s the order.' },
        ],
      },
      {
        name: 'Smelt the bronze bars',
        journal: 'You have the ore. Take it to the furnace by Garrett\'s forge and smelt copper and tin together into bronze. Carry 2 bronze bars when you\'re done.',
        objective: {
          hint: 'Smelt 2 bronze bars at the furnace.',
          check: (ctx) => ctx.inventory.count('bronze_bar') >= 2,
        },
        progressHint: (ctx) => 'Bronze bars (' + Math.min(ctx.inventory.count('bronze_bar'), 2) + ' / 2).',
        nudge: [
          { speaker: 'Hilda', text: 'Ore\'s no good to me raw, love. Off to the furnace — copper AND tin together makes bronze. Two bars. You\'re halfway there.' },
        ],
      },
      {
        name: 'Forge a bronze dagger',
        journal: 'The bars are cast. Now to the anvil by the forge: with a hammer in your pack, hammer a bronze bar into a bronze dagger — the blade Hilda\'s commission calls for. Carry the finished dagger back to her.',
        objective: {
          hint: 'Forge a bronze dagger at the anvil, then bring it to Hilda.',
          check: (ctx) => ctx.inventory.count('bronze_dagger') >= 1,
        },
        progressHint: (ctx) => 'Bronze dagger forged (' + Math.min(ctx.inventory.count('bronze_dagger'), 1) + ' / 1).',
        nudge: [
          { speaker: 'Hilda', text: 'Bars in hand and no blade yet? To the anvil with you — hammer a bar into a bronze dagger. That\'s the piece my customer\'s after.' },
        ],
      },
      {
        name: 'Bring the dagger to Hilda',
        journal: 'The bronze dagger is forged and gleaming. Carry it back to Hilda at her axe shop to fill the commission and claim your reward.',
        objective: { hint: 'Bring the finished bronze dagger to Hilda.', check: () => false },
        nudge: [
          { speaker: 'Hilda', text: 'Is that a finished dagger I spy? Bring it here to the counter, love, and let\'s call this commission done.' },
        ],
      },
    ],
    // Takes the commissioned dagger, then sets the new smith up for the trade: a
    // steel pickaxe to mine faster, a hammer for the anvil, coin, and a generous
    // slug of Smithing XP for the whole loop walked.
    reward: {
      text: 'a Steel pickaxe, a Hammer, 260 coins, and 200 Smithing XP',
      grant: (ctx) => {
        ctx.inventory.removeN('bronze_dagger', 1); // delivered to fill the commission
        ctx.inventory.add('steel_pickaxe', 1);
        ctx.inventory.add('hammer', 1);
        ctx.inventory.add('coins', 260);
        ctx.skills.addXp('smithing', 200);
      },
    },
    completeDialogue: [
      { speaker: 'Hilda', text: 'Now THAT\'S a bronze dagger — clean edge, true point, and you forged it with your own two hands. My customer\'ll never know it wasn\'t me. (Don\'t tell \'em, eh?)' },
      { speaker: 'Hilda', text: 'You walked the whole loop, love — pit to furnace to anvil — and came out a smith. Took me a YEAR to learn what you did in an afternoon. These arms remember.' },
      { speaker: 'Hilda', text: 'So here\'s your due, and no haggling: a steel pickaxe to dig faster than that borrowed thing, a good hammer of your own, and coin besides. A smith should own her tools.' },
      { speaker: 'Hilda', text: 'Keep at it. Iron next, then steel, then who knows — mithril, if you\'ve the back for the deep rocks. Any time you\'ve metal to work, the forge by Garrett\'s is yours. Off you pop, smith.' },
    ],
    doneDialogue: [
      { speaker: 'Hilda', text: 'Commission filled and the customer happy — all your doing, love. You\'ve a smith\'s arms now and the tools to match. Bring me ore any time; I do love watching a pupil work.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 8 — "Loose and True" (RANGED TUTOR). Mara the market trader was a
  // huntress before she ever kept a stall — she still strings her own bows and
  // misses the greenwood. She takes the player on as a bow-pupil: first prove
  // you can shoot by loosing arrows at foes until the Ranged skill stirs (we
  // snapshot your Ranged XP on accept and watch it climb — the same low-coupling
  // trick the Magic and Prayer quests use, no hook into ranged.js needed); then
  // bring her a bundle of feathers for fletching, the way every fletcher pays
  // their teacher. Rewards a better bow, a quiver of arrows, Ranged XP and coin.
  // -------------------------------------------------------------------------
  mara: {
    id: 'mara',
    name: 'Loose and True',
    giver: 'mara',
    city: 'Eldenmoor',
    intro: 'Mara kept a hunter\'s eye long before she kept a market stall. She still strings her own bows, and she\'d gladly teach a steady hand to shoot.',
    startConfirm: {
      prompt: 'So — shall I make a bow-shot of you, here and now?',
      yes: 'Teach me the bow, Mara. I\'ll learn to loose.',
      no: 'The bow can wait. I\'ve other roads.',
      more: 'How does one shoot a bow?',
      moreDialogue: [
        { speaker: 'Mara', text: 'Simple as breathing, once your arm learns it. Equip a shortbow, fill your quiver with arrows — bronze\'ll do to start — and click a foe. The arrow flies, and the Ranged skill wakes in you.' },
        { speaker: 'Mara', text: 'I keep bows and arrows right here on the stall if you\'ve none. Loose at rats, goblins, anything that won\'t mind a feather in its hide. Shoot enough and you\'ll feel it — the eye sharpens, the hand steadies.' },
      ],
      noReply: 'Suit yourself. But a sword\'s no use to a foe across a river, love — and the greenwood\'s full of those. Come back when you fancy learning the bow.',
      yesReply: [
        { speaker: 'Mara', text: 'That\'s the spirit! Right — string a shortbow, pouch some arrows, and go LOOSE them. At a rat, a goblin, whatever crosses you. Shoot until I can see the hunter waking in you — won\'t take long if your eye\'s any good.' },
        { speaker: 'Mara', text: 'And mind — an empty quiver shoots nothing. Keep arrows on you. Off you go, my little fletchling.' },
      ],
      // Snapshot Ranged XP at enrolment, so "loose arrows until the skill stirs"
      // is measured purely by the XP that shooting grants — no hook into ranged.js.
      onAccept: (ctx) => { ctx.flags.rangedXpBase = (ctx.skills.state.ranged && ctx.skills.state.ranged.xp) || 0; },
    },
    startDialogue: [
      { speaker: 'Mara', text: 'You\'ve the stance of someone who could shoot, you know. Stand square, weight even — aye, I watch how folk hold themselves. Force of old habit.' },
      { speaker: 'Mara', text: 'Before this stall, I hunted the greenwood north of here — twelve years, bow in hand, never went hungry. These days I sell turnips and miss the trees. There\'s a confession for you.' },
      { speaker: 'Mara', text: 'But a good eye shouldn\'t go to waste, and you\'ve got one. Let me teach you the bow — to loose an arrow loose and true. What do you say, hm?' },
    ],
    stages: [
      {
        name: 'Loose arrows until the eye sharpens',
        journal: 'Mara has taken you on as a bow-pupil. Equip a shortbow and arrows (she sells both at her stall), then click foes to loose arrows at them until the Ranged skill stirs in you. Gain roughly 40 Ranged XP.',
        objective: {
          hint: 'Shoot foes with a bow until you gain ~40 Ranged XP.',
          check: (ctx) => {
            const xp = (ctx.skills.state.ranged && ctx.skills.state.ranged.xp) || 0;
            const base = ctx.flags.rangedXpBase || 0;
            return (xp - base) >= 40;
          },
        },
        progressHint: (ctx) => {
          const xp = (ctx.skills.state.ranged && ctx.skills.state.ranged.xp) || 0;
          const base = ctx.flags.rangedXpBase || 0;
          return 'Ranged XP loosed (' + Math.min(Math.floor(xp - base), 40) + ' / 40).';
        },
        nudge: [
          { speaker: 'Mara', text: 'I don\'t see the hunter in you yet, fletchling. Equip a bow, keep arrows in your quiver, and LOOSE them at something. The eye only sharpens with the shooting — there\'s no shortcut to a true shot.' },
        ],
      },
      {
        name: 'Gather feathers for the fletching',
        journal: 'The hunter\'s eye has woken in you — Mara saw it. Now she asks a fletcher\'s tithe: bring her 15 feathers so she can fletch a fresh batch of arrows. Feathers come from foes and the wilds, and her stall keeps some too.',
        objective: {
          hint: 'Bring Mara 15 feathers for fletching.',
          check: (ctx) => ctx.inventory.count('feather') >= 15,
        },
        progressHint: (ctx) => 'Feathers (' + Math.min(ctx.inventory.count('feather'), 15) + ' / 15).',
        nudge: [
          { speaker: 'Mara', text: 'Shooting\'s coming along a treat — but my arrow-bench runs dry. Fifteen feathers, fletchling, that\'s the tithe every bow-pupil owes their teacher. Off you go and gather them.' },
        ],
      },
      {
        name: 'Return to Mara',
        journal: 'You have the feathers and a hunter\'s eye to match. Return to Mara at her market stall to finish your bow-lesson and claim a marksman\'s due.',
        objective: { hint: 'Return to Mara at the market stall.', check: () => false },
        nudge: [
          { speaker: 'Mara', text: 'Feathers in hand and a true eye besides — come to the stall, love, and let\'s call the lesson learned.' },
        ],
      },
    ],
    // Takes the feathers for her fletching-bench, then sets the new archer up: an
    // oak shortbow to grow into, a healthy quiver of iron arrows, Ranged XP for
    // the shooting, and coin.
    reward: {
      text: 'an Oak shortbow, 60 iron arrows, 220 Ranged XP, and 180 coins',
      grant: (ctx) => {
        ctx.inventory.removeN('feather', 15); // onto the fletching-bench
        ctx.inventory.add('oak_shortbow', 1);
        ctx.inventory.add('iron_arrow', 60);
        ctx.inventory.add('coins', 180);
        ctx.skills.addXp('ranged', 220);
      },
    },
    completeDialogue: [
      { speaker: 'Mara', text: 'There it is — the hunter\'s eye, plain as day. A week ago you\'d have missed a barn from inside it. Now you loose loose and TRUE. I\'ve a knack for spotting it, and you\'ve got it.' },
      { speaker: 'Mara', text: 'Feathers go straight on my bench — fine ones, too. Bless you for the tithe; it\'s an old hunter\'s custom and you honoured it without a grumble.' },
      { speaker: 'Mara', text: 'So here\'s a marksman\'s due, and no haggling: an oak shortbow — a real step up from that stick you started on — a good quiver of iron arrows, and coin besides. Keep your string waxed and your quiver full.' },
      { speaker: 'Mara', text: 'Get yourself to the greenwood north some day, fletchling. That\'s where a bow truly sings. And if you ever want to learn the maple bow... well. You know which stall to find.' },
    ],
    doneDialogue: [
      { speaker: 'Mara', text: 'My finest bow-pupil. Quiver full, eye true, and the greenwood waiting. Bring me feathers any time — I\'ll always fletch for a hunter who shoots loose and true.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 9 — "The Hollow King" (BOSS-SLAYER EPIC). Duke Veylin, King Aldric's
  // Royal Steward, carries a grief the court does not speak of: the old king —
  // Aldric's own father — fell to a curse and rose again as the HOLLOW KING, a
  // gilded bone-tyrant who broods in the Crypt of the Hollow King far to the
  // north-west. Veylin, who served the father and now serves the son, can no
  // longer bear that his old liege wanders undead. He sends a champion to lay
  // the Hollow King to rest at last. Tracked through onMonsterKill('hollow_king').
  // Rewards a great coin purse, real combat XP, and a prestigious hollow unique.
  // -------------------------------------------------------------------------
  veylin: {
    id: 'veylin',
    name: 'The Hollow King',
    giver: 'duke',
    city: 'Eldenmoor',
    intro: 'Duke Veylin, the Royal Steward, carries a grief the court will not name — and a charge no ordinary soldier could bear. He seeks a champion equal to the Crypt of the Hollow King.',
    startConfirm: {
      prompt: 'So I ask you plainly, champion: will you go to the crypt, and lay the Hollow King to rest?',
      yes: 'I will go to the crypt. The Hollow King falls by my hand.',
      no: 'That is a tomb I am not yet ready to walk.',
      more: 'Who is the Hollow King?',
      moreDialogue: [
        { speaker: 'Duke Veylin', text: 'He was King Aldric\'s own father — our old liege, whom I served as a young man. A wise and warm king, until the curse took him. He did not die so much as... empty. The Light went out of him, and something cold filled the husk.' },
        { speaker: 'Duke Veylin', text: 'We bore his body to the crypt in the north-west with all honour. But he would not stay buried. He rose — gilded in his own bones, crowned still, and HOLLOW. He broods there yet, and the land near the crypt sickens for his presence.' },
        { speaker: 'Duke Veylin', text: 'Aldric does not know I send anyone. He could not give the order — to strike down his own father, even risen and ruined? No son could. So the charge falls to his steward, and through me, to you. Go armed and armoured, champion. The Hollow King does not fall to the timid.' },
      ],
      noReply: 'I understand. It is no shame to know your own measure — the crypt has unmade braver souls than either of us. But the Hollow King waits, and so, alas, do I. Return when your blade is ready for a king.',
      yesReply: [
        { speaker: 'Duke Veylin', text: 'Then you have a steward\'s gratitude, and you will have a king\'s, though Aldric must never learn the cost of it. Go to the Crypt of the Hollow King — far to the north-west, past the safe roads. You will know it by the silence.' },
        { speaker: 'Duke Veylin', text: 'Bring sword and shield, food and faith. Strike down the Hollow King — end what the curse began — and return to me. Carry steel, champion. And carry mercy, if you can spare it. He was a good king, once.' },
      ],
    },
    startDialogue: [
      { speaker: 'Duke Veylin', text: 'A moment of your time, and your discretion — I am the Royal Steward, and what I must speak of cannot be spoken near the throne. Walk with me a step. Good.' },
      { speaker: 'Duke Veylin', text: 'There is a grief in this court older than the cold hearth, older than any goblin in the hills. Far to the north-west lies a crypt, and in it sits a thing that wears a crown it has no right to wear. We call it the Hollow King.' },
      { speaker: 'Duke Veylin', text: 'I will not yet tell you whose bones those are — that is a weight you may not wish to carry. But I will tell you this: while he sits undead, this realm is not whole, and an old man\'s conscience finds no rest. I need a champion to end him. Could that champion be you?' },
    ],
    stages: [
      {
        name: 'Slay the Hollow King',
        journal: 'Duke Veylin charges you to lay the Hollow King to rest. Travel far to the north-west — past the safe roads — to the Crypt of the Hollow King. Go armed and armoured, with food and prayer, and strike down the gilded bone-king who broods within.',
        objective: {
          hint: 'Slay the Hollow King in his crypt to the north-west (0 / 1).',
          check: (ctx) => (ctx.flags.hollowKingKills || 0) >= 1,
        },
        progressHint: (ctx) => 'The Hollow King (' + Math.min(ctx.flags.hollowKingKills || 0, 1) + ' / 1) lies undefeated in his crypt to the north-west.',
        nudge: [
          { speaker: 'Duke Veylin', text: 'He still sits his cold throne — I would feel it, were he gone. The Crypt of the Hollow King lies far to the north-west, champion, past the safe roads. Go armed, go armoured, and do not turn back at the silence.' },
        ],
      },
      {
        name: 'Return to Duke Veylin',
        journal: 'The Hollow King is fallen — the crown toppled, the curse broken, the old liege at rest at last. Return to Duke Veylin in the great hall to bring him the word he has waited a lifetime to hear.',
        objective: { hint: 'Return to Duke Veylin in the great hall.', check: () => false },
        nudge: [
          { speaker: 'Duke Veylin', text: 'I can scarcely believe the air feels lighter — is it done? Come to me, champion, and tell me plainly. I have waited a long time for these words.' },
        ],
      },
    ],
    // A king-slayer's due: a great coin purse, deep combat XP across the melee
    // skills and Hitpoints for the fight of their life, and a prestigious hollow
    // unique — the Crown of the Hollow, borne home from the toppled throne.
    reward: {
      text: '2000 coins, deep combat XP (Attack/Strength/Defence/Hitpoints), and the Crown of the Hollow',
      grant: (ctx) => {
        ctx.inventory.add('coins', 2000);
        ctx.inventory.add('crown_of_the_hollow', 1); // borne home from the cold throne
        ctx.skills.addXp('attack', 1200);
        ctx.skills.addXp('strength', 1200);
        ctx.skills.addXp('defence', 1000);
        ctx.skills.addXp('hitpoints', 800);
      },
    },
    completeDialogue: [
      { speaker: 'Duke Veylin', text: 'It is done. I see it in your eyes before you speak — the weight of it, and the mercy. The Hollow King is fallen, the crown toppled from those gilded bones at last.' },
      { speaker: 'Duke Veylin', text: 'Then I may tell you now what I could not before: those bones were King Aldric\'s father — my old liege, and as good a king as ever warmed that cold throne. The curse stole his death from him, and you have given it back. He rests now. Truly rests.' },
      { speaker: 'Duke Veylin', text: 'Aldric will never know whose hand I stayed, nor whose I loosed. He will only know the land sleeps easier, and wonder why his steward weeps at the council table. Let him wonder. Some mercies are best carried quietly.' },
      { speaker: 'Duke Veylin', text: 'Take this — a king\'s purse, for it is a king you laid to rest. And the crown itself, borne home from that ruined throne: wear it not as a trophy, but as a remembrance. You ended an age tonight, champion. Few living can say the same.' },
    ],
    doneDialogue: [
      { speaker: 'Duke Veylin', text: 'The old king rests, the crypt is silent, and an old steward\'s conscience is clean at last — all by your hand. Carry that crown with honour, champion. It remembers a good king, as do I.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 10 — "Bram's Empty Pot" (FISHING / COOKING ERRAND). Bram, who keeps
  // The Prancing Stag, has a common-room full of thirsty patrons and an empty
  // stockpot — his fishmonger never came and his nets are bare. He sends the
  // player down to the water to catch and cook a mess of fish for the night's
  // stew. Verified by checking the bag when the pupil talks to Bram (low
  // coupling — no hook into fishing.js). Rewards coin, hearty cooked food to
  // carry off, and Fishing & Cooking XP for the work.
  // -------------------------------------------------------------------------
  bram: {
    id: 'bram',
    name: 'Bram\'s Empty Pot',
    giver: 'innkeep',
    city: 'Eldenmoor',
    intro: 'Bram of The Prancing Stag has a full common-room and an empty stockpot — his fish never came. He needs a quick hand at rod and fire to save the night\'s supper.',
    startConfirm: {
      prompt: 'So — will you fish me up a supper, and cook it proper while you\'re at it?',
      yes: 'Hand me a rod, Bram. I\'ll catch and cook your supper.',
      no: 'Find another fisher tonight, Bram.',
      more: 'What do you need, exactly?',
      moreDialogue: [
        { speaker: 'Bram', text: 'Fish, friend, and cooked — I\'ll not serve raw shrimp to a paying room. Get down to the water, catch yourself a mess of shrimp, then cook \'em on a fire or a range till they\'re done. Burnt ones I can\'t use, mind.' },
        { speaker: 'Bram', text: 'Five good cooked shrimp and I can stretch the stew to feed the lot. There\'s fishing spots by the water and a range right here in my kitchen — borrow it gladly. Easy work for a quick hand.' },
      ],
      noReply: 'Ah, no matter. I\'ll water down the ale and pray the fishmonger turns up. But if you change your mind, the rod\'s by the door and the room\'s still hungry.',
      yesReply: [
        { speaker: 'Bram', text: 'You\'re a lifesaver! Right — down to the water, catch your shrimp, and cook \'em through on a fire or my kitchen range. Five good cooked ones, no cinders. The stew\'ll do the rest.' },
        { speaker: 'Bram', text: 'Off you go — and don\'t dawdle, the patrons get surly on empty bellies. Bring \'em back warm and I\'ll see you right.' },
      ],
    },
    startDialogue: [
      { speaker: 'Bram', text: 'Welcome to The Prancing Stag — mind the spilt ale. Actually, friend, you\'ve walked in at just the wrong moment, or just the right one. Depends entirely on whether you can fish.' },
      { speaker: 'Bram', text: 'Common-room\'s packed, the ale\'s flowing, and my stockpot is BONE empty. My fishmonger never showed — nets torn, he says, the lazy article — and a stew with no fish is just hot water with opinions.' },
      { speaker: 'Bram', text: 'I can\'t leave the bar, but you look spry. Would you catch me a mess of shrimp and cook \'em up? Save my supper service and I\'ll fill your purse and your belly both.' },
    ],
    stages: [
      {
        name: 'Catch and cook the supper',
        journal: 'Bram\'s stockpot is empty. Head to a fishing spot by the water, catch raw shrimp, then cook them through on a fire or a cooking range (there\'s one in Bram\'s kitchen) until you carry 5 cooked shrimp. Burnt ones won\'t do.',
        objective: {
          hint: 'Catch and cook 5 shrimp for Bram\'s stew.',
          check: (ctx) => ctx.inventory.count('cooked_shrimp') >= 5,
        },
        progressHint: (ctx) => 'Cooked shrimp (' + Math.min(ctx.inventory.count('cooked_shrimp'), 5) + ' / 5).',
        nudge: [
          { speaker: 'Bram', text: 'Pot\'s still empty, friend, and the room\'s still hungry. Five cooked shrimp — catch \'em at the water, cook \'em on a fire or my range, and watch they don\'t burn. The stew won\'t make itself.' },
        ],
      },
      {
        name: 'Bring the catch to Bram',
        journal: 'You\'ve a fine mess of cooked shrimp. Carry them back to Bram behind the bar at The Prancing Stag so he can fill his stockpot and save the supper service.',
        objective: { hint: 'Bring the 5 cooked shrimp to Bram at the bar.', check: () => false },
        nudge: [
          { speaker: 'Bram', text: 'Is that cooked shrimp I smell? Bring \'em here to the bar, friend, and into the pot they go!' },
        ],
      },
    ],
    // Takes the cooked shrimp into the stew, then pays a grateful innkeeper's
    // due: coin, a hot trout-and-bread supper for the road, and Fishing & Cooking
    // XP for the work.
    reward: {
      text: '160 coins, 3 cooked Trout, a Loaf of bread, 120 Fishing XP, and 120 Cooking XP',
      grant: (ctx) => {
        ctx.inventory.removeN('cooked_shrimp', 5); // into the stockpot
        ctx.inventory.add('coins', 160);
        ctx.inventory.add('cooked_trout', 3); // a hot supper off the Stag's range
        ctx.inventory.add('bread', 1);
        ctx.skills.addXp('fishing', 120);
        ctx.skills.addXp('cooking', 120);
      },
    },
    completeDialogue: [
      { speaker: 'Bram', text: 'In they go — and would you LISTEN to that pot start to sing! Five fat cooked shrimp, not a cinder among \'em. The stew\'s saved, the room\'s fed, and Bram is a happy innkeeper once more.' },
      { speaker: 'Bram', text: 'You\'ve a real knack at the rod AND the fire, friend — half my regulars can do neither. The fishmonger could learn a thing from you, the torn-net layabout.' },
      { speaker: 'Bram', text: 'Here\'s your purse, earned twice over. And take a few trout off my range, fresh-cooked, and a loaf — nobody leaves the Stag hungry, least of all the soul that filled its pot. Mind the spilt ale on your way out, eh!' },
    ],
    doneDialogue: [
      { speaker: 'Bram', text: 'Pot\'s full, room\'s fed, and the ale\'s flowing again — all thanks to you. There\'s always a stool and a stew for you at the Stag, friend. Bring me fish any time the nets run dry.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 11 — "Blood and Bounty" (SLAYER INITIATION). A grizzled Royal Guard on
  // the keep watch has fought the same monsters for thirty years and learned to
  // read a hunter. He sends the player to earn their first Slayer bounty: take
  // tasks from a master and grind out raw Slayer experience until the skill stirs
  // (we snapshot the player's Slayer XP on accept and watch it climb — the same
  // low-coupling trick the Magic/Prayer/Ranged tutor quests use, no hook into
  // slayer.js needed), then prove the trophy by carrying back a clutch of bones
  // off the things they've culled. Rewards coins, a Slayer XP bounty, and an iron
  // scimitar to hunt on with.
  // -------------------------------------------------------------------------
  watchman: {
    id: 'watchman',
    name: 'Blood and Bounty',
    giver: 'guard_il',
    city: 'Eldenmoor',
    intro: 'A grizzled Royal Guard on the keep watch has buried more monsters than he can count. He measures every passing adventurer for the work — and reckons you might have the stomach for a Slayer\'s bounty.',
    startConfirm: {
      prompt: 'So — will you cut your teeth as a Slayer, and earn your first bounty?',
      yes: 'Aye. Point me at a task and I\'ll start culling.',
      no: 'I\'ve no taste for the hunt today.',
      more: 'What is a Slayer, exactly?',
      moreDialogue: [
        { speaker: 'Royal Guard', text: 'A Slayer takes a contract — kill so many of such-and-such a beast, no swapping, no whining. There\'s a task master keeps the bounties; open your Slayer panel and take one off him. Every kill on contract sharpens the skill.' },
        { speaker: 'Royal Guard', text: 'Grind a few tasks and you\'ll feel it harden in you — the Slayer\'s eye, the knowing of where a thing\'s weak. Earn me about sixty Slayer experience and I\'ll call you blooded. Bring back five bones off the cull, too, for the bounty-ledger.' },
      ],
      noReply: 'Hah. No shame in it — the hunt\'s not for soft hands. But the beasts breed faster than the watch can swing, so come back when your blood\'s up.',
      yesReply: [
        { speaker: 'Royal Guard', text: 'Good. Then go take a task off the Slayer master — your panel\'ll show him — and start culling. Rats, goblins, skeletons, whatever he hands you. The contract\'s what counts.' },
        { speaker: 'Royal Guard', text: 'Earn yourself about sixty Slayer experience on the bounties, and keep five bones off the kills for the ledger. Off you go, recruit. Mind their teeth.' },
      ],
      // Snapshot Slayer XP at enrolment, so "earn ~60 Slayer XP on tasks" is
      // measured purely by the XP that slaying grants — no hook into slayer.js.
      onAccept: (ctx) => { ctx.flags.slayerXpBase = (ctx.skills.state.slayer && ctx.skills.state.slayer.xp) || 0; },
    },
    startDialogue: [
      { speaker: 'Royal Guard', text: 'Hold there, recruit. Thirty years I\'ve watched this keep, and I\'ve buried more monsters than you\'ve had hot suppers. I know a hunter\'s walk when I see one — and you\'ve got it, half-formed.' },
      { speaker: 'Royal Guard', text: 'The watch can\'t be everywhere. The hills crawl, the crypts stir, and good steel\'s wasted standing at a gate. What this realm wants is Slayers — folk who take a bounty and see it through.' },
      { speaker: 'Royal Guard', text: 'There\'s a task master keeps the contracts. Take one, cull what he names, and earn your first bounty. Do that, and I\'ll vouch you blooded. What say you — ready to hunt?' },
    ],
    stages: [
      {
        name: 'Earn your first bounty',
        journal: 'The old watchman set you on the Slayer\'s path. Open your Slayer panel, take a task from the master, and cull the monsters he names until the skill hardens in you — earn roughly 60 Slayer XP on contract.',
        objective: {
          hint: 'Take Slayer tasks and slay on contract until you gain ~60 Slayer XP.',
          check: (ctx) => {
            const xp = (ctx.skills.state.slayer && ctx.skills.state.slayer.xp) || 0;
            const base = ctx.flags.slayerXpBase || 0;
            return (xp - base) >= 60;
          },
        },
        progressHint: (ctx) => {
          const xp = (ctx.skills.state.slayer && ctx.skills.state.slayer.xp) || 0;
          const base = ctx.flags.slayerXpBase || 0;
          return 'Slayer XP earned on contract (' + Math.min(Math.floor(xp - base), 60) + ' / 60).';
        },
        nudge: [
          { speaker: 'Royal Guard', text: 'Not blooded yet, recruit — I\'d feel it. Take a task off the Slayer master and CULL. Sixty Slayer experience on contract, that\'s the mark. The bounties won\'t fill themselves.' },
        ],
      },
      {
        name: 'Bring trophies for the ledger',
        journal: 'The Slayer\'s eye has hardened in you. The old watchman wants proof of the cull for the bounty-ledger: bring him 5 bones off the things you slew.',
        objective: {
          hint: 'Bring the watchman 5 bones from your kills.',
          check: (ctx) => ctx.inventory.count('bones') >= 5,
        },
        progressHint: (ctx) => 'Bones for the ledger (' + Math.min(ctx.inventory.count('bones'), 5) + ' / 5).',
        nudge: [
          { speaker: 'Royal Guard', text: 'You\'ve the blooding — I can see it on you. But the ledger wants its proof: five bones off the cull. No bones, no bounty, recruit. Those are the rules, and I didn\'t write \'em.' },
        ],
      },
      {
        name: 'Claim your bounty',
        journal: 'You carry the trophies and the Slayer\'s eye both. Return to the old Royal Guard on the keep watch to be vouched blooded — and claim your first bounty.',
        objective: { hint: 'Return to the Royal Guard on the keep watch.', check: () => false },
        nudge: [
          { speaker: 'Royal Guard', text: 'Bones in hand and the hunt in your blood — step up, recruit, and let me sign you blooded proper.' },
        ],
      },
    ],
    // Takes the trophy bones for the ledger, then pays a blooded Slayer's first
    // bounty: coin, a slug of Slayer XP for the contracts walked, and an iron
    // scimitar to hunt on with.
    reward: {
      text: '300 coins, an Iron scimitar, and 220 Slayer XP',
      grant: (ctx) => {
        ctx.inventory.removeN('bones', 5); // logged in the bounty-ledger
        ctx.inventory.add('coins', 300);
        ctx.inventory.add('iron_scimitar', 1);
        ctx.skills.addXp('slayer', 220);
      },
    },
    completeDialogue: [
      { speaker: 'Royal Guard', text: 'Five bones, and the Slayer\'s eye behind \'em — aye. That\'s a hunter, recruit. A week ago you\'d have flinched at a giant rat. Now you take a contract and see it through.' },
      { speaker: 'Royal Guard', text: 'I\'ll sign you blooded in the ledger, and that signature\'s worth more than coin in the right company. Speaking of coin — here\'s your bounty, earned to the copper.' },
      { speaker: 'Royal Guard', text: 'And take this iron scimitar off the rack — a proper hunting blade, not that twig you came in with. Keep taking tasks off the master; the deeper bounties pay deeper, and Eldenmoor\'s never short of things wants culling.' },
      { speaker: 'Royal Guard', text: 'Off you go, Slayer. Mind their teeth — every one of \'em. The day you forget is the day they bury YOU. Watch taught me that. Don\'t make it teach you.' },
    ],
    doneDialogue: [
      { speaker: 'Royal Guard', text: 'Blooded and bountied, and the ledger\'s richer for it. Keep at the contracts, Slayer — the hunt\'s a long road and the watch is always grateful. Mind their teeth.' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 12 — "Light Fingers" (THIEVING CAPER). Grix the dungeon keeper turned
  // a sticky-fingered eye long before he turned a key, and he misses the old
  // trade something fierce. He sets the player a roguish caper: pickpocket your
  // way to a tidy purse (we snapshot the player's coin on accept and watch it
  // climb — low coupling, no hook into thieving.js needed), then lift a proper
  // prize — a flawless emerald — off some unwitting mark's belt. Rewards coin, a
  // slug of Thieving XP, and a leather body to dip in quietly.
  // -------------------------------------------------------------------------
  grix: {
    id: 'grix',
    name: 'Light Fingers',
    giver: 'jailer',
    city: 'Eldenmoor',
    intro: 'Grix keeps the dungeon keys now, but he kept lighter company once — and he misses it. He\'d set a quick-handed sort a little caper, for old times\' sake and a cut of the take.',
    startConfirm: {
      prompt: 'So — fancy a little caper? Dip a few purses, lift me a shiny, and we split the take?',
      yes: 'Quiet hands and a quick exit. I\'m in, Grix.',
      no: 'I keep my hands to myself, thanks.',
      more: 'How does a body pick a pocket?',
      moreDialogue: [
        { speaker: 'Grix', text: 'Easy as breathing, if you\'ve the nerve. Sidle up to a townsperson, right-click \'em, and choose to pickpocket. A good dip\'s a fat purse; a clumsy one\'s a clip round the ear and a stunned minute. Practice on the soft marks first.' },
        { speaker: 'Grix', text: 'Dip enough purses and you\'ll be a hundred coin richer before they miss it — that\'s your warm-up. Then the real prize: someone in this town carries an emerald, flawless and green. Lift it off \'em clean and bring it to old Grix. We\'ll split it fair... ish.' },
      ],
      noReply: 'Suit yourself, Saint. But the purses don\'t empty themselves and these keys don\'t pay what they ought. Door\'s open if your principles ever loosen.',
      yesReply: [
        { speaker: 'Grix', text: 'HA — knew it. Got the look of a dipper, you have. Right: go warm those fingers up. Pickpocket folk round the square till you\'re a good hundred coin the richer. Right-click a mark and dip \'em — soft ones first, mind.' },
        { speaker: 'Grix', text: 'Once your hands are quick, find the emerald and lift it clean. Then back here to old Grix, quiet-like. And if a guard so much as looks at you — you don\'t know me. Off you slink.' },
      ],
      // Snapshot the player's coin purse at enrolment, so "pickpocket your way to
      // +100 coins" is measured purely by the coin that dipping nets — no hook
      // into thieving.js. (Spending in shops only makes the player work harder.)
      onAccept: (ctx) => { ctx.flags.coinBase = ctx.inventory.count('coins'); },
    },
    startDialogue: [
      { speaker: 'Grix', text: 'Pssst. You. Aye, you with the wandering eyes. Don\'t mind the keys — I weren\'t always a jailer. There was a time these hands knew every purse-string in the square.' },
      { speaker: 'Grix', text: 'Cushy enough work, minding a dungeon, but DULL — and the pay\'s a joke. A body misses the old trade. The thrill of the dip. The weight of another man\'s coin landing soft in your palm.' },
      { speaker: 'Grix', text: 'You\'ve quick eyes and a quiet step. What say we run a little caper, you and I? Dip a few purses, lift me one proper shiny, and we split the take. No one the wiser. What\'s your answer?' },
    ],
    stages: [
      {
        name: 'Warm up your fingers',
        journal: 'Grix set you a thieving caper. Pickpocket the townsfolk of Eldenmoor (right-click a person and choose Pickpocket) until your dipping has earned you 100 coins. Mind you don\'t get caught — clumsy hands get clipped.',
        objective: {
          hint: 'Pickpocket townsfolk until you have earned +100 coins.',
          check: (ctx) => (ctx.inventory.count('coins') - (ctx.flags.coinBase || 0)) >= 100,
        },
        progressHint: (ctx) => 'Coin lifted (' + Math.max(0, Math.min(ctx.inventory.count('coins') - (ctx.flags.coinBase || 0), 100)) + ' / 100). Keep your purse heavy — spending sets you back!',
        nudge: [
          { speaker: 'Grix', text: 'Purse still light, eh? A hundred coin off the marks, that was the warm-up. Right-click a townsperson and DIP \'em — soft ones first. And don\'t go spending it, you\'ll be at it all week.' },
        ],
      },
      {
        name: 'Lift the emerald',
        journal: 'Your fingers are quick now. Grix wants the real prize: a flawless emerald, carried by some unwitting mark about town. Keep pickpocketing the townsfolk — a rare dip turns up an emerald — until you\'ve lifted one for old Grix.',
        objective: {
          hint: 'Pickpocket townsfolk until you lift an emerald.',
          check: (ctx) => ctx.inventory.count('emerald') >= 1,
        },
        progressHint: (ctx) => 'Emerald lifted (' + Math.min(ctx.inventory.count('emerald'), 1) + ' / 1). Keep dipping — the green stone comes up rare.',
        nudge: [
          { speaker: 'Grix', text: 'Hundred coin richer and not a guard the wiser — that\'s my dipper. Now the prize: the emerald. Keep working the marks, it turns up on a lucky dip. Bring it to me and we\'re golden. Or green, rather. Heh.' },
        ],
      },
      {
        name: 'Bring the take to Grix',
        journal: 'The emerald is yours — lifted clean. Slip back to Grix at the dungeon, quiet as you came, to split the take and claim your cut of the caper.',
        objective: { hint: 'Bring the emerald back to Grix at the dungeon.', check: () => false },
        nudge: [
          { speaker: 'Grix', text: 'Is that green I spy in your palm? Bring it here, quick and quiet, and we\'ll square up the take. Mind the guards on your way down.' },
        ],
      },
    ],
    // Takes the emerald (Grix fences it and splits the coin), then pays a roguish
    // cut: a fat purse, a slug of Thieving XP for the caper pulled, and a leather
    // body to dip in quietly — soft, dark, and easy on the conscience.
    reward: {
      text: '350 coins, a Leather body, and 240 Thieving XP',
      grant: (ctx) => {
        ctx.inventory.removeN('emerald', 1); // Grix fences it and splits the coin
        ctx.inventory.add('coins', 350);
        ctx.inventory.add('leather_body', 1);
        ctx.skills.addXp('thieving', 240);
      },
    },
    completeDialogue: [
      { speaker: 'Grix', text: 'Ohh, would you LOOK at that. Flawless, green as a summer hill, and lifted clean off some fat merchant who\'ll not miss it till market day. You\'ve got the touch, friend. The genuine touch.' },
      { speaker: 'Grix', text: 'I\'ll fence the stone through a fellow I know — don\'t ask — and here\'s your cut of the take, fair and square. Well. Fair-ish. A finder\'s fee for old Grix, you understand. Trade\'s a trade.' },
      { speaker: 'Grix', text: 'Take this leather body, too — soft, dark, no jingle, no shine. Perfect for the work. A dipper in plate mail\'s just a noisy thief waiting for the stocks.' },
      { speaker: 'Grix', text: 'Keep those fingers warm, eh? There\'s always a purse wants lightening in this town, and old Grix always knows a buyer. You don\'t know me — but you know where to find me. Now slink off before a guard wanders by.' },
    ],
    doneDialogue: [
      { speaker: 'Grix', text: 'Quiet hands, quick exit, and a tidy cut — a caper done proper. Keep dipping, friend. And remember: you don\'t know me, and I\'ve never seen you before in my life. (Wink.)' },
    ],
  },

  // -------------------------------------------------------------------------
  // QUEST 13 — "The Fletcher's Order" (FLETCHING CRAFT). Bramble keeps the general
  // store, and the castle watch has put in a standing order for arrows the shelves
  // can't fill. Out of fletchers and short on stock, Bramble sets the player the
  // whole fletching loop: with a knife, whittle logs to shafts, feather them into
  // bronze arrows, and carve & string a shortbow besides — then deliver the order.
  // Every beat is verified by checking the bag when the player talks to Bramble
  // (low coupling — no hook into fletching.js). Rewards a better bow, a fresh
  // knife, Fletching XP, and coin.
  // -------------------------------------------------------------------------
  bramble: {
    id: 'bramble',
    name: 'The Fletcher\'s Order',
    giver: 'bramble',
    city: 'Eldenmoor',
    intro: 'Bramble\'s general store has a standing order for arrows from the castle watch and not a fletcher in sight to fill it. A quick pair of hands with a knife could clear the backlog — and earn a fine bow doing it.',
    startConfirm: {
      prompt: 'So — will you fletch the watch their order? Arrows and a bow, the lot?',
      yes: 'Hand me a knife and some logs. I\'ll fletch the order.',
      no: 'Fletching\'s not my trade today.',
      more: 'How does one fletch, exactly?',
      moreDialogue: [
        { speaker: 'Bramble', text: 'With a knife and a steady hand! Whittle logs into arrow shafts, then bind a feather to each — there\'s your bronze arrow. The watch wants twenty of them. I\'ll lend you a knife if you\'ve none; feathers I keep on the shelf.' },
        { speaker: 'Bramble', text: 'For the bow: carve a log into a shortbow stave, then string it with a length of bow string. One good shortbow finishes the order. Knife, feathers, string — all here on the counter. The logs you\'ll cut yourself, or buy off Hilda.' },
      ],
      noReply: 'Ah well. The watch can wait, I suppose — though they\'ll grumble. Come back if your hands fancy honest fletching work; the order\'s not going anywhere.',
      yesReply: [
        { speaker: 'Bramble', text: 'Bless you! Here — take this knife, it\'s the tool for the whole job. Now: twenty bronze arrows and one strung shortbow, that\'s the watch\'s order. Whittle logs to shafts, feather \'em, carve and string a bow.' },
        { speaker: 'Bramble', text: 'Feathers and bow string are here on my shelf; the logs you\'ll want fresh. Right-click a thing in your bag with the knife on you and you\'ll see the fletching options. Off you go — the watch is waiting!' },
      ],
      // Lend the player a knife on accept (the one tool the whole fletching loop
      // needs), so a brand-new fletcher can start the order at once.
      onAccept: (ctx) => { if (ctx.inventory.count('knife') < 1) ctx.inventory.add('knife', 1); },
    },
    startDialogue: [
      { speaker: 'Bramble', text: 'Welcome to the general store! Mind the clutter — and mind my mood, if you would, for I\'m in a proper bind this morning.' },
      { speaker: 'Bramble', text: 'The castle watch put in a standing order for arrows — twenty good bronze, and a fresh shortbow besides — and my last fletcher upped and married a turnip farmer three towns over. I\'ve the feathers, the string, the knife... and not a soul to wield \'em.' },
      { speaker: 'Bramble', text: 'You\'ve nimble-looking hands. Would you fletch the order for me? Whittle the shafts, feather the arrows, carve and string the bow — I\'ll set you up with the tools and pay you well in coin and craft.' },
    ],
    stages: [
      {
        name: 'Fletch twenty bronze arrows',
        journal: 'Bramble lent you a knife for the watch\'s order. With the knife in your bag, whittle logs into arrow shafts, then fletch each shaft with a feather into a bronze arrow. Carry 20 bronze arrows. Feathers are on Bramble\'s shelf; cut logs in the woods or buy them.',
        objective: {
          hint: 'Fletch and carry 20 bronze arrows.',
          check: (ctx) => ctx.inventory.count('bronze_arrow') >= 20,
        },
        progressHint: (ctx) => 'Bronze arrows fletched (' + Math.min(ctx.inventory.count('bronze_arrow'), 20) + ' / 20).',
        nudge: [
          { speaker: 'Bramble', text: 'The watch is still short of arrows, dear. Twenty bronze — whittle logs to shafts with the knife, then bind a feather to each. Feathers are here on my shelf. Off you whittle!' },
        ],
      },
      {
        name: 'Carve and string a shortbow',
        journal: 'The arrows are fletched. Now the bow: with the knife, carve a log into a shortbow stave, then string it with a bow string (Bramble keeps string on the shelf). Carry one finished shortbow to complete the order.',
        objective: {
          hint: 'Carve and string a shortbow.',
          check: (ctx) => ctx.inventory.count('shortbow') >= 1,
        },
        progressHint: (ctx) => 'Strung shortbow (' + Math.min(ctx.inventory.count('shortbow'), 1) + ' / 1).',
        nudge: [
          { speaker: 'Bramble', text: 'Fine arrows — but the order wants a bow, too. Carve a log into a shortbow stave with the knife, then string it with a bow string off my shelf. One good shortbow and the watch is happy.' },
        ],
      },
      {
        name: 'Deliver the order to Bramble',
        journal: 'Twenty bronze arrows and a strung shortbow — the watch\'s order, complete. Carry it all back to Bramble at the general store on the square to fill the order and claim your pay.',
        objective: { hint: 'Bring the arrows and shortbow to Bramble at the store.', check: () => false },
        nudge: [
          { speaker: 'Bramble', text: 'Is that the order I see — arrows AND a bow? Bring it to the counter, dear, and let\'s get the watch off my back at last!' },
        ],
      },
    ],
    // Takes the fletched order (it goes to the watch), then pays a fletcher's due:
    // an oak shortbow (a step up from the shortbow you made), a fresh knife of your
    // own to keep fletching, coin, and a generous slug of Fletching XP for the loop.
    reward: {
      text: 'an Oak shortbow, a Knife, 240 coins, and 260 Fletching XP',
      grant: (ctx) => {
        ctx.inventory.removeN('bronze_arrow', 20); // delivered to the watch
        ctx.inventory.removeN('shortbow', 1);       // the watch's new bow
        ctx.inventory.add('oak_shortbow', 1);       // a finer bow, for your trouble
        if (ctx.inventory.count('knife') < 1) ctx.inventory.add('knife', 1);
        ctx.inventory.add('coins', 240);
        ctx.skills.addXp('fletching', 260);
      },
    },
    completeDialogue: [
      { speaker: 'Bramble', text: 'Twenty bronze arrows, true-fletched and straight, and a shortbow strung tight as a drum! Oh, the watch will be thrilled — and I\'ll not have a sergeant glowering over my counter come morning. Bless your nimble hands.' },
      { speaker: 'Bramble', text: 'You\'ve a real fletcher\'s knack, you know — half the folk I\'ve hired couldn\'t feather an arrow without losing a thumb. The trade could use more like you.' },
      { speaker: 'Bramble', text: 'Here\'s your pay, and then some: an oak shortbow, a cut above the one you carved — call it a sample of finer work. Keep the knife, too; a fletcher should own her own. And coin besides, earned to the copper.' },
      { speaker: 'Bramble', text: 'Come fletch for me any time the shelves run bare, dear — the watch always wants arrows, and I\'d sooner pay a craftsman than chase a turnip farmer\'s widow. Off you go, and mind the clutter!' },
    ],
    doneDialogue: [
      { speaker: 'Bramble', text: 'Order\'s filled and the watch is quiet — bless your nimble hands. Bring me your fletching any time the shelves run bare; a craftsman\'s always welcome at my counter.' },
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
  const KILL_FLAG = { giant_rat: 'ratKills', goblin: 'goblinKills', hollow_king: 'hollowKingKills' };
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
