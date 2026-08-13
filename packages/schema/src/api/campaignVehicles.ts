import { z } from 'zod'

import {
  shortTextSchema,
  timestampSchema,
  uuidSchema,
  versionSchema
} from './campaignContractSchemas.js'

export const campaignVehicleDtoSchema = z.strictObject({
  id: uuidSchema,
  campaignId: uuidSchema,
  contentVersionId: uuidSchema,
  label: shortTextSchema.nullable(),
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
  contentVersionId: uuidSchema,
  label: shortTextSchema.nullable().optional()
})
export const updateCampaignVehicleInputSchema = z.strictObject({
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  label: shortTextSchema.nullable(),
  expectedVersion: versionSchema
})
export const deleteCampaignVehicleInputSchema = z.strictObject({
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  expectedVersion: versionSchema
})

export type CampaignVehicleDto = z.infer<typeof campaignVehicleDtoSchema>
export type CreateCampaignVehicleInput = z.input<typeof createCampaignVehicleInputSchema>
export type UpdateCampaignVehicleInput = z.input<typeof updateCampaignVehicleInputSchema>
