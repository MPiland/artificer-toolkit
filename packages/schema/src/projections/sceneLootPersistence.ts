import { z, lazySchema } from '../zod.js'
import { sceneLootDocumentSchema } from '../api/sceneLootTables.js'

/** GM-only reference data. It is never part of a Scene definition save or a live Scene. */
export const sceneStoredLootSchema = lazySchema(() =>
  z.extend(sceneLootDocumentSchema, { updatedAt: z.iso.datetime() })
)
