import {
  liveSessionRecipientStateDtoSchema,
  type LiveSessionRecipientStateDto
} from '@artificer-toolkit/schema/api/liveSessions'
import {
  liveRoomSceneStateSchema,
  liveRoomStoredSceneStateSchema,
  type LiveRoomSceneState
} from '@artificer-toolkit/schema/api/liveRoomState'
import { canonicalizeJson, checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectSceneForViewer } from '@artificer-toolkit/shared/vtt'
type NativeLiveSessionState = LiveRoomSceneState

export function createNativeLiveSessionState(scene: NativeLiveSessionState['scene'] = null): {
  state: NativeLiveSessionState
  stateChecksum: string
  stateJson: string
} {
  const state = liveRoomSceneStateSchema.parse({ scene })
  const stateChecksum = checksumCanonicalJson(state)
  const stateJson = canonicalizeJson({ state, contentChecksum: stateChecksum })
  return { state, stateChecksum, stateJson }
}

export function hydrateNativeLiveSessionState(stateJson: string): NativeLiveSessionState {
  const encoded = liveRoomStoredSceneStateSchema.parse(JSON.parse(stateJson))
  if (checksumCanonicalJson(encoded.state) !== encoded.contentChecksum)
    throw new Error('Live Session state checksum mismatch.')
  return encoded.state
}

export function projectNativeLiveSessionState(
  state: NativeLiveSessionState,
  recipient: { role: 'OWNER' | 'PLAYER'; userId: string },
  presentationVersion: number | null
): LiveSessionRecipientStateDto {
  return liveSessionRecipientStateDtoSchema.parse({
    recipientRole: recipient.role,
    presentationVersion,
    scene: state.scene
      ? projectSceneForViewer(state.scene, {
          role: recipient.role === 'OWNER' ? 'GM' : 'PLAYER',
          userId: recipient.userId
        })
      : null
  })
}
