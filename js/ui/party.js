/*
 * ui/party.js — DND.Party
 *
 * The left column: one card per party member. Everything shown here is the
 * viewer's own side, so it comes through Game.selfView (the sanctioned
 * own-character accessor) rather than reaching into the raw actor table — HP is a
 * number and a labelled band, never a colour on its own; conditions are
 * labelled pips; concentration and death saves show only when they apply.
 */
(function (global) {
  'use strict';

  function hpBand(hp, hpMax) {
    if (!hpMax || hp <= 0) return 'down';
    var pct = hp / hpMax;
    if (pct < 0.25) return 'bloodied';
    if (pct < 0.5) return 'hurt';
    return 'ok';
  }
  var BAND_LABEL = { ok: 'steady', hurt: 'hurt', bloodied: 'bloodied', down: 'down' };

  function tokenCanvas(App, sv, size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var Tokens = global.DND && global.DND.Tokens;
    if (!Tokens) return c;
    try {
      var cls = sv.base && sv.base.classes && sv.base.classes[0];
      var gm = Tokens.genomeForToken('party:' + sv.id, {
        kind: 'portrait',
        raceId: (sv.base && (sv.base.subraceId || sv.base.raceId)) || 'human',
        classId: (cls && cls.classId) || 'fighter',
        allegiance: 'party',
      });
      Tokens.drawToken(c.getContext('2d'), gm, size, {
        allegiance: 'party',
        hp: { current: sv.hp, max: sv.hpMax },
        dead: sv.dead,
        conditions: sv.conditions,
      });
    } catch (e) { /* art must never break the panel */ }
    return c;
  }

  /* A quiet, persistent reminder of the campaign's death policy, so a player
     in an ironman game is never surprised by it. The badge is coloured by
     severity and carries the policy blurb as its tooltip. */
  function renderDeathBadge(App) {
    var badge = document.getElementById('death-policy-badge');
    if (!badge) return;
    var p = App.deathPolicy && App.deathPolicy();
    if (!p) { badge.hidden = true; return; }
    badge.hidden = false;
    badge.textContent = p.name;
    badge.title = 'When someone dies: ' + p.blurb;
    badge.setAttribute('data-policy', p.id);
  }

  function render() {
    var App = global.DND && global.DND.App;
    if (!App) return;
    var host = document.getElementById('party-list');
    if (!host) return;
    host.innerHTML = '';
    var session = App.session;
    if (!session) { host.innerHTML = '<p class="empty-note">No party yet.</p>'; return; }

    renderDeathBadge(App);

    var ids = App.partyIds();
    var active = session.state.activeActorId;

    ids.forEach(function (id) {
      var sv = App.selfView(id);
      if (!sv) return;
      var card = document.createElement('div');
      card.className = 'party-card' + (id === active ? ' active' : '');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', sv.name + ', ' + sv.hp + ' of ' + sv.hpMax + ' hit points');

      card.appendChild(tokenCanvas(App, sv, 52));

      var body = document.createElement('div');
      body.className = 'pc-body';

      var band = hpBand(sv.hp, sv.hpMax);
      var pct = sv.hpMax ? Math.max(0, Math.min(100, Math.round(sv.hp / sv.hpMax * 100))) : 0;
      var ctl = App.controllerLabel(id);

      var html = '';
      html += '<div class="pc-name">' + App.esc(sv.name) + '</div>';
      html += '<div class="pc-sub">' + App.esc(App.roleLine(sv)) + '</div>';
      html += '<div class="pc-control ' + (ctl.ai ? 'ai' : 'human') + '">' + App.esc(ctl.text) + '</div>';
      html += '<div class="hpbar"><div class="track"><div class="fill" data-band="' + band + '" style="width:' + pct + '%"></div></div>';
      html += '<div class="label"><b>' + sv.hp + '</b> / ' + sv.hpMax + ' HP · <span class="band">' + BAND_LABEL[band] + '</span></div></div>';
      if (sv.tempHp) html += '<div class="temphp">' + sv.tempHp + ' temporary HP</div>';

      body.innerHTML = html;

      // conditions + concentration, as labelled pips (not colour alone)
      var pips = document.createElement('div');
      pips.className = 'pips';
      sv.conditions.forEach(function (cond) {
        var p = document.createElement('span');
        p.className = 'pip condition';
        p.textContent = cond;
        pips.appendChild(p);
      });
      if (sv.concentratingOn) {
        var cp = document.createElement('span');
        cp.className = 'pip concentration';
        cp.textContent = 'concentrating';
        cp.title = 'Concentrating on ' + (sv.concentratingOn.label || sv.concentratingOn.spellId || sv.concentratingOn);
        pips.appendChild(cp);
      }
      if (sv.exhaustion) {
        var ep = document.createElement('span');
        ep.className = 'pip condition';
        ep.textContent = 'exhaustion ' + sv.exhaustion;
        pips.appendChild(ep);
      }
      if (pips.children.length) body.appendChild(pips);

      // level-up affordance — unobtrusive, only when a level is actually owed
      if (App.canLevelUp(id)) {
        var lu = document.createElement('button');
        lu.className = 'chip levelup-chip';
        lu.type = 'button';
        lu.textContent = '▲ Level up';
        lu.title = 'A level is ready — choose how ' + sv.name + ' grows';
        lu.onclick = function (e) { e.stopPropagation(); App.levelUp(id); };
        body.appendChild(lu);
      }

      // death saves, only while dying
      if (sv.hp <= 0 && !sv.dead) {
        var ds = document.createElement('div');
        ds.className = 'deathsaves';
        var s = sv.deathSaves || { successes: 0, failures: 0 };
        ds.innerHTML = 'Death saves: <span class="s">' + s.successes + ' ✓</span> · <span class="f">' + s.failures + ' ✗</span>' +
          (sv.stable ? ' · stable' : '');
        body.appendChild(ds);
      }
      if (sv.dead) {
        var d = document.createElement('div');
        d.className = 'deathsaves';
        d.innerHTML = '<span class="f">✗ dead</span>';
        body.appendChild(d);
      }

      card.appendChild(body);
      card.onclick = function () { App.setViewer(id); };
      card.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); App.setViewer(id); } };
      host.appendChild(card);
    });
  }

  var api = { render: render };
  global.DND = global.DND || {};
  global.DND.Party = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
