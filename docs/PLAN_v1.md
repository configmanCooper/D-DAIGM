# AETHERTABLE — HTML5 2D D&D Simulator
## Design & Implementation Plan  (v1, for independent review)

**Location:** `D:\CLI\D&D Simulator`
**Stack:** Plain browser JS (no build step, no framework, no bundler) + Node HTTP server.
**AI DM:** bundled local Ollama by default; GitHub Copilot CLI models optional.
**Players:** 1–4 seats, each seat independently `human` or `ai` (Copilot/local model).

---

## 0. Guiding principles

These come out of `_source/NEGOTIATOR_ARCH.md` (proven in the sibling ACCORD game) and
`_source/DM_RESEARCH.md` (prior-art failure analysis).

1. **The engine owns the rules. The LLM owns the prose.**
   The LLM never rolls dice, never decides hit/miss, never sets HP, never grants an item,
   never decides a DC outcome. It *proposes* (structured) and it *narrates* (free text).
   Every mechanical consequence is computed in `js/engine/` and is replayable from a seed.
   This is the single most important rule; every other decision follows from it.

2. **Two-phase DM turn (Referee → Engine → Narrator).**
   Small models (1.7B–4B) fail when asked for a big story *and* a nested schema in one call.
   Split it. Tight, flat, enum-heavy schema for the referee call; free prose for the narrator
   call, which is given the engine's already-decided results.

3. **Gate secrets by omission, not by instruction.**
   A 4B model cannot be trusted with "don't reveal X." If the player has not earned a secret,
   the secret is not in the prompt. The DM bible is sliced per-turn by an engine-side
   disclosure gate.

4. **Stable system prompt, varying stage direction.**
   Keeps the Ollama KV prefix cache warm (near-zero prompt cost) and makes behaviour
   reproducible. Turn-varying state goes in a separate appended block.

5. **Everything degrades, nothing crashes.**
   No Ollama → deterministic offline narrator (template + engine facts). Bad JSON → repair,
   then fall back to a rules-only resolution. Copilot CLI missing → local model. The game is
   fully playable with zero AI.

6. **Zero binary assets.** All art is procedurally drawn on canvas from seeded genomes.

7. **Automatable.** Every player action reachable by an AI seat through the exact same
   entry point a human click uses. Exports are written *server-side* so unattended runs work.

---

## 1. Directory layout

```
D:\CLI\D&D Simulator\
  index.html                 script tags in dependency order, no modules
  server.js                  Node HTTP server, Ollama manager, Copilot bridge, exports
  package.json               scripts only; single dep puppeteer-core (tests)
  start.ps1 / start.cmd / start.bat
  stop.ps1  / stop.cmd
  install-ai.ps1 / install-ai.cmd
  css\style.css
  js\
    rng.js                   mulberry32 seeded RNG, serialisable by draw count
    data\
      srd_license.js         CC-BY-4.0 attribution string (required)
      srd_rules.js           skills, conditions, XP, rests, cover, exhaustion, backgrounds, feats
      srd_races.js           9 races + subraces, each with a `visual` genome block
      srd_classes.js         12 classes + their 1 SRD subclass, features L1-20, slot tables
      srd_spells.js          250+ SRD spells with machine-readable `mech`
      srd_monsters.js        120+ SRD statblocks with machine-readable actions + `visual`
      srd_items.js           weapons/armor/gear/tools + 80+ magic items, each with icon genome
      names.js               name pools per race/culture for procedural NPCs
    engine\
      dice.js                notation parser, adv/dis, crits, seeded
      character.js           build/level/derive: AC, HP, saves, skills, slots, attacks, prof
      rules.js               checks, saves, contests, DC bands, cover, conditions, exhaustion
      combat.js              initiative, turn/round state machine, attacks, damage, AoE, LoS, death saves
      world.js               locations, travel, time-of-day, encounter tables, rest resolution
      quest.js               quests, objectives, flags, relationships, reputation, faction standing
      loot.js                treasure/encounter generation by CR + party level
      state.js               the single game-state object + all mutators (the ONLY writer)
      save.js                serialize/deserialize/digest/migrate, localStorage + file
    ai\
      backend.js             one interface over {offline, ollama, copilot}; streaming NDJSON
      schema.js              JSON schemas for every structured call (flat, enum-heavy)
      prompt.js              system dossier + stage direction + context budgeter
      memory.js              rolling summarisation, entity ledger, retrieval, token budget
      dm.js                  the Dungeon Master: referee call → engine → narrator call
      npc.js                 per-NPC voice cards, companion banter, dialogue
      player_agent.js        an AI-controlled *player seat* (legal-move list → index choice)
      offline.js             deterministic fallback narrator (no AI required)
    gen\
      art.js                 shade(), palettes, layered canvas primitives
      portrait.js            PC/NPC portraits from race+class+genome
      creature.js            monster sprites (silhouette + bilateral symmetry + features)
      icon.js                item icons from `iconShape` primitives; offscreen atlas cache
      scene.js               environment backdrops (parallax bands, weather, time of day)
      tokens.js              battle-map tokens
      worldgen.js            procedural campaign/region/quest generation for new games
    ui\
      app.js                 boot, state wiring, panel re-render, seat routing
      setup.js               new game / character creation / seat configuration wizard
      sheet.js               character sheet panel (full 5e sheet, editable where legal)
      party.js               party bar, HP/conditions, relationships
      log.js                 narrative log + dialogue, streaming text
      battle.js              canvas grid combat view, initiative tracker, AoE templates
      map.js                 region/world map view
      inventory.js           inventory, equip, attunement, shops
      journal.js             quests, NPCs met, lore discovered, relationship web
      watch.js               "Watch AI" panel: AI seats, step/run/stop, auto-export
  campaigns\
    shen_cooper.js           canon campaign data (public)
    shen_cooper_bible.js     DM-only secrets, gated by the disclosure engine
    sandbox.js               procedurally generated campaign template
  tests\                     plain-node scripts, ok()/pass/fail, exit code matters
  exports\                   server-written session exports
  docs\                      PLAN.md, README.md, ART.md, AI.md
  _source\                   research inputs (not shipped)
```

---

## 2. Server (`server.js`)

Adapted near-verbatim from ACCORD's proven server. Single file, no npm deps at runtime.

### Routes

| Route | Method | Purpose |
|---|---|---|
| `/` + static | GET | static files, NUL-byte + path-traversal guarded, MIME map |
| `/api/status` | GET | `{ok, ollama, model, models[], perf:{tokPerSec,projectedReplyMs}, copilot:{available,models[]}, version}` |
| `/api/chat` | POST | dumb NDJSON proxy to Ollama `/api/chat` (streams both ways) |
| `/api/copilot/chat` | POST | spawn Copilot CLI, return **Ollama-shaped** NDJSON so the client needs no special-casing |
| `/api/copilot/warm` | POST | 202 fire-and-forget; pays the ~30s CLI cold-start while the player reads the intro |
| `/api/agent/move` | POST | AI **player seat** move; defensive JSON recovery, returns `{choice, text}` |
| `/api/export` | POST | write session JSON + a human-readable Markdown transcript to `exports\` |
| `/api/export/dir` | GET | report the export directory |
| `/api/shutdown` | POST | graceful teardown (localhost only) |

### Ollama management (copied wholesale, retuned)

- Spawn bundled `ai\ollama\ollama.exe serve` with `OLLAMA_MODELS` pointed at `ai\models`
  (never the user profile), `OLLAMA_KEEP_ALIVE=-1`, `OLLAMA_MAX_LOADED_MODELS=1`,
  `OLLAMA_NUM_PARALLEL=1`, `OLLAMA_FLASH_ATTENTION=1`.
- `sweepOrphanRunners()` + `killTree()` on every boot and shutdown — fixes the
  "leaked `llama-server.exe` holds 6.7 GB of VRAM forever" bug.
- **Model tiering.** Same three tiers as ACCORD, same preference order:

  | model | role |
  |---|---|
  | `qwen3.5:4b` | **Preferred / "Fidelity"** — best prose, 262k ctx, vision+tools capable |
  | `llama3.2:3b` | "Balanced" step-down |
  | `qwen3:1.7b` | "Fast" step-down — referee calls, summarisation, NPC one-liners |

  **Do not hard-code a benchmark.** Speeds measured during planning on this machine
  (RTX 3070 8 GB laptop) were `qwen3:1.7b` 68.3 tok/s, `llama3.2:3b` 63.5 tok/s,
  `qwen3.5:4b` 11.2 tok/s — but the GPU was **concurrently loaded by another local-AI game**,
  which depresses the largest model disproportionately. Those numbers are not
  representative and must not be baked into the tier order.

  Instead, keep ACCORD's dynamic behaviour, which already handles this correctly:
  1. Boot-time `warmUp()` **measures real tok/s every session** and steps down
     `qwen3.5:4b → llama3.2:3b → qwen3:1.7b` only if the *measured* projected reply time
     exceeds the budget.
  2. Use a **generous latency budget** (`TARGET_REPLY_MS ≈ 12000`, not ACCORD's 2600) — this is
     a turn-based narrative game, not live conversation, and prose streams into the log as it
     arrives, so a 6–10 s DM reply is perfectly acceptable. A tight budget would wrongly
     demote the best writer.
  3. `-Model` / `DND_MODEL` **pins** a model and disables step-down, so the user can force
     `qwen3.5:4b` regardless of contention.
  4. `/api/status` re-measures every 90 s and the UI shows current tok/s, so if the other game
     releases the GPU the player can re-pick the big model without restarting.
  5. Surface a hint in the launcher when free VRAM is low: *"another GPU process is using
     N MiB — the large model may be slow; it will speed up when that frees."*
- **Dual-model mode:** a DM turn could use the *fast* model for the referee JSON call and the
  *quality* model for prose — but Ollama is pinned to `MAX_LOADED_MODELS=1`, so alternating
  would reload weights every turn. **Decision: one model per session**, chosen at setup; the
  referee call simply uses a lower `num_predict` and `temperature: 0.2`.
  *(Flagged for reviewer: is the dual-model idea worth the reload cost? Current answer: no.)*

### Copilot CLI bridge (copied, model list refreshed)

- `spawn('copilot', ['--model', M, '--disable-builtin-mcps', '--no-custom-instructions',
  '--no-color', '--no-ask-user', '--log-level', 'none', '--stream', 'off'],
  { cwd: os.tmpdir(), shell: false, windowsHide: true })`
- Prompt on **stdin**, never argv (Windows 32k argv cap; our board states are big).
- `COPILOT_MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/` — never trust a model name into argv.
- `cleanCopilotOutput()` strips ANSI, tool banners, credit/token footers, and rejoins hard wraps.
- Auth is entirely the CLI's cached login; **this codebase never sees a token.**
- Model IDs offered: `claude-opus-5`, `claude-sonnet-5`, `gpt-5.6-sol`, `gpt-5.6-terra`,
  `gpt-5.4`, `gemini-3.1-pro-preview`.
- **Never the default.** Enforced by `tests/copilot.test.js`: the first `<option>` in every
  model `<select>` must be a local model.

---

## 3. Rules engine

Target: **5e-compatible**, SRD 5.1 content, CC-BY-4.0 attributed in-app and in the README.

### 3.1 Core (`dice.js`, `rules.js`)
- Dice notation `NdM[+/-K]`, advantage/disadvantage, crit rules, reroll-on-1 (GWF),
  seeded from `js/rng.js` so any session is replayable from its seed + input log.
- Ability checks, skill checks, saving throws, contests, passive scores, group checks.
- DC bands (5 trivial → 30 nearly impossible) exposed to the DM prompt as an enum so the
  model picks a *band*, and the **engine** converts band → number. Model never sets a raw DC.
- Conditions (all 15) as machine-readable effect flags applied in combat math.
- Exhaustion, cover (½/¾/total), concentration (DC 10 or half damage), death saves.

### 3.2 Characters (`character.js`)
- Full build pipeline: race → subrace → class → subclass → background → ASI/feats →
  equipment → derived stats. Point-buy, standard array, and rolled stats.
- Levels 1–20, multiclassing supported (SRD rules), spell slots incl. Warlock pact magic.
- Recomputation is pure: `derive(sheet)` returns AC/HP max/saves/skills/attacks/slots/DCs.
  Never mutate derived values; always recompute. This makes save/load trivially correct.

### 3.3 Combat (`combat.js`)
- Grid: 5 ft squares, tokens, movement + difficult terrain, opportunity attacks.
- Initiative queue owned by the engine; the AI DM is *told* whose turn it is and cannot change it.
- Action economy: action / bonus / reaction / movement / free object interaction.
- Attacks (weapon, spell, unarmed), damage types, resistance/immunity/vulnerability,
  critical hits, temporary HP, concentration checks.
- AoE templates (sphere/cone/line/cube) with square-inclusion rules; LoS via Bresenham +
  cover determination from corner-to-corner rays.
- Death saves, stabilisation, massive damage instant death, monster morale (optional).

### 3.4 World & quests (`world.js`, `quest.js`)
- Locations graph, travel with pace + random-encounter checks, time of day, calendar.
- Short/long rests (hit dice, slot recovery, feature recharge, exhaustion reduction).
- Quest objects with objectives/flags; **relationship model**: per-NPC
  `{affinity −100..100, trust, fear, respect, knownFacts[], history[]}` updated by engine
  events, and surfaced in the journal and the export.
- Faction standing; reputation per settlement.

---

## 4. The AI Dungeon Master (`js/ai/`)

### 4.1 Turn pipeline

```
player free-text  ─┐
                   ├─► [1] REFEREE CALL (structured JSON, flat schema, temp 0.2)
game state ────────┘         │
                             ▼
                     [2] VALIDATE & REPAIR  (schema check → 2 retries → deterministic fallback)
                             │
                             ▼
                     [3] ENGINE RESOLVES  (dice, checks, damage, state changes)  ◄── authoritative
                             │
                             ▼
                     [4] NARRATOR CALL (free prose, temp 0.85, given the engine's results)
                             │
                             ▼
                     [5] POST-PROCESS (strip stage directions/asterisks, trim to sentence)
                             │
                             ▼
                     [6] COMMIT to state + log + memory ledger
```

**Why this order matters:** my probe of `qwen3.5:4b` (see `_source/`) showed the classic
failure — asked to narrate a search, it described *finding a chest* **and then** asked for the
check. Narrating the outcome before the roll destroys player agency. Phase 1 may only
describe up to the point of uncertainty; phase 4 gets the resolved result and narrates it.

### 4.2 Referee schema (flat, enum-heavy — deliberately small)

```json
{
  "intent":  "attack|cast|move|skill|talk|search|item|rest|travel|other",
  "actor":   "<seat or character id, from an enumerated list>",
  "target":  "<id from an enumerated list, or empty>",
  "ability": "str|dex|con|int|wis|cha|none",
  "skill":   "<one of the 18, or none>",
  "difficulty": "trivial|easy|medium|hard|very_hard|nearly_impossible|none",
  "spell":   "<spell id from the actor's known list, or empty>",
  "item":    "<item id from the actor's inventory, or empty>",
  "plausible": true,
  "refuse_reason": ""
}
```
Seven-to-ten flat fields, every string constrained by `enum` built **live from the current
game state** (only the actor's actual spells/items/valid targets appear). This is what makes
a 1.7B model reliable, and it means the model cannot name a spell the character doesn't have.

### 4.3 Narrator call
Free text, `num_predict` ≈ 220, given: scene, engine results (roll totals, hit/miss, damage,
state deltas), NPC voice cards for anyone speaking, and a stage-direction block:

```
[STAGE DIRECTION — perform this; never restate or quote it]
scene: Mirror Abbey causeway, dusk, rain
whose turn: Shen Cooper
what happened (already resolved, narrate it as fact):
  - Shen rolled Investigation 17 vs DC 15 — SUCCESS
  - discovered: the votive candles are all lit from the inside
tone: quiet dread, no combat yet
length: 2 short paragraphs, max 120 words
you MAY reveal: the candles detail
you must NOT: name the Hollow King; reveal the Third Seal's location; speak as Shen
```

### 4.4 Disclosure gate (the secret-keeping engine)
`campaigns\shen_cooper_bible.js` stores every secret as
`{ id, text, revealWhen: <predicate on game state>, revealedAt: null }`.
Each turn, `prompt.js` includes **only** secrets whose predicate is satisfied. Unsatisfied
secrets are literally absent from the prompt. This is the "gate by omission" principle and
it is also what lets the built-in campaign preserve its planned reveals.

### 4.5 Memory & context budget (target ≤ 7k tokens for local models)
| Layer | Budget | Eviction |
|---|---|---|
| System dossier (world, tone, rules-of-authority) | ~700 tok | never |
| Structured state block (party HP, scene, active effects, quests) | ~450 tok | refreshed, never evicted |
| Entity ledger (NPCs met, facts known, relationships) — retrieved subset | ~500 tok | relevance-ranked |
| Rolling summaries (scene → session → arc) | ~700 tok | oldest first |
| Raw recent turns | remainder (~10–15 exchanges) | sliding window |

Summarisation runs every 6 exchanges as a separate cheap call (fast model, temp 0.2) and
writes to the ledger. Retrieval is keyword + recency scoring (no embeddings needed at this
scale, and it keeps the app dependency-free).

### 4.6 Offline narrator (`offline.js`)
Deterministic templated prose keyed on `(intent, outcome band, scene tags)`, drawing on the
engine's actual numbers. Not as good, but complete: **the game is 100% playable with no AI.**
This also gives the test suite a fast, deterministic path.

---

## 5. Seats: 1–4 players, human or AI

```js
seat = {
  id: 'p1',
  name: 'Shen Cooper',
  characterId: 'shen',
  control: 'human' | 'ai',
  agent:   { backend: 'copilot'|'ollama', model: 'claude-opus-5', persona: '...' } | null
}
```

- **1 player:** the DM voices *everything* else — companions, NPCs, monsters. Companions get
  voice cards and act on their own turns via a lightweight companion policy + DM prose.
- **2–4 players:** each seat is independently human or AI. Any mix is legal
  (e.g. 1 human + 3 Copilot models, or 4 humans, or 4 AI).
- **AI seat loop** (adapted from ACCORD's "Watch AI"): the engine enumerates *legal moves*
  for that seat's turn; the model receives board state + numbered move list and returns
  `{"move": <index>, "args": {...}, "thinking": "..."}`; `applyChoice()` validates the index
  and dispatches through **the same functions a human's click calls**. The model can never
  touch state. Permanently-refused moves are remembered per-run so the model isn't offered
  the same dead move forever.
- AI seats may *also* submit free-text roleplay, which goes through the normal DM pipeline —
  so an AI player can talk in character, not just pick mechanical moves.
- **Turn management:** in combat, strict initiative; out of combat, a "spotlight" counter per
  seat is injected into the DM prompt to nudge fair narrative attention, and inputs from
  non-active seats are queued with an acknowledgement.
- **Local multiplayer model:** all seats share one browser (hot-seat) *and* the server exposes
  the same state so additional browsers can join by seat id. Hot-seat is the shipped default;
  no accounts, no auth, localhost only.

---

## 6. Procedural 2D art (`js/gen/`)

Technique from ACCORD's `art.js`, extended. Everything is a **seeded genome → layered
Canvas2D primitives → cached offscreen canvas**. Zero image files.

- `shade(hex, amt)` derives every light/dark tone from one base colour.
- **Portraits** (`portrait.js`): backdrop gradient → vignette → shoulders/armour silhouette
  (chosen by class `visual.silhouette`) → neck → head shape (race-driven enum) → hair →
  eyes/brow/mouth positioned proportionally, with a live `mood` parameter → race features
  (dwarf beard, elf ears, tiefling horns, dragonborn snout, orc tusks) → class emblem.
- **Creatures** (`creature.js`): silhouette-first. Bilateral-symmetry procedural fill for the
  body mass (the "space invader" algorithm from the research), then additive feature layers
  (`horns`, `wings`, `tail`, `carapace`, `tentacles`, `glow`) from the monster's `visual`
  block, then a 2-tone shade pass. Size class scales the token.
- **Items** (`icon.js`): geometric primitives per `iconShape` (sword = blade rect + crossguard
  + pommel; potion = ellipse + neck + stopper …), tinted by rarity palette, optional glow for
  magic items. Rendered once into an offscreen atlas.
- **Environments** (`scene.js`): layered parallax bands (sky gradient → horizon → mid terrain →
  foreground silhouette) driven by a biome genome + time of day + weather. Used as the log
  panel's backdrop so scenes visibly change.
- **Battle tokens** (`tokens.js`): circular token = creature sprite clipped to a disc + ring
  coloured by allegiance + condition pips.

Every data entry (race, class, monster, item, location) carries a `visual` block precisely so
these generators have real input rather than guesses.

---

## 7. The Shen Cooper campaign

Ported from `_source/CANON_DOSSIER.md` (98 KB, extracted from the user's four source docs).

- `campaigns\shen_cooper.js` — public canon: Shen's level-3 Oath of Devotion sheet, the
  companions (Sir Aldren Vey, Dame Mara Thorne, Brother Corvin Hale, Sister Elowen Veyra…),
  NPCs, locations (Dunmere, Wrenford, Saint Orien's Watch, Redwater Crossing, Blackharrow
  Keep, Glass Fen…), factions (Order of Aurelion, Veiled Witnesses, Vigils of Orien, House
  Marrowen, Lantern Kin), items (Father's Blade, Warden's Steel fragments, the Binding Chain,
  the Cooper relic box), and the **exact save-state** at the end of the records: mid-
  investigation in the Glass Fen, Mirror Abbey not yet entered.
- `campaigns\shen_cooper_bible.js` — DM-only: the Hollow King's true nature, Malrec Sorn,
  Seraphine Marrowen as the real Saint Orien thief, Archivist Oren Pell, the Warden's
  lifespan price, the Keeper heritage reveals — each with a `revealWhen` predicate.
- **Hard canon** flags from the bible are loaded as immutable facts the DM prompt always
  contains and the engine refuses to contradict.
- The DM **voice/style guide** section of the dossier is distilled into the campaign's
  system prompt so the AI DM writes in the same register the user is used to.
- "Continue Shen's campaign" starts from the save-state; "Start Shen from Chapter I" replays.

Also `campaigns\sandbox.js`: a procedural campaign generator (region, settlements, factions,
a 3-act quest spine, antagonist, dungeon) for brand-new games.

---

## 8. Testing plan

Plain-node scripts, `ok()` counters, exit code matters, `&&`-chained in `npm test`.

| Suite | Covers |
|---|---|
| `data.test.js` | SRD data integrity, ids, cross-references, minimum counts, `visual` blocks |
| `dice.test.js` | notation, adv/dis, crits, seeded reproducibility, distribution sanity |
| `character.test.js` | build/derive/level-up/multiclass, AC & HP & slot correctness vs known-good fixtures |
| `combat.test.js` | initiative, attack math, damage typing, AoE inclusion, LoS/cover, death saves |
| `rules.test.js` | conditions, exhaustion, concentration, rests |
| `schema.test.js` | referee schema validation + repair of deliberately malformed model output |
| `prompt.test.js` | **disclosure gate: an ungated secret never appears in a built prompt** (critical) |
| `memory.test.js` | context budget never exceeds cap; summarisation preserves key entities |
| `agent.test.js` | legal-move enumeration, index validation, refusal memory, no state mutation |
| `campaign.test.js` | Shen canon loads, sheet derives to the canon numbers, save-state valid |
| `save.test.js` | round-trip fidelity, migration, digest completeness |
| `export.test.js` | export contains dialog, items, relationships, sheets, quests |
| `copilot.test.js` | CLI arg lockdown, output cleaning, **Copilot never the default** |
| `art.test.js` | every race/class/monster/item renders without throwing (node-canvas-free: stub ctx) |
| `browser.test.js` | puppeteer-core: boot, create character, play a scene, run combat, export |
| `ai-live.test.js` | (manual) real Ollama: schema compliance rate over N turns |

Plus harnesses (not pass/fail gates): `playtest.js` (headless AI-vs-engine soak),
`bench.js` (model speed/quality), `shots.js` (screenshots).

---

## 9. Playtest programme (the user's acceptance criteria)

1. **Playtest A — Shen Cooper solo.** A Copilot model (`claude-opus-5` or `gpt-5.6-sol`)
   occupies seat 1 as Shen. Run a substantial number of turns. Verify: dialogue makes sense,
   canon is respected, secrets don't leak early, combat resolves correctly, companions feel
   distinct. Feed the transcript back into fixes.
2. **Playtest B — fresh 1-player game.** New procedural campaign, AI-driven seat, then
   **export** and verify the export contains: full transcript/dialog, every character sheet,
   inventory + gold, relationships + faction standing, quests, world state, and combat log.
3. **Playtest C — 4-seat game.** All four seats Copilot-driven (a party of four distinct
   characters), DM local or Copilot. Validates turn queue, spotlight fairness, initiative
   across seats, per-seat inventories, and party-level mechanics.

Each playtest writes to `exports\` and its findings feed a fix pass before the next.

---

## 10. Build order (dependency-ordered)

1. SRD data files + `data.test.js`  *(in progress, delegated)*
2. `rng.js`, `dice.js` + tests
3. `character.js`, `rules.js` + tests
4. `state.js`, `save.js`
5. `server.js`, `start.ps1`/`stop.ps1`, `index.html` shell → **first runnable page**
6. `gen/art.js` + portrait/creature/icon/scene → visual smoke page
7. `ai/backend.js`, `schema.js`, `prompt.js`, `offline.js` → **playable with offline DM**
8. `ai/dm.js`, `memory.js`, `npc.js` → playable with local AI DM
9. `combat.js` + `ui/battle.js` → combat loop
10. `ui/*` full UI, seats, journal, inventory
11. `ai/player_agent.js` + `ui/watch.js` → AI seats
12. `campaigns/shen_cooper*.js` + `worldgen.js`
13. Test suite completion
14. Playtests A → B → C with fix passes
15. README/docs

---

## 11. Known risks & mitigations

| Risk | Mitigation |
|---|---|
| Small model ignores the schema | Ollama JSON-Schema `format`, flat/enum-only fields, 2 repairs, deterministic fallback |
| Model narrates outcomes before the roll | Two-phase turn; referee call's schema has **no narration field at all** |
| Model leaks campaign secrets | Disclosure gate by omission; `prompt.test.js` asserts it |
| Model speaks as the player character | Explicit forbid + post-process filter that drops lines attributed to a player-controlled character |
| Context overflow in long campaigns | Layered memory + rolling summarisation + hard token budgeter with tests |
| Large model slow when the GPU is shared with another local-AI app | Measure per session rather than hard-coding; generous 12 s reply budget; stream tokens into the log; `-Model` pin to override; re-measure every 90 s and show tok/s + free-VRAM hint in the UI |
| Copilot CLI cost | Full agentic lockdown flags (measured 10× reduction in ACCORD), warm-up call, never default |
| Orphaned `llama-server.exe` eats VRAM | `sweepOrphanRunners()` + `killTree()` on boot and shutdown |
| Copyright | SRD 5.1 only, CC-BY-4.0 attribution shipped in-app and README; no Product Identity; all art procedurally generated |
| Scope | Build order is dependency-ordered and each step ends in something runnable |

---

## 12. Explicit questions for the reviewer

1. Is the two-phase (referee → engine → narrator) turn the right call versus a single
   tool-calling loop? Ollama reports `tools` capability on all three bundled models.
2. Is dropping the dual-model idea (fast referee + quality narrator) correct given
   `OLLAMA_MAX_LOADED_MODELS=1`? (Note: the user's GPU is currently shared with another
   local-AI game, so measured speeds are temporarily depressed and must not drive a
   hard-coded tier order — the design must re-measure per session.)
3. Is hot-seat the right multiplayer default, or should real multi-browser sync be first-class?
4. Is the seat/agent abstraction sufficient for "AI plays a human seat" *and* "DM plays all
   NPCs" without the two paths diverging?
5. Anything in the build order that will bite us — particularly, is building combat at step 9
   too late given the AI DM at step 8 will want to start fights?
6. Is the disclosure-gate design airtight enough to preserve the Shen campaign's reveals?
