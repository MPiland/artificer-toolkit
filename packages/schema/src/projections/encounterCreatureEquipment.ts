import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'

/** Server-only provenance for an Encounter-owned Creature equipment overlay. */
export const encounterCreatureEquipmentReplacementSchema = lazySchema(() =>
  z.strictObject({
    actorId: postgresUuidSchema,
    loadoutEntryId: postgresUuidSchema,
    equipmentId: postgresUuidSchema,
    sourceRevision: z.number().check(z.int()).check(z.positive()),
    sourceVersionId: postgresUuidSchema,
    sourceChecksum: projectionChecksumSchema
  })
)
