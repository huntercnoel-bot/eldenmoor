# Asset Replacements — Scout Report

Downloaded, verified (HTTP 200 · first 4 bytes `glTF` · > 5 KB · not a git-lfs
pointer) CC0 GLB binaries to replace remaining blocky/procedural geometry in
Eldenmoor. **Nothing under `src/` was edited** — this is a drop-in asset set plus
this mapping so the wiring pass is mechanical.

All assets are **CC0 1.0 (public domain, no attribution required)**.

## Sources used (all verified to serve real `.glb` binaries)

| Source | How fetched | License |
|---|---|---|
| `trebeljahr/quaternius-showcase` → `public/glb/...` | `raw.githubusercontent.com` (direct binary) | CC0 (Quaternius) |
| `KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0` → `.../Characters/gltf/...` | `raw.githubusercontent.com` (direct binary, repo is **not** LFS) | CC0 (KayKit) |
| `series-ai/jam-ready-assets` (Kenney CC0 mirror) | git-lfs → **`media.githubusercontent.com/media/...`** endpoint | CC0 1.0 (Kenney) |

> Note on the Kenney mirror: files there are git-lfs. Use the
> `https://media.githubusercontent.com/media/series-ai/jam-ready-assets/main/...`
> host to get the real binary. The plain `raw.githubusercontent.com` host returns a
> ~130-byte LFS pointer.

---

## 1. Prayer ALTAR  (highest priority — fully procedural today)

**Target:** `src/prayer.js` lines ~90-96, the inline `altarG` group built from 4
`THREE.BoxGeometry` meshes (`base`, `top`, `cross`, `crossArm`) + a `PointLight`.

| Replacement | Path | Bytes | Source URL |
|---|---|---|---|
| Stone altar (recommended) | `assets/models/props/graveyard_altar_stone.glb` | 17164 | media.githubusercontent.com/media/series-ai/jam-ready-assets/main/3D/seasonal-holiday/kenney-graveyard-kit/Models/GLB%20format/altar-stone.glb |
| Wood altar (alt) | `assets/models/props/graveyard_altar_wood.glb` | 28368 | …/kenney-graveyard-kit/Models/GLB%20format/altar-wood.glb |
| Standing cross (optional accent) | `assets/models/props/graveyard_cross.glb` | 15556 | …/kenney-graveyard-kit/Models/GLB%20format/cross.glb |
| Pedestal (alt altar base, Quaternius) | `assets/models/props/Pedestal.glb` | 97728 | raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/modular_dungeon_1/Pedestal.glb |

**Wiring note:** load with `GLTFLoader` (or the `loadProto` merge pattern in
mining.js). Keep `altarG.userData = { kind: 'prayer_altar' }` and the `PointLight`.
Replace the 4 box meshes with the loaded scene. Kenney units are ~1 m; altar-stone
is roughly 1×0.6×0.6 m — scale ~1.6× to match the old ~2 m-wide footprint. Tag the
loaded meshes `userData.__toonDone = true` (as the old meshes are) so the cel-shader
leaves them alone.

## 2. Mining FURNACE + ANVIL  (highest priority — fully procedural today)

**Targets:** `src/mining.js` `buildFurnace()` (lines ~493-508, Box+Cylinder stone
furnace) and `buildAnvil()` (lines ~510-524, Box/Cone iron anvil).

| Replacement | Path | Bytes | Source URL |
|---|---|---|---|
| Smelter/furnace (recommended) | `assets/models/props/smelter_furnace.glb` | 31488 | media.githubusercontent.com/media/series-ai/jam-ready-assets/main/3D/farm/cozy-farm/GLB/smelter_lvl1.glb |
| Furnace alt (oven) | `assets/models/props/Kitchen_Oven.glb` | 29968 | raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/house_interior_pack/Kitchen_Oven.glb |
| Anvil (recommended) | `assets/models/props/kenney_anvil.glb` | 30084 | media.githubusercontent.com/media/series-ai/jam-ready-assets/main/3D/nature/kenney-survival-kit/Models/GLB%20format/workbench-anvil.glb |

**Wiring note:** mining.js already has a `loadProto(name)` GLB loader (merges meshes,
recenters to `y=0`). Easiest path: copy these into `assets/models/env/` (or repoint a
loader at `assets/models/props/`) and load like the rocks. Keep the existing ember
`PointLight` + `vfx.attachFire` anchor at the furnace mouth — model replaces the body
only. Furnace scale ~1.6-2.0× (old body was ~2.4 m wide); anvil ~1.0× (Kenney anvil
≈ 0.8 m long, matches the old hand-built one). Set `material.userData.__toonDone`.

## 3. Fishing / cooking RANGE  (procedural today)

**Target:** `src/fishing.js` `buildRange()` (lines ~146-164, BoxGeometry stone range
with an emissive mouth).

| Replacement | Path | Bytes | Source |
|---|---|---|---|
| Oven (recommended) | `assets/models/props/Kitchen_Oven.glb` | 29968 | Quaternius house_interior_pack |
| Large oven | `assets/models/props/Kitchen_Oven_Large.glb` | 22896 | Quaternius house_interior_pack |
| Fireplace (alt, cosier) | `assets/models/props/Fireplace.glb` | 17728 | Quaternius house_interior_pack |
| Brazier / fire basket | `assets/models/props/graveyard_fire_basket.glb` | 18740 | Kenney graveyard-kit |

**Wiring note:** keep the `vfx.attachFire(...)` at the front mouth and
`g.userData = { kind: 'range' }`. Scale ~1.0-1.3×.

## 4. MONSTERS

Today **every** monster type in `MONSTER_MODEL` (src/monsters.js lines ~42-61)
already has a GLB; the `build*` procedural functions are only fallbacks. Two types
reuse a mismatched GLB, and the four undead types all share one skeleton GLB. These
downloads fix both.

| Target (src/monsters.js) | Currently uses | Replacement | Path | Bytes | Source URL |
|---|---|---|---|---|---|
| `chicken` (trainer mob) | `enemy_Rat.glb` (tiny rat) | Kenney cube chick | `assets/models/monsters/chicken.glb` | 125424 | media.githubusercontent.com/media/series-ai/jam-ready-assets/main/3D/characters/kenney-cube-pets/Models/GLB%20format/animal-chick.glb |
| `skeleton_warrior` | shares `Skeleton_Minion.glb` | KayKit Skeleton Warrior | `assets/models/monsters/Skeleton_Warrior.glb` | 4863620 | raw.githubusercontent.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/main/addons/kaykit_character_pack_skeletons/Characters/gltf/Skeleton_Warrior.glb |
| `hollow_king` (boss) | shares tinted `Skeleton_Minion.glb` | KayKit Skeleton Mage (distinct silhouette) | `assets/models/monsters/Skeleton_Mage.glb` | 4761048 | …/Characters/gltf/Skeleton_Mage.glb |
| undead rogue/archer (new option) | — | KayKit Skeleton Rogue | `assets/models/monsters/Skeleton_Rogue.glb` | 4827024 | …/Characters/gltf/Skeleton_Rogue.glb |
| `goblin` / guard stand-in | `goblin` uses `enemy_Spider.glb` | Quaternius Knight character | `assets/models/monsters/KnightCharacter.glb` | 393060 | raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/single_knight_pack/KnightCharacter.glb |

**Wiring note:** these load through the existing `MONSTER_MODEL` map + `attachModel`
in monsters.js — just point `file:` at the new GLB and set a sensible `h:` (target
on-ground height in metres). `attachModel` auto-scales to `h`, drops feet to `y=0`,
and `pickMonsterClip` matches Idle/Walk/Attack/Death by regex.
- KayKit skeletons ship their own Idle/Walk/Attack/Death clips (same naming family as
  the already-wired `Skeleton_Minion.glb`) → drop-in.
- `chicken.glb` (Kenney cube chick) is a **static** mesh (no clips) → sits in Idle
  pose, fine for a chicken; suggest `h: 0.45`.
- `KnightCharacter.glb` is a humanoid; confirm its clip names via `pickMonsterClip`
  (Quaternius uses Idle/Run/Attack). Treat as an optional upgrade for `goblin`.

**No procedural-only monster remains** — every `build:` has a GLB, so nothing is
critically T-posed/invisible without these; they are quality upgrades.

## 5. Town / dungeon PROPS  (supplemental)

Town/dungeon already use committed KayKit/Quaternius props (barrels, crates, market
stands, well, cart, fence, chests in `assets/models/env/` and
`assets/models/kaykit_dungeon/`). These add stalls/signage/treasure variety:

| Use | Path(s) (bytes) | Source |
|---|---|---|
| Market stall (plain/green/red) | `props/town_stall.glb` (11500), `town_stall_green.glb` (27120), `town_stall_red.glb` (24304) | Kenney Fantasy-Town kit |
| Hanging banner (red/green) | `props/town_banner_red.glb` (9988), `town_banner_green.glb` (10200) | Kenney Fantasy-Town kit |
| Town lantern (post lamp) | `props/town_lantern.glb` (14984) | Kenney Fantasy-Town kit |
| Fence gate | `props/town_fence_gate.glb` (46340) | Kenney Fantasy-Town kit |
| Treasure chest (closed/open) | `props/Chest_Closed.glb` (96748), `Chest_Open.glb` (95156) | Quaternius rpg_items_pack |
| Coin pile / coin / coin-skull / coin bag | `props/Coin_Pile.glb` (168888), `Coin.glb` (22304), `Coin_Skull.glb` (31200), `Bag_Coins.glb` (54304) | Quaternius modular_dungeon_1 / rpg_items_pack |
| Loot bag / pouch | `props/Bag.glb` (70352), `Pouch.glb` (24804) | Quaternius rpg_items_pack |
| Decorative statue / pedestal | `props/Statue_Horse.glb` (119712), `Pedestal2.glb` (58380) | Quaternius modular_dungeon_1 |

Stall/banner/lantern source: `media.githubusercontent.com/media/series-ai/jam-ready-assets/main/3D/fantasy/kenney-fantasy-town-kit/Models/GLB%20format/<name>.glb`
Quaternius source: `raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/<pack>/<Name>.glb`

**Wiring note:** all single-mesh static props → use the `loadProto`-style merge
loader (mining.js) or plain `GLTFLoader.load` + `scene.add`. ~1 m authored scale.
Tag `__toonDone`.

## 6. WEAPONS / SHIELDS  (new — for equipped gear / weapon racks / shop display)

CC0 RS/WoW-style weapons (Quaternius `medieval_weapons_pack`). No procedural target
yet — provided for the equip/visual-gear pass and to dress the existing
`assets/models/interior/wj_prop_weapon_rack.glb`.

| Item | Path | Bytes |
|---|---|---|
| Sword | `assets/models/weapons/Sword.glb` | 48384 |
| Sword (variant 2) | `assets/models/weapons/Sword_2.glb` | 54156 |
| Sword (big / two-hand) | `assets/models/weapons/Sword_Big.glb` | 50336 |
| Claymore | `assets/models/weapons/Claymore.glb` | 54980 |
| Battle axe | `assets/models/weapons/Axe.glb` | 63764 |
| Dagger | `assets/models/weapons/Dagger.glb` | 43740 |
| Spear | `assets/models/weapons/Spear.glb` | 69892 |
| Heater shield | `assets/models/weapons/Shield_Heater.glb` | 97820 |
| Round shield | `assets/models/weapons/Shield_Round.glb` | 60448 |
| Celtic gold shield | `assets/models/weapons/Shield_Celtic_Golden.glb` | 47584 |

Source: `raw.githubusercontent.com/trebeljahr/quaternius-showcase/main/public/glb/medieval_weapons_pack/<Name>.glb`

**Wiring note:** small hand-prop scale (~0.6-1.0 m blade). To hand-attach to a
character, parent under a hand bone and scale ~0.8-1.2×.

---

## Targets NOT sourced (notes for a future pass)

- **Goblin** (proper green goblin) and an **animated chicken** with walk/peck: the
  cleanest CC0 versions live on **poly.pizza** (Quaternius "LowPoly Animated
  Monsters" goblin; "Ultimate Animated Animals" chicken), but **poly.pizza and its
  API (`api.poly.pizza`) are blocked by this environment (HTTP 403 / host not in
  allowlist)**, and those packs are not in the `trebeljahr/quaternius-showcase`
  GitHub mirror. A GitHub `goblin.glb` exists in `Prompt-or-Die-Labs/toonscape` but
  its license is only "MIT (to be added)" with no LICENSE file → **rejected** as
  unverifiable. Stand-ins shipped instead: Kenney cube chick (`chicken.glb`) and
  Quaternius `KnightCharacter.glb` for the goblin slot.
- KayKit "RPG Tools Bits" / "Resource Bits" (nicer anvil/forge) are **itch.io-only,
  not on GitHub** → Kenney anvil/smelter used instead (verified CC0).
- KayKit Restaurant/City-Builder/Hexagon GitHub packs use split `.gltf`+`.bin`
  (not self-contained `.glb`) and were skipped per the self-contained-`.glb`
  preference.
