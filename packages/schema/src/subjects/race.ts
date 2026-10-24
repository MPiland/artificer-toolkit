import { RACE_SELECTION_MODE } from '@artificer-toolkit/shared/core'
import { z, lazySchema } from '../zod.js'

import { raceAncestryDtoSchema } from './shared.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { detailDtoSchema } from '../shared/detail.js'
import { speedDtoSchema } from '../shared/speed.js'
import { featureDtoSchema } from '../features/feature.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const raceBaseDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    quote: z.optional(authoredRichTextSchema),
    description: z.optional(authoredRichTextSchema),
    status: z.optional(authoredRecordStatusSchema),
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema
  })
)

const baseRaceAuthoredDtoSchemaInternal = lazySchema(() =>
  z.extend(raceBaseDtoSchema, {
    category: z.literal('BASE'),
    selectionMode: z.union([
      z.literal(RACE_SELECTION_MODE.DIRECT),
      z.literal(RACE_SELECTION_MODE.REQUIRES_SUBRACE)
    ]),
    ancestry: z.optional(raceAncestryDtoSchema),
    heritageIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
    details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
    size: systemCoreCodeSchema,
    speeds: authoredNestedCollectionSchema(speedDtoSchema)
  })
)

const subraceAuthoredDtoSchemaInternal = lazySchema(() =>
  z.extend(raceBaseDtoSchema, {
    category: z.literal('SUBRACE'),
    parentRaceId: authoredIdentifierSchema,
    details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema))
  })
)

export const baseRaceAuthoredDtoSchema: typeof baseRaceAuthoredDtoSchemaInternal =
  baseRaceAuthoredDtoSchemaInternal
export const subraceAuthoredDtoSchema: typeof subraceAuthoredDtoSchemaInternal =
  subraceAuthoredDtoSchemaInternal

export type BaseRaceAuthoredDto = z.infer<typeof baseRaceAuthoredDtoSchema>
export type SubraceAuthoredDto = z.infer<typeof subraceAuthoredDtoSchema>
export type RaceAuthoredDto = BaseRaceAuthoredDto | SubraceAuthoredDto

export const raceAuthoredDtoSchema: z.ZodMiniType<RaceAuthoredDto> = lazySchema(() =>
  z.discriminatedUnion('category', [baseRaceAuthoredDtoSchema, subraceAuthoredDtoSchema])
)

const baseRaceAuthoringInputDtoSchemaInternal = lazySchema(() =>
  z.extend(baseRaceAuthoredDtoSchema, {
    userId: z.optional(authoredIdentifierSchema)
  })
)
const subraceAuthoringInputDtoSchemaInternal = lazySchema(() =>
  z.extend(subraceAuthoredDtoSchema, {
    userId: z.optional(authoredIdentifierSchema)
  })
)

export const baseRaceAuthoringInputDtoSchema: typeof baseRaceAuthoringInputDtoSchemaInternal =
  baseRaceAuthoringInputDtoSchemaInternal
export const subraceAuthoringInputDtoSchema: typeof subraceAuthoringInputDtoSchemaInternal =
  subraceAuthoringInputDtoSchemaInternal

export type BaseRaceAuthoringInputDto = z.infer<typeof baseRaceAuthoringInputDtoSchema>
export type SubraceAuthoringInputDto = z.infer<typeof subraceAuthoringInputDtoSchema>
export type RaceAuthoringInputDto = BaseRaceAuthoringInputDto | SubraceAuthoringInputDto

export const raceAuthoringInputDtoSchema: z.ZodMiniType<RaceAuthoringInputDto> = lazySchema(() =>
  z.discriminatedUnion('category', [
    baseRaceAuthoringInputDtoSchema,
    subraceAuthoringInputDtoSchema
  ])
)
