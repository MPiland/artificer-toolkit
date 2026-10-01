import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

/** One active Run's hold on a Character's play state, fenced by its Campaign room epoch. */
export const liveCharacterHoldSchema = lazySchema(() =>
  z.strictObject({
    characterId: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    epoch: postgresUuidSchema
  })
)

export type LiveCharacterHold = z.infer<typeof liveCharacterHoldSchema>
