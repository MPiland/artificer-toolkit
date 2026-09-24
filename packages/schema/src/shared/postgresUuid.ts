import { z } from '../zod.js'

// PostgreSQL accepts UUID values without an RFC version nibble. Seeded/master records use
// that space for deterministic IDs, while user-authored/runtime IDs remain strict UUIDs.
export const postgresUuidSchema = z.pipe(
  z.string().check(z.regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)),
  z.transform((value) => value.toLowerCase())
)
