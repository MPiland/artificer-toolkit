import { z, lazySchema } from '../zod.js'
import { uuidSchema } from '../api/campaignContractSchemas.js'
import { projectionChecksumSchema } from './identity.js'

// Keep database schema evaluation independent of the Sheet mechanics schema graph.
// ponytail: per-Character state is bounded by the document limit; partition only with complete atomic reads.
export const campaignStoredCharacterStateSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    characterId: uuidSchema,
    documentJson: z.string(),
    checksum: projectionChecksumSchema
  })
)
