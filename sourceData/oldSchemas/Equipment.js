import { Schema, model } from 'mongoose'
import {
  featureSchema,
  builderPropertySchema,
  damageSchema,
  saveAbilitySchema,
  rangeSchema,
  requirementSchema,
} from './helper/helperSchemas.js'

export const equipmentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  index: String,
  name: String,
  desc: String,
  quote: String,
  cost: {
    amount: Number,
    currency: builderPropertySchema,
  },
  weight: {
    amount: Number,
    unit: builderPropertySchema,
  },
  capacity: {
    amount: Number,
    unit: builderPropertySchema,
  },
  contains: {
    type: [
      {
        item: {
          type: { type: builderPropertySchema },
          contains: {
            type: [
              {
                item: { type: { type: builderPropertySchema } },
                quantity: {
                  type: Number,
                  default: 1,
                },
              },
            ],
            default: undefined,
          },
        },
        quantity: {
          type: Number,
          default: 1,
        },
      },
    ],
    default: undefined,
  },
  maxStack: Number,
  quantity: {
    type: Number,
    default: 1,
  },
  category: builderPropertySchema,
  properties: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  itemRank: Number,
  rarity: builderPropertySchema,
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  damage: damageSchema,
  saveAbility: saveAbilitySchema,
  primaryAbility: { type: { type: builderPropertySchema } },
  secondaryAbility: { type: { type: builderPropertySchema } },
  maxBonus: Number,
  armorClass: Number,
  range: rangeSchema,
  feature: {
    type: [featureSchema],
    default: undefined,
  },
  requirements: requirementSchema.add({
    size: {
      type: [builderPropertySchema],
      default: undefined,
    },
  }),
  speed: {
    amount: Number,
    unit: builderPropertySchema,
  },
})

export default model('Equipment', equipmentSchema, 'equipment')
