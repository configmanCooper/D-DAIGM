/**
 * srd_spells.js
 * ---------------------------------------------------------------------------
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 * SRD 5.1 spell reference data — 2014 spell text, spell lists, and
 * school/level assignments throughout.
 *
 * `SPELLS[id].mech` vocabulary:
 *   concentration: boolean
 *   ritual: boolean
 *   castTime: 'action'|'bonus'|'reaction'|'minute'|'hour'
 *   reactionTrigger: string (reaction spells only)
 *   components: { v:boolean, s:boolean, m:string|null, consumed:boolean, costGp:number }
 *   targets: { count:number, type:'creature'|'object'|'point'|'self'|'area' }
 *   effects: [
 *     { kind:'attack', attack:'melee_spell'|'ranged_spell', damage:[{ dice:'4d6', type:'fire' }] },
 *     { kind:'save', ability:'dex'|'str'|'con'|'int'|'wis'|'cha', saveEffect:'half'|'negates'|'partial', saveRepeat:'none'|'end_of_turn'|'start_of_turn', damage:[{ dice:'8d6', type:'fire' }], condition:'paralyzed' },
 *     { kind:'heal', dice:'1d8'|null, flat:number, mod:'spell'|null },
 *     { kind:'temp_hp', dice:'2d4'|null, flat:number },
 *     { kind:'area', shape:'sphere'|'cone'|'line'|'cube'|'cylinder', size:number, origin:'point'|'self', persistent?:boolean, movable?:boolean, moveDistance?:number, damageOnEnter?:{ dice:'2d8', type:'radiant' }, damageOnStartTurn?:{ dice:'2d8', type:'radiant' }, difficultTerrain?:boolean },
 *     { kind:'modifier', appliesTo:'attack'|'save'|'check'|'damage'|'ac', die:'1d4', flat:number, sign:1|-1, scope:'self'|'allies'|'target' },
 *     { kind:'ac', mode:'set'|'add'|'floor', value:number, dexApplies?:boolean },
 *     { kind:'forced_movement', distance:number, direction:'away'|'toward' },
 *     { kind:'hp_pool', dice:'5d8', order:'lowest_first' },
 *     { kind:'hp_threshold', max:number },
 *     { kind:'summon', creature:string, count:number, controlled:boolean, hpMode:'half_caster'|'statblock' },
 *     { kind:'condition', condition:string, escapeDc?:number, escapeAbility?:'str'|'dex'|'con'|'int'|'wis'|'cha' },
 *     { kind:'narrative', summary:string }
 *   ]
 *   cantripScaling: { at:[5,11,17], addDice:'1d10' } | null
 *   scaling: { per:'slot', mode:'damage'|'targets'|'duration'|'summons', addDice?:string, addTargets?:number } | null
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Data = root.DND.Data || {};
  Object.assign(root.DND.Data, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SPELLS = {
  "acid-splash": {
    "id": "acid-splash",
    "name": "Acid Splash",
    "level": 0,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures make a DEX save, taking 1d6 acid damage on a failed save.",
    "visual": {
      "color": "#6ac94c",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 2,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "1d6",
              "type": "acid"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d6"
      },
      "scaling": null
    }
  },
  "chill-touch": {
    "id": "chill-touch",
    "name": "Chill Touch",
    "level": 0,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 1d8 necrotic damage.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "1d8",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d8"
      },
      "scaling": null
    }
  },
  "dancing-lights": {
    "id": "dancing-lights",
    "name": "Dancing Lights",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of phosphorus or wychwood, or a glowworm."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It also creates or manipulates light in the area.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of phosphorus or wychwood, or a glowworm.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create up to four torch-sized lights within range, making them appear as torches, lanterns, or glowing orbs that hover in the air for..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "druidcraft": {
    "id": "druidcraft",
    "name": "Druidcraft",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#9bd16f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Whispering to the spirits of nature, you create one of the following effects within 'range':"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "eldritch-blast": {
    "id": "eldritch-blast",
    "name": "Eldritch Blast",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "warlock"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 1d10 force damage.",
    "visual": {
      "color": "#9f8cff",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "1d10",
              "type": "force"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d10",
        "addTargets": 1
      },
      "scaling": null
    }
  },
  "fire-bolt": {
    "id": "fire-bolt",
    "name": "Fire Bolt",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 1d10 fire damage.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "1d10",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d10"
      },
      "scaling": null
    }
  },
  "guidance": {
    "id": "guidance",
    "name": "Guidance",
    "level": 0,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "modifier",
          "appliesTo": "check",
          "die": "1d4",
          "flat": 0,
          "sign": 1,
          "scope": "target"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "light": {
    "id": "light",
    "name": "Light",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": false,
      "m": "A firefly or phosphorescent moss."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "wizard"
    ],
    "text": "It also creates or manipulates light in the area.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": "A firefly or phosphorescent moss.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mage-hand": {
    "id": "mage-hand",
    "name": "Mage Hand",
    "level": 0,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A spectral, floating hand appears at a point you choose within range. The hand lasts for the duration or until you dismiss it as an actio..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mending": {
    "id": "mending",
    "name": "Mending",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Two lodestones."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Two lodestones.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell repairs a single break or tear in an object you touch, such as a broken key, a torn cloak, or a leaking wineskin. As long as t..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "message": {
    "id": "message",
    "name": "Message",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A short piece of copper wire."
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#9bd16f",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A short piece of copper wire.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You point your finger toward a creature within range and whisper a message. The target (and only the target) hears the message and can re..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "minor-illusion": {
    "id": "minor-illusion",
    "name": "Minor Illusion",
    "level": 0,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": false,
      "s": true,
      "m": "A bit of fleece."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": false,
        "s": true,
        "m": "A bit of fleece.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an acti..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "poison-spray": {
    "id": "poison-spray",
    "name": "Poison Spray",
    "level": 0,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a CON save, taking 1d12 poison damage on a failed save.",
    "visual": {
      "color": "#4cae55",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "1d12",
              "type": "poison"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d12"
      },
      "scaling": null
    }
  },
  "prestidigitation": {
    "id": "prestidigitation",
    "name": "Prestidigitation",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell is a minor magical trick that novice spellcasters use for practice. You create one of the following magical effects within 'ra..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "produce-flame": {
    "id": "produce-flame",
    "name": "Produce Flame",
    "level": 0,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 1d8 fire damage.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "1d8",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d8"
      },
      "scaling": null
    }
  },
  "ray-of-frost": {
    "id": "ray-of-frost",
    "name": "Ray of Frost",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 1d8 cold damage.",
    "visual": {
      "color": "#86d8ff",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "1d8",
              "type": "cold"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d8"
      },
      "scaling": null
    }
  },
  "resistance": {
    "id": "resistance",
    "name": "Resistance",
    "level": 0,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A miniature cloak."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A miniature cloak.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "modifier",
          "appliesTo": "save",
          "die": "1d4",
          "flat": 0,
          "sign": 1,
          "scope": "target"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sacred-flame": {
    "id": "sacred-flame",
    "name": "Sacred Flame",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Creatures make a DEX save, taking 1d8 radiant damage on a failed save.",
    "visual": {
      "color": "#ffe680",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "1d8",
              "type": "radiant"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d8"
      },
      "scaling": null
    }
  },
  "shillelagh": {
    "id": "shillelagh",
    "name": "Shillelagh",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 bonus action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Mistletoe, a shamrock leaf, and a club or quarterstaff."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": "Mistletoe, a shamrock leaf, and a club or quarterstaff.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "The wood of a club or a quarterstaff you are holding is imbued with nature's power. For the duration, you can use your spellcasting abili..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "shocking-grasp": {
    "id": "shocking-grasp",
    "name": "Shocking Grasp",
    "level": 0,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 1d8 lightning damage.",
    "visual": {
      "color": "#f6e85a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "1d8",
              "type": "lightning"
            }
          ]
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d8"
      },
      "scaling": null
    }
  },
  "spare-the-dying": {
    "id": "spare-the-dying",
    "name": "Spare the Dying",
    "level": 0,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a living creature that has 0 hit points. The creature becomes stable. This spell has no effect on undead or constructs."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "thaumaturgy": {
    "id": "thaumaturgy",
    "name": "Thaumaturgy",
    "level": 0,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You manifest a minor wonder, a sign of supernatural power, within range. You create one of the following magical effects within range."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "true-strike": {
    "id": "true-strike",
    "name": "True Strike",
    "level": 0,
    "school": "divination",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": false,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 round",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#d6d16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": false,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You extend your hand and point a finger at a target in range. Your magic grants you a brief insight into the target's defenses. On your n..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "vicious-mockery": {
    "id": "vicious-mockery",
    "name": "Vicious Mockery",
    "level": 0,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard"
    ],
    "text": "Creatures make a WIS save, taking 1d4 psychic damage on a failed save.",
    "visual": {
      "color": "#d46cff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "1d4",
              "type": "psychic"
            }
          ]
        },
        {
          "kind": "narrative",
          "summary": "You unleash a string of insults laced with subtle enchantments at a creature you can see within range. If the target can hear you (though..."
        }
      ],
      "cantripScaling": {
        "at": [
          5,
          11,
          17
        ],
        "addDice": "1d4"
      },
      "scaling": null
    }
  },
  "alarm": {
    "id": "alarm",
    "name": "Alarm",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny bell and a piece of fine silver wire."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "ranger",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny bell and a piece of fine silver wire.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "animal-friendship": {
    "id": "animal-friendship",
    "name": "Animal Friendship",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A morsel of food."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A morsel of food.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "bane": {
    "id": "bane",
    "name": "Bane",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of blood."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of blood.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 3,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none"
        },
        {
          "kind": "modifier",
          "appliesTo": "attack",
          "die": "1d4",
          "flat": 0,
          "sign": -1,
          "scope": "target"
        },
        {
          "kind": "modifier",
          "appliesTo": "save",
          "die": "1d4",
          "flat": 0,
          "sign": -1,
          "scope": "target"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "bless": {
    "id": "bless",
    "name": "Bless",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A sprinkling of holy water."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A sprinkling of holy water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 3,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "modifier",
          "appliesTo": "attack",
          "die": "1d4",
          "flat": 0,
          "sign": 1,
          "scope": "allies"
        },
        {
          "kind": "modifier",
          "appliesTo": "save",
          "die": "1d4",
          "flat": 0,
          "sign": 1,
          "scope": "allies"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "burning-hands": {
    "id": "burning-hands",
    "name": "Burning Hands",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 15-foot cone make a DEX save, taking 3d6 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 15,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "3d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "charm-person": {
    "id": "charm-person",
    "name": "Charm Person",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "color-spray": {
    "id": "color-spray",
    "name": "Color Spray",
    "level": 1,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of powder or sand that is colored red, yellow, and blue."
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures affected by the spell can be dropped into magical sleep.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of powder or sand that is colored red, yellow, and blue.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 15,
          "origin": "self"
        },
        {
          "kind": "hp_pool",
          "dice": "6d10",
          "order": "lowest_first"
        },
        {
          "kind": "condition",
          "condition": "blinded"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "2d10"
      }
    }
  },
  "command": {
    "id": "command",
    "name": "Command",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "A target in range makes a WIS save or becomes prone.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "prone"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "comprehend-languages": {
    "id": "comprehend-languages",
    "name": "Comprehend Languages",
    "level": 1,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of soot and salt."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of soot and salt.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "For the duration, you understand the literal meaning of any spoken language that you hear. You also understand any written language that..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "create-or-destroy-water": {
    "id": "create-or-destroy-water",
    "name": "Create or Destroy Water",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of water if creating water, or a few grains of sand if destroying it."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of water if creating water, or a few grains of sand if destroying it.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 30,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "cure-wounds": {
    "id": "cure-wounds",
    "name": "Cure Wounds",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger"
    ],
    "text": "You restore hit points to a creature you touch.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": "1d8",
          "flat": 0,
          "mod": "spell"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "detect-evil-and-good": {
    "id": "detect-evil-and-good",
    "name": "Detect Evil and Good",
    "level": 1,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "detect-magic": {
    "id": "detect-magic",
    "name": "Detect Magic",
    "level": 1,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": true,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "detect-poison-and-disease": {
    "id": "detect-poison-and-disease",
    "name": "Detect Poison and Disease",
    "level": 1,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A yew leaf."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": true,
    "classes": [
      "cleric",
      "druid",
      "paladin",
      "ranger"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A yew leaf.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "disguise-self": {
    "id": "disguise-self",
    "name": "Disguise Self",
    "level": 1,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "This illusion deceives senses or creates misleading sensory phenomena.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You make yourself--including your clothing, armor, weapons, and other belongings on your person--look different until the spell ends or u..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "divine-favor": {
    "id": "divine-favor",
    "name": "Divine Favor",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "paladin"
    ],
    "text": "The spell deals 1d4 radiant damage when its effect lands. Affected allies gain an extra d4 on the relevant rolls while it lasts.",
    "visual": {
      "color": "#ffe680",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Your prayer empowers you with divine radiance. Until the spell ends, your weapon attacks deal an extra 1d4 radiant damage on a hit."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "entangle": {
    "id": "entangle",
    "name": "Entangle",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "A target in range makes a STR save or becomes restrained. The area becomes difficult terrain and can pin creatures in place. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        },
        {
          "kind": "save",
          "ability": "str",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "restrained"
        },
        {
          "kind": "condition",
          "condition": "restrained",
          "escapeAbility": "str"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "expeditious-retreat": {
    "id": "expeditious-retreat",
    "name": "Expeditious Retreat",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 bonus action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell allows you to move at an incredible pace. When you cast this spell, and then as a bonus action on each of your turns until the..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "faerie-fire": {
    "id": "faerie-fire",
    "name": "Faerie Fire",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "A target in range makes a DEX save or becomes invisible. It conceals the target from normal sight for the duration. It also creates or manipulates light in the area.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "invisible"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "false-life": {
    "id": "false-life",
    "name": "False Life",
    "level": 1,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A small amount of alcohol or distilled spirits."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "You restore hit points to one or more creatures in range.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small amount of alcohol or distilled spirits.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "temp_hp",
          "dice": "1d4",
          "flat": 4
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addFlat": 5
      }
    }
  },
  "feather-fall": {
    "id": "feather-fall",
    "name": "Feather Fall",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 reaction",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": "A small feather or a piece of down."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "reaction",
      "components": {
        "v": true,
        "s": false,
        "m": "A small feather or a piece of down.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 5,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose up to five falling creatures within range. A falling creature's rate of descent slows to 60 feet per round until the spell ends. I..."
        }
      ],
      "cantripScaling": null,
      "scaling": null,
      "reactionTrigger": "when a creature within 60 feet falls"
    }
  },
  "find-familiar": {
    "id": "find-familiar",
    "name": "Find Familiar",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 hour",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "10gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "10gp worth of charcoal, incense, and herbs that must be consumed by fire in a brass brazier.",
        "consumed": true,
        "costGp": 10
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "familiar spirit",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "floating-disk": {
    "id": "floating-disk",
    "name": "Floating Disk",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of mercury."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of mercury.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell creates a circular, horizontal plane of force, 3 feet in diameter and 1 inch thick, that floats 3 feet above the ground in an..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "fog-cloud": {
    "id": "fog-cloud",
    "name": "Fog Cloud",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#47c8b3",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "goodberry": {
    "id": "goodberry",
    "name": "Goodberry",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A sprig of mistletoe."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A sprig of mistletoe.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Up to ten berries appear in your hand and are infused with magic for the duration. A creature can use its action to eat one berry. Eating..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "grease": {
    "id": "grease",
    "name": "Grease",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of pork rind or butter."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "A target in range makes a DEX save or becomes prone.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of pork rind or butter.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 10,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "prone"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "guiding-bolt": {
    "id": "guiding-bolt",
    "name": "Guiding Bolt",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 4d6 radiant damage.",
    "visual": {
      "color": "#ffe680",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "4d6",
              "type": "radiant"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "healing-word": {
    "id": "healing-word",
    "name": "Healing Word",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid"
    ],
    "text": "You restore hit points to one or more creatures in range.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": "1d4",
          "flat": 0,
          "mod": "spell"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d4"
      }
    }
  },
  "hellish-rebuke": {
    "id": "hellish-rebuke",
    "name": "Hellish Rebuke",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 reaction",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "warlock"
    ],
    "text": "Creatures make a DEX save, taking 2d10 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "reaction",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d10",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d10"
      },
      "reactionTrigger": "when you are damaged by a creature within 60 feet"
    }
  },
  "heroism": {
    "id": "heroism",
    "name": "Heroism",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "paladin"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A willing creature you touch is imbued with bravery. Until the spell ends, the creature is immune to being frightened and gains temporary..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hideous-laughter": {
    "id": "hideous-laughter",
    "name": "Hideous Laughter",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Tiny tarts and a feather that is waved in the air."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Tiny tarts and a feather that is waved in the air.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "incapacitated",
          "conditionOptions": [
            "incapacitated",
            "prone"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hunters-mark": {
    "id": "hunters-mark",
    "name": "Hunter's Mark",
    "level": 1,
    "school": "divination",
    "castingTime": "1 bonus action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "ranger"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#d6d16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You choose a creature you can see within range and mystically mark it as your quarry. Until the spell ends, you deal an extra 1d6 damage..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "identify": {
    "id": "identify",
    "name": "Identify",
    "level": 1,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A pearl worth at least 100gp and an owl feather."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A pearl worth at least 100gp and an owl feather.",
        "consumed": false,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You choose one object that you must touch throughout the casting of the spell. If it is a magic item or some other magic-imbued object, y..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "illusory-script": {
    "id": "illusory-script",
    "name": "Illusory Script",
    "level": 1,
    "school": "illusion",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": false,
      "s": true,
      "m": "A lead-based ink worth at least 10gp, which this spell consumes."
    },
    "duration": "10 days",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": false,
        "s": true,
        "m": "A lead-based ink worth at least 10gp, which this spell consumes.",
        "consumed": true,
        "costGp": 10
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You write on parchment, paper, or some other suitable writing material and imbue it with a potent illusion that lasts for the duration."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "inflict-wounds": {
    "id": "inflict-wounds",
    "name": "Inflict Wounds",
    "level": 1,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 3d10 necrotic damage.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "3d10",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d10"
      }
    }
  },
  "jump": {
    "id": "jump",
    "name": "Jump",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A grasshopper's hind leg."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A grasshopper's hind leg.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature. The creature's jump distance is tripled until the spell ends."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "longstrider": {
    "id": "longstrider",
    "name": "Longstrider",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of dirt."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "ranger",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of dirt.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature. The target's speed increases by 10 feet until the spell ends."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "mage-armor": {
    "id": "mage-armor",
    "name": "Mage Armor",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A piece of cured leather."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A piece of cured leather.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "ac",
          "mode": "set",
          "value": 13,
          "dexApplies": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "magic-missile": {
    "id": "magic-missile",
    "name": "Magic Missile",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 1d4+1 force damage when its effect lands.",
    "visual": {
      "color": "#9f8cff",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 3,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "auto",
          "darts": 3,
          "perDart": { "dice": "1d4", "flat": 1, "type": "force" },
          "summary": "Three darts of force, each dealing 1d4 + 1 damage. They always hit."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "protection-from-evil-and-good": {
    "id": "protection-from-evil-and-good",
    "name": "Protection from Evil and Good",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Holy water or powdered silver and iron, which the spell consumes."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin",
      "warlock",
      "wizard"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. It creates a protective magical boundary or ward. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Holy water or powdered silver and iron, which the spell consumes.",
        "consumed": true,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Until the spell ends, one willing creature you touch is protected against certain types of creatures: aberrations, celestials, elementals..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "purify-food-and-drink": {
    "id": "purify-food-and-drink",
    "name": "Purify Food and Drink",
    "level": 1,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric",
      "druid",
      "paladin"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "All nonmagical food and drink within a 5-foot radius sphere centered on a point of your choice within range is purified and rendered free..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sanctuary": {
    "id": "sanctuary",
    "name": "Sanctuary",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 bonus action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small silver mirror."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": "A small silver mirror.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You ward a creature within range against attack. Until the spell ends, any creature who targets the warded creature with an attack or a h..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "shield": {
    "id": "shield",
    "name": "Shield",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 reaction",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "reaction",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "ac",
          "mode": "add",
          "value": 5
        }
      ],
      "cantripScaling": null,
      "scaling": null,
      "reactionTrigger": "when you are hit by an attack or targeted by magic missile"
    }
  },
  "shield-of-faith": {
    "id": "shield-of-faith",
    "name": "Shield of Faith",
    "level": 1,
    "school": "abjuration",
    "castingTime": "1 bonus action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small parchment with a bit of holy text written on it."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": "A small parchment with a bit of holy text written on it.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A shimmering field appears and surrounds a creature of your choice within range, granting it a +2 bonus to AC for the duration."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "silent-image": {
    "id": "silent-image",
    "name": "Silent Image",
    "level": 1,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fleece."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fleece.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 15,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sleep": {
    "id": "sleep",
    "name": "Sleep",
    "level": 1,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of fine sand, rose petals, or a cricket."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of fine sand, rose petals, or a cricket.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point"
        },
        {
          "kind": "hp_pool",
          "dice": "5d8",
          "order": "lowest_first"
        },
        {
          "kind": "condition",
          "condition": "unconscious"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "2d8"
      }
    }
  },
  "speak-with-animals": {
    "id": "speak-with-animals",
    "name": "Speak with Animals",
    "level": 1,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You gain the ability to comprehend and verbally communicate with beasts for the duration. The knowledge and awareness of many beasts is l..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "thunderwave": {
    "id": "thunderwave",
    "name": "Thunderwave",
    "level": 1,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 15-foot cube make a CON save, taking 2d8 thunder damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5ad2ff",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 15,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d8",
              "type": "thunder"
            }
          ]
        },
        {
          "kind": "forced_movement",
          "distance": 10,
          "direction": "away"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "unseen-servant": {
    "id": "unseen-servant",
    "name": "Unseen Servant",
    "level": 1,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A piece of string and a bit of wood."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "warlock",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A piece of string and a bit of wood.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "unseen servant",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "acid-arrow": {
    "id": "acid-arrow",
    "name": "Acid Arrow",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Powdered rhubarb leaf and an adder's stomach."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Make a ranged spell attack; on a hit, the target takes 4d4 acid plus 2d4 acid damage.",
    "visual": {
      "color": "#6ac94c",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Powdered rhubarb leaf and an adder's stomach.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": [
            {
              "dice": "4d4",
              "type": "acid"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d4"
      }
    }
  },
  "aid": {
    "id": "aid",
    "name": "Aid",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny strip of white cloth."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny strip of white cloth.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 3,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Up to three creatures gain 5 current and maximum hit points for 8 hours."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addFlat": 5
      }
    }
  },
  "alter-self": {
    "id": "alter-self",
    "name": "Alter Self",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 1d6 bludgeoning damage when its effect lands.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You assume a different form. When you cast the spell, choose one of the following options, the effects of which last for the duration of..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "animal-messenger": {
    "id": "animal-messenger",
    "name": "Animal Messenger",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A morsel of food."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A morsel of food.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "By means of this spell, you use an animal to deliver a message. Choose a Tiny beast you can see within range, such as a squirrel, a blue..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "arcane-lock": {
    "id": "arcane-lock",
    "name": "Arcane Lock",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Gold dust worth at least 25gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Gold dust worth at least 25gp, which the spell consumes.",
        "consumed": true,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a closed door, window, gate, chest, or other entryway, and it becomes locked for the duration. You and the creatures you design..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "arcanists-magic-aura": {
    "id": "arcanists-magic-aura",
    "name": "Arcanist's Magic Aura",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A small square of silk."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small square of silk.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You place an illusion on a creature or an object you touch so that divination spells reveal false information about it. The target can be..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "augury": {
    "id": "augury",
    "name": "Augury",
    "level": 2,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Specially marked sticks, bones, or similar tokens worth at least 25gp."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Specially marked sticks, bones, or similar tokens worth at least 25gp.",
        "consumed": false,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "By casting gem-inlaid sticks, rolling dragon bones, laying out ornate cards, or employing some other divining tool, you receive an omen f..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "barkskin": {
    "id": "barkskin",
    "name": "Barkskin",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A handful of oak bark."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A handful of oak bark.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "ac",
          "mode": "floor",
          "value": 16
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "blindness-deafness": {
    "id": "blindness-deafness",
    "name": "Blindness/Deafness",
    "level": 2,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "wizard"
    ],
    "text": "The spell robs the target of sight for the duration or until ended.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "blinded",
          "conditionOptions": [
            "blinded",
            "deafened"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "blur": {
    "id": "blur",
    "name": "Blur",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Your body becomes blurred, shifting and wavering to all who can see you. For the duration, any creature has disadvantage on attack rolls..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "branding-smite": {
    "id": "branding-smite",
    "name": "Branding Smite",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "paladin"
    ],
    "text": "The spell deals 2d6 radiant damage when its effect lands. It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#ffe680",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "The next time you hit a creature with a weapon attack before this spell ends, the weapon gleams with astral radiance as you strike. The a..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "calm-emotions": {
    "id": "calm-emotions",
    "name": "Calm Emotions",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "frightened"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "continual-flame": {
    "id": "continual-flame",
    "name": "Continual Flame",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Ruby dust worth 50 gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Ruby dust worth 50 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 50
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A flame, equivalent in brightness to a torch, springs forth from an object that you touch. The effect looks like a regular flame, but it..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "darkness": {
    "id": "darkness",
    "name": "Darkness",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": "Bat fur and a drop of pitch or piece of coal."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": "Bat fur and a drop of pitch or piece of coal.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 15,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "darkvision": {
    "id": "darkvision",
    "name": "Darkvision",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Either a pinch of dried carrot or an agate."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Either a pinch of dried carrot or an agate.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a willing creature to grant it the ability to see in the dark. For the duration, that creature has darkvision out to a range of..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "detect-thoughts": {
    "id": "detect-thoughts",
    "name": "Detect Thoughts",
    "level": 2,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A copper coin."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A copper coin.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "For the duration, you can read the thoughts of certain creatures. When you cast the spell and as your action on each turn until the spell..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "enhance-ability": {
    "id": "enhance-ability",
    "name": "Enhance Ability",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Fur or a feather from a beast."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "sorcerer"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Fur or a feather from a beast.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature and bestow upon it a magical enhancement. Choose one of the following effects; the target gains that effect until th..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "enlarge-reduce": {
    "id": "enlarge-reduce",
    "name": "Enlarge/Reduce",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch iron powder."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch iron powder.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "enthrall": {
    "id": "enthrall",
    "name": "Enthrall",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "warlock"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "incapacitated"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "find-steed": {
    "id": "find-steed",
    "name": "Find Steed",
    "level": 2,
    "school": "conjuration",
    "castingTime": "10 minutes",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "paladin"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You summon a spirit that assumes the form of an unusually intelligent, strong, and loyal steed, creating a long-lasting bond with it. App..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "find-traps": {
    "id": "find-traps",
    "name": "Find Traps",
    "level": 2,
    "school": "divination",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "ranger"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You sense the presence of any trap within range that is within line of sight. A trap, for the purpose of this spell, includes anything th..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "flame-blade": {
    "id": "flame-blade",
    "name": "Flame Blade",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Leaf of sumac."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "The spell deals 3d6 fire damage when its effect lands.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": "Leaf of sumac.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You evoke a fiery blade in your free hand. The blade is similar in size and shape to a scimitar, and it lasts for the duration. If you le..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6",
        "every": 2
      }
    }
  },
  "flaming-sphere": {
    "id": "flaming-sphere",
    "name": "Flaming Sphere",
    "level": 2,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of tallow, a pinch of brimstone, and a dusting of powdered iron."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "wizard"
    ],
    "text": "The spell deals 2d6 fire damage when its effect lands.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of tallow, a pinch of brimstone, and a dusting of powdered iron.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Bonus action each turn to move the sphere and ram a creature."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "gentle-repose": {
    "id": "gentle-repose",
    "name": "Gentle Repose",
    "level": 2,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of salt and one copper piece placed on each of the corpse's eyes, which must remain there for the duration."
    },
    "duration": "10 days",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of salt and one copper piece placed on each of the corpse's eyes, which must remain there for the duration.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a corpse or other remains. For the duration, the target is protected from decay and can't become undead."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "gust-of-wind": {
    "id": "gust-of-wind",
    "name": "Gust of Wind",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A legume seed."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A legume seed.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 60,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "str",
          "saveEffect": "negates",
          "saveRepeat": "none"
        },
        {
          "kind": "forced_movement",
          "distance": 15,
          "direction": "away"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "heat-metal": {
    "id": "heat-metal",
    "name": "Heat Metal",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A piece of iron and a flame."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "druid"
    ],
    "text": "Creatures make a CON save, taking 2d8 fire damage on a failed save.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A piece of iron and a flame.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d8",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "hold-person": {
    "id": "hold-person",
    "name": "Hold Person",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small, straight piece of iron."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes paralyzed. Failed targets are left unable to move or act effectively.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small, straight piece of iron.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "paralyzed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "invisibility": {
    "id": "invisibility",
    "name": "Invisibility",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "An eyelash encased in gum arabic."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An eyelash encased in gum arabic.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it is on..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "knock": {
    "id": "knock",
    "name": "Knock",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose an object that you can see within range. The object can be a door, a box, a chest, a set of manacles, a padlock, or another object..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "lesser-restoration": {
    "id": "lesser-restoration",
    "name": "Lesser Restoration",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger"
    ],
    "text": "Failed targets are left unable to move or act effectively.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature and can end either one disease or one condition afflicting it. The condition can be blinded, deafened, paralyzed, or..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "levitate": {
    "id": "levitate",
    "name": "Levitate",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Either a small leather loop or a piece of golden wire bent into a cup shape with a long shank on one end."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Either a small leather loop or a piece of golden wire bent into a cup shape with a long shank on one end.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "One creature or object of your choice that you can see within range rises vertically, up to 20 feet, and remains suspended there for the..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "locate-animals-or-plants": {
    "id": "locate-animals-or-plants",
    "name": "Locate Animals or Plants",
    "level": 2,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fur from a bloodhound."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fur from a bloodhound.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Describe or name a specific kind of beast or plant. Concentrating on the voice of nature in your surroundings, you learn the direction an..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "locate-object": {
    "id": "locate-object",
    "name": "Locate Object",
    "level": 2,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A forked twig."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A forked twig.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Describe or name an object that is familiar to you. You sense the direction to the object's location, as long as that object is within 1,..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "magic-mouth": {
    "id": "magic-mouth",
    "name": "Magic Mouth",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A honeycomb and jade dust of at least 10 inches, the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "This illusion deceives senses or creates misleading sensory phenomena.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A honeycomb and jade dust of at least 10 inches, the spell consumes.",
        "consumed": true,
        "costGp": 10
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You plant a message to an object in the range of the spell. The message is verbalized when the trigger conditions are met. Choose an obje..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "magic-weapon": {
    "id": "magic-weapon",
    "name": "Magic Weapon",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 bonus action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "paladin",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a nonmagical weapon. Until the spell ends, that weapon becomes a magic weapon with a +1 bonus to attack rolls and damage rolls."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mirror-image": {
    "id": "mirror-image",
    "name": "Mirror Image",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This illusion deceives senses or creates misleading sensory phenomena.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Three illusory duplicates of yourself appear in your space. Until the spell ends, the duplicates move with you and mimic your actions, sh..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "misty-step": {
    "id": "misty-step",
    "name": "Misty Step",
    "level": 2,
    "school": "conjuration",
    "castingTime": "1 bonus action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "moonbeam": {
    "id": "moonbeam",
    "name": "Moonbeam",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Several seeds of any moonseed plant and a piece of opalescent feldspar."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "Creatures in a 5-foot cylinder make a CON save, taking 2d10 radiant damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ffe680",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Several seeds of any moonseed plant and a piece of opalescent feldspar.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 5,
          "origin": "point",
          "persistent": true,
          "damageOnEnter": {
            "dice": "2d10",
            "type": "radiant"
          },
          "damageOnStartTurn": {
            "dice": "2d10",
            "type": "radiant"
          },
          "movable": true,
          "moveDistance": 60
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d10",
              "type": "radiant"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d10"
      }
    }
  },
  "pass-without-trace": {
    "id": "pass-without-trace",
    "name": "Pass Without Trace",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Ashes from a burned leaf of mistletoe and a sprig of spruce."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Ashes from a burned leaf of mistletoe and a sprig of spruce.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A veil of shadows and silence radiates from you, masking you and your companions from detection. For the duration, each creature you choo..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "prayer-of-healing": {
    "id": "prayer-of-healing",
    "name": "Prayer of Healing",
    "level": 2,
    "school": "evocation",
    "castingTime": "10 minutes",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "You distribute healing among multiple creatures you can see in range.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 6,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": "2d8",
          "flat": 0,
          "mod": "spell"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "protection-from-poison": {
    "id": "protection-from-poison",
    "name": "Protection from Poison",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "paladin",
      "ranger"
    ],
    "text": "The effect sickens the target and hampers its actions. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature. If it is poisoned, you neutralize the poison. If more than one poison afflicts the target, you neutralize one poiso..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "ray-of-enfeeblement": {
    "id": "ray-of-enfeeblement",
    "name": "Ray of Enfeeblement",
    "level": 2,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "damage": []
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "none"
        },
        {
          "kind": "narrative",
          "summary": "A black beam of enervating energy springs from your finger toward a creature within range. Make a ranged spell attack against the target...."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "rope-trick": {
    "id": "rope-trick",
    "name": "Rope Trick",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Powdered corn extract and a twisted loop of parchment."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#9bd16f",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Powdered corn extract and a twisted loop of parchment.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a length of rope that is up to 60 feet long. One end of the rope then rises into the air until the whole rope hangs perpendicul..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "scorching-ray": {
    "id": "scorching-ray",
    "name": "Scorching Ray",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 2d6 fire damage when its effect lands.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 3,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "ranged_spell",
          "count": 3,
          "damage": [
            {
              "dice": "2d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "see-invisibility": {
    "id": "see-invisibility",
    "name": "See Invisibility",
    "level": 2,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A dash of talc and a small amount of silver powder."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#d6d16f",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A dash of talc and a small amount of silver powder.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "For the duration of the spell, you see invisible creatures and objects as if they were visible, and you can see through Ethereal. The eth..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "shatter": {
    "id": "shatter",
    "name": "Shatter",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A burst of mica."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Creatures in a 10-foot sphere make a CON save, taking 3d8 thunder damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5ad2ff",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A burst of mica.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "3d8",
              "type": "thunder"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "silence": {
    "id": "silence",
    "name": "Silence",
    "level": 2,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": true,
    "classes": [
      "bard",
      "cleric",
      "ranger"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "spider-climb": {
    "id": "spider-climb",
    "name": "Spider Climb",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of bitumen and a spider."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of bitumen and a spider.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Until the spell ends, one willing creature you touch gains the ability to move up, down, and across vertical surfaces and upside down alo..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "spike-growth": {
    "id": "spike-growth",
    "name": "Spike Growth",
    "level": 2,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Seven sharp thorns or seven small twigs, each sharpened to a point."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "The spell deals 2d4 piercing damage when its effect lands.",
    "visual": {
      "color": "#a7a19a",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Seven sharp thorns or seven small twigs, each sharpened to a point.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "spiritual-weapon": {
    "id": "spiritual-weapon",
    "name": "Spiritual Weapon",
    "level": 2,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 1d8+MOD force damage.",
    "visual": {
      "color": "#9f8cff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "spectral weapon",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        },
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "1d8+MOD",
              "type": "force"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8",
        "every": 2
      }
    }
  },
  "suggestion": {
    "id": "suggestion",
    "name": "Suggestion",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": "A snake's tongue and either a bit of honeycomb or a drop of sweet oil."
    },
    "duration": "Up to 8 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": "A snake's tongue and either a bit of honeycomb or a drop of sweet oil.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "warding-bond": {
    "id": "warding-bond",
    "name": "Warding Bond",
    "level": 2,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A pair of platinum rings worth at least 50gp each, which you and the target must wear for the duration."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pair of platinum rings worth at least 50gp each, which you and the target must wear for the duration.",
        "consumed": false,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell wards a willing creature you touch and creates a mystic connection between you and the target until the spell ends. While the..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "web": {
    "id": "web",
    "name": "Web",
    "level": 2,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of spiderweb."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 2d4 fire damage when its effect lands. The area becomes difficult terrain and can pin creatures in place. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of spiderweb.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        },
        {
          "kind": "condition",
          "condition": "restrained",
          "escapeAbility": "str"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "zone-of-truth": {
    "id": "zone-of-truth",
    "name": "Zone of Truth",
    "level": 2,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "paladin"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 15,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "animate-dead": {
    "id": "animate-dead",
    "name": "Animate Dead",
    "level": 3,
    "school": "necromancy",
    "castingTime": "1 minute",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of blood, a piece of flesh, and a pinch of bone dust."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of blood, a piece of flesh, and a pinch of bone dust.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 4,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "undead servant",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 2
      }
    }
  },
  "beacon-of-hope": {
    "id": "beacon-of-hope",
    "name": "Beacon of Hope",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell bestows hope and vitality. Choose any number of creatures within range. For the duration, each target has advantage on wisdom..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "bestow-curse": {
    "id": "bestow-curse",
    "name": "Bestow Curse",
    "level": 3,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "wizard"
    ],
    "text": "Creatures make a WIS save, taking 1d8 necrotic damage on a failed save.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "blink": {
    "id": "blink",
    "name": "Blink",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Roll a d20 at the end of each of your turns for the duration of the spell. On a roll of 11 or higher, you vanish from your current plane..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "call-lightning": {
    "id": "call-lightning",
    "name": "Call Lightning",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "The spell deals 3d10 lightning damage when its effect lands.",
    "visual": {
      "color": "#f6e85a",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 5,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d10"
      }
    }
  },
  "clairvoyance": {
    "id": "clairvoyance",
    "name": "Clairvoyance",
    "level": 3,
    "school": "divination",
    "castingTime": "10 minutes",
    "range": "1 mile",
    "components": {
      "v": true,
      "s": true,
      "m": "A focus worth at least 100gp, either a jeweled horn for hearing or a glass eye for seeing."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A focus worth at least 100gp, either a jeweled horn for hearing or a glass eye for seeing.",
        "consumed": false,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create an invisible sensor within range in a location familiar to you (a place you have visited or seen before) or in an obvious loca..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "conjure-animals": {
    "id": "conjure-animals",
    "name": "Conjure Animals",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured beast",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "counterspell": {
    "id": "counterspell",
    "name": "Counterspell",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 reaction",
    "range": "60 feet",
    "components": {
      "v": false,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "reaction",
      "components": {
        "v": false,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spel..."
        }
      ],
      "cantripScaling": null,
      "scaling": null,
      "reactionTrigger": "when you see a creature casting a spell within 60 feet"
    }
  },
  "create-food-and-water": {
    "id": "create-food-and-water",
    "name": "Create Food and Water",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "paladin"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create 45 pounds of food and 30 gallons of water on the ground or in containers within range, enough to sustain up to fifteen humanoi..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "daylight": {
    "id": "daylight",
    "name": "Daylight",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "paladin",
      "ranger",
      "sorcerer"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It also creates or manipulates light in the area. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 60,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dispel-magic": {
    "id": "dispel-magic",
    "name": "Dispel Magic",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose one creature, object, or magical effect within range. Any spell of 3rd level or lower on the target ends. For each spell of 4th le..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "fear": {
    "id": "fear",
    "name": "Fear",
    "level": 3,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A white feather or the heart of a hen."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes frightened. The magic overwhelms targets with fear if they fail the save or effect.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A white feather or the heart of a hen.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 30,
          "origin": "self",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "frightened"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "fireball": {
    "id": "fireball",
    "name": "Fireball",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny ball of bat guano and sulfur."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 20-foot sphere make a DEX save, taking 8d6 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny ball of bat guano and sulfur.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "8d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "fly": {
    "id": "fly",
    "name": "Fly",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A wing feather from any bird."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A wing feather from any bird.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a willing creature. The target gains a flying speed of 60 feet for the duration. When the spell ends, the target falls if it is..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "gaseous-form": {
    "id": "gaseous-form",
    "name": "Gaseous Form",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of gauze and a wisp of smoke."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#9bd16f",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of gauze and a wisp of smoke.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You transform a willing creature you touch, along with everything it's wearing and carrying, into a misty cloud for the duration. The spe..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "glyph-of-warding": {
    "id": "glyph-of-warding",
    "name": "Glyph of Warding",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Incense and powdered diamond worth at least 200 gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "wizard"
    ],
    "text": "The spell deals 5d8 acid damage when its effect lands. It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#6ac94c",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "Incense and powdered diamond worth at least 200 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 200
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "When you cast this spell, you inscribe a glyph that harms other creatures, either upon a surface (such as a table or a section of floor o..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "haste": {
    "id": "haste",
    "name": "Haste",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A shaving of licorice root."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A shaving of licorice root.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose a willing creature that you can see within range. Until the spell ends, the target's speed is doubled, it gains a +2 bonus to AC,..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hypnotic-pattern": {
    "id": "hypnotic-pattern",
    "name": "Hypnotic Pattern",
    "level": 3,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": false,
      "s": true,
      "m": "A glowing stick of incense or a crystal vial filled with phosphorescent material."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": false,
        "s": true,
        "m": "A glowing stick of incense or a crystal vial filled with phosphorescent material.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "incapacitated"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "lightning-bolt": {
    "id": "lightning-bolt",
    "name": "Lightning Bolt",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fur and a rod of amber, crystal, or glass."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 100-foot line make a DEX save, taking 8d6 lightning damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#f6e85a",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fur and a rod of amber, crystal, or glass.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 100,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "8d6",
              "type": "lightning"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "magic-circle": {
    "id": "magic-circle",
    "name": "Magic Circle",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 minute",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Holy water or powdered silver and iron worth at least 100 gp, which the spell consumes."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin",
      "warlock",
      "wizard"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. Its main use is rapid repositioning or teleportation. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Holy water or powdered silver and iron worth at least 100 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 10,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "frightened"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "major-image": {
    "id": "major-image",
    "name": "Major Image",
    "level": 3,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fleece."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fleece.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create the image of an object, a creature, or some other visible phenomenon that is no larger than a 20-foot cube. The image appears..."
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "mass-healing-word": {
    "id": "mass-healing-word",
    "name": "Mass Healing Word",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "You distribute healing among multiple creatures you can see in range.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 6,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": "1d4",
          "flat": 0,
          "mod": "spell"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d4"
      }
    }
  },
  "meld-into-stone": {
    "id": "meld-into-stone",
    "name": "Meld Into Stone",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric"
    ],
    "text": "The spell deals 6d6 bludgeoning damage when its effect lands. It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You step into a stone object or surface large enough to fully contain your body, melding yourself and all the equipment you carry with th..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "nondetection": {
    "id": "nondetection",
    "name": "Nondetection",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of diamond dust worth 25 gp sprinkled over the target, which the spell consumes."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "ranger",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of diamond dust worth 25 gp sprinkled over the target, which the spell consumes.",
        "consumed": true,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "For the duration, you hide a target that you touch from divination magic. The target can be a willing creature or a place or an object no..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "phantom-steed": {
    "id": "phantom-steed",
    "name": "Phantom Steed",
    "level": 3,
    "school": "illusion",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "phantom steed",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "plant-growth": {
    "id": "plant-growth",
    "name": "Plant Growth",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell channels vitality into plants within a specific area. There are two possible uses for the spell, granting either immediate or..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "protection-from-energy": {
    "id": "protection-from-energy",
    "name": "Protection From Energy",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "For the duration, the willing creature you touch has resistance to one damage type of your choice: acid, cold, fire, lightning, or thunder."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "remove-curse": {
    "id": "remove-curse",
    "name": "Remove Curse",
    "level": 3,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin",
      "warlock",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "At your touch, all curses affecting one creature or object end. If the object is a cursed magic item, its curse remains, but the spell br..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "revivify": {
    "id": "revivify",
    "name": "Revivify",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Diamonds worth 300gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Diamonds worth 300gp, which the spell consumes.",
        "consumed": true,
        "costGp": 300
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature that has died within the last minute. That creature returns to life with 1 hit point. This spell can't return to lif..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sending": {
    "id": "sending",
    "name": "Sending",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Unlimited",
    "components": {
      "v": true,
      "s": true,
      "m": "A short piece of fine copper wire."
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A short piece of fine copper wire.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You send a short message of twenty-five words or less to a creature with which you are familiar. The creature hears the message in its mi..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sleet-storm": {
    "id": "sleet-storm",
    "name": "Sleet Storm",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of dust and a few drops of water."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of dust and a few drops of water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 40,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "slow": {
    "id": "slow",
    "name": "Slow",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of molasses."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of molasses.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 40,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "speak-with-dead": {
    "id": "speak-with-dead",
    "name": "Speak with Dead",
    "level": 3,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Burning incense."
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Burning incense.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You grant the semblance of life and intelligence to a corpse of your choice within range, allowing it to answer the questions you pose. T..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "speak-with-plants": {
    "id": "speak-with-plants",
    "name": "Speak with Plants",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "ranger"
    ],
    "text": "The area becomes difficult terrain and can pin creatures in place. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "self",
          "persistent": true,
          "difficultTerrain": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "spirit-guardians": {
    "id": "spirit-guardians",
    "name": "Spirit Guardians",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A holy symbol."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "The spell deals 3d8 radiant plus 3d8 necrotic damage when its effect lands. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#ffe680",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A holy symbol.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You call forth spirits to protect you. They flit around you to a distance of 15 feet for the duration. If you are good or neutral, their..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "stinking-cloud": {
    "id": "stinking-cloud",
    "name": "Stinking Cloud",
    "level": 3,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A rotten egg or several skunk cabbage leaves."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#47c8b3",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A rotten egg or several skunk cabbage leaves.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "tiny-hut": {
    "id": "tiny-hut",
    "name": "Tiny Hut",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A small crystal bead."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A small crystal bead.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "tongues": {
    "id": "tongues",
    "name": "Tongues",
    "level": 3,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": false,
      "m": "A small clay model of a ziggurat."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": "A small clay model of a ziggurat.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell grants the creature you touch the ability to understand any spoken language it hears. Moreover, when the target speaks, any cr..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "vampiric-touch": {
    "id": "vampiric-touch",
    "name": "Vampiric Touch",
    "level": 3,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 3d6 necrotic damage.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "3d6",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "water-breathing": {
    "id": "water-breathing",
    "name": "Water Breathing",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A short piece of reed or straw."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A short piece of reed or straw.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell gives a maximum of ten willing creatures within range and you can see, the ability to breathe underwater until the end of its..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "water-walk": {
    "id": "water-walk",
    "name": "Water Walk",
    "level": 3,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A piece of cork."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric",
      "druid",
      "ranger",
      "sorcerer"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A piece of cork.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 10,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell grants the ability to move across any liquid surface--such as water, acid, mud, snow, quicksand, or lava--as if it were harmle..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wind-wall": {
    "id": "wind-wall",
    "name": "Wind Wall",
    "level": 3,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny fan and a feather of exotic origin."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "Creatures in a 50-foot line make a STR save, taking 3d8 bludgeoning damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny fan and a feather of exotic origin.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 50,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "str",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "3d8",
              "type": "bludgeoning"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "arcane-eye": {
    "id": "arcane-eye",
    "name": "Arcane Eye",
    "level": 4,
    "school": "divination",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of bat fur."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of bat fur.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "point",
          "persistent": true,
          "movable": true,
          "moveDistance": 30
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "banishment": {
    "id": "banishment",
    "name": "Banishment",
    "level": 4,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "An item distasteful to the target."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a CHA save or becomes incapacitated.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An item distasteful to the target.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "incapacitated"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "targets",
        "addTargets": 1
      }
    }
  },
  "black-tentacles": {
    "id": "black-tentacles",
    "name": "Black Tentacles",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A piece of tentacle from a giant octopus or a giant squid"
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Creatures in a 20-foot cube make a DEX save, taking 3d6 bludgeoning damage on a failed save. The area becomes difficult terrain and can pin creatures in place.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A piece of tentacle from a giant octopus or a giant squid",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true,
          "damageOnEnter": {
            "dice": "3d6",
            "type": "bludgeoning"
          },
          "damageOnStartTurn": {
            "dice": "3d6",
            "type": "bludgeoning"
          }
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "3d6",
              "type": "bludgeoning"
            }
          ],
          "condition": "restrained"
        },
        {
          "kind": "condition",
          "condition": "restrained",
          "escapeAbility": "str"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "blight": {
    "id": "blight",
    "name": "Blight",
    "level": 4,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a CON save, taking 8d8 necrotic damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "8d8",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "compulsion": {
    "id": "compulsion",
    "name": "Compulsion",
    "level": 4,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "confusion": {
    "id": "confusion",
    "name": "Confusion",
    "level": 4,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Three walnut shells."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Three walnut shells.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "conjure-minor-elementals": {
    "id": "conjure-minor-elementals",
    "name": "Conjure Minor Elementals",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured elemental",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "conjure-woodland-beings": {
    "id": "conjure-woodland-beings",
    "name": "Conjure Woodland Beings",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "One holly berry per creature summoned."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "One holly berry per creature summoned.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured fey spirit",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "control-water": {
    "id": "control-water",
    "name": "Control Water",
    "level": 4,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of water and a pinch of dust."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "wizard"
    ],
    "text": "Creatures in a 100-foot cube make a STR save, taking 2d8 bludgeoning damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of water and a pinch of dust.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 100,
          "origin": "point",
          "persistent": true,
          "damageOnStartTurn": {
            "dice": "2d8",
            "type": "bludgeoning"
          }
        },
        {
          "kind": "save",
          "ability": "str",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d8",
              "type": "bludgeoning"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "death-ward": {
    "id": "death-ward",
    "name": "Death Ward",
    "level": 4,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature and grant it a measure of protection from death."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dimension-door": {
    "id": "dimension-door",
    "name": "Dimension Door",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "500 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "The spell deals 4d6 force damage when its effect lands. Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#9f8cff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You teleport yourself from your current location to any other spot within range. You arrive at exactly the spot desired. It can be a plac..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "divination": {
    "id": "divination",
    "name": "Divination",
    "level": 4,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Incense and a sacrificial offering appropriate to your religion, together worth at least 25gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "druid"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Incense and a sacrificial offering appropriate to your religion, together worth at least 25gp, which the spell consumes.",
        "consumed": true,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Your magic and an offering put you in contact with a god or a god's servants. You ask a single question concerning a specific goal, event..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dominate-beast": {
    "id": "dominate-beast",
    "name": "Dominate Beast",
    "level": 4,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "fabricate": {
    "id": "fabricate",
    "name": "Fabricate",
    "level": 4,
    "school": "transmutation",
    "castingTime": "10 minutes",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You convert raw materials into products of the same material. For example, you can fabricate a wooden bridge from a clump of trees, a rop..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "faithful-hound": {
    "id": "faithful-hound",
    "name": "Faithful Hound",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny silver whistle, a piece of bone, and a thread"
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 4d8 piercing damage. It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#a7a19a",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny silver whistle, a piece of bone, and a thread",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "phantom hound",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        },
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "4d8",
              "type": "piercing"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "fire-shield": {
    "id": "fire-shield",
    "name": "Fire Shield",
    "level": 4,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A little phosphorus or a firefly."
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "The spell deals 2d8 fire damage when its effect lands.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A little phosphorus or a firefly.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 5,
          "origin": "self",
          "persistent": true
        },
        {
          "kind": "narrative",
          "summary": "Thin and vaporous flame surround your body for the duration of the spell, radiating a bright light bright light in a 10-foot radius and d..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "freedom-of-movement": {
    "id": "freedom-of-movement",
    "name": "Freedom of Movement",
    "level": 4,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A leather strap, bound around the arm or a similar appendage."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "ranger"
    ],
    "text": "The area becomes difficult terrain and can pin creatures in place.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A leather strap, bound around the arm or a similar appendage.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a willing creature. For the duration, the target's movement is unaffected by difficult terrain, and spells and other magical ef..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "giant-insect": {
    "id": "giant-insect",
    "name": "Giant Insect",
    "level": 4,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You transform up to ten centipedes, three spiders, five wasps, or one scorpion within range into giant versions of their natural forms fo..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "greater-invisibility": {
    "id": "greater-invisibility",
    "name": "Greater Invisibility",
    "level": 4,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You or a creature you touch becomes invisible until the spell ends. Anything the target is wearing or carrying is invisible as long as it..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "guardian-of-faith": {
    "id": "guardian-of-faith",
    "name": "Guardian of Faith",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Creatures in a 10-foot cylinder make a DEX save, taking 20 radiant damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ffe680",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "guardian spirit",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        },
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 10,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "20",
              "type": "radiant"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hallucinatory-terrain": {
    "id": "hallucinatory-terrain",
    "name": "Hallucinatory Terrain",
    "level": 4,
    "school": "illusion",
    "castingTime": "10 minutes",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A stone, a twig, and a bit of green plant."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "warlock",
      "wizard"
    ],
    "text": "This illusion deceives senses or creates misleading sensory phenomena.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A stone, a twig, and a bit of green plant.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 150,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "ice-storm": {
    "id": "ice-storm",
    "name": "Ice Storm",
    "level": 4,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of dust and a few drops of water."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 20-foot cylinder make a DEX save, taking 2d8 bludgeoning plus 4d6 cold damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of dust and a few drops of water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d8+4d6",
              "type": "bludgeoning"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "locate-creature": {
    "id": "locate-creature",
    "name": "Locate Creature",
    "level": 4,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fur from a bloodhound."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "ranger",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fur from a bloodhound.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Describe or name a creature that is familiar to you. You sense the direction to the creature's location, as long as that creature is with..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "phantasmal-killer": {
    "id": "phantasmal-killer",
    "name": "Phantasmal Killer",
    "level": 4,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Creatures make a WIS save, taking 4d10 psychic damage on a failed save. The magic overwhelms targets with fear if they fail the save or effect.",
    "visual": {
      "color": "#d46cff",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "4d10",
              "type": "psychic"
            }
          ],
          "condition": "frightened"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "polymorph": {
    "id": "polymorph",
    "name": "Polymorph",
    "level": 4,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A caterpillar cocoon."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes unconscious. Creatures affected by the spell can be dropped into magical sleep. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A caterpillar cocoon.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "unconscious"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "private-sanctum": {
    "id": "private-sanctum",
    "name": "Private Sanctum",
    "level": 4,
    "school": "abjuration",
    "castingTime": "10 minutes",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A thin sheet of lead, a piece of opaque glass, a wad of cotton or cloth, and powdered chrysolite."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A thin sheet of lead, a piece of opaque glass, a wad of cotton or cloth, and powdered chrysolite.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 100,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "resilient-sphere": {
    "id": "resilient-sphere",
    "name": "Resilient Sphere",
    "level": 4,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A hemispherical piece of clear crystal and a matching hemispherical piece of gum arabic."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A hemispherical piece of clear crystal and a matching hemispherical piece of gum arabic.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "secret-chest": {
    "id": "secret-chest",
    "name": "Secret Chest",
    "level": 4,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "An exquisite chest, 3 feet by 2 feet by 2 feet, constructed from rare materials worth at least 5,000 gp, and a Tiny replica made from the same materials worth at least 50 gp."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An exquisite chest, 3 feet by 2 feet by 2 feet, constructed from rare materials worth at least 5,000 gp, and a Tiny replica made from the same materials worth at least 50 gp.",
        "consumed": false,
        "costGp": 5050
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You hide a chest, and all its contents, on the Ethereal Plane. You must touch the chest and the miniature replica that serves as a materi..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "stone-shape": {
    "id": "stone-shape",
    "name": "Stone Shape",
    "level": 4,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Soft clay, to be crudely worked into the desired shape for the stone object."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Soft clay, to be crudely worked into the desired shape for the stone object.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a stone object of Medium size or smaller or a section of stone no more than 5 feet in any dimension and form it into any shape..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "stoneskin": {
    "id": "stoneskin",
    "name": "Stoneskin",
    "level": 4,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Diamond dust worth 100 gp, which the spell consumes."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger",
      "sorcerer",
      "wizard"
    ],
    "text": "This abjuration wards a creature, area, or object against danger or magic.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Diamond dust worth 100 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell turns the flesh of a willing creature you touch as hard as stone. Until the spell ends, the target has resistance to nonmagica..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wall-of-fire": {
    "id": "wall-of-fire",
    "name": "Wall of Fire",
    "level": 4,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small piece of phosphorus."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 60-foot line make a DEX save, taking 5d8 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small piece of phosphorus.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 60,
          "origin": "point",
          "persistent": true,
          "damageOnEnter": {
            "dice": "5d8",
            "type": "fire"
          },
          "damageOnEndTurn": {
            "dice": "5d8",
            "type": "fire"
          }
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "5d8",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "animate-objects": {
    "id": "animate-objects",
    "name": "Animate Objects",
    "level": 5,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#9bd16f",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "animated object",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 2
      }
    }
  },
  "antilife-shell": {
    "id": "antilife-shell",
    "name": "Antilife Shell",
    "level": 5,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "arcane-hand": {
    "id": "arcane-hand",
    "name": "Arcane Hand",
    "level": 5,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "An eggshell and a snakeskin glove."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "The spell deals 4d8 force damage when its effect lands.",
    "visual": {
      "color": "#9f8cff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An eggshell and a snakeskin glove.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "arcane hand",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "awaken": {
    "id": "awaken",
    "name": "Awaken",
    "level": 5,
    "school": "transmutation",
    "castingTime": "8 hours",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "An agate worth at least 1,000 gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "An agate worth at least 1,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "After spending the casting time tracing magical pathways within a precious gemstone, you touch a Huge or smaller beast or plant. The targ..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "cloudkill": {
    "id": "cloudkill",
    "name": "Cloudkill",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 20-foot sphere make a CON save, taking 5d8 poison damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#4cae55",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "damageOnEnter": {
            "dice": "5d8",
            "type": "poison"
          },
          "damageOnStartTurn": {
            "dice": "5d8",
            "type": "poison"
          },
          "movable": true,
          "moveDistance": 10
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "5d8",
              "type": "poison"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "commune": {
    "id": "commune",
    "name": "Commune",
    "level": 5,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Incense and a vial of holy or unholy water."
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Incense and a vial of holy or unholy water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You contact your deity or a divine proxy and ask up to three questions that can be answered with a yes or no. You must ask your questions..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "commune-with-nature": {
    "id": "commune-with-nature",
    "name": "Commune With Nature",
    "level": 5,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": true,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You briefly become one with nature and gain knowledge of the surrounding territory. In the outdoors, the spell gives you knowledge of the..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "cone-of-cold": {
    "id": "cone-of-cold",
    "name": "Cone of Cold",
    "level": 5,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A small crystal or glass cone."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 60-foot cone make a CON save, taking 8d8 cold damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#86d8ff",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small crystal or glass cone.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 60,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "8d8",
              "type": "cold"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "conjure-elemental": {
    "id": "conjure-elemental",
    "name": "Conjure Elemental",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Burning incense for air, soft clay for earth, sulfur and phosphorus for fire, or water and sand for water."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Burning incense for air, soft clay for earth, sulfur and phosphorus for fire, or water and sand for water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured elemental",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        },
        {
          "kind": "area",
          "shape": "cube",
          "size": 10,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "contact-other-plane": {
    "id": "contact-other-plane",
    "name": "Contact Other Plane",
    "level": 5,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "1 minute",
    "concentration": false,
    "ritual": true,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a INT save, taking 6d6 psychic damage on a failed save. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d46cff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "int",
          "saveEffect": "partial",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "contagion": {
    "id": "contagion",
    "name": "Contagion",
    "level": 5,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "7 days",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "The spell robs the target of sight for the duration or until ended. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": []
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "condition": "blinded",
          "conditionOptions": [
            "blinded",
            "stunned"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "creation": {
    "id": "creation",
    "name": "Creation",
    "level": 5,
    "school": "illusion",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny piece of matter of the same type of the item you plan to create."
    },
    "duration": "Special",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny piece of matter of the same type of the item you plan to create.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 5,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dispel-evil-and-good": {
    "id": "dispel-evil-and-good",
    "name": "Dispel Evil and Good",
    "level": 5,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Holy water or powdered silver and iron."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "paladin"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Holy water or powdered silver and iron.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "frightened"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dominate-person": {
    "id": "dominate-person",
    "name": "Dominate Person",
    "level": 5,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "dream": {
    "id": "dream",
    "name": "Dream",
    "level": 5,
    "school": "illusion",
    "castingTime": "1 minute",
    "range": "Special",
    "components": {
      "v": true,
      "s": true,
      "m": "A handful of sand, a dab of ink, and a writing quill plucked from a sleeping bird."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a WIS save, taking 3d6 psychic damage on a failed save.",
    "visual": {
      "color": "#d46cff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A handful of sand, a dab of ink, and a writing quill plucked from a sleeping bird.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "3d6",
              "type": "psychic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "flame-strike": {
    "id": "flame-strike",
    "name": "Flame Strike",
    "level": 5,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Pinch of sulfur."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Creatures in a 40-foot cylinder make a DEX save, taking 4d6 fire plus 4d6 radiant damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Pinch of sulfur.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 40,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "4d6+4d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addFlat": 1
      }
    }
  },
  "geas": {
    "id": "geas",
    "name": "Geas",
    "level": 5,
    "school": "enchantment",
    "castingTime": "1 minute",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "30 days",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "paladin",
      "wizard"
    ],
    "text": "Creatures make a WIS save, taking 5d10 psychic damage on a failed save. The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#d46cff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "greater-restoration": {
    "id": "greater-restoration",
    "name": "Greater Restoration",
    "level": 5,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Diamond dust worth at least 100gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Diamond dust worth at least 100gp, which the spell consumes.",
        "consumed": true,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You imbue a creature you touch with positive energy to undo a debilitating effect. You can reduce the target's exhaustion level by one, o..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hallow": {
    "id": "hallow",
    "name": "Hallow",
    "level": 5,
    "school": "evocation",
    "castingTime": "24 hours",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Herbs, oils, and incense worth at least 1,000 gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "Herbs, oils, and incense worth at least 1,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 60,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "frightened"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "hold-monster": {
    "id": "hold-monster",
    "name": "Hold Monster",
    "level": 5,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small piece of iron."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes paralyzed. Failed targets are left unable to move or act effectively.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small piece of iron.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "paralyzed"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "insect-plague": {
    "id": "insect-plague",
    "name": "Insect Plague",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A few grains of sugar, some kernels of grain, and a smear of fat."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "sorcerer"
    ],
    "text": "Creatures in a 20-foot sphere make a CON save, taking 4d10 piercing damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#a7a19a",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A few grains of sugar, some kernels of grain, and a smear of fat.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true,
          "damageOnEnter": {
            "dice": "4d10",
            "type": "piercing"
          },
          "damageOnEndTurn": {
            "dice": "4d10",
            "type": "piercing"
          }
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "4d10",
              "type": "piercing"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d10"
      }
    }
  },
  "legend-lore": {
    "id": "legend-lore",
    "name": "Legend Lore",
    "level": 5,
    "school": "divination",
    "castingTime": "10 minutes",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Incense worth at least 250 gp, which the spell consumes, and four ivory strips worth at least 50 gp each."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Incense worth at least 250 gp, which the spell consumes, and four ivory strips worth at least 50 gp each.",
        "consumed": true,
        "costGp": 450
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Name or describe a person, place, or object. The spell brings to your mind a brief summary of the significant lore about the thing you na..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mass-cure-wounds": {
    "id": "mass-cure-wounds",
    "name": "Mass Cure Wounds",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid"
    ],
    "text": "You distribute healing among multiple creatures you can see in range. It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "point"
        },
        {
          "kind": "heal",
          "dice": "3d8",
          "flat": 0,
          "mod": "spell"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "mislead": {
    "id": "mislead",
    "name": "Mislead",
    "level": 5,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": false,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": false,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You become invisible at the same time that an illusory double of you appears where you are standing. The double lasts for the duration, b..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "modify-memory": {
    "id": "modify-memory",
    "name": "Modify Memory",
    "level": 5,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment. It changes a creature, object, or the environment rather than dealing direct damage. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed",
          "conditionOptions": [
            "charmed",
            "incapacitated"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "passwall": {
    "id": "passwall",
    "name": "Passwall",
    "level": 5,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of sesame seeds."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ring"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of sesame seeds.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A passage appears at a point of your choice that you can see on a wooden, plaster, or stone surface (such as a wall, a ceiling, or a floo..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "planar-binding": {
    "id": "planar-binding",
    "name": "Planar Binding",
    "level": 5,
    "school": "abjuration",
    "castingTime": "1 hour",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A jewel worth at least 1,000 gp, which the spell consumes."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "A jewel worth at least 1,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "raise-dead": {
    "id": "raise-dead",
    "name": "Raise Dead",
    "level": 5,
    "school": "necromancy",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A diamond worth at least 500gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "paladin"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "A diamond worth at least 500gp, which the spell consumes.",
        "consumed": true,
        "costGp": 500
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You return a dead creature you touch to life, provided that it has been dead no longer than 10 days. If the creature's soul is both willi..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "reincarnate": {
    "id": "reincarnate",
    "name": "Reincarnate",
    "level": 5,
    "school": "transmutation",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Rare oils and unguents worth at least 1,000 gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "Rare oils and unguents worth at least 1,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a dead humanoid or a piece of a dead humanoid. Provided that the creature has been dead no longer than 10 days, the spell forms..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "scrying": {
    "id": "scrying",
    "name": "Scrying",
    "level": 5,
    "school": "divination",
    "castingTime": "10 minutes",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes invisible. It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A focus worth at least 1,000 gp, such as a crystal ball, a silver mirror, or a font filled with holy water.",
        "consumed": false,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "invisible"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "seeming": {
    "id": "seeming",
    "name": "Seeming",
    "level": 5,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "This illusion deceives senses or creates misleading sensory phenomena.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell allows you to change the appearance of any number of creatures that you can see within range. You give each target you choose..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "telekinesis": {
    "id": "telekinesis",
    "name": "Telekinesis",
    "level": 5,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "point",
          "persistent": true,
          "movable": true,
          "moveDistance": 30
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "telepathic-bond": {
    "id": "telepathic-bond",
    "name": "Telepathic Bond",
    "level": 5,
    "school": "divination",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Pieces of eggshell from two different kinds of creatures"
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": true,
    "classes": [
      "wizard"
    ],
    "text": "This is a utility divination that reveals information, signs, or hidden truths.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Pieces of eggshell from two different kinds of creatures",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 8,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You forge a telepathic link among up to eight willing creatures of your choice within range, psychically linking each creature to all the..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "teleportation-circle": {
    "id": "teleportation-circle",
    "name": "Teleportation Circle",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": false,
      "m": "Rare chalks and inks infused with precious gems with 50 gp, which the spell consumes."
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#47c8b3",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": false,
        "m": "Rare chalks and inks infused with precious gems with 50 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 50
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "tree-stride": {
    "id": "tree-stride",
    "name": "Tree Stride",
    "level": 5,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "ranger"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You gain the ability to enter a tree and move from inside it to inside another tree of the same kind within 500 feet. Both trees must be..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wall-of-force": {
    "id": "wall-of-force",
    "name": "Wall of Force",
    "level": 5,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of powder made by crushing a clear gemstone."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It changes a creature, object, or the environment rather than dealing direct damage. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of powder made by crushing a clear gemstone.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "An invisible wall of force springs into existence at a point you choose within range. The wall appears in any orientation you choose, as..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wall-of-stone": {
    "id": "wall-of-stone",
    "name": "Wall of Stone",
    "level": 5,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small block of granite."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small block of granite.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "A nonmagical wall of solid stone springs into existence at a point you choose within range. The wall is 6 inches thick and is composed of..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "blade-barrier": {
    "id": "blade-barrier",
    "name": "Blade Barrier",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Creatures in a 100-foot line make a DEX save, taking 6d10 slashing damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#c9c9c9",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 100,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true,
          "damageOnStartTurn": {
            "dice": "6d10",
            "type": "slashing"
          }
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "6d10",
              "type": "slashing"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "chain-lightning": {
    "id": "chain-lightning",
    "name": "Chain Lightning",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fur; a piece of amber, glass, or a crystal rod; and three silver pins."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures make a DEX save, taking 10d8 lightning damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#f6e85a",
      "shape": "bolt"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fur; a piece of amber, glass, or a crystal rod; and three silver pins.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 4,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "10d8",
              "type": "lightning"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "circle-of-death": {
    "id": "circle-of-death",
    "name": "Circle of Death",
    "level": 6,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "The powder of a crushed black pearl worth at least 500 gp."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Creatures in a 60-foot sphere make a CON save, taking 8d6 necrotic damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "The powder of a crushed black pearl worth at least 500 gp.",
        "consumed": false,
        "costGp": 500
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 60,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "8d6",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "2d6"
      }
    }
  },
  "conjure-fey": {
    "id": "conjure-fey",
    "name": "Conjure Fey",
    "level": 6,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "warlock"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured fey",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "contingency": {
    "id": "contingency",
    "name": "Contingency",
    "level": 6,
    "school": "evocation",
    "castingTime": "10 minutes",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A statuette of yourself carved from ivory and decorated with gems worth at least 1,500 gp."
    },
    "duration": "10 days",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A statuette of yourself carved from ivory and decorated with gems worth at least 1,500 gp.",
        "consumed": false,
        "costGp": 1500
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose a spell of 5th level or lower that you can cast, that has a casting time of 1 action, and that can target you. You cast that spell..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "create-undead": {
    "id": "create-undead",
    "name": "Create Undead",
    "level": 6,
    "school": "necromancy",
    "castingTime": "1 minute",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "One clay pot filled with grave dirt, one clay pot filled with brackish water, and one 150 gp black onyx stone for each corpse."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "warlock",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "One clay pot filled with grave dirt, one clay pot filled with brackish water, and one 150 gp black onyx stone for each corpse.",
        "consumed": false,
        "costGp": 150
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "created undead",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "disintegrate": {
    "id": "disintegrate",
    "name": "Disintegrate",
    "level": 6,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A lodestone and a pinch of dust."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 10-foot cube make a DEX save, taking 10d6+40 force damage on a failed save.",
    "visual": {
      "color": "#9f8cff",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A lodestone and a pinch of dust.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 10,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "10d6+40",
              "type": "force"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "eyebite": {
    "id": "eyebite",
    "name": "Eyebite",
    "level": 6,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "frightened",
          "conditionOptions": [
            "frightened",
            "unconscious"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "find-the-path": {
    "id": "find-the-path",
    "name": "Find the Path",
    "level": 6,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A set of divinatory tools--such as bones, ivory sticks, cards, teeth, or carved runes--worth 100gp and an object from the location you wish to find."
    },
    "duration": "Up to 24 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A set of divinatory tools--such as bones, ivory sticks, cards, teeth, or carved runes--worth 100gp and an object from the location you wish to find.",
        "consumed": false,
        "costGp": 100
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell allows you to find the shortest, most direct physical route to a specific fixed location that you are familiar with on the sam..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "flesh-to-stone": {
    "id": "flesh-to-stone",
    "name": "Flesh to Stone",
    "level": 6,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of lime, water, and earth."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "Repeated failed saves can turn the victim to stone.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of lime, water, and earth.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "end_of_turn",
          "condition": "petrified",
          "conditionOptions": [
            "petrified",
            "restrained"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "forbiddance": {
    "id": "forbiddance",
    "name": "Forbiddance",
    "level": 6,
    "school": "abjuration",
    "castingTime": "10 minutes",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A sprinkling of holy water, rare incense, and powdered ruby worth at least 1,000 gp."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": true,
    "classes": [
      "cleric"
    ],
    "text": "The spell deals 5d10 radiant damage when its effect lands. Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#ffe680",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A sprinkling of holy water, rare incense, and powdered ruby worth at least 1,000 gp.",
        "consumed": false,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 40000,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "freezing-sphere": {
    "id": "freezing-sphere",
    "name": "Freezing Sphere",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small crystal sphere."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Creatures in a 60-foot sphere make a CON save, taking 10d6 cold damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#86d8ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small crystal sphere.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 60,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "10d6",
              "type": "cold"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "globe-of-invulnerability": {
    "id": "globe-of-invulnerability",
    "name": "Globe of Invulnerability",
    "level": 6,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A glass or crystal bead that shatters when the spell ends."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A glass or crystal bead that shatters when the spell ends.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "guards-and-wards": {
    "id": "guards-and-wards",
    "name": "Guards and Wards",
    "level": 6,
    "school": "abjuration",
    "castingTime": "10 minutes",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Burning incense, a small measure of brimstone and oil, a knotted string, a small amount of umber hulk blood, and a small silver rod worth at least 10 gp."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Burning incense, a small measure of brimstone and oil, a knotted string, a small amount of umber hulk blood, and a small silver rod worth at least 10 gp.",
        "consumed": false,
        "costGp": 10
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 2500,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "harm": {
    "id": "harm",
    "name": "Harm",
    "level": 6,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Creatures make a CON save, taking 14d6 necrotic damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "14d6",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "heal": {
    "id": "heal",
    "name": "Heal",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "You restore hit points to one or more creatures in range.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": null,
          "flat": 70,
          "mod": null
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addFlat": 10
      }
    }
  },
  "heroes-feast": {
    "id": "heroes-feast",
    "name": "Heroes' Feast",
    "level": 6,
    "school": "conjuration",
    "castingTime": "10 minutes",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A gem-encrusted bowl worth at least 1,000gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A gem-encrusted bowl worth at least 1,000gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You bring forth a great feast, including magnificent food and drink. The feast takes 1 hour to consume and disappears at the end of that..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "instant-summons": {
    "id": "instant-summons",
    "name": "Instant Summons",
    "level": 6,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A sapphire worth 1,000 gp."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": true,
    "classes": [
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It is primarily a sensing or information-gathering spell. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#47c8b3",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": true,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A sapphire worth 1,000 gp.",
        "consumed": false,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch an object weighing 10 pounds or less whose longest dimension is 6 feet or less. The spell leaves an invisible mark on its surfa..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "irresistible-dance": {
    "id": "irresistible-dance",
    "name": "Irresistible Dance",
    "level": 6,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose one creature that you can see within range. The target begins a comic dance in place: shuffling, tapping its feet, and capering fo..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "magic-jar": {
    "id": "magic-jar",
    "name": "Magic Jar",
    "level": 6,
    "school": "necromancy",
    "castingTime": "1 minute",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A gem, crystal, reliquary, or some other ornamental container worth at least 500 gp."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It creates a protective magical boundary or ward.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A gem, crystal, reliquary, or some other ornamental container worth at least 500 gp.",
        "consumed": false,
        "costGp": 500
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "partial",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mass-suggestion": {
    "id": "mass-suggestion",
    "name": "Mass Suggestion",
    "level": 6,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": "A snake's tongue and either a bit of honeycomb or a drop of sweet oil."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": "A snake's tongue and either a bit of honeycomb or a drop of sweet oil.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "move-earth": {
    "id": "move-earth",
    "name": "Move Earth",
    "level": 6,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "An iron blade and a small bag containing a mixture of soils--clay, loam, and sand."
    },
    "duration": "Up to 2 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An iron blade and a small bag containing a mixture of soils--clay, loam, and sand.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 40,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "planar-ally": {
    "id": "planar-ally",
    "name": "Planar Ally",
    "level": 6,
    "school": "conjuration",
    "castingTime": "10 minutes",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You beseech an otherworldly entity for aid. The being must be known to you: a god, a primordial, a demon prince, or some other being of c..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "programmed-illusion": {
    "id": "programmed-illusion",
    "name": "Programmed Illusion",
    "level": 6,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A bit of fleece and jade dust worth at least 25 gp."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A bit of fleece and jade dust worth at least 25 gp.",
        "consumed": false,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 30,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sunbeam": {
    "id": "sunbeam",
    "name": "Sunbeam",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A magnifying glass."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 60-foot line make a CON save, taking 6d8 radiant damage on a failed save and half as much on a success. The spell robs the target of sight for the duration or until ended.",
    "visual": {
      "color": "#ffe680",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A magnifying glass.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 60,
          "origin": "self",
          "persistent": true,
          "movable": true
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "6d8",
              "type": "radiant"
            }
          ],
          "condition": "blinded"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "transport-via-plants": {
    "id": "transport-via-plants",
    "name": "Transport via Plants",
    "level": 6,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "1 round",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell creates a magical link between a Large or larger inanimate plant within range and another plant, at any distance, on the same..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "true-seeing": {
    "id": "true-seeing",
    "name": "True Seeing",
    "level": 6,
    "school": "divination",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "An ointment for the eyes that costs 25gp; is made from mushroom powder, saffron, and fat; and is consumed by the spell."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "An ointment for the eyes that costs 25gp; is made from mushroom powder, saffron, and fat; and is consumed by the spell.",
        "consumed": true,
        "costGp": 25
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell gives the willing creature you touch the ability to see things as they actually are. For the duration, the creature has truesi..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wall-of-ice": {
    "id": "wall-of-ice",
    "name": "Wall of Ice",
    "level": 6,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A small piece of quartz."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Creatures in a 10-foot sphere make a DEX save, taking 10d6 cold plus 5d6 cold damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#86d8ff",
      "shape": "ring"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small piece of quartz.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "10d6",
              "type": "cold"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "2d6"
      }
    }
  },
  "wall-of-thorns": {
    "id": "wall-of-thorns",
    "name": "Wall of Thorns",
    "level": 6,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A handful of thorns."
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "Creatures in a 60-foot line make a DEX save, taking 7d8 piercing plus 7d8 slashing damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#a7a19a",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A handful of thorns.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 60,
          "origin": "point",
          "persistent": true,
          "damageOnEndTurn": {
            "dice": "7d8",
            "type": "piercing"
          }
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "7d8",
              "type": "piercing"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d8"
      }
    }
  },
  "wind-walk": {
    "id": "wind-walk",
    "name": "Wind Walk",
    "level": 6,
    "school": "transmutation",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Fire and holy water."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Fire and holy water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 10,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You and up to ten willing creatures you can see within range assume a gaseous form for the duration, appearing as wisps of cloud. While i..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "word-of-recall": {
    "id": "word-of-recall",
    "name": "Word of Recall",
    "level": 6,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "5 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#47c8b3",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 5,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "arcane-sword": {
    "id": "arcane-sword",
    "name": "Arcane Sword",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A miniature platinum sword with a grip and pommel of copper and zinc, worth 250 gp."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "Make a melee spell attack; on a hit, the target takes 3d10 force damage.",
    "visual": {
      "color": "#9f8cff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A miniature platinum sword with a grip and pommel of copper and zinc, worth 250 gp.",
        "consumed": false,
        "costGp": 250
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "spectral sword",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        },
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": [
            {
              "dice": "3d10",
              "type": "force"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "conjure-celestial": {
    "id": "conjure-celestial",
    "name": "Conjure Celestial",
    "level": 7,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "90 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "summon",
          "creature": "conjured celestial",
          "count": 1,
          "controlled": true,
          "hpMode": "statblock"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "summons",
        "addTargets": 1
      }
    }
  },
  "delayed-blast-fireball": {
    "id": "delayed-blast-fireball",
    "name": "Delayed Blast Fireball",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny ball of bat guano and sulfur."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 20-foot sphere make a DEX save, taking 12d6 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "beam"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny ball of bat guano and sulfur.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "12d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "damage",
        "addDice": "1d6"
      }
    }
  },
  "divine-word": {
    "id": "divine-word",
    "name": "Divine Word",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 bonus action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "The spell robs the target of sight for the duration or until ended. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "bonus",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "blinded",
          "conditionOptions": [
            "blinded",
            "deafened",
            "stunned"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "etherealness": {
    "id": "etherealness",
    "name": "Etherealness",
    "level": 7,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You step into the border regions of the Ethereal Plane, in the area where it overlaps with your current plane. You remain in the Border E..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "finger-of-death": {
    "id": "finger-of-death",
    "name": "Finger of Death",
    "level": 7,
    "school": "necromancy",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a CON save, taking 7d8+30 necrotic damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "7d8+30",
              "type": "necrotic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "fire-storm": {
    "id": "fire-storm",
    "name": "Fire Storm",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "sorcerer"
    ],
    "text": "Creatures in a 100-foot cube make a DEX save, taking 7d10 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 100,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "7d10",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "forcecage": {
    "id": "forcecage",
    "name": "Forcecage",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "100 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Ruby dust worth 1,500 gp."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "warlock",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. Its main use is rapid repositioning or teleportation. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#ff8a3d",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Ruby dust worth 1,500 gp.",
        "consumed": false,
        "costGp": 1500
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 20,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "magnificent-mansion": {
    "id": "magnificent-mansion",
    "name": "Magnificent Mansion",
    "level": 7,
    "school": "conjuration",
    "castingTime": "1 minute",
    "range": "300 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A miniature portal carved from ivory, a small piece of polished marble, and a tiny silver spoon, each item worth at least 5 gp."
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A miniature portal carved from ivory, a small piece of polished marble, and a tiny silver spoon, each item worth at least 5 gp.",
        "consumed": false,
        "costGp": 15
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 5,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mirage-arcane": {
    "id": "mirage-arcane",
    "name": "Mirage Arcane",
    "level": 7,
    "school": "illusion",
    "castingTime": "10 minutes",
    "range": "Sight",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 days",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 5280,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "plane-shift": {
    "id": "plane-shift",
    "name": "Plane Shift",
    "level": 7,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A forked, metal rod worth at least 250 gp, attuned to a particular plane of existence."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#47c8b3",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A forked, metal rod worth at least 250 gp, attuned to a particular plane of existence.",
        "consumed": false,
        "costGp": 250
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "attack",
          "attack": "melee_spell",
          "damage": []
        },
        {
          "kind": "save",
          "ability": "cha",
          "saveEffect": "negates",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "prismatic-spray": {
    "id": "prismatic-spray",
    "name": "Prismatic Spray",
    "level": 7,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 60-foot cone make a DEX save, taking 10d6 fire plus 10d6 acid plus 10d6 lightning plus 10d6 poison plus 10d6 cold damage on a failed save. Repeated failed saves can turn the victim to stone.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cone",
          "size": 60,
          "origin": "self"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "partial",
          "saveRepeat": "end_of_turn",
          "condition": "blinded",
          "conditionOptions": [
            "blinded",
            "petrified",
            "restrained"
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "project-image": {
    "id": "project-image",
    "name": "Project Image",
    "level": 7,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "500 miles",
    "components": {
      "v": true,
      "s": true,
      "m": "A small replica of you made from materials worth at least 5 gp."
    },
    "duration": "Up to 24 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "The spell robs the target of sight for the duration or until ended. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A small replica of you made from materials worth at least 5 gp.",
        "consumed": false,
        "costGp": 5
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create an illusory copy of yourself that lasts for the duration. The copy can appear at any location within range that you have seen..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "regenerate": {
    "id": "regenerate",
    "name": "Regenerate",
    "level": 7,
    "school": "transmutation",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A prayer wheel and holy water."
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "druid"
    ],
    "text": "You restore hit points to a creature you touch.",
    "visual": {
      "color": "#9bd16f",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A prayer wheel and holy water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": "4d8",
          "flat": 15,
          "mod": null
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "resurrection": {
    "id": "resurrection",
    "name": "Resurrection",
    "level": 7,
    "school": "necromancy",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A diamond worth at least 1,000gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "A diamond worth at least 1,000gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a dead creature that has been dead for no more than a century, that didn't die of old age, and that isn't undead. If its soul i..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "reverse-gravity": {
    "id": "reverse-gravity",
    "name": "Reverse Gravity",
    "level": 7,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "100 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A lodestone and iron filings."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A lodestone and iron filings.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 50,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "partial",
          "saveRepeat": "none"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sequester": {
    "id": "sequester",
    "name": "Sequester",
    "level": 7,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A powder composed of diamond, emerald, ruby, and sapphire dust worth at least 5,000 gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#9bd16f",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A powder composed of diamond, emerald, ruby, and sapphire dust worth at least 5,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 5000
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "By means of this spell, a willing creature or an object can be hidden away, safe from detection for the duration. When you cast the spell..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "simulacrum": {
    "id": "simulacrum",
    "name": "Simulacrum",
    "level": 7,
    "school": "illusion",
    "castingTime": "12 hours",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Snow or ice in quantities sufficient to made a life-size copy of the duplicated creature; some hair, fingernail clippings, or other piece of that creature's body placed inside the snow or ice; and powdered ruby worth 1,500 gp, sprinkled over the duplicate and consumed by the spell."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "It is primarily a sensing or information-gathering spell.",
    "visual": {
      "color": "#c8a0ff",
      "shape": "none"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "Snow or ice in quantities sufficient to made a life-size copy of the duplicated creature; some hair, fingernail clippings, or other piece of that creature's body placed inside the snow or ice; and powdered ruby worth 1,500 gp, sprinkled over the duplicate and consumed by the spell.",
        "consumed": true,
        "costGp": 1500
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You shape an illusory duplicate of one beast or humanoid that is within range for the entire casting time of the spell. The duplicate is..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "symbol": {
    "id": "symbol",
    "name": "Symbol",
    "level": 7,
    "school": "abjuration",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "Mercury, phosphorus, and powdered diamond and opal with a total value of at least 1,000 gp, which the spell consumes."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "cleric",
      "wizard"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect. It changes a creature, object, or the environment rather than dealing direct damage. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "weapon"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Mercury, phosphorus, and powdered diamond and opal with a total value of at least 1,000 gp, which the spell consumes.",
        "consumed": true,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 10,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "teleport": {
    "id": "teleport",
    "name": "Teleport",
    "level": 7,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 3d10 force damage when its effect lands. Its main use is rapid repositioning or teleportation.",
    "visual": {
      "color": "#9f8cff",
      "shape": "beam"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 10,
          "origin": "point"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "animal-shapes": {
    "id": "animal-shapes",
    "name": "Animal Shapes",
    "level": 8,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 24 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "Creatures affected by the spell can be dropped into magical sleep. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Your magic turns others into beasts. Choose any number of willing creatures that you can see within range. You transform each target into..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "antimagic-field": {
    "id": "antimagic-field",
    "name": "Antimagic Field",
    "level": 8,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of powdered iron or iron filings."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "wizard"
    ],
    "text": "It conceals the target from normal sight for the duration. Its main use is rapid repositioning or teleportation. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of powdered iron or iron filings.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 10,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "antipathy-sympathy": {
    "id": "antipathy-sympathy",
    "name": "Antipathy/Sympathy",
    "level": 8,
    "school": "enchantment",
    "castingTime": "1 hour",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Either a lump of alum soaked in vinegar for the antipathy effect or a drop of honey for the sympathy effect."
    },
    "duration": "10 days",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "wizard"
    ],
    "text": "The magic overwhelms targets with fear if they fail the save or effect.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "aura"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "Either a lump of alum soaked in vinegar for the antipathy effect or a drop of honey for the sympathy effect.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "object"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cube",
          "size": 200,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "clone": {
    "id": "clone",
    "name": "Clone",
    "level": 8,
    "school": "necromancy",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A diamond worth at least 1,000 gp and at least 1 cubic inch of flesh of the creature that is to be cloned, which the spell consumes, and a vessel worth at least 2,000 gp that has a sealable lid and is large enough to hold a Medium creature, such as a huge urn, coffin, mud-filled cyst in the ground, or crystal container filled with salt water."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "A diamond worth at least 1,000 gp and at least 1 cubic inch of flesh of the creature that is to be cloned, which the spell consumes, and a vessel worth at least 2,000 gp that has a sealable lid and is large enough to hold a Medium creature, such as a huge urn, coffin, mud-filled cyst in the ground, or crystal container filled with salt water.",
        "consumed": true,
        "costGp": 3000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "This spell grows an inert duplicate of a living creature as a safeguard against death. This clone forms inside a sealed vessel and grows..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "control-weather": {
    "id": "control-weather",
    "name": "Control Weather",
    "level": 8,
    "school": "transmutation",
    "castingTime": "10 minutes",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "Burning incense and bits of earth and wood mixed in water."
    },
    "duration": "Up to 8 hours",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "wizard"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "Burning incense and bits of earth and wood mixed in water.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You take control of the weather within 5 miles of you for the duration. You must be outdoors to cast this spell. Moving to a place where..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "demiplane": {
    "id": "demiplane",
    "name": "Demiplane",
    "level": 8,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": false,
      "s": true,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": false,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You create a shadowy door on a flat solid surface that you can see within range. The door is large enough to allow Medium creatures to pa..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "dominate-monster": {
    "id": "dominate-monster",
    "name": "Dominate Monster",
    "level": 8,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes charmed. The magic twists a target's attitude or behavior through enchantment. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "charmed"
        }
      ],
      "cantripScaling": null,
      "scaling": {
        "per": "slot",
        "mode": "duration"
      }
    }
  },
  "earthquake": {
    "id": "earthquake",
    "name": "Earthquake",
    "level": 8,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "500 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A pinch of dirt, a piece of rock, and a lump of clay."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "druid",
      "sorcerer"
    ],
    "text": "The spell deals 5d6 bludgeoning damage when its effect lands.",
    "visual": {
      "color": "#9a8f7a",
      "shape": "ward"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A pinch of dirt, a piece of rock, and a lump of clay.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 100,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "feeblemind": {
    "id": "feeblemind",
    "name": "Feeblemind",
    "level": 8,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A handful of clay, crystal, glass, or mineral spheres."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "warlock",
      "wizard"
    ],
    "text": "Creatures make a INT save, taking 4d6 psychic damage on a failed save.",
    "visual": {
      "color": "#d46cff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A handful of clay, crystal, glass, or mineral spheres.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "int",
          "saveEffect": "partial",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "4d6",
              "type": "psychic"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "glibness": {
    "id": "glibness",
    "name": "Glibness",
    "level": 8,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "1 hour",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "warlock"
    ],
    "text": "This transmutation changes matter, movement, or physical capability.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Until the spell ends, when you make a Charisma check, you can replace the number you roll with a 15. Additionally, no matter what you say..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "holy-aura": {
    "id": "holy-aura",
    "name": "Holy Aura",
    "level": 8,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A tiny reliquary worth at least 1,000gp containing a sacred relic, such as a scrap of cloth from a saint's robe or a piece of parchment from a religious text."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "The spell robs the target of sight for the duration or until ended. It also creates or manipulates light in the area. Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "aura"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A tiny reliquary worth at least 1,000gp containing a sacred relic, such as a scrap of cloth from a saint's robe or a piece of parchment from a religious text.",
        "consumed": false,
        "costGp": 1000
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "self",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "incendiary-cloud": {
    "id": "incendiary-cloud",
    "name": "Incendiary Cloud",
    "level": 8,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 20-foot sphere make a DEX save, taking 10d8 fire damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 20,
          "origin": "point",
          "persistent": true,
          "damageOnEnter": {
            "dice": "10d8",
            "type": "fire"
          },
          "damageOnEndTurn": {
            "dice": "10d8",
            "type": "fire"
          }
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "10d8",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "maze": {
    "id": "maze",
    "name": "Maze",
    "level": 8,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 10 minutes",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You banish a creature that you can see within range into a labyrinthine demiplane. The target remains there for the duration or until it..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mind-blank": {
    "id": "mind-blank",
    "name": "Mind Blank",
    "level": 8,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "24 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "wizard"
    ],
    "text": "The magic twists a target's attitude or behavior through enchantment.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Until the spell ends, one willing creature you touch is immune to psychic damage, any effect that would sense its emotions or read its th..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "power-word-stun": {
    "id": "power-word-stun",
    "name": "Power Word Stun",
    "level": 8,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "hp_threshold",
          "max": 150
        },
        {
          "kind": "condition",
          "condition": "stunned"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "sunburst": {
    "id": "sunburst",
    "name": "Sunburst",
    "level": 8,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "150 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "Fire and a piece of sunstone."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "druid",
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 60-foot cylinder make a CON save, taking 12d6 radiant damage on a failed save and half as much on a success. The spell robs the target of sight for the duration or until ended.",
    "visual": {
      "color": "#ffe680",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "Fire and a piece of sunstone.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "cylinder",
          "size": 60,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "half",
          "saveRepeat": "end_of_turn",
          "damage": [
            {
              "dice": "12d6",
              "type": "radiant"
            }
          ],
          "condition": "blinded"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "astral-projection": {
    "id": "astral-projection",
    "name": "Astral Projection",
    "level": 9,
    "school": "necromancy",
    "castingTime": "1 hour",
    "range": "10 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "For each creature you affect with this spell, you must provide one jacinth worth at least 1,000gp and one ornately carved bar of silver worth at least 100gp, all of which the spell consumes."
    },
    "duration": "Special",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "warlock",
      "wizard"
    ],
    "text": "Creatures affected by the spell can be dropped into magical sleep. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "For each creature you affect with this spell, you must provide one jacinth worth at least 1,000gp and one ornately carved bar of silver worth at least 100gp, all of which the spell consumes.",
        "consumed": true,
        "costGp": 1100
      },
      "targets": {
        "count": 8,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You and up to eight willing creatures within range project your astral bodies into the Astral Plane (the spell fails and the casting is w..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "foresight": {
    "id": "foresight",
    "name": "Foresight",
    "level": 9,
    "school": "divination",
    "castingTime": "1 minute",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A hummingbird feather."
    },
    "duration": "8 hours",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "druid",
      "warlock",
      "wizard"
    ],
    "text": "Its main combat value comes from granting advantage or a similar bonus.",
    "visual": {
      "color": "#d6d16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A hummingbird feather.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a willing creature and bestow a limited ability to see into the immediate future. For the duration, the target can't be surpris..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "gate": {
    "id": "gate",
    "name": "Gate",
    "level": 9,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A diamond worth at least 5,000gp."
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "cleric",
      "sorcerer",
      "wizard"
    ],
    "text": "It calls or creates an ally, servant, or magical manifestation to act for you.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A diamond worth at least 5,000gp.",
        "consumed": false,
        "costGp": 5000
      },
      "targets": {
        "count": 1,
        "type": "point"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You conjure a portal linking an unoccupied space you can see within range to a precise location on a different plane of existence. The po..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "imprisonment": {
    "id": "imprisonment",
    "name": "Imprisonment",
    "level": 9,
    "school": "abjuration",
    "castingTime": "1 minute",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A vellum depiction or a carved statuette in the likeness of the target, and a special component that varies according to the version of the spell you choose, worth at least 500gp per Hit Die of the target."
    },
    "duration": "Until dispelled",
    "concentration": false,
    "ritual": false,
    "classes": [
      "warlock",
      "wizard"
    ],
    "text": "A target in range makes a WIS save or becomes restrained. Its main use is rapid repositioning or teleportation. It can end or suppress other magic when its level is high enough.",
    "visual": {
      "color": "#7fb3ff",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "minute",
      "components": {
        "v": true,
        "s": true,
        "m": "A vellum depiction or a carved statuette in the likeness of the target, and a special component that varies according to the version of the spell you choose, worth at least 500gp per Hit Die of the target.",
        "consumed": false,
        "costGp": 500
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "restrained"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "mass-heal": {
    "id": "mass-heal",
    "name": "Mass Heal",
    "level": 9,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric"
    ],
    "text": "The spell robs the target of sight for the duration or until ended.",
    "visual": {
      "color": "#47c8b3",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "heal",
          "dice": null,
          "flat": 700,
          "mod": null
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "meteor-swarm": {
    "id": "meteor-swarm",
    "name": "Meteor Swarm",
    "level": 9,
    "school": "evocation",
    "castingTime": "1 action",
    "range": "1 mile",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "Creatures in a 40-foot sphere make a DEX save, taking 20d6 fire plus 20d6 bludgeoning damage on a failed save and half as much on a success.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "burst"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 40,
          "origin": "point"
        },
        {
          "kind": "save",
          "ability": "dex",
          "saveEffect": "half",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "20d6+20d6",
              "type": "fire"
            }
          ]
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "power-word-kill": {
    "id": "power-word-kill",
    "name": "Power Word Kill",
    "level": 9,
    "school": "enchantment",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "bard",
      "sorcerer",
      "warlock",
      "wizard"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#ff7ac6",
      "shape": "cloud"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "hp_threshold",
          "max": 100
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "prismatic-wall": {
    "id": "prismatic-wall",
    "name": "Prismatic Wall",
    "level": 9,
    "school": "abjuration",
    "castingTime": "1 action",
    "range": "60 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "10 minutes",
    "concentration": false,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "The spell deals 10d6 fire plus 10d6 acid plus 10d6 lightning plus 10d6 poison plus 10d6 cold damage when its effect lands. Repeated failed saves can turn the victim to stone.",
    "visual": {
      "color": "#ff7a1a",
      "shape": "ring"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "line",
          "size": 90,
          "origin": "point",
          "persistent": true
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "shapechange": {
    "id": "shapechange",
    "name": "Shapechange",
    "level": 9,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": true,
      "m": "A jade circlet worth at least 1,500 gp, which you must place on your head before you cast the spell."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid",
      "wizard"
    ],
    "text": "Creatures affected by the spell can be dropped into magical sleep. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "cloud"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A jade circlet worth at least 1,500 gp, which you must place on your head before you cast the spell.",
        "consumed": false,
        "costGp": 1500
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You assume the form of a different creature for the duration. The new form can be of any creature with a challenge rating equal to your l..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "storm-of-vengeance": {
    "id": "storm-of-vengeance",
    "name": "Storm of Vengeance",
    "level": 9,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Sight",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "druid"
    ],
    "text": "Creatures in a 360-foot sphere make a CON save, taking 2d6 thunder plus 1d6 acid plus 10d6 lightning plus 2d6 bludgeoning plus 1d6 cold damage on a failed save.",
    "visual": {
      "color": "#5ad2ff",
      "shape": "bolt"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 360,
          "origin": "point",
          "persistent": true,
          "difficultTerrain": true
        },
        {
          "kind": "save",
          "ability": "con",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "damage": [
            {
              "dice": "2d6",
              "type": "thunder"
            }
          ],
          "condition": "deafened"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "time-stop": {
    "id": "time-stop",
    "name": "Time Stop",
    "level": 9,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You briefly stop the flow of time for everyone but yourself. No time passes for other creatures, while you take 1d4 + 1 turns in a row, d..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "true-polymorph": {
    "id": "true-polymorph",
    "name": "True Polymorph",
    "level": 9,
    "school": "transmutation",
    "castingTime": "1 action",
    "range": "30 feet",
    "components": {
      "v": true,
      "s": true,
      "m": "A drop of mercury, a dollop of gum arabic, and a wisp of smoke."
    },
    "duration": "Up to 1 hour",
    "concentration": true,
    "ritual": false,
    "classes": [
      "bard",
      "warlock",
      "wizard"
    ],
    "text": "Creatures affected by the spell can be dropped into magical sleep. It changes a creature, object, or the environment rather than dealing direct damage.",
    "visual": {
      "color": "#9bd16f",
      "shape": "weapon"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": "A drop of mercury, a dollop of gum arabic, and a wisp of smoke.",
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Choose one creature or nonmagical object that you can see within range. You transform the creature into a different creature, the creatur..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "true-resurrection": {
    "id": "true-resurrection",
    "name": "True Resurrection",
    "level": 9,
    "school": "necromancy",
    "castingTime": "1 hour",
    "range": "Touch",
    "components": {
      "v": true,
      "s": true,
      "m": "A sprinkle of holy water and diamonds worth at least 25,000gp, which the spell consumes."
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "cleric",
      "druid"
    ],
    "text": "This spell is summarized mechanically below; consult the SRD for full edge cases.",
    "visual": {
      "color": "#6d4c8f",
      "shape": "orb"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "hour",
      "components": {
        "v": true,
        "s": true,
        "m": "A sprinkle of holy water and diamonds worth at least 25,000gp, which the spell consumes.",
        "consumed": true,
        "costGp": 25000
      },
      "targets": {
        "count": 1,
        "type": "creature"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "You touch a creature that has been dead for no longer than 200 years and that died for any reason except old age. If the creature's soul..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "weird": {
    "id": "weird",
    "name": "Weird",
    "level": 9,
    "school": "illusion",
    "castingTime": "1 action",
    "range": "120 feet",
    "components": {
      "v": true,
      "s": true,
      "m": null
    },
    "duration": "Up to 1 minute",
    "concentration": true,
    "ritual": false,
    "classes": [
      "wizard"
    ],
    "text": "Creatures in a 30-foot sphere make a WIS save, taking 4d10 psychic damage on a failed save. The magic overwhelms targets with fear if they fail the save or effect.",
    "visual": {
      "color": "#d46cff",
      "shape": "burst"
    },
    "mech": {
      "concentration": true,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": true,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "area"
      },
      "effects": [
        {
          "kind": "area",
          "shape": "sphere",
          "size": 30,
          "origin": "point",
          "persistent": true
        },
        {
          "kind": "save",
          "ability": "wis",
          "saveEffect": "negates",
          "saveRepeat": "none",
          "condition": "frightened"
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  },
  "wish": {
    "id": "wish",
    "name": "Wish",
    "level": 9,
    "school": "conjuration",
    "castingTime": "1 action",
    "range": "Self",
    "components": {
      "v": true,
      "s": false,
      "m": null
    },
    "duration": "Instantaneous",
    "concentration": false,
    "ritual": false,
    "classes": [
      "sorcerer",
      "wizard"
    ],
    "text": "The spell deals 1d10 necrotic damage when its effect lands.",
    "visual": {
      "color": "#5b3b6b",
      "shape": "ward"
    },
    "mech": {
      "concentration": false,
      "ritual": false,
      "castTime": "action",
      "components": {
        "v": true,
        "s": false,
        "m": null,
        "consumed": false,
        "costGp": 0
      },
      "targets": {
        "count": 1,
        "type": "self"
      },
      "effects": [
        {
          "kind": "narrative",
          "summary": "Wish is the mightiest spell a mortal creature can cast. By simply speaking aloud, you can alter the very foundations of reality in accord..."
        }
      ],
      "cantripScaling": null,
      "scaling": null
    }
  }
};
  /**
   * Does this spell do something to an enemy?
   *
   * The shape is `mech.effects[]`, where each effect has a `kind` — attack,
   * save, auto, heal, area, condition — and damaging ones carry a `damage`
   * array. Guessing at top-level `mech.damage` or `mech.attack` fields, which
   * is what two separate callers did, returns false for every spell in the
   * game: Acid Splash and Shocking Grasp both read as harmless, so a
   * generated caster could be handed a repertoire with nothing in it that
   * hurts anybody, and a companion policy never found a spell worth casting.
   *
   * Lives here because this module owns the shape.
   */
  function isOffensive(spell) {
    var fx = (spell && spell.mech && spell.mech.effects) || [];
    for (var i = 0; i < fx.length; i++) {
      var e = fx[i];
      if (!e) continue;
      if (e.damage && e.damage.length) return true;
      if (e.kind === 'attack') return true;
      if (e.kind === 'auto' && e.perDart) return true;
      if (e.kind === 'save' && (e.condition || e.damage)) return true;
      if (e.kind === 'condition' && e.hostile !== false) return true;
    }
    return false;
  }

  /**
   * Does this spell put hit points back?
   *
   * `hp_pool` is deliberately NOT healing: it is Sleep's targeting mechanic —
   * a pool of hit points that decides who drops — and counting it made Sleep
   * read as a healing spell, which is the opposite of what it does.
   */
  function isHealing(spell) {
    var fx = (spell && spell.mech && spell.mech.effects) || [];
    for (var i = 0; i < fx.length; i++) {
      if (fx[i] && fx[i].kind === 'heal') return true;
    }
    return false;
  }

  return { SPELLS: SPELLS, isOffensive: isOffensive, isHealing: isHealing };
});
