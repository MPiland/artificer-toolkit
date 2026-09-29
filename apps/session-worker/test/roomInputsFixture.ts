import type {
  LiveRoomInputsResponse,
  LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'

export const ROOM_INPUTS_PATH = LIVE_SESSION_ROUTE_PATHS.roomInputs

const zero = '00000000-0000-4000-8000-000000000000'
const revisions = (['SYSTEM', 'CAMPAIGN', 'PLAY'] as const).map((scope) => ({
  scope,
  id: zero,
  revision: null
}))

/**
 * A room-inputs read for an Encounter with no Run documents: an empty Run, a Campaign play scope and
 * an absent System. Enough for a room to hydrate; tests of real Run data live with the store.
 */
export function roomInputsResponse(scope: LiveRoomInputsScope): LiveRoomInputsResponse {
  switch (scope.kind) {
    case 'RUN':
      return { kind: 'RUN', encounterVersion: 0, documents: [], continueCursor: null }
    case 'CAMPAIGN_PLAY':
      return {
        kind: 'CAMPAIGN_PLAY',
        revisions,
        campaign: {
          id: zero,
          gameSystemId: zero,
          ownerUserId: zero,
          contentMaturity: 'STANDARD',
          attunementSlotOverride: null,
          currencyOptions: []
        }
      }
    case 'SYSTEM':
      return { kind: 'SYSTEM', revisions, system: null, vocabulary: null }
    case 'DEFINITION':
      return { kind: 'DEFINITION', revisions, definition: null }
    case 'CHARACTERS':
      throw new Error('A Character read needs a real Character page.')
  }
}
