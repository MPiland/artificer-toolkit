import type {
  LiveRoomDefinition,
  LiveRoomInputsResponse
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionRoomAuthorizationSchema } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'

import type { LiveCaptureReads } from '../src/nativeEncounterReads.js'
import { RoomEncounterStore, type RoomDocument } from '../src/roomEncounterStore.js'
import { roomEncounterReadTransaction } from '../src/roomEncounterReadPorts.js'
import { readRoomEncounterTurnCapture } from '../src/roomEncounterTurnCapture.js'
import { RoomInputs } from '../src/roomInputs.js'
import {
  ENCOUNTER_ID,
  maintainedState,
  testUuid,
  USER_ID
} from '../src/testing/liveCaptureFixture.js'
import { createNodeSqliteRoomStorage } from '../src/testing/nodeSqliteRoomStorage.js'
import { srdRoomHydration, type srdRoomCharacter } from '../src/testing/srdRoomCharacter.js'
import { storedRunDocuments } from '../src/testing/storedRunFixture.js'
import { roomAuthorizationResponse } from './roomAuthorizationFixture.js'
import { roomInputsResponse } from './roomInputsFixture.js'

const NOW = '2026-09-30T12:00:00.000Z'

/** The epoch the fixture room holds the Campaign under. */
export const ROOM_EPOCH = testUuid(0xe007)

/** A persisted effect as the room stores it: the document Convex held before the room took over. */
export function storedEffectDocument(effect: ActiveRuleEffectRecord): RoomDocument {
  const common = {
    id: effect.id,
    maintainedEffectStateId: effect.maintainedEffectStateId,
    createdOrdinal: effect.createdOrdinal,
    version: effect.version,
    definitionJson: JSON.stringify(effect.definition),
    definitionChecksum: checksumCanonicalJson(effect.definition),
    lifecycle: effect.lifecycle,
    lifecycleChecksum: checksumCanonicalJson(effect.lifecycle),
    createdAt: effect.createdAt,
    updatedAt: effect.updatedAt
  }
  return effect.owner.kind === 'CHARACTER'
    ? {
        table: 'characterActiveRuleEffects',
        id: `effect:${effect.id}`,
        creationTime: effect.createdOrdinal,
        fields: {
          ...common,
          characterId: effect.owner.characterId,
          sourceEncounterId: sourceEncounterIdForDefinition(effect.definition)
        }
      }
    : {
        table: 'encounterActiveRuleEffects',
        id: `effect:${effect.id}`,
        creationTime: effect.createdOrdinal,
        fields: {
          ...common,
          encounterId: effect.owner.encounterId,
          targetActorId: effect.owner.targetActorId
        }
      }
}

/** A maintained state as the room stores it. */
export function storedMaintainedStateDocument(
  state: ReturnType<typeof maintainedState>
): RoomDocument {
  const { descriptor, ...rest } = state
  return {
    table: 'encounterMaintainedEffectStates',
    id: `state:${state.id}`,
    creationTime: 0,
    fields: { ...rest, descriptorJson: JSON.stringify(descriptor) }
  }
}

type Capture = (
  request: LiveSessionEncounterRulesRequest
) => Promise<LiveSessionEncounterRulesResponse>

export interface RoomCapture {
  capture: Capture
  /** Every request the room answered, in the order it was issued. */
  requests: LiveSessionEncounterRulesRequest[]
  reads: LiveCaptureReads
  store: RoomEncounterStore
  /** Each Character's row as the room hydrated it (before the stored sheet-state checksum), by Character id. */
  characterRows: ReadonlyMap<string, NonNullable<Parameters<typeof srdRoomHydration>[1]>>
}

/**
 * Runs `run` against the REAL room capture (`readRoomEncounterTurnCapture`) over a store holding
 * the given Run, its actors, stored effects and assigned SRD Characters, as the Session Worker
 * holds them. Only the platform is faked: Convex reads the room makes for definitions and
 * Character pages are answered from the fixtures, and storage is node sqlite.
 */
export async function withRoomCapture(
  config: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    characters?: readonly ReturnType<typeof srdRoomCharacter>[]
    /** Stored effects and maintained states beside the Run. */
    documents?: readonly RoomDocument[]
    /** The Character owners of maintained dependents, as Convex names them on the Run input. */
    maintenanceCharacterOwners?: readonly { maintainedStateId: string; characterId: string }[]
    /** Per-Character overrides of the hydrated Character row, by Character id. */
    characterOwners?: ReadonlyMap<string, Parameters<typeof srdRoomHydration>[1]>
  },
  run: (room: RoomCapture) => Promise<void>
) {
  const { state, actors } = config
  const characters = config.characters ?? []
  const playerIds = characters.map(({ part }) => part.inputs!.owner.userId)
  const members = [
    { userId: USER_ID, role: 'OWNER' as const, membershipEpoch: NOW },
    ...playerIds.map((userId) => ({ userId, role: 'PLAYER' as const, membershipEpoch: NOW }))
  ]
  const definitions: readonly LiveRoomDefinition[] = []
  const roomInputs = {
    campaignId: state.campaignId,
    systemId: state.gameSystemId,
    ownerUserId: USER_ID,
    members,
    assignments: characters.map(({ part }) => ({
      characterId: part.inputs!.owner.id,
      userId: part.inputs!.owner.userId
    })),
    definitions
  }
  const authority = roomInputsResponse({ kind: 'AUTHORITY', cursor: null }, roomInputs)
  if (authority.kind !== 'AUTHORITY') throw new Error('Missing Campaign authority fixture.')
  // The page fixture gives every Character the same row ids; one room holds several, so each gets its own.
  const characterRows = new Map(
    characters.map(({ part }) => {
      const owner = config.characterOwners?.get(part.inputs!.owner.id) ?? part.inputs!.owner
      return [
        owner.id,
        {
          ...owner,
          _id: `${owner._id}:${owner.id}`,
          play: { ...owner.play, _id: `${owner.play._id}:${owner.id}` }
        }
      ] as const
    })
  )
  const hydrations = characters.map((character) =>
    srdRoomHydration(character, characterRows.get(character.part.inputs!.owner.id))
  )
  const observed = [
    ...authority.revisions,
    { scope: 'PLAY' as const, id: state.campaignId, revision: null },
    ...characters.flatMap(({ part }) => part.revisions)
  ].filter(
    (entry, index, all) =>
      all.findIndex(
        (other) =>
          other.scope === entry.scope && other.id === entry.id && other.revision === entry.revision
      ) === index
  )
  const records = [
    {
      kind: 'ROOM_INPUT' as const,
      key: 'AUTHORITY',
      revision: JSON.stringify(authority.revisions),
      json: JSON.stringify({ ...authority, documents: [] })
    },
    {
      kind: 'ROOM_INPUT' as const,
      key: `RUN:${state.id}`,
      revision: null,
      json: JSON.stringify({
        kind: 'RUN',
        encounterVersion: state.version,
        activeEncounterId: null,
        maintenanceCharacterOwners: [...(config.maintenanceCharacterOwners ?? [])],
        documents: [],
        continueCursor: null
      } satisfies Extract<LiveRoomInputsResponse, { kind: 'RUN' }>)
    },
    ...[
      ...new Map(
        hydrations.flatMap((hydration) => hydration.records).map((record) => [record.key, record])
      ).values()
    ]
  ]
  const { storage, database } = createNodeSqliteRoomStorage()
  try {
    const store = new RoomEncounterStore(storage)
    store.hydrate({
      epoch: ROOM_EPOCH,
      documents: [
        ...authority.documents,
        ...(await storedRunDocuments(state, actors)),
        ...hydrations.flatMap((hydration) => hydration.documents),
        ...(config.documents ?? [])
      ],
      records
    })
    const read = async (_epoch: string, scope: Parameters<typeof roomInputsResponse>[0]) => {
      if (scope.kind === 'CHARACTERS')
        return {
          kind: 'CHARACTERS',
          continueCursor: null,
          parts: scope.characterIds.map(
            (characterId) =>
              characters.find(({ part }) => part.characterId === characterId)?.part ?? {
                status: 'UNASSIGNED' as const,
                characterId
              }
          )
        } satisfies LiveRoomInputsResponse
      return roomInputsResponse(scope, roomInputs)
    }
    const loaded = await Promise.all(characters.map(({ loadContent }) => loadContent()))
    const inputs = new RoomInputs(store, read, async () => loaded.flat())
    const authorization = liveSessionRoomAuthorizationSchema.parse(
      roomAuthorizationResponse({ members })
    )
    const scene = {
      readSceneHeader: async () => {
        throw new Error('Encounter capture must not read Scene state.')
      },
      readSceneEntities: async () => {
        throw new Error('Encounter capture must not read Scene entities.')
      }
    }
    await store.transact(async (transaction) => {
      const ctx = await roomEncounterReadTransaction({
        store,
        transaction,
        inputs,
        authorization,
        campaignId: state.campaignId,
        epoch: ROOM_EPOCH,
        userId: USER_ID,
        observed
      })
      const requests: LiveSessionEncounterRulesRequest[] = []
      const reads: LiveCaptureReads = {
        encounterRules: (input) => {
          requests.push(input.request)
          return readRoomEncounterTurnCapture(ctx, inputs, transaction, input, observed, scene)
        },
        prepareCharacter: () => {
          throw new Error('This room serves Encounter captures only.')
        }
      }
      await run({
        capture: (request) =>
          reads.encounterRules({
            campaignId: state.campaignId,
            authorityEpoch: ROOM_EPOCH,
            expectedUserId: USER_ID,
            expectedRole: 'OWNER',
            encounterId: ENCOUNTER_ID,
            expectedVersion: state.version,
            request
          }),
        requests,
        reads,
        store,
        characterRows
      })
    })
  } finally {
    database.close()
  }
}
