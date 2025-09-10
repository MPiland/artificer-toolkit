import { Schema, model } from 'mongoose'
import { featureSchema, equipmentSchema, proficiencySchema } from './helper/helperSchemas.js'

const backgroundSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  name: String,
  value: String,
  desc: String,
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
  equipment: {
    type: [equipmentSchema],
    default: undefined,
  },
  currency: {
    copper: Number,
    silver: Number,
    electrum: Number,
    gold: Number,
    platinum: Number,
  },
  proficiencies: {
    type: [proficiencySchema],
    default: undefined,
  },
  features: {
    type: [featureSchema],
    default: undefined,
  },
})

export default model('Background', backgroundSchema)
