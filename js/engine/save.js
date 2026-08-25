/*
 * save.js — serialising a session, and getting it back exactly.
 *
 * Two audiences, one file. `state` is the machine's copy: enough to resume the
 * session precisely, including the RNG position, so a reloaded game continues
 * the same sequence of rolls it would have. `digest` is for a person — or a
 * reviewing model — to read the save and judge what happened without replaying
 * it, which is what makes an unattended playtest useful evidence rather than
 * an opaque blob.
 *
 * Version stamps are deliberately plural. A save that only records its own
 * schema version cannot tell you that the rules changed underneath it, and
 * "the same save loaded into a newer engine quietly plays differently" is a
 * much worse failure than an honest refusal.
 */
(function (global) {
  'use strict';

  function req(p) { return typeof require !== 'undefined' ? require(p) : null; }
  var RNG = (global.DND && global.DND.RNG) || (req('../rng.js') || {}).RNG;
  var State = (global.DND && global.DND.State) || req('./state.js');
  var Knowledge = (global.DND && global.DND.Knowledge) || req('./knowledge.js');

  var SAVE_FORMAT = 'aethertable-save';
  var SAVE_VERSION = 1;
  var ENGINE_VERSION = '0.1.0';
  var RULES_VERSION = '5e-2014';
  var PROMPT_VERSION = 1;
  var STORAGE_KEY = 'aethertable.save.v1';

  function serialize(session, meta) {
    meta = meta || {};
    var state = session.state;
    var out = {
      format: SAVE_FORMAT,
      version: SAVE_VERSION,
      engineVersion: ENGINE_VERSION,
      rulesVersion: RULES_VERSION,
      promptVersion: PROMPT_VERSION,
      commandVersion: 1,
      rngAlgorithm: 'mulberry32',
      savedAt: new Date().toISOString(),
      /* The caller passes a title (`saveLocal` sends the campaign's), and it
         used to be dropped on the floor — so the resume screen had nothing to
         name the save with but a bare campaign id. */
      title: meta.title || (session.campaign && session.campaign.title) || '',
      note: meta.note || '',
      campaignId: state.campaignId,
      campaignVersion: (session.campaign && session.campaign.version) || null,
      /* The identity of the campaign as the SESSION knows it, which is not
         always `state.campaignId`: a generated sandbox keeps the generic id on
         the state but gives the session its own id and title ("A matter at the
         hollow barrow"). Without this, resuming a generated world came back as
         a nameless generic sandbox. */
      campaign: session.campaign
        ? { id: session.campaign.id, title: session.campaign.title || '' }
        : null,

      digest: buildDigest(session),
      state: snapshotState(state),
      knowledgeFacts: factIndex(session.store),
      session: {
        recentNarration: session.recentNarration || [],
        pinned: session.pinned || [],
        summaries: session.summaries || [],
      },
    };
    return out;
  }

  function snapshotState(state) {
    var rngState = state.rng ? state.rng.state() : null;
    var copy = JSON.parse(JSON.stringify(Object.assign({}, state, { rng: undefined })));
    delete copy.rng;
    copy.rngState = rngState;
    return copy;
  }

  /**
   * Which facts exist and what stage each observer holds.
   *
   * Definitions are NOT saved — they belong to the campaign data and are
   * re-resolved by id on load. Saving them would freeze a campaign's secrets
   * at the version they were written, so a fixed typo or a rebalanced reveal
   * would never reach an existing game.
   */
  function factIndex(store) {
    if (!store) return { ids: [], known: {} };
    return {
      ids: Object.keys(store.facts || {}),
      known: JSON.parse(JSON.stringify(store.known || {})),
    };
  }

  /* ---------------------------------------------------------------- digest -- */

  /**
   * Everything the user asked to be able to verify after a playtest: dialogue,
   * items, relationships, character sheets, quests, world state.
   */
  function buildDigest(session) {
    var state = session.state;
    var base = State.digest(state);

    var sheets = {};
    Object.keys(state.actors).forEach(function (id) {
      var a = state.actors[id];
      if (a.side !== 'party' && !a.important) return;
      sheets[id] = {
        name: a.name,
        side: a.side,
        race: a.base && a.base.raceId,
        classes: a.base && a.base.classes,
        background: a.base && a.base.backgroundId,
        abilities: a.base && a.base.abilities,
        level: a.progression && a.progression.levels ? a.progression.levels.length : null,
        xp: a.progression && a.progression.xp,
        hp: a.runtime && a.runtime.hp,
        hpMax: a.runtime && a.runtime.hpMax,
        tempHp: a.runtime && a.runtime.tempHp,
        ac: a.derivedCache && a.derivedCache.ac,
        conditions: a.runtime && a.runtime.conditions ? Object.keys(a.runtime.conditions) : [],
        exhaustion: a.runtime && a.runtime.exhaustion,
        gold: a.runtime && a.runtime.gold,
        inventory: (a.runtime && a.runtime.inventory || []).map(function (i) {
          return { uid: i.uid, id: i.id, name: i.name, qty: i.qty || 1, equipped: !!i.equipped };
        }),
        attuned: a.runtime && a.runtime.attuned,
        equipped: a.runtime && a.runtime.equipped,
        slotsSpent: a.runtime && a.runtime.slotsSpent,
        resources: a.runtime && a.runtime.resources,
        preparedSpells: a.progression && a.progression.preparedSpells,
        deathSaves: a.runtime && a.runtime.deathSaves,
        /* An export that reports a dead character as alive is worse than no
           export. `dead` was being read from the derived cache, which does not
           carry it, so every corpse in the file looked fine. */
        dead: !!(a.runtime && a.runtime.dead),
        stable: !!(a.runtime && a.runtime.stable),
        cantripsKnown: a.progression && a.progression.cantripsKnown,
        backstory: a.base && a.base.backstory,
      };
    });

    /* The full transcript, not a sample. The point of an export is to be able
       to read what actually happened. */
    var transcript = (state.transcript || []).map(function (t) {
      return { at: t.at, revision: t.revision, speaker: t.speaker, kind: t.kind, text: t.text };
    });

    var combatLog = [];
    (state.log || []).forEach(function (b) {
      if (!b.beats || !b.beats.length) return;
      combatLog.push({
        commandId: b.commandId, actorId: b.actorId, at: b.at,
        beats: b.beats, narration: b.narration || null,
        refused: b.refused || null,
      });
    });

    var knowledge = {};
    Object.keys(state.knowledge || {}).forEach(function (obs) {
      knowledge[obs] = Object.keys(state.knowledge[obs]).map(function (fid) {
        return {
          factId: fid,
          stage: state.knowledge[obs][fid].stage,
          provenance: state.knowledge[obs][fid].provenance,
        };
      });
    });

    return Object.assign(base, {
      sheets: sheets,
      transcript: transcript,
      transcriptLines: transcript.length,
      combatLog: combatLog,
      knowledge: knowledge,
      quests: state.quests,
      flags: state.flags,
      relationships: state.relationships,
      effects: state.effects,
      seats: (state.seats || []).map(function (s) {
        return {
          id: s.id, name: s.name, actorId: s.actorId, control: s.control,
          agent: s.agent ? { backend: s.agent.backend, model: s.agent.model } : null,
        };
      }),
      meta: state.meta,
    });
  }

  /* ------------------------------------------------------------ deserialize -- */

  function deserialize(blob, opts) {
    opts = opts || {};
    if (!blob || blob.format !== SAVE_FORMAT) {
      throw new Error('not an AETHERTABLE save file');
    }
    if (blob.version > SAVE_VERSION) {
      throw new Error('this save was written by a newer version of the game (save v' +
        blob.version + ', this build reads v' + SAVE_VERSION + ')');
    }

    var warnings = [];
    if (blob.rulesVersion && blob.rulesVersion !== RULES_VERSION) {
      warnings.push('saved under rules ' + blob.rulesVersion + ', now running ' + RULES_VERSION);
    }
    if (blob.engineVersion && blob.engineVersion !== ENGINE_VERSION) {
      warnings.push('saved by engine ' + blob.engineVersion + ', now running ' + ENGINE_VERSION);
    }

    var state = migrate(blob.state, blob.version, warnings);
    state.rng = state.rngState ? RNG.fromState(state.rngState) : new RNG(state.seed);
    delete state.rngState;

    var store = opts.store || Knowledge.makeStore();
    /* Definitions come from the campaign; only what was LEARNED is restored. */
    if (blob.knowledgeFacts && blob.knowledgeFacts.known) {
      store.known = JSON.parse(JSON.stringify(blob.knowledgeFacts.known));
      state.knowledge = store.known;
      (blob.knowledgeFacts.ids || []).forEach(function (id) {
        if (!store.facts[id]) {
          warnings.push('save refers to fact "' + id + '" which this campaign no longer defines');
        }
      });
    }

    return {
      state: state,
      store: store,
      session: blob.session || { recentNarration: [], pinned: [], summaries: [] },
      digest: blob.digest,
      /* How the session knew its own campaign. A generated sandbox keeps the
         generic id on the state but names itself something specific, and
         without this a resumed world came back as a nameless sandbox. */
      campaign: blob.campaign || null,
      warnings: warnings,
    };
  }

  /**
   * Fill in what a newer build expects and an older save could not have had.
   * Defensive rather than clever: a missing field becomes its empty value, and
   * anything genuinely unresolvable is reported rather than guessed.
   */
  function migrate(state, fromVersion, warnings) {
    var s = JSON.parse(JSON.stringify(state || {}));
    s.v = s.v || 1;
    s.actors = s.actors || {};
    s.seats = s.seats || [];
    s.controllers = s.controllers || {};
    s.effects = s.effects || [];
    s.quests = s.quests || {};
    s.flags = s.flags || {};
    s.relationships = s.relationships || {};
    s.knowledge = s.knowledge || {};
    s.log = s.log || [];
    s.transcript = s.transcript || [];
    s.appliedCommandIds = s.appliedCommandIds || {};
    s.discoveredLocations = s.discoveredLocations || {};
    s.combat = s.combat || { active: false, round: 0, order: [], turnIndex: 0, encounterId: null };
    s.meta = s.meta || { ruleset: RULES_VERSION };
    s.revision = s.revision || 0;
    s.turnEpoch = s.turnEpoch || 0;
    s.clock = s.clock || 0;

    Object.keys(s.actors).forEach(function (id) {
      var a = s.actors[id];
      a.runtime = a.runtime || {};
      var r = a.runtime;
      if (r.tempHp == null) r.tempHp = 0;
      if (r.exhaustion == null) r.exhaustion = 0;
      r.conditions = r.conditions || {};
      r.inventory = r.inventory || [];
      r.attuned = r.attuned || [];
      r.equipped = r.equipped || {};
      r.resources = r.resources || {};
      r.slotsSpent = r.slotsSpent || {};
      r.hitDiceSpent = r.hitDiceSpent || {};
      r.deathSaves = r.deathSaves || { successes: 0, failures: 0 };
      if (r.gold == null) r.gold = 0;
      a.progression = a.progression || { xp: 0, levels: [] };
      a.base = a.base || {};
    });
    return s;
  }

  /* -------------------------------------------------------------- markdown -- */

  /**
   * A readable companion to the JSON. This is what a person (or a reviewing
   * model) actually opens after a playtest.
   */
  function toMarkdown(session, meta) {
    meta = meta || {};
    var d = buildDigest(session);
    var L = [];
    L.push('# ' + ((session.campaign && session.campaign.title) || 'AETHERTABLE session'));
    L.push('');
    L.push('- **Saved:** ' + new Date().toISOString());
    L.push('- **Campaign:** ' + d.campaignId);
    L.push('- **Location:** ' + (d.locationId || 'unknown'));
    L.push('- **Revision:** ' + d.revision + '  ·  **Turns committed:** ' + d.committedBatches);
    L.push('- **In combat:** ' + (d.inCombat ? 'yes' : 'no'));
    if (meta.note) L.push('- **Note:** ' + meta.note);
    L.push('');

    L.push('## Seats');
    (d.seats || []).forEach(function (s) {
      L.push('- **' + s.name + '** plays ' + s.actorId + ' — ' +
        (s.control === 'human' ? 'human' : 'AI' + (s.agent ? ' (' + s.agent.backend + ' ' + s.agent.model + ')' : '')));
    });
    L.push('');

    L.push('## Characters');
    Object.keys(d.sheets).forEach(function (id) {
      var c = d.sheets[id];
      L.push('### ' + c.name);
      L.push('- ' + [c.race, (c.classes || []).map(function (k) { return k.classId + ' ' + k.levels; }).join(' / ')].filter(Boolean).join(' '));
      L.push('- HP ' + c.hp + '/' + c.hpMax + (c.tempHp ? ' (+' + c.tempHp + ' temp)' : '') +
        (c.ac ? '  ·  AC ' + c.ac : ''));
      if (c.abilities) {
        L.push('- ' + Object.keys(c.abilities).map(function (k) {
          return k.toUpperCase() + ' ' + c.abilities[k];
        }).join('  '));
      }
      if (c.conditions && c.conditions.length) L.push('- Conditions: ' + c.conditions.join(', '));
      if (c.exhaustion) L.push('- Exhaustion: ' + c.exhaustion);
      L.push('- Gold: ' + (c.gold || 0));
      if (c.inventory && c.inventory.length) {
        L.push('- Carrying: ' + c.inventory.map(function (i) {
          return (i.name || i.id) + (i.qty > 1 ? ' x' + i.qty : '') + (i.equipped ? ' (equipped)' : '');
        }).join(', '));
      }
      if (c.preparedSpells && c.preparedSpells.length) L.push('- Prepared: ' + c.preparedSpells.join(', '));
      if (c.resources && Object.keys(c.resources).length) {
        L.push('- Resources: ' + Object.keys(c.resources).map(function (k) {
          return k + ' ' + c.resources[k];
        }).join(', '));
      }
      L.push('');
    });

    if (Object.keys(d.relationships || {}).length) {
      L.push('## Relationships');
      Object.keys(d.relationships).forEach(function (key) {
        var r = d.relationships[key];
        L.push('- **' + key.replace('->', ' \u2192 ') + '**: affinity ' + r.affinity +
          ', trust ' + r.trust + ', respect ' + r.respect + ', fear ' + r.fear);
        (r.history || []).slice(-4).forEach(function (h) { L.push('  - ' + h.because); });
      });
      L.push('');
    }

    if (Object.keys(d.quests || {}).length) {
      L.push('## Quests');
      Object.keys(d.quests).forEach(function (q) {
        var quest = d.quests[q];
        L.push('- [' + (quest.status === 'done' ? 'x' : ' ') + '] **' + q + '** — ' + quest.status);
        Object.keys(quest.objectives || {}).forEach(function (o) {
          L.push('  - ' + o + ': ' + quest.objectives[o]);
        });
      });
      L.push('');
    }

    if (Object.keys(d.knowledge || {}).length) {
      L.push('## What each character has learned');
      Object.keys(d.knowledge).forEach(function (obs) {
        L.push('### ' + obs);
        d.knowledge[obs].forEach(function (k) {
          L.push('- `' + k.factId + '` — *' + k.stage + '*' + (k.provenance ? ' (' + k.provenance + ')' : ''));
        });
      });
      L.push('');
    }

    L.push('## Transcript');
    L.push('');
    (d.transcript || []).forEach(function (t) {
      if (t.kind === 'narration') L.push('> ' + t.text.replace(/\n/g, '\n> '));
      else if (t.kind === 'player') L.push('**' + t.speaker + ' (player):** ' + t.text);
      else if (t.kind === 'system') L.push('*' + t.text + '*');
      else L.push('**' + t.speaker + ':** ' + t.text);
      L.push('');
    });

    L.push('## Mechanical log');
    L.push('');
    (d.combatLog || []).forEach(function (b) {
      L.push('- **' + (b.actorId || 'engine') + '** — ' + b.beats.join(' '));
      if (b.refused) L.push('  - refused: ' + b.refused.detail);
    });

    return L.join('\n');
  }

  /* ------------------------------------------------------------- filenames -- */

  function suggestedFilename(session) {
    var s = session.state;
    /* Seconds, not just minutes: two exports a few seconds apart were landing
       on the same name and silently overwriting each other, which is a quiet
       way to lose a session someone wanted to keep. */
    var stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return ['aethertable', s.campaignId || 'session', 'r' + s.revision, stamp]
      .join('-').replace(/[^A-Za-z0-9._-]+/g, '-');
  }

  /* --------------------------------------------------------- local storage -- */

  function saveLocal(session, meta) {
    if (typeof localStorage === 'undefined') return { ok: false, reason: 'no localStorage' };
    var blob = serialize(session, meta);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
      return { ok: true, bytes: JSON.stringify(blob).length };
    } catch (e) {
      /* Quota is the common failure and it is recoverable: the transcript and
         the log are the bulky parts and the least essential to resuming. */
      try {
        var trimmed = JSON.parse(JSON.stringify(blob));
        trimmed.digest.transcript = trimmed.digest.transcript.slice(-40);
        trimmed.digest.combatLog = trimmed.digest.combatLog.slice(-40);
        trimmed.state.log = trimmed.state.log.slice(-40);
        trimmed.state.transcript = trimmed.state.transcript.slice(-40);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
        return { ok: true, trimmed: true };
      } catch (e2) {
        return { ok: false, reason: String((e2 && e2.message) || e2) };
      }
    }
  }

  function loadLocal(opts) {
    if (typeof localStorage === 'undefined') return null;
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try { return deserialize(JSON.parse(raw), opts); } catch (e) { return null; }
  }

  function hasLocal() {
    return typeof localStorage !== 'undefined' && !!localStorage.getItem(STORAGE_KEY);
  }

  function clearLocal() {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  }

  /* -------------------------------------------------------- server export -- */

  /**
   * Written by the server rather than downloaded, because a browser download
   * needs a user gesture and an unattended AI playtest has no user.
   */
  function exportToServer(session, meta, fetchImpl) {
    var f = fetchImpl || (typeof fetch !== 'undefined' ? fetch : null);
    if (!f) return Promise.reject(new Error('no fetch available'));
    var payload = {
      filename: (meta && meta.filename) || suggestedFilename(session),
      save: serialize(session, meta),
      markdown: toMarkdown(session, meta),
    };
    return f('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (r) { return r.json(); });
  }

  var api = {
    SAVE_FORMAT: SAVE_FORMAT,
    SAVE_VERSION: SAVE_VERSION,
    ENGINE_VERSION: ENGINE_VERSION,
    RULES_VERSION: RULES_VERSION,
    STORAGE_KEY: STORAGE_KEY,
    serialize: serialize,
    deserialize: deserialize,
    migrate: migrate,
    buildDigest: buildDigest,
    toMarkdown: toMarkdown,
    suggestedFilename: suggestedFilename,
    saveLocal: saveLocal, loadLocal: loadLocal, hasLocal: hasLocal, clearLocal: clearLocal,
    exportToServer: exportToServer,
  };

  global.DND = global.DND || {};
  global.DND.Save = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
