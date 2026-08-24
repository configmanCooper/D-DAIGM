/*
 * ui/inventory.js — DND.Inventory
 *
 * The pack: procedural item icons, equip/unequip, attunement (hard-capped at
 * three and shown as X/3 with the cap enforced visibly), carried weight against
 * capacity, and coin. Item mutations are attempted through the dispatcher so
 * the UI never writes state directly; if the build has no item resolver the
 * buttons degrade to a readable note.
 */
(function (global) {
  'use strict';

  var ATTUNE_CAP = 3;

  function itemData(id) {
    var Data = global.DND && global.DND.Data;
    return (Data && Data.ITEMS && Data.ITEMS[id]) || null;
  }

  function itemName(item) {
    var d = itemData(item.id);
    return (d && d.name) || item.name || item.id || 'unknown item';
  }

  function itemWeight(item) {
    var d = itemData(item.id);
    var w = (d && (d.weight != null ? d.weight : (d.weightLb))) || item.weight || 0;
    return w * (item.qty || item.quantity || 1);
  }

  function needsAttunement(item) {
    var d = itemData(item.id) || {};
    return !!(d.attunement || d.requiresAttunement || item.attunement);
  }

  function iconCanvas(item, size) {
    var c = document.createElement('canvas');
    c.width = size; c.height = size;
    var Icon = global.DND && global.DND.Icon;
    if (!Icon) return c;
    try {
      var d = itemData(item.id) || {};
      var gm = Icon.genomeForItem('item:' + (item.uid || item.id), {
        visual: { iconShape: (d.visual && d.visual.iconShape) || undefined, glow: (d.rarity && /rare|legendary|artifact/.test(d.rarity)) },
        rarity: d.rarity || 'common',
      });
      Icon.drawIcon(c.getContext('2d'), gm, size, {});
    } catch (e) { /* art must never break the panel */ }
    return c;
  }

  function render() {
    var App = global.DND && global.DND.App;
    if (!App) return;
    var host = document.getElementById('pane-inventory');
    if (!host) return;
    if (!App.session) { host.innerHTML = '<p class="empty-note">No session.</p>'; return; }

    var id = App.viewerId();
    var sv = App.selfView(id);
    var d = App.derivedFor(id);
    if (!sv) { host.innerHTML = '<p class="empty-note">No character in this seat.</p>'; return; }
    host.innerHTML = '';

    var inv = sv.inventory || [];
    var attuned = sv.attuned || [];
    var equipped = sv.equipped || {};
    var equippedSet = {};
    Object.keys(equipped).forEach(function (slot) {
      var v = equipped[slot];
      if (v) equippedSet[v.uid || v.id || v] = true;
    });

    // gold + encumbrance summary
    var totalWeight = 0;
    inv.forEach(function (it) { totalWeight += itemWeight(it); });
    var cap = (d && d.carryCapacity) || 0;
    var over = cap && totalWeight > cap;

    var head = document.createElement('div');
    head.innerHTML =
      '<div class="gold">' + sv.gold + ' gp</div>' +
      '<div class="encumber' + (over ? ' over' : '') + '">Carried ' + round1(totalWeight) + ' / ' + cap + ' lb' +
        (over ? ' — encumbered' : '') + '</div>';
    host.appendChild(head);

    // attunement counter, cap enforced visibly
    var atLine = document.createElement('div');
    var full = attuned.length >= ATTUNE_CAP;
    atLine.className = 'attune-count' + (full ? ' full' : '');
    atLine.textContent = 'Attuned ' + attuned.length + ' / ' + ATTUNE_CAP + (full ? ' — cap reached' : '');
    host.appendChild(atLine);

    if (!inv.length) {
      var e = document.createElement('p');
      e.className = 'empty-note';
      e.textContent = 'Nothing carried.';
      host.appendChild(e);
      return;
    }

    inv.forEach(function (item) {
      var uid = item.uid || item.id;
      var row = document.createElement('div');
      row.className = 'inv-item';
      row.appendChild(iconCanvas(item, 40));

      var meta = document.createElement('div');
      meta.style.flex = '1 1 auto';
      meta.style.minWidth = '0';
      var dat = itemData(item.id) || {};
      var isEquipped = !!equippedSet[uid];
      var isAttuned = attuned.indexOf(uid) >= 0 || attuned.indexOf(item.id) >= 0;
      var bits = [];
      if (dat.rarity) bits.push(dat.rarity);
      if (dat.type) bits.push(dat.type);
      var wt = itemWeight(item);
      if (wt) bits.push(round1(wt) + ' lb');
      if (item.qty && item.qty > 1) bits.push('×' + item.qty);

      var metaHtml = '<div class="iname">' + App.esc(itemName(item)) +
        (isEquipped ? ' <span class="equipped">equipped</span>' : '') +
        (isAttuned ? ' <span class="attuned">attuned</span>' : '') + '</div>';
      metaHtml += '<div class="imeta">' + App.esc(bits.join(' · ')) + '</div>';
      if (dat.description || dat.desc) {
        metaHtml += '<details><summary style="cursor:pointer;font-size:.75rem;color:var(--ink-faint)">details</summary>' +
          '<div class="imeta" style="margin-top:.3rem">' + App.esc(String(dat.description || dat.desc).slice(0, 600)) + '</div></details>';
      }
      meta.innerHTML = metaHtml;

      // actions row
      var acts = document.createElement('div');
      acts.style.marginTop = '.3rem';
      acts.className = 'srow';

      addBtn(acts, isEquipped ? 'Unequip' : 'Equip', function () {
        App.itemAction(id, item, isEquipped ? 'unequip' : 'equip');
      });

      if (needsAttunement(item)) {
        var canAttune = isAttuned || !full;
        var ab = addBtn(acts, isAttuned ? 'End attunement' : 'Attune', function () {
          App.itemAction(id, item, isAttuned ? 'unattune' : 'attune');
        });
        if (!canAttune) { ab.disabled = true; ab.title = 'Attunement cap of ' + ATTUNE_CAP + ' reached'; }
      }
      meta.appendChild(acts);
      row.appendChild(meta);
      host.appendChild(row);
    });
  }

  function addBtn(parent, label, fn) {
    var b = document.createElement('button');
    b.className = 'chip';
    b.textContent = label;
    b.onclick = fn;
    parent.appendChild(b);
    return b;
  }

  function round1(n) { return Math.round(n * 10) / 10; }

  var api = { render: render, ATTUNE_CAP: ATTUNE_CAP };
  global.DND = global.DND || {};
  global.DND.Inventory = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
