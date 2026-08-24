# AETHERTABLE — HTML5 2D D&D Simulator
## Design & Implementation Plan — **v2 (post-review)**

**Location:** `D:\CLI\D&D Simulator`
**Stack:** Plain browser JS (no build step, no framework, no bundler) + Node HTTP server.
**AI DM:** bundled local Ollama by default; GitHub Copilot CLI models optional.
**Players:** 1–4 seats, each independently human-typed or driven by an AI model.

> **What changed from v1.** Two independent reviews (a design review and a 5e-rules/LLM
> review) found eight blockers between them. v1 is archived at `docs/PLAN_v1.md`. The
> substantive changes: a versioned `GameCommand` + immutable event log with atomic commit and
> undo; family-specific referee schemas instead of one universal schema; a per-observer
> knowledge model replacing the boolean disclosure gate; three-layer
> `derive(base, progression, runtime)`; a data-driven AC contribution model; a new
> `effects.js`; a much larger spell `mech` vocabulary including `concentration`; structured
> monster actions; controllers instead of seats; hot-seat only; and a build order that reaches
> a **playable Shen vertical slice** before any content volume.
> The rules review is archived at `_source/REVIEW_RULES.md`.

---

## 0. Guiding principles

1. **The engine owns the rules. The LLM owns the prose.** The model never rolls, never decides
   hit/miss, never sets HP, never grants an item, never fixes a DC. It *proposes* (structured,
   validated) and it *narrates* (free text, over an already-committed event batch).

2. **Two-phase turn: Referee → Engine → Narrator.** Affirmed by both reviewers over a single
   tool-calling loop: 1.7–4B models are unreliable multi-turn tool callers, and a loop makes
   call counts unbounded and replay harder.

3. **Nothing is knowledge until an observer has it.** There is no global "what the player
   knows" flag. There is objective world truth, and there is a per-observer knowledge store.
   Every prompt and every AI observation is built through `getObservation(observerId)`.

4. **Commit mechanics atomically, then narrate.** Rolls happen once, into a pure event batch
   computed from a snapshot; the batch is committed atomically; only then is it narrated. If
   narration fails, retry the *narration* — never the rolls.

5. **Everything degrades, nothing crashes.** No Ollama → deterministic offline narrator over
   menu-driven actions. Bad JSON → semantic validation → one repair → deterministic intent
   parser. Copilot missing → local model.

6. **Zero binary assets.** All art is procedurally drawn on canvas from seeded genomes.

7. **Automatable.** Every action an AI seat can take goes through the identical validated
   command dispatcher a human click uses. Exports are written server-side so unattended
   playtests work.

8. **SRD 5.1 only, CC-BY-4.0 attributed.** No Product Identity. Homebrew is separately
   exported and explicitly labelled — never attributed to the SRD.

9. **Edition: D&D 5th Edition, 2014 ruleset.** Confirmed by the user, and consistent with the
   Shen Cooper campaign records, which were played on 2014 rules. SRD 5.1 *is* the 2014
   ruleset; the 2024 revision is SRD 5.2 and is **not** used here. Concretely this means:
   the 2014 conditions list, 2014 spell text and spell lists, subclass timing by class
   (Cleric/Sorcerer/Warlock 1, Wizard 2, most others 3), Ranger/Beast Master as printed in
   2014, the 2014 exhaustion ladder (six levels, each with distinct effects — *not* the 2024
   flat −X), 2014 stealth/hiding, and no weapon mastery, no 2024 background feats, no 2024
   revised species traits. Where a rule differs between editions, the 2014 wording governs
   and the test asserting it cites the 2014 behaviour.

---

## 1. Core abstractions (build these first)

### 1.1 `GameCommand` — the only way state ever changes

```js
{
  v: 1,                       // schema version
  commandId: 'cmd_...',       // idempotency key; a duplicate is ignored, not re-applied
  sessionId, stateRevision,   // revalidated immediately before commit
  turnEpoch,                  // a stale model response cannot mutate a newer turn
  actorId,
  family: 'combat'|'movement'|'spell'|'item'|'social'|'exploration'|'improvised'|'meta',
  primary:  { ...family-specific... },
  followUp: { ...family-specific... } | null,   // bounded: one follow-up, not a script
  condition: '',              // "if the door opens" — becomes a readied action
  goal: '',                   // what the player is actually trying to achieve
  utterance: '',              // the player's original words, preserved verbatim
  needsClarification: false,
  clarificationQuestion: ''
}
```

Human clicks, human free text, AI player seats, companion policies and NPC policies **all**
produce a `GameCommand`. There is exactly one dispatcher and one validator.

Mechanical UI actions and AI legal-move choices **bypass the referee entirely** — they are
already structured. The referee exists only to turn *free text* into a command.

### 1.2 Event log — the source of truth

`resolve(snapshot, command) -> EventBatch` is **pure**: it rolls dice (from the seeded RNG),
computes every consequence, and returns events without mutating anything.
`commit(batch)` applies them atomically and bumps `stateRevision`.

State is a fold over the event log. That gives checkpoint/undo/rewind for free, makes
save/load exact, and makes "narration crashed" a non-event.

### 1.3 Observer knowledge

```
worldTruth          objective facts, never shown directly to anything
partyKnown          facts the party has collectively established
knowledge[seatId]   what this character knows (may differ between party members)
knowledge[npcId]    what this NPC knows — NPCs are not omniscient
```

Secrets are **atomic claims** with provenance and staged visibility, not one large text blob:

```js
{ id:'warden.price', claim:'The Warden takes a day of life for each awakening.',
  stage: 'hinted'|'partial'|'full', revealWhen: fn(state), provenance:'...', seenBy:[] }
```

`getObservation(observerId)` returns everything that observer may perceive — and is the
**only** input to prompt building, AI-seat board state, journals and exports. Enumerated
target lists come from it too, so a hidden creature cannot appear in a target enum.

Summaries may consume **only committed, observer-visible events**, and are written to a
disposable cache — never into the authoritative fact ledger. That closes the "a leak becomes
permanent" path.

### 1.4 Controllers (replacing v1's seat/agent conflation)

```js
controller.kind = 'human' | 'playerAI' | 'companionPolicy' | 'npcPolicy'
```

All controllers emit the same validated `GameCommand`; they differ in **observation** and
**authority**. A seat models ownership and privacy; a controller models who decides. NPCs and
companions are controllers, not seats.

Routine companion and NPC tactics resolve **deterministically** (a policy, not a model call) —
this is what keeps a four-seat combat round from needing a dozen serial inferences.

---

## 2. Directory layout

```
index.html   server.js   package.json   start.ps1/.cmd   stop.ps1/.cmd   install-ai.ps1/.cmd
css\style.css
js\
  rng.js                        seeded, serialisable                          [DONE]
  engine\
    dice.js                     notation, adv/dis, crits, damage modifiers    [DONE]
    command.js                  GameCommand schema, validation, dispatcher
    events.js                   event types, resolve(), commit(), fold
    effects.js                  active effects: durations, save-ends, concentration, stacking
    character.js                derive(base, progression, runtime); AC contribution model
    rules.js                    pure adjudication primitives (checks, saves, contests, DC bands, cover)
    combat.js                   stateful turn loop, action economy, reactions, AoE, LoS
    world.js                    locations, travel, time, rests, encounters (incl. lair actions)
    quest.js                    quests, flags, relationships, factions
    knowledge.js                world truth, per-observer stores, getObservation()
    loot.js                     treasure by CR + party level
    state.js                    the game-state object + checkpoint/undo/rewind
    save.js                     serialize/deserialize/digest/migrate
  data\      srd_*.js  names.js
  ai\
    backend.js                  one interface over {offline, ollama, copilot}; pinned num_ctx
    schema.js                   per-family referee schemas, live enums
    referee.js                  free text -> GameCommand, validate, repair, deterministic fallback
    narrator.js                 committed events -> prose, with programmatic quality gates
    prompt.js                   system (immutable) vs per-turn block (dynamic + authorized secrets)
    memory.js                   event-log retrieval, disposable summaries, token budget
    npc.js                      voice cards, companion policy, NPC policy
    player_agent.js             AI player seat: observation + legal moves -> index choice
    offline.js                  deterministic narrator + menu-driven play
  gen\       art.js portrait.js creature.js icon.js scene.js tokens.js worldgen.js
  ui\        app.js setup.js sheet.js party.js log.js battle.js map.js inventory.js journal.js watch.js
campaigns\   shen_cooper.js  shen_cooper_bible.js  shen_continuation.js  sandbox.js
tests\  exports\  docs\  _source\
```

---

## 3. Rules engine — corrections from review

### 3.1 Three-layer character model (blocker fix)

`derive(sheet)` was wrong. Correct model:

| Layer | Contents | Serialised |
|---|---|---|
| **base** | race, subrace, class, subclass, background, base ability scores, proficiencies | yes |
| **progression** | per-level HP (rolled *or* average — the actual number, stored), ASI/feat picks, spells learned, subclass choice; append-only | yes |
| **runtime** | current HP, temp HP (takes-highest, never additive), expended slots/hit dice/ki/rage/channel/superiority/sorcery/lay-on-hands, conditions, exhaustion 0–6, concentration target, attuned (max 3) + equipped, current-abilities overlay (Feeblemind *sets*, Shadow *drains*), active-form overlay (wild shape/polymorph), death saves, inspiration | yes |

`derive(base, progression, runtime, activeEffects)` is pure and recomputes max HP, AC,
save/attack/skill bonuses, spell save DCs and **maximum** slots. Save/load stays exact:
serialise layers 1–3 plus effects, recompute layer 4.

Raising Con retroactively adds HP **per character level**. That falls out of the model for free.

### 3.2 AC contribution model (blocker fix)

No special cases. Every armour, feature, spell and item emits contributions:

```js
{ type:'base'|'add'|'set'|'floor', value: number | fn(abils, equip),
  requires: fn(ctx), source:'mage_armor' }
```

Resolution: (1) gather every **base** whose `requires` holds — worn armour
`base + min(dexMod, maxDex)`, unarmoured `10+dex`, Barbarian `10+dex+con`, Monk `10+dex+wis`,
Mage Armor `13+dex`, natural armour — and take the **maximum**; (2) sum every **add** (shield
+2, Defense style +1, Ring/Cloak of Protection +1, *Shield* +5 while active, cover +2/+5);
(3) apply **set**; (4) apply **floor** (`Barkskin` → `max(computed, 16)`).

Cover contributes to **AC and Dexterity saves only** — not other saves.

### 3.3 `effects.js` (blocker fix — previously homeless)

Owns active-effect instances `{id, source, target, kind, magnitude, appliesTo, duration,
saveEnds, concentrationId}` plus tick/expiry and the stacking rules:

- advantage/disadvantage never stack (presence only, and they cancel);
- temp HP takes the highest, never adds;
- same-named effects do not stack;
- **concentration**: one at a time, casting a new one ends the old; damage forces a Con save
  at `max(10, floor(damage/2))`; incapacitation, unconsciousness or death ends it.

Most of the combat correctness checklist traces back to this module existing.

### 3.4 Action economy & reactions (blocker fix)

Explicit per-turn flags: action / bonus / reaction / free object interaction / movement
remaining. One reaction per round; *Shield* and readied actions consume it; opportunity
attacks trigger on leaving reach without Disengage.

### 3.5 Spell `mech` vocabulary (blocker fix)

Extended to include `concentration`, `ritual`, `castTime` (+ `reactionTrigger`), components
with material cost/consumption, and an **`effects[]` array** whose entries may be `attack`,
`save` (with `saveEffect: half|negates|partial` and `saveRepeat`), `heal`, `temp_hp`, `area`
(persistent/movable, `damageOnEnter`, `damageOnStartTurn`, difficult terrain), `modifier`
(Bless/Bane/Guidance), `ac` (set/add/floor), `forced_movement`, `hp_pool` (Sleep),
`hp_threshold` (Power Word Kill), `summon`, `condition` (with escape DC), and `narrative`.

`cantripScaling` (by character level) is kept distinct from `scaling` (per slot, and per
`mode: damage|targets|duration|summons` — Fireball vs Magic Missile differ).

**Narrative spells** (Wish, Divination, Commune, Scrying, Plane Shift, Simulacrum, Gate) do not
give the model a blank cheque: the engine applies the concrete parts and hands the narrator a
**menu of allowed outcomes drawn from the knowledge model**. Divination and Commune answers are
*generated by the engine* from gated facts and merely narrated.

### 3.6 Monster action shape (blocker fix)

Structured `multiattack.sequence`, `recharge:[5,6]` rolled at turn start, `legendaryActions
{perRound, options}` spendable at the end of other creatures' turns, `legendaryResistance`
counter, innate-vs-prepared `spellcasting`, conditional `traits` (Pack Tactics, Magic
Resistance, Regeneration), and machine-readable resistances/immunities/condition-immunities/
saves/senses. **Lair and regional effects live on the encounter/location at initiative 20**,
not on the statblock.

### 3.7 Feats — licensing correction (blocker fix)

**SRD 5.1 contains exactly one feat: Grappler.** Shipping invented feats as SRD content would
break the CC-BY-4.0 attribution. Decision: **ASI-only by default**, with `HOMEBREW_FEATS`
exported separately, explicitly labelled `source:'homebrew'`, and off unless enabled at setup.

### 3.8 Other progression correctness
`subclassLevel` is per class (Cleric/Sorcerer/Warlock 1, Wizard 2, most others 3) — never
hard-coded. `casterType: full|half|pact|none`; **Warlock pact slots are a separate pool and are
never summed into the multiclass table**. `prepares: prepared|known|spellbook` modelled
distinctly. Per-level HP stored as the actual number.

---

## 4. The AI layer — corrections from review

### 4.1 Pipeline (rollback semantics fixed)

```
1 PARSE      free text -> deterministic patterns; escalate to the model ONLY if unsure
2 CLARIFY    ambiguous or high-impact readings ask the player before committing
3 RESOLVE    pure: snapshot -> EventBatch (all dice roll here, exactly once)
4 COMMIT     atomic; stateRevision bumps; automatic checkpoint taken beforehand
5 NARRATE    prose over the committed batch; failure retries NARRATION only, never the rolls
6 GATES      programmatic quality checks; fall back to offline prose rather than reroll
```

Undo/rewind is branch-aware. Every pending model request carries a `turnEpoch` and is
discarded if it returns stale.

#### Deterministic-first parsing — a v2.1 correction, from measurement

The original plan sent every player utterance to the model and used the pattern table only
as a fallback. `tests/live-dm.js` run against `qwen3:1.7b` showed that to be backwards:

| | model-first | deterministic-first |
|---|---|---|
| referee accuracy | **38%** (3/8) | **100%** (8/8) |
| median latency | **7138 ms** | **1 ms** |
| model calls per 10 inputs | 10 | 3 |

The model turned "I end my turn" into `escape_grapple` and "I search the lantern housing"
into `cast command`, while a regex reading "search" was simply correct and instant. So the
ordering is inverted: a **confident** pattern match (objects all resolved, no compound
clause) is authoritative and makes no model call at all. The model is reserved for what
patterns genuinely cannot do — novel phrasing, compound actions, improvisation — which is
also the only place its judgement is worth several seconds.

This is the "engine owns the rules" principle applied one level further out: parsing common
intent is a solved deterministic problem, and spending a 4B model on it bought nothing but
latency and errors.

#### Narration tuning, also from measurement

The same run showed the model inventing events not in the batch ("it takes hit after hit"
from a single hit), opening three turns running on the weather, and reusing "is holding its
breath" across turns. Fixed by: an explicit "describe ONLY the events listed" instruction; a
**sentence** cap rather than a word cap, placed last in the prompt where small models weight
it most; `num_predict` cut 320 → 200; a `tired_opening` gate; and a repeated-four-word-run
detector to catch phrase reuse the aggregate n-gram score missed. Re-measured: **100% clean,
0 gated, 0 fallbacks.**

### 4.2 Family-specific referee schemas (blocker fix)

v1's single flat schema could not express compound actions, grapple/shove/Help/Dodge/Hide/
Ready, AoE origins, multiple targets, upcasting, improvisation, or social intent — and it let
the model pick the DC band, which is a rules decision.

Now: **classify first, then use a small schema per family.** `target`, `spell` and `item` are
**true enums built live from the observation** (legal ids plus an explicit `""`), so constrained
decoding makes an illegal choice literally unrepresentable. Social commands carry
`proposition/goal/approach/leverage/truthfulness/audience`; improvised commands carry
`desiredOutcome/method/objectsUsed/resourcesRisked`. The **engine** picks the check, the action
cost and the DC; the model may propose an adjudication recipe and the engine clamps it.
Illegal later steps are never silently dropped — resolve the legal prefix, or ask.

### 4.3 Prompt structure (cache + leak correctness)

**System prompt (immutable, KV-cache-stable):** identity, tone, rules-of-authority, and
*currently-revealable* campaign canon only.
**Per-turn appended block:** all dynamic state, the stage direction, and **any authorized
secrets** — gated secrets must never sit in the system prompt, both because they grow as
predicates unlock (busting the cache) and because it is architecturally the wrong place.

One `num_ctx` is **pinned for referee, narrator, summariser and `warmUp()` alike** — a mismatch
makes Ollama reload the runner between the two calls of every single turn.

### 4.4 Latency (reframed around TTFT)

Because narration streams, perceived latency is **time to first token**, not total completion.
Step-down is judged on TTFT (target < 2 s), with the referee budgeted separately
(non-streaming, `num_predict` 32–64, temp 0.2). `TARGET_REPLY_MS` stays generous.

**`MAX_LOADED_MODELS=2` is worth revisiting**: `qwen3:1.7b` (~1.7 GB) + `qwen3.5:4b` (~3.5 GB)
≈ 5.2 GB fits in 8 GB, which would remove the reload objection to fast-referee +
quality-narrator. Gate it on measured free VRAM; default stays single-model.

### 4.5 Prose quality gates (programmatic, not instructions)

- reject `/as an ai|language model|as a large/i` → one regeneration, then offline prose;
- drop quoted dialogue attributed to any **player-controlled** character (name injected
  dynamically);
- **forbidden-name redaction**: if the stage direction says "must not name X" and X appears,
  redact or regenerate — turning a soft instruction into a hard gate;
- engine-computed **intensity band** ("how hot to play it"), because small models max out any
  bare mood word;
- n-gram overlap and repeated-sentence-opener detection against recent turns → regenerate;
- hard `num_predict` cap plus an explicit word cap; narrator temp ~0.7 with
  `repeat_penalty` ~1.1; `<think>` stripped unconditionally;
- an exposed `seed` so test transcripts are reproducible.

### 4.6 Memory
Immutable event log is authoritative. Retrieval is **structured** — by entity id, alias, quest,
location and causal link — not bare keyword+recency. Summaries are a disposable cache.
Unresolved promises, secrets and relationship changes are **pinned**. Embeddings only if
structured retrieval demonstrably fails.

### 4.7 Inference budget
One action must not cost a dozen serial calls. Mechanical choices skip the referee; companion
and NPC tactics are deterministic policies; narration batches meaningful beats rather than
every attack; a simultaneous exploration batch gets **one** narrator call. A prioritised
inference queue supports cancellation and stale-response rejection.

---

## 5. Seats and multiplayer (scope corrected)

**Hot-seat only, browser-authoritative state.** v1 promised multi-browser join while listing no
session/state/sync API — internally contradictory. Multi-browser is explicitly **deferred**;
if it is ever added it needs server-authoritative state, WebSocket transport, seat-claim
tokens, state revisions and reconnect snapshots, which is a different product.

1–4 seats. Each seat is independently `human` or `playerAI` (any mix). In a one-player game the
DM voices everything else, with companions on deterministic policies plus DM prose. In combat,
strict initiative. Out of combat, the hot-seat MVP uses **explicit sequential spotlight turns**
rather than a spotlight counter pretending to be a concurrency model.

---

## 6. Procedural 2D art

Seeded genome → layered Canvas2D primitives → cached offscreen canvas; a single `shade()`
helper derives every tone. Portraits (race/class-driven silhouette, head shape, features),
creatures (silhouette-first with bilateral-symmetry mass then additive feature layers), item
icons (geometric primitives per `iconShape`, rarity-tinted, atlas-cached), environments
(parallax bands by biome/time/weather) and battle tokens.

Per review, elaborate art is **deferred**: the vertical slice ships placeholder vector tokens,
and the full generators land once the game is playable.

---

## 7. The Shen Cooper campaign (overclaim corrected)

v1 claimed the dossier gives an "exact" save-state. It does not: Shen's own resources are
exact, but companions have approximate power bands and qualitative relationships, and the true
endpoint includes the Six-Witness Protocol and the completed Sells-family experiment.

So the continuation is a **hand-authored fixture** (`campaigns/shen_continuation.js`) recording:
exact scene endpoint and transcript recap; party and location; every publicly known clue **with
provenance**; the Six-Witness Protocol; current quests and promises; companion relationship
history and voice state; per-NPC knowledge; gear damage/history; active uncertainties that must
*remain* uncertain; and every resource value explicitly tagged `canon` | `derived` |
`author-assigned`.

Validation is a scripted 10–20-turn continuation test, not merely "the campaign loads".

---

## 8. Build order (rewritten — vertical slice first)

1. `rng.js` ✔, `dice.js` ✔, `command.js`, `events.js`, `knowledge.js`, save versioning
2. Minimal content: Shen, his active companions, and only what Glass Fen needs
3. `rules.js`, `character.js` (three-layer), `effects.js`, narrow `combat.js`
4. `state.js` + `save.js` + checkpoint/undo
5. Minimal UI: log, sheet, party, grid combat view
6. Load the Shen continuation fixture
7. Offline menus + templated narration → **complete a deterministic encounter with no AI**
8. `referee.js` + knowledge gating + `narrator.js` against a **fixture backend**
9. Local model live; Shen continuity tests
10. One AI player seat
11. Expand SRD content, character creation, spells, art incrementally
12. Playtests A → B → C
13. Deferred: worldgen, network multiplayer, elaborate art, full 1–20 progression

The essential first product: **resume Shen at the Glass Fen, take coherent actions, survive a
deterministic combat, preserve secrets and relationships, save/undo/reload, and produce
narration that contradicts neither the engine nor canon.**

---

## 9. Testing

Plain-node scripts, `ok()` counters, exit codes, `&&`-chained in `npm test`.

**Determinism:** a **fixture backend** replays recorded model responses, so the whole
referee → engine → narrator pipeline is testable end-to-end without a model. Live-model runs
are a separate, thresholded rubric battery with model and prompt versions pinned. Never
exact-match live prose; assert mechanical events and invariants.

Key suites: data integrity; dice; character/derive; **the 25-case rules-correctness checklist**
(advantage cancellation, crit doubles dice not modifiers, resistance/vulnerability ordering,
temp-HP non-stacking, concentration DC, death saves, massive damage, surprise, reaction
economy, two-weapon fighting, grapple/shove contests, AoE square inclusion, cover, AC
scenarios, multiclass slots, recharge/legendary…); command validation and idempotency;
**secret canaries traced across prompt → narration → summary → ledger → journal → export**;
per-seat and per-NPC visibility; stale/duplicate/out-of-order responses; parser fuzzing; golden
command/event snapshots; save migration fixtures; reload-during-streaming; save-during-combat;
narrator-state isolation (prose can never mutate mechanics); Copilot lockdown and
never-the-default; browser end-to-end.

**Accessibility is a requirement, not a follow-up:** keyboard control, semantic HTML
alternatives to canvas grid state, screen-reader-friendly log, scalable text, reduced motion,
high contrast, and no colour-only indicators.

---

## 10. Playtest programme (acceptance criteria)

1. **A — Shen Cooper solo.** A Copilot model plays Shen from the continuation fixture.
   Verify canon fidelity, dialogue sense, no premature reveals, correct combat, distinct
   companions.
2. **B — fresh 1-player game**, then **export** and verify it contains the full transcript,
   every character sheet, inventory and gold, relationships and faction standing, quests,
   world state and combat log.
3. **C — 4-seat game**, all seats Copilot-driven, validating turn queue, initiative across
   seats, per-seat inventories and party mechanics.

Each writes to `exports\` and feeds a fix pass before the next.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Small model ignores schema semantically | Live enums make illegal choices unrepresentable; semantic validation; one repair; deterministic parser fallback |
| Narrating outcomes before the roll | Referee schema has no narration field; narrator only ever sees committed events |
| Secret leakage | Per-observer knowledge; summaries read only visible events; canary tests across the whole chain |
| Partially applied turns / stale responses | Pure resolve → atomic commit; `turnEpoch` + `stateRevision` + idempotency keys |
| Inference cost at 4 seats | Mechanical actions skip the referee; deterministic NPC policies; batched narration; cancellable queue |
| GPU shared with another AI app | Measure per session, never hard-code tiers; TTFT-based step-down; `-Model` pin; re-measure every 90 s |
| Runner leak eats VRAM | `sweepOrphanRunners()` + `killTree()` on boot and shutdown |
| Copyright | SRD 5.1 only, CC-BY-4.0 attribution shipped; homebrew separately labelled; all art generated |
| Scope | Vertical slice first; content volume and art explicitly deferred |
