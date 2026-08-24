# AETHERTABLE — Independent Code Review

> ## Status after the fixes
>
> All **13 blockers are fixed**, each with a test that fails without the fix.
> The suite went from 3,229 to **3,380 assertions**, and the new ones exercise
> the runtime connections the review correctly identified as untested — the
> real page load, the real turn loop, the real damage pipeline.
>
> | # | Blocker | Status | Where |
> |---|---------|--------|-------|
> | 1 | Shen campaign unreachable from the page | fixed | `index.html`, `js/ui/setup.js buildShenContinuation`; test: `session.test.js` starts it through the wizard and checks AC 18 |
> | 2 | No turn loop in the browser | fixed | `js/game.js advanceTurn/endHumanTurn/turnIsSpent`; the playtest harness now calls the engine's loop instead of its own |
> | 3 | Combat resolved against AC 10 | fixed | `combat.js targetAc`; test asserts 18 with **no injected `runtime.ac`** |
> | 4 | Spell slots unlimited | fixed | `slot_spend`/`slot_restore` events; the 4th cast of 3 slots is refused |
> | 5 | `commit()` not atomic | fixed | applies to a draft, swaps on success; a failing batch leaves nothing behind |
> | 6 | Prose advanced the mechanical dice | fixed | `offline.js proseRng`; narrating three times moves the RNG zero steps |
> | 7 | Reveals never recorded | fixed | `knowledge.revealsIn` + committed `knowledge` events. This also uncovered that an **authorised** reveal was being redacted, so no secret could ever come out |
> | 8 | Hidden creatures leaked into move lists | fixed | `perceivedEnemies`; an unnoticed foe is not named anywhere in `legalMoves` |
> | 9 | Ungated text streamed to the screen | fixed | `narrator.js guardedStream`; verified against a name split character-by-character |
> | 10 | `turnEpoch` never advanced in product code | fixed | advanced by the new turn loop |
> | 11 | 0-HP, temp-HP and rest transitions broken | fixed | temp HP now depletes, healing clears death saves, and **both rest verbs used to throw** |
> | 12 | Copilot bridge could run commands | fixed | every dangerous tool denied by name, plus loopback/Origin/content-type checks — verified by probing a live server |
> | 13 | Combat actions were labels only | fixed | Dodge, Help and Hide have mechanical effect; advantage/disadvantage computed from the board and cancelling correctly; resistance, immunity and vulnerability applied |
>
> Also fixed from the SHOULD FIX list: generated casters knew **no spells at
> all**; level-up offered spells the character could not cast and validated
> only the count; the static server exposed the whole folder including
> `exports/`; and the playtest harness exited with a libuv assertion.
>
> **Known limitations, not fixed:** Ready and opportunity attacks are still
> declarative, and monster recharge and legendary actions are modelled in data
> but not driven by the turn loop. These are documented rather than quietly
> left. (Prepared casters re-preparing on a long rest *was* on this list and is
> now implemented — see js/engine/prepare.js.)

## Verdict

AETHERTABLE has unusually good design instincts, strong structured content, and a serious test/playtest culture. The character derivation layer, deterministic parser, campaign fact model, procedural art, and model-fallback strategy are all worth preserving.

The shipped browser game does **not yet satisfy its central claims**, however. The built-in Shen campaign is not loaded by the page; the browser does not run an initiative/turn loop; combat ignores derived and monster AC; most spell and combat effects are descriptive no-ops; several secrecy paths bypass observations; and the Copilot bridge permits command execution. The 3,229 assertions mostly prove isolated helpers and authored fixtures, not these runtime connections.

## BLOCKERS

### 1. The browser's “Shen Cooper — continuation” option does not load the campaign

- **Files:** `index.html:228`, `js/ui/setup.js:30-42`, `js/ui/setup.js:803-854`
- **Problem:** The page loads no campaign scripts. `DND.Campaigns` therefore does not exist, `campaigns()` falls back to three display-only definitions, and `buildSession()` only invokes real campaign setup for the sandbox. It never calls `shenContinuation.applyTo()`.
- **Observed manifestation:** Selecting the continuation in real Chrome produced campaign id `shen_continuation`, one generic actor (`pc1`), `locationId:null`, no facts, no companions, and no `DND.Campaigns`. The documented four-person Lantern's Rest save-state is unreachable from the product UI.
- **Player impact:** The flagship built-in campaign is a labelled empty shell.
- **Fix:** Load `shen_cooper.js`, `shen_cooper_bible.js`, and `shen_continuation.js` in dependency order, expose explicit campaign descriptors, and branch `buildSession()` by campaign id. For continuation, create the store, define facts, call `Continuation.applyTo(state, store)`, refresh derived stats, and pass the public campaign object to `Game.createSession()`. Add a browser test for cast, location, facts, quests, and AC.

### 2. The actual browser game has no combat/spotlight turn loop

- **Files:** `js/ui/setup.js:834-854`, `js/game.js:231-264`, `js/game.js:507-528`, `js/engine/state.js:286-289`
- **Problem:** World generation adds hostile actors but never calls `Combat.beginEncounter()` or `Combat.startTurn()`. After a committed command, `Game.applyCommand()` narrates but never advances initiative, active actor, or `turnEpoch`. `advanceUntilHuman()` recursively asks the unchanged controller to act.
- **Observed manifestation:** A real-Chrome sandbox began with three enemies but `combat.active === false`. Two consecutive Attack clicks produced revisions 1 and 2 while `activeActorId` stayed `pc1` and `turnEpoch` stayed 0.
- **Player impact:** A human can attack indefinitely; monsters do not receive product turns; mixed/AI tables stall or repeat the same actor. The headless playtest has its own separate loop, so its successful monster turns do not prove the browser.
- **Fix:** Put encounter/spotlight advancement in `Game`, not the playtest harness. Starting an encounter, ending a command, skipping dead actors, starting the next turn, advancing `turnEpoch`, checking campaign-over, and ending combat should be one authoritative orchestration path used by UI and playtests.

### 3. Real combat resolves against AC 10

- **Files:** `js/engine/combat.js:594-599`, `js/engine/state.js:188-200`, `tests/combat.test.js:27-42`
- **Problem:** `State.refreshDerived()` stores AC in `actor.derivedCache.ac`; monster AC lives on the statblock. `Combat.targetAc()` reads only `runtime.ac` and otherwise returns 10. Neither normal PCs nor world-generated monsters populate `runtime.ac`.
- **Observed manifestation:** The real Shen load derives AC 18, but `Combat.targetAc(state, 'shen')` returns 10. Combat tests hide this by constructing every target with an injected `runtime.ac`.
- **Player impact:** Armor, shields, Dexterity, natural armor, and most AC effects do not protect anyone in play.
- **Rules citation:** SRD 5.1, **Combat → Making an Attack**: an attack roll is compared to the target's Armor Class; monster AC is part of its stat block.
- **Fix:** Make `targetAc()` use current derived AC (including active effects and cover), with statblock AC for monsters. Remove the duplicate `runtime.ac` source or keep it only as an explicit override. Add real-load PC and SRD-monster attack tests with no injected AC.

### 4. Spellcasting is mostly a no-op and spell slots are unlimited

- **Files:** `js/engine/interaction.js:506-579`, `js/engine/events.js:180-187`, `js/engine/character.js:447-458`
- **Problems:**
  - Slot checks read `runtime.slotsSpent[level]`, but casting emits a generic resource named `slot1`, `slot2`, etc. The applier updates `runtime.resources`, not `slotsSpent`.
  - Casting spends no action, bonus action, or reaction and ignores `mech.castTime`.
  - Only `heal` and `temp_hp` effects are executed. Attack, save, damage, area, condition, modifier, AC, summon, forced movement, HP-pool, and threshold effects become a `note`.
  - Healing reads `spellcasting.mod`, but `Character.spellcasting()` exposes no such field, so Cure Wounds omits the casting modifier.
  - Concentration creates a marker but no sustaining effects.
- **Observed manifestation:** Sanctuary can be cast repeatedly; `slotsSpent` remains `{}` while `resources.slot1` increments. Sanctuary then has no effect on attackers. The supplied Shen combat transcript shows exactly that outcome.
- **Player impact:** The UI says spells succeeded while their rules did not happen. This is worse than an explicit “not implemented” refusal.
- **Rules citation:** SRD 5.1, **Spellcasting → Spell Slots / Casting a Spell**, plus each spell's `Casting Time`, target, save/attack, duration, and effect text.
- **Fix:** Create typed slot-spend events that update the canonical spent pools; charge the declared action type; reject invalid targets/ranges/components; implement effect handlers before advertising a spell as legal. Until then, expose only mechanically supported spells. Add exact end-to-end tests for Cure Wounds, Bless, Sanctuary, Shield, Mage Armor, Fireball, Sleep, and concentration.

### 5. `Events.commit()` is not atomic

- **Files:** `js/engine/events.js:480-502`, `tests/core.test.js:191-200`
- **Problem:** Appliers mutate the live state sequentially. If a later applier throws, `commit()` reports failure but does not revert earlier mutations. Dispatch can restore its checkpoint, but `Events.commit()` is also called directly by level-up, campaign loading, tests, and playtest orchestration.
- **Observed manifestation:** A batch containing `hp -5` followed by an unknown kind returned `{ok:false}` while the actor remained 5 HP lower.
- **Test gap:** The “failing applier” test checks only that the revision does not move; it never checks that the earlier HP mutation was rolled back.
- **Player impact:** A malformed event batch can partially alter state while being absent from the log and revision history.
- **Fix:** Apply to a cloned draft and swap on success, or have `commit()` own snapshot/restore transactionality. Validate every event and target before the first mutation. Assert full deep equality after a failed batch.

### 6. Offline prose changes future dice

- **Files:** `js/ai/offline.js:88-90`, `js/game.js:562-570`
- **Problem:** The offline narrator uses the session's mechanical RNG for wording choices. Retrying narration calls it again.
- **Observed manifestation:** Narrating the same hit twice advanced `state.rng.count` from 0 → 1 → 2 and produced different phrasing.
- **Player impact:** Choosing Offline DM, receiving a fallback, or clicking “Retry narration” changes later mechanical rolls. This directly contradicts “retry the words and the dice will not move.”
- **Fix:** Give prose a separate RNG stream keyed by session/batch/attempt, or use a non-advancing `state.rng.fork('narration:' + commandId)`. Add an invariant that narration and narration retries never change the mechanical RNG state.

### 7. The model is allowed to decide when a secret becomes true for the players

- **Files:** `js/engine/knowledge.js:99-108`, `js/engine/knowledge.js:229-232`, `js/ai/prompt.js:217-224`, `js/ai/prompt.js:391`
- **Problem:** When a reveal predicate becomes true, the full claim is placed in a `[YOU MAY REVEAL, IF THE MOMENT EARNS IT]` block. The model decides whether to reveal it. No `knowledge` event is committed when it does.
- **Player impact:** The LLM owns an information outcome, contrary to “engine owns truth.” A secret can be spoken while the ledger/journal still says nobody knows it; on the next turn it may be omitted or redacted again.
- **Fix:** `revealWhen` should make a fact eligible for an **engine-authored knowledge event**, not for model discretion. Commit the event first, then narrate that committed reveal. The narrator may choose wording, never whether the fact enters play.

### 8. Hidden information bypasses the observation layer in legal moves, narration, and exports

- **Files:** `js/engine/knowledge.js:172-177`, `js/engine/combat.js:778-806`, `js/engine/interaction.js:384-411`, `js/ai/prompt.js:369-379`, `js/engine/save.js:31-61`, `js/engine/save.js:89-162`
- **Problems:**
  - Combat and social legal moves enumerate raw `state.actors`, not the actor's observation.
  - The DM observation deliberately includes every actor; the narrator's “complete” enemy roster then lists all non-dead enemies, including hidden/unnoticed ones.
  - JSON exports serialize raw state. Markdown/digest uses raw actors, flags, relationships, effects, and logs rather than an observer-scoped view.
- **Observed manifestation:** Marking one enemy hidden from the hero still produced Attack, Grapple, Shove, Ask, Persuade, Insight, Intimidate, and Deceive moves naming it. A hidden “assassin” and a secret flag appeared in both the save and readable Markdown.
- **Player impact:** An AI seat sees the hidden id in its move list; narration can name it; exports reveal it. This defeats secrecy by omission.
- **Fix:** Require an observation/authorization object in every `legalMoves()` call and intersect targets with `targetableIds`. Build the narrator roster from party-perceivable actors. Separate a trusted full resume save from a player-readable observer export; Markdown must use `getObservation()` and event-time visibility.

### 9. Safety gates run after unsafe text has already streamed to the player

- **Files:** `js/ai/narrator.js:301-324`, `js/game.js:294-297`, `js/ui/log.js:17`, `js/ui/log.js:79-139`, `js/ui/log.js:172-176`
- **Problem:** The first model attempt streams directly to the UI. Forbidden-name redaction, player-voice removal, foreign-script removal, and meta/failure gates run only after completion. The log uses one global `active` entry for all streams.
- **Player impact:** A secret or forbidden player line is visible before being replaced. Overlapping narrations can write tokens into the wrong turn and a late completion can overwrite a newer turn's paragraph.
- **Why overlap is possible:** `Game.applyCommand()` clears `session.busy` at `js/game.js:237` before narration starts, so another command can commit while the first stream is live.
- **Fix:** Buffer narration until it passes gates, or perform safe rolling redaction without ever emitting an unchecked token. Include `commandId` on token/final events and map UI entries by id. Queue narration or make transcript insertion mechanically ordered.

### 10. Stale-response and wrong-turn protections are not effective in the product

- **Files:** `js/engine/command.js:201-218`, `js/engine/state.js:286-289`, `js/ai/player_agent.js:178-183`, `js/ai/player_agent.js:323-338`, `js/ui/app.js:369-374`
- **Problems:**
  - Product code never advances `turnEpoch`.
  - An AI observation and move list are captured before the model call, but `commandFromMove()` stamps the **current** revision/epoch after the model returns. A stale decision is made fresh.
  - Freshness checking does not validate `sessionId` or that `actorId` is the active actor.
  - When the active controller is not human, `actingId()` falls back to the viewed seat, allowing typed/clicked commands out of turn.
- **Player impact:** A late model answer, command from another session, or human click during an NPC turn can land in a world it did not observe.
- **Fix:** Capture `{sessionId, revision, turnEpoch, activeActorId}` with the observation and carry it unchanged into the command. Reject any mismatch immediately before commit. Enforce active-controller authority centrally in dispatch, with explicit exceptions only for setup/meta operations.

### 11. Core 0-HP, temporary-HP, and rest transitions are broken

- **Files:** `js/engine/events.js:111-132`, `js/engine/events.js:365-395`, `js/engine/combat.js:504-530`, `js/engine/interaction.js:195-207`
- **Problems:**
  - Damage emits a smaller `temp_hp` amount, but the applier always keeps `max(current, incoming)`. Temporary HP therefore never decreases.
  - Damage to a stable creature at 0 adds a failure but leaves `stable:true`; it will not resume death saves.
  - Ordinary healing above 0 does not clear `stable` or death-save counters.
  - `Rules.restoreOnRest()` returns `{events,type}`, but `resolveRest()` calls `.forEach()` on that object. Both Short Rest and Long Rest fail in dispatch.
- **Observed manifestation:** 8 temporary HP remained 8 after 6 damage; a stable creature remained stable after damage and after healing; Long Rest returned `"(events || []).forEach is not a function"`.
- **Rules citation:** SRD 5.1, **Damage and Healing → Temporary Hit Points / Dropping to 0 Hit Points / Stabilizing a Creature**, and **Adventuring → Resting**.
- **Fix:** Use a distinct temp-HP-spend event or explicit replacement semantics; make transitions across 0 reset/clear the correct death state; consume `restore.events`; test through the real dispatcher.

### 12. The Copilot bridge can execute commands as the server user

- **Files:** `server.js:351-359`, `server.js:420-440`, `server.js:493-503`
- **Problem:** `--disable-builtin-mcps` does not disable Copilot CLI shell/file tools. Untrusted HTTP prompt text is written to the interactive CLI's stdin. The security probe executed a harmless shell command using the exact configured flags.
- **Amplifier:** The localhost API has no Host, Origin, `Sec-Fetch-Site`, CSRF token, or content-type checks. A hostile webpage can send a CORS-safelisted `text/plain` POST to `/api/agent/move`. Timeout calls `p.kill()` on only the parent, so children can survive.
- **Player impact:** Visiting a malicious webpage while AETHERTABLE is running can trigger local command execution or spend Copilot credits.
- **Fix:** Do not use an interactive coding-agent CLI as a prompt-only API unless tools can be verifiably disabled. Prefer a structured SDK/API. Otherwise run in a hardened isolated process with zero tools, scrubbed environment, empty private working directory, per-launch API token, exact loopback Host/Origin checks, JSON-only content type, request concurrency/rate limits, and process-tree termination.

### 13. Many advertised combat actions and defenses are only labels

- **Files:** `js/engine/combat.js:607-675`, `js/engine/combat.js:721-760`, `js/engine/combat.js:778-810`, `js/engine/combat.js:908-982`
- **Examples:**
  - Attack advantage/disadvantage comes only from manually supplied `ctx`; prone, unconscious, Dodge, invisibility, Pack Tactics, and effects are not consulted.
  - Resistance, vulnerability, immunity, range, reach, line of sight, and distance are not applied by attack resolution.
  - Dodge adds a condition that attacks never read; Help, Hide, and Ready only spend an action and add prose; escape from grapple automatically succeeds and spends no action.
  - Opportunity attacks are logged as notes, not offered/resolved.
  - Multiattack, recharge, legendary actions, and legendary resistance are exported helpers used by tests, but no product controller calls them.
- **Player impact:** Buttons promise 5e actions whose mechanical consequences do not exist. Monsters with rich statblocks fight as simple first-attack bags of HP.
- **Rules citation:** SRD 5.1, **Combat → Actions in Combat / Opportunity Attacks / Two-Weapon Fighting / Grappling**, **Conditions**, and monster trait/action text.
- **Fix:** Either wire each action end-to-end through effects/turn triggers, or do not expose it as legal. Build attack context inside the engine from positions, conditions, effects, and statblocks—not from optional caller hints.

## SHOULD FIX

### Character creation and level-up do not produce legal spellcasters

- **Files:** `js/ui/setup.js:719-750`, `js/engine/character.js:686`, `js/engine/levelup.js:244-271`, `js/engine/levelup.js:370-391`
- Fresh Bard/Sorcerer/Warlock/Wizard/Cleric characters are created without known, spellbook, cantrip, or prepared choices.
- Level-up filters spells only by class and `level > 0`, not by castable spell level. A level-2 Bard was offered level-4 spells.
- Validation checks only the number chosen, not membership, uniqueness, or spell level.
- **Fix:** Add class-correct creation flows; filter by class list and maximum spell level; model Wizard spellbook and prepared casters separately; validate ids and uniqueness server-side/engine-side.

### Constitution ASIs do not raise current HP by the full retroactive amount

- **Files:** `js/engine/events.js:429-453`, `js/engine/levelup.js:312-326`
- Derived maximum HP correctly changes for every character level, but the level applier heals only the new hit die plus the pre-ASI Con modifier. A fully healed character who raises Constitution becomes partially injured.
- **Fix:** Preserve the pre-level HP deficit, or add `newMax - oldMax` to current HP after refreshing derived stats.

### Save/load is a library feature, not a usable recovery path

- **Files:** `js/engine/save.js:174-251`, `js/engine/save.js:388-425`, `js/ui/app.js:641-669`
- There is a Save button but no Load/Resume UI; `loadLocal()` is used only by tests.
- Undo history and pending narration are not serialized.
- There is no autosave after atomic commit, so a browser reload/crash loses turns since the last manual save.
- Corrupt saves silently become `null`; engine/rules version changes only warn despite comments promising refusal.
- **Fix:** Add a resume choice at boot, autosave after commit, visible corruption/migration errors, pending-narration recovery, and an explicit policy for persistent undo history.

### Content limits, tone, and difficulty controls are mostly decorative

- **Files:** `js/ui/setup.js:803-814`, `js/ui/setup.js:886-895`, `js/engine/state.js:72-78`
- `contentLimits`, `meta.tone`, and `meta.difficulty` are stored but never read by prompts, encounter generation, or adjudication. Only death policy is consumed.
- **Fix:** Feed limits and selected tone into prompt construction and offline output; use difficulty in encounter/check policy; test that each selection changes actual behavior.

### Items/equipment have several broken transitions

- **Files:** `js/engine/interaction.js:413-489`, `js/ui/inventory.js:123-133`, `js/ui/app.js:587-606`
- `unattune` is offered by the UI but not handled by `resolveItem()`.
- Equip/unequip does not spend the appropriate interaction/action or refresh cached attacks/AC.
- Carried weapons, not equipped weapons, become attack profiles.
- Canvas targeting takes the first combat move and changes `target`/`targetId`, but leaves `targetIds` unchanged; clicking enemy B can attack enemy A.
- **Fix:** Resolve item state by uid and slot, refresh derived/attack caches through events, enforce action costs, and set `targetIds:[targetId]`.

### Two-weapon fighting is offered when it is illegal

- **Files:** `js/engine/state.js:226-276`, `js/engine/combat.js:803-808`
- Every actor gets an unarmed strike appended to `runtime.attacks`, so one carried weapon produces two attacks and unlocks an off-hand strike. The engine does not require two equipped light melee weapons.
- **Rules citation:** SRD 5.1, **Combat → Two-Weapon Fighting**.
- **Fix:** Derive hands/equipped light weapons explicitly and offer the bonus attack only when all requirements hold.

### Skill identifiers drift between modules

- **Files:** `js/engine/character.js:31-38`, `js/engine/interaction.js:133-142`, `js/engine/interaction.js:625-637`
- Canonical skills use camelCase (`sleightOfHand`, `animalHandling`); interaction uses snake_case (`sleight_of_hand`, `animal_handling`). Those checks fall back to zero instead of the correct ability/proficiency.
- **Fix:** Export and validate one canonical skill-id enum; never silently treat an unknown skill as +0.

### AI-player speech bypasses the secrecy/prose gates

- **Files:** `js/ai/player_agent.js:223-244`, `js/game.js:440-445`
- The model's free-form `say` field is appended directly to the transcript. It receives no forbidden-name, canon-invention, foreign-script, or player-knowledge audit.
- **Fix:** Gate AI-seat speech against that observer's forbidden terms and knowledge before committing it to the transcript.

### Event-time visibility is reconstructed from current visibility

- **File:** `js/engine/knowledge.js:284-299`
- `visibleEvents()` asks whether the observer can perceive the subject **now**, not whether it perceived the event when it happened. Later detection can retroactively expose old hidden actions in rebuilt summaries.
- **Fix:** Record witness/visibility ids on each committed event or batch and filter by that immutable record.

### The event log cannot reproduce RNG state by folding

- **Files:** `js/engine/dispatch.js:81-99`, `js/engine/events.js:512-524`
- Resolution advances the live RNG outside events; `roll` appliers are no-ops. `fold()` neither reconstructs a live RNG object nor advances it from roll records.
- **Fix:** Resolve against an RNG draft and store/apply `rngBefore/rngAfter` (or draw count) as part of the batch. Add a fold-then-next-roll equality test.

### Static serving exposes the whole repository

- **Files:** `server.js:686-699`
- The static root includes `campaigns/shen_cooper_bible.js`, `_source/`, test artifacts, exports, server source, and dependencies. A local player can fetch the DM Bible directly; cross-site script inclusion/DNS rebinding worsens this.
- **Fix:** Serve a dedicated allowlisted public root. Keep DM-only source, exports, logs, tests, and server code outside it.

### Process and upstream request teardown is incomplete

- **Files:** `server.js:420-445`, `server.js:548-568`
- Copilot timeout kills only the parent. Ollama proxy requests are not aborted when the browser disconnects/reloads, so generation can continue consuming GPU.
- **Fix:** Kill process trees and wire request/response `close`/abort events to upstream destruction.

### “ES5-compatible” is not accurate

- **Examples:** `js/engine/events.js:224` (`findIndex`), widespread `Object.assign`, `js/ai/narrator.js:206` (regex lookbehind).
- The syntax is mostly ES5-style, but the runtime requires ES2015 APIs and an ES2018 regexp engine.
- **Fix:** Add explicit polyfills/compatibility target tests and replace lookbehind, or document modern-browser requirements instead.

### Several comments state guarantees the code does not provide

Examples include atomic `Events.commit()`, “the only way state changes,” all campaign scripts being optional, all exports going through observations, and every combat helper being integrated. These comments are actively misleading during maintenance.

- **Fix:** After correcting behavior, shorten comments to explain the non-obvious invariant and add an executable test for each claimed guarantee.

## NICE TO HAVE

- Split “mechanically implemented” from “data exists.” The SRD data is broad; legal moves should be capability-driven so unsupported spells/actions are not presented as working.
- Add schema validation for saves before migration and for event batches before commit.
- Replace global module singletons (`Backend` configuration, event/effect id counters, injected character data) with session-scoped dependencies to make concurrent sessions and tests safer.
- Add property-based tests for command/event invariants, especially failed commits, save/load/fold, and condition transitions.
- Add a keyboard-operable battle grid. The screen-reader mirror is read-only and the canvas path is mouse-centric.
- Make summaries, pinned memories, and `store.truth` either real, tested features or remove the dead scaffolding until needed.
- Update `README.md`'s stale assertion/suite count and distinguish shipped behavior from planned behavior.

## WHAT IS GENUINELY GOOD

- **The deterministic-first referee is the right design.** `referee.js` keeps common intent parsing fast and reliable, uses constrained live enums, validates semantics, repairs once, and has an honest fallback.
- **The character derivation work is thoughtful.** The three-layer model, retroactive Constitution calculation, separate Pact Magic pool, half-caster rounding distinction, AC contribution resolver, and real-load AC regression test are strong. The main failure is that combat does not consume the result.
- **The SRD datasets are substantial and structured.** All 319 sampled spells had `mech` blocks; 334 monsters had structured actions; items include damage, AC, and attunement metadata. Do not discard this work—wire it incrementally.
- **Campaign secrecy data is well authored.** Atomic claims, staged wording, unique reveal predicates, forbidden names, provenance tags, and public/DM separation are much better than one giant secret prompt.
- **Narrator post-processing is specific and evidence-driven.** Player-voice detection, forbidden-name redaction, repetition checks, foreign-script filtering, bounded regeneration, and offline fallback are useful; preserve them while moving them before display.
- **Undo snapshots include RNG state.** The checkpoint-before-resolve ordering in dispatch is correct for rollback and ordinary undo.
- **Idempotency and revision fields are good primitives.** The failure is orchestration/wiring, not the idea.
- **The UI consistently escapes model/user text.** It also has visible focus, reduced-motion/high-contrast CSS, semantic regions, and a readable failure panel.
- **Server basics are otherwise careful.** Request size caps, fixed Ollama destination, shell-free argv, conservative export filenames, and process-tree cleanup for Ollama are good foundations.
- **Procedural art and its tests are unusually complete.** The art suite is broad, deterministic, and independent of binary assets.
- **The author uses playtests productively.** The transcripts and README show real defects being found and fixed rather than explained away. Keep the real-browser and unattended-session habit.

## TESTS THAT SHOULD EXIST BUT DO NOT

1. **Browser flagship campaign:** select Shen continuation and assert four named party members, Lantern's Rest, ten quests, fact definitions/known stages, AC 18, and public campaign voice.
2. **Browser initiative loop:** hostile sandbox starts combat; after one PC action the next initiative actor starts; monsters act; dead actors are skipped; `turnEpoch` increments.
3. **Real AC integration:** attacks against real-loaded Shen and an SRD monster use derived/statblock AC without `runtime.ac` injection.
4. **Atomic failure:** a batch whose second applier fails leaves the entire state byte-for-byte unchanged, including RNG.
5. **Narration RNG isolation:** offline narration, fallback, and retry do not change the mechanical RNG or next die.
6. **Fold determinism:** snapshot + folded log yields a live RNG and the same next N rolls as the original state.
7. **Secret reveal authority:** a reveal predicate alone cannot put a claim in narration; a committed knowledge event can; journal/export update in the same revision.
8. **Hidden entity end-to-end:** hidden actor absent from legal moves, referee enums, AI prompt options, DM visible roster, battle UI, Markdown, and player export.
9. **Streaming canary:** a model response beginning with a forbidden name/player line is never observable in any token event.
10. **Concurrent narration:** two committed turns with reversed response completion attach prose/transcript to the correct command in mechanical order.
11. **Stale AI choice:** mutate revision/epoch/active actor while the model promise is pending; returned choice must be rejected without restamping.
12. **Authority checks:** wrong-session, wrong-active-actor, and uncontrolled-actor commands are rejected centrally.
13. **Spell-slot integration:** repeated casts exhaust the correct normal/pact pool and a long rest restores it.
14. **Spell action economy:** action, bonus-action, and reaction spells consume exactly the declared slot in the turn economy.
15. **Representative spell matrix:** Cure Wounds, Bless, Sanctuary, Shield, Mage Armor, Fireball, Sleep, Hold Person, and Counterspell through dispatch.
16. **Temporary HP integration:** damage consumes temp HP before real HP; gaining a smaller pool does not replace a larger remaining pool.
17. **0-HP transitions:** stable creature damaged at 0 becomes unstable with failures; any healing above 0 clears saves/stability; later drops start clean.
18. **Rest through UI/dispatch:** Short Rest spends hit dice; Long Rest restores HP, slots, hit dice, class resources, and reduces exhaustion.
19. **Combat action effects:** Dodge, Disengage, Help, Hide, Ready, grapple escape, opportunity attacks, prone/unconscious advantage, and auto-crit within 5 feet.
20. **Defenses and geometry integration:** reach/range, line of sight, cover, resistance, vulnerability, immunity, and AoE target inclusion affect real damage.
21. **Monster turn integration:** multiattack, recharge, legendary resistance/actions, and damage traits are used by the NPC controller, not only helper tests.
22. **Character creation spells:** every spellcasting class starts with legal cantrips/known/prepared/spellbook state.
23. **Level-up spell legality:** low-level characters cannot select high-level, duplicate, off-list, or arbitrary spell ids.
24. **Inventory transitions:** equip/unequip/attune/unattune, stack consumption, attack-profile refresh, and exact canvas target selection.
25. **Content controls:** each content limit reaches the prompt and blocks a matching fixture response; tone/difficulty selections change behavior.
26. **Resume flow:** commit, reload during narration, resume from UI, preserve RNG/state, and recover or deterministically regenerate missing prose.
27. **Corrupt/migration saves:** malformed fields show an actionable error; incompatible rules/engine versions follow the documented refusal/migration policy.
28. **Server cross-site defense:** hostile Origin/Host, `text/plain`, missing launch token, excessive concurrency, and DNS-rebinding-style requests are rejected.
29. **Copilot lockdown:** an automated probe proves shell/file/network tools are unavailable; timeout/shutdown leaves no child processes.
30. **Declared test command coverage:** assert every maintained `*.test.js` suite (including `ui-chargen.test.js`) is invoked by `npm test`, and browser suites fail—not skip—on CI when their required server/Chrome fixture is expected.
