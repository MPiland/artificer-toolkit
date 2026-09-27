import { z, lazySchema } from '../zod.js'
import { encounterBlueprintMetadataDtoSchema } from '../shared/encounterBlueprint.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const encounterStoredBlueprintSchema = lazySchema(() =>
  z.extend(encounterBlueprintMetadataDtoSchema, {
    ownerUserId: postgresUuidSchema,
    enemiesJson: z.string(),
    commandId: postgresUuidSchema,
    commandFingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/))
  })
)

export const encounterStoredBlueprintUpdateSchema = lazySchema(() =>
  z.strictObject({
    ownerUserId: postgresUuidSchema,
    blueprintId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
    resultJson: z.string(),
    createdAt: z.iso.datetime()
  })
)
