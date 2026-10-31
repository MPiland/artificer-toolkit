import { describe, expect, it } from 'vitest'

import {
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketAdmissionDtoSchema,
  liveSessionTicketClaimsDtoSchema,
  liveSessionWebSocketClientMessageDtoSchema,
  liveSessionWebSocketServerMessageDtoSchema,
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION
} from '../api/liveSessions.js'
import {
  liveSessionPublishInputSchema,
  liveSessionPublishResponseSchema
} from '../api/liveSessionState.js'
import { domainRejectionErrorDataSchema } from '../api/domainRejections.js'
import {
  encounterActionTargetModifiersDtoSchema,
  getEncounterActionTargetModifiersInputDtoSchema
} from '../api/encounterActionTargetModifiers.js'
import { liveSessionEncounterBasicActionCommandSchema } from '../api/liveSessionCommandScopes.js'
import {
  resolveEncounterActionInputDtoSchema,
  revertLastEncounterActionInputDtoSchema
} from '../api/encounterRuleCommands.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  session: '00000000-0000-4000-8000-000000000002',
  scene: '00000000-0000-4000-8000-000000000003',
  token: '00000000-0000-4000-8000-000000000004',
  barrier: '00000000-0000-4000-8000-000000000010',
  user: '00000000-0000-4000-8000-000000000005',
  authorityEpoch: '00000000-0000-4000-8000-000000000006',
  character: '00000000-0000-4000-8000-000000000007',
  encounter: '00000000-0000-4000-8000-000000000008',
  command: '00000000-0000-4000-8000-000000000009'
} as const

const envelope = {
  baselineVersion: 1,
  audience: 'TABLE',
  kind: 'PING' as const,
  position: { x: 4, y: 8 },
  sceneId: ids.scene,
  sequence: 2
}

const scene = {
  annotations: [],
  ambientIllumination: 'BRIGHT' as const,
  daylight: false,
  barriers: [],
  campaignId: ids.campaign,
  darknessZones: [],
  definitionId: ids.scene,
  definitionVersion: 1,
  doorStates: {},
  fogLayers: [],
  fogMode: 'SHARED_PARTY' as const,
  grid: {
    cellSize: 50,
    diagonalPolicy: 'EQUAL' as const,
    distancePerCell: 5,
    kind: 'SQUARE' as const,
    origin: { x: 0, y: 0 },
    unit: 'FEET' as const
  },
  id: ids.scene,
  lights: [],
  map: { assetId: ids.token, height: 1_000, tileManifestAssetId: null, width: 1_000 },
  measurements: [],
  name: 'Dungeon',
  tokens: [],
  version: 2,
  visionRevealMode: 'ON_DRAG' as const
}

describe('live-session contracts', () => {
  it('defines the exact room and short-lived ticket identity', () => {
    expect(liveSessionJoinOptionsDtoSchema.parse({ campaignId: ids.campaign })).toEqual({
      campaignId: ids.campaign
    })
    // The retired Session-scoped join shape is refused.
    expect(
      liveSessionJoinOptionsDtoSchema.safeParse({
        campaignId: ids.campaign,
        sessionId: ids.session
      }).success
    ).toBe(false)

    expect(
      liveSessionTicketAdmissionDtoSchema.parse({
        authorityEpoch: ids.authorityEpoch,
        campaignId: ids.campaign,
        role: 'PLAYER',
        sub: ids.user
      })
    ).toEqual({
      authorityEpoch: ids.authorityEpoch,
      campaignId: ids.campaign,
      role: 'PLAYER',
      sub: ids.user
    })
    expect(
      liveSessionTicketClaimsDtoSchema.safeParse({
        aud: LIVE_SESSION_TICKET_AUDIENCE,
        authorityEpoch: ids.authorityEpoch,
        campaignId: ids.campaign,
        exp: 2,
        iat: 1,
        iss: LIVE_SESSION_TICKET_ISSUER,
        jti: ids.token,
        role: 'PLAYER',
        sub: ids.user,
        v: LIVE_SESSION_TICKET_VERSION
      }).success
    ).toBe(false)
    expect(
      liveSessionTicketClaimsDtoSchema.parse({
        aud: LIVE_SESSION_TICKET_AUDIENCE,
        authSubject: 'better-auth-user',
        authorityEpoch: ids.authorityEpoch,
        campaignId: ids.campaign,
        exp: 2,
        iat: 1,
        iss: LIVE_SESSION_TICKET_ISSUER,
        jti: ids.token,
        role: 'PLAYER',
        sub: ids.user,
        v: LIVE_SESSION_TICKET_VERSION
      })
    ).toMatchObject({
      authSubject: 'better-auth-user',
      authorityEpoch: ids.authorityEpoch,
      campaignId: ids.campaign,
      role: 'PLAYER',
      sub: ids.user
    })
  })

  it('accepts durable commands and resume while preserving transient messages', () => {
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({
        accessToken: 'access-token',
        type: 'AUTHENTICATE'
      })
    ).toEqual({ accessToken: 'access-token', type: 'AUTHENTICATE' })
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({ envelope, type: 'TRANSIENT' })
    ).toEqual({ envelope, type: 'TRANSIENT' })

    const characterCommand = {
      type: 'COMMAND' as const,
      expectedSessionSequence: 7,
      command: {
        scope: 'CHARACTER_SHEET' as const,
        characterId: ids.character,
        command: {
          commandId: ids.command,
          expectedVersion: 4,
          type: 'ADJUST_HIT_POINTS' as const,
          mode: 'DAMAGE' as const,
          amount: 3
        }
      }
    }
    expect(liveSessionWebSocketClientMessageDtoSchema.safeParse(characterCommand).success).toBe(
      false
    )
    const sceneCommand = {
      type: 'COMMAND' as const,
      expectedSessionSequence: 7,
      command: {
        scope: 'SCENE' as const,
        command: {
          commandId: ids.command,
          expectedSceneVersion: 2,
          sceneId: ids.scene,
          type: 'SET_SCENE_VISION_REVEAL_MODE' as const,
          mode: 'ON_DROP' as const
        }
      }
    }
    expect(liveSessionWebSocketClientMessageDtoSchema.parse(sceneCommand)).toEqual(sceneCommand)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({
        type: 'COMMAND',
        expectedSessionSequence: 7,
        command: {
          scope: 'ENCOUNTER',
          command: {
            commandId: ids.command,
            encounterId: ids.encounter,
            expectedVersion: 3,
            type: 'SET_ROUND',
            round: 2
          }
        }
      }).success
    ).toBe(true)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({
        expectedPresentationVersion: 5,
        sceneId: ids.scene,
        type: 'SYNCHRONIZE_SCENE',
        version: 2
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({
        lastAppliedSequence: 6,
        type: 'RESUME'
      })
    ).toEqual({ lastAppliedSequence: 6, type: 'RESUME' })

    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({
        ...sceneCommand,
        expectedSessionSequence: -1
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({
        ...sceneCommand,
        unvalidated: true
      }).success
    ).toBe(false)
  })

  it('accepts only Scene state for either recipient role', () => {
    for (const recipientRole of ['OWNER', 'PLAYER'] as const) {
      const message = {
        authorityEpoch: ids.authorityEpoch,
        sequence: 8,
        state: { presentationVersion: 4, recipientRole, scene },
        type: 'STATE_SYNC'
      }
      expect(liveSessionWebSocketServerMessageDtoSchema.parse(message)).toEqual(message)
      for (const extra of [{ characters: [] }, { encounter: null }, { notes: {} }]) {
        expect(
          liveSessionWebSocketServerMessageDtoSchema.safeParse({
            ...message,
            state: { ...message.state, ...extra }
          }).success
        ).toBe(false)
      }
    }
  })

  it('accepts commits and typed corrections without an accepted intermediate state', () => {
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId: ids.command,
        delta: {
          scope: 'SCENE',
          result: {
            commandId: ids.command,
            delta: { barrierId: ids.barrier, kind: 'DOOR_STATE_SET', state: 'OPEN' },
            occurrence: null,
            replayed: false,
            sceneId: ids.scene,
            version: 3
          }
        },
        sequence: 9,
        type: 'COMMAND_COMMITTED'
      })
    ).toMatchObject({ commandId: ids.command, sequence: 9 })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId: ids.command,
        delta: {
          scope: 'SCENE_VERSION',
          sceneId: ids.scene,
          version: 3
        },
        sequence: 10,
        type: 'COMMAND_COMMITTED'
      })
    ).toMatchObject({
      delta: { scope: 'SCENE_VERSION', sceneId: ids.scene, version: 3 }
    })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        commandId: ids.command,
        delta: null,
        sequence: 10,
        type: 'COMMAND_COMMITTED'
      })
    ).toEqual({
      commandId: ids.command,
      delta: null,
      sequence: 10,
      type: 'COMMAND_COMMITTED'
    })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        commandId: ids.command,
        sequence: 10,
        type: 'COMMAND_COMMITTED'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        code: 'STALE_STATE',
        commandId: ids.command,
        correction: { scope: 'SCENE', state: scene },
        currentSequence: 9,
        message: 'Scene state changed.',
        reason: null,
        warnings: null,
        type: 'COMMAND_REJECTED'
      })
    ).toMatchObject({ commandId: ids.command, code: 'STALE_STATE', currentSequence: 9 })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        code: 'DOMAIN_REJECTED',
        commandId: ids.command,
        currentSequence: 9,
        message: 'Encounter version is stale.',
        reason: 'VERSION_STALE',
        warnings: null,
        type: 'COMMAND_REJECTED'
      })
    ).toMatchObject({ code: 'DOMAIN_REJECTED', reason: 'VERSION_STALE' })
    const warnings = [
      { code: 'ACTION_ECONOMY_UNAVAILABLE', message: 'No bonus action left this turn.' },
      { code: 'TARGET_OUT_OF_RANGE', message: 'The target is out of range.' }
    ]
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        code: 'DOMAIN_REJECTED',
        commandId: ids.command,
        currentSequence: 9,
        message: 'This action breaks a rule. Do it anyway?',
        reason: 'RULE_WARNINGS',
        warnings,
        type: 'COMMAND_REJECTED'
      })
    ).toMatchObject({ reason: 'RULE_WARNINGS', warnings })
    // Rule warnings are a discriminated rejection: required for RULE_WARNINGS, refused otherwise.
    const rejection = { code: 'DOMAIN_REJECTED', message: 'No.' }
    expect(
      domainRejectionErrorDataSchema.safeParse({ ...rejection, reason: 'RULE_WARNINGS', warnings })
        .success
    ).toBe(true)
    for (const invalid of [
      { ...rejection, reason: 'RULE_WARNINGS' },
      { ...rejection, reason: 'RULE_WARNINGS', warnings: [] },
      { ...rejection, reason: 'RULE_WARNINGS', warnings: [warnings[0], warnings[0]] },
      { ...rejection, reason: 'VERSION_STALE', warnings }
    ])
      expect(domainRejectionErrorDataSchema.safeParse(invalid).success).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        code: 'SOMETHING_ELSE',
        commandId: ids.command,
        currentSequence: 9,
        message: 'No.',
        reason: null,
        warnings: null,
        type: 'COMMAND_REJECTED'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        code: 'STALE_STATE',
        commandId: ids.command,
        currentSequence: 9,
        message: 'Scene state changed.',
        type: 'COMMAND_REJECTED'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        commandId: ids.command,
        type: 'COMMAND_ACCEPTED'
      }).success
    ).toBe(false)
  })

  it('accepts the live-authority Scene commands in an outbox publication', () => {
    const sceneResult = {
      commandId: ids.command,
      delta: {
        barrierId: ids.barrier,
        kind: 'DOOR_STATE_SET' as const,
        state: 'OPEN' as const
      },
      occurrence: null,
      replayed: false,
      sceneId: ids.scene,
      version: 3
    }
    const publication = {
      actorUserId: ids.user,
      actorRole: 'OWNER' as const,
      campaignId: ids.campaign,
      command: {
        scope: 'SCENE' as const,
        command: {
          barrierId: ids.barrier,
          commandId: ids.command,
          expectedSceneVersion: 2,
          sceneId: ids.scene,
          state: 'OPEN' as const,
          type: 'SET_SCENE_DOOR_STATE' as const
        },
        presentation: { expectedPresentationVersion: 5 }
      },
      epoch: ids.authorityEpoch,
      expectedSceneResult: sceneResult,
      expectedStateChecksum: 'a'.repeat(64),
      occurredAt: '2026-09-22T12:00:00.000Z',
      receiptId: ids.command,
      sequence: 8,
      stateChecksum: 'b'.repeat(64)
    }
    expect(liveSessionPublishInputSchema.parse(publication)).toEqual(publication)

    const movementPublication = {
      ...publication,
      command: {
        ...publication.command,
        command: {
          commandId: ids.command,
          correlationId: null,
          expectedEncounterVersion: null,
          expectedSceneVersion: 2,
          movementKind: 'VOLUNTARY' as const,
          path: [
            { x: 1, y: 1 },
            { x: 2, y: 2 }
          ],
          sceneId: ids.scene,
          tokenId: ids.token,
          type: 'MOVE_SCENE_TOKEN' as const
        }
      },
      expectedSceneResult: {
        ...sceneResult,
        delta: {
          kind: 'TOKEN_MOVED' as const,
          position: { x: 2, y: 2 },
          tokenId: ids.token
        }
      }
    }
    expect(liveSessionPublishInputSchema.parse(movementPublication)).toEqual(movementPublication)

    const undoPublication = {
      ...publication,
      command: {
        ...publication.command,
        command: {
          commandId: ids.command,
          expectedSceneVersion: 2,
          sceneId: ids.scene,
          type: 'UNDO_LAST_SCENE_MOVE' as const
        }
      },
      expectedSceneResult: {
        ...sceneResult,
        delta: {
          kind: 'TOKEN_MOVE_UNDONE' as const,
          position: { x: 1, y: 1 },
          tokenId: ids.token,
          undoneCommandId: ids.command
        }
      }
    }
    expect(liveSessionPublishInputSchema.parse(undoPublication)).toEqual(undoPublication)
    expect(
      liveSessionPublishResponseSchema.parse({
        authority: {
          activationFingerprint: 'c'.repeat(64),
          campaignId: ids.campaign,
          createdAt: '2026-09-22T12:00:00.000Z',
          epoch: ids.authorityEpoch,
          persistedSequence: 8,
          persistedStateChecksum: 'b'.repeat(64),
          phase: 'DO_ACTIVE',
          updatedAt: '2026-09-22T12:00:00.000Z'
        },
        sceneResult,
        scope: 'SCENE'
      })
    ).toMatchObject({ scope: 'SCENE', sceneResult })

    expect(
      liveSessionPublishInputSchema.safeParse({
        ...publication,
        command: {
          ...publication.command,
          command: {
            commandId: ids.command,
            expectedSceneVersion: 2,
            mode: 'ON_DROP',
            sceneId: ids.scene,
            type: 'SET_SCENE_VISION_REVEAL_MODE'
          }
        }
      }).success
    ).toBe(false)
  })

  it('subscribes to the room Encounter session and pushes only a strict frame', () => {
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({
        timeline: true,
        type: 'SUBSCRIBE_ENCOUNTER_SESSION'
      })
    ).toEqual({ timeline: true, type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({ type: 'SUBSCRIBE_ENCOUNTER_SESSION' })
        .success
    ).toBe(false)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({ type: 'UNSUBSCRIBE_ENCOUNTER_SESSION' })
    ).toEqual({ type: 'UNSUBSCRIBE_ENCOUNTER_SESSION' })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        session: { held: false },
        type: 'ENCOUNTER_SESSION'
      })
    ).toEqual({ session: { held: false }, type: 'ENCOUNTER_SESSION' })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        session: { held: true, version: 3 },
        type: 'ENCOUNTER_SESSION'
      }).success
    ).toBe(false)
  })

  it('subscribes to the live Campaign summary and pushes only a strict summary', () => {
    for (const type of ['SUBSCRIBE_CAMPAIGN_SUMMARY', 'UNSUBSCRIBE_CAMPAIGN_SUMMARY'])
      expect(liveSessionWebSocketClientMessageDtoSchema.parse({ type })).toEqual({ type })
    const summary = {
      characters: [
        {
          characterId: ids.user,
          conditions: [],
          currentHitPoints: 8,
          maxHitPoints: 11,
          tempHitPoints: 0
        }
      ],
      encounter: { currentActorId: null, encounterId: ids.session, round: 1, status: 'ACTIVE' }
    }
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({ summary, type: 'CAMPAIGN_SUMMARY' })
    ).toEqual({ summary, type: 'CAMPAIGN_SUMMARY' })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        summary: { ...summary, encounter: { ...summary.encounter, status: 'PREPARED' } },
        type: 'CAMPAIGN_SUMMARY'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        summary: { ...summary, extra: true },
        type: 'CAMPAIGN_SUMMARY'
      }).success
    ).toBe(false)
  })

  it('reads the turn choices on demand without a caller-supplied version', () => {
    const requestId = '00000000-0000-4000-8000-0000000000a1'
    const actorRead = {
      kind: 'ACTION_CHOICES',
      input: { encounterId: ids.session, actorId: ids.user }
    }
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({
        read: actorRead,
        requestId,
        type: 'ENCOUNTER_READ'
      })
    ).toEqual({ read: actorRead, requestId, type: 'ENCOUNTER_READ' })
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({
        read: { kind: 'SCENE_BINDING', input: { encounterId: ids.session, sceneId: ids.scene } },
        requestId,
        type: 'ENCOUNTER_READ'
      }).type
    ).toBe('ENCOUNTER_READ')
    for (const read of [
      { ...actorRead, input: { ...actorRead.input, expectedVersion: 1 } },
      { kind: 'CHARACTER_SHEET', input: {} },
      { kind: 'LATEST_EVIDENCE_ROLLS', input: {} }
    ])
      expect(
        liveSessionWebSocketClientMessageDtoSchema.safeParse({
          read,
          requestId,
          type: 'ENCOUNTER_READ'
        }).success
      ).toBe(false)
    expect(
      liveSessionWebSocketClientMessageDtoSchema.safeParse({
        read: actorRead,
        type: 'ENCOUNTER_READ'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        requestId,
        result: { kind: 'ACTION_CHOICES', result: null },
        type: 'ENCOUNTER_READ_RESULT',
        version: 4
      })
    ).toEqual({
      requestId,
      result: { kind: 'ACTION_CHOICES', result: null },
      type: 'ENCOUNTER_READ_RESULT',
      version: 4
    })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.safeParse({
        requestId,
        result: { kind: 'ACTION_CHOICES', result: null },
        type: 'ENCOUNTER_READ_RESULT'
      }).success
    ).toBe(false)
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        code: 'UNAVAILABLE',
        message: 'The room cannot answer this read.',
        reason: null,
        requestId,
        type: 'ENCOUNTER_READ_REJECTED'
      }).type
    ).toBe('ENCOUNTER_READ_REJECTED')
  })

  it('reads the believed target modifiers on demand, bound to the presented Scene version', () => {
    const requestId = '00000000-0000-4000-8000-0000000000a2'
    const input = {
      actionId: 'attack',
      actorId: ids.user,
      encounterId: ids.session,
      scene: { expectedSceneVersion: 3, sceneId: ids.scene }
    }
    const read = { kind: 'ACTION_TARGET_MODIFIERS', input }
    expect(
      liveSessionWebSocketClientMessageDtoSchema.parse({ read, requestId, type: 'ENCOUNTER_READ' })
    ).toEqual({ read, requestId, type: 'ENCOUNTER_READ' })
    expect(
      getEncounterActionTargetModifiersInputDtoSchema.safeParse({ ...input, expectedVersion: 2 })
        .success
    ).toBe(true)
    for (const invalid of [
      { ...input, expectedVersion: 2 },
      { ...input, scene: { sceneId: ids.scene } },
      { ...input, actionId: '' }
    ])
      expect(
        liveSessionWebSocketClientMessageDtoSchema.safeParse({
          read: { kind: 'ACTION_TARGET_MODIFIERS', input: invalid },
          requestId,
          type: 'ENCOUNTER_READ'
        }).success
      ).toBe(false)
    const modifiers = {
      actionId: 'attack',
      actorId: ids.user,
      encounterId: ids.session,
      encounterVersion: 4,
      targets: [
        {
          actorId: ids.user,
          attack: {
            reasons: ['Long range'],
            rollMode: 'DISADVANTAGE',
            rollModeLabel: 'Disadvantage',
            keep: 'LOWER'
          }
        },
        { actorId: ids.session, attack: null }
      ]
    }
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        requestId,
        result: { kind: 'ACTION_TARGET_MODIFIERS', result: modifiers },
        type: 'ENCOUNTER_READ_RESULT',
        version: 4
      }).type
    ).toBe('ENCOUNTER_READ_RESULT')
    // The wire checks code shape only; the System vocabulary decides which modes exist.
    const attackWithMode = (rollMode: string) =>
      encounterActionTargetModifiersDtoSchema.safeParse({
        ...modifiers,
        targets: [
          {
            actorId: ids.user,
            attack: { reasons: [], rollMode, rollModeLabel: 'Auto hit', keep: 'FIRST' }
          }
        ]
      }).success
    expect(attackWithMode('AUTO_HIT')).toBe(true)
    expect(attackWithMode('auto_hit')).toBe(false)
  })

  it('preserves existing authentication and transient server messages', () => {
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({ type: 'AUTHENTICATION_REQUIRED' })
    ).toEqual({ type: 'AUTHENTICATION_REQUIRED' })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        campaignId: ids.campaign,
        type: 'TRANSIENT_READY'
      })
    ).toEqual({
      campaignId: ids.campaign,
      type: 'TRANSIENT_READY'
    })
    expect(
      liveSessionWebSocketServerMessageDtoSchema.parse({
        message: { envelope, userId: ids.user },
        type: 'TRANSIENT'
      })
    ).toEqual({
      message: { envelope, userId: ids.user },
      type: 'TRANSIENT'
    })
  })
})

describe('Encounter rule overrides and undo', () => {
  const action = {
    type: 'RESOLVE_ACTION',
    encounterId: ids.encounter,
    commandId: ids.command,
    expectedVersion: 3,
    actorId: ids.character,
    actionId: 'bite',
    target: { kind: 'ACTOR', actorId: ids.token }
  }

  it('defaults acknowledgements to none and keeps each code once', () => {
    expect(resolveEncounterActionInputDtoSchema.parse(action).acknowledgedWarnings).toEqual([])
    expect(
      resolveEncounterActionInputDtoSchema.parse({
        ...action,
        acknowledgedWarnings: ['TARGET_OUT_OF_RANGE', 'ACTION_ECONOMY_UNAVAILABLE']
      }).acknowledgedWarnings
    ).toEqual(['TARGET_OUT_OF_RANGE', 'ACTION_ECONOMY_UNAVAILABLE'])
    for (const acknowledgedWarnings of [['TARGET_OUT_OF_RANGE', 'TARGET_OUT_OF_RANGE'], ['AUTH']])
      expect(
        resolveEncounterActionInputDtoSchema.safeParse({ ...action, acknowledgedWarnings }).success
      ).toBe(false)
  })

  it('a basic action (CHECK) command aims at one creature: a point-origin target fails at parse', () => {
    const point = {
      kind: 'POINT',
      sceneId: ids.token,
      expectedSceneVersion: 1,
      point: { x: 1, y: 1 }
    }
    expect(liveSessionEncounterBasicActionCommandSchema.safeParse(action).success).toBe(true)
    expect(
      liveSessionEncounterBasicActionCommandSchema.safeParse({ ...action, target: point }).success
    ).toBe(false)
    // The same command still parses where an area action is allowed.
    expect(
      resolveEncounterActionInputDtoSchema.safeParse({ ...action, target: point }).success
    ).toBe(true)
  })

  it('carries the cast modifier a caster pays only as a uuid', () => {
    const castModifierId = ids.command
    expect(resolveEncounterActionInputDtoSchema.parse({ ...action, castModifierId })).toMatchObject(
      {
        castModifierId
      }
    )
    expect(resolveEncounterActionInputDtoSchema.parse(action).castModifierId).toBeUndefined()
    expect(
      resolveEncounterActionInputDtoSchema.safeParse({ ...action, castModifierId: 'subtle' })
        .success
    ).toBe(false)
  })

  it('names the creatures a cast modifier affects only as uuids, at most 50', () => {
    const castModifierActorIds = [ids.command]
    expect(
      resolveEncounterActionInputDtoSchema.parse({ ...action, castModifierActorIds })
    ).toMatchObject({ castModifierActorIds })
    expect(
      resolveEncounterActionInputDtoSchema.safeParse({
        ...action,
        castModifierActorIds: ['wolf']
      }).success
    ).toBe(false)
    expect(
      resolveEncounterActionInputDtoSchema.safeParse({
        ...action,
        castModifierActorIds: Array.from({ length: 51 }, () => ids.command)
      }).success
    ).toBe(false)
  })

  it('accepts a GM undo with only its Run version', () => {
    const { actorId: _actor, actionId: _action, target: _target, ...base } = action
    expect(
      revertLastEncounterActionInputDtoSchema.parse({ ...base, type: 'REVERT_LAST_ACTION' })
    ).toEqual({ ...base, type: 'REVERT_LAST_ACTION' })
  })
})
