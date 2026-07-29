import { RACE_SELECTION_MODE } from '@artificer-toolkit/shared/core'
import { z } from 'zod'

import { raceAncestryDtoSchema } from './shared.js'
import { detailDtoSchema, speedDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { authoredRecordStatusSchema, sizeCodeSchema } from '../shared/enums.js'

const raceBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  quote: z.string().optional(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  userId: z.string(),
  systemId: z.string()
})

const baseRaceAuthoredDtoSchemaInternal = raceBaseDtoSchema.extend({
  category: z.literal('BASE'),
  selectionMode: z.union([
    z.literal(RACE_SELECTION_MODE.DIRECT),
    z.literal(RACE_SELECTION_MODE.REQUIRES_SUBRACE)
  ]),
  ancestry: raceAncestryDtoSchema.optional(),
  heritageIds: z.array(z.string()).optional(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  size: sizeCodeSchema,
  speeds: z.array(speedDtoSchema)
})

const subraceAuthoredDtoSchemaInternal = raceBaseDtoSchema.extend({
  category: z.literal('SUBRACE'),
  parentRaceId: z.string(),
  details: z.array(detailDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional()
})

export const baseRaceAuthoredDtoSchema: typeof baseRaceAuthoredDtoSchemaInternal =
  baseRaceAuthoredDtoSchemaInternal
export const subraceAuthoredDtoSchema: typeof subraceAuthoredDtoSchemaInternal =
  subraceAuthoredDtoSchemaInternal

export type BaseRaceAuthoredDto = z.infer<typeof baseRaceAuthoredDtoSchema>
export type SubraceAuthoredDto = z.infer<typeof subraceAuthoredDtoSchema>
export type RaceAuthoredDto = BaseRaceAuthoredDto | SubraceAuthoredDto

export const raceAuthoredDtoSchema: z.ZodType<RaceAuthoredDto> = z.discriminatedUnion('category', [
  baseRaceAuthoredDtoSchema,
  subraceAuthoredDtoSchema
])

const baseRaceAuthoringInputDtoSchemaInternal = baseRaceAuthoredDtoSchema.extend({
  userId: z.string().optional()
})
const subraceAuthoringInputDtoSchemaInternal = subraceAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export const baseRaceAuthoringInputDtoSchema: typeof baseRaceAuthoringInputDtoSchemaInternal =
  baseRaceAuthoringInputDtoSchemaInternal
export const subraceAuthoringInputDtoSchema: typeof subraceAuthoringInputDtoSchemaInternal =
  subraceAuthoringInputDtoSchemaInternal

export type BaseRaceAuthoringInputDto = z.infer<typeof baseRaceAuthoringInputDtoSchema>
export type SubraceAuthoringInputDto = z.infer<typeof subraceAuthoringInputDtoSchema>
export type RaceAuthoringInputDto = BaseRaceAuthoringInputDto | SubraceAuthoringInputDto

export const raceAuthoringInputDtoSchema: z.ZodType<RaceAuthoringInputDto> = z.discriminatedUnion(
  'category',
  [baseRaceAuthoringInputDtoSchema, subraceAuthoringInputDtoSchema]
)
