# AETHERTABLE

A 2D Dungeons & Dragons simulator that runs in your browser, with a **local AI as your
Dungeon Master**. One to four seats, each of which can be a person typing or a model playing.
No accounts, no cloud, no build step — a folder, a Node server, and a page.

Built on **D&D 5th Edition, 2014 rules** (SRD 5.1).

---

## Quick start

```
start.cmd
```

That is the whole thing. It checks the port, sweeps any leftover GPU processes, starts the
server, warms a model, and opens the page.

```
stop.cmd
```

Stops **everything the game started** — the web server, Ollama, and the model runner holding
your GPU — and then tells you how much VRAM it got back. It names each process it stops, so
you can check rather than take its word for it.

It is careful about whose processes it stops. Only executables living under this folder or
under the AI runtime *this game uses* are touched, so a system-wide Ollama, or another
project's `llama-server` running on the same machine, is left completely alone. (That is not
hypothetical: it was tested against a second game's model server running at the same time.)

Useful switches:

```
.\start.ps1 -Port 9000        run somewhere else
.\start.ps1 -Model qwen3.5:4b pin a model, disabling automatic step-down
.\start.ps1 -NoBrowser        don't open a window (for scripted runs)
.\start.ps1 -Restart          force a fresh server even if one is healthy
```

### Installing the local Dungeon Master

```
install-ai.cmd
```

Downloads the portable Ollama runtime and the best model your GPU has room for, into this
game's own `ai\` folder. Nothing goes into Program Files, nothing goes on your PATH, and
uninstalling is deleting the folder.

The weights are several gigabytes, so they are **not in this repository** — this script is how
you get them on a machine that needs them.

```
install-ai.cmd -List             what is installed, change nothing
install-ai.cmd -Model qwen3.5:4b a specific model
install-ai.cmd -All              all three
install-ai.cmd -Force            install here even if a sibling game has a copy
```

If a sibling game in the same folder already has the runtime, the installer says so and
downloads nothing — a second copy of several gigabytes helps nobody. It also stops the server
it started to pull the model, because an installer that quietly leaves 3 GB resident on your
card is a bad installer.

### Requirements

- **Node.js** — the only hard requirement.
- **A local model** (optional but recommended). If a sibling game in the same folder already
  has a portable Ollama installed, AETHERTABLE finds and reuses it rather than making you
  download several gigabytes twice. Otherwise run `install-ai.cmd`.
- **GitHub Copilot CLI** (optional). If `copilot` is on your PATH and signed in, Copilot
  models appear as an alternative Dungeon Master and as brains for AI players. It is never
  the default and nothing is sent anywhere unless you pick one.

**You can play with no AI at all.** The Offline Dungeon Master narrates from the engine's own
results. It is plainer than a model, never wrong, and completely playable.

---

## The one idea worth knowing

> **The engine owns the rules. The model owns the prose.**

The AI never rolls a die, never decides whether you hit, never sets your hit points, never
grants you an item, and never fixes a difficulty class. All of that happens in deterministic
JavaScript, is committed atomically, and is written to an event log **before** the model is
asked for a single word.

This is not caution for its own sake. It is what makes the game trustworthy: every number is
inspectable, every turn is undoable, and a model that hangs, crashes, or writes nonsense
cannot corrupt your campaign — the turn already happened. If you dislike what the DM wrote,
you can **retry the narration** and the dice will not move.

It also means the game is honest with you. Open any turn in the log and you will see exactly
what was rolled and against what.

---

## Playing

### Seats

A game has one to four **seats**. Each seat independently is:

- **human** — you type what your character does, in your own words
- **ai** — a model plays that character, choosing from the same list of legal moves your
  buttons are built from

Any mix is allowed. One human and three AI companions. Four humans round one keyboard. Four
AI players while you watch. In a one-player game the Dungeon Master voices everything else —
companions, villagers, monsters — as it would at a real table.

### Typing things

Type what you want to do in plain language. "I get under its guard and shove it into the
water." "I kneel down and ask Lysa what she saw." "I cut the mooring rope so the punt drifts
between us and the thing."

Common phrasings are understood instantly and locally. Unusual, compound or improvised
actions are passed to the model, which decides what you meant and hands it back to the engine
to adjudicate. If two readings are genuinely different actions, you are asked which you meant
rather than guessed at.

### Undo

Every turn takes an automatic checkpoint, so undo rewinds the world **and the dice** — a
reloaded or rewound game continues the same sequence of rolls it would have. You can also
rewind to before a specific exchange if a whole scene went wrong.

---

## Making a character

Three routes, all converging on the same editable sheet:

- **Build it myself** — every choice is yours, and the game explains each one as you make it: which abilities the class actually leans on and *why*, what it plays like, whether your race and class suit each other, and what each skill is for. A mismatched pairing gets a note, never a block.
- **Surprise me** — pin whatever you care about ("a dwarf, and nothing else") and everything unset is generated to suit it.
- **Completely random** — one button, a whole person, with a reroll.

**Backstory** can be typed, drawn from a seed table, or **written for you by the Dungeon Master** — it reads your finished sheet and writes a history that fits it, including one loose thread it intends to pull on later. Whatever you end up with, the DM reads it and may bring it back in play. That is the point of writing one.

## Levelling up

Level-ups present exactly the choices the level actually calls for, built from the class data rather than hard-coded: hit points (roll or take the average), ability score improvements, your subclass when it is due, fighting styles, and new spells. Each comes with a recommendation and the reasoning behind it.

**"Choose for me"** fills the whole form the way the class would want it — and AI-controlled seats use the same path, so an unattended session never stalls on a modal. A level-up commits as an event batch like any other turn, which means **Undo takes it back**.

Spells offered are only ones the character can actually *cast* — a level-2 bard is not shown fourth-level spells — and the choice is validated in the engine, so a duplicate, an off-list spell or an invented id is refused rather than quietly accepted.

## Preparing spells

5e splits casters in two, and the difference is most of what makes them feel different to play.

A **sorcerer, bard, ranger or warlock *knows*** a fixed list that only changes when they level.

A **cleric, druid, paladin or wizard *prepares*** — they choose which spells are ready each morning, and may choose entirely differently tomorrow. AETHERTABLE re-prepares them on every long rest:

| | may prepare | drawn from |
|---|---|---|
| cleric, druid | ability modifier + class level | the whole class list |
| paladin | ability modifier + **half** class level | the whole class list |
| wizard | ability modifier + class level | **their spellbook alone** |

Always at least one; never cantrips, which are always ready; and a level-1 paladin prepares nothing, because it has no spellcasting yet.

A wizard's spellbook is a real thing separate from what they have prepared — six spells at first level and two more at each level after — so choosing today's slate out of it is an actual decision rather than a formality.

It happens automatically on a long rest, keeping whatever was already prepared where that is still legal, so an unattended game never stops at a spell menu. A player who wants to choose the slate themselves can.

## When someone dies

5e is precise about *dying* and deliberately silent about what a table does afterwards. So the mechanics follow the book exactly — 0 hit points is unconscious, death saves at the start of your turn, a natural 1 counts twice, three failures kills, massive damage kills outright, and the Revivify / Raise Dead / Resurrection ladder works on its real timers and diamond costs — while the *consequences* are a campaign setting you choose at the start:

| | What death means |
|---|---|
| **Heroic** | Nobody dies by bad luck. A character who would die is left stable at 0 instead. |
| **Standard** | The rules as written. Resurrection works; a character who cannot be brought back is replaced by someone new the party meets. |
| **Gritty** | Death is permanent unless someone spends the diamonds. The seat stays empty. |
| **Ironman** | One death ends the campaign. |

Replacement characters are generated at the surviving party's level — being two levels behind as a punishment for having died is nobody's idea of fun — and arrive with a reason to be there.

## Campaigns

### The Divided Steel (Shen Cooper)

A complete campaign ported from a real play-by-post game. Shen Cooper, a young human paladin
sworn to the Oath of Devotion, is following four fragments of a broken sword and the failing
seals they belong to. You can start from the beginning or **resume exactly where the original
records end** — mid-investigation on the Glass Fen, with every relationship, item, clue and
unresolved thread intact.

The campaign's secrets are held in a DM-only layer and are revealed only through play. This is
enforced structurally rather than by asking nicely: an unearned secret is not merely forbidden
to the model, it is **absent from the prompt entirely**, and a set of tests traces every
secret across the prompt, the narration, the summaries, the journal and the exports to prove
it never leaks.

### Sandbox

A procedurally generated region, faction web and quest spine for a fresh game, with full
character creation.

---

## Choosing a Dungeon Master

| Backend | What it is | Notes |
|---|---|---|
| **Local model** | Bundled Ollama, running on your machine | The default. Nothing leaves your computer. |
| **Copilot model** | A large hosted model via the Copilot CLI | Better prose, slower, spends credits. Opt-in only. |
| **Offline** | Deterministic templates | No model needed. Always available. |

Three local models are supported, and the server **measures** rather than assumes:

| Model | Role |
|---|---|
| `qwen3.5:4b` | Preferred — the best writer |
| `llama3.2:3b` | Balanced step-down |
| `qwen3:1.7b` | Fast step-down |

At boot the server times a real generation and picks accordingly, then re-measures every 90
seconds. If another program is using your GPU, it says so and chooses a model that can still
answer; when the card frees up you can switch back without restarting. `-Model` pins one and
disables the step-down entirely.

---

## What the AI is and is not allowed to do

Worth stating plainly, because it is the difference between this and a chatbot wearing a
dungeon master's hat.

**The model may:** describe what happened, voice NPCs, set a scene, judge what an unusual
sentence probably meant, and suggest how hard something feels.

**The model may not:** roll anything, decide any outcome, change any number, grant anything,
speak or decide for a player-controlled character, or mention a secret it was never given.

The last two are enforced programmatically, not by instruction. Dialogue attributed to your
character is stripped from the narration before you see it. Names belonging to secrets you
have not earned are redacted. Prose that breaks character, repeats itself, opens on the
weather for the fourth time running, or runs long is regenerated once and then replaced with
deterministic prose rather than shown to you.

### A note on parsing

The referee originally sent every sentence to the model. Measuring it (`tests/live-dm.js`)
showed that was backwards: on ordinary phrasings a 1.7B model scored **38%** and took **seven
seconds**, turning "I end my turn" into an escape-grapple attempt. The pattern table scored
**100%** in **one millisecond**. So confident local matches are now authoritative and the
model is spent only on what genuinely needs judgement — which took accuracy to 100% and
median parse latency to 1 ms.

---

## Art

Every portrait, monster, item icon, environment and battle token is **drawn procedurally on a
canvas from a seeded genome**. There are no image files anywhere in this project. The same
character always looks the same, because their appearance is a function of their seed.

Open `tools/art-preview.html` in a browser to see the whole set.

---

## Exports

At any point — and automatically at the end of an unattended AI run — a session can be
exported to `exports/`, as two files:

- **`.json`** — the complete replayable state, including the RNG position
- **`.md`** — a readable transcript: every line of dialogue, every character sheet, inventory
  and gold, relationships with the reasons they changed, quests, what each character has
  learned, and the full mechanical log

Exports are written by the **server**, not downloaded by the browser, because a download needs
a human to click and an unattended playtest has nobody to click it.

---

## Testing

No test framework. Every suite is a plain Node script that exits non-zero on failure.

```
npm test           everything
npm run test:fast  dice, core and AI only
npm run test:ai    the referee, prompts and narrator gates
npm run test:live  a live battery against a real model (needs the server running)
npm run test:session  click through a whole session in a real browser
```

The interesting suites:

- **`core.test.js`** — commands apply exactly once, stale commands cannot apply at all, undo
  rewinds the RNG, and knowledge only ever moves through knowledge events
- **`ai.test.js`** — the narrator gates, one per failure a small model actually commits
- **`campaign.test.js`** — the leak canaries, tracing every secret across the whole chain
- **`live-dm.js`** — measures a real model rather than asserting about it, since prose is not
  deterministic

A **fixture backend** replays recorded model responses, so the entire referee → engine →
narrator pipeline is tested end to end with no model anywhere.

Current state: **3,438 assertions across sixteen suites**, plus the data-integrity suite — all
passing, including a real-Chrome browser suite and a full click-through of a session in the
actual UI.

---

## What the playtests found

The suites above are necessary and were not sufficient. Four unattended AI playtests each
surfaced real bugs that no unit test caught, which is exactly the point of running them:

| Found in play | The bug | The fix |
|---|---|---|
| Referee battery | A 1.7B model scored **38%** parsing ordinary player input, and took **7 s** to do it | Deterministic patterns first, model only when unsure → **100%**, **1 ms** |
| Shen solo | The DM invented that the antagonist had been a companion's captain — excellent writing, entirely non-canon | Voice cards stating what each character knows *and does not*, plus an explicit "you do not invent facts" rule. Re-run under identical pressure, the NPCs now say "no" honestly |
| Shen solo | Narration invented extra blows from a single hit, opened on the weather three turns running, and reused "is holding its breath" | "Describe ONLY these events"; a sentence cap placed last; a tired-opener gate; a repeated-four-word-run detector |
| Fresh game | A fighter with a longsword in her pack was refused every attack — "nothing to attack with" | Weapon attacks derived from carried gear; an unarmed strike always available |
| Fresh game | `30/12 hp` | Current hit points clamped to the derived maximum |
| Export audit | Shen loaded at **AC 13**, not the canonical 18 — his chain mail was named but not carried | Gear materialised into inventory; `armorProfile` taught both data shapes; a new test that uses **no injection** and goes through the real load path |
| Four seats | Monsters never took a turn | An explicit initiative loop; NPCs run on a deterministic policy, so a round costs four model calls rather than eight |
| Four seats | `shield角度` — a stray CJK token mid-sentence | A foreign-script gate that strips and regenerates |
| Four seats | "Two down, four left standing" in a room that held three | The engine now states the exact roster of who is still standing |
| **First UI click-through** | "A new sandbox" opened onto **one character alone in an empty room** — worldgen had been deferred | `js/gen/worldgen.js`: a real opening scene — a place, a named local with a voice, a level-scaled encounter, and a quest |
| First UI click-through | A newly made fighter carried **nothing** — no weapon, no armour | Class starting kits granted at character creation |
| First UI click-through | Twenty conversation buttons pushed **"Attack" off the action bar** entirely | Display ordering by family, capped per family, combat first when enemies are present |
| First UI click-through | The bar offered **"Try to persuade Ochre Jelly"** and "Lie to Giant Spider" | Social moves now require language and Int ≥ 4; beasts can still be intimidated, oozes cannot |
| First UI click-through | The journal rendered **blank** — it threw on the quest-objective shape | Objectives normalised across all three shapes in circulation |

The AC bug is the instructive one. A unit test asserted AC 18 and passed, because it injected a
hand-built item table; the game loading the same campaign got 13. A test that only ever meets
its own fixtures cannot see that, which is why the suite now contains a section that
deliberately uses none.

The UI findings make the same point from the other end: nine suites and 2,600 assertions passed
while a new game put you alone in an empty room with no sword. Nothing short of clicking
through it would have said so — which is what `tests/session.test.js` now does on every run.

### What an independent review found

A GPT-5.6 review of the whole codebase found thirteen more, and it found them in the same
place: the seams *between* well-tested parts. All thirteen are fixed, each with a test that
fails without the fix. The sharpest ones:

| The bug | Why the suite missed it |
|---|---|
| **Every attack in the game resolved against AC 10.** `targetAc` read a field nothing ever wrote | The combat tests injected `runtime.ac` into their fixtures — the identical trap as the AC 13/18 bug above, in a different function |
| **The browser had no turn loop.** Only the playtest harness advanced initiative, so in the actual game one character acted for ever and monsters never got a turn | Every headless test brought its own loop |
| **The Shen campaign was unreachable from the page.** It was listed, chosen, and then a blank sandbox started instead — the campaign files were never loaded in the browser | The headless tests `require()` the campaign directly |
| **Both rest verbs threw.** `restoreOnRest` returns `{events, type}`; the caller called `.forEach` on it | Nothing exercised a rest through dispatch |
| **Spell slots were unlimited.** Casting wrote to `resources.slot1`; the check read `slotsSpent` | A test asserted the event was emitted, not that it did anything |
| **A secret could never be revealed.** The DM was invited to reveal a fact when the moment earned it, and the redactor then scrubbed the name back out of the reply | Both halves were tested; the contradiction between them was not |
| **Generated casters knew no spells at all** — full slots, empty spell list | Chargen tests checked abilities and skills |
| **Temporary hit points never went down** — the same "no stacking" `max()` was used for spending them | — |
| Prose drew from the mechanical RNG, so retrying the words changed every later roll | The guarantee was documented, not asserted |
| `commit()` applied events one at a time, leaving half a turn applied on failure | — |

The pattern is worth stating plainly, because it produced nearly every serious bug in this
project: **a test that supplies its own data cannot discover that the real data never arrives.**
The suite now contains sections that deliberately go through the real load path — the real page,
the real campaign files, the real item tables — with nothing injected.

### Known limitations

Stated rather than quietly left:

- **Ready** and **opportunity attacks** are declarative — the verb resolves and the action is
  spent, but no reaction is triggered automatically.
- Monster **recharge** and **legendary actions** are present in the data and not yet driven by
  the turn loop.
- Only spells with a `mech` block resolve mechanically. The rest are narrated and cost a slot.

---

## Layout

```
server.js            Node server, Ollama manager, Copilot bridge, exports
js/rng.js            seeded, serialisable RNG
js/engine/           dice, commands, events, effects, characters, rules, combat,
                     knowledge, state, dispatch, save
js/ai/               backend, schemas, prompts, referee, narrator, offline, player agents
js/gen/              procedural art: portraits, creatures, icons, scenes, tokens
js/ui/               panels
js/game.js           the session orchestrator
campaigns/           built-in campaigns and their DM-only layers
tests/               plain-node suites
docs/PLAN.md         the design, and why it is this way
```

---

## Licence and attribution

This project is MIT licensed.

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by
Wizards of the Coast LLC and available at
https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 is licensed under
the Creative Commons Attribution 4.0 International License available at
https://creativecommons.org/licenses/by/4.0/legalcode.

Only SRD 5.1 content is included. No Product Identity is used. Any homebrew content is
exported separately and labelled as such — never attributed to the SRD.

The Shen Cooper campaign material is the property of the player whose game it records and is
included here at their request.
