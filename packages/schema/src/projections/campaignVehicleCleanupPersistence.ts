import { z } from '../zod.js'
import { timestampSchema, uuidSchema, versionSchema } from '../api/campaignContractSchemas.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { campaignVehicleDtoSchema } from '../api/campaignVehicles.js'

const count = z.number().check(z.int(), z.gte(0), z.lte(Number.MAX_SAFE_INTEGER))
const amount = count
export const campaignStoredVehicleSchema = z.extend(campaignVehicleDtoSchema, {
  cleanupJobId: z.optional(uuidSchema)
})
export const vehicleCleanupPhaseSchema = z.enum([
  'VALIDATE_ITEMS',
  'VALIDATE_GROUPS',
  'VALIDATE_CURRENCIES',
  'VALIDATE_TOTALS',
  'APPLY_ITEMS',
  'APPLY_GROUPS',
  'APPLY_CURRENCIES',
  'APPLY_TOTALS',
  'FINALIZE',
  'RELEASE',
  'PURGE_SOURCE',
  'PURGE_MARKERS'
])
export const vehicleCleanupGrantSchema = z.strictObject({
  campaignId: uuidSchema,
  campaignVersion: versionSchema,
  vehicleId: uuidSchema,
  vehicleVersion: versionSchema,
  sourceInventoryVersion: versionSchema,
  actorUserId: uuidSchema,
  eventId: uuidSchema,
  commandId: z.optional(uuidSchema),
  inputFingerprint: projectionChecksumSchema,
  removalEventId: z.optional(uuidSchema),
  mode: z.enum(['RETURN', 'DESTROY']),
  beforeAvailability: z.enum(['AVAILABLE', 'UNAVAILABLE']),
  label: z.nullable(z.string()),
  vehicleDefinitionId: uuidSchema
})
export const vehicleCleanupCountsSchema = z.strictObject({
  items: count,
  topLevelItems: count,
  currencyGroups: count,
  currencies: count
})
export const campaignStoredVehicleCleanupSchema = z.strictObject({
  id: uuidSchema,
  grant: vehicleCleanupGrantSchema,
  grantChecksum: projectionChecksumSchema,
  status: z.enum(['RUNNING', 'FAILED', 'COMPLETED', 'PURGED']),
  phase: vehicleCleanupPhaseSchema,
  cursor: z.nullable(z.string()),
  pageDone: z.boolean(),
  pending: z
    .array(
      z.strictObject({
        id: postgresUuidSchema,
        slow: z.nullable(postgresUuidSchema),
        fast: z.nullable(postgresUuidSchema)
      })
    )
    .check(z.maxLength(8)),
  validated: vehicleCleanupCountsSchema,
  applied: vehicleCleanupCountsSchema,
  sequence: count,
  applyStarted: z.boolean(),
  releaseComplete: z.boolean(),
  purgeTable: z.number().check(z.int(), z.gte(0), z.lte(3)),
  sourceInventoryVersion: versionSchema,
  destinationInventoryVersion: z.nullable(versionSchema),
  failureReason: z.nullable(z.string().check(z.maxLength(500))),
  createdAt: timestampSchema,
  updatedAt: timestampSchema
})
export const campaignStoredVehicleCleanupTotalSchema = z.strictObject({
  jobId: uuidSchema,
  campaignCurrencySystemId: z.optional(uuidSchema),
  denominationId: postgresUuidSchema,
  sourceAmount: z.string().check(z.regex(/^(0|[1-9][0-9]*)$/)),
  targetId: z.nullable(uuidSchema),
  targetBeforeAmount: amount,
  placeholder: z.boolean(),
  locked: z.boolean(),
  applied: z.boolean()
})
export const campaignStoredVehicleCleanupSegmentSchema = z.strictObject({
  jobId: uuidSchema,
  sequence: count,
  phase: vehicleCleanupPhaseSchema,
  ids: z.array(postgresUuidSchema).check(z.maxLength(8)),
  beforeAmounts: z.array(amount).check(z.maxLength(8)),
  afterAmounts: z.array(amount).check(z.maxLength(8)),
  createdAt: timestampSchema
})
export const vehicleCleanupAcknowledgementSchema = z.strictObject({
  jobId: uuidSchema,
  campaignId: uuidSchema,
  vehicleId: uuidSchema,
  eventId: uuidSchema,
  status: z.enum(['RUNNING', 'FAILED', 'COMPLETED', 'PURGED'])
})
export const vehicleCleanupProgressSchema = z.extend(vehicleCleanupAcknowledgementSchema, {
  phase: vehicleCleanupPhaseSchema,
  validated: vehicleCleanupCountsSchema,
  applied: vehicleCleanupCountsSchema,
  retryReady: z.boolean(),
  failureReason: z.nullable(z.string().check(z.maxLength(500)))
})
export const vehicleCleanupSummarySchema = z.strictObject({
  jobId: uuidSchema,
  vehicleId: uuidSchema,
  vehicleDefinitionId: uuidSchema,
  removalEventId: z.optional(uuidSchema),
  mode: z.enum(['RETURN', 'DESTROY']),
  counts: vehicleCleanupCountsSchema,
  sourceInventoryVersion: versionSchema,
  destinationInventoryVersion: z.nullable(versionSchema)
})
export type VehicleCleanupGrant = z.infer<typeof vehicleCleanupGrantSchema>
export type VehicleCleanupJob = z.infer<typeof campaignStoredVehicleCleanupSchema>
export type VehicleCleanupAcknowledgement = z.infer<typeof vehicleCleanupAcknowledgementSchema>
export type VehicleCleanupProgress = z.infer<typeof vehicleCleanupProgressSchema>
