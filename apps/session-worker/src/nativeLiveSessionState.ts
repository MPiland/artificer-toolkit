import {
  liveSessionRecipientStateDtoSchema,
  type LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { campaignSceneStateDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
import { z } from 'zod'

const nativeLiveSessionStateSchema = z.strictObject({
  scene: z.nullable(campaignSceneStateDtoSchema)
})

export type NativeLiveSessionState = z.infer<typeof nativeLiveSessionStateSchema>

export function createNativeLiveSessionState(scene: NativeLiveSessionState['scene'] = null): {
  state: NativeLiveSessionState
  stateChecksum: string
  stateJson: string
} {
  const state = nativeLiveSessionStateSchema.parse({ scene })
  const stateJson = canonicalizeJson(state)
  return { state, stateChecksum: checksumCanonicalJson(state), stateJson }
}

export function hydrateNativeLiveSessionState(
  stateJson: string,
  stateChecksum: string
): NativeLiveSessionState {
  const encoded: unknown = JSON.parse(stateJson)
  if (checksumCanonicalJson(encoded) !== stateChecksum)
    throw new Error('Live Session state checksum mismatch.')
  return z.object({ scene: z.nullable(campaignSceneStateDtoSchema).default(null) }).parse(encoded)
}

export function projectNativeLiveSessionState(
  state: NativeLiveSessionState,
  recipient: { role: 'OWNER' | 'PLAYER'; userId: string }
): LiveSessionRecipientStateDto {
  return liveSessionRecipientStateDtoSchema.parse({
    recipientRole: recipient.role,
    scene: state.scene
      ? projectSceneForViewer(state.scene, {
          role: recipient.role === 'OWNER' ? 'GM' : 'PLAYER',
          userId: recipient.userId
        })
      : null
  })
}
