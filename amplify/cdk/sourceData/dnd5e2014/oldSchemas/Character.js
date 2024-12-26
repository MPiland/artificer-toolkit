import { Schema, model } from 'mongoose'
import { builderPropertySchema, diceSchema, chargeSchema } from './helper/helperSchemas.js'
import { equipmentSchema } from './Equipment.js'

const genericSchema = new Schema({
  featureId: { type: Schema.Types.ObjectId },
  level: builderPropertySchema,
  type: { type: [builderPropertySchema], default: undefined },
  classId: { type: Schema.Types.ObjectId, ref: 'Class' },
  raceId: { type: Schema.Types.ObjectId, ref: 'Race' },
  ancestryId: { type: Schema.Types.ObjectId, ref: 'Race' },
  itemId: { type: Schema.Types.ObjectId, ref: 'Item' },
  backgroundId: { type: Schema.Types.ObjectId, ref: 'Background' },
  featId: { type: Schema.Types.ObjectId, ref: 'Feat' },
})

const modSchema = new Schema({
  mode: builderPropertySchema,
  method: builderPropertySchema,
  modAbility: { type: { type: builderPropertySchema } },
  modSkill: { type: { type: builderPropertySchema } },
  multiplier: Number,
  maxAmount: Number,
  minAmount: Number,
  setAmount: Number,
  value: Number,
  setPerLevel: {
    type: [
      {
        level: String,
        value: Number,
      },
    ],
    default: undefined,
  },
  dicePerLevel: {
    type: [{ level: Number, dieCount: Number, dieValue: Number }],
    default: undefined,
  },
  dieCount: Number,
  dieValue: Number,
})

const featureSchema = new Schema({
  levelAvailable: {
    type: String,
    default: undefined,
  },
  desc: String,
  option: builderPropertySchema,
  targets: Number,
})

const spellSchema = new Schema({
  ability: builderPropertySchema,
  isRitual: Boolean,
  countAsKnown: Boolean,
  usesSlot: Boolean,
  isPrepared: Boolean,
  castAtLevel: Boolean,
  dieCount: Number,
  dieValue: Number,
})

const rollSchema = new Schema({
  score: Number,
  ability: builderPropertySchema,
  rolling: Boolean,
  applied: Boolean,
  rolled: {
    type: [{ type: Number, value: Number }],
    default: undefined,
  },
  kept: {
    type: [{ type: Number, value: Number }],
    default: undefined,
  },
})

const characterSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', require: true },
  name: String,
  value: String,
  race: builderPropertySchema,
  advancement: builderPropertySchema,
  abilities: {
    manualRolled: {
      rollConfigurationInputs: {
        quantity: Number,
        type: Number,
        reduceType: String,
        reduceCount: Number,
        rerollType: String,
        rerollCondition: String,
        rerollValue: Number,
      },
      rolls: {
        type: [[rollSchema]],
        default: undefined,
      },
      manual: {
        type: [
          {
            ability: builderPropertySchema,
            score: Number,
          },
        ],
        default: undefined,
      },
    },
    pointBuy: {
      pointsLeft: Number,
      distributed: {
        type: [
          {
            ability: builderPropertySchema,
            pointBuy: builderPropertySchema.add({
              reduce: Number,
            }),
          },
        ],
        default: undefined,
      },
    },
    standardArray: {
      type: [
        {
          ability: builderPropertySchema,
          score: Number,
        },
      ],
      default: undefined,
    },
    selectedSystem: builderPropertySchema,
    scores: {
      type: [
        {
          name: String,
          value: String,
          _id: { type: Schema.Types.ObjectId, ref: 'Builder' },
          baseScore: Number,
          raceScore: Number,
          classScore: Number,
          calculatedScore: Number,
          modifier: {
            type: [modSchema],
          },
        },
      ],
      default: undefined,
    },
  },
  ancestry: {
    lineage: {
      type: [
        {
          name: String,
          value: String,
          desc: String,
          _id: { type: Schema.Types.ObjectId, ref: 'Race' },
          raceId: { type: Schema.Types.ObjectId, ref: 'Race' },
        },
      ],
      default: undefined,
    },
    name: String,
    value: String,
    desc: String,
    _id: { type: Schema.Types.ObjectId, ref: 'Race' },
    raceId: { type: Schema.Types.ObjectId, ref: 'Race' },
  },
  class: [
    {
      hitpoint: diceSchema,
      name: String,
      value: String,
      level: String,
      _id: { type: Schema.Types.ObjectId, ref: 'Class' },
      spellList: {
        prepared: {
          type: [
            {
              level: Number,
              spells: {
                type: [spellSchema],
                default: undefined,
              },
            },
          ],
          default: undefined,
        },
        known: {
          type: [
            {
              level: Number,
              spells: {
                type: [spellSchema],
                default: undefined,
              },
            },
          ],
          default: undefined,
        },
        additional: {
          type: [spellSchema],
          default: undefined,
        },
      },
      subClass: {
        name: String,
        value: String,
        _id: { type: Schema.Types.ObjectId, ref: 'Class' },
        spellcasting: {
          magicName: String,
          ability: { type: { type: builderPropertySchema } },
          maxSpellLevel: Number,
          attribute: {
            type: [builderPropertySchema],
            default: undefined,
          },
          charge: { reset: builderPropertySchema },
          prepareLimitMethod: {
            type: [builderPropertySchema],
            default: undefined,
          },
          prepareLimitLevel: {
            measurement: builderPropertySchema,
            rounding: builderPropertySchema,
          },
        },
        levelAttribute: {
          type: [
            {
              level: Number,
              spellSlots: {
                type: [
                  {
                    slotCount: Number,
                  },
                ],
                default: undefined,
              },
              resourcePoints: Number,
              spellsKnown: Number,
              proficiency: Number,
            },
          ],
          default: undefined,
        },
        resource: builderPropertySchema.add({
          levelAvailable: Number,
          charge: chargeSchema,
          method: builderPropertySchema,
        }),
        subtype: builderPropertySchema,
      },
      spellcasting: {
        magicName: String,
        ability: { type: { type: builderPropertySchema } },
        maxSpellLevel: Number,
        attribute: {
          type: [builderPropertySchema],
          default: undefined,
        },
        charge: { reset: builderPropertySchema },
        prepareLimitMethod: {
          type: [builderPropertySchema],
          default: undefined,
        },
        prepareLimitLevel: {
          measurement: builderPropertySchema,
          rounding: builderPropertySchema,
        },
      },
      levelAttribute: {
        type: [
          {
            level: Number,
            spellSlots: {
              type: [
                {
                  slotCount: Number,
                },
              ],
              default: undefined,
            },
            resourcePoints: Number,
            spellsKnown: Number,
            proficiency: Number,
          },
        ],
        default: undefined,
      },
      resource: builderPropertySchema.add({
        levelAvailable: Number,
        charge: chargeSchema,
        method: builderPropertySchema,
      }),
      features: {
        available: {
          type: [
            {
              level: Number,
              features: {
                type: [featureSchema],
                default: undefined,
              },
            },
          ],
        },
        unavailable: {
          type: [
            {
              level: Number,
              features: {
                type: [featureSchema],
                default: undefined,
              },
            },
          ],
        },
      },
    },
  ],
  startingEquipment: {
    option: builderPropertySchema,
  },
  equipment: {
    type: [equipmentSchema],
    default: undefined,
  },
  proficiencies: {
    skill: {
      type: [modSchema.add(builderPropertySchema)],
      default: undefined,
    },
    language: {
      type: [modSchema.add(builderPropertySchema)],
      default: undefined,
    },
    item: {
      type: [modSchema.add(builderPropertySchema)],
      default: undefined,
    },
    property: {
      type: [modSchema.add(builderPropertySchema)],
      default: undefined,
    },
    saveAbility: {
      type: {
        type: [modSchema.add(builderPropertySchema)],
        default: undefined,
      },
    },
  },
  modifiers: {
    armorClass: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    saveAbility: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    spellSlot: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    skills: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    abilities: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    meleeAttack: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    rangeAttack: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    unarmedAttack: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    unarmedDamage: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    spellAttack: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    spellDC: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    damageType: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    spellDamage: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    passive: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    speed: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    condition: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    proficiencyBonus: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    initiative: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    hitpoints: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    meleeDamage: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    rangeDamage: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    damageSave: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    conditionSave: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    limitUse: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
    spell: {
      type: [modSchema.add(genericSchema)],
      default: undefined,
    },
  },
  senses: {
    type: [modSchema.add(builderPropertySchema)],
    default: undefined,
  },
})

characterSchema.set('toObject', { minimize: true, virtuals: true })

export default model('Character', characterSchema)
