/*
 * ui/journal.js — DND.Journal
 *
 * Quests, people met, places seen, and what the party actually knows. Every
 * line here is drawn from Knowledge.getObservation for the *viewing* seat and
 * nothing else — the journal must never show a fact, a name or a place the
 * party has not earned, because that is a spoiler leak, and it is exactly the
 * kind of leak the knowledge model exists to prevent.
 */
(function (global) {
  'use strict';

  function render() {
    var App = global.DND && global.DND.App;
    if (!App) return;
    var host = document.getElementById('pane-journal');
    if (!host) return;
    if (!App.session) { host.innerHTML = '<p class="empty-note">No session.</p>'; return; }

    var viewer = App.viewerId();
    var obs = App.observationFor(viewer);   // the single sanctioned door
    if (!obs) { host.innerHTML = '<p class="empty-note">Nothing recorded yet.</p>'; return; }

    var html = '<div class="journal">';
    html += '<p class="empty-note">Only what ' + App.esc(App.viewerName()) + ' has learned appears here.</p>';

    // quests
    var quests = obs.quests || {};
    var qids = Object.keys(quests);
    html += '<h3>Quests</h3>';
    if (!qids.length) html += '<p class="empty-note">No quests recorded.</p>';
    qids.forEach(function (qid) {
      var q = quests[qid];
      var status = (q.status || 'open');
      html += '<div class="quest"><div class="qname">' + App.esc(q.title || qid) +
        ' <span class="status ' + statusClass(status) + '">' + App.esc(status) + '</span></div>';
      /* Objectives are a map of id -> status (see the `quest` applier in
         events.js), not an array. Treating them as an array threw inside the
         render and left the whole journal blank — an exception in a panel
         should never be able to empty the panel. */
      objectiveList(q.objectives).forEach(function (o) {
        html += '<div class="objective' + (o.done ? ' done' : '') + '">\u2022 ' +
          App.esc(o.text) + '</div>';
      });
      html += '</div>';
    });

    // people & creatures currently perceived
    var actors = obs.actors || {};
    var others = Object.keys(actors).filter(function (aid) {
      return aid !== viewer && actors[aid].side !== 'party';
    });
    html += '<h3>Present</h3>';
    if (!others.length) html += '<p class="empty-note">No-one else in view.</p>';
    others.forEach(function (aid) {
      var a = actors[aid];
      var health = a.health ? (' — ' + a.health) : (a.dead ? ' — dead' : '');
      var conds = (a.conditions && a.conditions.length) ? (' [' + a.conditions.join(', ') + ']') : '';
      html += '<div class="jrow"><b>' + App.esc(a.name || aid) + '</b> <span class="tag">' +
        App.esc(a.side || 'neutral') + '</span>' + App.esc(health + conds) + '</div>';
    });

    // known facts — lore, people, places the party has earned
    var facts = obs.facts || {};
    var fids = Object.keys(facts);
    html += '<h3>What you know</h3>';
    if (!fids.length) html += '<p class="empty-note">Nothing uncovered yet.</p>';
    fids.forEach(function (fid) {
      var f = facts[fid];
      html += '<div class="jrow">' + App.esc(f.text) +
        (f.stage && f.stage !== 'full' ? ' <span class="tag">' + App.esc(f.stage) + '</span>' : '') +
        (f.provenance ? ' <span class="tag">' + App.esc(f.provenance) + '</span>' : '') + '</div>';
    });

    // where we are
    html += '<h3>Location</h3>';
    html += '<div class="jrow">' + App.esc(obs.locationId || 'somewhere as yet unnamed') + '</div>';

    html += '</div>';
    host.innerHTML = html;
  }

  /**
   * Normalise a quest's objectives into something renderable.
   *
   * The engine stores them as `{ objectiveId: 'open' | 'done' }` (see the
   * `quest` applier in events.js), but hand-written campaign data sometimes
   * uses an array of strings or objects. Accept all three rather than leaving
   * the shape as a trap.
   */
  function objectiveList(objectives) {
    if (!objectives) return [];
    if (Array.isArray(objectives)) {
      return objectives.map(function (o) {
        if (typeof o === 'string') return { text: o, done: false };
        return {
          text: o.text || o.label || o.id || '',
          done: !!(o.done || o.complete || o.status === 'done'),
        };
      });
    }
    return Object.keys(objectives).map(function (id) {
      var v = objectives[id];
      var status = typeof v === 'string' ? v : (v && v.status) || '';
      return {
        text: (v && v.text) || humanise(id),
        done: status === 'done' || status === 'complete' || v === true,
      };
    });
  }

  function humanise(id) {
    return String(id).replace(/[-_]+/g, ' ').replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function statusClass(status) {
    if (status === 'done' || status === 'complete') return 'done';
    if (status === 'failed') return 'failed';
    return 'open';
  }

  var api = { render: render };
  global.DND = global.DND || {};
  global.DND.Journal = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
