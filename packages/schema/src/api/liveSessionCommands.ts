import { z } from '../zod.js'
import {
  campaignSceneStateDtoSchema,
  sceneCommandInputDtoSchema,
  sceneCommandResultDtoSchema
} from './vttScenes.js'

const uuidSchema = z.string().check(z.uuid())
export const liveSessionSequenceDtoSchema = z
  .number()
  .check(z.int())
  .check(z.nonnegative())
  .check(z.lte(Number.MAX_SAFE_INTEGER))

export const liveSessionCommandDtoSchema = z.strictObject({
  scope: z.literal('SCENE'),
  command: sceneCommandInputDtoSchema
})

export const liveSessionRecipientStateDtoSchema = z.strictObject({
  recipientRole: z.enum(['OWNER', 'PLAYER']),
  scene: z.nullable(campaignSceneStateDtoSchema)
})

export const liveSessionRecipientDeltaDtoSchema = z.discriminatedUnion('scope', [
  z.strictObject({ scope: z.literal('SCENE'), result: sceneCommandResultDtoSchema }),
  z.strictObject({
    scope: z.literal('SCENE_VERSION'),
    sceneId: uuidSchema,
    version: liveSessionSequenceDtoSchema
  })
])

export const liveSessionCorrectionDtoSchema = z.strictObject({
  scope: z.literal('SCENE'),
  state: campaignSceneStateDtoSchema
})

export const liveSessionCommandRejectionCodeDtoSchema = z.enum([
  'AUTHORITY_CHANGED',
  'FORBIDDEN',
  'INVALID_COMMAND',
  'SESSION_CLOSED',
  'STALE_SEQUENCE',
  'STALE_STATE',
  'UNAVAILABLE'
])

export type LiveSessionCommandDto = z.infer<typeof liveSessionCommandDtoSchema>
export type LiveSessionRecipientStateDto = z.infer<typeof liveSessionRecipientStateDtoSchema>
export type LiveSessionRecipientDeltaDto = z.infer<typeof liveSessionRecipientDeltaDtoSchema>
export type LiveSessionCorrectionDto = z.infer<typeof liveSessionCorrectionDtoSchema>
export type LiveSessionCommandRejectionCodeDto = z.infer<
  typeof liveSessionCommandRejectionCodeDtoSchema
>
