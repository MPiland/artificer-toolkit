import type { LiveSessionWebSocketServerMessageDto } from '@artificer-toolkit/schema/api/liveSessions'
import { describe, expect, it } from 'vitest'
import { RoomEncounterReads } from './roomEncounterReads.js'
import { RoomEncounterStore } from './roomEncounterStore.js'
import { RoomInputs } from './roomInputs.js'
import { createNodeSqliteRoomStorage } from './testing/nodeSqliteRoomStorage.js'

const campaignId = '00000000-0000-4000-8000-000000000002'
const encounterId = '00000000-0000-4000-8000-000000000001'
const member = {
  membershipEpoch: '2026-09-28T00:00:00.000Z',
  role: 'PLAYER' as const,
  userId: '00000000-0000-4000-8000-000000000003'
}
const read = { kind: 'LATEST_EVIDENCE_ROLLS', input: { encounterId } } as const

function reads(admitted: typeof member | null) {
  const { storage } = createNodeSqliteRoomStorage()
  const store = new RoomEncounterStore(storage)
  const sent: LiveSessionWebSocketServerMessageDto[] = []
  const neverRead = () => Promise.reject(new Error('The room must not read Convex.'))
  return {
    sent,
    reads: new RoomEncounterReads({
      store,
      inputs: new RoomInputs(store, neverRead, neverRead),
      authorization: () => null,
      admission: () => admitted,
      scope: () => ({ authorityEpoch: '00000000-0000-4000-8000-000000000004', campaignId }),
      presentedSceneId: () => null,
      sceneTokens: () => async () => null,
      send: (_socket, message) => sent.push(message)
    })
  }
}

describe('room Encounter reads', () => {
  it('refuses a socket that is not an admitted member as a change of authority', async () => {
    const { reads: room, sent } = reads(null)
    await room.answer(Object.create(WebSocket.prototype), { read, requestId: encounterId })
    expect(sent).toEqual([
      {
        code: 'AUTHORITY_CHANGED',
        message: 'Live Session authority changed.',
        reason: null,
        requestId: encounterId,
        type: 'ENCOUNTER_READ_REJECTED'
      }
    ])
  })

  it('refuses a read while the room holds no current authorization', async () => {
    const { reads: room, sent } = reads(member)
    await room.answer(Object.create(WebSocket.prototype), { read, requestId: encounterId })
    expect(sent).toMatchObject([{ code: 'AUTHORITY_CHANGED', type: 'ENCOUNTER_READ_REJECTED' }])
  })
})
