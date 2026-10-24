import { z, lazySchema } from '../zod.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { detailDtoSchema } from '../shared/detail.js'
import { featureDtoSchema } from '../features/feature.js'
import { costDtoSchema, weightDtoSchema } from './shared.js'
import { authoredRecordStatusSchema, vehicleCategoryCodeSchema } from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

export const vehicleAuthoredDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: z.optional(authoredRichTextSchema),
    status: z.optional(authoredRecordStatusSchema),
    details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema,
    category: vehicleCategoryCodeSchema,
    size: z.optional(systemCoreCodeSchema),
    armorClass: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    hitPoints: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    speed: z.optional(z.number().check(z.nonnegative())),
    speedNote: z.optional(authoredPlainTextSchema),
    crewMin: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    crewMax: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    passengerCapacity: z.optional(z.number().check(z.int()).check(z.nonnegative())),
    cargoCapacity: z.optional(authoredPlainTextSchema),
    weight: z.optional(weightDtoSchema),
    cost: z.optional(costDtoSchema),
    properties: z.optional(authoredReferenceCollectionSchema(authoredShortTextSchema)),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema))
  })
)

export const vehicleAuthoringInputDtoSchema = lazySchema(() =>
  z.extend(vehicleAuthoredDtoSchema, {
    userId: z.optional(authoredIdentifierSchema)
  })
)

export type VehicleAuthoredDto = z.infer<typeof vehicleAuthoredDtoSchema>
export type VehicleAuthoringInputDto = z.infer<typeof vehicleAuthoringInputDtoSchema>
