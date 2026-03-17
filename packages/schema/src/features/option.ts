import { z } from 'zod'

import { featureBaseDtoSchema } from './base.js'

export const featureOptionDtoSchema = featureBaseDtoSchema

export type FeatureOptionDto = z.infer<typeof featureOptionDtoSchema>
