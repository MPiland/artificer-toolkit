import type { SceneCharacterVision } from '@artificer-toolkit/shared/vtt'
import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { measurementUnitCodeSchema } from '../shared/enums.js'

// The same current Character/System/stream identity fences every internal mechanics read.
export const characterMechanicsReadInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  characterId: postgresUuidSchema,
  systemId: postgresUuidSchema,
  streamVersion: z.number().check(z.int()).check(z.nonnegative())
})

export const characterSceneVisionResultSchema: z.ZodMiniType<SceneCharacterVision> = z.strictObject(
  {
    characterId: z.string().check(z.uuid()),
    dimRange: z.nullable(
      z.strictObject({
        amount: z.number().check(z.positive()),
        unit: measurementUnitCodeSchema
      })
    )
  }
)

export type CharacterMechanicsReadInput = z.infer<typeof characterMechanicsReadInputSchema>
export type CharacterSceneVisionResult = z.infer<typeof characterSceneVisionResultSchema>
