import type { SceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { lengthUnitCodeSchema } from '../shared/enums.js'
import {
  combatPerceptionChannelDtoSchema,
  combatPerceptionIlluminationAccessDtoSchema
} from '../shared/combatPerception.js'

// The same current Character/System/stream identity fences every internal mechanics read.
export const characterMechanicsReadInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    characterId: postgresUuidSchema,
    systemId: postgresUuidSchema,
    streamVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

export const characterSceneVisionResultSchema: z.ZodMiniType<SceneCharacterVision> = lazySchema(
  () =>
    z.strictObject({
      characterId: z.string().check(z.uuid()),
      senses: z
        .array(
          z.strictObject({
            channel: combatPerceptionChannelDtoSchema,
            illuminationAccess: combatPerceptionIlluminationAccessDtoSchema,
            label: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)),
            range: z.strictObject({
              amount: z.number().check(z.positive()),
              unit: lengthUnitCodeSchema
            }),
            senseId: postgresUuidSchema
          })
        )
        .check(z.maxLength(100))
    })
)
