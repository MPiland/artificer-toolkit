import { Schema } from 'mongoose'

// Helper schemas
export const builderPropertySchema = new Schema({
  name: String,
  value: String,
  setAmount: Number,
  short: String,
  minAmount: Number,
  _id: { type: Schema.Types.ObjectId },
  level: Number,
  desc: String,
})

builderPropertySchema.add({
  options: {
    type: [builderPropertySchema],
    default: undefined,
  },
})

export const diceSchema = new Schema({
  dieCount: Number,
  dieValue: builderPropertySchema,
})

export const genericDamageSchema = diceSchema.add({
  attribute: builderPropertySchema,
  type: { type: builderPropertySchema },
  setAmount: Number,
  multiplier: Number,
  minAmount: Number,
  maxAmount: Number,
  ability: { type: { type: builderPropertySchema } },
  pool: {
    attribute: builderPropertySchema,
    multiplier: Number,
    minAmount: Number,
    maxAmount: Number,
    setAmount: Number,
    options: builderPropertySchema,
    ability: { type: { type: builderPropertySchema } },
  },
})

export const damageSchema = new Schema({
  attribute: { type: [builderPropertySchema], default: undefined },
  primary: genericDamageSchema,
  secondary: genericDamageSchema,
  bonus: genericDamageSchema,
  versatile: genericDamageSchema,
  damageSave: {
    type: [builderPropertySchema],
    default: undefined,
  },
  type: {
    type: [builderPropertySchema],
    default: undefined,
  },
  setPerLevel: {
    type: [
      {
        level: String,
        primary: Number,
        secondary: Number,
        bonus: Number,
      },
    ],
    default: undefined,
  },
  diePerLevel: {
    type: [
      {
        level: String,
        primary: genericDamageSchema,
        bonus: genericDamageSchema,
        secondary: genericDamageSchema,
      },
    ],
    default: undefined,
  },
})

export const chargeSchema = new Schema({
  reset: builderPropertySchema,
  limit: builderPropertySchema,
  abilities: { type: { type: builderPropertySchema } },
  skills: { type: { type: builderPropertySchema } },
  level: {
    type: [
      {
        value: Number,
        useNum: Number,
      },
    ],
    default: undefined,
  },
  resourcePoints: Number,
  minAmount: Number,
  addAmount: Number,
  setAmount: Number,
  multiplier: Number,
})

export const rangeSchema = new Schema({
  type: { type: builderPropertySchema },
  minRange: Number,
  maxRange: Number,
  distance: Number,
  unit: builderPropertySchema,
})

export const shapeSchema = new Schema({
  type: { type: builderPropertySchema },
  size: Number,
  unit: builderPropertySchema,
})

export const requirementSchema = new Schema({
  options: {
    type: [builderPropertySchema],
    default: undefined,
  },
  skillProficiency: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  itemProficiency: {
    type: [
      {
        category: builderPropertySchema,
        item: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
        property: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
      },
    ],
    default: undefined,
  },
  equipped: {
    type: [
      {
        numberEquipped: Number,
        category: builderPropertySchema,
        items: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
        properties: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
      },
    ],
    default: undefined,
  },
  notEquipped: {
    type: [
      {
        category: builderPropertySchema,
        items: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
        properties: {
          type: {
            type: [builderPropertySchema],
            default: undefined,
          },
        },
      },
    ],
    default: undefined,
  },
  abilityScore: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
    score: Number,
  },
  spellKnown: {
    spell: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  featureKnown: {
    feature: {
      type: [builderPropertySchema],
      default: undefined,
    },
    options: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
})

export const saveAbilitySchema = new Schema({
  type: { type: builderPropertySchema },
  minAmount: Number,
  attribute: { type: [builderPropertySchema], default: undefined },
  abilityModifier: {
    type: { type: builderPropertySchema },
  },
})

export const equipmentSchema = new Schema({
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  selectionCount: Number,
  category: builderPropertySchema,
  item: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  properties: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  quantity: Number,
})

export const featSchema = new Schema({
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  type: {
    type: [builderPropertySchema],
    default: undefined,
  },
  selectionCount: Number,
  subtype: builderPropertySchema,
})

export const genericModSchema = new Schema({
  mode: builderPropertySchema,
  method: builderPropertySchema,
  modAbility: { type: { type: builderPropertySchema } },
  modSkill: { type: { type: builderPropertySchema } },
  multiplier: Number,
  maxAmount: Number,
  minAmount: Number,
  setAmount: Number,
  value: Number,
  type: { type: [builderPropertySchema], default: undefined },
  setPerLevel: {
    type: [
      {
        level: String,
        value: Number,
      },
    ],
    default: undefined,
  },
  diePerLevel: {
    type: [diceSchema.add({ level: Number })],
    default: undefined,
  },
  dieCount: Number,
  dieValue: Number,
  subtype: builderPropertySchema,
})

genericModSchema.add({
  spellDamage: genericModSchema,
  spellRange: genericModSchema,
  spellShape: genericModSchema,
  spellDuration: genericModSchema,
})

export const modifierSchema = new Schema({
  attribute: { type: [builderPropertySchema], default: undefined },
  selectionCount: Number,
  category: builderPropertySchema,
  armorClass: genericModSchema,
  saveAbility: genericModSchema,
  spellSlot: genericModSchema,
  skills: genericModSchema,
  abilities: genericModSchema,
  meleeAttack: genericModSchema,
  rangeAttack: genericModSchema,
  unarmedAttack: genericModSchema,
  unarmedDamage: genericModSchema,
  spellAttack: genericModSchema,
  spellDC: genericModSchema,
  damage: genericModSchema,
  spellDamage: genericModSchema,
  passive: genericModSchema,
  speed: genericModSchema,
  condition: genericModSchema,
  proficiencyBonus: genericModSchema,
  initiative: genericModSchema,
  hitpoints: genericModSchema,
  meleeDamage: genericModSchema,
  rangeDamage: genericModSchema,
  damageSave: genericModSchema,
  conditionSave: genericModSchema,
  modifierAbility: genericModSchema,
  optionalModifierAbility: genericModSchema,
  charge: genericModSchema,
  spells: genericModSchema,
})

const genericProfSchema = new Schema({
  subtype: builderPropertySchema,
  level: builderPropertySchema,
  rounding: builderPropertySchema,
  type: { type: [builderPropertySchema], default: undefined },
  category: builderPropertySchema,
})

export const proficiencySchema = new Schema({
  attribute: { type: [builderPropertySchema], default: undefined },
  selectionCount: Number,
  category: builderPropertySchema,
  abilities: genericProfSchema,
  skills: genericProfSchema,
  languages: genericProfSchema,
  properties: genericProfSchema,
  items: genericProfSchema.add({
    properties: {
      type: {
        type: [builderPropertySchema],
        default: undefined,
      },
    },
  }),
  saveAbility: genericProfSchema,
})

export const senseSchema = new Schema({
  attribute: { type: [builderPropertySchema], default: undefined },
  selectionCount: Number,
  subtype: builderPropertySchema,
  type: { type: [builderPropertySchema], default: undefined },
})

export const spellSchema = new Schema({
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  selectionCount: Number,
  classLimit: {
    type: [builderPropertySchema],
    default: undefined,
  },
  levelLimit: builderPropertySchema,
  type: {
    type: [builderPropertySchema],
    default: undefined,
  },
  attributeLimit: {
    type: [builderPropertySchema],
    default: undefined,
  },
  ability: builderPropertySchema,
  spellLevel: Number,
  spellsByLevel: {
    type: [
      {
        spell: {
          type: [builderPropertySchema],
          default: undefined,
        },
        level: builderPropertySchema,
        spellLevel: Number,
      },
    ],
    default: undefined,
  },
  subtype: builderPropertySchema,
})

export const ancestrySchema = new Schema({
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  origin: builderPropertySchema,
  options: {
    type: [builderPropertySchema],
    default: undefined,
  },
  selectionCount: Number,
  subtype: builderPropertySchema,
})

const genericFeatureSchema = new Schema({
  desc: String,
  detail: String,
  name: String,
  value: String,
  levelAvailable: String,
  type: {
    type: builderPropertySchema,
  },
  ancestry: {
    type: [ancestrySchema],
    default: undefined,
  },
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  action: { type: { type: builderPropertySchema } },
  damage: damageSchema,
  charge: chargeSchema,
  range: rangeSchema,
  shape: shapeSchema,
  targets: Number,
  feats: {
    type: [featSchema],
    default: undefined,
  },
  modifiers: {
    type: [modifierSchema],
    default: undefined,
  },
  proficiencies: {
    type: [proficiencySchema],
    default: undefined,
  },
  expertise: {
    type: [
      proficiencySchema.remove({
        level: builderPropertySchema,
      }),
    ],
    default: undefined,
  },
  sense: {
    type: [senseSchema],
    default: undefined,
  },
  spells: {
    type: [spellSchema],
    default: undefined,
  },
  requirements: requirementSchema,
  saveAbility: saveAbilitySchema,
})

export const featureSchema = genericFeatureSchema.add({
  feature: {
    type: [genericFeatureSchema],
    default: undefined,
  },
  options: {
    type: [genericFeatureSchema],
    default: undefined,
  },
})

diceSchema.virtual('diceShort').get(function () {
  if (this.dieCount && this.dieValue) {
    if (this.dieValue.value === 1) {
      return this.dieCount
    } else {
      return this.dieCount + 'd' + this.dieValue.value
    }
  }
})
