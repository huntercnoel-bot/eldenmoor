// npc.js — shopkeepers, the castle court, and townsfolk. Builds simple figures
// with floating name labels, and registers them for clicking/right-clicking.

import * as THREE from '../vendor/three.module.js';

// Each NPC carries dialogue for the dialogue box (see src/dialogue.js, wired in
// main.js). Most NPCs now use a branching chat:
//   `greeting` — a line (or array of lines) shown first.
//   `topics`   — a small "ask about..." menu; each { q, a } is a question label
//                and its answer (a line or array of lines). The talk flow returns
//                to the menu after each topic, with a "(Goodbye.)" option to leave.
//   `prompt`   — optional override for the menu header line.
// `dialogue` (the older flat list) and `flavor` (one-liner) are kept as fallbacks
// for any code/path that still reads them. King Aldric carries a `quest: 'king'`
// marker so the talk handler routes him to the quest system instead.
const NPC_DEFS = [
  // --- shopkeepers (now standing behind the counter INSIDE each shop) ---
  { id: 'bramble', name: 'Bramble', role: 'General Store', x: -15, z: 16, robe: 0x3f6e44,
    type: 'shop', shop: 'general', examine: 'A cheerful general-store keeper.', flavor: 'Finest oddments in all Eldenmoor! Come in, come in.',
    greeting: 'Welcome, welcome! Finest oddments in all Eldenmoor — buckets, rope, tinderboxes, the lot. What can I do you for?',
    prompt: 'What can I help you with, friend?',
    topics: [
      { q: 'What do you sell?', a: [
        'A bit of everything, and a lot of nothing in particular! Tinderboxes, rope, buckets, empty sacks, oddments by the crate.',
        'If it isn\'t nailed down, I\'ll sell it to you. If it IS nailed down — well, I\'ll sell you the nails.',
        'Right-click me when you\'re ready to trade. Browsing\'s free; touching is fifty percent.',
      ] },
      { q: 'How\'s business?', a: [
        'Booming, booming! Or it would be, if folk bought things instead of just "having a look".',
        'Don\'t get me wrong — I love a good look. I just love a good coin a bit more.',
      ] },
      { q: 'Any local gossip?', a: [
        'Word is the King\'s after able hands. And the tavern\'s after a new cellar — Saul reckons it\'s haunted.',
        'Between you and me, half of what Saul says is ale talking. The other half is the OTHER ale.',
      ] },
    ],
    dialogue: [
      'Welcome, welcome! Finest oddments in all Eldenmoor — buckets, rope, tinderboxes, the lot.',
      'If it isn\'t nailed down, I\'ll sell it to you. If it IS nailed down, I\'ll sell you the nails.',
      'Browsing\'s free, but a coin\'s a coin, eh? Right-click me to trade.',
    ] },
  { id: 'hilda', name: 'Hilda', role: "Hilda's Axes", x: 15, z: 16, robe: 0x6e3a3a,
    type: 'shop', shop: 'axes', examine: 'A burly axe merchant.', flavor: 'A sharp axe makes light work, love. Step inside.',
    greeting: 'A sharp axe makes light work, love. Dull ones make for sore arms and bad language. What\'ll it be?',
    prompt: 'Looking for an axe, are we?',
    topics: [
      { q: 'What axes have you got?', a: [
        'Bronze for the young\'uns, steel when you\'ve grown into it. I\'ll not sell you above your station.',
        'Get your Woodcutting up and I\'ll trust you with the good stuff. Right-click me to trade, love.',
      ] },
      { q: 'Did you forge these yourself?', a: [
        'Most of \'em, aye. These arms didn\'t get this way knitting.',
        'Don\'t ask about the bronze ones, though. Long story. Bad apprentice. We don\'t speak of it.',
      ] },
      { q: 'Any tips for a woodcutter?', a: [
        'Equip the best axe you can swing — a sharper edge means logs come faster.',
        'And keep an eye out for bird\'s nests up in the boughs. Tidy little bonus, those.',
      ] },
    ],
    dialogue: [
      'A sharp axe makes light work, love. Dull ones make for sore arms and bad language.',
      'Bronze for the young\'uns, steel when you\'ve grown into it. I\'ll not sell you above your station.',
      'Forged \'em myself. Well — most of \'em. Don\'t ask about the bronze ones.',
    ] },

  // --- castle court ---
  { id: 'king', name: 'King Aldric', role: 'the Crown', x: 0, z: 62, robe: 0x5e2a8a, crown: true, hair: 0xcfc4b0,
    type: 'royal', quest: 'king', examine: 'The sovereign of Eldenmoor, draped in royal purple.',
    flavor: 'Welcome to my hall, adventurer. Eldenmoor has need of brave souls like you.' },
  { id: 'duke', name: 'Duke Veylin', role: 'Royal Steward', x: 4, z: 61, robe: 0x274a7a,
    type: 'plain', examine: "The king's steward, keeper of the realm's affairs.",
    flavor: 'Seek the King if you crave purpose — and mind your manners in his hall.',
    greeting: 'You stand in the great hall of His Majesty King Aldric. Comport yourself accordingly.',
    prompt: 'Yes? Be brief — the realm does not run itself.',
    topics: [
      { q: 'Who are you?', a: [
        'Duke Veylin, Royal Steward of Eldenmoor. I keep the ledgers, the grain stores, the taxes — the unglamorous spine of a kingdom.',
        'Someone must mind the numbers while heroes go gallivanting after glory and bird\'s nests.',
      ] },
      { q: 'Is there work for me?', a: [
        'If it is purpose you seek, the King has tasks aplenty. Speak with His Majesty directly — he is seated upon the throne, where one tends to find kings.',
      ] },
      { q: 'How fares the realm?', a: [
        'Solvent, secure, and mercifully dull — precisely as a well-run realm should be.',
        'Winter presses early this year, mind. Stores are tight. Do nothing to make my ledgers worse, hm?',
      ] },
    ],
    dialogue: [
      'You stand in the great hall of His Majesty King Aldric. Comport yourself accordingly.',
      'If it is purpose you seek, the King has tasks aplenty. Speak with him directly.',
      'I keep the realm\'s ledgers, its grain stores, its taxes... someone must, while heroes go gallivanting.',
    ] },
  { id: 'guard_l', name: 'Royal Guard', role: 'Gatehouse Watch', x: -3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'The gate stands open to honest folk.',
    greeting: 'The gate stands open to honest folk. You look honest enough.',
    prompt: 'State your business.',
    topics: [
      { q: 'What lies beyond the gate?', a: ['The town square, the shops, the woods past that. Honest folk and the odd pickpocket. Keep your purse close.'] },
      { q: 'Anything to report?', a: ['Nothing to see but me, standing here. All day. Every day. Riveting work, the watch.'] },
      { q: 'Can I try on your helmet?', a: ['No.', '...No.', 'Everyone asks. The answer remains no. Move along.'] },
    ],
    dialogue: ['The gate stands open to honest folk. You look honest enough.', 'Move along. Nothing to see but me, standing here. All day.'] },
  { id: 'guard_r', name: 'Royal Guard', role: 'Gatehouse Watch', x: 3.5, z: 26, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A steadfast guard in plate, watching the gate.', flavor: 'Keep the peace within these walls, friend.',
    greeting: 'Keep the peace within these walls, friend.',
    prompt: 'Well? I\'m on duty.',
    topics: [
      { q: 'Quiet shift?', a: ['Quiet as the grave, which is how a guard likes it. Excitement means someone\'s on fire, usually.'] },
      { q: 'Where can I find the King?', a: ['Straight through the keep, up past the inner watch. He\'s the one in purple with the big chair. Can\'t miss him.'] },
      { q: 'Nice armour.', a: ['Standard issue. And before you ask — no, you cannot try on the helmet. My colleague warned me you\'d ask.'] },
    ],
    dialogue: ['Keep the peace within these walls, friend.', 'No, I will not let you try on the helmet. Everyone asks.'] },
  { id: 'guard_il', name: 'Royal Guard', role: 'Keep Watch', x: -4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'None pass to the King unannounced — but you seem alright.',
    greeting: 'None pass to the King unannounced — but you seem alright. Go on.',
    prompt: 'Mind yourself in there.',
    topics: [
      { q: 'What\'s through here?', a: ['The great hall, and His Majesty\'s throne. Tread proudly. And don\'t touch anything shiny — there\'s a lot of shiny.'] },
      { q: 'Is the King in?', a: ['Always. The man does not leave that throne. I\'ve seen statues move about more.'] },
      { q: 'Any advice?', a: ['Bow, don\'t gawp, and if he sets you a task — do it. He remembers the names of those who do. And those who don\'t.'] },
    ],
    dialogue: ['None pass to the King unannounced — but you seem alright. Go on.', 'The great hall\'s just ahead. Don\'t touch anything shiny.'] },
  { id: 'guard_ir', name: 'Royal Guard', role: 'Keep Watch', x: 4, z: 44, robe: 0x565b62, guard: true,
    type: 'plain', examine: 'A guard posted at the keep’s inner gate.', flavor: 'The great hall lies ahead. Tread proudly.',
    greeting: 'The great hall lies ahead. Tread proudly — and quietly.',
    prompt: 'Need something?',
    topics: [
      { q: 'How long have you stood here?', a: ['Eleven years. ELEVEN. Ask me anything about this wall — I know every crack, every cobweb, every loose stone.'] },
      { q: 'Tell me about this wall, then.', a: ['Granite, three feet thick, that crack by your boot\'s from the frost of \'29. ...You actually asked. No one ever asks. This is the best day of my career.'] },
      { q: 'Seen anything strange lately?', a: ['Strange? Down in the cellar, maybe. The jailer mutters. The prisoner wails. Up here? Just me and the wall, faithful as ever.'] },
    ],
    dialogue: ['The great hall lies ahead. Tread proudly — and quietly.', 'I\'ve stood this post eleven years. Eleven! Ask me anything about this wall.'] },
  { id: 'banker', name: 'Edra', role: 'Bank of Eldenmoor', x: 17, z: 38, robe: 0x3a5f3a,
    type: 'plain', examine: 'A sharp-eyed banker. (A proper bank is coming soon!)',
    flavor: 'Your coin is safe with the Bank of Eldenmoor. The vaults open shortly!',
    greeting: 'Welcome to the Bank of Eldenmoor! Your coin is safe with us. Safe as houses — safer, honestly. Houses burn down.',
    prompt: 'How may the Bank serve you?',
    topics: [
      { q: 'Can I store my things?', a: [
        'Ah. Not... quite yet. The vaults open shortly! We\'re just waiting on the locks.',
        'And the vault. And the gold. And, if I\'m honest, the building. But the SIGN is lovely, isn\'t it?',
      ] },
      { q: 'Can you hold my logs?', a: ['No, dear. I can\'t hold your logs. Or your axe. Or your hopes and dreams. Soon, as the scribes say. They always say soon.'] },
      { q: 'Is my money really safe?', a: ['Absolutely. Ironclad. Unbreakable. ...In a theoretical sense. Once we have the iron. And the clad. Trust the Bank!'] },
    ],
    dialogue: [
      'Your coin is safe with the Bank of Eldenmoor. Safe as houses. Safer, honestly — houses burn down.',
      'The vaults open shortly! We\'re just... waiting on the locks. And the vault. And the gold.',
      'No, I can\'t hold your logs for you yet. Soon, as the scribes say.',
    ] },
  { id: 'cook', name: 'Bessa', role: 'Castle Cook', x: -18, z: 37, robe: 0xb08a5a, apron: true,
    type: 'plain', examine: 'The castle cook, flour to her elbows.', flavor: 'Mind the oven, dear — hot bread for the King’s table!',
    greeting: 'Mind the oven, dear — that\'s hot bread for the King\'s own table, fresh as the dawn.',
    prompt: 'What is it, love? Mind the flour.',
    topics: [
      { q: 'What are you baking?', a: ['Bread, pies, and a great pot of something brown for the court. His Majesty does love a fresh loaf — keeps the whole hall sweet-smelling.'] },
      { q: 'Do you tend the hearth?', a: ['That I do — the great hall\'s hearth is mine to keep lit. When there\'s wood for it, mind. Cold wood warms no one, as I\'m forever telling His Majesty.'] },
      { q: 'How\'s the cooking going?', a: ['Flour to my elbows from dawn to dusk! Burnt one batch last week, I\'ll confess. Told the King it was "rustic". He believed me, bless his crowned little head.'] },
    ],
    dialogue: [
      'Mind the oven, dear — that\'s hot bread for the King\'s own table.',
      'Flour to my elbows from dawn to dusk. His Majesty does love a fresh loaf.',
      'Burnt one batch last week. Told the King it was "rustic". He believed me, bless him.',
    ] },

  // --- townsfolk (the square) ---
  { id: 'tomas', name: 'Old Tomas', role: 'Townsfolk', x: 4, z: 11, robe: 0x6a5a3a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A weathered old townsman, watching the square.',
    flavor: 'Grand town, this. The King keeps us safe behind those walls.',
    greeting: 'Grand town, this. The King keeps us safe behind those walls, and we\'re grateful for it.',
    prompt: 'What is it, young\'un?',
    topics: [
      { q: 'You\'ve lived here long?', a: ['Sixty year I\'ve watched this square. Seen it all, I have. Wars, weddings, three fires and a flood. Mostly pigeons, though.'] },
      { q: 'Things were better in your day?', a: ['In my day, adventurers said please and thank you, and walked at a sensible pace. You young\'uns just RUN everywhere. Where\'s the fire?'] },
      { q: 'Any wisdom for me?', a: ['Keep your axe sharp, your purse shut, and your ear to the tavern. That\'s where the real news is. That and the pigeons.'] },
    ],
    dialogue: [
      'Grand town, this. The King keeps us safe behind those walls, and we\'re grateful for it.',
      'Been watching this square sixty year. Seen it all, I have. Mostly pigeons.',
      'In my day, adventurers said please and thank you. You young\'uns just run everywhere.',
    ] },
  { id: 'mara', name: 'Mara', role: 'Market Trader', x: 4, z: 19, robe: 0x8a3a5a,
    type: 'plain', examine: 'A bright-eyed market trader.', flavor: 'Fresh wares at the stalls! Mind the fountain, love.',
    greeting: 'Fresh wares at the stalls! Mind you don\'t fall in the fountain, love — last fellow did, soaked head to boot.',
    prompt: 'See anything you fancy?',
    topics: [
      { q: 'What\'s for sale around here?', a: ['Whatever you need, someone in this square sells it. Or knows someone who does. Or will, once they\'ve "borrowed" it back off Saul.'] },
      { q: 'How\'s trade?', a: ['Good, when the roads are safe — and they are, thank the King and his guards. A safe road is a trader\'s best friend, love.'] },
      { q: 'Who\'s that child running about?', a: ['That\'s little Wren. Faster than a startled hare and twice as much trouble. Don\'t race her — you\'ll lose, and she\'ll never let it go.'] },
    ],
    dialogue: [
      'Fresh wares at the stalls! Mind you don\'t fall in the fountain, love — last fellow did.',
      'Whatever you need, someone in this square sells it. Or knows someone who does.',
      'Trade\'s good when the roads are safe. Thank the King and his guards for that.',
    ] },
  { id: 'smith', name: 'Garrett', role: 'Blacksmith', x: 10, z: 6, robe: 0x4a4640, hair: 0x2a2018, apron: true,
    type: 'shop', shop: 'armoury', examine: 'A soot-streaked blacksmith with brawny arms.', flavor: 'Armour for the road? Step up to the anvil, friend.',
    greeting: 'Armour for the road? Step up to the anvil, friend. I\'ll see you kitted out.',
    prompt: 'What can the forge do for you?',
    topics: [
      { q: 'Show me your wares.', a: ['Good steel between you and a goblin\'s blade — best coin you\'ll ever spend. Right-click me to trade and we\'ll talk plate.'] },
      { q: 'Can you make me a weapon?', a: ['Armour\'s my trade — for axes, see Hilda across the way. She\'s prouder of her edges than I am of my dents.'] },
      { q: 'It\'s hot in here.', a: ['Mind the sparks. And the heat. And the hammer. Honestly, friend — just stand back a bit. I\'ve singed better-dressed folk than you.'] },
    ],
    dialogue: [
      'Armour for the road? Step up to the anvil, friend. I\'ll see you kitted out.',
      'Good steel between you and a goblin\'s blade — best coin you\'ll ever spend.',
      'Mind the sparks. And the heat. And the hammer. Honestly, just stand back a bit.',
    ] },
  { id: 'farmer', name: 'Pell', role: 'Farmer', x: 8, z: -9, robe: 0x6a7a3a, hair: 0xb9a06a,
    type: 'plain', examine: 'A cheerful farmer with hay on his boots.', flavor: 'Good harvest this year, thank the King. Mind the windmill yonder.',
    greeting: 'Good harvest this year, thank the King! Wheat\'s up to my chest out yonder.',
    prompt: 'What brings you to my field?',
    topics: [
      { q: 'What\'s that windmill for?', a: ['See it turning? Grinds our grain to flour for the castle ovens. Round and round it goes, day and night. Hypnotic, ain\'t it.'] },
      { q: 'Need a hand with the harvest?', a: ['Kind of you! But a hero with an axe is wasted on wheat. Save your back for the woods — leave the sickle work to old Pell.'] },
      { q: 'Why\'s there a scarecrow?', a: ['A scarecrow scares crows. A Pell scares everything ELSE off my field — foxes, rabbits, nosy adventurers. Off you pop now!'] },
    ],
    dialogue: [
      'Good harvest this year, thank the King! Wheat\'s up to my chest out yonder.',
      'See the windmill? Grinds our grain to flour for the castle ovens. Round and round it goes.',
      'A scarecrow scares crows. A Pell scares everything else off my field. Off you pop!',
    ] },
  { id: 'nun', name: 'Sister Adela', role: 'Chapel', x: -25, z: 13, robe: 0x4a4a5a, hair: 0xcccccc,
    type: 'plain', examine: 'A gentle sister tending the chapel grounds.', flavor: 'Light a candle within, traveller. The Light watches over Eldenmoor.',
    greeting: 'Peace be with you, traveller. The Light watches over all of Eldenmoor — even the muddy-booted.',
    prompt: 'What troubles your heart, child?',
    topics: [
      { q: 'Tell me of the Light.', a: ['The Light is the warmth that endures the longest winter. We keep a candle for every soul in Eldenmoor — yours is lit too, now you\'ve come.'] },
      { q: 'May I rest here?', a: ['Of course. The chapel doors are always open to you. Even adventurers need rest for the soul — especially adventurers, I find.'] },
      { q: 'Any blessing for the road?', a: ['Go gently, return safely, and be kinder than you must. The Light asks little else. ...And do wipe your boots.'] },
    ],
    dialogue: [
      'Peace be with you, traveller. The Light watches over all of Eldenmoor.',
      'Light a candle within, if you\'ve a moment. A little warmth goes a long way.',
      'Even adventurers need rest for the soul. The chapel doors are always open to you.',
    ] },
  { id: 'child', name: 'Wren', role: 'Townsfolk', x: -3, z: 14, scale: 0.68, robe: 0x8a5a8a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A small child darting about the square.', flavor: 'Wanna race to the fountain? Betcha can’t catch me!',
    greeting: 'Wanna race to the fountain? Betcha can\'t catch me!',
    prompt: 'Ooh ooh, ask me somethin\'!',
    topics: [
      { q: 'What do you want to be when you grow up?', a: ['An ADVENTURER! Like you! With a BIG axe and a SHINY sword and a hat with a feather! ...Mam says I have to learn letters first. Boring.'] },
      { q: 'Is there really a ghost in the cellar?', a: ['Old Saul at the tavern says there\'s GHOSTS down there. Pale and moanin\'. I\'m not scared. ...Are YOU scared? \'Cause I\'m not. Mostly.'] },
      { q: 'Want to race?', a: ['YES! Ready — set — HA, too slow! Betcha can\'t catch me to the fountain! ...You\'re not even running. Grown-ups are no fun.'] },
    ],
    dialogue: [
      'Wanna race to the fountain? Betcha can\'t catch me!',
      'When I grow up I\'m gonna be an adventurer like you! With a BIG axe!',
      'Old Saul at the tavern says there\'s GHOSTS in the cellar. I\'m not scared. ...Are YOU scared?',
    ] },
  { id: 'innkeep', name: 'Bram', role: 'The Prancing Stag', x: -16, z: -18.6, robe: 0x6a4a2a, hair: 0x3a2a1a, apron: true,
    type: 'plain', examine: 'The barrel-chested innkeeper, polishing a tankard.', flavor: 'Pull up a stool! Best ale this side of the moat.',
    greeting: 'Pull up a stool! Best ale this side of the moat — and, if I\'m honest, the only ale this side of the moat.',
    prompt: 'What\'ll you have?',
    topics: [
      { q: 'Tell me about the Prancing Stag.', a: ['Three generations my family\'s kept it. Same hearth, same songs, same stew recipe — more\'s the pity. Folk keep ordering it anyway.'] },
      { q: 'What\'s the gossip?', a: ['Travellers pass through, tongues loosen with the ale. Word is the King\'s after able hands. And Saul\'s after another free drink — don\'t fall for it.'] },
      { q: 'What\'s with Old Saul?', a: ['Saul? He\'s been "about to leave" since noon. Pay his ghost stories no mind — the only spirits in my cellar come in barrels.'] },
    ],
    dialogue: [
      'Pull up a stool! Best ale this side of the moat — and the only ale this side of the moat.',
      'The Prancing Stag\'s been in my family three generations. Stew\'s the same recipe, more\'s the pity.',
      'Saul\'s been "about to leave" since noon. Pay his ghost stories no mind.',
    ] },
  { id: 'patron1', name: 'Old Saul', role: 'Tavern Regular', x: -13, z: -11, robe: 0x4a5a6a, hair: 0xb9b2a4,
    type: 'plain', examine: 'A grizzled regular nursing a drink.', flavor: 'Gold in that cellar, they say… or maybe ghosts. Hic!',
    greeting: 'Gold in that cellar, they say… or maybe ghosts. Hic! Pull up a chair, friend.',
    prompt: 'What\'re ye after, eh?',
    topics: [
      { q: 'Ghosts? What ghosts?', a: ['I SEEN \'em. Down in the dungeon. Pale things, moanin\' in the dark. ...Or that was the ale. One o\' the two. Maybe both. Hic.'] },
      { q: 'Where\'s the treasure buried?', a: ['Buy old Saul a drink and I\'ll tell ye where it\'s buried! ...I forget exactly where. But I\'ll TELL ye, with great confidence, and that\'s nearly the same.'] },
      { q: 'Maybe you\'ve had enough?', a: ['Enough?! There\'s no such thing, young\'un. There\'s only "not yet" and "Bram\'s cut me off again". HIC.'] },
    ],
    dialogue: [
      'Gold in that cellar, they say… or maybe ghosts. Hic!',
      'I seen \'em. Down in the dungeon. Pale things, moanin\'. Or that was the ale. One o\' the two.',
      'Buy old Saul a drink and I\'ll tell you where the treasure\'s buried. ...I forget. But I\'ll TELL you.',
    ] },
  { id: 'patron2', name: 'Edda', role: 'Tavern Regular', x: -19, z: -11, robe: 0x7a3a5a, hair: 0x6a4a2a,
    type: 'plain', examine: 'A traveller resting her feet by the fire.', flavor: 'Long road to Eldenmoor. The stew here makes it worth it.',
    greeting: 'Long road to Eldenmoor. The stew here makes it worth it — barely. Park yourself, you look footsore.',
    prompt: 'Care to swap a word?',
    topics: [
      { q: 'Where have you travelled from?', a: ['The eastern shires, all on foot. Blisters on my blisters, I tell you. Whatever they say about the open road — it\'s further than that.'] },
      { q: 'Heard any news?', a: ['Word is the King\'s looking for able hands. You\'ve the look of someone who could use the coin — no offence, those boots have seen things.'] },
      { q: 'Is the stew really that bad?', a: ['It\'s... characterful. Stick to the ale and the bread, and you\'ll do fine. The stew is for the brave or the very, very tired.'] },
    ],
    dialogue: [
      'Long road to Eldenmoor. The stew here makes it worth it — barely.',
      'I\'ve walked from the eastern shires. Blisters on my blisters, I tell you.',
      'Word is the King\'s looking for able hands. You\'ve the look of someone who could use the coin.',
    ] },

  // --- upper floor (the royal apartments) ---
  { id: 'advisor', name: 'Lady Maelis', role: 'Royal Advisor', x: 2, z: 60, floor: 1, robe: 0x6e3a8a, hair: 0xb08a5a,
    type: 'plain', examine: 'The King’s trusted advisor, poring over the maps.', flavor: 'Up here we plan the realm’s future. Welcome to the royal floor.',
    greeting: 'Welcome to the royal floor. Up here we plan the realm\'s future — over a great many maps, and rather too little sleep.',
    prompt: 'You have the ear of the King\'s advisor. Use it wisely.',
    topics: [
      { q: 'What do you do up here?', a: ['I read the maps, the letters, the omens, and tell the King what he ought to think — then let him believe he thought it. That is the whole of statecraft, really.'] },
      { q: 'What\'s King Aldric like?', a: ['Kind-hearted to a fault. He\'d send a hero to fetch his slippers if I let him. I do not let him. ...Often. The hearth, I\'ll allow — a cold court is a grumbling court.'] },
      { q: 'Any counsel for me?', a: ['If His Majesty has set you a task, see it through to the end. He remembers those who do — and so, more usefully, do I.'] },
    ],
    dialogue: [
      'Welcome to the royal floor. Up here we plan the realm\'s future — over a great many maps.',
      'The King means well, but he\'d send a hero to fetch his slippers if I let him. I do not let him. ...Often.',
      'If His Majesty has set you a task, see it through. He remembers those who do.',
    ] },

  // --- basement (the cellar & dungeon) ---
  { id: 'jailer', name: 'Grix', role: 'Dungeon Keeper', x: -10, z: 52, floor: -1, robe: 0x3a3a30, hair: 0x2a2a22,
    type: 'plain', examine: 'A grim jailer with a heavy ring of keys.', flavor: 'Mind the cells. Some things down here are best left locked away.',
    greeting: 'Mind the cells. Some things down here are best left locked away — and I aim to keep \'em that way.',
    prompt: 'What d\'you want, then? Be quick.',
    topics: [
      { q: 'What\'s with all the keys?', a: ['Twenty-three keys on this ring. Don\'t ask me what twenty-two of \'em open. I forgot. Years ago. The last one\'s for the privy, and even THAT\'S a maybe.'] },
      { q: 'Is the prisoner innocent?', a: ['Innocent? Ha. No. They\'re ALL innocent, to hear \'em tell it. That one\'d swear blind the goat started it.'] },
      { q: 'It\'s grim down here.', a: ['Grim\'s the job. Quiet, dark, and cold — suits me. Up top there\'s sunshine and small talk. No thank you. Down here, only the prisoner talks, and I can lock his door.'] },
    ],
    dialogue: [
      'Mind the cells. Some things down here are best left locked away.',
      'Twenty-three keys on this ring. Don\'t ask me what twenty-two of \'em open. I forgot. Years ago.',
      'No, the prisoner\'s NOT innocent. They\'re all innocent, to hear \'em tell it.',
    ] },
  { id: 'prisoner', name: 'Old Hagen', role: 'Captive', x: -16, z: 55, floor: -1, robe: 0x7a6a5a, hair: 0xcfc8b6,
    type: 'plain', examine: 'A ragged prisoner behind the bars.', flavor: 'Psst… get me out of here, friend? No? …worth a try.',
    greeting: 'Psst… get me out of here, friend? No? …worth a try. A fellow\'s got to ask.',
    prompt: 'C\'mere, c\'mere — what\'ll it be?',
    topics: [
      { q: 'What are you in for?', a: ['I\'m innocent, I am! Mostly. Partly. ...Look, the goat had it coming, and that\'s ALL I\'ll say in present company.'] },
      { q: 'Can I help you escape?', a: ['Slip me Grix\'s keys and I\'ll make it worth your while, friend. ...I won\'t. I\'ve nothing to my name but this straw. But I\'ll SAY I will, with great sincerity!'] },
      { q: 'Any secrets to share?', a: ['There\'s gold in the cellar, so they whisper. Or ghosts. Same fellow tells both stories, mind — and he drinks at the Stag.'] },
    ],
    dialogue: [
      'Psst… get me out of here, friend? No? …worth a try.',
      'I\'m innocent, I am! Mostly. Partly. Look, the goat had it coming.',
      'Slip me Grix\'s keys and I\'ll make it worth your while. ...I won\'t. But I\'ll say I will.',
    ] },
];

const _v = new THREE.Vector3();

export function buildNpcs(scene) {
  const npcs = [];
  for (const def of NPC_DEFS) {
    const group = makeNpc(def);
    group.userData.floor = def.floor || 0;
    group.visible = (def.floor || 0) === 0;   // only the active floor's NPCs are shown
    scene.add(group);
    const label = document.createElement('div');
    label.className = 'npc-label';
    label.textContent = def.name + '  ·  ' + def.role;
    document.body.appendChild(label);
    npcs.push({ def, group, label });
  }
  scene.userData.npcs = npcs.map((n) => n.group); // for raycasting (each group has userData.def)
  return npcs;
}

// Project each NPC's head to the screen and place its floating name there.
export function updateNpcLabels(npcs, camera) {
  for (const n of npcs) {
    if (!n.group.visible) { n.label.style.display = 'none'; continue; }
    _v.set(n.group.position.x, 2.4, n.group.position.z).project(camera);
    if (_v.z > 1 || _v.x < -1.1 || _v.x > 1.1) { n.label.style.display = 'none'; continue; }
    n.label.style.display = 'block';
    n.label.style.left = (_v.x * 0.5 + 0.5) * window.innerWidth + 'px';
    n.label.style.top = (-_v.y * 0.5 + 0.5) * window.innerHeight + 'px';
  }
}

// Show only the NPCs that belong to the given floor.
export function setNpcsFloor(npcs, floor) {
  for (const n of npcs) n.group.visible = (n.def.floor || 0) === floor;
}

// Gentle wandering: each NPC strolls within a small radius of its home spot and
// returns to its exact starting position roughly every ~100 seconds.
export function updateNpcs(npcs, dt, clock) {
  for (const n of npcs) {
    if (!n.group.visible) continue;
    const d = n.def, g = n.group;
    if (!n._home) { n._home = { x: d.x, z: d.z }; n._tgt = { x: d.x, z: d.z }; n._next = 0; n._homeAt = 0; n._ph = Math.random() * 10; }
    let radius = 1.2;
    if (d.type === 'shop' || d.guard || d.crown) radius = 0.55;   // shopkeepers / guards / king barely leave their post
    if (d.id === 'child') radius = 2.6;                            // the kid roams more
    if (clock >= n._next) {
      const h = n._home;
      if (clock - n._homeAt > 100) { n._tgt = { x: h.x, z: h.z }; n._homeAt = clock; }   // back to the exact spot
      else { const a = Math.random() * Math.PI * 2, r = Math.random() * radius; n._tgt = { x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r }; }
      n._next = clock + 2.5 + Math.random() * 4.5;                 // pause a few seconds at each spot
    }
    const dx = n._tgt.x - g.position.x, dz = n._tgt.z - g.position.z, dist = Math.hypot(dx, dz);
    const rig = g.userData.rig;
    if (dist > 0.06) {
      const step = Math.min(dist, (d.id === 'child' ? 1.4 : 0.6) * dt);
      g.position.x += (dx / dist) * step; g.position.z += (dz / dist) * step;
      g.rotation.y = Math.atan2(dx, dz);
      g.position.y = Math.abs(Math.sin((clock + n._ph) * 8)) * 0.035;          // walking bob
      if (rig) { const sw = Math.sin((clock + n._ph) * 8) * 0.5; rig.legL.rotation.x = sw; rig.legR.rotation.x = -sw; rig.armL.rotation.x = -sw * 0.6; rig.armR.rotation.x = sw * 0.6; }  // swing legs + arms
    } else {
      g.position.y = 0;
      if (rig) for (const part of [rig.legL, rig.legR, rig.armL, rig.armR]) part.rotation.x *= 0.82;   // settle to a stand
    }
  }
}

const BEARDED = new Set(['king', 'duke', 'guard_l', 'guard_r', 'guard_il', 'guard_ir', 'smith', 'farmer', 'jailer', 'patron1', 'tomas']);
const SKINS = [0xf0c8a0, 0xe7b08a, 0xd9a06e, 0xc68a5a, 0xa9744a];
const HAIRS = [0x2a2018, 0x3a2a1a, 0x5b3f29, 0x8a6a3a, 0x9a9a9a, 0xb9b2a4, 0x6a4a2a];
const LONG_ROBE = new Set(['king', 'duke', 'advisor', 'nun', 'banker', 'jailer']);   // floor-length robe over the legs

function makeNpc(def) {
  const g = new THREE.Group();
  const M = (c, r = 0.85, mt = 0) => (c && c.isMaterial ? c : new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: mt }));
  const cap = (r, len, c) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), M(c));
  const ball = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(c));
  const cyl = (rt, rb, h, c, s = 14) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), M(c));
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c));
  const cone = (r, h, c, s = 10) => new THREE.Mesh(new THREE.ConeGeometry(r, h, s), M(c));
  const ring = (r, t, c) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), M(c));
  const at = (o, x, y, z, rx = 0, ry = 0, rz = 0, sx, sy, sz) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); if (sx !== undefined) o.scale.set(sx, sy, sz); return o; };
  const add = (p, o) => { o.traverse((n) => { if (n.isMesh) { n.castShadow = true; n.receiveShadow = true; } }); p.add(o); return o; };

  // deterministic per-NPC variety (seeded by id, so it's stable across reloads)
  let s = 2166136261; for (let i = 0; i < (def.id || '').length; i++) s = (Math.imul(s ^ def.id.charCodeAt(i), 16777619)) >>> 0;
  const rnd = () => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
  const skinC = def.skin || SKINS[(rnd() * SKINS.length) | 0];
  const hairC = def.hair || HAIRS[(rnd() * HAIRS.length) | 0];
  const hairStyle = (rnd() * 3) | 0;          // 0 short · 1 long · 2 balding
  const build = 0.92 + rnd() * 0.18;          // body width
  const robeC = def.robe, pantsC = def.pants ?? 0x3a2f22, bootC = 0x33251a;
  const longRobe = LONG_ROBE.has(def.id);
  const steel = M(0x9aa0a8, 0.45, 0.55), gold = M(0xe9c33a, 0.3, 0.7), white = M(0xece6d6), dark = M(0x2a2620);

  // ---- legs (jointed: hip → knee, so they swing when walking) ----
  const makeLeg = () => {
    const hip = new THREE.Group();
    add(hip, at(cap(0.1, 0.2, pantsC), 0, -0.18, 0));
    const lo = new THREE.Group(); lo.position.set(0, -0.36, 0);
    add(lo, at(cap(0.085, 0.2, pantsC), 0, -0.16, 0));
    const foot = add(lo, at(ball(0.12, bootC), 0, -0.36, 0.05)); foot.scale.set(1, 0.6, 1.5);
    hip.add(lo); hip.userData.lower = lo; return hip;
  };
  const legL = makeLeg(); legL.position.set(0.13 * build, 0.84, 0);
  const legR = makeLeg(); legR.position.set(-0.13 * build, 0.84, 0);
  g.add(legL, legR);

  // ---- torso (V-tapered tunic) + belt ----
  add(g, at(cyl(0.23 * build, 0.26 * build, 0.3, pantsC), 0, 0.9, 0));               // hips
  add(g, at(cyl(0.3 * build, 0.24 * build, 0.42, robeC), 0, 1.42, 0));               // chest
  add(g, at(cyl(0.25 * build, 0.23 * build, 0.3, robeC), 0, 1.08, 0));               // waist
  for (const sx of [-1, 1]) add(g, at(ball(0.13, robeC), sx * 0.26 * build, 1.52, 0, 0, 0, 0, 1, 0.92, 1.05)); // deltoids
  add(g, at(cyl(0.255 * build, 0.255 * build, 0.1, M(0x3a2a1a)), 0, 1.0, 0));        // belt

  // ---- arms (jointed: shoulder → elbow → hand) ----
  const makeArm = () => {
    const sh = new THREE.Group();
    add(sh, at(cap(0.08, 0.18, robeC), 0, -0.15, 0));
    const lo = new THREE.Group(); lo.position.set(0, -0.32, 0);
    add(lo, at(cap(0.07, 0.18, robeC), 0, -0.14, 0));
    add(lo, at(ball(0.08, skinC), 0, -0.3, 0.02));
    sh.add(lo); sh.userData.lower = lo; return sh;
  };
  const armL = makeArm(); armL.position.set(0.3 * build, 1.5, 0); armL.rotation.z = 0.12;
  const armR = makeArm(); armR.position.set(-0.3 * build, 1.5, 0); armR.rotation.z = -0.12;
  g.add(armL, armR);

  // ---- neck + head + face ----
  add(g, at(cyl(0.08, 0.1, 0.13, skinC), 0, 1.62, 0));
  add(g, at(ball(0.24, skinC), 0, 1.82, 0, 0, 0, 0, 0.96, 1.06, 0.96));              // head
  add(g, at(ball(0.17, skinC), 0, 1.72, 0.04, 0, 0, 0, 0.95, 0.7, 0.9));            // jaw
  for (const sx of [-1, 1]) { add(g, at(ball(0.042, 0x141414), sx * 0.1, 1.85, 0.19)); add(g, at(box(0.1, 0.025, 0.04, hairC), sx * 0.1, 1.92, 0.2)); add(g, at(ball(0.05, skinC), sx * 0.235, 1.82, 0.01)); } // eyes, brows, ears
  add(g, at(cone(0.042, 0.12, skinC, 8), 0, 1.78, 0.22, Math.PI / 2, 0, 0));        // nose
  add(g, at(ball(0.05, M(0x8a4a44)), 0, 1.7, 0.2, 0, 0, 0, 1.5, 0.4, 0.5));         // mouth

  // ---- hair / beard ----
  const bald = hairStyle === 2 && !def.crown && !def.guard;
  if (!def.guard && def.id !== 'nun') {
    if (!bald) add(g, at(ball(0.255, hairC), 0, 1.92, -0.03, 0, 0, 0, 1.04, 0.82, 1.06));
    else add(g, at(ball(0.255, hairC), 0, 1.76, -0.04, 0, 0, 0, 1.05, 0.45, 1.07));    // balding ring
    if (hairStyle === 1) add(g, at(box(0.4, 0.5, 0.16, hairC), 0, 1.66, -0.2));         // long hair
  }
  if (BEARDED.has(def.id)) {
    add(g, at(ball(0.2, hairC), 0, 1.61, 0.08, 0, 0, 0, 1.0, 0.9, 0.78));               // jaw beard (wraps the chin)
    add(g, at(cyl(0.05, 0.13, 0.16, hairC), 0, 1.55, 0.12));                            // tapered point under the chin
    add(g, at(box(0.18, 0.05, 0.07, hairC), 0, 1.74, 0.19));                            // moustache
    for (const sx of [-1, 1]) add(g, at(box(0.05, 0.16, 0.06, hairC), sx * 0.18, 1.7, 0.07)); // sideburns up to the ears
  }

  // ---- role-specific outfits & props ----
  if (longRobe) {
    const trimC = def.crown ? gold : M(0xcabf8a, 0.7, 0.1);                            // gold for the king, soft cream for the rest
    add(g, at(cyl(0.28 * build, 0.52, 1.42, robeC), 0, 0.72, 0));                       // floor-length robe over the legs
    add(g, at(cyl(0.53, 0.5, 0.07, robeC), 0, 0.06, 0));                                // hem
    add(g, at(ring(0.5, 0.03, trimC), 0, 0.07, 0, Math.PI / 2, 0, 0));                  // hem trim
    for (const sx of [-1, 1]) add(g, at(box(0.045, 1.25, 0.04, trimC), sx * 0.1, 0.78, 0.27 * build)); // vertical placket bands
    add(g, at(cyl(0.32 * build, 0.3 * build, 0.1, trimC), 0, 1.02, 0));                 // sash at the waist
  }
  if (def.crown) {
    add(g, at(ball(0.34, white), 0, 1.56, 0.02, 0, 0, 0, 1.2, 0.55, 1.25));            // ermine collar (mantle)
    for (const dx of [-0.22, 0.22]) add(g, at(ball(0.07, dark), dx, 1.5, 0.26));       // ermine spots
    add(g, at(box(0.06, 0.04, 0.05, dark), 0, 1.46, 0.3));
    add(g, at(cyl(0.255, 0.27, 0.13, gold), 0, 2.05, 0));                              // crown band
    add(g, at(ring(0.265, 0.02, M(0xf2d24a)), 0, 2.0, 0, Math.PI / 2, 0, 0));          // band lip
    for (const dx of [-0.18, -0.09, 0, 0.09, 0.18]) add(g, at(cone(0.05, 0.17, M(0xf2d24a), 6), dx, 2.2, 0)); // crown points
    for (const dx of [-0.18, 0, 0.18]) add(g, at(ball(0.03, M(0x6fb3e0)), dx, 2.04, 0.18)); // crown jewels
    add(armR.userData.lower, at(cyl(0.028, 0.028, 0.56, gold), 0, -0.3, 0.06));        // sceptre shaft
    add(armR.userData.lower, at(ball(0.07, M(0x6fb3e0)), 0, -0.02, 0.06));             // sceptre orb
    add(armR.userData.lower, at(ring(0.075, 0.018, gold), 0, -0.02, 0.06, Math.PI / 2, 0, 0)); // orb collar
  }
  if (def.guard) {
    const visorC = M(0x4a4f56, 0.5, 0.4);
    // --- plate body (a lesser, trimmer version of the hero's cuirass) ---
    add(g, at(cyl(0.33, 0.27, 0.48, steel), 0, 1.42, 0));                             // breastplate
    add(g, at(box(0.09, 0.4, 0.1, steel), 0, 1.44, 0.25));                            // central ridge
    add(g, at(ring(0.3, 0.025, gold), 0, 1.62, 0, Math.PI / 2, 0, 0));                // collar trim
    add(g, at(cyl(0.28, 0.32, 0.12, steel), 0, 1.14, 0));                             // fauld skirt
    add(g, at(ring(0.32, 0.022, gold), 0, 1.1, 0, Math.PI / 2, 0, 0));                // fauld trim
    // --- flared gold-rimmed pauldrons (smaller than the hero's, but the same shape) ---
    for (const sx of [-1, 1]) {
      const pa = new THREE.Group();
      pa.add(at(ball(0.2, steel), 0, 0, 0, 0, 0, 0, 1.25, 0.85, 1.15));               // dome
      pa.add(at(ring(0.2, 0.035, gold), 0, -0.03, 0, Math.PI / 2, 0, 0));             // rim
      pa.add(at(cone(0.06, 0.2, steel, 6), 0.06, 0.16, 0, 0, 0, -sx * 0.5));          // small spike
      add(g, at(pa, sx * 0.34, 1.6, 0, 0, 0, -sx * 0.32));
    }
    // --- OSRS full helm: dome + brow band + nasal + face slit + plume ---
    add(g, at(ball(0.255, steel), 0, 1.9, -0.01, 0, 0, 0, 1.0, 1.0, 1.04));           // dome
    add(g, at(cyl(0.26, 0.265, 0.1, gold), 0, 1.78, 0, 0, 0, 0, 1.0, 1.0, 1.04));     // brow band
    add(g, at(box(0.5, 0.16, 0.04, visorC), 0, 1.86, 0.235, 0, 0, 0, 1.0, 1.0, 1.0)); // eye slit (recessed)
    add(g, at(box(0.05, 0.24, 0.06, steel), 0, 1.82, 0.255));                         // nasal bar
    for (const sx of [-1, 1]) add(g, at(box(0.1, 0.26, 0.16, steel), sx * 0.21, 1.84, 0.08)); // cheek guards
    add(g, at(box(0.04, 0.16, 0.4, M(0x8a2230)), 0, 2.18, -0.04));                    // red plume crest
    // --- halberd, held to the side and angled in the off hand ---
    add(g, at(cyl(0.032, 0.032, 2.3, M(0x6b4a2f)), 0.36, 1.25, 0.12, 0, 0, -0.06));   // shaft
    add(g, at(cone(0.09, 0.32, steel), 0.43, 2.5, 0.12));                             // spear point
    add(g, at(box(0.26, 0.22, 0.03, steel), 0.27, 2.18, 0.12, 0, 0, 0.3));            // axe blade
  }
  if (def.apron) add(g, at(box(0.4, 0.72, 0.06, white), 0, 0.95, 0.26));
  if (def.id === 'cook') {                                                            // tall puffy chef's toque
    add(g, at(cyl(0.175, 0.2, 0.16, white), 0, 1.98, 0));                             // headband
    add(g, at(cyl(0.21, 0.18, 0.26, white), 0, 2.18, 0));                             // crown
    add(g, at(ball(0.23, white), 0, 2.34, 0, 0, 0, 0, 1.0, 0.7, 1.0));               // puffed top
  }
  if (def.id === 'farmer') { add(g, at(cone(0.42, 0.16, M(0xcba15a), 12), 0, 2.0, 0)); add(g, at(cyl(0.17, 0.17, 0.22, M(0xb8924a)), 0, 2.08, 0)); } // straw hat
  if (def.id === 'nun') {                                                             // wimple that frames (not hides) the face
    const habit = M(0x33333f);
    add(g, at(ball(0.29, white), 0, 1.95, -0.05, 0, 0, 0, 1.08, 0.95, 1.0));         // white coif over the crown
    for (const sx of [-1, 1]) add(g, at(box(0.07, 0.34, 0.34, white), sx * 0.24, 1.8, 0.04)); // coif sides framing the face
    add(g, at(box(0.46, 0.16, 0.34, white), 0, 1.62, 0.02));                          // wimple under the chin
    add(g, at(ball(0.31, habit), 0, 1.86, -0.12, 0, 0, 0, 1.12, 1.05, 0.7));         // dark veil behind
    add(g, at(box(0.56, 0.7, 0.05, habit), 0, 1.5, -0.22));                           // veil drape down the back
  }
  if (def.id === 'innkeep') add(armR.userData.lower, at(cyl(0.07, 0.07, 0.16, M(0xb08038)), 0, -0.32, 0.08)); // tankard

  if (def.scale) g.scale.setScalar(def.scale);
  g.position.set(def.x, 0, def.z);
  g.userData = { kind: 'npc', def, rig: { legL, legR, armL, armR } };
  return g;
}
