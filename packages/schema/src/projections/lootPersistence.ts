import { z, lazySchema } from '../zod.js'
import { lootDocumentSchema } from '../api/lootTables.js'

/** GM-only reference data. It is never part of a Scene definition save or a live Scene. */
export const storedLootSchema = lazySchema(() =>
  z.extend(lootDocumentSchema, { updatedAt: z.iso.datetime() })
)
