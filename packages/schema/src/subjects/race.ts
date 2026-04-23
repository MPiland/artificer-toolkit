import { RACE_SELECTION_MODE } from '@artificer-toolkit/shared'
import { z } from 'zod'

import {
  raceAncestryDtoSchema,
} from './shared.js'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

const raceBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  userId: z.string(),
  systemId: z.string()
})

const baseRaceAuthoredDtoSchemaRaw: z.ZodTypeAny = raceBaseDtoSchema.extend({
  category: z.literal('BASE'),
  selectionMode: z.union([
    z.literal(RACE_SELECTION_MODE.DIRECT),
    z.literal(RACE_SELECTION_MODE.REQUIRES_SUBRACE)
  ]),
  ancestry: raceAncestryDtoSchema.optional(),
  heritageIds: z.array(z.string()).optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  size: z.string(),
  speeds: z.array(speedDtoSchema)
})

const subraceAuthoredDtoSchemaRaw: z.ZodTypeAny = raceBaseDtoSchema.extend({
  category: z.literal('SUBRACE'),
  parentRaceId: z.string(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional()
})

const raceAuthoredDtoSchemaRaw: z.ZodTypeAny = z.union([
  baseRaceAuthoredDtoSchemaRaw,
  subraceAuthoredDtoSchemaRaw
])

export type BaseRaceAuthoredDto = z.infer<typeof baseRaceAuthoredDtoSchemaRaw>
export type SubraceAuthoredDto = z.infer<typeof subraceAuthoredDtoSchemaRaw>
export type RaceAuthoredDto = BaseRaceAuthoredDto | SubraceAuthoredDto
const baseRaceAuthoredDtoSchemaBase: z.ZodTypeAny = baseRaceAuthoredDtoSchemaRaw
const subraceAuthoredDtoSchemaBase: z.ZodTypeAny = subraceAuthoredDtoSchemaRaw
const raceAuthoredDtoSchemaBase: z.ZodTypeAny = raceAuthoredDtoSchemaRaw
export const baseRaceAuthoredDtoSchema = baseRaceAuthoredDtoSchemaBase
export const subraceAuthoredDtoSchema = subraceAuthoredDtoSchemaBase
export const raceAuthoredDtoSchema = raceAuthoredDtoSchemaBase
