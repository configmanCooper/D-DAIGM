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

  /* Punctuation-insensitive slug. The model writes "healer's-kit" and the
     data has "healers-kit"; matching on the raw string refused an ordinary
     five-gold item during a live run because of a single apostrophe. */
  function slug(s) {
    return String(s || '').toLowerCase()
      .replace(/[\u2018\u2019']/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /* "extra-torches" is two torches. Crude on purpose: enough for the plurals
     a model actually writes, and it only ever runs as a last resort after
     every exact match has failed. */
  function singular(w) {
    if (!w || w.length < 4) return w;
    if (/(ch|sh|ss|x|z)es$/.test(w)) return w.slice(0, -2);
    if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
    if (/[^s]s$/.test(w)) return w.slice(0, -1);
    return w;
  }

  /* Built once per item table: two flat maps from normalised slug to item,
     so a lookup is not a linear scan of four hundred entries per change. */
  var slugIndex = null;
  function indexed() {
    var ITEMS = data().ITEMS || {};
    if (slugIndex && slugIndex.forTable === ITEMS) return slugIndex;
    slugIndex = { forTable: ITEMS, byId: {}, byName: {} };
    Object.keys(ITEMS).forEach(function (k) {
      var sid = slug(k);
      if (sid && !slugIndex.byId[sid]) slugIndex.byId[sid] = ITEMS[k];
      var sn = slug(ITEMS[k].name);
      if (sn && !slugIndex.byName[sn]) slugIndex.byName[sn] = ITEMS[k];
    });
    return slugIndex;
  }

  /* Words that carry no identity of their own, ignored when matching an item
     by its words rather than its exact name. */
  var STOPWORDS = {
    of: 1, the: 1, a: 1, an: 1, and: 1, s: 1,
    small: 1, large: 1, common: 1, ordinary: 1, simple: 1, basic: 1, standard: 1,
    new: 1, old: 1, plain: 1, one: 1,
  };

  function itemDef(idOrName) {
    var ITEMS = data().ITEMS || {};
    if (!idOrName) return null;
    if (ITEMS[idOrName]) return ITEMS[idOrName];

    var idx = indexed();
    var key = slug(idOrName);
    if (!key) return null;
    if (idx.byId[key]) return idx.byId[key];
    if (idx.byName[key]) return idx.byName[key];

    /* The model invents plausible-looking slugs — "waterskin-full" for a
       waterskin, "rope-coil" for rope, "rations-dried" for rations — and
       refusing those loses a reasonable amendment on a spelling.
       ONE trailing qualifier may be dropped, and no more. Every real case
       observed needs exactly one; allowing more let
       "sword-of-infinite-plot-armour" trim all the way down to "sword" and
       resolve to the Sword of Life Stealing, which is a made-up name
       silently becoming a real magic weapon. */
    var parts = key.split('-').filter(Boolean);
    if (parts.length > 1) {
      parts.pop();
      var shorter = parts.join('-');
      if (idx.byId[shorter]) return idx.byId[shorter];
      if (idx.byName[shorter]) return idx.byName[shorter];
      var head = Object.keys(idx.byId).filter(function (k) {
        return k.indexOf(shorter + '-') === 0;
      })[0];
      if (head) return idx.byId[head];
      var headName = Object.keys(idx.byName).filter(function (k) {
        return k.indexOf(shorter + '-') === 0;
      })[0];
      if (headName) return idx.byName[headName];
    }

    /* Word order last of all.
       Live runs produced "healing-potion-small" for a Potion of Healing:
       the right words, the wrong order, and every prefix rule above misses
       it. A candidate matches only if EVERY meaningful word of its own name
       appears in what was asked for — which is the safe direction. Asking for
       "potion" cannot match "Potion of Healing", because "healing" is not in
       the request; and "sword-of-infinite-plot-armour" cannot match the Sword
       of Life Stealing, because "life" and "stealing" are not in the request
       either. Where several fit, the most specific wins. */
    var asked = {};
    key.split('-').forEach(function (w) { if (w && !STOPWORDS[w]) asked[w] = true; });
    if (Object.keys(asked).length >= 2) {
      var best = null, bestScore = 0;
      Object.keys(idx.byName).forEach(function (candidate) {
        var words = candidate.split('-').filter(function (w) { return w && !STOPWORDS[w]; });
        if (words.length < 2) return;
        for (var i = 0; i < words.length; i++) if (!asked[words[i]]) return;
        if (words.length > bestScore) { bestScore = words.length; best = idx.byName[candidate]; }
      });
      if (best) return best;
    }

    /* Head noun, last of all.
       "ash-vial" is a vial. A SINGLE-word candidate matches only when it is
       the last meaningful word of the request, which is where English puts
       the head noun. Of the 113 one-word items in the data only two are above
       common rarity, and both are refused on rarity anyway, so this cannot
       smuggle treasure in: "sword-of-infinite-plot-armour" ends in "armour"
       and nothing is called that. */
    var meaningful = Object.keys(asked);
    if (meaningful.length >= 2) {
      var tail = key.split('-').filter(function (w) { return w && !STOPWORDS[w]; });
      var head = tail[tail.length - 1];
      if (head && idx.byName[head]) return idx.byName[head];
      if (head && idx.byId[head]) return idx.byId[head];
      var one = singular(head);
      if (one !== head) {
        if (idx.byName[one]) return idx.byName[one];
        if (idx.byId[one]) return idx.byId[one];
      }
    }
    return null;
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
  function validate(state, proposal, meta) {
    proposal = proposal || {};
    meta = meta || {};
    var changes = Array.isArray(proposal.changes) ? proposal.changes : [];
    var accepted = [];
    var refused = [];
    var goldMoved = 0;
    var hpMoved = 0;
    var itemsAdded = 0;

    function refuse(c, why, malformed) {
      refused.push({ change: c, reason: why, malformed: !!malformed });
    }

    changes.forEach(function (rawChange) {
      var c = rawChange;
      if (!c || !c.type) return refuse(c, 'malformed change', true);

      /* Fill in what the model reliably leaves out.
         Observed against the live model on every single well-formed request:
         it writes a perfect summary and ruling and then omits `actorId` from
         the changes, so a legitimate "can we say I bought rope in Ashford"
         was accepted by the Dungeon Master and then refused by the engine
         with "that change has to name whose it is" — the rope never reached
         the pack. The asking character is the obvious subject, and a fact
         with no text of its own is the summary. Defaulting here is far more
         reliable than asking the model again more firmly. */
      c = Object.assign({}, c);
      if (!c.actorId && meta.actorId) c.actorId = meta.actorId;
      if ((c.type === 'fact' || c.type === 'note') && !c.text) {
        c.text = proposal.summary || '';
      }

      if (accepted.length >= LIMITS.changes) {
        return refuse(c, 'a single retcon may make at most ' + LIMITS.changes + ' changes');
      }
      if (FORBIDDEN[c.type]) return refuse(c, FORBIDDEN[c.type]);

      /* Only the changes that actually act ON somebody need a character. A
         fact, a note, a flag or a quest belongs to the world, and a
         relationship names its two sides itself. Demanding an actorId for all
         of them refused every purely narrative amendment with "no such
         character: undefined", which is the commonest kind there is. */
      var NEEDS_ACTOR = { item: 1, gold: 1, hp: 1, condition: 1 };
      var who = c.actorId ? actorOf(state, c.actorId) : null;
      if (NEEDS_ACTOR[c.type] && !who) {
        return refuse(c, c.actorId
          ? 'no such character: ' + c.actorId
          : 'that change has to name whose it is', true);
      }

      switch (c.type) {
        case 'item': {
          if (c.op === 'lose') { accepted.push(c); return; }
          if (itemsAdded >= LIMITS.items) {
            return refuse(c, 'at most ' + LIMITS.items + ' items per retcon');
          }
          var def = itemDef(c.itemId || c.name);
          if (!def) return refuse(c, 'no such item: ' + (c.itemId || c.name), true);
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
          if (!d) return refuse(c, 'no amount given', true);
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
          if (!h) return refuse(c, 'no amount given', true);
          if (Math.abs(hpMoved + h) > LIMITS.hp) {
            return refuse(c, 'a retcon may correct at most ' + LIMITS.hp + ' hit points');
          }
          hpMoved += h;
          accepted.push(c);
          return;
        }
        case 'fact':
          if (!c.text) return refuse(c, 'a fact needs something to say', true);
          accepted.push(c);
          return;
        case 'relationship':
          if (!c.fromId || !c.toId) return refuse(c, 'a relationship needs both sides', true);
          if (!actorOf(state, c.fromId) || !actorOf(state, c.toId)) {
            return refuse(c, 'no such character in that relationship');
          }
          accepted.push(c);
          return;
        case 'flag':
          if (!c.flag) return refuse(c, 'a flag needs a name', true);
          accepted.push(c);
          return;
        case 'quest':
        case 'condition':
        case 'note':
          accepted.push(c);
          return;
        default:
          return refuse(c, 'a retcon cannot change ' + c.type);
      }
    });

    /* A refusal because the model wrote the change badly is not the same as a
       refusal because the change was not allowed. Live runs produced both: an
       hp correction with no amount in it (good faith, malformed) alongside a
       holy avenger and fifty thousand gold (denied). Treating them alike lost
       reasonable amendments on a missing field while the protection that
       matters is only about the denied kind. */
    var denied = refused.filter(function (r) { return !r.malformed; });

    return {
      /* A proposal whose changes were all DENIED is a refusal, not a
         narrative amendment. Treating those as "narrative only" meant the
         greedy case came back allowed: the sword and the fortune were both
         thrown out, nothing was left, and the summary "Bram has a legendary
         holy avenger and fifty thousand gold" was recorded as settled truth
         and fed to the Dungeon Master as fact from then on. */
      ok: accepted.length > 0 || (!!proposal.summary && denied.length === 0),
      accepted: accepted,
      refused: refused,
      denied: denied,
      /* Purely narrative retcons are legal and common — "we'd have made camp
         by the river" changes nothing mechanically and is still worth
         recording. But it has to be a proposal that never asked for anything
         mechanical, not one that asked and was told no. */
      narrativeOnly: accepted.length === 0 && refused.length === 0,
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
      /* The established truths travel here, where the narrator's prompt can
         read them back as things that are simply so. */
      establishes: verdict.accepted
        .filter(function (c) { return c.type === 'fact' || c.type === 'note'; })
        .map(function (c) { return c.text; })
        .filter(Boolean),
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
          /* Established truths ride on the `retcon` event itself rather than
             through `knowledge`. That event writes to `state.knowledge`, while
             the text of a fact lives in the campaign's separate fact store as a
             `claim`/`partial`/`hint` triple — so a knowledge event naming a
             factId nothing has ever defined records a stage against text that
             does not exist, and reads back as nothing at all. */
          break;
        case 'relationship':
          out.push({
            kind: 'relationship',
            fromId: c.fromId, toId: c.toId,
            affinity: Number(c.affinity) || 0,
            trust: Number(c.trust) || 0,
            fear: Number(c.fear) || 0,
            respect: Number(c.respect) || 0,
            because: c.because || 'established by the Dungeon Master',
          });
          break;
        case 'flag':
          out.push({ kind: 'flag', flag: c.flag, value: c.value });
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
    var verdict = validate(state, proposal, meta);
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
