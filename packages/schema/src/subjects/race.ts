import { RACE_SELECTION_MODE } from '@artificer-toolkit/shared'
import { z } from 'zod'

import {
  raceAncestryDtoSchema
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

export const baseRaceAuthoredDtoSchema = raceBaseDtoSchema.extend({
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

export const subraceAuthoredDtoSchema = raceBaseDtoSchema.extend({
  category: z.literal('SUBRACE'),
  parentRaceId: z.string(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional()
})

export type BaseRaceAuthoredDto = z.infer<typeof baseRaceAuthoredDtoSchema>
export type SubraceAuthoredDto = z.infer<typeof subraceAuthoredDtoSchema>
export type RaceAuthoredDto = BaseRaceAuthoredDto | SubraceAuthoredDto

export const raceAuthoredDtoSchema: z.ZodType<RaceAuthoredDto> = z.discriminatedUnion('category', [
  baseRaceAuthoredDtoSchema,
  subraceAuthoredDtoSchema
])

export const baseRaceAuthoringInputDtoSchema = baseRaceAuthoredDtoSchema.extend({
  userId: z.string().optional()
})
export const subraceAuthoringInputDtoSchema = subraceAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export type BaseRaceAuthoringInputDto = z.infer<typeof baseRaceAuthoringInputDtoSchema>
export type SubraceAuthoringInputDto = z.infer<typeof subraceAuthoringInputDtoSchema>
export type RaceAuthoringInputDto = BaseRaceAuthoringInputDto | SubraceAuthoringInputDto

export const raceAuthoringInputDtoSchema: z.ZodType<RaceAuthoringInputDto> = z.discriminatedUnion('category', [
  baseRaceAuthoringInputDtoSchema,
  subraceAuthoringInputDtoSchema
])
