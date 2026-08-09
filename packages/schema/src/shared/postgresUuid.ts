import { z } from 'zod'

// PostgreSQL accepts UUID values without an RFC version nibble. Seeded/master records use
// that space for deterministic IDs, while user-authored/runtime IDs remain strict UUIDs.
export const postgresUuidSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
