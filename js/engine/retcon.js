/*
 * retcon.js — amending the record.
 *
 * Every real table does this. A player says "wait, I'd have bought rope in
 * town, can we say I did?", or "hang on, you said the door was unlocked", and
 * the Dungeon Master rules on it and play continues. It is one of the things
 * that most distinguishes a table from a computer game, and none of it was
 * possible here: the log was append-only and the only correction available was
 * undo, which throws away everything that came after.
 *
 * A retcon is NOT an undo. Undo rewinds; a retcon reaches back and establishes
 * that something was already true, leaving everything since intact. So it is
 * committed FORWARD, as an ordinary event batch, and the world simply contains
 * the rope from now on. That keeps replay, export and undo all working, and it
 * means the amendment itself is visible in the record rather than silently
 * rewriting history — which is what a table does too, out loud.
 *
 * The model proposes and this module disposes. A 4B model asked whether the
 * player may retroactively have bought a rope will happily also grant them a
 * +3 holy avenger and 40,000 gold pieces if the sentence is phrased
 * confidently enough, so every limit here is enforced in code. The model's
 * judgement is advisory about what is REASONABLE; it has no authority over
 * what is POSSIBLE.
 */
(function (global) {
  'use strict';

  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);

  function data() {
    var g = global;
    if (g.DND && g.DND.Data && g.DND.Data.ITEMS) return g.DND.Data;
    if (typeof require !== 'undefined') {
      try { return { ITEMS: require('../data/srd_items.js').ITEMS }; }
      catch (e) { return {}; }
    }
    return {};
  }

  /* --------------------------------------------------------------- limits --
     Deliberately conservative. A retcon is for the things a player could
     plausibly have done off-screen, not a wish. Anything bigger is a story
     beat and should be played out, which is more fun anyway. */
  var LIMITS = {
    gold: 250,             // gp moved in either direction, per retcon
    items: 3,              // separate items established at once
    itemGoldValue: 150,    // an established item cannot be worth more than this
    hp: 20,                // hit points corrected in either direction
    changes: 6,            // total changes in one retcon
    /* Rarities a retcon may conjure. Anything rarer is treasure, and treasure
       is something you find, not something you remember having. */
    rarities: ['common', 'uncommon', null, undefined, ''],
  };

  /* Things a retcon may never do, however reasonable the model finds them. */
  var FORBIDDEN = {
    level: 'Levels are earned in play, not remembered into existence.',
    ability_change: 'Ability scores cannot be retconned.',
    revive: 'Bringing back the dead is a story, not a correction.',
    xp: 'Experience is awarded for what actually happened.',
  };

  function actorOf(state, id) { return (state.actors || {})[id] || null; }

  function itemDef(idOrName) {
    var ITEMS = data().ITEMS || {};
    if (!idOrName) return null;
    var key = String(idOrName).toLowerCase().replace(/\s+/g, '-');
    if (ITEMS[key]) return ITEMS[key];
    var wanted = String(idOrName).toLowerCase();
    var hit = Object.keys(ITEMS).filter(function (k) {
      return String(ITEMS[k].name || '').toLowerCase() === wanted;
    })[0];
    return hit ? ITEMS[hit] : null;
  }

  function goldValueOf(def) {
    if (!def) return 0;
    var c = def.cost || def.value || null;
    if (typeof c === 'number') return c;
    if (c && typeof c === 'object') {
      var n = c.amount || c.qty || 0;
      var unit = String(c.unit || c.currency || 'gp').toLowerCase();
      if (unit === 'cp') return n / 100;
      if (unit === 'sp') return n / 10;
      if (unit === 'pp') return n * 10;
      return n;
    }
    var m = String(c || '').match(/([\d,.]+)\s*(cp|sp|gp|pp)/i);
    if (!m) return 0;
    var v = parseFloat(m[1].replace(/,/g, '')) || 0;
    var u = m[2].toLowerCase();
    return u === 'cp' ? v / 100 : u === 'sp' ? v / 10 : u === 'pp' ? v * 10 : v;
  }

  /**
   * Decide what a proposed retcon is actually allowed to do.
   *
   * Returns the accepted changes, the refused ones WITH REASONS, and whether
   * anything survives. Refusals are kept rather than dropped because the
   * player needs to be told what was trimmed and why — silently granting
   * three of five requested changes is how a player ends up believing they
   * have a rope they do not have.
   */
  function validate(state, proposal) {
    proposal = proposal || {};
    var changes = Array.isArray(proposal.changes) ? proposal.changes : [];
    var accepted = [];
    var refused = [];
    var goldMoved = 0;
    var hpMoved = 0;
    var itemsAdded = 0;

    function refuse(c, why) { refused.push({ change: c, reason: why }); }

    changes.forEach(function (c) {
      if (!c || !c.type) return refuse(c, 'malformed change');
      if (accepted.length >= LIMITS.changes) {
        return refuse(c, 'a single retcon may make at most ' + LIMITS.changes + ' changes');
      }
      if (FORBIDDEN[c.type]) return refuse(c, FORBIDDEN[c.type]);

      var who = c.actorId ? actorOf(state, c.actorId) : null;
      if (c.type !== 'flag' && c.type !== 'note' && !who) {
        return refuse(c, 'no such character: ' + c.actorId);
      }

      switch (c.type) {
        case 'item': {
          if (c.op === 'lose') { accepted.push(c); return; }
          if (itemsAdded >= LIMITS.items) {
            return refuse(c, 'at most ' + LIMITS.items + ' items per retcon');
          }
          var def = itemDef(c.itemId || c.name);
          if (!def) return refuse(c, 'no such item: ' + (c.itemId || c.name));
          var rarity = def.rarity || null;
          if (LIMITS.rarities.indexOf(rarity) < 0) {
            return refuse(c, 'a ' + rarity + ' item is treasure to be found, not remembered');
          }
          var worth = goldValueOf(def);
          if (worth > LIMITS.itemGoldValue) {
            return refuse(c, def.name + ' is worth ' + worth + ' gp, beyond what a retcon may conjure');
          }
          itemsAdded++;
          accepted.push(Object.assign({}, c, { resolved: def, worth: worth }));
          return;
        }
        case 'gold': {
          var d = Number(c.delta) || 0;
          if (!d) return refuse(c, 'no amount given');
          if (Math.abs(goldMoved + d) > LIMITS.gold) {
            return refuse(c, 'a retcon may move at most ' + LIMITS.gold + ' gp');
          }
          /* Cannot spend what was never there. */
          if (d < 0 && (who.runtime.gold || 0) + d < 0) {
            return refuse(c, who.name + ' never had that much to spend');
          }
          goldMoved += d;
          accepted.push(c);
          return;
        }
        case 'hp': {
          var h = Number(c.delta) || 0;
          if (!h) return refuse(c, 'no amount given');
          if (Math.abs(hpMoved + h) > LIMITS.hp) {
            return refuse(c, 'a retcon may correct at most ' + LIMITS.hp + ' hit points');
          }
          hpMoved += h;
          accepted.push(c);
          return;
        }
        case 'fact':
          if (!c.text && !c.factId) return refuse(c, 'a fact needs something to say');
          accepted.push(c);
          return;
        case 'relationship':
        case 'flag':
        case 'quest':
        case 'condition':
        case 'note':
          accepted.push(c);
          return;
        default:
          return refuse(c, 'a retcon cannot change ' + c.type);
      }
    });

    return {
      ok: accepted.length > 0 || !!proposal.summary,
      accepted: accepted,
      refused: refused,
      /* Purely narrative retcons are legal and common — "we'd have made camp
         by the river" changes nothing mechanically and is still worth
         recording, so an empty change list is not a failure. */
      narrativeOnly: accepted.length === 0,
    };
  }

  /**
   * Turn an approved retcon into events.
   *
   * The `retcon` event itself is the audit record: what was amended, who
   * asked, and what the Dungeon Master said about it. The rest are ordinary
   * events, so nothing downstream needs to know a retcon happened — the rope
   * arrives in the pack by exactly the same path a bought rope would.
   */
  function toEvents(state, proposal, verdict, meta) {
    meta = meta || {};
    var out = [];

    out.push({
      kind: 'retcon',
      actorId: meta.actorId || null,
      summary: proposal.summary || '',
      request: meta.request || '',
      ruling: proposal.reason || '',
      accepted: verdict.accepted.length,
      refused: verdict.refused.map(function (r) { return r.reason; }),
      at: meta.at || null,
    });

    verdict.accepted.forEach(function (c) {
      switch (c.type) {
        case 'item':
          if (c.op === 'lose') {
            out.push({ kind: 'item_lose', actorId: c.actorId, uid: c.uid });
          } else {
            var def = c.resolved || {};
            var n = Math.max(1, Math.min(10, Number(c.qty) || 1));
            for (var i = 0; i < n; i++) {
              out.push({
                kind: 'item_gain', actorId: c.actorId,
                item: {
                  uid: 'rc_' + (def.id || 'item') + '_' + Math.random().toString(36).slice(2, 8),
                  id: def.id, name: def.name,
                  category: def.category, subcategory: def.subcategory,
                  weight: def.weight, cost: def.cost,
                  /* Marked so an export shows plainly which possessions were
                     established rather than found or bought in play. */
                  retconned: true,
                },
              });
            }
          }
          break;
        case 'gold':
          out.push({ kind: 'gold', actorId: c.actorId, delta: Number(c.delta) || 0, reason: 'retcon' });
          break;
        case 'hp':
          out.push({ kind: 'hp', targetId: c.actorId, delta: Number(c.delta) || 0, reason: 'retcon' });
          break;
        case 'fact':
          out.push({
            kind: 'knowledge',
            observerId: c.observerId || c.actorId || meta.actorId,
            factId: c.factId || ('rc_fact_' + Math.random().toString(36).slice(2, 8)),
            stage: c.stage || 'full',
            provenance: 'established by the Dungeon Master',
            text: c.text || '',
          });
          break;
        case 'relationship':
          out.push({
            kind: 'relationship', actorId: c.actorId, targetId: c.targetId,
            delta: Number(c.delta) || 0, reason: 'retcon',
          });
          break;
        case 'flag':
          out.push({ kind: 'flag', key: c.key, value: c.value });
          break;
        case 'quest':
          out.push({ kind: 'quest', questId: c.questId, status: c.status, note: c.note || '' });
          break;
        case 'condition':
          out.push(c.remove
            ? { kind: 'condition_remove', targetId: c.actorId, condition: c.condition }
            : { kind: 'condition_add', targetId: c.actorId, condition: c.condition, source: 'retcon' });
          break;
        default:
          break;
      }
    });

    return out;
  }

  /**
   * Everything at once: validate, build, and describe in plain words.
   *
   * The description is what the player is shown before it is applied, because
   * a retcon that happens silently is indistinguishable from a bug.
   */
  function prepare(state, proposal, meta) {
    var verdict = validate(state, proposal);
    return {
      verdict: verdict,
      events: verdict.ok ? toEvents(state, proposal, verdict, meta) : [],
      describe: describe(state, proposal, verdict),
    };
  }

  function describe(state, proposal, verdict) {
    var lines = [];
    if (proposal.summary) lines.push(proposal.summary);
    if (proposal.reason) lines.push('Ruling: ' + proposal.reason);

    verdict.accepted.forEach(function (c) {
      var who = actorOf(state, c.actorId);
      var name = who ? who.name : 'the party';
      if (c.type === 'item') {
        lines.push(c.op === 'lose'
          ? '\u2022 ' + name + ' no longer has that item.'
          : '\u2022 ' + name + ' has ' + (Number(c.qty) > 1 ? c.qty + ' \u00d7 ' : '') +
            ((c.resolved && c.resolved.name) || c.itemId) + '.');
      } else if (c.type === 'gold') {
        var d = Number(c.delta) || 0;
        lines.push('\u2022 ' + name + (d >= 0 ? ' gains ' : ' spent ') + Math.abs(d) + ' gp.');
      } else if (c.type === 'hp') {
        var h = Number(c.delta) || 0;
        lines.push('\u2022 ' + name + (h >= 0 ? ' recovers ' : ' loses ') + Math.abs(h) + ' hit points.');
      } else if (c.type === 'fact') {
        lines.push('\u2022 Established: ' + (c.text || c.factId));
      } else if (c.type === 'note') {
        lines.push('\u2022 ' + (c.text || 'Noted.'));
      } else {
        lines.push('\u2022 ' + c.type + ' updated.');
      }
    });

    if (verdict.narrativeOnly && !verdict.refused.length) {
      lines.push('Nothing on any character sheet changes \u2014 this is a change to the story only.');
    }
    verdict.refused.forEach(function (r) {
      lines.push('\u2717 Refused: ' + r.reason);
    });
    return lines.join('\n');
  }

  var api = {
    LIMITS: LIMITS, FORBIDDEN: FORBIDDEN,
    validate: validate, toEvents: toEvents, prepare: prepare, describe: describe,
    itemDef: itemDef, goldValueOf: goldValueOf,
  };

  if (typeof module === 'object' && module.exports) module.exports = api;
  global.DND = global.DND || {};
  global.DND.Retcon = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
