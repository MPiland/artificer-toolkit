import { model } from 'mongoose'
import { featureSchema } from './helper/helperSchemas.js'

export const featSchema = featureSchema

export default model('Feat', featSchema)
