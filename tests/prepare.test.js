/**
 * prepare.test.js — prepared casters and the long rest.
 *
 * 5e (2014) splits casters in two. A sorcerer or bard *knows* a fixed list
 * that only changes on level-up. A cleric, druid, paladin or wizard *prepares*
 * a list after a long rest and may prepare a different one tomorrow — that
 * daily choice is most of what makes them interesting to play.
 *
 * The game only implemented the first half: a cleric was built with a list and
 * kept it for the whole campaign, which quietly turned every prepared caster
 * into a worse sorcerer.
 */
const t = require('./_harness')('prepare');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Command = require('../js/engine/command.js');
const Dispatch = require('../js/engine/dispatch.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Prepare = require('../js/engine/prepare.js');
const Game = require('../js/game.js');
const SPELLS = require('../js/data/srd_spells.js').SPELLS;
require('../js/engine/combat.js');
require('../js/engine/interaction.js');

function build(classId, levels, seed) {
  const spec = Chargen.generate({ rng: new RNG(seed || classId + levels), fixed: { classId, levels } });
  const ch = Character.buildFromSpec(spec);
  ch.derived = Character.derive(ch.base, ch.progression, ch.runtime, []);
  return ch;
}

/* ------------------------------------------ who prepares, and how many -- */

t.section('the sheet can tell a prepared caster from a known one');
{
  /* This was the prerequisite bug: `derive` read `spellcasting.prepares`,
     which the class data does not carry, so EVERY caster in the game reported
     as a "known" caster and nothing could distinguish them. */
  const expected = {
    cleric: 'prepared', druid: 'prepared', paladin: 'prepared', wizard: 'spellbook',
    bard: 'known', sorcerer: 'known', warlock: 'known', ranger: 'known',
  };
  Object.keys(expected).forEach(classId => {
    const ch = build(classId, 5);
    t.eq(ch.derived.spellcasting.prepares, expected[classId],
      'a ' + classId + ' is a "' + expected[classId] + '" caster');
  });
}

t.section('how many spells a preparer may have ready');
{
  /* cleric and druid: ability modifier + class level.
     paladin: ability modifier + HALF class level.
     Always at least one. */
  const cleric = build('cleric', 5);
  const cPlan = Prepare.preparationFor(cleric.base, cleric.progression, cleric.derived);
  t.eq(cPlan.limit, cleric.derived.abilityMods.wis + 5,
    'a level-5 cleric prepares Wisdom modifier + 5');
  t.eq(cPlan.source, 'list', 'and chooses from the whole cleric list');

  const pal = build('paladin', 5);
  const pPlan = Prepare.preparationFor(pal.base, pal.progression, pal.derived);
  t.eq(pPlan.limit, pal.derived.abilityMods.cha + 2,
    'a level-5 paladin prepares Charisma modifier + 2, not + 5');

  const pal1 = build('paladin', 1);
  t.eq(Prepare.preparationFor(pal1.base, pal1.progression, pal1.derived), null,
    'a level-1 paladin prepares nothing at all, because it has no spellcasting yet');

  const sorc = build('sorcerer', 5);
  t.eq(Prepare.preparationFor(sorc.base, sorc.progression, sorc.derived), null,
    'a sorcerer never prepares — it knows its spells');

  const fighter = build('fighter', 5);
  t.eq(Prepare.preparationFor(fighter.base, fighter.progression, fighter.derived), null,
    'and neither does a fighter');
}

t.section('a wizard prepares from their spellbook, and nothing else');
{
  [1, 3, 5, 9, 13].forEach(level => {
    const wiz = build('wizard', level);
    const book = wiz.progression.spellbook || [];
    /* 2014: six spells at first level, two more at every level after. */
    t.eq(book.length, 6 + (level - 1) * 2,
      'a level-' + level + ' wizard\u2019s spellbook holds ' + (6 + (level - 1) * 2) + ' spells');
    t.eq((wiz.progression.preparedSpells || []).every(id => book.indexOf(id) >= 0), true,
      'and everything prepared came out of that book');
  });

  const wiz = build('wizard', 5);
  const plan = Prepare.preparationFor(wiz.base, wiz.progression, wiz.derived);
  t.eq(plan.source, 'spellbook', 'the wizard\u2019s pool is the book');
  t.eq(plan.pool.every(id => (wiz.progression.spellbook || []).indexOf(id) >= 0), true,
    'so nothing outside the book can be prepared');
  t.eq(plan.limit, wiz.derived.abilityMods.int + 5,
    'and the limit is Intelligence modifier + level');
}

/* ------------------------------------------------------------ choosing -- */

t.section('choosing a slate');
{
  const cleric = build('cleric', 5);
  const plan = Prepare.preparationFor(cleric.base, cleric.progression, cleric.derived);

  const auto = Prepare.autoChoose(plan, {});
  t.eq(auto.length, plan.count, '"prepare for me" fills every slot');
  t.deep(Prepare.validate(plan, auto), [], 'and produces a legal slate');
  t.eq(auto.filter((id, i) => auto.indexOf(id) !== i).length, 0, 'with no spell twice');
  t.eq(auto.every(id => (SPELLS[id].classes || []).indexOf('cleric') >= 0), true,
    'and nothing off the cleric list');

  /* A player who already chose spells meant to have them; re-preparing should
     not throw their choices away for no reason. */
  const keep = plan.pool.slice(0, 3);
  cleric.progression.preparedSpells = keep.slice();
  const plan2 = Prepare.preparationFor(cleric.base, cleric.progression, cleric.derived);
  const auto2 = Prepare.autoChoose(plan2, {});
  t.eq(keep.every(id => auto2.indexOf(id) >= 0), true,
    'and keeps what was already prepared, where it is still legal');

  t.ok(Prepare.validate(plan, ['fireball']).length > 0,
    'a spell that is not on the class list is refused');
  t.ok(Prepare.validate(plan, [auto[0], auto[0]]).length > 0,
    'preparing the same spell twice is refused');
  t.ok(Prepare.validate(plan, plan.pool.slice(0, plan.count + 3)).length > 0,
    'and preparing more than the limit is refused');
}

/* ------------------------------------------------------- the long rest -- */

function party() {
  const s = State.create({ seed: 'rest-prepare' });
  const cast = [['cleric', 'Bram'], ['wizard', 'Ysolde'], ['sorcerer', 'Sable'], ['fighter', 'Vess']];
  cast.forEach(([classId, name], i) => {
    const ch = build(classId, 5, 'party-' + classId);
    State.addActor(s, {
      id: 'p' + i, name, side: 'party', kind: 'pc',
      base: ch.base, progression: ch.progression, runtime: ch.runtime,
    });
  });
  State.refreshAllDerived(s);
  return s;
}

t.section('a long rest re-prepares the casters who prepare');
{
  const s = party();
  const sorcererBefore = (s.actors.p2.progression.preparedSpells || []).slice();
  const fighterBefore = (s.actors.p3.progression.preparedSpells || []).slice();

  /* Yesterday went badly: the cleric prepared almost nothing and the wizard
     nothing at all. A night's rest is exactly when that gets fixed. */
  s.actors.p0.progression.preparedSpells = [];
  s.actors.p1.progression.preparedSpells = [];

  const h = State.makeHistory();
  const res = Dispatch.dispatch(s, h, Command.create({
    actorId: 'p0', family: 'exploration',
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'long_rest' }),
  }), {});
  t.eq(res.ok, true, 'the party takes a long rest');

  const clericNow = s.actors.p0.progression.preparedSpells || [];
  const wizardNow = s.actors.p1.progression.preparedSpells || [];
  t.ok(clericNow.length > 0, 'the cleric wakes with spells prepared', '(' + clericNow.length + ')');
  t.ok(wizardNow.length > 0, 'so does the wizard', '(' + wizardNow.length + ')');

  const clericPlan = Prepare.preparationFor(s.actors.p0.base, s.actors.p0.progression,
    s.actors.p0.derivedCache);
  t.eq(clericNow.length, clericPlan.count, 'the cleric prepares exactly their limit');
  t.deep(Prepare.validate(clericPlan, clericNow), [], 'and every one of them is legal');

  const book = s.actors.p1.progression.spellbook || [];
  t.eq(wizardNow.every(id => book.indexOf(id) >= 0), true,
    'the wizard prepared only out of their own spellbook');

  t.deep(s.actors.p2.progression.preparedSpells, sorcererBefore,
    'the sorcerer\u2019s known spells are untouched — it does not prepare');
  t.deep(s.actors.p3.progression.preparedSpells, fighterBefore,
    'and the fighter is unaffected');

  t.ok((res.batch.beats || []).some(b => /prepare/i.test(b)),
    'and the rest says so, so a player knows it happened');
}

t.section('a short rest changes nothing about preparation');
{
  const s = party();
  const before = (s.actors.p0.progression.preparedSpells || []).slice();
  const h = State.makeHistory();
  Dispatch.dispatch(s, h, Command.create({
    actorId: 'p0', family: 'exploration',
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'short_rest' }),
  }), {});
  t.deep(s.actors.p0.progression.preparedSpells, before,
    'spells are prepared over a long rest, not an hour\u2019s breather');
}

t.section('re-preparing is undoable, like every other change');
{
  const s = party();
  const session = Game.createSession({ state: s, campaign: { id: 'c', title: 'C' } });
  const h = session.history;

  /* Choose a deliberate slate first, so there is something recognisable to
     come back to. Undo rewinds to the state immediately before the rest — it
     is not a way to reach some earlier arrangement that was never committed. */
  const plan = Game.preparationFor(session, 'p0');
  const yesterday = plan.pool.slice(0, plan.count);
  Game.applyPreparation(session, 'p0', yesterday);
  t.deep(s.actors.p0.progression.preparedSpells, yesterday, 'yesterday\u2019s slate is set');

  Dispatch.dispatch(s, h, Command.create({
    actorId: 'p0', family: 'exploration',
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'long_rest' }),
  }), {});
  const today = (s.actors.p0.progression.preparedSpells || []).slice();
  t.ok(today.length > 0, 'the rest prepared a slate for today');

  State.undo(h, s);
  t.deep(s.actors.p0.progression.preparedSpells, yesterday,
    'and undo puts yesterday\u2019s slate back');
}

/* ------------------------------------------------- choosing it yourself -- */

t.section('a player can choose the slate themselves');
{
  const s = party();
  const session = Game.createSession({ state: s, campaign: { id: 'c', title: 'C' } });

  const plan = Game.preparationFor(session, 'p0');
  t.ok(!!plan, 'the game offers a preparation plan for the cleric');
  t.eq(Game.preparationFor(session, 'p2'), null, 'and none for the sorcerer');

  const pick = plan.pool.slice(0, plan.count);
  const ok = Game.applyPreparation(session, 'p0', pick);
  t.eq(ok.ok, true, 'a legal slate is accepted');
  t.deep(s.actors.p0.progression.preparedSpells, pick, 'and is what the character now has ready');

  const bad = Game.applyPreparation(session, 'p0', ['fireball', 'not-a-spell']);
  t.eq(bad.ok, false, 'an illegal slate is refused rather than quietly trimmed');
  t.ok(bad.errors.length > 0, 'and says why', '(' + bad.errors[0] + ')');
  t.deep(s.actors.p0.progression.preparedSpells, pick,
    'the refusal changed nothing');

  const auto = Game.autoPreparation(session, 'p0');
  t.eq(auto.ok, true, '"prepare for me" works through the session too');
}

t.section('what is prepared is what can be cast');
{
  /* The point of all this: preparation must actually reach the spell list the
     action bar and the AI seats are offered. */
  const s = party();
  s.actors.p0.progression.preparedSpells = [];
  const h = State.makeHistory();
  Dispatch.dispatch(s, h, Command.create({
    actorId: 'p0', family: 'exploration',
    stateRevision: s.revision, turnEpoch: s.turnEpoch,
    primary: Command.makeStep({ verb: 'long_rest' }),
  }), {});

  const derived = State.refreshDerived(s, 'p0');
  t.ok(derived.spellcasting.prepared.length > 0,
    'the derived sheet shows the newly prepared spells');

  const moves = Dispatch.legalMoves(s, 'p0', {});
  const spellMoves = moves.filter(m => m.family === 'spell');
  t.ok(spellMoves.length > 0, 'and the cleric is offered spells to cast',
    '(' + spellMoves.length + ')');
}

t.done();
