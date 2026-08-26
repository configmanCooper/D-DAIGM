/*
 * tests/retcon.test.js — amending the record.
 *
 * Two things have to be true and they pull in opposite directions.
 *
 * It has to WORK: a player who says "I'd have bought rope in town" should end
 * up with rope, the gold gone, and a note in the record saying so, with
 * everything that has happened since left alone. A retcon is not an undo.
 *
 * And it has to HOLD: the proposal comes from a language model, and a model
 * asked whether the player may retroactively have bought a rope will grant
 * them a legendary sword and forty thousand gold pieces if the sentence is
 * phrased confidently enough. So the limits are tested by asking for exactly
 * the things a compliant model would happily hand over.
 */
'use strict';

const t = require('./_harness')('retcon');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Knowledge = require('../js/engine/knowledge.js');
const Retcon = require('../js/engine/retcon.js');
const Backend = require('../js/ai/backend.js');
const Game = require('../js/game.js');

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed || classId), fixed: { classId, levels } });
  return Character.buildFromSpec(spec);
}

function table() {
  const s = State.create({ seed: 'retcon' });
  const f = build('fighter', 3, 'rcf');
  State.addActor(s, {
    id: 'bram', name: 'Bram', side: 'party', kind: 'pc',
    base: f.base, progression: f.progression, runtime: f.runtime,
  });
  State.addActor(s, {
    id: 'ogre', name: 'Ogre', side: 'enemy', kind: 'monster',
    base: { abilities: { str: 19, dex: 8, con: 16, int: 5, wis: 7, cha: 7 } },
    runtime: { hp: 59, hpMax: 59, ac: 11, speed: 40, pos: { x: 3, y: 0 }, inventory: [] },
  });
  State.refreshAllDerived(s);
  s.actors.bram.runtime.gold = 120;
  return {
    state: s, store: Knowledge.makeStore(),
    campaign: { title: 'A Test', reveals: [] },
    history: State.makeHistory(),
    locationName: 'Ashford', recentNarration: [], listeners: [],
  };
}

const names = (s) => (s.actors.bram.runtime.inventory || []).map(i => i.name || i.id);

async function main() {
  /* ------------------------------------------------------------------ */
  t.section('the ordinary case: something you would plausibly have done');
  {
    const session = table();
    const s = session.state;
    const goldBefore = s.actors.bram.runtime.gold;
    const revBefore = s.revision;
    const itemsBefore = names(s).length;

    const res = Game.applyRetcon(session, {
      summary: 'You bought a fifty-foot hempen rope in Ashford before you left.',
      reason: 'You had the coin and the market was open.',
      changes: [
        { type: 'item', actorId: 'bram', itemId: 'rope-hempen-50-feet', qty: 1 },
        { type: 'gold', actorId: 'bram', delta: -1 },
      ],
    }, { actorId: 'bram', request: 'can we say I bought rope in town?' });

    t.eq(res.ok, true, 'the amendment is applied', res.reason || '');
    t.ok(names(s).length === itemsBefore + 1, 'the rope is in the pack');
    t.eq(s.actors.bram.runtime.gold, goldBefore - 1, 'and the coin is gone');
    t.ok(s.revision > revBefore,
      'the state moved FORWARD \u2014 a retcon is committed, not rewound');
    t.ok((s.retcons || []).length === 1, 'and the amendment is on the record');
    t.ok(/rope/i.test(s.retcons[0].summary), 'saying what was established');
    t.ok(/rope/i.test(res.describe), 'the player is told what changed');
  }

  /* ------------------------------------------------------------------ */
  t.section('a retcon leaves everything since it intact \u2014 it is not an undo');
  {
    const session = table();
    const s = session.state;

    /* Something happens first: Bram takes a wound. */
    Events.commit(s, {
      commandId: 'wound', actorId: 'ogre',
      events: [{ kind: 'hp', targetId: 'bram', delta: -7, reason: 'ogre' }],
    });
    const woundedHp = s.actors.bram.runtime.hp;

    Game.applyRetcon(session, {
      summary: 'You filled your waterskin at the well before leaving.',
      changes: [{ type: 'note', text: 'The waterskin was full when you set out.' }],
    }, { actorId: 'bram', request: 'I would have filled my waterskin' });

    t.eq(s.actors.bram.runtime.hp, woundedHp,
      'the wound taken before the amendment is still there');
    t.eq((s.retcons || []).length, 1, 'and the amendment is recorded alongside it');
  }

  /* ------------------------------------------------------------------ */
  t.section('a purely narrative amendment is legal and changes no sheet');
  {
    const session = table();
    const s = session.state;
    const before = JSON.stringify(s.actors.bram.runtime);

    const res = Game.applyRetcon(session, {
      summary: 'You and Mara had been travelling together for a season by then.',
      changes: [{ type: 'fact', text: 'Bram and Mara are old road companions.' }],
    }, { actorId: 'bram', request: 'can we say Mara and I already knew each other?' });

    t.eq(res.ok, true, 'it is allowed');
    t.eq(JSON.stringify(s.actors.bram.runtime), before,
      'and nothing on the character sheet moved');
    t.ok((s.retcons[0].establishes || []).length > 0,
      'the established truth is kept, so the Dungeon Master can honour it later');
  }

  /* ------------------------------------------------------------------ */
  t.section('the limits hold against a model that says yes to anything');
  {
    const session = table();
    const s = session.state;

    /* Precisely what a compliant model hands over when asked nicely. */
    const greedy = Retcon.validate(s, {
      summary: 'You had a holy avenger and a fortune all along.',
      changes: [
        { type: 'gold', actorId: 'bram', delta: 40000 },
        { type: 'item', actorId: 'bram', itemId: 'holy-avenger' },
        { type: 'level', actorId: 'bram', delta: 5 },
        { type: 'ability_change', actorId: 'bram', ability: 'str', delta: 4 },
        { type: 'revive', actorId: 'bram' },
        { type: 'xp', actorId: 'bram', delta: 100000 },
      ],
    });

    const reasons = greedy.refused.map(r => r.reason).join(' | ');
    t.eq(greedy.accepted.length, 0, 'not one of them is granted', reasons);
    t.eq(greedy.refused.length, 6, 'and every one is refused with a reason');
    t.ok(/at most 250 gp/i.test(reasons), 'the gold ceiling is named');
    t.ok(/level/i.test(reasons), 'levels are refused');
    t.ok(/dead/i.test(reasons), 'and so is resurrection');
  }

  /* ------------------------------------------------------------------ */
  t.section('you cannot retroactively spend money you never had');
  {
    const session = table();
    session.state.actors.bram.runtime.gold = 3;
    const v = Retcon.validate(session.state, {
      changes: [{ type: 'gold', actorId: 'bram', delta: -200 }],
    });
    t.eq(v.accepted.length, 0, 'the purchase is refused');
    t.ok(/never had that much/i.test(v.refused[0].reason), 'and says why');
  }

  /* ------------------------------------------------------------------ */
  t.section('rare items are treasure to be found, not remembered');
  {
    const session = table();
    const v = Retcon.validate(session.state, {
      changes: [
        { type: 'item', actorId: 'bram', itemId: 'plate-armor' },
        { type: 'item', actorId: 'bram', itemId: 'rope-hempen-50-feet' },
      ],
    });
    const kept = v.accepted.map(c => (c.resolved || {}).name);
    t.ok(kept.indexOf('Rope, Hempen (50 feet)') >= 0 || kept.length === 1,
      'the ordinary item is allowed', JSON.stringify(kept));
    t.ok(v.refused.length >= 1, 'the expensive one is not');
    t.ok(/gp, beyond what a retcon may conjure|treasure/i.test(v.refused.map(r => r.reason).join(' ')),
      'and the refusal explains itself');
  }

  /* ------------------------------------------------------------------ */
  t.section('an unknown item is refused rather than conjured');
  {
    const v = Retcon.validate(table().state, {
      changes: [{ type: 'item', actorId: 'bram', itemId: 'sword-of-infinite-plot-armour' }],
    });
    t.eq(v.accepted.length, 0, 'nothing is granted');
    t.ok(/no such item/i.test(v.refused[0].reason), 'because there is no such item');
  }

  /* ------------------------------------------------------------------ */
  t.section('a change aimed at nobody is refused');
  {
    const v = Retcon.validate(table().state, {
      changes: [{ type: 'gold', actorId: 'nobody-at-all', delta: 10 }],
    });
    t.eq(v.accepted.length, 0, 'no such character, no change');
    t.ok(/no such character/i.test(v.refused[0].reason), 'and it says so');
  }

  /* ------------------------------------------------------------------ */
  t.section('the amendment survives a save and reload');
  {
    const session = table();
    Game.applyRetcon(session, {
      summary: 'You bought a lantern in Ashford.',
      changes: [
        { type: 'item', actorId: 'bram', itemId: 'lantern-hooded', qty: 1 },
        { type: 'fact', text: 'Bram has carried a hooded lantern since Ashford.' },
      ],
    }, { actorId: 'bram', request: 'I would have bought a lantern' });

    const Save = require('../js/engine/save.js');
    const blob = JSON.parse(JSON.stringify(Save.serialize(session)));
    const back = Save.deserialize(blob);
    const st = back.state || back;

    t.ok((st.retcons || []).length === 1,
      'the amendment is still on the record after a round trip');
    t.ok(/lantern/i.test(st.retcons[0].summary), 'with what it established');
    t.ok((st.actors.bram.runtime.inventory || []).some(i => /lantern/i.test(i.name || '')),
      'and the lantern is still in the pack');
  }

  /* ------------------------------------------------------------------ */
  t.section('an amendment can be undone like anything else');
  {
    const session = table();
    const before = names(session.state).length;
    const res = Game.applyRetcon(session, {
      summary: 'You bought a torch.',
      changes: [{ type: 'item', actorId: 'bram', itemId: 'torch', qty: 1 }],
    }, { actorId: 'bram', request: 'I would have a torch' });
    t.eq(res.ok, true, 'the torch is established');
    t.eq(names(session.state).length, before + 1, 'and is in the pack');

    const undone = Game.undo(session);
    t.eq(undone.ok, true, 'the amendment can be taken back');
    t.eq(names(session.state).length, before,
      'and the torch goes with it \u2014 a retcon is an ordinary commit');
  }

  /* ------------------------------------------------------------------ */
  t.section('an out-of-character QUESTION is never treated as an amendment');
  {
    const session = table();
    const s = session.state;
    const revBefore = s.revision;

    Backend.configure({
      kind: 'fixture',
      fixtures: { '*': JSON.stringify({ intent: 'ask' }) },
    });

    const out = await Game.askOrAmend(session, 'how does grappling work?', { actorId: 'bram' });
    t.eq(out.kind, 'answer', 'it is answered, not applied');
    t.eq(s.revision, revBefore, 'and nothing was committed');
    t.eq((s.retcons || []).length, 0, 'no amendment was recorded');
  }

  /* ------------------------------------------------------------------ */
  t.section('an amendment is PROPOSED, never applied behind the player\u2019s back');
  {
    const session = table();
    const s = session.state;
    const revBefore = s.revision;

    Backend.configure({
      kind: 'fixture',
      fixtures: {
        '*': JSON.stringify({
          intent: 'amend', allowed: true,
          summary: 'You bought a torch in Ashford.',
          reason: 'Ordinary and affordable.',
          changes: [{ type: 'item', actorId: 'bram', itemId: 'torch', qty: 1 }],
        }),
      },
    });

    const out = await Game.askOrAmend(session, 'can we say I picked up a torch?', { actorId: 'bram' });
    t.eq(out.kind, 'amend', 'it is recognised as an amendment');
    t.ok(/torch/i.test(out.describe), 'and described for the player to approve');
    t.eq(s.revision, revBefore,
      'but NOTHING has been applied yet \u2014 it waits for the player');
    t.eq((s.actors.bram.runtime.inventory || []).some(i => /torch/i.test(i.name || '')), false,
      'the torch is not in the pack until they say yes');

    /* And then they say yes. */
    const applied = Game.applyRetcon(session, out.proposal, { actorId: 'bram', request: 'torch' });
    t.eq(applied.ok, true, 'approving it applies it');
    t.eq((s.actors.bram.runtime.inventory || []).some(i => /torch/i.test(i.name || '')), true,
      'and now the torch is real');
  }

  /* ------------------------------------------------------------------ */
  t.section('a Dungeon Master who says no is obeyed');
  {
    const session = table();
    const revBefore = session.state.revision;
    Backend.configure({
      kind: 'fixture',
      fixtures: {
        '*': JSON.stringify({
          intent: 'amend', allowed: false,
          reason: 'That fight is already played out; we are not rewinding it.',
          changes: [{ type: 'hp', actorId: 'bram', delta: 20 }],
        }),
      },
    });
    const out = await Game.askOrAmend(session, 'can we say the ogre missed me?', { actorId: 'bram' });
    t.eq(out.kind, 'refused', 'the request is refused');
    t.ok(/already played out/i.test(out.text), 'with the Dungeon Master\u2019s reason');
    t.eq(session.state.revision, revBefore, 'and nothing changed');
  }

  /* ------------------------------------------------------------------ */
  t.section('a stalled classifier falls back to answering, never to amending');
  {
    const session = table();
    const revBefore = session.state.revision;
    const realChat = Backend.chat;
    Backend.chat = () => new Promise(() => { /* never settles */ });

    const out = await Game.askOrAmend(session, 'can we say I bought a castle?', {
      actorId: 'bram', stallMs: 250, totalMs: 700,
    });
    Backend.chat = realChat;

    t.eq(out.kind, 'answer',
      'a model that stops answering must never be read as approving a change');
    t.eq(session.state.revision, revBefore, 'and nothing was amended');
  }

  /* ------------------------------------------------------------------ */
  t.section('a proposal whose every change is refused is a refusal, not a story');
  {
    /* The live model, asked for a legendary sword and a fortune, wrote a
       ruling explaining why not and STILL returned allowed:true with the
       changes attached. Both were thrown out, nothing was left, and the
       summary "Bram has a legendary holy avenger and fifty thousand gold"
       was recorded as settled truth and fed to the Dungeon Master as fact
       from then on. An empty accepted list is only narrative if nothing was
       asked for in the first place. */
    const s = table().state;
    const v = Retcon.validate(s, {
      summary: 'Bram has a legendary holy avenger and fifty thousand gold.',
      changes: [
        { type: 'gold', actorId: 'bram', delta: 50000 },
        { type: 'item', actorId: 'bram', itemId: 'holy-avenger' },
      ],
    }, { actorId: 'bram' });

    t.eq(v.accepted.length, 0, 'nothing is granted');
    t.eq(v.narrativeOnly, false,
      'and it is NOT treated as a narrative amendment');
    t.eq(v.ok, false,
      'so the amendment fails outright rather than recording the claim as true');
  }

  /* ------------------------------------------------------------------ */
  t.section('a change that names nobody belongs to whoever asked');
  {
    /* Every well-formed request the live model produced omitted actorId, so
       a legitimate "can we say I bought rope in Ashford" was allowed by the
       Dungeon Master and then refused by the engine with "that change has to
       name whose it is". The rope never reached the pack. */
    const s = table().state;
    const v = Retcon.validate(s, {
      summary: 'You bought rope in Ashford.',
      changes: [{ type: 'item', itemId: 'rope-hempen-50-feet', qty: 1 }],
    }, { actorId: 'bram' });

    t.eq(v.accepted.length, 1, 'the change is accepted');
    t.eq(v.accepted[0].actorId, 'bram', 'attributed to the asking character');

    const orphan = Retcon.validate(s, {
      changes: [{ type: 'item', itemId: 'torch' }],
    }, {});
    t.eq(orphan.accepted.length, 0, 'but with nobody asking, it is still refused');
  }

  /* ------------------------------------------------------------------ */
  t.section('an invented item name never becomes a real magic weapon');
  {
    /* The fuzzy match that rescues "waterskin-full" once trimmed
       "sword-of-infinite-plot-armour" all the way down to "sword" and
       resolved it to the Sword of Life Stealing. */
    t.eq(Retcon.itemDef('sword-of-infinite-plot-armour'), null,
      'a made-up name resolves to nothing at all');
    t.eq(Retcon.itemDef('blade-of-ultimate-destiny'), null,
      'and so does another');

    const ok = [
      ['waterskin-full', /waterskin/i],
      ['rope-coil', /rope/i],
      ['rations-dried', /rations/i],
      ['potion-of-healing-greater', /potion of healing/i],
      /* Found in a live run: Opus 5 asked for a healer's kit, the Dungeon
         Master allowed it, and the engine refused an ordinary five-gold item
         because the model wrote "healer's-kit" and the data says
         "healers-kit". One apostrophe lost the whole amendment. */
      ["healer's-kit", /healer/i],
      ["Healer's Kit", /healer/i],
      ['healers kit', /healer/i],
    ];
    ok.forEach(([slug, want]) => {
      const d = Retcon.itemDef(slug);
      t.ok(d && want.test(d.name), 'but "' + slug + '" still finds the real item',
        '(' + (d ? d.name : 'nothing') + ')');
    });

    t.ok(/legendary/i.test((Retcon.itemDef('holy-avenger') || {}).rarity || ''),
      'a real legendary item is still found \u2014 and refused on rarity, not on spelling');
  }

  t.done();
}

main().catch(e => {
  console.error('\nretcon suite threw:', (e && e.stack) || e);
  process.exit(1);
});
