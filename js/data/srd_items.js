/**
 * srd_items.js
 * ---------------------------------------------------------------------------
 * D&D 5e SRD 5.1 (2014 ruleset). CC-BY-4.0 — see srd_license.js.
 * SRD 5.1 equipment and magic item reference data, written for direct use in a
 * browser game without a build step. Descriptions are compact original
 * summaries based on SRD 5.1 item entries and tables. No 2024 weapon mastery
 * properties are included; weapon properties are the 2014 set only.
 *
 * `ITEMS[id].mech.type` vocabulary:
 *   ac_bonus            - flat Armor Class bonus. Fields: amount
 *   attack_bonus        - flat attack-roll bonus. Fields: amount
 *   damage_bonus        - flat damage bonus. Fields: amount
 *   saving_throw_bonus  - flat saving throw bonus. Fields: amount
 *   ability_score_set   - sets an ability score to a fixed number. Fields: ability, score
 *   resistance          - grants resistance to a damage type. Fields: damageType
 *   charges             - item uses charges. Fields: max, recharge, spell?
 *   healing             - restores hit points. Fields: dice, bonus
 *   narrative           - mostly descriptive or utility-facing item hook
 *   stat_bonus          - modifies a secondary stat or movement value. Fields vary
 *   other               - complex or mixed-effect item; see extra fields or effects[]
 *
 * Weapons use `mech.weaponCategory` and `mech.range`. Armor uses `armorType`
 * and a structured `ac` object: { base, maxDex, category, stealthDisadvantage,
 * strRequirement } for body armor (maxDex: null means full Dex applies, 0
 * means no Dex bonus applies, a number is the cap), or { mode:'add', value }
 * for shields. AC is never encoded as a prose string.
 * ---------------------------------------------------------------------------
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  root.DND = root.DND || {}; root.DND.Data = root.DND.Data || {};
  Object.assign(root.DND.Data, api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var ITEMS = {
  "abacus": {
    "id": "abacus",
    "name": "Abacus",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "acid-vial": {
    "id": "acid-vial",
    "name": "Acid (vial)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A prepared liquid or chemical useful for travel, trade, or dangerous work.",
    "mech": {
      "type": "other",
      "notes": "As an action, you can splash the contents of this vial onto a creature within 5 feet of you or throw the vial up to 20 feet, shattering it on impact. In either case, make a ranged attack against a creature or object, treating the acid as an improvised weapon."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "alchemists-fire-flask": {
    "id": "alchemists-fire-flask",
    "name": "Alchemist's fire (flask)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A prepared liquid or chemical useful for travel, trade, or dangerous work.",
    "mech": {
      "type": "other",
      "notes": "This sticky, adhesive fluid ignites when exposed to air."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "alchemists-supplies": {
    "id": "alchemists-supplies",
    "name": "Alchemist's Supplies",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "alms-box": {
    "id": "alms-box",
    "name": "Alms box",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A small box for alms, typically found in a priest's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "amulet": {
    "id": "amulet",
    "name": "Amulet",
    "category": "gear",
    "subcategory": "holy-symbol",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A sacred symbol commonly displayed or held as a divine focus.",
    "mech": {
      "type": "other",
      "notes": "A holy symbol is a representation of a god or pantheon. It might be an amulet depicting a symbol representing a deity, the same symbol carefully engraved or inlaid as an emblem on a shield, or a tiny box holding a fragment of a sacred relic."
    },
    "visual": {
      "palette": [
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "animal-feed-1-day": {
    "id": "animal-feed-1-day",
    "name": "Animal Feed (1 day)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Packed food meant to keep people or beasts moving on the road.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "antitoxin-vial": {
    "id": "antitoxin-vial",
    "name": "Antitoxin (vial)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A prepared liquid or chemical useful for travel, trade, or dangerous work.",
    "mech": {
      "type": "other",
      "notes": "A creature that drinks this vial of liquid gains advantage on saving throws against poison for 1 hour. It confers no benefit to undead or constructs."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "arrow": {
    "id": "arrow",
    "name": "Arrow",
    "category": "gear",
    "subcategory": "ammunition",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "backpack": {
    "id": "backpack",
    "name": "Backpack",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "bagpipes": {
    "id": "bagpipes",
    "name": "Bagpipes",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "ball-bearings-bag-of-1000": {
    "id": "ball-bearings-bag-of-1000",
    "name": "Ball bearings (bag of 1,000)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "As an action, you can spill these tiny metal balls from their pouch to cover a level, square area that is 10 feet on a side."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-breastplate": {
    "id": "barding-breastplate",
    "name": "Barding: Breastplate",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 1600,
      "unit": "gp"
    },
    "weight": 40,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-chain-mail": {
    "id": "barding-chain-mail",
    "name": "Barding: Chain mail",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 300,
      "unit": "gp"
    },
    "weight": 110,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-chain-shirt": {
    "id": "barding-chain-shirt",
    "name": "Barding: Chain shirt",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 200,
      "unit": "gp"
    },
    "weight": 40,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-half-plate": {
    "id": "barding-half-plate",
    "name": "Barding: Half plate",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 3000,
      "unit": "gp"
    },
    "weight": 80,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-hide": {
    "id": "barding-hide",
    "name": "Barding: Hide",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 40,
      "unit": "gp"
    },
    "weight": 24,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-leather": {
    "id": "barding-leather",
    "name": "Barding: Leather",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 40,
      "unit": "gp"
    },
    "weight": 20,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-padded": {
    "id": "barding-padded",
    "name": "Barding: Padded",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 16,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-plate": {
    "id": "barding-plate",
    "name": "Barding: Plate",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 6000,
      "unit": "gp"
    },
    "weight": 130,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-ring-mail": {
    "id": "barding-ring-mail",
    "name": "Barding: Ring mail",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 12,
      "unit": "gp"
    },
    "weight": 80,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-scale-mail": {
    "id": "barding-scale-mail",
    "name": "Barding: Scale mail",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 200,
      "unit": "gp"
    },
    "weight": 90,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-splint": {
    "id": "barding-splint",
    "name": "Barding: Splint",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 800,
      "unit": "gp"
    },
    "weight": 120,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barding-studded-leather": {
    "id": "barding-studded-leather",
    "name": "Barding: Studded Leather",
    "category": "gear",
    "subcategory": "barding",
    "cost": {
      "qty": 180,
      "unit": "gp"
    },
    "weight": 26,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Barding is armor designed to protect an animal's head, neck, chest, and body. Any type of armor shown on the Armor table can be purchased as barding. The cost is four times the equivalent armor made for humanoids, and it weighs twice as much.",
      "mountArmor": true,
      "baseAC": null,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "barrel": {
    "id": "barrel",
    "name": "Barrel",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 70,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "basket": {
    "id": "basket",
    "name": "Basket",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 4,
      "unit": "sp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "battleaxe": {
    "id": "battleaxe",
    "name": "Battleaxe",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": "1d10",
      "type": "slashing"
    },
    "properties": [
      "versatile"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#aeb5bf",
        "#6b4d2e"
      ],
      "iconShape": "axe",
      "glow": false,
      "notes": "broad crescent axehead on a sturdy haft"
    }
  },
  "bedroll": {
    "id": "bedroll",
    "name": "Bedroll",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 7,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "bell": {
    "id": "bell",
    "name": "Bell",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "bit-and-bridle": {
    "id": "bit-and-bridle",
    "name": "Bit and bridle",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "blanket": {
    "id": "blanket",
    "name": "Blanket",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "block-and-tackle": {
    "id": "block-and-tackle",
    "name": "Block and tackle",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A set of pulleys with a cable threaded through them and a hook to attach to objects, a block and tackle allows you to hoist up to four times the weight you can normally lift."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "block-of-incense": {
    "id": "block-of-incense",
    "name": "Block of incense",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A block of incense, typically found in a priest's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "blowgun": {
    "id": "blowgun",
    "name": "Blowgun",
    "category": "weapon",
    "subcategory": "martial-ranged",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "loading"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 25,
        "long": 100
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "narrow tube for quiet needle shots"
    }
  },
  "blowgun-needle": {
    "id": "blowgun-needle",
    "name": "Blowgun needle",
    "category": "gear",
    "subcategory": "ammunition",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "book": {
    "id": "book",
    "name": "Book",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A writing or record-keeping supply valued by scholars, clerks, and travelers.",
    "mech": {
      "type": "other",
      "notes": "A book might contain poetry, historical accounts, information pertaining to a particular field of lore, diagrams and notes on gnomish contraptions, or just about anything else that can be represented using text or pictures. A book of spells is a spellbook (described later in this section)."
    },
    "visual": {
      "palette": [
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "bottle-glass": {
    "id": "bottle-glass",
    "name": "Bottle, glass",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "breastplate": {
    "id": "breastplate",
    "name": "Breastplate",
    "category": "armor",
    "subcategory": "medium",
    "cost": {
      "qty": 400,
      "unit": "gp"
    },
    "weight": 20,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 14,
      "maxDex": 2,
      "category": "medium",
      "stealthDisadvantage": false,
      "strRequirement": null
    },
    "armorType": "medium",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 14,
      "dexBonus": "max2",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "fitted metal cuirass with lighter limb guards"
    }
  },
  "brewers-supplies": {
    "id": "brewers-supplies",
    "name": "Brewer's Supplies",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 9,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "bucket": {
    "id": "bucket",
    "name": "Bucket",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "burglars-pack": {
    "id": "burglars-pack",
    "name": "Burglar's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 16,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "ball-bearings-bag-of-1000",
          "qty": 1
        },
        {
          "id": "string-10-feet",
          "qty": 1
        },
        {
          "id": "bell",
          "qty": 1
        },
        {
          "id": "candle",
          "qty": 5
        },
        {
          "id": "crowbar",
          "qty": 1
        },
        {
          "id": "hammer",
          "qty": 1
        },
        {
          "id": "piton",
          "qty": 10
        },
        {
          "id": "lantern-hooded",
          "qty": 1
        },
        {
          "id": "oil-flask",
          "qty": 2
        },
        {
          "id": "rations-1-day",
          "qty": 5
        },
        {
          "id": "tinderbox",
          "qty": 1
        },
        {
          "id": "waterskin",
          "qty": 1
        },
        {
          "id": "rope-hempen-50-feet",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "calligraphers-supplies": {
    "id": "calligraphers-supplies",
    "name": "Calligrapher's Supplies",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "caltrops": {
    "id": "caltrops",
    "name": "Caltrops",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A small tactical item that can hinder movement or punish careless steps.",
    "mech": {
      "type": "other",
      "notes": "As an action, you can spread a bag of caltrops to cover a square area that is 5 feet on a side."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "camel": {
    "id": "camel",
    "name": "Camel",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 50,
        "unit": "ft/round"
      },
      "capacity": "480 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "candle": {
    "id": "candle",
    "name": "Candle",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A reliable source of light for caverns, night watches, and dark ruins.",
    "mech": {
      "type": "other",
      "notes": "For 1 hour, a candle sheds bright light in a 5-foot radius and dim light for an additional 5 feet."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "carpenters-tools": {
    "id": "carpenters-tools",
    "name": "Carpenter's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 8,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "carriage": {
    "id": "carriage",
    "name": "Carriage",
    "category": "vehicle",
    "subcategory": "land-vehicle",
    "cost": {
      "qty": 100,
      "unit": "gp"
    },
    "weight": 600,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "cart": {
    "id": "cart",
    "name": "Cart",
    "category": "vehicle",
    "subcategory": "land-vehicle",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 200,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "cartographers-tools": {
    "id": "cartographers-tools",
    "name": "Cartographer's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "case-crossbow-bolt": {
    "id": "case-crossbow-bolt",
    "name": "Case, crossbow bolt",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "This wooden case can hold up to twenty crossbow bolts."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "case-map-or-scroll": {
    "id": "case-map-or-scroll",
    "name": "Case, map or scroll",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "This cylindrical leather case can hold up to ten rolled-up sheets of paper or five rolled-up sheets of parchment."
    },
    "visual": {
      "palette": [
        "#e8dfbf",
        "#8a6a3a"
      ],
      "iconShape": "scroll",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "censer": {
    "id": "censer",
    "name": "Censer",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A censer, typically found in a priest's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "chain-10-feet": {
    "id": "chain-10-feet",
    "name": "Chain (10 feet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "A chain has 10 hit points. It can be burst with a successful DC 20 Strength check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "chain-mail": {
    "id": "chain-mail",
    "name": "Chain Mail",
    "category": "armor",
    "subcategory": "heavy",
    "cost": {
      "qty": 75,
      "unit": "gp"
    },
    "weight": 55,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 16,
      "maxDex": 0,
      "category": "heavy",
      "stealthDisadvantage": true,
      "strRequirement": 13
    },
    "armorType": "heavy",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 16,
      "dexBonus": "none",
      "strRequirement": 13,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "full suit of linked metal rings"
    }
  },
  "chain-shirt": {
    "id": "chain-shirt",
    "name": "Chain Shirt",
    "category": "armor",
    "subcategory": "medium",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 20,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 13,
      "maxDex": 2,
      "category": "medium",
      "stealthDisadvantage": false,
      "strRequirement": null
    },
    "armorType": "medium",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 13,
      "dexBonus": "max2",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "interlocking mail shirt worn over padding"
    }
  },
  "chalk-1-piece": {
    "id": "chalk-1-piece",
    "name": "Chalk (1 piece)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "chariot": {
    "id": "chariot",
    "name": "Chariot",
    "category": "vehicle",
    "subcategory": "land-vehicle",
    "cost": {
      "qty": 250,
      "unit": "gp"
    },
    "weight": 100,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "chest": {
    "id": "chest",
    "name": "Chest",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 25,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "climbers-kit": {
    "id": "climbers-kit",
    "name": "Climber's Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 12,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "A climber's kit includes special pitons, boot tips, gloves, and a harness. You can use the climber's kit as an action to anchor yourself; when you do, you can't fall more than 25 feet from the point where you anchored yourself, and you can't climb more than 25 feet away from that point without undoing the anchor."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "clothes-common": {
    "id": "clothes-common",
    "name": "Clothes, common",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A set of garments suited to its station, purpose, and wear on the road.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "clothes-costume": {
    "id": "clothes-costume",
    "name": "Clothes, costume",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A set of garments suited to its station, purpose, and wear on the road.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "clothes-fine": {
    "id": "clothes-fine",
    "name": "Clothes, fine",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A set of garments suited to its station, purpose, and wear on the road.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "clothes-travelers": {
    "id": "clothes-travelers",
    "name": "Clothes, traveler's",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A set of garments suited to its station, purpose, and wear on the road.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "club": {
    "id": "club",
    "name": "Club",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "light",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "knotted hardwood cudgel"
    }
  },
  "cobblers-tools": {
    "id": "cobblers-tools",
    "name": "Cobbler's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "component-pouch": {
    "id": "component-pouch",
    "name": "Component pouch",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "A component pouch is a small, watertight leather belt pouch that has compartments to hold all the material components and other special items you need to cast your spells, except for those components that have a specific cost (as indicated in a spell's description)."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "cooks-utensils": {
    "id": "cooks-utensils",
    "name": "Cook's utensils",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "crossbow-bolt": {
    "id": "crossbow-bolt",
    "name": "Crossbow bolt",
    "category": "gear",
    "subcategory": "ammunition",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1.5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "crossbow-hand": {
    "id": "crossbow-hand",
    "name": "Crossbow, hand",
    "category": "weapon",
    "subcategory": "martial-ranged",
    "cost": {
      "qty": 75,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "light",
      "loading"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 30,
        "long": 120
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "crossbow-heavy": {
    "id": "crossbow-heavy",
    "name": "Crossbow, heavy",
    "category": "weapon",
    "subcategory": "martial-ranged",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 18,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d10",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "heavy",
      "loading",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 100,
        "long": 400
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "crossbow-light": {
    "id": "crossbow-light",
    "name": "Crossbow, light",
    "category": "weapon",
    "subcategory": "simple-ranged",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "loading",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 80,
        "long": 320
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "crowbar": {
    "id": "crowbar",
    "name": "Crowbar",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Using a crowbar grants advantage to Strength checks where the crowbar's leverage can be applied."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "crystal": {
    "id": "crystal",
    "name": "Crystal",
    "category": "gear",
    "subcategory": "arcane-focus",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "An arcane focus is a special item--an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item--designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "dagger": {
    "id": "dagger",
    "name": "Dagger",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "finesse",
      "light",
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "compact triangular blade with a narrow grip"
    }
  },
  "dart": {
    "id": "dart",
    "name": "Dart",
    "category": "weapon",
    "subcategory": "simple-ranged",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 0.25,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "finesse",
      "thrown"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 20,
        "long": 60
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "slender fletched throwing dart"
    }
  },
  "dice-set": {
    "id": "dice-set",
    "name": "Dice Set",
    "category": "tool",
    "subcategory": "gaming-set",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A compact set for gambling, leisure, or passing long hours in camp.",
    "mech": {
      "type": "narrative",
      "toolType": "gaming-set",
      "notes": "This item encompasses a wide range of game pieces, including dice and decks of cards (for games such as Three-Dragon Ante). A few common examples appear on the Tools table, but other kinds of gaming sets exist. If you are proficient with a gaming set, you can add your proficiency bonus to ability checks you make to play a game with that set. Each type of gaming set requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "diplomats-pack": {
    "id": "diplomats-pack",
    "name": "Diplomat's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 39,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "chest",
          "qty": 1
        },
        {
          "id": "case-map-or-scroll",
          "qty": 2
        },
        {
          "id": "clothes-fine",
          "qty": 1
        },
        {
          "id": "ink-1-ounce-bottle",
          "qty": 1
        },
        {
          "id": "ink-pen",
          "qty": 1
        },
        {
          "id": "lamp",
          "qty": 1
        },
        {
          "id": "oil-flask",
          "qty": 2
        },
        {
          "id": "paper-one-sheet",
          "qty": 5
        },
        {
          "id": "perfume-vial",
          "qty": 1
        },
        {
          "id": "sealing-wax",
          "qty": 1
        },
        {
          "id": "soap",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "disguise-kit": {
    "id": "disguise-kit",
    "name": "Disguise Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "This pouch of cosmetics, hair dye, and small props lets you create disguises that change your physical appearance. Proficiency with this kit lets you add your proficiency bonus to any ability checks you make to create a visual disguise."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "donkey": {
    "id": "donkey",
    "name": "Donkey",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 8,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "420 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "drum": {
    "id": "drum",
    "name": "Drum",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 6,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "dulcimer": {
    "id": "dulcimer",
    "name": "Dulcimer",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "dungeoneers-pack": {
    "id": "dungeoneers-pack",
    "name": "Dungeoneer's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 12,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "crowbar",
          "qty": 1
        },
        {
          "id": "hammer",
          "qty": 1
        },
        {
          "id": "piton",
          "qty": 10
        },
        {
          "id": "torch",
          "qty": 10
        },
        {
          "id": "tinderbox",
          "qty": 1
        },
        {
          "id": "rations-1-day",
          "qty": 10
        },
        {
          "id": "waterskin",
          "qty": 1
        },
        {
          "id": "rope-hempen-50-feet",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "elephant": {
    "id": "elephant",
    "name": "Elephant",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 200,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "1,320 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "emblem": {
    "id": "emblem",
    "name": "Emblem",
    "category": "gear",
    "subcategory": "holy-symbol",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A sacred symbol commonly displayed or held as a divine focus.",
    "mech": {
      "type": "other",
      "notes": "A holy symbol is a representation of a god or pantheon. It might be an amulet depicting a symbol representing a deity, the same symbol carefully engraved or inlaid as an emblem on a shield, or a tiny box holding a fragment of a sacred relic."
    },
    "visual": {
      "palette": [
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "entertainers-pack": {
    "id": "entertainers-pack",
    "name": "Entertainer's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 40,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "bedroll",
          "qty": 1
        },
        {
          "id": "clothes-costume",
          "qty": 2
        },
        {
          "id": "candle",
          "qty": 5
        },
        {
          "id": "rations-1-day",
          "qty": 5
        },
        {
          "id": "waterskin",
          "qty": 1
        },
        {
          "id": "disguise-kit",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "explorers-pack": {
    "id": "explorers-pack",
    "name": "Explorer's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "bedroll",
          "qty": 1
        },
        {
          "id": "mess-kit",
          "qty": 1
        },
        {
          "id": "tinderbox",
          "qty": 1
        },
        {
          "id": "torch",
          "qty": 10
        },
        {
          "id": "rations-1-day",
          "qty": 10
        },
        {
          "id": "waterskin",
          "qty": 1
        },
        {
          "id": "rope-hempen-50-feet",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "fishing-tackle": {
    "id": "fishing-tackle",
    "name": "Fishing tackle",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "This kit includes a wooden rod, silken line, corkwood bobbers, steel hooks, lead sinkers, velvet lures, and narrow netting."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "flail": {
    "id": "flail",
    "name": "Flail",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "weighted striking head on a swinging chain"
    }
  },
  "flask-or-tankard": {
    "id": "flask-or-tankard",
    "name": "Flask or tankard",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "flute": {
    "id": "flute",
    "name": "Flute",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "forgery-kit": {
    "id": "forgery-kit",
    "name": "Forgery Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "This small box contains a variety of papers and parchments, pens and inks, seals and sealing wax, gold and silver leaf, and other supplies necessary to create convincing forgeries of physical documents. Proficiency with this kit lets you add your proficiency bonus to any ability checks you make to create a physical forgery of a document."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "galley": {
    "id": "galley",
    "name": "Galley",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 30000,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 4,
        "unit": "mph"
      }
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "glaive": {
    "id": "glaive",
    "name": "Glaive",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d10",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "heavy",
      "reach",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "long polearm tipped with a sweeping blade"
    }
  },
  "glassblowers-tools": {
    "id": "glassblowers-tools",
    "name": "Glassblower's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "grappling-hook": {
    "id": "grappling-hook",
    "name": "Grappling hook",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "greataxe": {
    "id": "greataxe",
    "name": "Greataxe",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 7,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d12",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "heavy",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#aeb5bf",
        "#6b4d2e"
      ],
      "iconShape": "axe",
      "glow": false,
      "notes": "massive double-bit axe for brutal swings"
    }
  },
  "greatclub": {
    "id": "greatclub",
    "name": "Greatclub",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 2,
      "unit": "sp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "thick two-handed bludgeon of dense wood"
    }
  },
  "greatsword": {
    "id": "greatsword",
    "name": "Greatsword",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "2d6",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "heavy",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "two-handed blade with a long fuller"
    }
  },
  "halberd": {
    "id": "halberd",
    "name": "Halberd",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d10",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "heavy",
      "reach",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#aeb5bf",
        "#6b4d2e"
      ],
      "iconShape": "axe",
      "glow": false,
      "notes": "axe-blade, hook, and spike on a long pole"
    }
  },
  "half-plate-armor": {
    "id": "half-plate-armor",
    "name": "Half Plate Armor",
    "category": "armor",
    "subcategory": "medium",
    "cost": {
      "qty": 750,
      "unit": "gp"
    },
    "weight": 40,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 15,
      "maxDex": 2,
      "category": "medium",
      "stealthDisadvantage": true,
      "strRequirement": null
    },
    "armorType": "medium",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 15,
      "dexBonus": "max2",
      "strRequirement": null,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "partial plate over a mail and leather base"
    }
  },
  "hammer": {
    "id": "hammer",
    "name": "Hammer",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "hammer-sledge": {
    "id": "hammer-sledge",
    "name": "Hammer, sledge",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "handaxe": {
    "id": "handaxe",
    "name": "Handaxe",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "light",
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#aeb5bf",
        "#6b4d2e"
      ],
      "iconShape": "axe",
      "glow": false,
      "notes": "single-bit throwing axe with a short haft"
    }
  },
  "healers-kit": {
    "id": "healers-kit",
    "name": "Healer's Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "This kit is a leather pouch containing bandages, salves, and splints. The kit has ten uses. As an action, you can expend one use of the kit to stabilize a creature that has 0 hit points, without needing to make a Wisdom (Medicine) check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "herbalism-kit": {
    "id": "herbalism-kit",
    "name": "Herbalism Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "This kit contains a variety of instruments such as clippers, mortar and pestle, and pouches and vials used by herbalists to create remedies and potions. Proficiency with this kit lets you add your proficiency bonus to any ability checks you make to identify or apply herbs. Also, proficiency with this kit is required to create antitoxin and potions of healing."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "hide-armor": {
    "id": "hide-armor",
    "name": "Hide Armor",
    "category": "armor",
    "subcategory": "medium",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 12,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 12,
      "maxDex": 2,
      "category": "medium",
      "stealthDisadvantage": false,
      "strRequirement": null
    },
    "armorType": "medium",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 12,
      "dexBonus": "max2",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "cured hides lashed into rugged panels"
    }
  },
  "holy-water-flask": {
    "id": "holy-water-flask",
    "name": "Holy water (flask)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Consecrated water prized against unholy creatures and dark rites.",
    "mech": {
      "type": "other",
      "notes": "As an action, you can splash the contents of this flask onto a creature within 5 feet of you or throw it up to 20 feet, shattering it on impact. In either case, make a ranged attack against a target creature, treating the holy water as an improvised weapon."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "horn": {
    "id": "horn",
    "name": "Horn",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 3,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "horse-draft": {
    "id": "horse-draft",
    "name": "Horse, draft",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "540 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "horse-riding": {
    "id": "horse-riding",
    "name": "Horse, riding",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 75,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 60,
        "unit": "ft/round"
      },
      "capacity": "480 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "hourglass": {
    "id": "hourglass",
    "name": "Hourglass",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "hunting-trap": {
    "id": "hunting-trap",
    "name": "Hunting trap",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 25,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A small tactical item that can hinder movement or punish careless steps.",
    "mech": {
      "type": "other",
      "notes": "When you use your action to set it, this trap forms a saw-toothed steel ring that snaps shut when a creature steps on a pressure plate in the center. The trap is affixed by a heavy chain to an immobile object, such as a tree or a spike driven into the ground."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "ink-1-ounce-bottle": {
    "id": "ink-1-ounce-bottle",
    "name": "Ink (1 ounce bottle)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "ink-pen": {
    "id": "ink-pen",
    "name": "Ink pen",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A writing or record-keeping supply valued by scholars, clerks, and travelers.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "javelin": {
    "id": "javelin",
    "name": "Javelin",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "light spear balanced for throwing"
    }
  },
  "jewelers-tools": {
    "id": "jewelers-tools",
    "name": "Jeweler's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "jug-or-pitcher": {
    "id": "jug-or-pitcher",
    "name": "Jug or pitcher",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "keelboat": {
    "id": "keelboat",
    "name": "Keelboat",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 3000,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 1,
        "unit": "mph"
      },
      "notes": "Keelboats and rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A rowboat weighs 100 pounds, in case adventurers carry it over land."
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "ladder-10-foot": {
    "id": "ladder-10-foot",
    "name": "Ladder (10-foot)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 25,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "lamp": {
    "id": "lamp",
    "name": "Lamp",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A reliable source of light for caverns, night watches, and dark ruins.",
    "mech": {
      "type": "other",
      "notes": "A lamp casts bright light in a 15-foot radius and dim light for an additional 30 feet. Once lit, it burns for 6 hours on a flask (1 pint) of oil."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "lance": {
    "id": "lance",
    "name": "Lance",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d12",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "reach",
      "special"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "heavy cavalry lance with a reinforced tip"
    }
  },
  "lantern-bullseye": {
    "id": "lantern-bullseye",
    "name": "Lantern, bullseye",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A reliable source of light for caverns, night watches, and dark ruins.",
    "mech": {
      "type": "other",
      "notes": "A bullseye lantern casts bright light in a 60-foot cone and dim light for an additional 60 feet. Once lit, it burns for 6 hours on a flask (1 pint) of oil."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "lantern-hooded": {
    "id": "lantern-hooded",
    "name": "Lantern, hooded",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A reliable source of light for caverns, night watches, and dark ruins.",
    "mech": {
      "type": "other",
      "notes": "A hooded lantern casts bright light in a 30-foot radius and dim light for an additional 30 feet. Once lit, it burns for 6 hours on a flask (1 pint) of oil. As an action, you can lower the hood, reducing the light to dim light in a 5-foot radius."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "leather-armor": {
    "id": "leather-armor",
    "name": "Leather Armor",
    "category": "armor",
    "subcategory": "light",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 11,
      "maxDex": null,
      "category": "light",
      "stealthDisadvantage": false,
      "strRequirement": null
    },
    "armorType": "light",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 11,
      "dexBonus": "full",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "hardened leather jerkin and shoulder guards"
    }
  },
  "leatherworkers-tools": {
    "id": "leatherworkers-tools",
    "name": "Leatherworker's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "light-hammer": {
    "id": "light-hammer",
    "name": "Light hammer",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "light",
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "stubby hammerhead on a compact haft"
    }
  },
  "little-bag-of-sand": {
    "id": "little-bag-of-sand",
    "name": "Little bag of sand",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "A small bag of sand, typically found in a scholar's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "lock": {
    "id": "lock",
    "name": "Lock",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A key is provided with the lock. Without the key, a creature proficient with thieves' tools can pick this lock with a successful DC 15 Dexterity check. Your GM may decide that better locks are available for higher prices."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "longbow": {
    "id": "longbow",
    "name": "Longbow",
    "category": "weapon",
    "subcategory": "martial-ranged",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "heavy",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 150,
        "long": 600
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "tall war bow with a powerful draw"
    }
  },
  "longship": {
    "id": "longship",
    "name": "Longship",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 10000,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 3,
        "unit": "mph"
      }
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "longsword": {
    "id": "longsword",
    "name": "Longsword",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": "1d10",
      "type": "slashing"
    },
    "properties": [
      "versatile"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "straight double-edged blade with a leather grip"
    }
  },
  "lute": {
    "id": "lute",
    "name": "Lute",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 35,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "lyre": {
    "id": "lyre",
    "name": "Lyre",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "mace": {
    "id": "mace",
    "name": "Mace",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "flanged iron head built to crush armor"
    }
  },
  "magnifying-glass": {
    "id": "magnifying-glass",
    "name": "Magnifying glass",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 100,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "This lens allows a closer look at small objects. It is also useful as a substitute for flint and steel when starting fires. Lighting a fire with a magnifying glass requires light as bright as sunlight to focus, tinder to ignite, and about 5 minutes for the fire to ignite."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "manacles": {
    "id": "manacles",
    "name": "Manacles",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "These metal restraints can bind a Small or Medium creature. Escaping the manacles requires a successful DC 20 Dexterity check. Breaking them requires a successful DC 20 Strength check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "masons-tools": {
    "id": "masons-tools",
    "name": "Mason's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "mastiff": {
    "id": "mastiff",
    "name": "Mastiff",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "195 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "maul": {
    "id": "maul",
    "name": "Maul",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "2d6",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "heavy",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "great hammer with oversized metal heads"
    }
  },
  "mess-kit": {
    "id": "mess-kit",
    "name": "Mess Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 2,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "This tin box contains a cup and simple cutlery. The box clamps together, and one side can be used as a cooking pan and the other as a plate or shallow bowl."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "mirror-steel": {
    "id": "mirror-steel",
    "name": "Mirror, steel",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 0.5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "morningstar": {
    "id": "morningstar",
    "name": "Morningstar",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "spiked iron ball fixed to a short haft"
    }
  },
  "mule": {
    "id": "mule",
    "name": "Mule",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 8,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "420 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "navigators-tools": {
    "id": "navigators-tools",
    "name": "Navigator's Tools",
    "category": "tool",
    "subcategory": "other-tool",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "other-tool",
      "notes": "This set of instruments is used for navigation at sea. Proficiency with navigator's tools lets you chart a ship's course and follow navigation charts. In addition, these tools allow you to add your proficiency bonus to any ability check you make to avoid getting lost at sea."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "net": {
    "id": "net",
    "name": "Net",
    "category": "weapon",
    "subcategory": "martial-ranged",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": null,
      "versatileDice": null,
      "type": null
    },
    "properties": [
      "thrown",
      "special"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5,
        "long": 15
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "weighted casting net with lead lines"
    }
  },
  "oil-flask": {
    "id": "oil-flask",
    "name": "Oil (flask)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A prepared liquid or chemical useful for travel, trade, or dangerous work.",
    "mech": {
      "type": "other",
      "notes": "Oil usually comes in a clay flask that holds 1 pint."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "orb": {
    "id": "orb",
    "name": "Orb",
    "category": "gear",
    "subcategory": "arcane-focus",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "An arcane focus is a special item--an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item--designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "padded-armor": {
    "id": "padded-armor",
    "name": "Padded Armor",
    "category": "armor",
    "subcategory": "light",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 11,
      "maxDex": null,
      "category": "light",
      "stealthDisadvantage": true,
      "strRequirement": null
    },
    "armorType": "light",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 11,
      "dexBonus": "full",
      "strRequirement": null,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "quilted layers stitched for basic padding"
    }
  },
  "painters-supplies": {
    "id": "painters-supplies",
    "name": "Painter's Supplies",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "pan-flute": {
    "id": "pan-flute",
    "name": "Pan flute",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 12,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "paper-one-sheet": {
    "id": "paper-one-sheet",
    "name": "Paper (one sheet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A writing or record-keeping supply valued by scholars, clerks, and travelers.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "parchment-one-sheet": {
    "id": "parchment-one-sheet",
    "name": "Parchment (one sheet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A writing or record-keeping supply valued by scholars, clerks, and travelers.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "perfume-vial": {
    "id": "perfume-vial",
    "name": "Perfume (vial)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A prepared liquid or chemical useful for travel, trade, or dangerous work.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "pick-miners": {
    "id": "pick-miners",
    "name": "Pick, miner's",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "pike": {
    "id": "pike",
    "name": "Pike",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 18,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d10",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "heavy",
      "reach",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "extra-long spear meant for keeping foes at bay"
    }
  },
  "piton": {
    "id": "piton",
    "name": "Piton",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 0.25,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "plate-armor": {
    "id": "plate-armor",
    "name": "Plate Armor",
    "category": "armor",
    "subcategory": "heavy",
    "cost": {
      "qty": 1500,
      "unit": "gp"
    },
    "weight": 65,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 18,
      "maxDex": 0,
      "category": "heavy",
      "stealthDisadvantage": true,
      "strRequirement": 15
    },
    "armorType": "heavy",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 18,
      "dexBonus": "none",
      "strRequirement": 15,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "fully articulated steel plates and buckles"
    }
  },
  "playing-card-set": {
    "id": "playing-card-set",
    "name": "Playing Card Set",
    "category": "tool",
    "subcategory": "gaming-set",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A compact set for gambling, leisure, or passing long hours in camp.",
    "mech": {
      "type": "narrative",
      "toolType": "gaming-set",
      "notes": "This item encompasses a wide range of game pieces, including dice and decks of cards (for games such as Three-Dragon Ante). A few common examples appear on the Tools table, but other kinds of gaming sets exist. If you are proficient with a gaming set, you can add your proficiency bonus to ability checks you make to play a game with that set. Each type of gaming set requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "poison-basic-vial": {
    "id": "poison-basic-vial",
    "name": "Poison, basic (vial)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 100,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "You can use the poison in this vial to coat one slashing or piercing weapon or up to three pieces of ammunition. Applying the poison takes an action. A creature hit by the poisoned weapon or ammunition must make a DC 10 Constitution saving throw or take 1d4 poison damage. Once applied, the poison retains potency for 1 minute before drying."
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "poisoners-kit": {
    "id": "poisoners-kit",
    "name": "Poisoner's Kit",
    "category": "tool",
    "subcategory": "kit",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "kit",
      "notes": "A poisoner's kit includes the vials, chemicals, and other equipment necessary for the creation of poisons. Proficiency with this kit lets you add your proficiency bonus to any ability checks you make to craft or use poisons."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "pole-10-foot": {
    "id": "pole-10-foot",
    "name": "Pole (10-foot)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 7,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "pony": {
    "id": "pony",
    "name": "Pony",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 40,
        "unit": "ft/round"
      },
      "capacity": "225 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "pot-iron": {
    "id": "pot-iron",
    "name": "Pot, iron",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "potters-tools": {
    "id": "potters-tools",
    "name": "Potter's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "pouch": {
    "id": "pouch",
    "name": "Pouch",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other",
      "notes": "A cloth or leather pouch can hold up to 20 sling bullets or 50 blowgun needles, among other things. A compartmentalized pouch for holding spell components is called a component pouch (described earlier in this section)."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "priests-pack": {
    "id": "priests-pack",
    "name": "Priest's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 19,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "blanket",
          "qty": 1
        },
        {
          "id": "candle",
          "qty": 10
        },
        {
          "id": "tinderbox",
          "qty": 1
        },
        {
          "id": "rations-1-day",
          "qty": 2
        },
        {
          "id": "waterskin",
          "qty": 1
        },
        {
          "id": "alms-box",
          "qty": 1
        },
        {
          "id": "block-of-incense",
          "qty": 2
        },
        {
          "id": "censer",
          "qty": 1
        },
        {
          "id": "vestments",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "quarterstaff": {
    "id": "quarterstaff",
    "name": "Quarterstaff",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 2,
      "unit": "sp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": "1d8",
      "type": "bludgeoning"
    },
    "properties": [
      "versatile",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "smooth seasoned walking staff"
    }
  },
  "quiver": {
    "id": "quiver",
    "name": "Quiver",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A quiver can hold up to 20 arrows."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "ram-portable": {
    "id": "ram-portable",
    "name": "Ram, portable",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 4,
      "unit": "gp"
    },
    "weight": 35,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "You can use a portable ram to break down doors. When doing so, you gain a +4 bonus on the Strength check. One other character can help you use the ram, giving you advantage on this check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "rapier": {
    "id": "rapier",
    "name": "Rapier",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "finesse"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "slender thrusting sword with a swept hilt"
    }
  },
  "rations-1-day": {
    "id": "rations-1-day",
    "name": "Rations (1 day)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Packed food meant to keep people or beasts moving on the road.",
    "mech": {
      "type": "other",
      "notes": "Rations consist of dry foods suitable for extended travel, including jerky, dried fruit, hardtack, and nuts."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "reliquary": {
    "id": "reliquary",
    "name": "Reliquary",
    "category": "gear",
    "subcategory": "holy-symbol",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A sacred symbol commonly displayed or held as a divine focus.",
    "mech": {
      "type": "other",
      "notes": "A holy symbol is a representation of a god or pantheon. It might be an amulet depicting a symbol representing a deity, the same symbol carefully engraved or inlaid as an emblem on a shield, or a tiny box holding a fragment of a sacred relic."
    },
    "visual": {
      "palette": [
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "ring-mail": {
    "id": "ring-mail",
    "name": "Ring Mail",
    "category": "armor",
    "subcategory": "heavy",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 40,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 14,
      "maxDex": 0,
      "category": "heavy",
      "stealthDisadvantage": true,
      "strRequirement": null
    },
    "armorType": "heavy",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 14,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "heavy leather covered in sewn metal rings"
    }
  },
  "robes": {
    "id": "robes",
    "name": "Robes",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "rod": {
    "id": "rod",
    "name": "Rod",
    "category": "gear",
    "subcategory": "arcane-focus",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "An arcane focus is a special item--an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item--designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "rope-hempen-50-feet": {
    "id": "rope-hempen-50-feet",
    "name": "Rope, hempen (50 feet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "Rope, whether made of hemp or silk, has 2 hit points and can be burst with a DC 17 Strength check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "rope-silk-50-feet": {
    "id": "rope-silk-50-feet",
    "name": "Rope, silk (50 feet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "Rope, whether made of hemp or silk, has 2 hit points and can be burst with a DC 17 Strength check."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "rowboat": {
    "id": "rowboat",
    "name": "Rowboat",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 1.5,
        "unit": "mph"
      },
      "notes": "Keelboats and rowboats are used on lakes and rivers. If going downstream, add the speed of the current (typically 3 miles per hour) to the speed of the vehicle. These vehicles can't be rowed against any significant current, but they can be pulled upstream by draft animals on the shores. A rowboat weighs 100 pounds, in case adventurers carry it over land."
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "sack": {
    "id": "sack",
    "name": "Sack",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 0.5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "saddle-exotic": {
    "id": "saddle-exotic",
    "name": "Saddle, Exotic",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 60,
      "unit": "gp"
    },
    "weight": 50,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other",
      "notes": "An exotic saddle is required for riding any aquatic or flying mount."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "saddle-military": {
    "id": "saddle-military",
    "name": "Saddle, Military",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 30,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other",
      "notes": "A military saddle braces the rider, helping you keep your seat on an active mount in battle. It gives you advantage on any check you make to remain mounted."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "saddle-pack": {
    "id": "saddle-pack",
    "name": "Saddle, Pack",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 15,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "saddle-riding": {
    "id": "saddle-riding",
    "name": "Saddle, Riding",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 25,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "saddlebags": {
    "id": "saddlebags",
    "name": "Saddlebags",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 4,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "sailing-ship": {
    "id": "sailing-ship",
    "name": "Sailing ship",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 10000,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 2,
        "unit": "mph"
      }
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "scale-mail": {
    "id": "scale-mail",
    "name": "Scale Mail",
    "category": "armor",
    "subcategory": "medium",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 45,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 14,
      "maxDex": 2,
      "category": "medium",
      "stealthDisadvantage": true,
      "strRequirement": null
    },
    "armorType": "medium",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 14,
      "dexBonus": "max2",
      "strRequirement": null,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "overlapping metal scales sewn to backing"
    }
  },
  "scale-merchants": {
    "id": "scale-merchants",
    "name": "Scale, merchant's",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A scale includes a small balance, pans, and a suitable assortment of weights up to 2 pounds. With it, you can measure the exact weight of small objects, such as raw precious metals or trade goods, to help determine their worth."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "scholars-pack": {
    "id": "scholars-pack",
    "name": "Scholar's Pack",
    "category": "pack",
    "subcategory": "equipment-pack",
    "cost": {
      "qty": 40,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A ready-made bundle of supplies assembled for a particular sort of adventurer.",
    "mech": {
      "type": "other",
      "contents": [
        {
          "id": "backpack",
          "qty": 1
        },
        {
          "id": "book",
          "qty": 1
        },
        {
          "id": "ink-1-ounce-bottle",
          "qty": 1
        },
        {
          "id": "ink-pen",
          "qty": 1
        },
        {
          "id": "parchment-one-sheet",
          "qty": 10
        },
        {
          "id": "little-bag-of-sand",
          "qty": 1
        },
        {
          "id": "small-knife",
          "qty": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "bundled travel supplies tied up for the road"
    }
  },
  "scimitar": {
    "id": "scimitar",
    "name": "Scimitar",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "finesse",
      "light"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "curved saber with a keen single edge"
    }
  },
  "sealing-wax": {
    "id": "sealing-wax",
    "name": "Sealing wax",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "shawm": {
    "id": "shawm",
    "name": "Shawm",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "shield": {
    "id": "shield",
    "name": "Shield",
    "category": "armor",
    "subcategory": "shield",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 6,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "mode": "add",
      "value": 2
    },
    "armorType": "shield",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 2,
      "dexBonus": "none",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#7d858f",
        "#b08a55"
      ],
      "iconShape": "shield",
      "glow": false,
      "notes": "broad metal-rimmed shield face with straps"
    }
  },
  "shortbow": {
    "id": "shortbow",
    "name": "Shortbow",
    "category": "weapon",
    "subcategory": "simple-ranged",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 80,
        "long": 320
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "simple recurved bow of wood and horn"
    }
  },
  "shortsword": {
    "id": "shortsword",
    "name": "Shortsword",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "finesse",
      "light",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "short balanced blade for close work"
    }
  },
  "shovel": {
    "id": "shovel",
    "name": "Shovel",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "sickle": {
    "id": "sickle",
    "name": "Sickle",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "light",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": false,
      "notes": "curved harvesting blade with a hooked edge"
    }
  },
  "signal-whistle": {
    "id": "signal-whistle",
    "name": "Signal whistle",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "signet-ring": {
    "id": "signet-ring",
    "name": "Signet ring",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "sled": {
    "id": "sled",
    "name": "Sled",
    "category": "vehicle",
    "subcategory": "land-vehicle",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 300,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "sling": {
    "id": "sling",
    "name": "Sling",
    "category": "weapon",
    "subcategory": "simple-ranged",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "ammunition"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable battlefield weapon built for hard use.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 30,
        "long": 120
      }
    },
    "visual": {
      "palette": [
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": false,
      "notes": "corded sling and smooth shot pouch"
    }
  },
  "sling-bullet": {
    "id": "sling-bullet",
    "name": "Sling bullet",
    "category": "gear",
    "subcategory": "ammunition",
    "cost": {
      "qty": 4,
      "unit": "cp"
    },
    "weight": 1.5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "small-knife": {
    "id": "small-knife",
    "name": "Small knife",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A small knife, typically found in a scholar's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "smiths-tools": {
    "id": "smiths-tools",
    "name": "Smith's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 20,
      "unit": "gp"
    },
    "weight": 8,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "soap": {
    "id": "soap",
    "name": "Soap",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "spear": {
    "id": "spear",
    "name": "Spear",
    "category": "weapon",
    "subcategory": "simple-melee",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": "1d8",
      "type": "piercing"
    },
    "properties": [
      "thrown",
      "versatile",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "simple",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "leaf-headed spear with a plain ash shaft"
    }
  },
  "spellbook": {
    "id": "spellbook",
    "name": "Spellbook",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A writing or record-keeping supply valued by scholars, clerks, and travelers.",
    "mech": {
      "type": "other",
      "notes": "Essential for wizards, a spellbook is a leather-bound tome with 100 blank vellum pages suitable for recording spells."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "spike-iron": {
    "id": "spike-iron",
    "name": "Spike, iron",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "splint-armor": {
    "id": "splint-armor",
    "name": "Splint Armor",
    "category": "armor",
    "subcategory": "heavy",
    "cost": {
      "qty": 200,
      "unit": "gp"
    },
    "weight": 60,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 17,
      "maxDex": 0,
      "category": "heavy",
      "stealthDisadvantage": true,
      "strRequirement": 15
    },
    "armorType": "heavy",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 17,
      "dexBonus": "none",
      "strRequirement": 15,
      "stealthDisadvantage": true
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "rigid splints fastened over padding and leather"
    }
  },
  "sprig-of-mistletoe": {
    "id": "sprig-of-mistletoe",
    "name": "Sprig of mistletoe",
    "category": "gear",
    "subcategory": "druidic-focus",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "spyglass": {
    "id": "spyglass",
    "name": "Spyglass",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1000,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Objects viewed through a spyglass are magnified to twice their size."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "stabling-1-day": {
    "id": "stabling-1-day",
    "name": "Stabling (1 day)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Tack or stable support used to outfit and care for a working mount.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "staff": {
    "id": "staff",
    "name": "Staff",
    "category": "gear",
    "subcategory": "arcane-focus",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "An arcane focus is a special item--an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item--designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "string-10-feet": {
    "id": "string-10-feet",
    "name": "String (10 feet)",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "Strong line or links meant for climbing, tying, hauling, or securing gear.",
    "mech": {
      "type": "other",
      "notes": "A 10-foot length of string, typically found in a burglar's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "studded-leather-armor": {
    "id": "studded-leather-armor",
    "name": "Studded Leather Armor",
    "category": "armor",
    "subcategory": "light",
    "cost": {
      "qty": 45,
      "unit": "gp"
    },
    "weight": 13,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": {
      "base": 12,
      "maxDex": null,
      "category": "light",
      "stealthDisadvantage": false,
      "strRequirement": null
    },
    "armorType": "light",
    "text": "Protective gear meant to keep a combatant alive when steel starts flying.",
    "mech": {
      "baseAC": 12,
      "dexBonus": "full",
      "strRequirement": null,
      "stealthDisadvantage": false
    },
    "visual": {
      "palette": [
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": false,
      "notes": "reinforced leather set with metal studs"
    }
  },
  "tent-two-person": {
    "id": "tent-two-person",
    "name": "Tent, two-person",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 20,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "A simple and portable canvas shelter, a tent sleeps two."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "thieves-tools": {
    "id": "thieves-tools",
    "name": "Thieves' Tools",
    "category": "tool",
    "subcategory": "other-tool",
    "cost": {
      "qty": 25,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "other-tool",
      "notes": "This set of tools includes a small file, a set of lock picks, a small mirror mounted on a metal handle, a set of narrow-bladed scissors, and a pair of pliers. Proficiency with these tools lets you add your proficiency bonus to any ability checks you make to disarm traps or open locks."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "tinderbox": {
    "id": "tinderbox",
    "name": "Tinderbox",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "This small container holds flint, fire steel, and tinder (usually dry cloth soaked in light oil) used to kindle a fire. Using it to light a torch--or anything else with abundant, exposed fuel--takes an action."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "tinkers-tools": {
    "id": "tinkers-tools",
    "name": "Tinker's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 10,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "torch": {
    "id": "torch",
    "name": "Torch",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A reliable source of light for caverns, night watches, and dark ruins.",
    "mech": {
      "type": "other",
      "notes": "A torch burns for 1 hour, providing bright light in a 20-foot radius and dim light for an additional 20 feet. If you make a melee attack with a burning torch and hit, it deals 1 fire damage."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "totem": {
    "id": "totem",
    "name": "Totem",
    "category": "gear",
    "subcategory": "druidic-focus",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "trident": {
    "id": "trident",
    "name": "Trident",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": "1d8",
      "type": "piercing"
    },
    "properties": [
      "thrown",
      "versatile"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "three-pronged spear forged for thrust and cast"
    }
  },
  "vestments": {
    "id": "vestments",
    "name": "Vestments",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 0,
      "unit": "cp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other",
      "notes": "Religious clothing, typically found in a priest's pack."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "vial": {
    "id": "vial",
    "name": "Vial",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 0,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A storage item meant to carry, organize, or protect belongings and supplies.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "viol": {
    "id": "viol",
    "name": "Viol",
    "category": "tool",
    "subcategory": "musical-instrument",
    "cost": {
      "qty": 30,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An instrument suitable for performance, ceremony, or earning a few coins on the road.",
    "mech": {
      "type": "narrative",
      "toolType": "musical-instrument",
      "notes": "Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "wagon": {
    "id": "wagon",
    "name": "Wagon",
    "category": "vehicle",
    "subcategory": "land-vehicle",
    "cost": {
      "qty": 35,
      "unit": "gp"
    },
    "weight": 400,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "wand": {
    "id": "wand",
    "name": "Wand",
    "category": "gear",
    "subcategory": "arcane-focus",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "An arcane focus is a special item--an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item--designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "war-pick": {
    "id": "war-pick",
    "name": "War pick",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "armor-piercing pick with a stout hammer back"
    }
  },
  "warhammer": {
    "id": "warhammer",
    "name": "Warhammer",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 2,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d8",
      "versatileDice": "1d10",
      "type": "bludgeoning"
    },
    "properties": [
      "versatile"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "martial hammer with a compact steel head"
    }
  },
  "warhorse": {
    "id": "warhorse",
    "name": "Warhorse",
    "category": "mount",
    "subcategory": "mount",
    "cost": {
      "qty": 400,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A trained animal suited for travel, burden, or service in dangerous country.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 60,
        "unit": "ft/round"
      },
      "capacity": "540 lb."
    },
    "visual": {
      "palette": [
        "#8b6a45",
        "#d8c3a3"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "healthy trained beast with practical tack"
    }
  },
  "warship": {
    "id": "warship",
    "name": "Warship",
    "category": "vehicle",
    "subcategory": "water-vehicle",
    "cost": {
      "qty": 25000,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A conveyance designed to carry travelers, cargo, or both between destinations.",
    "mech": {
      "type": "other",
      "speed": {
        "quantity": 2.5,
        "unit": "mph"
      }
    },
    "visual": {
      "palette": [
        "#70543a",
        "#c4b08b"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "sturdy conveyance built of wood, rope, and iron"
    }
  },
  "waterskin": {
    "id": "waterskin",
    "name": "Waterskin",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 2,
      "unit": "sp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "weavers-tools": {
    "id": "weavers-tools",
    "name": "Weaver's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "whetstone": {
    "id": "whetstone",
    "name": "Whetstone",
    "category": "gear",
    "subcategory": "adventuring-gear",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A standard piece of adventuring equipment kept ready for rough travel and practical use.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "whip": {
    "id": "whip",
    "name": "Whip",
    "category": "weapon",
    "subcategory": "martial-melee",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 3,
    "rarity": null,
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "slashing"
    },
    "properties": [
      "finesse",
      "reach"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A dependable weapon made for hard travel and close fighting.",
    "mech": {
      "weaponCategory": "martial",
      "range": {
        "normal": 5
      }
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "supple leather lash with a weighted tip"
    }
  },
  "woodcarvers-tools": {
    "id": "woodcarvers-tools",
    "name": "Woodcarver's Tools",
    "category": "tool",
    "subcategory": "artisans-tools",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 5,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A specialized kit used to practice a craft, trade, or trained profession.",
    "mech": {
      "type": "narrative",
      "toolType": "artisans-tools",
      "notes": "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
    },
    "visual": {
      "palette": [
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "well-used kit of craft or trade implements"
    }
  },
  "wooden-staff": {
    "id": "wooden-staff",
    "name": "Wooden staff",
    "category": "gear",
    "subcategory": "druidic-focus",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 4,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "yew-wand": {
    "id": "yew-wand",
    "name": "Yew wand",
    "category": "gear",
    "subcategory": "druidic-focus",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A spellcasting focus shaped to help channel magical tradition into practiced form.",
    "mech": {
      "type": "other",
      "notes": "A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus."
    },
    "visual": {
      "palette": [
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": false,
      "notes": "practical adventuring equipment in serviceable condition"
    }
  },
  "wheat-1-lb": {
    "id": "wheat-1-lb",
    "name": "Wheat (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 1,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "flour-1-lb": {
    "id": "flour-1-lb",
    "name": "Flour (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "chicken": {
    "id": "chicken",
    "name": "Chicken",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 2,
      "unit": "cp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "salt-1-lb": {
    "id": "salt-1-lb",
    "name": "Salt (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 5,
      "unit": "cp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "iron-1-lb": {
    "id": "iron-1-lb",
    "name": "Iron (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "canvas-1-sq-yd": {
    "id": "canvas-1-sq-yd",
    "name": "Canvas (1 sq. yd.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 1,
      "unit": "sp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "copper-1-lb": {
    "id": "copper-1-lb",
    "name": "Copper (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "cotton-cloth-1-sq-yd": {
    "id": "cotton-cloth-1-sq-yd",
    "name": "Cotton Cloth (1 sq. yd.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 5,
      "unit": "sp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "ginger-1-lb": {
    "id": "ginger-1-lb",
    "name": "Ginger (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "goat": {
    "id": "goat",
    "name": "Goat",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 1,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "cinnamon-1-lb": {
    "id": "cinnamon-1-lb",
    "name": "Cinnamon (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "pepper-1-lb": {
    "id": "pepper-1-lb",
    "name": "Pepper (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "sheep": {
    "id": "sheep",
    "name": "Sheep",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 2,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "cloves-1-lb": {
    "id": "cloves-1-lb",
    "name": "Cloves (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 3,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "pig": {
    "id": "pig",
    "name": "Pig",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 3,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "silver-1-lb": {
    "id": "silver-1-lb",
    "name": "Silver (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "linen-1-sq-yd": {
    "id": "linen-1-sq-yd",
    "name": "Linen (1 sq. yd.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 5,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "silk-1-sq-yd": {
    "id": "silk-1-sq-yd",
    "name": "Silk (1 sq. yd.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "cow": {
    "id": "cow",
    "name": "Cow",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 10,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "saffron-1-lb": {
    "id": "saffron-1-lb",
    "name": "Saffron (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "ox": {
    "id": "ox",
    "name": "Ox",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 15,
      "unit": "gp"
    },
    "weight": null,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "gold-1-lb": {
    "id": "gold-1-lb",
    "name": "Gold (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 50,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "platinum-1-lb": {
    "id": "platinum-1-lb",
    "name": "Platinum (1 lb.)",
    "category": "trade-good",
    "subcategory": "trade-good",
    "cost": {
      "qty": 500,
      "unit": "gp"
    },
    "weight": 1,
    "rarity": null,
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A commonly bartered commodity whose value is often measured without coinage changing hands.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#a38d6d",
        "#d9cfb8"
      ],
      "iconShape": "misc",
      "glow": false,
      "notes": "merchant stock measured for barter"
    }
  },
  "adamantine-armor": {
    "id": "adamantine-armor",
    "name": "Adamantine Armor",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "amulet-of-health": {
    "id": "amulet-of-health",
    "name": "Amulet of Health",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "ability_score_set",
      "ability": "con",
      "score": 19
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "amulet-of-proof-against-detection-and-location": {
    "id": "amulet-of-proof-against-detection-and-location",
    "name": "Amulet of Proof against Detection and Location",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "amulet-of-the-planes": {
    "id": "amulet-of-the-planes",
    "name": "Amulet of the Planes",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "animated-shield": {
    "id": "animated-shield",
    "name": "Animated Shield",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": 2,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "other",
      "handsFreeShield": true
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#7d858f",
        "#b08a55"
      ],
      "iconShape": "shield",
      "glow": true,
      "notes": "reinforced shield face alive with subtle magic"
    }
  },
  "apparatus-of-the-crab": {
    "id": "apparatus-of-the-crab",
    "name": "Apparatus of the Crab",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "armor-of-invulnerability": {
    "id": "armor-of-invulnerability",
    "name": "Armor of Invulnerability",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "armor-of-resistance": {
    "id": "armor-of-resistance",
    "name": "Armor of Resistance",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "resistance",
      "damageType": "choice"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "armor-of-vulnerability": {
    "id": "armor-of-vulnerability",
    "name": "Armor of Vulnerability",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "arrow-of-slaying": {
    "id": "arrow-of-slaying",
    "name": "Arrow of Slaying",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": true,
      "notes": "enchanted bowstave or quarrel carrying latent force"
    }
  },
  "arrow-catching-shield": {
    "id": "arrow-catching-shield",
    "name": "Arrow-Catching Shield",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": 2,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "ac_bonus",
      "amount": 2,
      "vs": "ranged-attacks"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7d858f",
        "#b08a55"
      ],
      "iconShape": "shield",
      "glow": true,
      "notes": "reinforced shield face alive with subtle magic"
    }
  },
  "bag-of-beans": {
    "id": "bag-of-beans",
    "name": "Bag of Beans",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical bag whose enchantment makes it useful far beyond normal luggage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "bag-of-devouring": {
    "id": "bag-of-devouring",
    "name": "Bag of Devouring",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical bag whose enchantment makes it useful far beyond normal luggage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "bag-of-holding": {
    "id": "bag-of-holding",
    "name": "Bag of Holding",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical bag whose enchantment makes it useful far beyond normal luggage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "bead-of-force": {
    "id": "bead-of-force",
    "name": "Bead of Force",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "belt-of-dwarvenkind": {
    "id": "belt-of-dwarvenkind",
    "name": "Belt of Dwarvenkind",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "berserker-axe": {
    "id": "berserker-axe",
    "name": "Berserker Axe",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#aeb5bf",
        "#6b4d2e"
      ],
      "iconShape": "axe",
      "glow": true,
      "notes": "rune-marked edge sharpened beyond the mundane"
    }
  },
  "boots-of-elvenkind": {
    "id": "boots-of-elvenkind",
    "name": "Boots of Elvenkind",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "boots-of-levitation": {
    "id": "boots-of-levitation",
    "name": "Boots of Levitation",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "boots-of-speed": {
    "id": "boots-of-speed",
    "name": "Boots of Speed",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "other",
      "speedMultiplier": 2
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "boots-of-striding-and-springing": {
    "id": "boots-of-striding-and-springing",
    "name": "Boots of Striding and Springing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "other",
      "speedFloor": 30,
      "jumpMultiplier": 3
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "boots-of-the-winterlands": {
    "id": "boots-of-the-winterlands",
    "name": "Boots of the Winterlands",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "bowl-of-commanding-water-elementals": {
    "id": "bowl-of-commanding-water-elementals",
    "name": "Bowl of Commanding Water Elementals",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": true,
      "notes": "enchanted bowstave or quarrel carrying latent force"
    }
  },
  "bracers-of-archery": {
    "id": "bracers-of-archery",
    "name": "Bracers of Archery",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "bracers-of-defense": {
    "id": "bracers-of-defense",
    "name": "Bracers of Defense",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "ac_bonus",
      "amount": 2,
      "when": "no armor and no shield"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "brazier-of-commanding-fire-elementals": {
    "id": "brazier-of-commanding-fire-elementals",
    "name": "Brazier of Commanding Fire Elementals",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "brooch-of-shielding": {
    "id": "brooch-of-shielding",
    "name": "Brooch of Shielding",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "resistance",
      "damageType": "force"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "broom-of-flying": {
    "id": "broom-of-flying",
    "name": "Broom of Flying",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "candle-of-invocation": {
    "id": "candle-of-invocation",
    "name": "Candle of Invocation",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cape-of-the-mountebank": {
    "id": "cape-of-the-mountebank",
    "name": "Cape of the Mountebank",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "carpet-of-flying": {
    "id": "carpet-of-flying",
    "name": "Carpet of Flying",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "censer-of-controlling-air-elementals": {
    "id": "censer-of-controlling-air-elementals",
    "name": "Censer of Controlling Air Elementals",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "chime-of-opening": {
    "id": "chime-of-opening",
    "name": "Chime of Opening",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "circlet-of-blasting": {
    "id": "circlet-of-blasting",
    "name": "Circlet of Blasting",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-arachnida": {
    "id": "cloak-of-arachnida",
    "name": "Cloak of Arachnida",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-displacement": {
    "id": "cloak-of-displacement",
    "name": "Cloak of Displacement",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "other",
      "disadvantageAgainstWearer": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-elvenkind": {
    "id": "cloak-of-elvenkind",
    "name": "Cloak of Elvenkind",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-protection": {
    "id": "cloak-of-protection",
    "name": "Cloak of Protection",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "other",
      "effects": [
        {
          "type": "ac_bonus",
          "amount": 1
        },
        {
          "type": "saving_throw_bonus",
          "amount": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-the-bat": {
    "id": "cloak-of-the-bat",
    "name": "Cloak of the Bat",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cloak-of-the-manta-ray": {
    "id": "cloak-of-the-manta-ray",
    "name": "Cloak of the Manta Ray",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "crystal-ball": {
    "id": "crystal-ball",
    "name": "Crystal Ball",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "crystal-ball-of-mind-reading": {
    "id": "crystal-ball-of-mind-reading",
    "name": "Crystal Ball of Mind Reading",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "crystal-ball-of-telepathy": {
    "id": "crystal-ball-of-telepathy",
    "name": "Crystal Ball of Telepathy",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "crystal-ball-of-true-seeing": {
    "id": "crystal-ball-of-true-seeing",
    "name": "Crystal Ball of True Seeing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "cube-of-force": {
    "id": "cube-of-force",
    "name": "Cube of Force",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "cubic-gate": {
    "id": "cubic-gate",
    "name": "Cubic Gate",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "dagger-of-venom": {
    "id": "dagger-of-venom",
    "name": "Dagger of Venom",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": {
      "dice": "1d4",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "finesse",
      "light",
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "dancing-sword": {
    "id": "dancing-sword",
    "name": "Dancing Sword",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "decanter-of-endless-water": {
    "id": "decanter-of-endless-water",
    "name": "Decanter of Endless Water",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "deck-of-illusions": {
    "id": "deck-of-illusions",
    "name": "Deck of Illusions",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "defender": {
    "id": "defender",
    "name": "Defender",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "demon-armor": {
    "id": "demon-armor",
    "name": "Demon Armor",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "dimensional-shackles": {
    "id": "dimensional-shackles",
    "name": "Dimensional Shackles",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "dragon-scale-mail": {
    "id": "dragon-scale-mail",
    "name": "Dragon Scale Mail",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "dragon-slayer": {
    "id": "dragon-slayer",
    "name": "Dragon Slayer",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "dust-of-disappearance": {
    "id": "dust-of-disappearance",
    "name": "Dust of Disappearance",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "dust-of-dryness": {
    "id": "dust-of-dryness",
    "name": "Dust of Dryness",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "dust-of-sneezing-and-choking": {
    "id": "dust-of-sneezing-and-choking",
    "name": "Dust of Sneezing and Choking",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "dwarven-plate": {
    "id": "dwarven-plate",
    "name": "Dwarven Plate",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "dwarven-thrower": {
    "id": "dwarven-thrower",
    "name": "Dwarven Thrower",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "efficient-quiver": {
    "id": "efficient-quiver",
    "name": "Efficient Quiver",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "efreeti-bottle": {
    "id": "efreeti-bottle",
    "name": "Efreeti Bottle",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "elemental-gem": {
    "id": "elemental-gem",
    "name": "Elemental Gem",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "elven-chain": {
    "id": "elven-chain",
    "name": "Elven Chain",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "ac_bonus",
      "amount": 1
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "eversmoking-bottle": {
    "id": "eversmoking-bottle",
    "name": "Eversmoking Bottle",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "eyes-of-charming": {
    "id": "eyes-of-charming",
    "name": "Eyes of Charming",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "eyes-of-minute-seeing": {
    "id": "eyes-of-minute-seeing",
    "name": "Eyes of Minute Seeing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "eyes-of-the-eagle": {
    "id": "eyes-of-the-eagle",
    "name": "Eyes of the Eagle",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "feather-token": {
    "id": "feather-token",
    "name": "Feather Token",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "flame-tongue": {
    "id": "flame-tongue",
    "name": "Flame Tongue",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "folding-boat": {
    "id": "folding-boat",
    "name": "Folding Boat",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "frost-brand": {
    "id": "frost-brand",
    "name": "Frost Brand",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "gauntlets-of-ogre-power": {
    "id": "gauntlets-of-ogre-power",
    "name": "Gauntlets of Ogre Power",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "ability_score_set",
      "ability": "str",
      "score": 19
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "gem-of-brightness": {
    "id": "gem-of-brightness",
    "name": "Gem of Brightness",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 50
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "gem-of-seeing": {
    "id": "gem-of-seeing",
    "name": "Gem of Seeing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "giant-slayer": {
    "id": "giant-slayer",
    "name": "Giant Slayer",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "glamoured-studded-leather": {
    "id": "glamoured-studded-leather",
    "name": "Glamoured Studded Leather",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "gloves-of-missile-snaring": {
    "id": "gloves-of-missile-snaring",
    "name": "Gloves of Missile Snaring",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "gloves-of-swimming-and-climbing": {
    "id": "gloves-of-swimming-and-climbing",
    "name": "Gloves of Swimming and Climbing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A wearable charm that enhances its bearer with constant magic.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "goggles-of-night": {
    "id": "goggles-of-night",
    "name": "Goggles of Night",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "hammer-of-thunderbolts": {
    "id": "hammer-of-thunderbolts",
    "name": "Hammer of Thunderbolts",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "charges",
      "max": 5,
      "recharge": "1d4 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "handy-haversack": {
    "id": "handy-haversack",
    "name": "Handy Haversack",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "hat-of-disguise": {
    "id": "hat-of-disguise",
    "name": "Hat of Disguise",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "headband-of-intellect": {
    "id": "headband-of-intellect",
    "name": "Headband of Intellect",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "ability_score_set",
      "ability": "int",
      "score": 19
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "helm-of-brilliance": {
    "id": "helm-of-brilliance",
    "name": "Helm of Brilliance",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "helm-of-comprehending-languages": {
    "id": "helm-of-comprehending-languages",
    "name": "Helm of Comprehending Languages",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "helm-of-telepathy": {
    "id": "helm-of-telepathy",
    "name": "Helm of Telepathy",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "helm-of-teleportation": {
    "id": "helm-of-teleportation",
    "name": "Helm of Teleportation",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "holy-avenger": {
    "id": "holy-avenger",
    "name": "Holy Avenger",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "horn-of-blasting": {
    "id": "horn-of-blasting",
    "name": "Horn of Blasting",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "horseshoes-of-speed": {
    "id": "horseshoes-of-speed",
    "name": "Horseshoes of Speed",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "horseshoes-of-a-zephyr": {
    "id": "horseshoes-of-a-zephyr",
    "name": "Horseshoes of a Zephyr",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "immovable-rod": {
    "id": "immovable-rod",
    "name": "Immovable Rod",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "instant-fortress": {
    "id": "instant-fortress",
    "name": "Instant Fortress",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "ioun-stone-of-absorption": {
    "id": "ioun-stone-of-absorption",
    "name": "Ioun Stone of Absorption",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-agility": {
    "id": "ioun-stone-of-agility",
    "name": "Ioun Stone of Agility",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-awareness": {
    "id": "ioun-stone-of-awareness",
    "name": "Ioun Stone of Awareness",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-fortitude": {
    "id": "ioun-stone-of-fortitude",
    "name": "Ioun Stone of Fortitude",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-greater-absorption": {
    "id": "ioun-stone-of-greater-absorption",
    "name": "Ioun Stone of Greater Absorption",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-insight": {
    "id": "ioun-stone-of-insight",
    "name": "Ioun Stone of Insight",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-intellect": {
    "id": "ioun-stone-of-intellect",
    "name": "Ioun Stone of Intellect",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-leadership": {
    "id": "ioun-stone-of-leadership",
    "name": "Ioun Stone of Leadership",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-mastery": {
    "id": "ioun-stone-of-mastery",
    "name": "Ioun Stone of Mastery",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-protection": {
    "id": "ioun-stone-of-protection",
    "name": "Ioun Stone of Protection",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "other",
      "effects": [
        {
          "type": "ac_bonus",
          "amount": 1
        },
        {
          "type": "saving_throw_bonus",
          "amount": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-regeneration": {
    "id": "ioun-stone-of-regeneration",
    "name": "Ioun Stone of Regeneration",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-reserve": {
    "id": "ioun-stone-of-reserve",
    "name": "Ioun Stone of Reserve",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-strength": {
    "id": "ioun-stone-of-strength",
    "name": "Ioun Stone of Strength",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "ioun-stone-of-sustenance": {
    "id": "ioun-stone-of-sustenance",
    "name": "Ioun Stone of Sustenance",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A levitating stone that circles its bearer and bestows a magical benefit.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "iron-bands-of-binding": {
    "id": "iron-bands-of-binding",
    "name": "Iron Bands of Binding",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "iron-flask": {
    "id": "iron-flask",
    "name": "Iron Flask",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "javelin-of-lightning": {
    "id": "javelin-of-lightning",
    "name": "Javelin of Lightning",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "thrown",
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "lantern-of-revealing": {
    "id": "lantern-of-revealing",
    "name": "Lantern of Revealing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "luck-blade": {
    "id": "luck-blade",
    "name": "Luck Blade",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "mace-of-disruption": {
    "id": "mace-of-disruption",
    "name": "Mace of Disruption",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "mace-of-smiting": {
    "id": "mace-of-smiting",
    "name": "Mace of Smiting",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "mace-of-terror": {
    "id": "mace-of-terror",
    "name": "Mace of Terror",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": {
      "dice": "1d6",
      "versatileDice": null,
      "type": "bludgeoning"
    },
    "properties": [
      "monk"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "mantle-of-spell-resistance": {
    "id": "mantle-of-spell-resistance",
    "name": "Mantle of Spell Resistance",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "manual-of-bodily-health": {
    "id": "manual-of-bodily-health",
    "name": "Manual of Bodily Health",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "manual-of-gainful-exercise": {
    "id": "manual-of-gainful-exercise",
    "name": "Manual of Gainful Exercise",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "manual-of-quickness-of-action": {
    "id": "manual-of-quickness-of-action",
    "name": "Manual of Quickness of Action",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "marvelous-pigments": {
    "id": "marvelous-pigments",
    "name": "Marvelous Pigments",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "medallion-of-thoughts": {
    "id": "medallion-of-thoughts",
    "name": "Medallion of Thoughts",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "mirror-of-life-trapping": {
    "id": "mirror-of-life-trapping",
    "name": "Mirror of Life Trapping",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "mithral-armor": {
    "id": "mithral-armor",
    "name": "Mithral Armor",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "necklace-of-adaptation": {
    "id": "necklace-of-adaptation",
    "name": "Necklace of Adaptation",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "necklace-of-fireballs": {
    "id": "necklace-of-fireballs",
    "name": "Necklace of Fireballs",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "necklace-of-prayer-beads": {
    "id": "necklace-of-prayer-beads",
    "name": "Necklace of Prayer Beads",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "nine-lives-stealer": {
    "id": "nine-lives-stealer",
    "name": "Nine Lives Stealer",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "oathbow": {
    "id": "oathbow",
    "name": "Oathbow",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": {
      "dice": "1d8",
      "versatileDice": null,
      "type": "piercing"
    },
    "properties": [
      "ammunition",
      "heavy",
      "two-handed"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8b5a2b",
        "#d1c6a1"
      ],
      "iconShape": "bow",
      "glow": true,
      "notes": "enchanted bowstave or quarrel carrying latent force"
    }
  },
  "oil-of-etherealness": {
    "id": "oil-of-etherealness",
    "name": "Oil of Etherealness",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "oil-of-sharpness": {
    "id": "oil-of-sharpness",
    "name": "Oil of Sharpness",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "oil-of-slipperiness": {
    "id": "oil-of-slipperiness",
    "name": "Oil of Slipperiness",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "orb-of-dragonkind": {
    "id": "orb-of-dragonkind",
    "name": "Orb of Dragonkind",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "artifact",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d4 + 3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#b01f2e",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "pearl-of-power": {
    "id": "pearl-of-power",
    "name": "Pearl of Power",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "periapt-of-health": {
    "id": "periapt-of-health",
    "name": "Periapt of Health",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "immune": "disease"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "periapt-of-proof-against-poison": {
    "id": "periapt-of-proof-against-poison",
    "name": "Periapt of Proof against Poison",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "periapt-of-wound-closure": {
    "id": "periapt-of-wound-closure",
    "name": "Periapt of Wound Closure",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d3b56f",
        "#6b3f88"
      ],
      "iconShape": "amulet",
      "glow": true,
      "notes": "enchanted pendant worked with tiny runes"
    }
  },
  "philter-of-love": {
    "id": "philter-of-love",
    "name": "Philter of Love",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "pipes-of-haunting": {
    "id": "pipes-of-haunting",
    "name": "Pipes of Haunting",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "pipes-of-the-sewers": {
    "id": "pipes-of-the-sewers",
    "name": "Pipes of the Sewers",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "plate-armor-of-etherealness": {
    "id": "plate-armor-of-etherealness",
    "name": "Plate Armor of Etherealness",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "portable-hole": {
    "id": "portable-hole",
    "name": "Portable Hole",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "potion-of-animal-friendship": {
    "id": "potion-of-animal-friendship",
    "name": "Potion of Animal Friendship",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-clairvoyance": {
    "id": "potion-of-clairvoyance",
    "name": "Potion of Clairvoyance",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-climbing": {
    "id": "potion-of-climbing",
    "name": "Potion of Climbing",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "common",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#b8bec7",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-diminution": {
    "id": "potion-of-diminution",
    "name": "Potion of Diminution",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-flying": {
    "id": "potion-of-flying",
    "name": "Potion of Flying",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-gaseous-form": {
    "id": "potion-of-gaseous-form",
    "name": "Potion of Gaseous Form",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-growth": {
    "id": "potion-of-growth",
    "name": "Potion of Growth",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-heroism": {
    "id": "potion-of-heroism",
    "name": "Potion of Heroism",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-invisibility": {
    "id": "potion-of-invisibility",
    "name": "Potion of Invisibility",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-mind-reading": {
    "id": "potion-of-mind-reading",
    "name": "Potion of Mind Reading",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-poison": {
    "id": "potion-of-poison",
    "name": "Potion of Poison",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-resistance": {
    "id": "potion-of-resistance",
    "name": "Potion of Resistance",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-speed": {
    "id": "potion-of-speed",
    "name": "Potion of Speed",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "potion-of-water-breathing": {
    "id": "potion-of-water-breathing",
    "name": "Potion of Water Breathing",
    "category": "magic-item",
    "subcategory": "potion",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A bottled enchantment that grants its named effect to the creature that drinks it.",
    "mech": {
      "type": "other",
      "consumable": true
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c2f39",
        "#d8d0ff"
      ],
      "iconShape": "potion",
      "glow": true,
      "notes": "glass vial filled with shimmering liquid"
    }
  },
  "restorative-ointment": {
    "id": "restorative-ointment",
    "name": "Restorative Ointment",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "ring-of-animal-influence": {
    "id": "ring-of-animal-influence",
    "name": "Ring of Animal Influence",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-djinni-summoning": {
    "id": "ring-of-djinni-summoning",
    "name": "Ring of Djinni Summoning",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-evasion": {
    "id": "ring-of-evasion",
    "name": "Ring of Evasion",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-feather-falling": {
    "id": "ring-of-feather-falling",
    "name": "Ring of Feather Falling",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-free-action": {
    "id": "ring-of-free-action",
    "name": "Ring of Free Action",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-invisibility": {
    "id": "ring-of-invisibility",
    "name": "Ring of Invisibility",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-jumping": {
    "id": "ring-of-jumping",
    "name": "Ring of Jumping",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-mind-shielding": {
    "id": "ring-of-mind-shielding",
    "name": "Ring of Mind Shielding",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-protection": {
    "id": "ring-of-protection",
    "name": "Ring of Protection",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "other",
      "effects": [
        {
          "type": "ac_bonus",
          "amount": 1
        },
        {
          "type": "saving_throw_bonus",
          "amount": 1
        }
      ]
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-regeneration": {
    "id": "ring-of-regeneration",
    "name": "Ring of Regeneration",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-resistance": {
    "id": "ring-of-resistance",
    "name": "Ring of Resistance",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "resistance",
      "damageType": "choice"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-shooting-stars": {
    "id": "ring-of-shooting-stars",
    "name": "Ring of Shooting Stars",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "charges",
      "max": 6,
      "recharge": "1d6 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-spell-storing": {
    "id": "ring-of-spell-storing",
    "name": "Ring of Spell Storing",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-spell-turning": {
    "id": "ring-of-spell-turning",
    "name": "Ring of Spell Turning",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-swimming": {
    "id": "ring-of-swimming",
    "name": "Ring of Swimming",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "stat_bonus",
      "amount": 40,
      "target": "swim-speed"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-telekinesis": {
    "id": "ring-of-telekinesis",
    "name": "Ring of Telekinesis",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-three-wishes": {
    "id": "ring-of-three-wishes",
    "name": "Ring of Three Wishes",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-warmth": {
    "id": "ring-of-warmth",
    "name": "Ring of Warmth",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "resistance",
      "damageType": "cold"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-water-walking": {
    "id": "ring-of-water-walking",
    "name": "Ring of Water Walking",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-x-ray-vision": {
    "id": "ring-of-x-ray-vision",
    "name": "Ring of X-ray Vision",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "ring-of-the-ram": {
    "id": "ring-of-the-ram",
    "name": "Ring of the Ram",
    "category": "magic-item",
    "subcategory": "ring",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A finely enchanted ring that grants a lasting boon while worn.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#d6b45c",
        "#5f6fa8"
      ],
      "iconShape": "ring",
      "glow": true,
      "notes": "precious band set with a faintly humming stone"
    }
  },
  "robe-of-eyes": {
    "id": "robe-of-eyes",
    "name": "Robe of Eyes",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "robe-of-scintillating-colors": {
    "id": "robe-of-scintillating-colors",
    "name": "Robe of Scintillating Colors",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "robe-of-stars": {
    "id": "robe-of-stars",
    "name": "Robe of Stars",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "robe-of-useful-items": {
    "id": "robe-of-useful-items",
    "name": "Robe of Useful Items",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "robe-of-the-archmagi": {
    "id": "robe-of-the-archmagi",
    "name": "Robe of the Archmagi",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#8c939c",
        "#4e5865"
      ],
      "iconShape": "armor",
      "glow": true,
      "notes": "finely crafted protective gear marked by enchantment"
    }
  },
  "rod-of-absorption": {
    "id": "rod-of-absorption",
    "name": "Rod of Absorption",
    "category": "magic-item",
    "subcategory": "rod",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical rod that channels a focused supernatural power.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "rod-of-alertness": {
    "id": "rod-of-alertness",
    "name": "Rod of Alertness",
    "category": "magic-item",
    "subcategory": "rod",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical rod that channels a focused supernatural power.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "rod-of-lordly-might": {
    "id": "rod-of-lordly-might",
    "name": "Rod of Lordly Might",
    "category": "magic-item",
    "subcategory": "rod",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical rod that channels a focused supernatural power.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "rod-of-rulership": {
    "id": "rod-of-rulership",
    "name": "Rod of Rulership",
    "category": "magic-item",
    "subcategory": "rod",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical rod that channels a focused supernatural power.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "rod-of-security": {
    "id": "rod-of-security",
    "name": "Rod of Security",
    "category": "magic-item",
    "subcategory": "rod",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A magical rod that channels a focused supernatural power.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "rope-of-climbing": {
    "id": "rope-of-climbing",
    "name": "Rope of Climbing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "rope-of-entanglement": {
    "id": "rope-of-entanglement",
    "name": "Rope of Entanglement",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "scarab-of-protection": {
    "id": "scarab-of-protection",
    "name": "Scarab of Protection",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 12
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "scimitar-of-speed": {
    "id": "scimitar-of-speed",
    "name": "Scimitar of Speed",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "spellguard-shield": {
    "id": "spellguard-shield",
    "name": "Spellguard Shield",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": 2,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#7d858f",
        "#b08a55"
      ],
      "iconShape": "shield",
      "glow": true,
      "notes": "reinforced shield face alive with subtle magic"
    }
  },
  "shield-of-missile-attraction": {
    "id": "shield-of-missile-attraction",
    "name": "Shield of Missile Attraction",
    "category": "magic-item",
    "subcategory": "armor",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": 2,
    "armorType": null,
    "acFormula": null,
    "text": "A magic defense item that protects its wearer better than mundane craftsmanship can manage.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7d858f",
        "#b08a55"
      ],
      "iconShape": "shield",
      "glow": true,
      "notes": "reinforced shield face alive with subtle magic"
    }
  },
  "slippers-of-spider-climbing": {
    "id": "slippers-of-spider-climbing",
    "name": "Slippers of Spider Climbing",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "sovereign-glue": {
    "id": "sovereign-glue",
    "name": "Sovereign Glue",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "sphere-of-annihilation": {
    "id": "sphere-of-annihilation",
    "name": "Sphere of Annihilation",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "staff-of-power": {
    "id": "staff-of-power",
    "name": "Staff of Power",
    "category": "magic-item",
    "subcategory": "staff",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A potent staff that stores magical power for repeated use.",
    "mech": {
      "type": "charges",
      "max": 20,
      "recharge": "2d8 + 4 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#8c6a43",
        "#b7b1a1"
      ],
      "iconShape": "staff",
      "glow": true,
      "notes": "engraved staff capped with a mystic fitting"
    }
  },
  "stone-of-good-luck": {
    "id": "stone-of-good-luck",
    "name": "Stone of Good Luck",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "effects": [
        {
          "type": "saving_throw_bonus",
          "amount": 1
        },
        {
          "type": "stat_bonus",
          "amount": 1,
          "target": "ability-checks"
        }
      ]
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#59c0d6",
        "#b7ecf6"
      ],
      "iconShape": "gem",
      "glow": true,
      "notes": "polished stone or crystal shining with inner light"
    }
  },
  "sun-blade": {
    "id": "sun-blade",
    "name": "Sun Blade",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "sword-of-life-stealing": {
    "id": "sword-of-life-stealing",
    "name": "Sword of Life Stealing",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "sword-of-sharpness": {
    "id": "sword-of-sharpness",
    "name": "Sword of Sharpness",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "sword-of-wounding": {
    "id": "sword-of-wounding",
    "name": "Sword of Wounding",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "talisman-of-pure-good": {
    "id": "talisman-of-pure-good",
    "name": "Talisman of Pure Good",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 7
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "talisman-of-ultimate-evil": {
    "id": "talisman-of-ultimate-evil",
    "name": "Talisman of Ultimate Evil",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "charges",
      "max": 6
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "talisman-of-the-sphere": {
    "id": "talisman-of-the-sphere",
    "name": "Talisman of the Sphere",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "tome-of-clear-thought": {
    "id": "tome-of-clear-thought",
    "name": "Tome of Clear Thought",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "tome-of-leadership-and-influence": {
    "id": "tome-of-leadership-and-influence",
    "name": "Tome of Leadership and Influence",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "tome-of-understanding": {
    "id": "tome-of-understanding",
    "name": "Tome of Understanding",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A mystic volume whose study changes the reader in lasting ways.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#70452f",
        "#d3c4a3"
      ],
      "iconShape": "book",
      "glow": true,
      "notes": "heavy volume with warded covers and gilded edges"
    }
  },
  "trident-of-fish-command": {
    "id": "trident-of-fish-command",
    "name": "Trident of Fish Command",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": {
      "dice": "1d6",
      "versatileDice": "1d8",
      "type": "piercing"
    },
    "properties": [
      "thrown",
      "versatile"
    ],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "universal-solvent": {
    "id": "universal-solvent",
    "name": "Universal Solvent",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "vicious-weapon": {
    "id": "vicious-weapon",
    "name": "Vicious Weapon",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "vorpal-sword": {
    "id": "vorpal-sword",
    "name": "Vorpal Sword",
    "category": "magic-item",
    "subcategory": "weapon",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "An enchanted armament prized for the supernatural edge it gives in battle.",
    "mech": {
      "type": "other"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#c0c0c0",
        "#8a6a3a"
      ],
      "iconShape": "sword",
      "glow": true,
      "notes": "weapon-grade steel outlined by a magical sheen"
    }
  },
  "wand-of-binding": {
    "id": "wand-of-binding",
    "name": "Wand of Binding",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn",
      "spell": "binding"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-enemy-detection": {
    "id": "wand-of-enemy-detection",
    "name": "Wand of Enemy Detection",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-fear": {
    "id": "wand-of-fear",
    "name": "Wand of Fear",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-fireballs": {
    "id": "wand-of-fireballs",
    "name": "Wand of Fireballs",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn",
      "spell": "fireballs"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-lightning-bolts": {
    "id": "wand-of-lightning-bolts",
    "name": "Wand of Lightning Bolts",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn",
      "spell": "lightning-bolts"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-magic-detection": {
    "id": "wand-of-magic-detection",
    "name": "Wand of Magic Detection",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-magic-missiles": {
    "id": "wand-of-magic-missiles",
    "name": "Wand of Magic Missiles",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn",
      "spell": "magic-missiles"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-paralysis": {
    "id": "wand-of-paralysis",
    "name": "Wand of Paralysis",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-polymorph": {
    "id": "wand-of-polymorph",
    "name": "Wand of Polymorph",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "very rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#7d4bc2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-secrets": {
    "id": "wand-of-secrets",
    "name": "Wand of Secrets",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 3,
      "recharge": "1d3 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-web": {
    "id": "wand-of-web",
    "name": "Wand of Web",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn",
      "spell": "web"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "wand-of-wonder": {
    "id": "wand-of-wonder",
    "name": "Wand of Wonder",
    "category": "magic-item",
    "subcategory": "wand",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A charged wand built to loose a specific magical effect again and again.",
    "mech": {
      "type": "charges",
      "max": 7,
      "recharge": "1d6 + 1 expended charges daily at dawn"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#7b5b3a",
        "#c9b28e"
      ],
      "iconShape": "wand",
      "glow": true,
      "notes": "slender focus etched with channels of power"
    }
  },
  "well-of-many-worlds": {
    "id": "well-of-many-worlds",
    "name": "Well of Many Worlds",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "legendary",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#d18b25",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "wind-fan": {
    "id": "wind-fan",
    "name": "Wind Fan",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": false,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "winged-boots": {
    "id": "winged-boots",
    "name": "Winged Boots",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "uncommon",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "other",
      "movement": "fly"
    },
    "visual": {
      "palette": [
        "#1f9d63",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  },
  "wings-of-flying": {
    "id": "wings-of-flying",
    "name": "Wings of Flying",
    "category": "magic-item",
    "subcategory": "wondrous-item",
    "cost": null,
    "weight": null,
    "rarity": "rare",
    "attunement": true,
    "damage": null,
    "properties": [],
    "ac": null,
    "armorType": null,
    "acFormula": null,
    "text": "A notable SRD magic item whose enchantment offers power, protection, or strange utility.",
    "mech": {
      "type": "narrative"
    },
    "visual": {
      "palette": [
        "#2b6fd2",
        "#9b8b73",
        "#d5ccb9"
      ],
      "iconShape": "misc",
      "glow": true,
      "notes": "well-made magical item carrying an unmistakable aura"
    }
  }
};
  return { ITEMS: ITEMS };
});
