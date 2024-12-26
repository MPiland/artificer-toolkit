import { Schema, model } from 'mongoose'
import { featureSchema, builderPropertySchema } from './helper/helperSchemas.js'

export const raceSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: String,
  value: String,
  desc: String,
  playable: builderPropertySchema,
  category: builderPropertySchema,
  lineage: {
    type: [builderPropertySchema],
    default: undefined,
  },
  ancestry: {
    name: String,
    value: String,
    desc: String,
    options: {
      type: [featureSchema],
      default: undefined,
    },
  },
  detail: {
    type: [builderPropertySchema],
    default: undefined,
  },
  traits: {
    area: {
      type: [builderPropertySchema],
      default: undefined,
    },
    size: builderPropertySchema,
    speed: {
      walking: Number,
      swimming: Number,
      flying: Number,
      climbing: Number,
    },
  },
  features: {
    type: [featureSchema],
    default: undefined,
  },
})

raceSchema.set('toObject', { minimize: true })

export default model('Race', raceSchema)
