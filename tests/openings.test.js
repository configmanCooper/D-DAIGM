/*
 * tests/openings.test.js — how a game begins, and who is at the table.
 *
 * Every generated campaign used to start the same way: a ruin, something
 * already in it, and initiative rolled before anyone had spoken. Four scenes,
 * all of them a fight, and in a one-player game the "party" was one person
 * standing alone next to a stranger.
 *
 * Both of those are the sort of thing a test suite will happily not notice
 * for months, because nothing is broken — a fight in a ruin is a perfectly
 * valid game state. It is just the only one there was.
 */
'use strict';

const t = require('./_harness')('openings');
const { RNG } = require('../js/rng.js');
const State = require('../js/engine/state.js');
const Events = require('../js/engine/events.js');
const Command = require('../js/engine/command.js');
const Dispatch = require('../js/engine/dispatch.js');
const Character = require('../js/engine/character.js');
const Chargen = require('../js/gen/chargen.js');
const Openings = require('../js/gen/openings.js');
const Companions = require('../js/gen/companions.js');
const Worldgen = require('../js/gen/worldgen.js');
require('../js/engine/interaction.js');

function seatedParty(seed, specs) {
  const s = State.create({ seed });
  specs.forEach((spec, i) => {
    const built = Character.buildFromSpec(
      Chargen.generate({ rng: new RNG(seed + i), fixed: spec }));
    const id = 'pc' + (i + 1);
    State.addActor(s, {
      id, name: 'Player ' + (i + 1), side: 'party', kind: 'pc',
      base: built.base, progression: built.progression, runtime: built.runtime,
    });
    State.addSeat(s, { id: 'seat' + i, name: 'S' + i, actorId: id, control: 'human' });
  });
  State.refreshAllDerived(s);
  return s;
}

/* ------------------------------------------------------------------ */
t.section('a game does not always start in a fight');
{
  const st = Openings.stats();
  t.ok(st.total >= 15, 'there are enough openings to be worth choosing between',
    '(' + st.total + ')');
  t.ok(Object.keys(st.byKind).length >= 6,
    'across several kinds of scene, not just dungeons',
    JSON.stringify(st.byKind));
  t.ok(st.byOpens.peaceful > (st.byOpens.violent || 0) * 3,
    'and most of them open with nobody hostile present at all',
    JSON.stringify(st.byOpens));
}

t.section('and a generated game usually opens peacefully');
{
  const seen = { peaceful: 0, tense: 0, violent: 0 };
  const kinds = {};
  for (let i = 0; i < 40; i++) {
    const s = seatedParty('mix' + i, [{ classId: 'fighter', levels: 2 }]);
    const o = Worldgen.generateOpening(s, { rng: new RNG('o' + i) });
    seen[o.opens] = (seen[o.opens] || 0) + 1;
    kinds[o.scene.kind] = (kinds[o.scene.kind] || 0) + 1;
  }
  t.ok(seen.peaceful >= 20, 'at least half of forty generated games open peacefully',
    JSON.stringify(seen));
  t.ok(Object.keys(kinds).length >= 5, 'and they are not all the same kind of scene',
    JSON.stringify(kinds));
}

t.section('a peaceful opening puts nothing hostile on the board');
{
  let checked = 0, wrong = [];
  for (let i = 0; i < 60; i++) {
    const s = seatedParty('peace' + i, [{ classId: 'wizard', levels: 3 }]);
    const o = Worldgen.generateOpening(s, { rng: new RNG('p' + i) });
    if (o.opens !== 'peaceful') continue;
    checked++;
    const foes = State.livingEnemies(s);
    if (foes.length) wrong.push(o.scene.id + ': ' + foes.length + ' enemies');
  }
  t.ok(checked > 10, 'enough peaceful openings to be meaningful', '(' + checked + ')');
  t.deep(wrong, [],
    'not one of them spawned a monster \u2014 a library after hours is not an ambush');
}

/* ------------------------------------------------------------------ */
t.section('the party always adds up to four');
{
  /* The rule the whole feature exists for: one player means three companions,
     two means two, three means one, four means none. */
  [1, 2, 3, 4].forEach(n => {
    const specs = [];
    for (let i = 0; i < n; i++) specs.push({ classId: 'fighter', levels: 3 });
    const s = seatedParty('size' + n, specs);
    Worldgen.generateOpening(s, { rng: new RNG('s' + n) });
    const party = State.partyIds(s);
    t.eq(party.length, 4, n + ' seated player(s) makes a party of four',
      party.map(id => s.actors[id].name).join(', '));
    const seats = (s.seats || []).length;
    t.eq(seats, n, 'and only the ' + n + ' human seat(s) belong to people');
  });
}

t.section('the companions are matched to the party, not random');
{
  const s = seatedParty('gap', [{ classId: 'wizard', levels: 4 }]);
  const added = Companions.fillParty(s, { rng: new RNG('gap') });
  t.eq(added.length, 3, 'three companions are added for a lone wizard');

  const classes = State.partyIds(s).map(id =>
    ((s.actors[id].base.classes || [{}])[0] || {}).classId);
  t.ok(new Set(classes).size >= 3, 'and they are not four of the same class',
    classes.join(', '));

  /* Somebody to stand in front and somebody to put you back together. */
  const roles = new Set();
  classes.forEach(c => (Companions.ROLES[c] || []).forEach(r => roles.add(r)));
  t.ok(roles.has('front'), 'somebody can stand in the front rank', [...roles].join(', '));
  t.ok(roles.has('heal'), 'and somebody can put the others back together');

  const levels = State.partyIds(s).map(id => s.actors[id].derivedCache.level);
  t.ok(Math.max(...levels) - Math.min(...levels) <= 1,
    'and everyone is within a level of everyone else', levels.join('/'));
}

/* ------------------------------------------------------------------ */
t.section('the opening suits the people who will play it');
{
  /* Scored, not filtered — so this is a distribution claim, not a lookup. */
  function topFor(who, seed) {
    const count = {};
    for (let i = 0; i < 300; i++) {
      const o = Openings.chooseOpening(new RNG(seed + i), who, {});
      count[o.kind] = (count[o.kind] || 0) + 1;
    }
    return count;
  }
  const scholar = topFor([{ classId: 'wizard', backgroundId: 'sage' }], 'w');
  const wildman = topFor([{ classId: 'barbarian', backgroundId: 'outlander' }], 'b');

  t.ok((scholar.study || 0) > (wildman.study || 0),
    'a wizard-sage gets the library and the observatory more than a barbarian does',
    JSON.stringify({ scholar: scholar.study || 0, wildman: wildman.study || 0 }));
  t.ok((wildman.travel || 0) > (scholar.travel || 0),
    'and the barbarian gets the road more than the wizard does',
    JSON.stringify({ wildman: wildman.travel || 0, scholar: scholar.travel || 0 }));
  t.ok((scholar.combat || 0) > 0,
    'but the wizard can still end up in a fight \u2014 this is weighted, not a lookup table');
  /* An independent review found a half-orc barbarian checking star-tables on
     an observatory stair, with nothing to do in the scene. The floor was too
     high relative to a fit, so the unlikely pairing fired far more often than
     "sometimes". */
  t.ok((wildman.study || 0) * 6 < (scholar.study || 1),
    'and a barbarian on an observatory stair is genuinely rare, not a coin flip',
    JSON.stringify({ barbarianStudy: wildman.study || 0, wizardStudy: scholar.study || 0 }));
}

t.section('the bond suits them too');
{
  function bondsFor(who, seed) {
    const count = {};
    for (let i = 0; i < 300; i++) {
      const o = Openings.chooseOpening(new RNG(seed + i), who, {});
      const b = Openings.chooseBond(new RNG(seed + 'b' + i), o, who, {});
      count[b.id] = (count[b.id] || 0) + 1;
    }
    return count;
  }
  const paladins = bondsFor(
    [{ classId: 'paladin', backgroundId: 'acolyte' }, { classId: 'paladin', backgroundId: 'soldier' }], 'p');
  const wizards = bondsFor(
    [{ classId: 'wizard', backgroundId: 'sage' }, { classId: 'wizard', backgroundId: 'sage' }], 'z');
  const thieves = bondsFor(
    [{ classId: 'rogue', backgroundId: 'criminal' }, { classId: 'rogue', backgroundId: 'urchin' }], 'r');

  t.ok((paladins.order || 0) > 30, 'two paladins usually know each other from the order',
    JSON.stringify(paladins.order || 0));
  t.ok((wizards.school || 0) > 30, 'two wizards from the same teacher',
    JSON.stringify(wizards.school || 0));
  t.ok((thieves.street || 0) + (thieves.guild || 0) > 30,
    'and two rogues from the same streets or the same guild',
    JSON.stringify({ street: thieves.street || 0, guild: thieves.guild || 0 }));
  t.eq(paladins.school || 0, 0,
    'a party with no wizard in it is never bound by a wizard\u2019s schooling');
}

t.section('a bond says whether they are strangers, because it changes everything');
{
  const ids = Object.keys(Openings.BONDS);
  const strangers = ids.filter(id => Openings.BONDS[id].strangers);
  t.ok(strangers.length >= 3, 'some bonds start the party as strangers', strangers.join(', '));
  t.ok(ids.length - strangers.length >= 8, 'and most of them do not');
  ids.forEach(id => {
    const b = Openings.BONDS[id];
    t.ok(!!b.short && !!b.text && b.text.length > 60,
      id + ' tells the Dungeon Master enough to play it');
  });
}

t.section('every bond a scene asks for actually exists');
{
  /* Found by an independent review, not by anything here. `students` and
     `oath` were renamed to `school` and `order` when the vocation bonds were
     written, and nine scenes went on naming the old ids. `chooseBond`
     weighted a key that did not exist, the preference did nothing, and the
     library, the observatory and the barrow could never open the way they
     were written to. Nothing failed; the intent was simply unreachable. */
  const defined = Object.keys(Openings.BONDS);
  const dangling = [];
  Openings.OPENINGS.forEach(o => {
    (o.bonds || []).forEach(id => {
      if (defined.indexOf(id) < 0) dangling.push(o.id + ' -> ' + id);
    });
  });
  t.deep(dangling, [], 'no scene names a bond that was never written');
}

t.section('every opening carries the person with the problem');
{
  /* A session-one hook is a PERSON WANTING SOMETHING. Every scene authors
     one; for a long time not one of them reached the page. */
  const thin = Openings.OPENINGS.filter(o =>
    !o.localName || !o.localRole || !o.localWants || !o.localVoice ||
    !(o.lines && o.lines.length >= 2)).map(o => o.id);
  t.deep(thin, [],
    'every opening names somebody, says what they want, and gives them lines');
}

t.section('and world generation hands that person to the Dungeon Master');
{
  const s = seatedParty('local', [{ classId: 'cleric', levels: 2 }]);
  const o = Worldgen.generateOpening(s, { rng: new RNG('local') });
  t.ok(!!o.local, 'the opening returns the local');
  t.ok(!!o.local.name && !!o.local.wants,
    'with a name and something they want', JSON.stringify(o.local && o.local.name));
  t.ok((o.local.lines || []).length > 0, 'and words in their own mouth');
}

/* ------------------------------------------------------------------ */
t.section('every fight has a way out of it');
{
  /* This is D&D. A drawn blade is a negotiating position, and a Dungeon
     Master who is only told how the fight goes will only ever run the fight. */
  const missing = Openings.OPENINGS
    .filter(o => o.opens !== 'peaceful')
    .filter(o => !(o.outs && o.outs.length >= 3))
    .map(o => o.id);
  t.deep(missing, [],
    'every opening with something hostile in it names at least three ways it ' +
    'could end without blades');
}

/* ------------------------------------------------------------------ */
t.section('a companion can leave, and be asked back');
{
  const s = seatedParty('roster', [{ classId: 'fighter', levels: 3 }]);
  Companions.fillParty(s, { rng: new RNG('roster') });
  const companion = State.partyIds(s).filter(id => id !== 'pc1')[0];
  const before = State.partyIds(s).length;

  const go = (verb, target) => Dispatch.dispatch(s, State.makeHistory(), Command.create({
    sessionId: s.sessionId, stateRevision: s.revision, turnEpoch: s.turnEpoch,
    actorId: 'pc1', family: 'social',
    primary: Command.makeStep({ verb, targetIds: [target] }),
  }), {});

  go('part_ways', companion);
  t.eq(State.partyIds(s).length, before - 1, 'parting ways shrinks the party');
  t.ok(!!s.actors[companion],
    'but the person still EXISTS \u2014 they walked off, they were not deleted');
  t.eq(s.actors[companion].side, 'ally', 'and they are still friendly');

  const offered = (Dispatch.legalMoves(s, 'pc1', {}) || [])
    .filter(m => m.step && m.step.verb === 'recruit' && (m.step.targetIds || [])[0] === companion);
  t.ok(offered.length > 0, 'and asking them back is offered');

  go('recruit', companion);
  t.eq(State.partyIds(s).length, before, 'and they come back');
  t.eq(s.actors[companion].side, 'party', 'to the party proper');
  t.ok((s.actors[companion].partyHistory || []).length >= 2,
    'with both the leaving and the returning on the record');
}

t.section('but not if you have treated them badly enough');
{
  const s = seatedParty('grudge', [{ classId: 'fighter', levels: 3 }]);
  Companions.fillParty(s, { rng: new RNG('grudge') });
  const companion = State.partyIds(s).filter(id => id !== 'pc1')[0];

  const go = (verb) => Dispatch.dispatch(s, State.makeHistory(), Command.create({
    sessionId: s.sessionId, stateRevision: s.revision, turnEpoch: s.turnEpoch,
    actorId: 'pc1', family: 'social',
    primary: Command.makeStep({ verb, targetIds: [companion] }),
  }), {});

  go('part_ways');
  const first = go('recruit');
  t.eq(!!(first.batch && first.batch.refused), false,
    'one parting is forgivable \u2014 they come back the first time');

  /* Now grind the relationship down the way repeated mistreatment would. */
  Events.commit(s, (() => {
    const b = Events.makeBatch({ commandId: 'grudge', actorId: 'pc1' });
    Events.push(b, 'relationship', {
      fromId: companion, toId: 'pc1', affinity: -30, trust: -20,
      because: 'was left for dead',
    }, '');
    return b;
  })());

  go('part_ways');
  const again = go('recruit');
  t.ok(!!(again.batch && again.batch.refused),
    'but somebody treated badly enough will not come back');
  t.eq(again.batch.refused.reason, 'will-not-return', 'and the refusal says why');
  t.ok(!!s.actors[companion], 'they are still in the world, just not with you');
}

t.section('the roster is not settled mid-fight');
{
  const s = seatedParty('fight', [{ classId: 'fighter', levels: 3 }]);
  Companions.fillParty(s, { rng: new RNG('fight') });
  const companion = State.partyIds(s).filter(id => id !== 'pc1')[0];
  s.combat = { active: true, round: 1, order: [], turnIndex: 0 };

  const out = Dispatch.dispatch(s, State.makeHistory(), Command.create({
    sessionId: s.sessionId, stateRevision: s.revision, turnEpoch: s.turnEpoch,
    actorId: 'pc1', family: 'social',
    primary: Command.makeStep({ verb: 'part_ways', targetIds: [companion] }),
  }), {});

  t.ok(!!(out.batch && out.batch.refused), 'you cannot dismiss somebody mid-fight');
  t.eq(out.batch.refused.reason, 'in-combat',
    'because it would leave the initiative pointing at nobody');

  const offered = (Dispatch.legalMoves(s, 'pc1', {}) || [])
    .filter(m => m.step && /part_ways|recruit/.test(m.step.verb));
  t.deep(offered, [], 'and it is not even offered while blades are out');
}

t.section('a character somebody is playing is not yours to dismiss');
{
  const s = seatedParty('two', [{ classId: 'fighter', levels: 3 }, { classId: 'cleric', levels: 3 }]);
  const out = Dispatch.dispatch(s, State.makeHistory(), Command.create({
    sessionId: s.sessionId, stateRevision: s.revision, turnEpoch: s.turnEpoch,
    actorId: 'pc1', family: 'social',
    primary: Command.makeStep({ verb: 'part_ways', targetIds: ['pc2'] }),
  }), {});
  t.ok(!!(out.batch && out.batch.refused), 'dismissing another player is refused');
  t.eq(out.batch.refused.reason, 'is-a-player', 'because they belong to a person');
}

t.done();
