import { z } from 'zod'

import {
  raceAncestryDtoSchema,
} from './shared.js'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'

const raceBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

export const parentRaceAuthoredDtoSchema = raceBaseDtoSchema.extend({
  category: z.literal('BASE'),
  playable: z.boolean(),
  ancestry: raceAncestryDtoSchema.optional(),
  size: z.string(),
  speeds: z.array(speedDtoSchema)
})

export const subraceAuthoredDtoSchema = raceBaseDtoSchema.extend({
  category: z.literal('SUBRACE'),
  parentRaceId: z.string(),
  size: z.string().optional(),
  speeds: z.array(speedDtoSchema).optional()
})

export const raceAuthoredDtoSchema = z.union([
  parentRaceAuthoredDtoSchema,
  subraceAuthoredDtoSchema
])

export type RaceAuthoredDto = z.infer<typeof raceAuthoredDtoSchema>
