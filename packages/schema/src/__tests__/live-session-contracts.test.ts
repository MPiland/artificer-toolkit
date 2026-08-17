import { describe, expect, it } from 'vitest'

import {
  liveSessionCommandDtoSchema,
  liveSessionExecutorRequestDtoSchema,
  liveSessionExecutorResponseDtoSchema,
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketClaimsDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER
} from '../api/liveSessions.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  session: '00000000-0000-4000-8000-000000000002',
  character: '00000000-0000-4000-8000-000000000003',
  encounter: '00000000-0000-4000-8000-000000000004',
  command: '00000000-0000-4000-8000-000000000005',
  scene: '00000000-0000-4000-8000-000000000006',
  token: '00000000-0000-4000-8000-000000000007',
  user: '00000000-0000-4000-8000-000000000008'
} as const

describe('live-session contracts', () => {
  it('accepts exact room identity and existing Character or Encounter commands', () => {
    expect(
      liveSessionJoinOptionsDtoSchema.parse({
        campaignId: ids.campaign,
        sessionId: ids.session
      })
    ).toEqual({ campaignId: ids.campaign, sessionId: ids.session })

    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'CHARACTER',
        characterId: ids.character,
        command: {
          type: 'SET_INSPIRATION',
          commandId: ids.command,
          expectedVersion: 3,
          inspired: true
        }
      }).aggregateKind
    ).toBe('CHARACTER')
    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'ENCOUNTER',
        command: {
          type: 'ADVANCE_TURN',
          encounterId: ids.encounter,
          commandId: ids.command,
          expectedVersion: 4
        }
      }).aggregateKind
    ).toBe('ENCOUNTER')
    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'SCENE',
        command: {
          commandId: ids.command,
          encounterId: ids.encounter,
          expectedSceneVersion: 4,
          position: { x: 10, y: 10 },
          sceneId: ids.scene,
          tokenId: ids.token,
          type: 'MOVE_SCENE_TOKEN'
        }
      }).aggregateKind
    ).toBe('SCENE')
    expect(
      liveSessionCommandDtoSchema.parse({
        aggregateKind: 'SCENE',
        command: {
          commandId: ids.command,
          encounterId: ids.encounter,
          sceneDefinitionId: ids.scene,
          type: 'ATTACH_SCENE'
        }
      }).command.type
    ).toBe('ATTACH_SCENE')
  })

  it('defines a short-lived room-ticket identity and a provider-only executor envelope', () => {
    expect(
      liveSessionTicketClaimsDtoSchema.parse({
        aud: LIVE_SESSION_TICKET_AUDIENCE,
        campaignId: ids.campaign,
        exp: 2,
        iat: 1,
        iss: LIVE_SESSION_TICKET_ISSUER,
        jti: ids.token,
        role: 'PLAYER',
        sessionId: ids.session,
        sub: ids.user,
        v: 1
      })
    ).toMatchObject({ campaignId: ids.campaign, role: 'PLAYER', sub: ids.user })

    expect(
      liveSessionExecutorRequestDtoSchema.parse({
        authorityId: 'durable-object-id',
        campaignId: ids.campaign,
        command: {
          aggregateKind: 'CHARACTER',
          characterId: ids.character,
          command: {
            commandId: ids.command,
            expectedVersion: 3,
            inspired: true,
            type: 'SET_INSPIRATION'
          }
        },
        operation: 'COMMAND',
        sceneVisionContext: { characterVisions: [], encounterCharacterBindings: [] },
        sessionId: ids.session,
        userId: ids.user
      }).operation
    ).toBe('COMMAND')

    expect(
      liveSessionExecutorResponseDtoSchema.parse({
        memberships: [{ role: 'PLAYER', userId: ids.user }],
        ok: true,
        operation: 'RENEW'
      })
    ).toEqual({
      memberships: [{ role: 'PLAYER', userId: ids.user }],
      ok: true,
      operation: 'RENEW'
    })
    expect(
      liveSessionExecutorResponseDtoSchema.safeParse({ ok: true, operation: 'RENEW' }).success
    ).toBe(false)
  })

  it('distinguishes committed native WebSocket messages by aggregate kind', () => {
    const base = {
      acceptedSequence: 1,
      deliverySequence: 1,
      originCommandId: ids.command,
      replayed: false,
      type: 'COMMAND_COMMITTED' as const,
      version: 1
    }
    expect(
      [
        liveSessionWebSocketServerMessageDtoSchema.parse({
          ...base,
          aggregateId: ids.character,
          aggregateKind: 'CHARACTER',
          response: null
        }),
        liveSessionWebSocketServerMessageDtoSchema.parse({
          ...base,
          aggregateId: ids.encounter,
          aggregateKind: 'ENCOUNTER',
          response: null
        }),
        liveSessionWebSocketServerMessageDtoSchema.parse({
          ...base,
          aggregateId: ids.scene,
          aggregateKind: 'SCENE',
          delta: null,
          snapshot: null
        })
      ].map((message) => (message.type === 'COMMAND_COMMITTED' ? message.aggregateKind : null))
    ).toEqual(['CHARACTER', 'ENCOUNTER', 'SCENE'])
  })
})
