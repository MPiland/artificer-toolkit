import { z } from '../zod.js'

import {
  shortTextSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const campaignVehicleDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  vehicleDefinitionId: uuidSchema,
  label: z.nullable(shortTextSchema),
  availability: z.optional(z.enum(['AVAILABLE', 'UNAVAILABLE'])),
  version: versionSchema,
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignVehiclesDtoSchema = z.array(campaignVehicleDtoSchema)
export const listCampaignVehiclesInputSchema = z.strictObject({
  campaignId: uuidSchema
})
export const createCampaignVehicleInputSchema = z.strictObject({
  campaignId: uuidSchema,
  vehicleDefinitionId: uuidSchema,
  label: z.optional(z.nullable(shortTextSchema))
})
export const updateCampaignVehicleInputSchema = z.strictObject({
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  label: z.nullable(shortTextSchema),
  expectedVersion: versionSchema
})
export const deleteCampaignVehicleInputSchema = z.strictObject({
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  expectedVersion: versionSchema
})

const campaignVehicleLifecycleFields = {
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  expectedVersion: versionSchema,
  idempotencyKey: uuidSchema
}
export const campaignVehicleLifecycleInputSchema = z.discriminatedUnion('action', [
  z.strictObject({
    ...campaignVehicleLifecycleFields,
    action: z.literal('MAKE_UNAVAILABLE')
  }),
  z.strictObject({
    ...campaignVehicleLifecycleFields,
    action: z.literal('RESTORE')
  }),
  z.strictObject({
    ...campaignVehicleLifecycleFields,
    action: z.literal('REMOVE_RETURN_CARGO'),
    expectedInventoryVersion: versionSchema,
    expectedPartyInventoryVersion: versionSchema
  }),
  z.strictObject({
    ...campaignVehicleLifecycleFields,
    action: z.literal('REMOVE_DESTROY_CARGO'),
    expectedInventoryVersion: versionSchema
  })
])
export const campaignVehicleLifecyclePayloadSchema = z.discriminatedUnion('action', [
  z.strictObject({
    action: z.literal('MAKE_UNAVAILABLE'),
    vehicleId: uuidSchema,
    availability: z.literal('UNAVAILABLE')
  }),
  z.strictObject({
    action: z.literal('RESTORE'),
    vehicleId: uuidSchema,
    availability: z.literal('AVAILABLE')
  }),
  z.strictObject({
    action: z.literal('REMOVE_RETURN_CARGO'),
    vehicleId: uuidSchema,
    vehicleDefinitionId: uuidSchema,
    transferredTopLevelItemIds: z.array(uuidSchema),
    transferredCurrencyGroupIds: z.array(uuidSchema),
    sourceInventoryVersion: versionSchema,
    destinationInventoryVersion: versionSchema
  }),
  z.strictObject({
    action: z.literal('REMOVE_DESTROY_CARGO'),
    vehicleId: uuidSchema,
    itemCount: versionSchema,
    currencyGroupCount: versionSchema,
    currencyCount: versionSchema
  })
])
export type CampaignVehicleLifecyclePayload = z.infer<typeof campaignVehicleLifecyclePayloadSchema>
export const campaignVehicleLifecycleResultSchema = z.strictObject({
  eventId: uuidSchema,
  cleanupJobId: z.optional(uuidSchema)
})
export type CampaignVehicleLifecycleInput = z.input<typeof campaignVehicleLifecycleInputSchema>
export type CampaignVehicleLifecycleResult = z.infer<typeof campaignVehicleLifecycleResultSchema>

export type CampaignVehicleDto = z.infer<typeof campaignVehicleDtoSchema>
export type CreateCampaignVehicleInput = z.input<typeof createCampaignVehicleInputSchema>
export type UpdateCampaignVehicleInput = z.input<typeof updateCampaignVehicleInputSchema>
