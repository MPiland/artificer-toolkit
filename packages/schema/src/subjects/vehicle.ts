import { z } from 'zod'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredPlainTextSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema,
  detailDtoSchema
} from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { costDtoSchema } from './shared.js'
import {
  authoredRecordStatusSchema,
  sizeCodeSchema,
  vehicleCategoryCodeSchema
} from '../shared/enums.js'

export const vehicleAuthoredDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema.optional(),
  status: authoredRecordStatusSchema.optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema,
  category: vehicleCategoryCodeSchema,
  size: sizeCodeSchema.optional(),
  armorClass: z.number().int().nonnegative().optional(),
  hitPoints: z.number().int().nonnegative().optional(),
  speed: z.number().int().nonnegative().optional(),
  speedNote: authoredPlainTextSchema.optional(),
  crewMin: z.number().int().nonnegative().optional(),
  crewMax: z.number().int().nonnegative().optional(),
  passengerCapacity: z.number().int().nonnegative().optional(),
  cargoCapacity: authoredPlainTextSchema.optional(),
  cost: costDtoSchema.optional(),
  properties: authoredReferenceCollectionSchema(authoredShortTextSchema).optional(),
  features: authoredNestedCollectionSchema(featureDtoSchema).optional()
})

export const vehicleAuthoringInputDtoSchema = vehicleAuthoredDtoSchema.extend({
  userId: authoredIdentifierSchema.optional()
})

export type VehicleAuthoredDto = z.infer<typeof vehicleAuthoredDtoSchema>
export type VehicleAuthoringInputDto = z.infer<typeof vehicleAuthoringInputDtoSchema>
