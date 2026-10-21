import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import { hydrateNativeLiveSessionState } from './nativeLiveSessionState.js'
import { readRoomEncounterPlayAuthorization } from './roomEncounterCommands.js'
import type { RoomCommandHost } from './roomCommandHost.js'

/** The room state that overlays unpublished local play onto an authorization read. */
export type RoomLocalPlayAuthorizationHost = Pick<
  RoomCommandHost,
  'aggregateNeedsReload' | 'authorization' | 'cache' | 'journal' | 'roomCampaignId' | 'store'
>

export async function restoreLocalPlayAuthorization(
  host: RoomLocalPlayAuthorizationHost,
  authorization: LiveSessionRoomAuthorization
): Promise<LiveSessionRoomAuthorization> {
  const head = host.journal.readCurrent()
  if (
    !head ||
    host.aggregateNeedsReload() ||
    head.sequence === head.publishedSequence ||
    host.store.epoch !== head.authorityEpoch
  )
    return authorization
  host.store.assertAuthorityHead({
    epoch: head.authorityEpoch,
    sequence: head.sequence,
    checksum: head.stateChecksum
  })
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const sceneId =
    host.cache()?.scene?.id ??
    hydrateNativeLiveSessionState(head.stateJson).scene?.id ??
    authorization.play.encounter?.sceneId
  const play = await readRoomEncounterPlayAuthorization(
    { db: host.store.store },
    campaignId,
    authorization.play,
    sceneId ?? null
  )
  const nativeCharacters = new Map(
    host.store.documents('characterPlayStates').map((row) => [row.characterId, row])
  )
  const characters = authorization.characters.map((character) => {
    const local = nativeCharacters.get(character.characterId)
    if (!local) return character
    if (local.userId !== character.ownerUserId)
      throw new Error('Room Character visibility owner mismatch.')
    return {
      ...character,
      partyVisibility: readCharacterPlay(local).partyVisibility
    }
  })
  host.authorization.applyCharacters(head.authorityEpoch, characters)
  if (play) host.authorization.applyPlay(head.authorityEpoch, play)
  return { ...authorization, characters, play: play ?? authorization.play }
}
