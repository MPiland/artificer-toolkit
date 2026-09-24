import { z } from '../zod.js'
import { postgresUuidSchema } from './postgresUuid.js'

export const encounterBlueprintMetadataDtoSchema = z.strictObject({
  id: postgresUuidSchema,
  gameSystemId: postgresUuidSchema,
  name: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
  version: z.number().check(z.int()).check(z.nonnegative()),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  setupChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/))
})
