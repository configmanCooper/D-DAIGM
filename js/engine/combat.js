/*
 * combat.js — the stateful turn loop, and the geometry the UI is forbidden to
 * re-implement.
 *
 * Everything here obeys the one law of this engine: a resolver reads a state
 * snapshot, rolls from `state.rng`, and returns an EventBatch. It never mutates
 * state — `dispatch()` commits the batch, atomically, after the dice are cast.
 * That is why an AI seat and a human clicking a button cannot do different
 * things: they both arrive as a GameCommand and leave as the same committed
 * events.
 *
 * The geometry functions (line of sight, cover, area templates, movement cost)
 * are pure and exported for the UI to import directly. When the sibling project
 * let the interface draw its own cover lines while the engine computed its own,
 * the picture and the maths disagreed and players were told they were safe
 * while the die said otherwise. So the picture and the maths are the same code.
 */
(function (global) {
  'use strict';

  var Dice = (global.DND && global.DND.Dice) ||
    (typeof require !== 'undefined' ? require('./dice.js') : null);
  var Events = (global.DND && global.DND.Events) ||
    (typeof require !== 'undefined' ? require('./events.js') : null);
  var Rules = (global.DND && global.DND.Rules) ||
    (typeof require !== 'undefined' ? require('./rules.js') : null);
  var Effects = (global.DND && global.DND.Effects) ||
    (typeof require !== 'undefined' ? require('./effects.js') : null);
  var Dispatch = (global.DND && global.DND.Dispatch) ||
    (typeof require !== 'undefined' ? require('./dispatch.js') : null);
  var Command = (global.DND && global.DND.Command) ||
    (typeof require !== 'undefined' ? require('./command.js') : null);

  var CELL = 5;   // one grid square is five feet, everywhere, no exceptions

  function actor(state, id) { return (state.actors && state.actors[id]) || null; }

  /* ============================================================ geometry ===
     All positions are square coordinates: integer {x, y}, one unit per 5 ft.
     A square's CENTRE in feet is ((x + 0.5) * 5, (y + 0.5) * 5); a grid
     INTERSECTION (where AoE templates are anchored) is (x * 5, y * 5). Keeping
     the two straight is most of what makes area effects reproducible. */

  function centreFt(sq) { return { x: (sq.x + 0.5) * CELL, y: (sq.y + 0.5) * CELL }; }

  function euclidFt(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* Chebyshev movement (the PHB default we have committed to): every step,
     orthogonal or diagonal, costs 5 ft. Chosen over the optional 5-10-5 rule
     because it is the one the reference module uses and because it keeps
     movement cost, reach and opportunity-attack ranges all measured the same
     way — a diagonal that is 5 ft for movement but 7.5 ft for reach is exactly
     the sort of inconsistency that breeds combat bugs. */
  function chebyshevSquares(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }
  function chebyshevFt(a, b) { return chebyshevSquares(a, b) * CELL; }

  /* Squares covered by a spherical burst centred on a grid intersection. A
     square is in the area if its centre is within the radius — the standard
     grid ruling. */
  function squaresInSphere(centreIntersection, radiusFt) {
    var c = { x: centreIntersection.x * CELL, y: centreIntersection.y * CELL };
    var reach = Math.ceil(radiusFt / CELL) + 1;
    var out = [];
    for (var x = centreIntersection.x - reach; x < centreIntersection.x + reach; x++) {
      for (var y = centreIntersection.y - reach; y < centreIntersection.y + reach; y++) {
        var ctr = centreFt({ x: x, y: y });
        if (euclidFt(ctr, c) <= radiusFt + 1e-9) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  /* Squares covered by a cone whose point is at a grid intersection. 5e cones
     are as wide at any point as they are far from the origin, which is a
     half-angle whose tangent is 1/2. `dir` is a unit-ish vector giving the
     axis; a corner-origin cone down the +x axis uses {x:1,y:0}. */
  function squaresInCone(originIntersection, dir, lengthFt) {
    var o = { x: originIntersection.x * CELL, y: originIntersection.y * CELL };
    var len = Math.sqrt(dir.x * dir.x + dir.y * dir.y) || 1;
    var ux = dir.x / len, uy = dir.y / len;
    var halfTan = 0.5;                    // width == distance  ->  half-width == distance/2
    var reach = Math.ceil(lengthFt / CELL) + 1;
    var out = [];
    for (var x = originIntersection.x - reach; x < originIntersection.x + reach; x++) {
      for (var y = originIntersection.y - reach; y < originIntersection.y + reach; y++) {
        var ctr = centreFt({ x: x, y: y });
        var vx = ctr.x - o.x, vy = ctr.y - o.y;
        var along = vx * ux + vy * uy;                 // projection onto the axis
        if (along <= 0 || along > lengthFt + 1e-9) continue;
        var perp = Math.abs(vx * uy - vy * ux);        // distance off the axis
        if (perp <= along * halfTan + 1e-9) out.push({ x: x, y: y });
      }
    }
    return out;
  }

  /* ------------------------------------------------------- movement cost --- */

  /* Cost in feet to walk a path (a list of squares, step by step). Entering a
     difficult-terrain square costs double; `difficult(sq)` reports it. Uses
     Chebyshev, so a diagonal step is the same 5 ft as an orthogonal one. */
  /**
   * What a path costs, in feet.
   *
   * Extra costs are ADDITIVE, not multiplicative: a foot of climbing through
   * difficult terrain costs three feet (one base, one for the climb, one for
   * the terrain), not four. Doubling the difficult-terrain cost and then
   * doubling the result again for climbing charged four, which is a whole
   * extra square of movement on every square of a bad ascent.
   *
   * `extras` is how many EXTRA feet each foot costs beyond the first, from
   * causes other than terrain — one for climbing, swimming or crawling.
   */
  function pathCost(path, opts) {
    opts = opts || {};
    var difficult = opts.difficult || function () { return false; };
    var extras = opts.extras || 0;
    var cost = 0;
    for (var i = 1; i < path.length; i++) {
      var step = chebyshevSquares(path[i - 1], path[i]);
      if (step > 1) return { cost: Infinity, illegal: true, at: i };   // teleport, not a walk
      var multiples = 1 + extras + (difficult(path[i]) ? 1 : 0);
      cost += CELL * multiples;
    }
    return { cost: cost, illegal: false };
  }

  /* ------------------------------------------------- opportunity attacks --- */

  /* An opportunity attack is provoked by LEAVING an enemy's reach on foot. It
     is NOT provoked by moving around while staying in reach, and NOT provoked
     at all if the mover took the Disengage action. */
  function provokesOpportunity(from, to, enemyPos, opts) {
    opts = opts || {};
    if (opts.disengage) return false;
    var reach = opts.reachFt || CELL;
    var wasInReach = chebyshevFt(from, enemyPos) <= reach;
    var nowInReach = chebyshevFt(to, enemyPos) <= reach;
    return wasInReach && !nowInReach;
  }

  /* --------------------------------------------------- line of sight/cover -
     Cover is decided corner to corner: from the attacker's best corner, draw a
     line to each of the target square's four corners. Count how many are
     blocked by an obstacle. Two blocked is half cover, three is three-quarters,
     four is total (and the target cannot be targeted directly at all). The UI
     imports this so the drawn lines and the applied bonus are the same fact. */

  function corners(sq) {
    return [
      { x: sq.x * CELL, y: sq.y * CELL },
      { x: (sq.x + 1) * CELL, y: sq.y * CELL },
      { x: sq.x * CELL, y: (sq.y + 1) * CELL },
      { x: (sq.x + 1) * CELL, y: (sq.y + 1) * CELL },
    ];
  }

  /* Does segment a->b pass through the interior of the box for square `sq`?
     Grazing an edge (a line that only touches the boundary) does not count as
     blocked, which is why the slab test uses strict inequalities on entry. */
  function segmentBlocksSquare(a, b, sq) {
    var minX = sq.x * CELL, maxX = (sq.x + 1) * CELL;
    var minY = sq.y * CELL, maxY = (sq.y + 1) * CELL;
    var dx = b.x - a.x, dy = b.y - a.y;
    var t0 = 0, t1 = 1;
    var checks = [
      { p: -dx, q: a.x - minX },
      { p: dx, q: maxX - a.x },
      { p: -dy, q: a.y - minY },
      { p: dy, q: maxY - a.y },
    ];
    for (var i = 0; i < checks.length; i++) {
      var p = checks[i].p, q = checks[i].q;
      if (Math.abs(p) < 1e-12) {
        if (q < 0) return false;               // parallel and outside the slab
      } else {
        var r = q / p;
        if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; }
        else { if (r < t0) return false; if (r < t1) t1 = r; }
      }
    }
    /* A positive-length overlap inside (t0, t1) means the segment genuinely
       crosses the box rather than merely clipping a corner. */
    return t1 - t0 > 1e-9;
  }

  function lineOfSightCover(attackerPos, targetPos, blockers) {
    blockers = blockers || [];
    var attCorners = corners(attackerPos);
    var tgtCorners = corners(targetPos);
    var best = 4;
    /* The attacker chooses the corner that gives them the cleanest shot, so we
       take the minimum number of blocked target corners over all four. */
    for (var a = 0; a < attCorners.length; a++) {
      var blocked = 0;
      for (var c = 0; c < tgtCorners.length; c++) {
        var hit = false;
        for (var b = 0; b < blockers.length; b++) {
          var bl = blockers[b];
          if ((bl.x === attackerPos.x && bl.y === attackerPos.y) ||
              (bl.x === targetPos.x && bl.y === targetPos.y)) continue;
          if (segmentBlocksSquare(attCorners[a], tgtCorners[c], bl)) { hit = true; break; }
        }
        if (hit) blocked++;
      }
      if (blocked < best) best = blocked;
    }
    var level = best >= 4 ? 'total' : best === 3 ? 'three-quarters' : best === 2 ? 'half' : 'none';
    var bonus = Rules ? Rules.coverBonus(level) : { ac: 0, dexSave: 0, untargetable: level === 'total' };
    return { blockedCorners: best, level: level, ac: bonus.ac, dexSave: bonus.dexSave, untargetable: bonus.untargetable };
  }

  function hasLineOfSight(attackerPos, targetPos, blockers) {
    return lineOfSightCover(attackerPos, targetPos, blockers).level !== 'total';
  }

  /* ============================================================ economy ====
     Small readers over runtime.turn so every seat asks the same question the
     same way. `runtime.turn` is owned by the turn_start / turn_end / action_
     economy appliers; nothing here writes it. */

  function turnOf(a) { return a && a.runtime && a.runtime.turn; }

  /* Outside an encounter there is no action economy: nobody is counting your
     actions while you walk across a village. A missing `runtime.turn` therefore
     means "unconstrained", not "may do nothing" — reading it the other way left
     an out-of-combat character with no legal moves at all, which silently
     stalled every AI seat in exploration. */
  /**
   * Conditions that stop a creature acting at all.
   *
   * 2014: an incapacitated creature can take no actions and no reactions, and
   * stunned, paralyzed, petrified and unconscious all include incapacitated.
   * None of this was checked — the gates looked only at whether the turn's
   * action flag was still set — so a stunned creature took its turn normally
   * and every condition that should end a fight was decoration.
   */
  var INCAPACITATING = {
    incapacitated: 1, stunned: 1, paralyzed: 1, petrified: 1, unconscious: 1,
  };

  function incapacitated(a) {
    var c = a && a.runtime && a.runtime.conditions;
    if (!c) return false;
    for (var k in INCAPACITATING) {
      if (Object.prototype.hasOwnProperty.call(c, k) && c[k]) return true;
    }
    return false;
  }

  function canAct(a) {
    if (incapacitated(a)) return false;
    var t = turnOf(a); return t ? !!t.action : true;
  }
  function canBonus(a) {
    if (incapacitated(a)) return false;
    var t = turnOf(a); return t ? !!t.bonus : true;
  }
  function canReact(a) {
    if (incapacitated(a)) return false;
    var t = turnOf(a); return t ? !!t.reaction : true;
  }
  function movementLeft(a) {
    var t = turnOf(a);
    if (t) return t.movementRemaining;
    return (a && a.runtime && a.runtime.speed) || 30;
  }
  function isSurprised(a) { var t = turnOf(a); return !!(t && t.surprised); }

  /* ======================================================= two-weapon ======
     The off-hand attack of two-weapon fighting adds NO ability modifier to its
     damage — unless the modifier is negative (a penalty always applies) or the
     Two-Weapon Fighting style has removed the restriction. */
  /**
   * Can this character fight with two weapons at all?
   *
   * 2014, "Two-Weapon Fighting": you must be wielding two LIGHT MELEE weapons,
   * one in each hand. Nothing checked, so the bar offered an off-hand strike to
   * a rogue holding a rapier — which is finesse but not light — and to anyone
   * holding a single weapon and nothing else.
   */
  function twoWeaponEligible(state, actorId) {
    var a = actor(state, actorId);
    if (!a) return null;
    var list = a.runtime.attacks || [];
    var eq = a.runtime.equipped || {};
    var find = function (ref) {
      if (!ref) return null;
      return list.filter(function (w) { return w && (w.uid === ref || w.id === ref); })[0] || null;
    };
    var main = find(eq.mainHand) || list.filter(function (w) { return w && !w.unarmed; })[0];
    var off = find(eq.offHand);
    if (!main || !off || main === off) return null;

    var light = function (w) { return (w.properties || []).indexOf('light') >= 0; };
    var melee = function (w) {
      /* A thrown weapon is still a melee weapon; what disqualifies you is a
         weapon that can ONLY be used at range. The data marks a dagger
         `ranged: true` because it can be thrown, so the thrown property is
         what rescues it. */
      if (!w.ranged) return true;
      return (w.properties || []).indexOf('thrown') >= 0;
    };
    if (!light(main) || !light(off)) return null;
    if (!melee(main) || !melee(off)) return null;
    return { main: main, off: off };
  }

  function twoWeaponDamageBonus(abilityMod, opts) {
    opts = opts || {};
    if (opts.twoWeaponFightingStyle) return abilityMod;
    if (abilityMod < 0) return abilityMod;
    return 0;
  }

  /* ======================================================= turn loop ========
     These build EventBatches and hand them back; the caller commits them
     through dispatch or Events.commit, exactly like a resolver. They are the
     orchestration the combat family leans on, kept pure for the same reason. */

  function speedOf(a) {
    return (a && a.runtime && typeof a.runtime.speed === 'number') ? a.runtime.speed : 30;
  }

  function beginEncounter(state, entries, opts) {
    opts = opts || {};
    var surprised = {};
    (opts.surprised || []).forEach(function (id) { surprised[id] = true; });
    var ranked = Dice.initiative(entries, { rng: state.rng });
    var order = ranked.map(function (r) {
      return { id: r.id, total: r.total, surprised: !!surprised[r.id] };
    });
    var b = Events.makeBatch(opts.command || { commandId: opts.commandId || null, actorId: null });
    var names = order.map(function (o) {
      var nm = actor(state, o.id);
      return (nm ? nm.name : o.id) + (o.surprised ? ' (surprised)' : '');
    });
    Events.push(b, 'combat_start', { order: order, encounterId: opts.encounterId || null },
      'Initiative! Order: ' + names.join(', ') + '.');
    return b;
  }

  function startTurn(state, actorId, opts) {
    opts = opts || {};
    var a = actor(state, actorId);
    var surprised = false;
    var order = state.combat && state.combat.order;
    if (order && (state.combat.round === 1)) {
      for (var i = 0; i < order.length; i++) {
        if (order[i].id === actorId && order[i].surprised) surprised = true;
      }
    }
    if (opts.surprised != null) surprised = !!opts.surprised;
    var b = Events.makeBatch(opts.command || { commandId: opts.commandId || null, actorId: actorId });
    var name = a ? a.name : actorId;
    Events.push(b, 'turn_start', { actorId: actorId, speed: speedOf(a), surprised: surprised },
      surprised ? name + ' is caught flat-footed and can do nothing.' : name + '\u2019s turn.');

    upkeep(state, actorId, b);
    return b;
  }

  /**
   * Everything that happens because a turn has BEGUN, rather than because the
   * initiative pointer moved: at present, the death saving throw of a dying
   * creature.
   *
   * Split out of startTurn because advanceTurn emits its own turn_start and
   * must not emit a second one. Both doors into a new turn need this, and the
   * turn that came in through advanceTurn was skipping it — so a character
   * lying at zero hit points was never asked to roll, and simply stayed there
   * neither recovering nor dying while the fight went on around them.
   */
  function upkeep(state, actorId, b) {
    var a = actor(state, actorId);
    if (!a) return b;
    var name = a.name || actorId;

    /* Anything that lasts "until the start of your next turn" ends now.
       Nothing ever drove expiry, so Dodge lasted the entire fight, a
       one-round condition was permanent, and every duration in the game was
       decoration. */
    expireConditions(state, actorId, b);

    /* A Help lasts until the start of the helped creature's next turn (PHB
       192). Without an expiry the grant simply sat there: eighteen Helps in a
       long playtest produced six used and twelve permanent standing bonuses
       against particular enemies, which is not the action anyone chose. */
    if (a.runtime.helpedAgainst && Object.keys(a.runtime.helpedAgainst).length) {
      Events.push(b, 'help_expire', { actorId: actorId },
        name + ' loses the opening their ally made.');
    }

    /* A readied action is held until the start of your next turn, and then it
       is simply gone — that is the cost of holding it. Without an expiry it
       would sit there for the rest of the fight and fire once per enemy step. */
    if (a.runtime.readied) {
      Events.push(b, 'ready_clear', { actorId: actorId },
        name + ' lets the held action go.');
    }

    /* You cannot stay on a mount that is dead, unconscious or no longer there.
       `mountedOn` was set and cleared only by the rider's own mount/dismount
       verbs, so a knight whose horse had been killed under him rode the corpse
       for the rest of the fight — still at the mount's speed. */
    if (a.runtime.mountedOn) {
      var beast = actor(state, a.runtime.mountedOn);
      var gone = !beast || beast.runtime.dead || (beast.runtime.hp || 0) <= 0 ||
        (beast.runtime.conditions && (beast.runtime.conditions.unconscious ||
          beast.runtime.conditions.paralyzed || beast.runtime.conditions.petrified));
      if (gone) {
        Events.push(b, 'mount', { actorId: actorId, mountId: null },
          name + ' is thrown clear as ' + ((beast && beast.name) || 'their mount') + ' goes down.');
        Events.push(b, 'condition_add', { targetId: actorId, condition: 'prone' },
          name + ' lands hard.');
      }
    }

    /* A character at 0 hit points is unconscious: they do not act, they make a
       death saving throw. A playtest caught Shen dropping to 0 and then taking
       a swing on his next turn, which is both a rules violation and the kind
       of thing that quietly removes all tension from a fight. Rolled here so
       every caller — the UI, the AI seats, the headless harness — gets it
       without having to remember. */
    if (isDying(a)) {
      /* Rules.deathSave takes a SINGLE options object and reports deltas plus
         the resulting totals. An earlier version passed a stray first argument
         and read fields that do not exist, which silently discarded the
         session RNG and turned every save into a failure. */
      var save = Rules.deathSave({
        rng: state.rng,
        current: a.runtime.deathSaves || { successes: 0, failures: 0 },
      });
      Events.push(b, 'roll', {
        rollKind: 'death_save', actorId: actorId,
        natural: save.natural, total: save.roll.total,
        success: save.successesDelta > 0,
        explain: Dice.explain(save.roll),
      }, name + ' fights to stay alive: ' + (save.revive
        ? 'a natural 20 \u2014 they come back with one hit point.'
        : save.natural === 1 ? 'a natural 1 \u2014 that counts as two failures.'
          : save.successesDelta ? 'a success.' : 'a failure.'));

      if (save.revive) {
        Events.push(b, 'revive', { actorId: actorId, hp: save.hp || 1 },
          name + ' opens their eyes.');
      } else {
        Events.push(b, 'death_save', {
          actorId: actorId,
          successes: save.successesDelta,
          failures: save.failuresDelta,
        }, '');
        if (save.dead || save.failures >= 3) {
          /* The campaign's death policy decides what a lethal outcome means:
             a heroic table stabilises instead, an ironman table ends here. */
          applyLethal(state, b, actorId, name + ' does not get up again.');
        } else if (save.stable || save.successes >= 3) {
          Events.push(b, 'stabilise', { actorId: actorId },
            name + ' is stable, but still down.');
        }
      }
    }
    return b;
  }

  /**
   * End whatever ran out at the start of this creature's turn.
   *
   * ndsOn has always been recorded on every condition and never read, so
   * "until the start of your next turn" meant "for ever": a Dodge taken in
   * round one was still granting disadvantage in round nine.
   *
   * A condition that ends on a saving throw gets one here, at the DC that
   * applied it — the other half of the same omission, which made every
   * save-ends effect permanent too.
   */
  function expireConditions(state, actorId, b) {
    var a = actor(state, actorId);
    var conds = a && a.runtime && a.runtime.conditions;
    if (!conds) return b;
    var name = a.name || actorId;

    Object.keys(conds).forEach(function (key) {
      var c = conds[key] || {};
      var ends = c.endsOn;

      if (ends === 'start_of_next_turn' || ends === 'end_of_next_turn') {
        Events.push(b, 'condition_remove', { targetId: actorId, condition: key },
          name + ' is no longer ' + key + '.');
        return;
      }

      if (typeof c.rounds === 'number') {
        if (c.rounds <= 1) {
          Events.push(b, 'condition_remove', { targetId: actorId, condition: key },
            name + ' is no longer ' + key + '.');
        } else {
          Events.push(b, 'condition_tick', { targetId: actorId, condition: key, rounds: c.rounds - 1 }, '');
        }
        return;
      }

      if (ends === 'save' && c.saveDc) {
        var d = derivedOf(state, actorId);
        var save = Rules.savingThrow
          ? Rules.savingThrow(d, c.saveAbility || 'con',
            withEffects(state, actorId, 'save', { rng: state.rng, dc: c.saveDc },
              { saveAbility: c.saveAbility || 'con' }))
          : { success: false };
        Events.push(b, 'roll', {
          rollKind: 'save', actorId: actorId, ability: c.saveAbility || 'con',
          dc: c.saveDc, success: save.success, total: save.total,
        }, name + ' fights off ' + key + ': ' + (save.success ? 'they shake it off.' : 'it holds.'));
        if (save.success) {
          Events.push(b, 'condition_remove', { targetId: actorId, condition: key }, '');
        }
      }
    });
    return b;
  }

  function derivedOf(state, id) {
    var a = actor(state, id);
    if (!a) return null;
    if (a.derivedCache) return a.derivedCache;
    var Character = (global.DND && global.DND.Character) ||
      (typeof require !== 'undefined' ? require('./character.js') : null);
    if (!Character || !Character.derive) return null;
    try {
      return Character.derive(a.base, a.progression, a.runtime,
        (state.effects || []).filter(function (e) { return e.targetId === id; }));
    } catch (e) { return null; }
  }

  /** Unconscious and dying: at zero hit points, not yet stable, not yet dead. */
  function isDying(a) {
    if (!a || !a.runtime) return false;
    if (a.runtime.dead) return false;
    return a.runtime.hp <= 0 && !a.runtime.stable;
  }

  /**
   * Does this creature simply die at zero hit points?
   *
   * Player characters and anyone the campaign has marked as important fall
   * unconscious and roll death saves. Everything else \u2014 the goblins, the
   * wolves, the nameless \u2014 is done, which is both the rule and what keeps a
   * fight from turning into bookkeeping.
   */
  function diesAtZero(a) {
    if (!a) return true;
    if (a.alwaysDeathSaves) return false;
    if (a.side === 'party') return false;
    if (a.kind === 'pc') return false;
    return a.kind === 'monster' || !!a.statblock || a.side === 'enemy';
  }

  /** Down for any reason: no legal actions at all. */
  function isDown(a) {
    if (!a || !a.runtime) return true;
    return a.runtime.dead || a.runtime.hp <= 0;
  }

  /* ---------------------------------------------------------- mortality ----
     Death is a rules outcome; what death *means* is a campaign setting. The
     combat engine decides that someone has run out of hit points and hands the
     consequence to mortality.js, which knows whether this table plays with
     permanent death, replacements, resurrection, or none of it. */

  function Mortality() {
    return (global.DND && global.DND.Mortality) ||
      (typeof require !== 'undefined' ? require('./mortality.js') : null);
  }

  function lethalEvents(state, actorId, defaultBeat) {
    var M = Mortality();
    var base;
    if (!M) {
      base = {
        events: [Events.makeEvent('death', { actorId: actorId, targetId: actorId })],
        beats: [defaultBeat],
      };
    } else {
      var res = M.resolveLethal(state, actorId, {});
      base = {
        events: res.events.map(function (e) {
          var kind = e.kind;
          var payload = {};
          Object.keys(e).forEach(function (k) { if (k !== 'kind') payload[k] = e[k]; });
          return Events.makeEvent(kind, payload);
        }),
        beats: res.beats.length ? res.beats : [defaultBeat],
      };
    }

    /* Experience for the kill.
       `xpForCr` existed from the start and nothing ever called it, so nobody
       could level up by playing — the only route to level 4 was editing the
       save. Awarded here because this is the one place the engine knows a
       creature has actually died, and split among the survivors as the rules
       intend. */
    var dead = state.actors && state.actors[actorId];
    if (dead && dead.side === 'enemy') {
      var award = xpAwardEvents(state, dead);
      award.events.forEach(function (e) { base.events.push(e); });
      award.beats.forEach(function (b) { base.beats.push(b); });
    }
    return base;
  }

  /** Split a defeated creature's experience among the party who are still up. */
  function xpAwardEvents(state, dead) {
    var events = [], beats = [];
    var cr = dead.statblock && dead.statblock.cr;
    if (cr == null) cr = dead.cr;
    if (cr == null) return { events: events, beats: beats };

    var total = Rules && Rules.xpForCr ? Rules.xpForCr(cr) : 0;
    if (!total) return { events: events, beats: beats };

    var share = Object.keys(state.actors || {}).filter(function (id) {
      var a = state.actors[id];
      /* The unconscious still share the experience — they were in the fight.
         The dead do not. */
      return a.side === 'party' && a.runtime && !a.runtime.dead;
    });
    if (!share.length) return { events: events, beats: beats };

    var each = Math.floor(total / share.length);
    if (each <= 0) return { events: events, beats: beats };

    share.forEach(function (id) {
      events.push(Events.makeEvent('xp', { actorId: id, delta: each }));
    });
    beats.push('The party earns ' + each + ' experience each.');
    return { events: events, beats: beats };
  }

  function applyLethal(state, batch, actorId, defaultBeat) {
    var r = lethalEvents(state, actorId, defaultBeat);
    r.events.forEach(function (e) { batch.events.push(e); });
    r.beats.forEach(function (b) { batch.beats.push(b); });
  }

  function pushLethal(state, events, beats, actorId, defaultBeat) {
    var r = lethalEvents(state, actorId, defaultBeat);
    r.events.forEach(function (e) { events.push(e); });
    r.beats.forEach(function (b) { beats.push(b); });
  }

  function endTurn(state, actorId, opts) {
    opts = opts || {};
    var a = actor(state, actorId);
    var b = Events.makeBatch(opts.command || { commandId: opts.commandId || null, actorId: actorId });
    Events.push(b, 'turn_end', { actorId: actorId }, (a ? a.name : actorId) + '\u2019s turn ends.');
    return b;
  }

  /* Advance the initiative pointer: end the active actor's turn, roll the round
     over if we have wrapped, and start the next actor's turn — the whole
     transition as one committable batch. */
  function advanceTurn(state, opts) {
    opts = opts || {};
    var c = state.combat || {};
    var order = c.order || [];
    if (!order.length) return Events.makeBatch(opts.command || {});
    var idx = c.turnIndex || 0;
    var current = order[idx] && order[idx].id;

    /* Step past the dead. A corpse does not take a turn, and leaving it in the
       rotation meant the loop handed the initiative to something that could
       never act, which either stalled the fight or burned the step limit. The
       dying are NOT skipped: their turn is when they roll a death save, and
       skipping them would quietly make characters immortal. */
    var nextIdx = idx, wrapped = false, steps = 0;
    do {
      nextIdx = (nextIdx + 1) % order.length;
      if (nextIdx === 0) wrapped = true;
      steps++;
      var cand = actor(state, order[nextIdx].id);
      if (cand && !cand.runtime.dead) break;
    } while (steps < order.length);

    var nextRound = (c.round || 1) + (wrapped ? 1 : 0);
    var nextId = order[nextIdx].id;
    var nextActor = actor(state, nextId);

    var b = Events.makeBatch(opts.command || { commandId: opts.commandId || null, actorId: current });
    if (current) {
      var ca = actor(state, current);
      Events.push(b, 'turn_end', { actorId: current }, (ca ? ca.name : current) + '\u2019s turn ends.');
    }
    /* Move the initiative pointer (and re-carry the order for exact replay). */
    b.events.push(Events.makeEvent('initiative', { order: order, turnIndex: nextIdx }));
    if (wrapped) Events.push(b, 'round', { round: nextRound }, 'Round ' + nextRound + '.');
    var surprised = nextRound === 1 && order[nextIdx].surprised;
    Events.push(b, 'turn_start', { actorId: nextId, speed: speedOf(nextActor), surprised: surprised },
      surprised ? (nextActor ? nextActor.name : nextId) + ' is caught flat-footed and can do nothing.'
                : (nextActor ? nextActor.name : nextId) + '\u2019s turn.');
    upkeep(state, nextId, b);
    return b;
  }

  /**
   * Is the fight decided?
   *
   * One side has nobody left who can act. The dying count as out: a party
   * bleeding on the floor has lost, and letting a fight "continue" against
   * three unconscious bodies produced the ugliest turn a playtest ever
   * printed.
   */
  function encounterOver(state) {
    if (!state.combat || !state.combat.active) return { over: false };
    var sides = { party: 0, enemy: 0, neutral: 0 };
    Object.keys(state.actors).forEach(function (id) {
      var a = state.actors[id];
      if (!a || a.runtime.dead) return;
      if (a.runtime.hp <= 0) return;
      var side = a.side === 'party' ? 'party' : a.side === 'enemy' ? 'enemy' : 'neutral';
      sides[side]++;
    });
    if (sides.enemy === 0) return { over: true, winner: 'party', sides: sides };
    if (sides.party === 0) return { over: true, winner: 'enemy', sides: sides };
    return { over: false, sides: sides };
  }

  /** Close the encounter: initiative is put away and the world returns to
      exploration time. Experience is awarded as creatures die, not here, so a
      fight fled from still counts for what was killed on the way out. */
  function endEncounter(state, opts) {
    opts = opts || {};
    var b = Events.makeBatch(opts.command || { commandId: opts.commandId || null, actorId: null });
    Events.push(b, 'encounter_end', { winner: opts.winner || null },
      opts.winner === 'party' ? 'The last of them goes down. It is over.'
        : opts.winner === 'enemy' ? 'The party is down. Silence.'
          : 'The fighting stops.');
    return b;
  }

  /* ===================================================== damage pipeline ====
     One place that turns "N damage lands on T" into the full consequence chain:
     the hit points themselves, a concentration check if T was concentrating,
     death-save bookkeeping if T is already down, and instant death on massive
     overflow. Returns events for a batch — it never touches state. */
  function damageEvents(state, targetId, amount, opts) {
    opts = opts || {};
    var t = actor(state, targetId);
    var events = [], beats = [];
    if (!t) return { events: events, beats: beats };
    var rt = t.runtime;
    var name = t.name || targetId;
    var hp = rt.hp, hpMax = rt.hpMax;

    /* What the target is made of, applied before anything else touches the
       number — resistance halves, vulnerability doubles, immunity cancels, and
       all of it happens before temporary hit points absorb the remainder.
       Doing this here rather than at the attack site means a spell, a trap or
       a falling rock is judged by the same rule as a sword. */
    if (opts.damageType) {
      var adjusted = applyDamageType(state, targetId, amount, opts.damageType);
      if (adjusted.note) beats.push(adjusted.note);
      amount = adjusted.total;
    }

    var temp = rt.tempHp || 0;
    var toTemp = Math.min(temp, amount);
    var toHp = amount - toTemp;
    /* Concentration is tested against the damage TAKEN, not the damage that
       reached hit points. Temporary hit points absorbing a blow does not spare
       the caster the save (PHB 203, "whenever you take damage"). */
    var damageTaken = amount;

    if (toTemp > 0) {
      events.push(Events.makeEvent('temp_hp', { targetId: targetId, amount: temp - toTemp, set: true }));
      beats.push(name + '\u2019s temporary hit points absorb ' + toTemp + '.');
    }

    /* Massive damage first: if the blow past 0 equals the maximum, the creature
       dies where it stands and none of the save machinery runs. */
    var massive = Rules.massiveDamage(hp, hpMax, toHp);
    if (massive.dead) {
      events.push(Events.makeEvent('hp', { targetId: targetId, delta: -toHp }));
      pushLethal(state, events, beats, targetId, name + ' is destroyed outright by the sheer force of the blow.');
      return { events: events, beats: beats, dead: true, massive: true };
    }

    if (hp === 0 && toHp > 0) {
      /* Already dying: damage does not lower hit points further, it burns death
         saves — two of them on a critical hit. */
      var down = Rules.damageWhileDown(rt.deathSaves, !!opts.crit);
      events.push(Events.makeEvent('death_save', { actorId: targetId, failures: down.failuresDelta }));
      beats.push(name + ' takes a hit while down (' + down.failuresDelta + ' death-save failure' +
        (down.failuresDelta > 1 ? 's' : '') + ').');
      if (down.dead) {
        pushLethal(state, events, beats, targetId, name + ' fails their last breath and dies.');
      }
      return { events: events, beats: beats, dead: down.dead };
    }

    events.push(Events.makeEvent('hp', { targetId: targetId, delta: -toHp }));
    if (toHp > 0) beats.push(name + ' takes ' + toHp + ' damage.');

    var newHp = Math.max(0, hp - toHp);
    if (newHp === 0 && hp > 0) {
      /* Dropped to 0: unconscious, and concentration ends with consciousness. */
      if (rt.concentratingOn) {
        events.push(Events.makeEvent('concentration_end', { targetId: targetId, actorId: targetId, reason: 'unconscious' }));
        beats.push(name + ' falls, and their concentration breaks.');
      }
      /* A monster usually dies outright at 0 hit points; only player
         characters and named NPCs fall unconscious and roll death saves.
         Treating everything alike left gnolls lying "unconscious" on the
         floor rolling saves, so fights never ended and experience arrived
         several rounds after the kill. `alwaysDeathSaves` lets a campaign mark
         an NPC whose death should be a scene rather than a subtraction. */
      if (diesAtZero(t)) {
        pushLethal(state, events, beats, targetId, name + ' is killed.');
        return { events: events, beats: beats, dead: true };
      }
      beats.push(name + ' drops.');
    } else if (rt.concentratingOn && damageTaken > 0) {
      /* Still up but concentrating: a Constitution save or the effect ends.
         The derived sheet used to have to be handed in by the caller, and no
         caller ever did — so damage never once broke concentration and every
         concentration spell in the game lasted until its duration ran out,
         whatever happened to the caster. It is looked up here instead. */
      var conDerived = (opts.concentrationDerived) || derivedOf(state, targetId);
      var check = Rules.concentrationCheck(conDerived, damageTaken, { rng: state.rng });
      events.push(Events.makeEvent('roll', { of: 'concentration', actorId: targetId, dc: check.dc, result: check.save }));
      if (!check.success) {
        events.push(Events.makeEvent('concentration_end', { actorId: targetId, reason: 'failed save' }));
        beats.push(name + ' loses concentration (DC ' + check.dc + ' save failed).');
      } else {
        beats.push(name + ' grits their teeth and holds concentration (DC ' + check.dc + ').');
      }
    }
    return { events: events, beats: beats, dead: false };
  }

  /* ===================================================== attack profiles ====
     A profile is the minimum an attack needs: a to-hit bonus, damage notation,
     an ability modifier for damage, reach and a couple of flags. Player
     characters carry them on runtime.attacks; monsters keep them in the
     statblock actions read from the data files. */
  function profileFor(state, actorId, opts) {
    opts = opts || {};
    var a = actor(state, actorId);
    if (!a) return null;
    /* A monster's statblock may sit at the top level (how the data ships, and
       how every other path reads it) or on the runtime (how a few fixtures set
       it). Reading only the runtime meant a real shipped monster never matched
       its own named actions: an adult black dragon's bite fell through to the
       generic fallback and hit for a flat 7 instead of 2d10+6 piercing plus
       1d8 acid. */
    var sb = statblockOf(a);
    if (opts.actionRef && sb && sb.actions) {
      for (var i = 0; i < sb.actions.length; i++) {
        var ref = String(opts.actionRef).toLowerCase();
        var act = sb.actions[i];
        var matches = String(act.id || '').toLowerCase() === ref ||
          String(act.name || '').toLowerCase() === ref ||
          String(act.name || '').toLowerCase().replace(/\s+/g, '_') === ref;
        if (!matches) continue;
        /* Not every named action is an attack. A dragon's multiattack
           sequence includes Frightful Presence, which has no attack roll and
           no damage; treating it as a swing invented a hit out of nothing. */
        if (!act.damage || !act.damage.length || typeof act.toHit !== 'number') return null;
        var dmg = act.damage[0];
        return {
          name: act.name, toHit: act.toHit, reach: act.reach || CELL,
          damage: dmg.dice + (dmg.flat ? '+' + dmg.flat : ''), damageType: dmg.type,
          abilityMod: 0, extraDamage: act.damage.slice(1),
        };
      }
      /* Named an action this creature does not have: better to make no attack
         than to silently swing with something else. */
      return null;
    }
    var list = a.runtime.attacks || [];

    /* An unarmed strike is a specific attack, not "whatever is in your hand".
       `opts.unarmed` was passed in from the `unarmed_strike` verb and read by
       nothing here, so the profile came back as `list[0]` — the equipped
       weapon. "Strike the Ogre unarmed" hit for 1d8+4 piercing with a rapier.
       The correct entry has been in the list all along, built by state.js and
       flagged `unarmed: true`. */
    if (opts.unarmed) {
      return list.filter(function (w) { return w && w.unarmed; })[0] || null;
    }

    /* The off-hand weapon is the one in the off hand, not the second entry in
       an array whose order is the inventory's. It happened to be right for a
       character carrying exactly two weapons in the order they equipped them,
       and wrong for everybody else — a rogue with a spare greatsword in the
       pack made off-hand strikes with whatever sorted second. */
    if (opts.offHand) {
      var offRef = (a.runtime.equipped || {}).offHand;
      if (offRef) {
        var byUid = list.filter(function (w) {
          return w && (w.uid === offRef || w.id === offRef);
        })[0];
        if (byUid) return byUid;
      }
      return list[1] || list[0] || null;
    }

    return list[0] || null;
  }

  /**
   * The armour class an attack is actually resolved against.
   *
   * This read only `runtime.ac`, which nothing ever sets — so every attack in
   * the running game was resolved against AC 10 while the sheet proudly
   * displayed 18. The combat tests missed it because they inject `runtime.ac`
   * into their fixtures, which is the same fixture-versus-reality trap that
   * hid the armour bug earlier. Order of preference:
   *
   *   1. an explicit runtime override (effects, tests, DM fiat)
   *   2. the derived sheet, which is where a character's real AC lives
   *   3. the statblock, which is where a monster's does
   *   4. 10, for something with no defences described at all
   */
  function targetAc(state, targetId) {
    var t = actor(state, targetId);
    if (!t) return 10;
    if (typeof t.runtime.ac === 'number') return t.runtime.ac;

    if (t.derivedCache && typeof t.derivedCache.ac === 'number') return t.derivedCache.ac;

    var block = t.statblock;
    if (block) {
      if (typeof block.ac === 'number') return block.ac;
      if (block.ac && typeof block.ac.value === 'number') return block.ac.value;
      if (Array.isArray(block.armorClass) && block.armorClass[0] &&
        typeof block.armorClass[0].value === 'number') return block.armorClass[0].value;
      if (typeof block.armorClass === 'number') return block.armorClass;
    }

    /* Last resort: derive it now rather than pretending it is 10. */
    var State = (global.DND && global.DND.State) ||
      (typeof require !== 'undefined' ? require('./state.js') : null);
    if (State && State.refreshDerived) {
      var d = State.refreshDerived(state, targetId);
      if (d && typeof d.ac === 'number') return d.ac;
    }
    return 10;
  }

  /* ============================================================ resolvers ===
     Each returns an EventBatch; dispatch commits it. The beats are the ONLY
     thing the narrator will see, so they describe what an onlooker perceives —
     a hit, a miss, a stagger — and never a hidden number the fiction could not
     reveal (an enemy's exact AC, say). */

  function attackResolve(state, command, ctx, opts) {
    opts = opts || {};
    var b = Events.makeBatch(command);
    var attackerId = command.actorId;
    var attacker = actor(state, attackerId);
    var targetId = (command.primary.targetIds || [])[0] || (ctx && ctx.targetId);
    var target = actor(state, targetId);
    if (!attacker || !target) return Events.refuse(b, 'no-target', 'there is nothing there to strike');

    var reaction = !!opts.reaction;
    var offHand = !!opts.offHand;
    if (!reaction && !opts.free) {
      if (offHand && !canBonus(attacker)) return Events.refuse(b, 'no-bonus', 'no bonus action left for an off-hand strike');
      if (!offHand && !canAct(attacker)) return Events.refuse(b, 'no-action', 'no action left to attack with');
    }
    if (reaction && !canReact(attacker)) return Events.refuse(b, 'no-reaction', 'the reaction for this round is already spent');

    var profile = profileFor(state, attackerId, opts);
    if (!profile) return Events.refuse(b, 'no-weapon', 'nothing to attack with');

    /* Reach and range.
       Nothing checked distance at all, so a longsword hit a target sixty feet
       away and a melee fight could be conducted from across the room. This is
       one of the load-bearing rules of the game — the whole point of closing
       to melee is that you have to close. */
    var span = weaponSpan(state, attackerId, profile, opts);
    var apart = distanceFt(attacker, target);
    if (apart != null && span) {
      if (span.melee) {
        if (apart > span.reach) {
          return Events.refuse(b, 'out-of-reach',
            (target.name || targetId) + ' is ' + apart + ' ft away, beyond your ' +
            span.reach + ' ft reach');
        }
      } else if (span.long && apart > span.long) {
        return Events.refuse(b, 'out-of-range',
          (target.name || targetId) + ' is ' + apart + ' ft away, beyond the weapon\u2019s ' +
          span.long + ' ft maximum');
      }
    }

    var ac = targetAc(state, targetId);
    var cover = (ctx && ctx.cover) || null;
    if (cover) {
      var cb = Rules.coverBonus(cover);
      if (cb.untargetable) return Events.refuse(b, 'total-cover', 'the target is completely behind cover');
      ac += cb.ac;
    }

    /**
     * Advantage and disadvantage from the state of the board.
     *
     * These were taken only from `ctx`, which nothing populated in play, so
     * Dodge cost an action and changed nothing, an unconscious target was no
     * easier to hit than a standing one, and Help was a line of prose. The
     * conditions were being applied faithfully and then never read.
     */
    var stance = attackAdvantage(state, attacker, target, ctx);
    /* Bless, Bane, exhaustion and anything else currently on the attacker are
       folded in here rather than being computed and thrown away. */
    var roll = Dice.attack(withEffects(state, attackerId, 'attack', {
      rng: state.rng, mod: profile.toHit || 0, ac: ac,
      advantage: stance.advantage, disadvantage: stance.disadvantage,
      critRange: profile.critRange || 20,
    }, ctx));
    if (stance.why.length) b.beats.push(stance.why.join(' '));
    /* A Help is spent whether it helped or not — that is the point of it being
       one ally's whole action rather than a standing bonus. */
    if (stance.usedHelp) {
      Events.push(b, 'help_used', { actorId: attackerId, targetId: targetId }, '');
    }
    /* Stepping out to attack gives your position away. */
    if (attacker.runtime.hiddenFrom && Object.keys(attacker.runtime.hiddenFrom).length) {
      Events.push(b, 'hidden', { actorId: attackerId, hidden: false },
        attacker.name + ' breaks cover to strike.');
    }
    /* The full roll (including the AC it was measured against) goes in the
       audit event; the beat the narrator sees says only what a bystander could
       see — that a blow was aimed — never the enemy's exact Armour Class. */
    Events.push(b, 'roll', { of: 'attack', actorId: attackerId, targetId: targetId, result: roll });
    b.beats.push(attacker.name + ' swings at ' + target.name + '.');

    /* Spend the economy regardless of hit or miss — a swing is a swing. */
    if (!reaction && !opts.free) {
      if (offHand) Events.push(b, 'action_economy', { actorId: attackerId, bonus: false });
      else if (!opts.multiattack) Events.push(b, 'action_economy', { actorId: attackerId, action: false });
    } else if (reaction) {
      Events.push(b, 'action_economy', { actorId: attackerId, reaction: false });
    }

    if (roll.hit === false) {
      b.beats.push('The blow misses.');
      return b;
    }

    /* Appendix A: any hit on a paralyzed or unconscious creature is a critical
       if the attacker is within five feet of it. The condition was applied
       faithfully, advantage was granted, and this half of the rule was simply
       absent — probed against a paralyzed ogre, every hit came back with
       `critDice: null`. It is a large part of why a held enemy is in real
       trouble rather than merely easier to hit. */
    if (!roll.isCrit && Effects && Effects.conditionFlag &&
        Effects.conditionFlag(target.runtime.conditions, 'critWithin5')) {
      var apart = distanceFt(attacker, target);
      if (apart == null || apart <= CELL) {
        roll.isCrit = true;
        var why = Effects.conditionsWith(target.runtime.conditions, 'critWithin5')[0];
        b.beats.push(target.name + ' is ' + why + ' and cannot dodge the blow \u2014 it lands true.');
      }
    }

    var dmg = Dice.damage(profile.damage, { rng: state.rng, crit: roll.isCrit, type: profile.damageType });
    var total = dmg.total;

    /* A monster whose bite is "1 piercing plus 9 poison" was dealing 1: the
       extra components were parsed onto the profile and never rolled. Each is
       rolled and judged against the target's defences separately, because a
       creature can be immune to the poison and not to the bite. */
    var extras = [];
    (profile.extraDamage || []).forEach(function (part) {
      if (!part || !part.dice) return;
      var extraRoll = Dice.damage(part.dice + (part.flat ? '+' + part.flat : ''),
        { rng: state.rng, crit: roll.isCrit, type: part.type });
      extras.push({ amount: extraRoll.total, type: part.type });
    });

    if (offHand) {
      /* The off-hand die is rolled; the ability modifier is added only under
         the two-weapon rule above. */
      var already = profile.abilityMod || 0;
      var allowed = twoWeaponDamageBonus(already, opts);
      total = total - already + allowed;
      if (total < 0) total = 0;
    }
    Events.push(b, 'roll', { of: 'damage', actorId: attackerId, targetId: targetId, result: dmg });
    /* Resistance, immunity and vulnerability are applied inside damageEvents,
       where every source of damage passes through — a spell, a trap or a
       falling rock is judged by the same rule as a sword. Applying it here as
       well halved resistant damage twice. */
    var chain = damageEvents(state, targetId, total, {
      damageType: profile.damageType,
      crit: roll.isCrit,
      concentrationDerived: ctx && ctx.targetConcentrationDerived,
    });
    b.events = b.events.concat(chain.events);
    b.beats = b.beats.concat([attacker.name + (roll.isCrit ? ' critically hits' : ' hits') + ' for ' + total + '.']);
    b.beats = b.beats.concat(chain.beats);

    /* Secondary components land as their own damage, so each is measured
       against the right resistance and each can be the blow that drops
       someone. Skipped once the target is already down — a corpse does not
       need to be poisoned as well. */
    extras.forEach(function (part) {
      if (chain.dead) return;
      var sub = damageEvents(state, targetId, part.amount, { damageType: part.type });
      b.events = b.events.concat(sub.events);
      b.beats = b.beats.concat([target.name + ' also takes ' + part.amount + ' ' + part.type + '.']);
      b.beats = b.beats.concat(sub.beats);
    });
    return b;
  }

  /**
   * Work out whether an attack is made with advantage, disadvantage, or
   * neither, from the conditions actually on the board.
   *
   * 2014 rules: advantage and disadvantage do not stack and they cancel. One
   * of each leaves a plain d20 no matter how many of each there are, which is
   * why this counts sources into two buckets and then compares them rather
   * than tracking a running total.
   */
  /**
   * Collect every active effect that bears on a roll, and fold it into the
   * options the dice take.
   *
   * `Effects.modifiersFor` has always computed this correctly and nothing ever
   * called it — it was referenced only inside its own file. So Bless added
   * nothing to an attack, Bane subtracted nothing, Guidance did not help a
   * check, and exhaustion imposed no disadvantage. Every one of those spells
   * was pure narration.
   *
   * Advantage and disadvantage cancel here the same way they do everywhere
   * else: any of each leaves a plain d20.
   */
  function withEffects(state, actorId, rollType, opts, ctx) {
    opts = opts || {};
    var Effects = (global.DND && global.DND.Effects) ||
      (typeof require !== 'undefined' ? require('./effects.js') : null);
    if (!Effects || !Effects.modifiersFor) return opts;

    var mods;
    try { mods = Effects.modifiersFor(state, actorId, rollType, ctx || {}); }
    catch (e) { return opts; }
    if (!mods) return opts;

    if (mods.flat) opts.mod = (opts.mod || 0) + mods.flat;
    if (mods.dice && mods.dice.length) {
      /* Several sources of bonus dice stack as separate rolls; the dice
         notation joins them. */
      opts.bonusDice = (opts.bonusDice ? opts.bonusDice + '+' : '') + mods.dice.join('+');
    }
    var adv = (mods.advantage || []).length > 0;
    var dis = (mods.disadvantage || []).length > 0;
    if (adv && !dis) opts.advantage = true;
    if (dis && !adv) opts.disadvantage = true;
    if (adv && dis) { opts.advantage = false; opts.disadvantage = false; }
    return opts;
  }

  function attackAdvantage(state, attacker, target, ctx) {
    var adv = [], dis = [];
    var ac = (attacker.runtime && attacker.runtime.conditions) || {};
    var tc = (target.runtime && target.runtime.conditions) || {};

    /* The target's condition. An unconscious or paralysed creature is helpless;
       a prone one is easy to reach in melee but hard to shoot. */
    if (tc.unconscious || tc.paralyzed || tc.petrified || tc.stunned || tc.restrained) {
      adv.push('The target cannot properly defend.');
    }
    if (target.runtime && target.runtime.hp <= 0 && !target.runtime.dead) {
      adv.push('The target is down and helpless.');
    }
    if (tc.prone) {
      if (ctx && ctx.ranged) dis.push('The target is prone and hard to hit at range.');
      else adv.push('The target is prone.');
    }
    if (tc.invisible || tc.hidden) dis.push('The target cannot be seen clearly.');
    if (tc.dodging) dis.push('The target is dodging.');

    /* Someone spent their action to Help this attacker against this target. */
    var helped = attacker.runtime && attacker.runtime.helpedAgainst;
    var usedHelp = false;
    if (helped && helped[targetIdOf(state, target)]) {
      adv.push('An ally has set them up.');
      usedHelp = true;
    }

    /* The attacker's own condition. */
    if (ac.prone) dis.push('Attacking from the floor is awkward.');
    if (ac.restrained || ac.poisoned || ac.frightened) dis.push('The attacker is hampered.');
    if (ac.blinded) dis.push('The attacker cannot see.');
    if (ac.invisible || ac.hidden) adv.push('The attacker strikes unseen.');
    if ((attacker.runtime && attacker.runtime.exhaustion) >= 3) dis.push('Exhaustion drags at them.');

    /* Explicit overrides still win: a spell or the DM saying "with advantage"
       is not something the board can be expected to know about. */
    if (ctx && ctx.advantage) adv.push('');
    if (ctx && ctx.disadvantage) dis.push('');

    var hasAdv = adv.length > 0, hasDis = dis.length > 0;
    var why = [];
    if (hasAdv && hasDis) why = ['Advantage and disadvantage cancel.'];
    else if (hasAdv) why = adv.filter(Boolean).slice(0, 1);
    else if (hasDis) why = dis.filter(Boolean).slice(0, 1);

    return {
      advantage: hasAdv && !hasDis,
      disadvantage: hasDis && !hasAdv,
      usedHelp: usedHelp,
      why: why,
    };
  }

  /* Actors live in a map and do not reliably carry their own key, so an id is
     looked up rather than read off the object. */
  function targetIdOf(state, actorObj) {
    if (!actorObj) return '';
    if (actorObj.id) return actorObj.id;
    var ids = Object.keys(state.actors || {});
    for (var i = 0; i < ids.length; i++) if (state.actors[ids[i]] === actorObj) return ids[i];
    return '';
  }

  /**
   * Help: hand an ally advantage on their next attack against one creature.
   *
   * This used to print "lends a hand" and do nothing, which made an action
   * that costs a whole turn strictly worse than attacking. The grant is
   * recorded on the ally and consumed by their next attack against that
   * target — it does not linger, and it does not apply to anyone else.
   */
  function helpResolve(state, command, ctx) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'no one to act');
    if (!canAct(a)) return Events.refuse(b, 'no-action', 'no action left to Help');

    var ids = command.primary.targetIds || [];
    var allyId = ids[0];
    var foeId = ids[1];
    var ally = actor(state, allyId);
    if (!ally) return Events.refuse(b, 'no-target', 'there is no one there to help');

    /* No enemy named: help against whatever the ally is already facing. */
    if (!foeId) foeId = perceivedEnemies(state, allyId)[0];
    var foe = actor(state, foeId);
    if (!foe) return Events.refuse(b, 'no-target', 'there is nothing to help against');

    Events.push(b, 'action_economy', { actorId: command.actorId, action: false });
    Events.push(b, 'help', { actorId: command.actorId, allyId: allyId, targetId: foeId },
      a.name + ' distracts ' + foe.name + '; ' + ally.name + ' has the opening.');
    return b;
  }

  /**
   * Hide: a Stealth check against the passive Perception of everyone who might
   * notice. Succeed and you are hidden from them specifically — which is what
   * `hiddenFrom` means, and what the perception layer already understood but
   * nothing ever set.
   */
  /**
   * A skill's total modifier as a NUMBER.
   *
   * derived.skills.x is an object describing the skill; using it directly as
   * a modifier silently produces nonsense. Falls back to the raw ability
   * modifier when the sheet has no entry for that skill.
   */
  function skillMod(derived, skill, ability) {
    var s = derived && derived.skills && derived.skills[skill];
    if (s && typeof s.mod === 'number') return s.mod;
    if (typeof s === 'number') return s;
    return (derived && derived.abilityMods && derived.abilityMods[ability]) || 0;
  }

  function hideResolve(state, command, ctx) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'no one to act');
    if (!canAct(a)) return Events.refuse(b, 'no-action', 'no action left to Hide');

    var derived = a.derivedCache || (ctx && ctx.derived) || {};
    /* A derived skill is `{ability, mod, proficient, expertise}`, not a number.
       Reading a `.total` that does not exist fell through to the whole object,
       which `Dice.check` then used as a modifier — so Hide rolled a bare d20
       and threw away proficiency and expertise entirely. */
    var stealthMod = skillMod(derived, 'stealth', 'dex');
    var roll = Dice.check
      ? Dice.check({ rng: state.rng, mod: stealthMod })
      : Dice.roll('1d20', { rng: state.rng });
    var total = roll.total != null ? roll.total : (roll.result || 0);

    Events.push(b, 'action_economy', { actorId: command.actorId, action: false });
    Events.push(b, 'roll', { of: 'stealth', actorId: command.actorId, result: roll },
      a.name + ' slips into cover.');

    var hidFrom = [], seenBy = [];
    Object.keys(state.actors).forEach(function (id) {
      if (id === command.actorId) return;
      var o = state.actors[id];
      if (!o.runtime || o.runtime.dead) return;
      if (o.side === a.side) return;   // your own side knows where you went
      var passive = (o.derivedCache && o.derivedCache.passives && o.derivedCache.passives.perception) || 10;
      if (total >= passive) hidFrom.push(id); else seenBy.push(id);
    });

    if (hidFrom.length) {
      Events.push(b, 'hidden', { actorId: command.actorId, from: hidFrom, hidden: true },
        seenBy.length
          ? a.name + ' is out of sight of some of them, but not all.'
          : a.name + ' is out of sight.');
    } else {
      b.beats.push(a.name + ' fails to find cover; they are still in plain view.');
    }
    return b;
  }

  /**
   * Halve, double or cancel damage according to what the target is made of.
   *
   * 2014 rules, in this order: immunity wins outright; then resistance and
   * vulnerability, each applied ONCE however many sources grant them. A
   * creature both resistant and vulnerable takes double and then half — five
   * damage becomes four, not ten — because each is applied separately and
   * rounding happens at each step.
   *
   * Monsters carry their defences on the statblock and characters on the
   * derived sheet. Only the sheet was consulted, so a fire elemental burned
   * and a skeleton took full damage from a club.
   */
  function applyDamageType(state, targetId, amount, damageType) {
    var t = actor(state, targetId);
    if (!t || !damageType || !amount) return { total: amount, note: '' };
    var d = t.derivedCache || {};
    var block = t.statblock || (t.runtime && t.runtime.statblock) || {};
    var type = String(damageType).toLowerCase();

    var has = function (which) {
      /* Two vocabularies in play: the derived sheet says `resistances`, the
         SRD monster data says `damageResistances`. Only the first was read, so
         every shipped monster's defences were ignored — a real skeleton took
         full damage from a club and was harmed by poison. */
      var lists = [
        d[which], block[which],
        d['damage' + cap(which)], block['damage' + cap(which)],
      ];
      for (var i = 0; i < lists.length; i++) {
        var list = lists[i] || [];
        for (var j = 0; j < list.length; j++) {
          var entry = String(list[j]).toLowerCase();
          if (entry === type) return true;
          /* SRD writes qualified physical resistances as one string, e.g.
             "bludgeoning, piercing, and slashing from nonmagical attacks". */
          if (entry.indexOf(',') >= 0 && entry.split(/,\s*|\band\b/).some(function (part) {
            return part.trim().replace(/^\s*/, '').indexOf(type) === 0;
          })) return true;
        }
      }
      return false;
    };

    if (has('immunities')) {
      return { total: 0, note: t.name + ' is unharmed \u2014 ' + type + ' does nothing to it.' };
    }

    /* Resistance first, then vulnerability: halve, then double. The order
       matters because each rounds down — 5 damage becomes 2 and then 4, not
       10 and then 5. */
    var out = amount, notes = [];
    if (has('resistances')) { out = Math.floor(out / 2); notes.push('shrugs off much of the ' + type); }
    if (has('vulnerabilities')) { out = out * 2; notes.push('horribly vulnerable to ' + type); }

    return {
      total: out,
      note: notes.length ? t.name + ' is ' + notes.join(', and ') + '.' : '',
    };
  }

  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  function contestResolve(state, command, ctx, mode) {
    var b = Events.makeBatch(command);
    var attackerId = command.actorId;
    var attacker = actor(state, attackerId);
    var targetId = (command.primary.targetIds || [])[0] || (ctx && ctx.targetId);
    var target = actor(state, targetId);
    if (!attacker || !target) return Events.refuse(b, 'no-target', 'there is no one to seize');
    if (!ctx || !ctx.derivedA || !ctx.derivedB) return Events.refuse(b, 'no-derive', 'cannot resolve the contest without both combatants');
    /* Grapple and shove are Attack-action attacks that spend one attack — they
       are contests, never attack rolls, so they route through Rules.contest. */
    if (!canAct(attacker) && !ctx.free) return Events.refuse(b, 'no-action', 'no attack left to grapple or shove with');

    var result = mode === 'shove'
      ? Rules.shove(ctx.derivedA, ctx.derivedB, { rng: state.rng, mode: ctx.mode })
      : Rules.grapple(ctx.derivedA, ctx.derivedB, { rng: state.rng });
    Events.push(b, 'roll', { of: mode, actorId: attackerId, targetId: targetId, result: result });
    b.beats.push(attacker.name + ' grapples with ' + target.name + '.');
    if (!ctx.free) Events.push(b, 'action_economy', { actorId: attackerId, action: false });

    if (result.success) {
      if (mode === 'grapple') {
        Events.push(b, 'condition_add', { targetId: targetId, condition: 'grappled', source: attackerId },
          target.name + ' is grappled.');
      } else if (result.effect === 'prone') {
        Events.push(b, 'condition_add', { targetId: targetId, condition: 'prone', source: attackerId },
          target.name + ' is knocked prone.');
      } else {
        b.beats.push(target.name + ' is shoved back.');
      }
    } else {
      b.beats.push(target.name + ' holds firm.');
    }
    return b;
  }

  function stanceResolve(state, command, condition, beat) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'no one to act');
    if (!canAct(a)) return Events.refuse(b, 'no-action', 'no action left this turn');
    Events.push(b, 'action_economy', { actorId: command.actorId, action: false });
    if (condition) Events.push(b, 'condition_add', { targetId: command.actorId, condition: condition, endsOn: 'start_of_next_turn' },
      (a.name) + ' ' + beat);
    else b.beats.push(a.name + ' ' + beat);
    return b;
  }

  function resolveCombat(state, command, ctx) {
    ctx = ctx || {};
    var verb = command.primary.verb;
    switch (verb) {
      case 'multiattack': return monsterMultiattack(state, command, ctx);
      case 'attack': return attackAction(state, command, ctx, {});
      case 'two_weapon_attack': {
        /* Enforced here as well as filtered from the move list, because a
           typed action and an AI seat both reach the resolver directly. */
        if (!twoWeaponEligible(state, command.actorId)) {
          return Events.refuse(Events.makeBatch(command), 'not-two-weapon',
            'two-weapon fighting needs a light melee weapon in each hand');
        }
        return attackResolve(state, command, ctx, { offHand: true });
      }
      case 'unarmed_strike': return attackAction(state, command, ctx, { unarmed: true });
      case 'opportunity_attack': return attackResolve(state, command, ctx, { reaction: true });
      case 'grapple': return contestResolve(state, command, ctx, 'grapple');
      case 'shove': return contestResolve(state, command, ctx, 'shove');
      case 'dodge': return stanceResolve(state, command, 'dodging', 'takes the Dodge action.');
      case 'disengage': return stanceResolve(state, command, 'disengaging', 'disengages.');
      case 'dash': {
        var b = Events.makeBatch(command);
        var a = actor(state, command.actorId);
        if (!a) return Events.refuse(b, 'no-actor', 'no one to act');
        if (!canAct(a)) return Events.refuse(b, 'no-action', 'no action left to Dash');
        Events.push(b, 'action_economy', { actorId: command.actorId, action: false });
        var extra = speedOf(a);
        var cur = movementLeft(a);
        Events.push(b, 'action_economy', { actorId: command.actorId, movementUsed: -extra },
          a.name + ' dashes (movement now ' + (cur + extra) + ' ft).');
        return b;
      }
      case 'help': return helpResolve(state, command, ctx);
      case 'hide': return hideResolve(state, command, ctx);
      case 'stabilise': return stabiliseResolve(state, command, ctx);
      case 'ready': return readyResolve(state, command, ctx);
      case 'escape_grapple': {
        var eb = Events.makeBatch(command);
        var esc = actor(state, command.actorId);
        if (!esc) return Events.refuse(eb, 'no-actor', 'no one to act');
        Events.push(eb, 'condition_remove', { targetId: command.actorId, condition: 'grappled' },
          esc.name + ' breaks free.');
        return eb;
      }
      default:
        return Events.refuse(Events.makeBatch(command), 'unknown-verb', 'the combat engine does not know ' + verb);
    }
  }

  /**
   * Steadying a dying creature.
   *
   * 2014, "Stabilizing a Creature": your action, a DC 10 Wisdom (Medicine)
   * check — or a healer's kit, which does it without a roll and spends a use.
   * Nothing offered this, so the only routes out of dying were a healing spell
   * or three lucky death saves, and a party with no caster could only stand and
   * watch somebody bleed out.
   */
  function stabiliseResolve(state, command, ctx) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'nobody is there');
    if (!canAct(a)) return Events.refuse(b, 'no-action', a.name + ' has no action left this turn');

    var targetId = (command.primary.targetIds || [])[0];
    var t = targetId ? actor(state, targetId) : null;
    if (!t) return Events.refuse(b, 'no-target', 'there is nobody named to steady');
    var rt = t.runtime || {};
    if (rt.dead) return Events.refuse(b, 'already-dead', t.name + ' is beyond help');
    if ((rt.hp || 0) > 0) return Events.refuse(b, 'not-dying', t.name + ' is still on their feet');
    if (rt.stable) return Events.refuse(b, 'already-stable', t.name + ' is already stable');

    var apart = distanceFt(a, t);
    if (apart != null && apart > CELL) {
      return Events.refuse(b, 'out-of-reach',
        t.name + ' is ' + apart + ' ft away \u2014 you have to reach them');
    }

    Events.push(b, 'action_economy', { actorId: command.actorId, action: false }, '');

    var kit = healersKit(a);
    if (kit) {
      /* A healer's kit is ten uses of certainty. Spending one is the cost. */
      Events.push(b, 'item_charge', { actorId: command.actorId, uid: kit.uid || kit.id, delta: -1, from: 10 },
        a.name + ' opens a healer\u2019s kit.');
      Events.push(b, 'stabilise', { actorId: targetId },
        a.name + ' binds ' + t.name + '\u2019s wounds. They are stable.');
      return b;
    }

    var d = derivedOf(state, command.actorId);
    var roll = Rules.skillCheck(d, 'medicine', { rng: state.rng, dc: 10 });
    Events.push(b, 'roll', { of: 'check', actorId: command.actorId, targetId: targetId, result: roll });
    if (roll.success) {
      Events.push(b, 'stabilise', { actorId: targetId },
        a.name + ' steadies ' + t.name + '\u2019s breathing. They are stable.');
    } else {
      b.beats.push(a.name + ' cannot find the wound in time. ' + t.name + ' is still slipping away.');
    }
    return b;
  }

  /* Dispatch.commandFromMove puts `move.step` straight into a command's
     `primary`, so a move's step must be a real step object, not a verb string.
     This wrapper is the single place that shape is constructed, so the UI, the
     AI seats and the referee enums cannot drift apart. */
  function move(verb, what, cost, extra) {
    var step = Command
      ? Command.makeStep(Object.assign({ verb: verb }, extra || {}))
      : Object.assign({ verb: verb, targetIds: [] }, extra || {});
    return Object.assign({ step: step, what: what, cost: cost }, (extra && extra.warn) ? { warn: extra.warn } : {});
  }

  /**
   * The hostile creatures this actor can actually perceive.
   *
   * The move list is shown to a player and handed to an AI seat, so anything
   * it names has been revealed. Building it by walking `state.actors` meant
   * the ambusher waiting in the dark appeared in the action bar as "Attack
   * Hooded Figure" before anyone had seen or heard a thing — the perception
   * layer exists precisely so this cannot happen, and this was one of the few
   * places that went round it.
   *
   * A creature you cannot perceive is simply not offered as a target. You may
   * still attack the space it occupies through improvised actions; you just
   * are not told it is there.
   */
  /* Friends who are down, not dead, not already stable, and close enough to
     reach — the only people stabilising helps. */
  function dyingAllies(state, actorId) {
    var me = actor(state, actorId);
    if (!me) return [];
    return Object.keys(state.actors || {}).filter(function (id) {
      if (id === actorId) return false;
      var o = state.actors[id];
      if (!o || o.side !== me.side) return false;
      var rt = o.runtime || {};
      if (rt.dead || rt.stable) return false;
      if ((rt.hp || 0) > 0) return false;
      var apart = distanceFt(me, o);
      return apart == null || apart <= CELL;
    });
  }

  /* A healer's kit in the pack, if there is one with uses left. */
  function healersKit(a) {
    var inv = (a && a.runtime && a.runtime.inventory) || [];
    return inv.filter(function (i) {
      if (!i) return false;
      var id = String(i.id || i.uid || '');
      if (!/healer/i.test(id) && !/healer/i.test(String(i.name || ''))) return false;
      return (i.uses == null) || i.uses > 0;
    })[0] || null;
  }

  /* Companions on your own side who are up and can be helped. */
  function allies(state, actorId) {    var a = actor(state, actorId);
    if (!a) return [];
    return Object.keys(state.actors || {}).filter(function (id) {
      if (id === actorId) return false;
      var o = state.actors[id];
      return o.side === a.side && o.runtime && !o.runtime.dead && o.runtime.hp > 0;
    });
  }

  function perceivedEnemies(state, actorId) {
    var a = actor(state, actorId);
    if (!a) return [];
    var K = (global.DND && global.DND.Knowledge) ||
      (typeof require !== 'undefined' ? require('./knowledge.js') : null);
    return Object.keys(state.actors || {}).filter(function (id) {
      var o = state.actors[id];
      if (!o.side || !a.side || o.side === a.side || o.side === 'neutral') return false;
      if (!o.runtime || o.runtime.dead) return false;
      if (K && K.canPerceive && !K.canPerceive(state, actorId, id)) return false;
      return true;
    });
  }

  resolveCombat.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    /* Unconscious characters do not fight. They make death saves, which
       startTurn rolls for them. */
    if (!a || isDown(a)) return [];
    var moves = [];
    var enemies = perceivedEnemies(state, actorId);
    /* Who is actually within reach of a swing. Offering an attack against
       something sixty feet away produced a button that refused on click, which
       teaches a player that Attack does not work rather than that they need to
       close. Movement is offered separately, which is the answer. */
    var span = weaponSpan(state, actorId, profileFor(state, actorId, {}), {});
    var limit = span ? (span.melee ? span.reach : span.long) : null;
    var inReach = enemies.filter(function (id) {
      if (limit == null) return true;
      var apart = distanceFt(a, actor(state, id));
      return apart == null || apart <= limit;
    });
    if (canAct(a)) {
      /* A creature whose statblock describes a multiattack should use it —
         that IS its attack action, and offering only single attacks made every
         boss in the game fight like a goblin. Listed first so a policy that
         takes the first sensible option does the right thing. */
      var seq = multiattackSequence(statblockOf(a));
      if (seq.length) {
        enemies.forEach(function (id) {
          moves.push(move('multiattack', 'Multiattack ' + (state.actors[id].name || id), 'action',
            { targetIds: [id], warn: seq.length + ' attacks' }));
        });
      }
      inReach.forEach(function (id) {
        moves.push(move('attack', 'Attack ' + (state.actors[id].name || id), 'action', { targetIds: [id] }));
      });
      /* A creature always has fists: an unarmed strike is a legal choice for
         the Attack action whatever else you are holding, and it is how you
         subdue rather than kill. The two-step bar collapses this to a single
         button however many enemies there are. Five feet, always — fists have
         no reach. */
      enemies.forEach(function (id) {
        var apart = distanceFt(a, actor(state, id));
        if (apart != null && apart > CELL) return;
        moves.push(move('unarmed_strike', 'Strike ' + (state.actors[id].name || id) + ' unarmed', 'action',
          { targetIds: [id], warn: '1 + your Strength modifier, bludgeoning' }));
      });
      moves.push(move('dodge', 'Dodge', 'action'));
      moves.push(move('disengage', 'Disengage', 'action'));
      moves.push(move('dash', 'Dash', 'action'));
      /* Readying is a whole action in the rules, and it was pure narration:
         `stanceResolve` printed "readies an action" and stored nothing, so the
         trigger, the held action and the reaction that spends it did not
         exist. What is modelled here is the trigger the engine can actually
         detect — somebody coming within your reach — which is by far the most
         common use of Ready at a table and the one that interacts with
         everything else already built: reach, reactions and opportunity
         attacks. Other triggers remain a matter for the Dungeon Master. */
      if (!a.runtime.readied) {
        enemies.forEach(function (id) {
          moves.push(move('ready', 'Ready an attack on ' + (state.actors[id].name || id) +
            ' if they close', 'action',
          { targetIds: [id], note: 'approach',
            warn: 'held until they come within your reach; spends your reaction' }));
        });
        moves.push(move('ready', 'Ready an attack for whoever closes first', 'action',
          { note: 'approach',
            warn: 'held until anyone comes within your reach; spends your reaction' }));
      }
      moves.push(move('hide', 'Hide', 'action',
        { warn: 'a Stealth check against what they might notice' }));
      /* Help names the ally first and the enemy second, which is the order the
         resolver reads. Offered only when there is someone to help and someone
         to help against — an unreachable button teaches players it does
         nothing, which is how it came to be treated as decorative. */
      allies(state, actorId).forEach(function (allyId) {
        if (!enemies.length) return;
        moves.push(move('help', 'Help ' + (state.actors[allyId].name || allyId), 'action',
          { targetIds: [allyId, enemies[0]], warn: 'gives them advantage on their next attack' }));
      });
      enemies.forEach(function (id) {
        moves.push(move('grapple', 'Grapple ' + (state.actors[id].name || id), 'action',
          { targetIds: [id], warn: 'a contest, not an attack roll' }));
        moves.push(move('shove', 'Shove ' + (state.actors[id].name || id), 'action',
          { targetIds: [id], warn: 'a contest, not an attack roll' }));
      });

      /* Steadying a dying friend.
         2014, "Stabilizing a Creature": you may use your action to make a DC 10
         Wisdom (Medicine) check on a creature at 0 hit points, and a healer's
         kit does it without a roll. There was no such action anywhere — the
         only ways out of dying were a heal spell or three lucky death saves,
         which made a party without a caster helpless to save anybody. Offered
         only against someone actually down and within reach, because that is
         when it means something. */
      dyingAllies(state, actorId).forEach(function (id) {
        var kit = healersKit(a);
        moves.push(move('stabilise', 'Steady ' + (state.actors[id].name || id), 'action',
          {
            targetIds: [id],
            warn: kit ? 'a healer\u2019s kit, no roll needed \u2014 one use'
              : 'a DC 10 Wisdom (Medicine) check',
          }));
      });
    }
    if (canBonus(a) && twoWeaponEligible(state, actorId)) {
      enemies.forEach(function (id) {
        moves.push(move('two_weapon_attack', 'Off-hand strike ' + (state.actors[id].name || id), 'bonus',
          { targetIds: [id], warn: 'off-hand adds no ability modifier to damage' }));
      });
    }

    /* Getting free. A grappled character could see no way out of it from the
       action bar, which made the condition look permanent. */
    var grapple = a.runtime.conditions && a.runtime.conditions.grappled;
    if (grapple && canAct(a)) {
      var byId = grapple.by || grapple.source || null;
      var byName = (byId && state.actors[byId] && state.actors[byId].name) || 'the grapple';
      moves.push(move('escape_grapple', 'Break free of ' + byName, 'action',
        { targetIds: byId ? [byId] : [], warn: 'Athletics or Acrobatics against their Athletics' }));
    }
    return moves;
  };

  /**
   * Holding an action for a trigger.
   *
   * 2014, "Ready": you spend your action, name a perceivable trigger and the
   * action you will take, and when the trigger fires you spend your REACTION
   * to take it. It expires at the start of your next turn.
   *
   * This printed "readies an action" and stored nothing at all — no trigger, no
   * held action, no expiry and no reaction — so one of the four things a
   * character can do with their action did precisely nothing.
   *
   * The trigger modelled is the one the engine can detect and the one most
   * used at a table: somebody coming within your reach. It fires through the
   * ordinary attack path, so reach, advantage and the reaction economy all
   * apply exactly as they do anywhere else.
   */
  function readyResolve(state, command, ctx) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'no one to act');
    if (!canAct(a)) return Events.refuse(b, 'no-action', a.name + ' has no action left this turn');
    if (a.runtime.readied) {
      return Events.refuse(b, 'already-readied', a.name + ' is already holding an action');
    }

    var watchId = (command.primary.targetIds || [])[0] || null;
    var watchName = watchId && state.actors[watchId]
      ? (state.actors[watchId].name || watchId) : null;

    Events.push(b, 'action_economy', { actorId: command.actorId, action: false }, '');
    Events.push(b, 'ready', {
      actorId: command.actorId,
      trigger: 'approach',
      watchId: watchId,
      verb: 'attack',
      round: (state.combat && state.combat.round) || 0,
    }, a.name + ' holds their attack, watching ' +
      (watchName || 'for anyone who comes close') + '.');
    return b;
  }

  /**
   * Does anybody's readied action fire because this creature just moved?
   *
   * Called after a move is applied, with the same shadow-state discipline the
   * rest of the movement resolver uses: the events go into the mover's batch,
   * so the whole turn commits atomically.
   */
  function firedReadiedActions(state, moverId, dest, b) {
    var mover = actor(state, moverId);
    if (!mover || !dest || isDown(mover)) return;

    /* The move event is in the batch but has not been applied, so the mover is
       still standing where they started. Both the reach test and the attack
       that follows have to see them where they are GOING, or a readied strike
       measures the distance they came from and refuses itself. The position is
       borrowed for the length of the resolution and put straight back; the
       committed `move` event is what actually changes it. */
    var was = mover.runtime.pos;
    mover.runtime.pos = { x: dest.x, y: dest.y };
    try {
      Object.keys(state.actors || {}).forEach(function (id) {
        if (id === moverId) return;
        var watcher = actor(state, id);
        var held = watcher && watcher.runtime && watcher.runtime.readied;
        if (!held || held.trigger !== 'approach') return;
        if (isDown(watcher) || !canReact(watcher)) return;
        if (watcher.side === mover.side) return;              // you do not ambush your own
        if (held.watchId && held.watchId !== moverId) return; // waiting for someone else

        var span = weaponSpan(state, id, profileFor(state, id, {}), {});
        var reach = span ? (span.melee ? span.reach : span.normal || CELL) : CELL;
        var apart = distanceFt(watcher, mover);
        if (apart == null || apart > reach) return;

        Events.push(b, 'ready_clear', { actorId: id },
          (watcher.name || id) + ' has been waiting for this.');
        var strike = attackResolve(state, {
          commandId: (b.commandId || 'ready') + ':' + id,
          actorId: id,
          primary: { verb: 'attack', targetIds: [moverId] },
        }, {}, { reaction: true });
        if (strike && !strike.refused) {
          (strike.events || []).forEach(function (e) { b.events.push(e); });
          b.beats = b.beats.concat(strike.beats || []);
        }
      });
    } finally {
      mover.runtime.pos = was;
    }
  }

  function resolveMovement(state, command, ctx) {
    ctx = ctx || {};
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    if (!a) return Events.refuse(b, 'no-actor', 'no one to move');
    var verb = command.primary.verb;

    /* Standing up costs HALF your speed (PHB "Being Prone"), and it used to be
       free — a character could stand, move their full distance and attack, in
       a rule specifically written to make going down cost something. */
    if (verb === 'stand_up') {
      if (!(a.runtime.conditions && a.runtime.conditions.prone)) {
        return Events.refuse(b, 'not-prone', a.name + ' is already on their feet');
      }
      var half = Math.floor(speedOf(a) / 2);
      if (inCombat(state) && movementLeft(a) < half) {
        return Events.refuse(b, 'no-speed', 'standing up costs ' + half + ' ft of movement');
      }
      if (inCombat(state)) {
        Events.push(b, 'action_economy', { actorId: command.actorId, movementUsed: half }, '');
      }
      Events.push(b, 'condition_remove', { targetId: command.actorId, condition: 'prone' },
        a.name + ' stands up.');
      return b;
    }
    if (verb === 'drop_prone') {
      if (a.runtime.conditions && a.runtime.conditions.prone) {
        return Events.refuse(b, 'already-prone', a.name + ' is already prone');
      }
      /* Dropping prone is free — it costs no part of the action economy. */
      Events.push(b, 'condition_add', { targetId: command.actorId, condition: 'prone' },
        a.name + ' drops prone.');
      return b;
    }

    /* Mounting or dismounting costs half your speed (PHB "Mounted Combat"). */
    if (verb === 'mount' || verb === 'dismount') {
      return resolveMounting(state, command, b, a, verb, ctx);
    }

    /* A jump is measured in feet and paid for out of movement. */
    if (verb === 'jump') {
      return resolveJump(state, command, b, a, ctx);
    }

    /* Climbing, swimming and crawling are not separate actions: they are
       movement that costs an extra foot for every foot (PHB "Difficult
       Terrain" / "Climbing, Swimming, and Crawling"). Where the going is
       genuinely hard the DM may call for an Athletics check, which is what
       `ctx.obstacles` describes. */
    var mode = (verb === 'climb' || verb === 'swim' || verb === 'crawl') ? verb : null;
    if (mode === 'crawl' && !(a.runtime.conditions && a.runtime.conditions.prone)) {
      return Events.refuse(b, 'not-prone', 'crawling is how a prone creature moves');
    }

    var path = command.primary.path || (command.primary.point ? [a.runtime.pos, command.primary.point] : null);
    if (!path || path.length < 2) {
      if (mode) return resolveModeMove(state, command, b, a, mode, ctx);
      return Events.refuse(b, 'no-path', 'no destination to move to');
    }
    var cost = pathCost(path, {
      difficult: ctx.difficult,
      /* One EXTRA foot per foot for climbing, swimming or crawling — added to
         any difficult-terrain cost rather than multiplied with it. */
      extras: mode ? 1 : 0,
    });
    if (cost.illegal) return Events.refuse(b, 'illegal-move', 'that is not a step-by-step path');
    var total = cost.cost;
    if (total > movementLeft(a)) return Events.refuse(b, 'no-speed', 'not enough movement left to go there');

    var dest = path[path.length - 1];
    var plainFeet = (path.length - 1) * CELL;
    Events.push(b, 'move', { actorId: command.actorId, to: dest, from: a.runtime.pos, movementUsed: total },
      a.name + ' ' + (mode ? MODE_VERB[mode] : 'moves') + ' ' + plainFeet + ' ft' +
      (total !== plainFeet ? ' (' + total + ' ft of movement)' : '') + '.');

    /* Note any opportunity attacks the move provokes — the loop offers them to
       the reacting seats, it does not resolve them here. Disengaging (a stance
       set this turn) suppresses them. */
    if (!(a.runtime.conditions && a.runtime.conditions.disengaging)) {
      var enemies = Object.keys(state.actors || {}).filter(function (id) {
        var o = state.actors[id];
        return o.side && a.side && o.side !== a.side && o.runtime && !o.runtime.dead && o.runtime.pos;
      });
      enemies.forEach(function (id) {
        var o = state.actors[id];
        if (provokesOpportunity(a.runtime.pos, dest, o.runtime.pos, { reachFt: (o.runtime.reach || CELL) })) {
          Events.push(b, 'note', { text: 'opportunity', from: id, against: command.actorId },
            a.name + ' leaves ' + o.name + '\u2019s reach, provoking an opportunity attack.');
        }
      });
    }

    /* And anyone holding an action for exactly this. */
    firedReadiedActions(state, command.actorId, dest, b);
    return b;
  }

  var MODE_VERB = { climb: 'climbs', swim: 'swims', crawl: 'crawls' };

  function inCombat(state) { return !!(state.combat && state.combat.active); }

  /**
   * Climb, swim or crawl a named obstacle rather than a mapped path.
   *
   * The map is a skirmish grid, not a terrain model, so "climb the chapel
   * wall" is described by the scene rather than drawn on it. Slippery or
   * otherwise treacherous going calls for an Athletics check, exactly as the
   * rules say the DM may.
   */
  function resolveModeMove(state, command, b, a, mode, ctx) {
    var id = command.primary.targetId || (command.primary.targetIds || [])[0] ||
      command.primary.note || null;
    var obs = ((ctx && ctx.obstacles) || []).filter(function (o) {
      return o.id === id || o.kind === mode;
    })[0];
    if (!obs) return Events.refuse(b, 'nothing-to-' + mode, 'there is nothing here to ' + mode);

    var feet = obs.distanceFt || 10;
    var cost = feet * 2;                      // an extra foot for every foot
    if (inCombat(state) && cost > movementLeft(a)) {
      return Events.refuse(b, 'no-speed', mode + 'ing that costs ' + cost + ' ft of movement');
    }
    if (inCombat(state)) {
      Events.push(b, 'action_economy', { actorId: command.actorId, movementUsed: cost }, '');
    }

    if (obs.dc) {
      /* The DM's call for treacherous going. `check()` lives in the
         interaction module, not this one, so the roll goes through Rules the
         way every other contest in this file does. */
      var derived = (ctx && ctx.derivedA) || a.derived;
      if (derived) {
        var roll = Rules.skillCheck(derived, obs.skill || 'athletics', { rng: state.rng });
        var made = roll.total >= obs.dc;
        Events.push(b, 'roll', {
          of: mode, actorId: command.actorId, dc: obs.dc, result: roll, success: made,
        }, a.name + ' tries ' + obs.name + ': ' + roll.total + ' against DC ' + obs.dc +
          (made ? ' — they manage it.' : ' — they do not.'));
        if (!made) {
          Events.push(b, 'note', { text: mode + '-failed', actorId: command.actorId },
            a.name + ' cannot manage ' + obs.name + '.');
          return b;
        }
      }
    }
    Events.push(b, 'note', { text: mode, actorId: command.actorId, detail: obs.id },
      a.name + ' ' + MODE_VERB[mode] + ' ' + obs.name + '.');
    return b;
  }

  /**
   * A jump.
   *
   * Long jump: your Strength SCORE in feet, but ONLY with a ten-foot running
   * start — without one you cover half that. High jump: 3 + your Strength
   * modifier, again halved without a run-up. Both are paid for out of movement.
   *
   * The running start is a real condition, not a flag the caller passes: it
   * means ten feet moved on foot immediately before the jump. Defaulting to
   * "running" gave a character who had not moved at all the full distance,
   * which is most of a square of free reach every turn.
   */
  function resolveJump(state, command, b, a, ctx) {
    var abil = a.derived && a.derived.abilities ? a.derived.abilities : (a.base && a.base.abilities) || {};
    var str = abil.str || 10;
    var mod = Math.floor((str - 10) / 2);
    var high = (command.primary.note === 'high' || (command.primary.suggestion || {}).jump === 'high');

    /* Did they actually take a run-up? The turn records how far they have
       moved; ten feet of it immediately before the jump is the requirement. */
    var t = turnOf(a);
    var movedThisTurn = t ? Math.max(0, speedOf(a) - (t.movementRemaining || 0)) : 0;
    var running = command.primary.runningStart === true ||
      (command.primary.runningStart !== false && movedThisTurn >= 10);

    var full = high ? Math.max(0, 3 + mod) : str;
    var distance = running ? full : Math.floor(full / 2);

    if (inCombat(state)) {
      var need = Math.max(CELL, distance);
      if (need > movementLeft(a)) {
        return Events.refuse(b, 'no-speed', 'a jump that far needs ' + need + ' ft of movement');
      }
      Events.push(b, 'action_economy', { actorId: command.actorId, movementUsed: need }, '');
    }

    var gap = ((ctx && ctx.obstacles) || []).filter(function (o) { return o.kind === 'jump'; })[0];
    if (gap && (gap.distanceFt || 0) > distance) {
      /* Too far to clear. Saying so plainly — with the numbers — is better
         than a silent failure or an invented success. */
      Events.push(b, 'note', { text: 'jump-short', actorId: command.actorId },
        a.name + ' judges ' + gap.name + ' too wide to clear \u2014 ' + distance +
        ' ft of jump against ' + gap.distanceFt + ' ft of gap' +
        (running ? '' : ', and there is no room for a run-up') + '.');
      return b;
    }
    Events.push(b, 'note', { text: 'jump', actorId: command.actorId },
      a.name + ' jumps ' + distance + ' ft' + (high ? ' straight up' : '') +
      (running ? '' : ' from standing') +
      (gap ? ', clearing ' + gap.name : '') + '.');
    return b;
  }

  /**
   * Getting on and off a mount, at half your speed — and once per move.
   *
   * Without the limit a character with sixty feet of movement could mount,
   * dismount, mount and dismount again in a single turn, which is four
   * repositionings of a creature the rules allow one of.
   */
  function resolveMounting(state, command, b, a, verb, ctx) {
    var t = turnOf(a);
    if (inCombat(state) && t && t.mountedThisMove) {
      return Events.refuse(b, 'already-mounted-this-move',
        'you can mount or dismount only once in a move');
    }

    if (verb === 'dismount') {
      if (!a.runtime.mountedOn) return Events.refuse(b, 'not-mounted', a.name + ' is not mounted');
      var offHalf = Math.floor(speedOf(a) / 2);
      if (inCombat(state) && movementLeft(a) < offHalf) {
        return Events.refuse(b, 'no-speed', 'dismounting costs ' + offHalf + ' ft of movement');
      }
      if (inCombat(state)) {
        Events.push(b, 'action_economy',
          { actorId: command.actorId, movementUsed: offHalf, mountedThisMove: true }, '');
      }
      Events.push(b, 'mount', { actorId: command.actorId, mountId: null }, a.name + ' dismounts.');
      return b;
    }

    if (a.runtime.mountedOn) return Events.refuse(b, 'already-mounted', a.name + ' is already mounted');
    var wantId = command.primary.targetId || (command.primary.targetIds || [])[0] || null;
    var mounts = (ctx && ctx.mounts) || [];
    var m = wantId ? mounts.filter(function (x) { return x.id === wantId; })[0] : mounts[0];
    if (!m) return Events.refuse(b, 'no-mount', 'there is nothing here to ride');

    var half = Math.floor(speedOf(a) / 2);
    if (inCombat(state) && movementLeft(a) < half) {
      return Events.refuse(b, 'no-speed', 'mounting costs ' + half + ' ft of movement');
    }
    if (inCombat(state)) {
      Events.push(b, 'action_economy',
        { actorId: command.actorId, movementUsed: half, mountedThisMove: true }, '');
    }
    Events.push(b, 'mount', { actorId: command.actorId, mountId: m.id, mountName: m.name },
      a.name + ' mounts ' + m.name + '.');
    return b;
  }

  resolveMovement.legalMoves = function (state, actorId, ctx) {
    var a = actor(state, actorId);
    if (!a || isDown(a)) return [];
    ctx = ctx || {};
    var moves = [];
    var prone = !!(a.runtime.conditions && a.runtime.conditions.prone);
    var left = movementLeft(a);
    var half = Math.floor(speedOf(a) / 2);
    var fighting = inCombat(state);

    /* Getting up, and going down. Both were reachable only by typing them,
       which meant a prone character had no way back to their feet from the
       action bar at all. */
    if (prone) {
      if (!fighting || left >= half) {
        moves.push(move('stand_up', 'Stand up', 'movement', { warn: 'costs ' + half + ' ft of movement' }));
      }
      if (left > 0) moves.push(move('crawl', 'Crawl', 'movement', { warn: 'every foot costs two' }));
    } else {
      moves.push(move('drop_prone', 'Drop prone', 'free',
        { warn: 'ranged attacks against you have disadvantage; melee has advantage' }));
    }

    if (left <= 0) return moves;

    /* Somewhere worth moving TO.
       Enforcing weapon reach made this necessary: before it, everyone could
       hit everyone from anywhere, so "move" never had to mean anything. With
       reach real, a fight where the sides start apart cannot begin unless
       somebody closes — and a bare "Move" button with no destination gave
       neither a player nor a policy any way to do it. A boss fight ran until
       the step limit with both sides standing still.

       There used to be a destinationless `move` offered here as well, before
       these. It could never resolve — the resolver refuses a move with no path
       — so it was a button that answered every click with "no destination to
       move to", and because it was pushed first it took the group's label and
       sat at the head of the target list, which is exactly where a player
       clicks. Every destination offered now carries a path. */
    if (!prone && state.combat && state.combat.active) {
      var reachable = closeableTargets(state, actorId, left);
      reachable.forEach(function (t) {
        moves.push(move('move',
          (t.arrived ? 'Close on ' : 'Advance on ') + t.name + ' (' + t.cost + ' ft)',
          'movement',
          {
            path: t.path, targetIds: [t.id],
            /* This warning used to be passed as a fifth argument. `move` takes
               four, so it was dropped on the floor and the player was never
               told the advance falls short. */
            warn: t.arrived ? null : 'gets you nearer, but not yet within reach',
          }));
      });

      var away = retreatPath(state, actorId, left);
      if (away) {
        moves.push(move('move',
          'Back away from ' + away.name + ' (' + away.cost + ' ft)',
          'movement',
          {
            path: away.path,
            warn: 'leaving their reach provokes an opportunity attack unless you Disengage first',
          }));
      }
    }

    /* Terrain the scene says is there. */
    (ctx.obstacles || []).forEach(function (o) {
      if (o.kind === 'climb') {
        moves.push(move('climb', 'Climb ' + o.name, 'movement',
          { targetIds: [o.id], warn: 'every foot costs two' }));
      } else if (o.kind === 'swim') {
        moves.push(move('swim', 'Swim ' + o.name, 'movement',
          { targetIds: [o.id], warn: 'every foot costs two' }));
      } else if (o.kind === 'jump') {
        moves.push(move('jump', 'Jump ' + o.name, 'movement',
          { targetIds: [o.id], warn: 'a long jump clears your Strength score in feet' }));
      }
    });
    if (!(ctx.obstacles || []).some(function (o) { return o.kind === 'jump'; })) {
      moves.push(move('jump', 'Jump', 'movement',
        { warn: 'a long jump clears your Strength score in feet' }));
    }

    /* Mounts. */
    if (a.runtime.mountedOn) {
      if (!fighting || left >= half) moves.push(move('dismount', 'Dismount', 'movement',
        { warn: 'costs ' + half + ' ft of movement' }));
    } else {
      (ctx.mounts || []).forEach(function (m) {
        if (fighting && left < half) return;
        moves.push(move('mount', 'Mount ' + m.name, 'movement',
          { targetIds: [m.id], warn: 'costs ' + half + ' ft of movement' }));
      });
    }
    return moves;
  };

  /* -------------------------------------------------------------- meta ----- */

  function resolveMeta(state, command) {
    var b = Events.makeBatch(command);
    var a = actor(state, command.actorId);
    var verb = command.primary.verb;
    if (verb === 'end_turn') {
      Events.push(b, 'turn_end', { actorId: command.actorId }, (a ? a.name : command.actorId) + ' ends their turn.');
      return b;
    }
    if (verb === 'pass') {
      Events.push(b, 'note', { text: 'pass', actorId: command.actorId }, (a ? a.name : command.actorId) + ' does nothing.');
      return b;
    }
    if (verb === 'note') {
      /* A player writing something down. It changes nothing mechanically and
         is never narrated as fiction, but it belongs in the transcript — a
         table's notes are part of the record of the session. */
      var text = command.primary.note || (command.primary.improvised || '');
      if (!text) return Events.refuse(b, 'no-text', 'there is nothing written down');
      Events.push(b, 'note', { text: text, actorId: command.actorId, ooc: true },
        (a ? a.name : command.actorId) + ' notes: ' + text);
      return b;
    }
    return Events.refuse(b, 'unknown-verb', 'meta does not handle ' + verb);
  }

  resolveMeta.legalMoves = function (state, actorId) {
    /* Nothing is offered to someone who is unconscious \u2014 not even passing.
       Their turn is resolved by startTurn rolling a death save. */
    if (isDown(actor(state, actorId))) return [];
    return [
      move('end_turn', 'End turn', 'free'),
      move('pass', 'Do nothing', 'free'),
    ];
  };

  /* ==================================================== monster actions =====
     The statblock shape lives in docs/PLAN.md 3.6 and the srd_monsters data:
     `multiattack.sequence` is a list of {actionRef, count}; `recharge` is a
     [min, max] band; `legendaryActions` is {perRound, options:[{cost,actionRef}]};
     `legendaryResistance` is a remaining count. */

  function multiattackSequence(statblock) {
    var ma = statblock && statblock.multiattack;
    if (!ma || !ma.sequence) return [];
    var out = [];
    ma.sequence.forEach(function (part) {
      for (var i = 0; i < (part.count || 1); i++) out.push(part.actionRef);
    });
    return out;
  }

  /* A monster's multiattack as one batch: a chain of attacks that each spend
     nothing extra (the whole thing is the single Attack action). */
  /**
   * A monster's multiattack as one batch.
   *
   * Each swing must see the damage the previous one did. Resolving them all
   * against the same snapshot meant every attack in the sequence read the
   * ORIGINAL temporary hit points and spent them again: two 4-damage hits
   * against 5 temporary hit points left the target on 20 HP and 1 temp
   * instead of 17 and 0. So the sequence is resolved against a shadow state
   * that is advanced after each swing, while the events are still collected
   * into a single batch the caller commits atomically.
   */
  /**
   * The Attack ACTION, which is not the same thing as one attack.
   *
   * Extra Attack means the action buys two swings at fifth level, three at
   * eleventh and four at twentieth for a fighter, and two at fifth for a
   * barbarian, paladin, ranger or monk. The class table has said so from the
   * beginning and nothing read it, so a level-twenty fighter attacked once —
   * a quarter of the character, quietly missing.
   *
   * Each swing sees the result of the last, through the same shadow state the
   * monsters' multiattack uses: hitting a creature that the first blow already
   * killed is not a thing that happens at a table.
   */
  /**
   * How far this attack can actually reach.
   *
   * A melee weapon reaches five feet, or ten with the `reach` property. A
   * ranged one has a normal band and a long band: beyond normal you have
   * disadvantage, beyond long you cannot shoot at all. Monsters carry their
   * reach on the action itself.
   *
   * The SRD item data records weapon PROPERTIES but no distances, so the bands
   * live here, from the 2014 weapon table.
   */
  var RANGES = {
    'blowgun': [25, 100], 'crossbow-hand': [30, 120], 'crossbow-light': [80, 320],
    'crossbow-heavy': [100, 400], 'dart': [20, 60], 'shortbow': [80, 320],
    'sling': [30, 120], 'longbow': [150, 600], 'net': [5, 15],
    'javelin': [30, 120], 'handaxe': [20, 60], 'light-hammer': [20, 60],
    'spear': [20, 60], 'trident': [20, 60], 'dagger': [20, 60],
  };

  function weaponSpan(state, actorId, profile, opts) {
    /* A monster's action states its own reach, and a ranged one its range. */
    if (profile && profile.reach && !profile.weaponId) {
      if (profile.range && profile.range.length) {
        return { melee: false, normal: profile.range[0], long: profile.range[1] || profile.range[0] };
      }
      return { melee: true, reach: profile.reach };
    }

    var a = actor(state, actorId);
    var item = equippedWeapon(a, opts);
    if (!item) return { melee: true, reach: CELL };   // fists

    var props = (item.properties || []).map(function (p) { return String(p).toLowerCase(); });
    var band = RANGES[item.id];
    var ranged = item.subcategory === 'martial-ranged' || item.subcategory === 'simple-ranged' ||
      props.indexOf('ammunition') >= 0;
    if (ranged && band) return { melee: false, normal: band[0], long: band[1] };
    if (ranged) return { melee: false, normal: 80, long: 320 };

    return { melee: true, reach: props.indexOf('reach') >= 0 ? CELL * 2 : CELL };
  }

  /** The weapon this attack is being made with, if any. */
  function equippedWeapon(a, opts) {
    if (!a || !a.runtime) return null;
    var eq = a.runtime.equipped || {};
    var uid = opts && opts.offHand ? (eq.offHand || eq.mainHand) : (eq.mainHand || eq.weapon);
    var inv = a.runtime.inventory || [];
    var held = uid ? inv.filter(function (i) { return (i.uid || i.id) === uid; })[0] : null;
    if (!held) {
      /* Nothing declared as held: the first weapon in the pack is what they
         are using, which is what every other part of the engine assumes. */
      held = inv.filter(function (i) { return isWeapon(i); })[0] || null;
    }
    if (!held) return null;
    var def = itemDefFor(held.id) || held;
    return Object.assign({ id: held.id }, def);
  }

  function isWeapon(i) {
    var def = itemDefFor(i && i.id);
    var d = def || i || {};
    return d.category === 'weapon' ||
      /weapon/.test(String(d.subcategory || '')) || !!d.damage;
  }

  function itemDefFor(id) {
    if (!id) return null;
    var T = (global.DND && global.DND.Data && global.DND.Data.ITEMS) || null;
    if (!T && typeof require !== 'undefined') {
      try { T = require('../data/srd_items.js').ITEMS; } catch (e) { T = null; }
    }
    return (T && T[id]) || null;
  }

  /** How far apart two creatures are, in feet, or null if either is off-map. */
  function distanceFt(a, b) {
    var p = a && a.runtime && a.runtime.pos;
    var q = b && b.runtime && b.runtime.pos;
    if (!p || !q) return null;
    return chebyshevFt(p, q);
  }

  /**
   * Enemies this creature could get into reach of with the movement it has
   * left, and the step-by-step path that would do it.
   *
   * A straight walk toward them, stopping the moment they are in reach. The
   * grid is small and open enough that a greedy line is the right amount of
   * cleverness here; anything more belongs in a pathfinder, and anything less
   * leaves a fight unable to start.
   */
  function closeableTargets(state, actorId, budget) {
    var a = actor(state, actorId);
    if (!a || !a.runtime.pos) return [];
    var span = weaponSpan(state, actorId, profileFor(state, actorId, {}), {});
    var want = span ? (span.melee ? span.reach : Math.min(span.normal || CELL, span.long || CELL)) : CELL;

    var out = [];
    perceivedEnemies(state, actorId).forEach(function (id) {
      var t = actor(state, id);
      if (!t || !t.runtime.pos) return;
      if (chebyshevFt(a.runtime.pos, t.runtime.pos) <= want) return;   // already close enough

      var path = [{ x: a.runtime.pos.x, y: a.runtime.pos.y }];
      var at = path[0];
      var spent = 0;
      var arrived = false;
      for (var step = 0; step < 40; step++) {
        if (chebyshevFt(at, t.runtime.pos) <= want) { arrived = true; break; }
        var next = {
          x: at.x + Math.sign(t.runtime.pos.x - at.x),
          y: at.y + Math.sign(t.runtime.pos.y - at.y),
        };
        /* Do not walk onto somebody; try either axis on its own instead. */
        if (occupied(state, next, actorId)) {
          var byX = { x: at.x + Math.sign(t.runtime.pos.x - at.x), y: at.y };
          var byY = { x: at.x, y: at.y + Math.sign(t.runtime.pos.y - at.y) };
          next = null;
          if ((byX.x !== at.x) && !occupied(state, byX, actorId)) next = byX;
          else if ((byY.y !== at.y) && !occupied(state, byY, actorId)) next = byY;
          if (!next) break;
        }
        /* Out of movement: stop here rather than abandoning the move
           entirely. Getting HALF way to the enemy is a real turn, and
           refusing to offer it left a character who could neither reach nor
           close with nothing to do but Dodge — which reads as the game being
           broken rather than the enemy being far away. */
        if (spent + CELL > budget) break;
        spent += CELL;
        path.push(next);
        at = next;
      }
      if (path.length > 1) {
        out.push({
          id: id, name: t.name || id, path: path, cost: spent, arrived: arrived,
        });
      }
    });
    /* Whoever we can actually reach first, then whoever we get closest to. */
    out.sort(function (x, y) {
      if (x.arrived !== y.arrived) return x.arrived ? -1 : 1;
      return x.cost - y.cost;
    });
    return out.slice(0, 4);
  }

  function occupied(state, p, exceptId) {
    return Object.keys(state.actors || {}).some(function (id) {
      if (id === exceptId) return false;
      var o = state.actors[id];
      return o && o.runtime && !o.runtime.dead && o.runtime.pos &&
        o.runtime.pos.x === p.x && o.runtime.pos.y === p.y;
    });
  }

  /**
   * Getting out, which is the other half of getting in.
   *
   * `closeableTargets` gave the bar a way to reach an enemy once weapon reach
   * became real, but nothing ever offered the reverse. A wounded character
   * standing toe to toe with something had no way to break off except by
   * typing it, so the only retreat in the whole action bar was Disengage —
   * which forgoes opportunity attacks without actually taking you anywhere.
   *
   * Only offered when somebody is genuinely on top of you; backing away from
   * an enemy already across the room is not a turn worth spending. The path
   * runs through the ordinary movement resolver, so leaving a reach provokes
   * exactly as it should unless the character disengaged first.
   */
  function retreatPath(state, actorId, budget) {
    var a = actor(state, actorId);
    if (!a || !a.runtime.pos || budget < CELL) return null;

    var threats = perceivedEnemies(state, actorId).map(function (id) {
      return actor(state, id);
    }).filter(function (t) {
      return t && t.runtime.pos && !t.runtime.dead &&
        chebyshevFt(a.runtime.pos, t.runtime.pos) <= CELL;
    });
    if (!threats.length) return null;

    /* Away from the middle of whoever is crowding us, so backing out of two
       enemies does not walk straight into a third. */
    var cx = 0, cy = 0;
    threats.forEach(function (t) { cx += t.runtime.pos.x; cy += t.runtime.pos.y; });
    cx /= threats.length; cy /= threats.length;

    var path = [{ x: a.runtime.pos.x, y: a.runtime.pos.y }];
    var at = path[0];
    var spent = 0;
    var dx = Math.sign(at.x - cx) || 1;
    var dy = Math.sign(at.y - cy);
    while (spent + CELL <= budget && path.length <= 8) {
      var next = { x: at.x + dx, y: at.y + dy };
      if (occupied(state, next, actorId)) {
        var byX = { x: at.x + dx, y: at.y };
        var byY = { x: at.x, y: at.y + dy };
        next = null;
        if (dx && !occupied(state, byX, actorId)) next = byX;
        else if (dy && !occupied(state, byY, actorId)) next = byY;
        if (!next) break;
      }
      spent += CELL;
      path.push(next);
      at = next;
    }
    if (path.length < 2) return null;
    return { path: path, cost: spent, name: threats[0].name || 'them', threats: threats.length };
  }

  function attackAction(state, command, ctx, opts) {
    ctx = ctx || {};
    opts = opts || {};
    var attackerId = command.actorId;
    var attacker = actor(state, attackerId);
    if (!attacker) return Events.refuse(Events.makeBatch(command), 'no-actor', 'nobody is there to attack');

    var swings = (attacker.derivedCache && attacker.derivedCache.attacksPerAction) || 1;
    if (swings <= 1) return attackResolve(state, command, ctx, opts);

    var b = Events.makeBatch(command);
    if (!canAct(attacker)) return Events.refuse(b, 'no-action', 'no action left to attack with');

    var targets = command.primary.targetIds || (ctx.targetId ? [ctx.targetId] : []);
    Events.push(b, 'action_economy', { actorId: attackerId, action: false });

    var shadow = shadowOf(state);
    var landed = 0;
    for (var i = 0; i < swings; i++) {
      /* Fresh targets each swing: the one named, unless it has already fallen,
         in which case anything else within reach. */
      var targetId = targets[i] || targets[0];
      var t = actor(shadow, targetId);
      if (!t || t.runtime.dead || t.runtime.hp <= 0) {
        targetId = perceivedEnemies(shadow, attackerId).filter(function (id) {
          var o = actor(shadow, id);
          return o && !o.runtime.dead && o.runtime.hp > 0;
        })[0];
        if (!targetId) break;                 // nothing left standing
      }
      var sub = attackResolve(shadow, {
        commandId: command.commandId, actorId: attackerId,
        primary: { verb: opts.unarmed ? 'unarmed_strike' : 'attack', targetIds: [targetId] },
      }, ctx, Object.assign({}, opts, { free: true }));
      if (sub.refused) {
        /* Carry the real reason up. Swallowing it and reporting "nothing in
           reach" turned "your longsword does not reach that far" into a
           mystery. */
        if (!landed) return Events.refuse(b, sub.refused.reason, sub.refused.detail);
        break;
      }
      b.events = b.events.concat(sub.events);
      b.beats = b.beats.concat(sub.beats);
      applyToShadow(shadow, sub.events);
      landed++;
    }
    if (!landed) return Events.refuse(b, 'no-target', 'there is nothing in reach to attack');
    return b;
  }

  function monsterMultiattack(state, command, ctx) {
    var attackerId = command.actorId;
    var attacker = actor(state, attackerId);
    var b = Events.makeBatch(command);
    /* Every other combat path reads the top-level statblock; this one read
       `runtime.statblock`, which generated monsters do not have — so
       multiattack was unreachable for every monster in the game. */
    var block = statblockOf(attacker);
    if (!attacker || !block) return Events.refuse(b, 'no-statblock', 'not a statted creature');
    if (!canAct(attacker)) return Events.refuse(b, 'no-action', 'no action left to multiattack');

    var refs = multiattackSequence(block);
    if (!refs.length) return Events.refuse(b, 'no-multiattack', (attacker.name || attackerId) + ' has no multiattack');
    var targets = command.primary.targetIds || (ctx.targetId ? [ctx.targetId] : []);
    Events.push(b, 'action_economy', { actorId: attackerId, action: false });

    var shadow = shadowOf(state);
    refs.forEach(function (ref, i) {
      var targetId = targets[i] || targets[0];
      var t = actor(shadow, targetId);
      if (!t || t.runtime.dead) return;      // do not keep hitting a corpse
      var sub = attackResolve(shadow, {
        commandId: command.commandId, actorId: attackerId,
        primary: { verb: 'attack', targetIds: [targetId] },
      }, Object.assign({}, ctx, {}), { actionRef: ref, multiattack: true, free: true });
      if (sub.refused) return;
      b.events = b.events.concat(sub.events);
      b.beats = b.beats.concat(sub.beats);
      /* Advance the shadow so the next swing sees the result of this one. */
      applyToShadow(shadow, sub.events);
    });
    return b;
  }

  /** The statblock, wherever a given monster keeps it. */
  function statblockOf(a) {
    if (!a) return null;
    return a.statblock || (a.runtime && a.runtime.statblock) || null;
  }

  /* A throwaway copy used to sequence several attacks inside one batch. It is
     never committed and never seen by anything outside this function. */
  function shadowOf(state) {
    var copy = Object.create(Object.getPrototypeOf(state) || Object.prototype);
    for (var key in state) {
      if (!Object.prototype.hasOwnProperty.call(state, key)) continue;
      copy[key] = key === 'actors' ? cloneActors(state.actors) : state[key];
    }
    return copy;
  }

  function cloneActors(actors) {
    var out = {};
    Object.keys(actors || {}).forEach(function (id) {
      var a = actors[id];
      /* Everything an applier might write must be copied, not shared. Cloning
         only the runtime left `progression` shared with the live state, so an
         experience award applied to the shadow landed on the REAL character —
         and then landed again when the batch was committed. A monster killed
         mid-multiattack paid out twice. */
      out[id] = Object.assign({}, a, {
        runtime: JSON.parse(JSON.stringify(a.runtime || {})),
        progression: JSON.parse(JSON.stringify(a.progression || {})),
      });
    });
    return out;
  }

  function applyToShadow(shadow, events) {
    events.forEach(function (e) {
      var fn = Events.APPLY && Events.APPLY[e.kind];
      if (typeof fn === 'function') {
        try { fn(shadow, e, null); } catch (err) { /* the real commit will judge */ }
      }
    });
  }

  /* Recharge: an ability with `recharge:[min,max]` comes back when a d6 at the
     start of the monster's turn rolls at least `min`. */
  function rollRecharge(state, band) {
    if (!band || !band.length) return { ready: true, roll: null };
    var r = Dice.roll('1d6', { rng: state.rng });
    return { ready: r.total >= band[0], roll: r.total };
  }

  /* Legendary resistance turns a failed save into a success and spends one use.
     Pure: takes the current count, returns whether it fired and the new count. */
  function useLegendaryResistance(remaining) {
    if ((remaining || 0) <= 0) return { used: false, remaining: remaining || 0, save: 'fail' };
    return { used: true, remaining: remaining - 1, save: 'success' };
  }

  /* Legendary actions: a budget of `perRound` points, spent at the END of other
     creatures' turns and reset at the top of the monster's own turn. */
  function legendaryReset(statblock) {
    return (statblock && statblock.legendaryActions && statblock.legendaryActions.perRound) || 0;
  }
  function spendLegendaryAction(remaining, cost) {
    cost = cost || 1;
    if ((remaining || 0) < cost) return { ok: false, remaining: remaining || 0 };
    return { ok: true, remaining: remaining - cost };
  }

  var api = {
    CELL: CELL,
    /* geometry (imported by the UI verbatim) */
    centreFt: centreFt, euclidFt: euclidFt,
    chebyshevSquares: chebyshevSquares, chebyshevFt: chebyshevFt,
    squaresInSphere: squaresInSphere, squaresInCone: squaresInCone,
    pathCost: pathCost, provokesOpportunity: provokesOpportunity,
    lineOfSightCover: lineOfSightCover, hasLineOfSight: hasLineOfSight,
    segmentBlocksSquare: segmentBlocksSquare, corners: corners,
    /* economy */
    canAct: canAct, canBonus: canBonus, canReact: canReact,
    isDying: isDying, isDown: isDown, diesAtZero: diesAtZero,
    xpAwardEvents: xpAwardEvents,
    movementLeft: movementLeft, isSurprised: isSurprised,
    twoWeaponDamageBonus: twoWeaponDamageBonus,
    /* turn loop */
    beginEncounter: beginEncounter, startTurn: startTurn, endTurn: endTurn, advanceTurn: advanceTurn,
    upkeep: upkeep, encounterOver: encounterOver, endEncounter: endEncounter,
    perceivedEnemies: perceivedEnemies, attackAdvantage: attackAdvantage,
    withEffects: withEffects, skillMod: skillMod,
    applyDamageType: applyDamageType, helpResolve: helpResolve, hideResolve: hideResolve,
    /* damage pipeline */
    damageEvents: damageEvents,
    /* profiles + resolvers */
    profileFor: profileFor, targetAc: targetAc,
    resolveCombat: resolveCombat, resolveMovement: resolveMovement, resolveMeta: resolveMeta,
    /* monsters */
    multiattackSequence: multiattackSequence, monsterMultiattack: monsterMultiattack,
    rollRecharge: rollRecharge, useLegendaryResistance: useLegendaryResistance,
    legendaryReset: legendaryReset, spendLegendaryAction: spendLegendaryAction,
    /* registration */
    register: function () {
      if (!Dispatch) return api;
      Dispatch.register('combat', resolveCombat);
      Dispatch.register('movement', resolveMovement);
      Dispatch.register('meta', resolveMeta);
      return api;
    },
  };

  global.DND = global.DND || {};
  global.DND.Combat = api;
  /* Register on load rather than waiting to be asked. A resolver that exists
     but is not registered produces an actor with no legal moves, which looks
     exactly like a stuck AI rather than like a missing wiring call — and that
     is precisely how it was found. `register()` stays exported and is
     idempotent, so a caller may still be explicit. */
  api.register();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
