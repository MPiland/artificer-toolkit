import { Schema, model } from 'mongoose'
import {
  featureSchema,
  builderPropertySchema,
  proficiencySchema,
  chargeSchema,
  diceSchema,
  equipmentSchema,
} from './helper/helperSchemas.js'

export const classSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', require: true },
  name: String,
  value: String,
  desc: String,
  category: builderPropertySchema,
  detail: {
    type: [
      {
        name: String,
        value: String,
        desc: String,
      },
    ],
    default: undefined,
  },
  hitpoint: diceSchema.add({ ability: builderPropertySchema }),
  startingGold: diceSchema.add({
    multiplier: Number,
    currency: builderPropertySchema,
  }),
  equipment: {
    type: [
      {
        option: {
          type: [
            {
              group: {
                type: [equipmentSchema],
                default: undefined,
              },
            },
          ],
          default: undefined,
        },
      },
    ],
    default: undefined,
  },
  proficiencies: {
    type: [proficiencySchema],
    default: undefined,
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
        cantripsKnown: Number,
      },
    ],
    default: undefined,
  },
  resource: builderPropertySchema.add({
    levelAvailable: Number,
    charge: chargeSchema,
    method: builderPropertySchema,
  }),
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  multiclass: {
    primaryAbility: {
      type: { type: builderPropertySchema },
      minAmount: Number,
    },
    optionalAbility: {
      type: { type: builderPropertySchema },
      minAmount: Number,
    },
    secondaryAbility: {
      type: { type: builderPropertySchema },
      minAmount: Number,
    },
  },
  parentClass: builderPropertySchema,
  subtype: {
    type: [builderPropertySchema],
    default: undefined,
  },
  features: {
    type: [featureSchema.add({ selectionCount: Number })],
    default: undefined,
  },
})

classSchema.set('toObject', { minimize: true, virtuals: true })

export default model('Class', classSchema)
