import type {
  LiveSessionRoomAuthorization,
  LiveSessionRoomAuthorizationResponse
} from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { LiveSessionTransientMember } from '@artificer-toolkit/schema/api/liveSessionTransient'

export const ROOM_AUTHORIZATION_PATH = '/live-sessions/room-authorization'

/**
 * A full authorization read for a test room's members, as Convex returns it for a first load.
 * Duplicate members (one user's several sockets) collapse to one membership.
 */
export function roomAuthorizationResponse(input: {
  members: readonly LiveSessionTransientMember[]
  assignments?: LiveSessionRoomAuthorization['campaign']['assignments']
  characterRevisions?: LiveSessionRoomAuthorization['revisions']['characters']
  play?: LiveSessionRoomAuthorization['play']
}): LiveSessionRoomAuthorizationResponse {
  const members = [...new Map(input.members.map((member) => [member.userId, member])).values()]
  const ownerUserId =
    members.find((member) => member.role === 'OWNER')?.userId ?? crypto.randomUUID()
  const assignments = input.assignments ?? []
  const characterRevisions = input.characterRevisions ?? []
  return {
    revisions: {
      system: null,
      campaign: null,
      play: null,
      characters: characterRevisions,
      preferences: '0'.repeat(64)
    },
    campaign: { ownerUserId, members, assignments },
    characters: characterRevisions.map(({ characterId }) => ({
      characterId,
      ownerUserId:
        assignments.find((assignment) => assignment.characterId === characterId)?.userId ??
        ownerUserId,
      partyVisibility: { sheet: false, health: 'HIDDEN' }
    })),
    preferences: members.map(({ userId }) => ({ userId, autoRollDice: false, username: 'FixtureMember' })),
    play: input.play ?? { encounter: null }
  }
}
