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

const parentRaceAuthoredDtoSchemaRaw: z.ZodTypeAny = raceBaseDtoSchema.extend({
  category: z.literal('BASE'),
  playable: z.boolean(),
  ancestry: raceAncestryDtoSchema.optional(),
  size: z.string(),
  speeds: z.array(speedDtoSchema)
})

const subraceAuthoredDtoSchemaRaw: z.ZodTypeAny = raceBaseDtoSchema.extend({
  category: z.literal('SUBRACE'),
  parentRaceId: z.string(),
  size: z.string().optional(),
  speeds: z.array(speedDtoSchema).optional()
})

const raceAuthoredDtoSchemaRaw: z.ZodTypeAny = z.union([
  parentRaceAuthoredDtoSchemaRaw,
  subraceAuthoredDtoSchemaRaw
])

export type ParentRaceAuthoredDto = z.infer<typeof parentRaceAuthoredDtoSchemaRaw>
export type SubraceAuthoredDto = z.infer<typeof subraceAuthoredDtoSchemaRaw>
export type RaceAuthoredDto = ParentRaceAuthoredDto | SubraceAuthoredDto
const parentRaceAuthoredDtoSchemaBase: z.ZodTypeAny = parentRaceAuthoredDtoSchemaRaw
const subraceAuthoredDtoSchemaBase: z.ZodTypeAny = subraceAuthoredDtoSchemaRaw
const raceAuthoredDtoSchemaBase: z.ZodTypeAny = raceAuthoredDtoSchemaRaw
export const parentRaceAuthoredDtoSchema = parentRaceAuthoredDtoSchemaBase
export const subraceAuthoredDtoSchema = subraceAuthoredDtoSchemaBase
export const raceAuthoredDtoSchema = raceAuthoredDtoSchemaBase
