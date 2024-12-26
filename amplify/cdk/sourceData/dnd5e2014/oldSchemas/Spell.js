import { Schema, model } from 'mongoose'
import {
  builderPropertySchema,
  damageSchema,
  saveAbilitySchema,
  rangeSchema,
  shapeSchema,
} from './helper/helperSchemas.js'

export const spellSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: String,
  value: String,
  desc: String,
  level: Number,
  school: builderPropertySchema,
  classes: {
    type: [builderPropertySchema],
    default: undefined,
  },
  attribute: {
    type: [builderPropertySchema],
    default: undefined,
  },
  damage: damageSchema,
  upcast: {
    attribute: {
      type: [builderPropertySchema],
      default: undefined,
    },
    levelAttribute: {
      type: [
        {
          level: Number,
          damage: damageSchema,
          duration: {
            type: { type: builderPropertySchema },
            value: Number,
          },
          range: rangeSchema,
          shape: shapeSchema,
          targets: Number,
        },
      ],
      default: undefined,
    },
  },
  targets: {
    type: Number,
    default: 1,
  },
  saveAbility: saveAbilitySchema,
  condition: {
    type: {
      type: [builderPropertySchema],
      default: undefined,
    },
  },
  action: {
    type: { type: builderPropertySchema },
    value: String,
  },
  secondaryAction: {
    type: { type: builderPropertySchema },
    value: String,
  },
  duration: {
    type: { type: builderPropertySchema },
    value: Number,
  },
  range: rangeSchema,
  shape: shapeSchema,
  requirements: {
    type: [builderPropertySchema],
    default: undefined,
  },
  materialDesc: String,
})

spellSchema.set('toObject', { minimize: true, virtuals: true })

export default model('Spell', spellSchema)
