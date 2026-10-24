import {
  liveRoomInputsResponseSchema,
  type LiveRoomCharacterPart,
  type LiveRoomDefinition,
  type LiveRoomInputsResponse,
  type LiveRoomInputsScope,
  type LiveRoomInputsDocument
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { LIVE_SESSION_ROUTE_PATHS } from '@artificer-toolkit/schema/api/liveSessionRoutePaths'
import {
  campaignStoredRecordSchema,
  campaignStoredMembershipSchema,
  campaignStoredAssignmentSchema
} from '@artificer-toolkit/schema/projections/campaignPersistence'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { LiveSessionTransientMember } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'

export const ROOM_INPUTS_PATH = LIVE_SESSION_ROUTE_PATHS.roomInputs

const zero = '00000000-0000-4000-8000-000000000000'
const fixtureTime = '2026-09-29T00:00:00.000Z'

/** Real Character, System and Run reads for a room that plays Character Sheet commands. */
export type RoomCharacterInputs = {
  parts: readonly LiveRoomCharacterPart[]
  system: Extract<LiveRoomInputsResponse, { kind: 'SYSTEM' }>
  run: Extract<LiveRoomInputsResponse, { kind: 'RUN' }>
  /** The published content the Campaign plays with; absent serves none. */
  contentSnapshots?: Extract<LiveRoomInputsResponse, { kind: 'CAMPAIGN_PLAY' }>['contentSnapshots']
}

/**
 * Empty Run and System inputs plus native Campaign authority fixtures. Callers supply their actual
 * membership and assignment facts, or complete native documents when metadata matters to the test.
 * `characterInputs` replaces the empty Run and System and serves the CHARACTERS page; without it a
 * Character read stays unsupported.
 */
export function roomInputsResponse(
  scope: LiveRoomInputsScope,
  {
    campaignId,
    systemId,
    ownerUserId = zero,
    members = [],
    assignments = [],
    accountUserIds,
    authorityDocuments,
    characterInputs,
    definitions = [],
    campaignClockMinute = null
  }: {
    campaignId: string
    systemId: string
    ownerUserId?: string
    members?: readonly LiveSessionTransientMember[]
    assignments?: LiveSessionRoomAuthorization['campaign']['assignments']
    accountUserIds?: readonly string[]
    authorityDocuments?: LiveRoomInputsDocument[]
    characterInputs?: RoomCharacterInputs
    definitions?: readonly LiveRoomDefinition[]
    /** The Campaign clock's absolute minute; `null` (the default) is a Campaign without a clock. */
    campaignClockMinute?: number | null
  }
): LiveRoomInputsResponse {
  switch (scope.kind) {
    case 'CHAT_METADATA':
      return { kind: 'CHAT_METADATA', documents: [], continueCursor: null }
    case 'AUTHORITY': {
      const uniqueMembers = [...new Map(members.map((member) => [member.userId, member])).values()]
      const owner = uniqueMembers.find((member) => member.role === 'OWNER')?.userId ?? ownerUserId
      const document = (table: string, id: string, fields: Record<string, unknown>) => ({
        table,
        id,
        creationTime: Date.parse(fixtureTime),
        fields
      })
      return {
        kind: 'AUTHORITY',
        accountUserIds: [...(accountUserIds ?? uniqueMembers.map((member) => member.userId))],
        revisions: [
          { scope: 'SYSTEM', id: systemId, revision: null },
          { scope: 'CAMPAIGN', id: campaignId, revision: null }
        ],
        continueCursor: null,
        documents: authorityDocuments ?? [
          document(
            'campaigns',
            `fixture:campaign:${campaignId}`,
            campaignStoredRecordSchema.parse({
              id: campaignId,
              publicId: campaignId,
              name: 'Encounter execution fixture',
              description: null,
              format: 'ONGOING',
              toneTags: ['HEROIC'],
              toneDetails: null,
              contentMaturity: 'STANDARD',
              gameSystemId: systemId,
              primaryRulesCatalogueId: zero,
              additionalRulesCatalogueIds: [],
              status: 'ACTIVE',
              version: 1,
              createdAt: fixtureTime,
              updatedAt: fixtureTime,
              ownerUserId: owner,
              attunementSlotOverride: null
            })
          ),
          ...uniqueMembers.map((member) =>
            document(
              'campaignMemberships',
              `fixture:membership:${member.userId}`,
              campaignStoredMembershipSchema.parse({
                campaignId,
                userId: member.userId,
                role: member.role,
                status: 'ACTIVE',
                accessStartedAt: member.membershipEpoch,
                joinedAt: member.membershipEpoch,
                leftAt: null
              })
            )
          ),
          ...assignments.map((assignment) =>
            document(
              'campaignCharacterAssignments',
              `fixture:assignment:${assignment.characterId}`,
              campaignStoredAssignmentSchema.parse({
                campaignId,
                ...assignment,
                assignedAt: fixtureTime
              })
            )
          )
        ]
      }
    }
    case 'RUN':
      return (
        characterInputs?.run ?? {
          kind: 'RUN',
          encounterVersion: 0,
          activeEncounterId: null,
          maintenanceCharacterOwners: [],
          documents: [],
          continueCursor: null
        }
      )
    case 'CAMPAIGN_PLAY':
      return {
        kind: 'CAMPAIGN_PLAY',
        revisions: [
          { scope: 'SYSTEM', id: systemId, revision: null },
          { scope: 'CAMPAIGN', id: campaignId, revision: null },
          { scope: 'PLAY', id: campaignId, revision: null }
        ],
        contentSnapshots: characterInputs?.contentSnapshots ?? {
          systemId,
          sources: [],
          campaign: {
            id: campaignId,
            contentMaturity: 'STANDARD',
            head: {
              scope: 'CAMPAIGN',
              scopeId: campaignId,
              revision: 0,
              builtRevision: 0,
              kinds: {}
            }
          }
        },
        campaign: {
          id: campaignId,
          gameSystemId: systemId,
          ownerUserId: members.find((member) => member.role === 'OWNER')?.userId ?? ownerUserId,
          contentMaturity: 'STANDARD',
          attunementSlotOverride: null,
          currencyOptions: []
        }
      }
    case 'SYSTEM': {
      if (characterInputs) return characterInputs.system
      const system = systemAuthoredDtoSchema.parse({
        id: systemId,
        label: 'Room fixture System',
        schemaVersion: 4,
        rulesetCode: 'DND5E',
        rulesetVersion: '2014',
        userId: ownerUserId,
        abilities: [],
        alignments: [],
        challengeRatings: [],
        conditionTypes: [],
        creatureTypes: [],
        currencies: [],
        damageTypes: [],
        heritages: [],
        languages: [],
        lifestyles: [],
        magicSchools: [],
        passives: [],
        rarities: [],
        senses: [],
        skills: [],
        speeds: [],
        terrains: []
      })
      const vocabularyIdentity = {
        snapshotId: systemId,
        systemId,
        snapshotVersion: 1,
        schemaVersion: 1,
        document: system
      }
      return {
        kind: 'SYSTEM',
        revisions: [
          { scope: 'SYSTEM', id: systemId, revision: null },
          { scope: 'CAMPAIGN', id: campaignId, revision: null },
          { scope: 'PLAY', id: campaignId, revision: null }
        ],
        system,
        vocabulary: systemVocabularySnapshotSchema.parse({
          ...vocabularyIdentity,
          checksum: checksumCanonicalJson(vocabularyIdentity)
        })
      }
    }
    case 'DEFINITIONS':
      return {
        kind: 'DEFINITIONS',
        revisions: [
          { scope: 'SYSTEM', id: systemId, revision: null },
          { scope: 'CAMPAIGN', id: campaignId, revision: null }
        ],
        definitions: [...definitions],
        continueCursor: null
      }
    case 'CHARACTERS': {
      if (!characterInputs) throw new Error('A Character read needs a real Character page.')
      return {
        kind: 'CHARACTERS',
        parts: scope.characterIds.map(
          (characterId) =>
            characterInputs.parts.find((part) => part.characterId === characterId) ?? {
              status: 'UNASSIGNED',
              characterId
            }
        ),
        continueCursor: null
      }
    }
    case 'SCENE':
      throw new Error('A Scene read needs raw native Scene documents.')
    case 'SCENE_DEFINITION':
      throw new Error('A Scene definition read needs immutable native Scene documents.')
    case 'CAMPAIGN_CLOCK':
      return { kind: 'CAMPAIGN_CLOCK', absoluteMinute: campaignClockMinute }
  }
}

/** The saved Scene a room reads natively: live head and rows over the immutable definition. */
export type RoomSceneFixture = {
  scene: Pick<
    CampaignSceneStateDto,
    | 'id'
    | 'version'
    | 'ambientIllumination'
    | 'daylight'
    | 'visionRevealMode'
    | 'fogMode'
    | 'annotations'
    | 'barriers'
    | 'darknessZones'
    | 'lights'
    | 'measurements'
    | 'tokens'
    | 'doorStates'
    | 'fogLayers'
  >
  header: SceneLiveStateHeader
  presentationVersion: number
}

type RoomSceneDocuments = Extract<LiveRoomInputsResponse, { kind: 'SCENE' }>['documents']

function rawSceneSource({ scene, header, presentationVersion }: RoomSceneFixture) {
  return {
    sceneId: scene.id,
    definitionSaveId: header.definitionSaveId,
    definitionVersion: header.definitionVersion,
    presentationVersion
  }
}

/**
 * Each fog layer is one published save holding every chunk, the layer referencing them, as the
 * room's Scene read requires.
 */
function rawFogDocuments(scene: RoomSceneFixture['scene']): RoomSceneDocuments {
  return scene.fogLayers.flatMap((layer, ordinal) => {
    const saveId = `00000000-0000-4000-8000-${(0xfa0000 + ordinal).toString(16).padStart(12, '0')}`
    const chunks = layer.chunks.map((chunk, chunkOrdinal) => ({
      saveId,
      ordinal: chunkOrdinal,
      chunk,
      checksum: checksumCanonicalJson(chunk)
    }))
    const input = {
      type: 'PATCH_SCENE_FOG',
      sceneId: scene.id,
      commandId: saveId,
      expectedSceneVersion: 0,
      layer: { ownerUserId: layer.ownerUserId, width: layer.width, height: layer.height },
      chunkManifest: chunks.map(({ chunk, checksum }) => ({ index: chunk.index, checksum }))
    }
    const content = {
      sceneId: scene.id,
      ownerUserId: layer.ownerUserId,
      width: layer.width,
      height: layer.height,
      ordinal,
      version: scene.version,
      chunks: chunks.map(({ chunk, checksum, ordinal: chunkOrdinal }) => ({
        index: chunk.index,
        saveId,
        ordinal: chunkOrdinal,
        checksum
      }))
    }
    return [
      {
        table: 'sceneFogLayers',
        id: `fog-layer:${ordinal}`,
        creationTime: 0,
        fields: { ...content, checksum: checksumCanonicalJson(content) }
      },
      {
        table: 'sceneFogSaves',
        id: `fog-save:${saveId}`,
        creationTime: 0,
        fields: {
          id: saveId,
          sceneId: scene.id,
          commandId: saveId,
          actorUserId: zero,
          input,
          inputChecksum: checksumCanonicalJson(input),
          status: 'PUBLISHED',
          receivedChunks: chunks.length,
          expiresAt: 0,
          chunksRemoved: false
        }
      },
      ...chunks.map((chunk) => ({
        table: 'sceneFogChunks',
        id: `fog-chunk:${saveId}:${chunk.ordinal}`,
        creationTime: 0,
        fields: chunk
      }))
    ]
  })
}

/** The SCENE scope's raw native documents: the live head, live entity rows and saved fog. */
export function rawSceneInputs(fixture: RoomSceneFixture): LiveRoomInputsResponse {
  const { scene } = fixture
  if (scene.fogLayers.length && scene.version === 0)
    throw new Error('Raw fog fixtures need a live Scene head.')
  const documents: RoomSceneDocuments = []
  if (scene.version > 0) {
    const counts = {
      annotations: scene.annotations.length,
      barriers: scene.barriers.length,
      darknessZones: scene.darknessZones.length,
      lights: scene.lights.length,
      measurements: scene.measurements.length,
      tokens: scene.tokens.length
    }
    documents.push({
      table: 'sceneLiveStates',
      id: `head:${scene.id}`,
      creationTime: 0,
      fields: {
        sceneId: scene.id,
        version: scene.version,
        counts,
        nextOrdinals: counts,
        fogLayerCount: scene.fogLayers.length,
        nextFogOrdinal: scene.fogLayers.length,
        settings: {
          ambientIllumination: {
            value: scene.ambientIllumination,
            daylight: scene.daylight,
            version: 0
          },
          visionRevealMode: { value: scene.visionRevealMode, version: 0 },
          fogMode: { value: scene.fogMode, version: 0 }
        }
      }
    })
    for (const collection of ['tokens', 'barriers'] as const) {
      scene[collection].forEach((entity, ordinal) => {
        const fields = {
          sceneId: scene.id,
          collection,
          entityId: entity.id,
          value: { collection, entity },
          ordinal,
          version: scene.version,
          ...(collection === 'barriers' && 'kind' in entity && entity.kind === 'DOOR'
            ? { doorState: scene.doorStates[entity.id] }
            : {})
        }
        documents.push({
          table: 'sceneLiveEntities',
          id: entity.id,
          creationTime: 0,
          fields: { ...fields, checksum: checksumCanonicalJson(fields) }
        })
      })
    }
    documents.push(...rawFogDocuments(scene))
  }
  return {
    kind: 'SCENE',
    source: rawSceneSource(fixture),
    sceneVersion: scene.version,
    documents,
    continueCursor: null
  }
}

/** The immutable Scene definition holds every fixture entity; live rows only override them. */
export function rawSceneDefinitionInputs(fixture: RoomSceneFixture): LiveRoomInputsResponse {
  const { scene, header } = fixture
  const entities = (
    [
      ['annotations', scene.annotations],
      ['barriers', scene.barriers],
      ['darknessZones', scene.darknessZones],
      ['lights', scene.lights],
      ['tokens', scene.tokens]
    ] as const
  ).flatMap(([collection, rows]) =>
    rows.map((entity, ordinal) => {
      const value = { collection, entity }
      return {
        saveId: header.definitionSaveId,
        entityId: entity.id,
        ordinal,
        value,
        checksum: checksumCanonicalJson(value)
      }
    })
  )
  return liveRoomInputsResponseSchema.parse({
    kind: 'SCENE_DEFINITION',
    source: rawSceneSource(fixture),
    header,
    entities,
    continueCursor: null
  })
}
