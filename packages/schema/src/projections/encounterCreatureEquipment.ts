import { z, lazySchema } from '../zod.js'
import { authoredStoredCompilationSchema } from '../api/authoredPublication.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'

/**
 * A Creature loadout entry's pinned Equipment: the stored compilation of the pinned version (the
 * resolved rules of a variant), as D163's retained rules pin theirs. Reads hydrate it; nothing compiles.
 */
export const encounterCreatureEquipmentSourceSchema = lazySchema(() =>
  z.strictObject({
    loadoutEntryId: postgresUuidSchema,
    equipmentId: postgresUuidSchema,
    sourceRevision: z.number().check(z.int()).check(z.positive()),
    sourceVersionId: postgresUuidSchema,
    sourceChecksum: projectionChecksumSchema,
    compilation: authoredStoredCompilationSchema
  })
)

export type EncounterCreatureEquipmentSourceDto = z.infer<
  typeof encounterCreatureEquipmentSourceSchema
>

/** Server-only provenance for an Encounter-owned Creature equipment overlay. */
export const encounterCreatureEquipmentReplacementSchema = lazySchema(() =>
  z.extend(z.omit(encounterCreatureEquipmentSourceSchema, { compilation: true }), {
    actorId: postgresUuidSchema
  })
)
