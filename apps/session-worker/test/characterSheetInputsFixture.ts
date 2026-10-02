import { env } from 'cloudflare:workers'
import { v5 as uuidV5 } from 'uuid'
import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto,
  type ContentSnapshotPart
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterInitiativeRoundStateDtoSchema } from '@artificer-toolkit/schema/shared/initiativeState'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { characterPageFixtureFor } from '../src/testing/characterPageFixture.js'
import type { RoomCharacterInputs } from './roomInputsFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'
const gzipContent = { contentType: 'application/json', contentEncoding: 'gzip' }

// The captured Character's starting-equipment choice; the Background below offers exactly it.
const GROUP_ID = '3b74a8d0-eb08-47c9-b103-8d3ec46bd283'
const OPTION_ID = '319962bb-3446-4b1e-bc19-3f3d5e78a36d'

/**
 * The SRD roots the captured Character was built from, shaped like the Convex Character fixtures:
 * no Features or proficiencies, a Fighter without starting equipment sets, and a Background whose
 * one choice grants two Clubs and 15 gp.
 */
const roots = (() => {
  if (fighter.category !== 'BASE') throw new Error('The SRD Fighter is a base Class.')
  const background = {
    ...acolyte,
    features: [],
    proficiencies: [],
    startingEquipment: {
      id: '00000000-0000-4000-8000-0000000000a1',
      sets: [
        {
          id: '00000000-0000-4000-8000-0000000000a2',
          order: 0,
          groups: [
            {
              id: GROUP_ID,
              order: 0,
              options: [
                {
                  id: OPTION_ID,
                  order: 0,
                  items: [
                    {
                      id: '00000000-0000-4000-8000-0000000000a3',
                      order: 0,
                      startingEquipmentKind: 'EQUIPMENT' as const,
                      selectionKind: 'GRANTED' as const,
                      authoringModeKind: 'SELECTED' as const,
                      equipmentIds: [club.id],
                      quantity: 2
                    },
                    {
                      id: '00000000-0000-4000-8000-0000000000a4',
                      order: 1,
                      startingEquipmentKind: 'CURRENCY' as const,
                      currencies: [{ currencyId: fighter.startingGold.currencyId, amount: 15 }]
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  }
  return [
    { subjectKind: 'RACE' as const, document: { ...human, features: [] } },
    {
      subjectKind: 'CLASS' as const,
      document: {
        ...structuredClone(fighter),
        features: [],
        proficiencies: [],
        startingEquipment: { ...fighter.startingEquipment, sets: [] }
      }
    },
    { subjectKind: 'BACKGROUND' as const, document: background },
    { subjectKind: 'EQUIPMENT' as const, document: club }
  ]
})()

/**
 * One SRD root as the Convex importer stores it and the snapshot build reads it back: the JSON
 * round trip, canonical checksum and name-based version identity are the production ones.
 */
function listSource({
  subjectKind,
  document: authored
}: (typeof roots)[number]): ContentSnapshotListSource {
  const document = JSON.parse(JSON.stringify(authored))
  const checksum = checksumRuleDocument(document)
  const publication = parsePublicationDocument(subjectKind, document)
  const publicationVersion = {
    identity: {
      subjectKind,
      subjectId: publication.document.id,
      systemId: publication.document.systemId,
      contentSourceId: SRD_CONTENT_SOURCE.id,
      versionId: uuidV5(
        canonicalizeRuleDocument({ id: publication.document.id, kind: subjectKind, checksum }),
        uuidV5.URL
      ),
      checksum
    },
    version: 1
  }
  const identity = { publicId: publication.document.id, publicationVersion }
  if (publication.subjectKind !== 'EQUIPMENT') return { ...publication, ...identity }
  const { builder } = equipmentOptionFacts(
    publication.document,
    checksum,
    resolveEquipmentAuthored(club, () => undefined)
  )
  if (!builder) throw new Error('The Equipment option facts have no Builder projection.')
  return { subjectKind: 'EQUIPMENT', document: publication.document, builder, ...identity }
}

/** Builds the SRD source's snapshot objects, stores them in R2 as the build does, and returns its head. */
async function publishSrdSource(): Promise<ContentSnapshotHead> {
  const kinds: ContentSnapshotHead['kinds'] = {}
  for (const kind of ['RACE', 'CLASS', 'BACKGROUND', 'EQUIPMENT'] as const) {
    const header = {
      format: 2 as const,
      scope: 'SOURCE' as const,
      scopeId: SRD_CONTENT_SOURCE.id,
      kind
    }
    const built = buildContentSnapshotKind(
      header,
      roots.filter((root) => root.subjectKind === kind).map(listSource)
    )
    const store = async (part: ContentSnapshotPart) => {
      const { json, sha256, byteLength, rootCount } = built[part]
      const body = await new Response(
        new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
      ).arrayBuffer()
      await env.CONTENT_SNAPSHOTS.put(contentSnapshotObjectKey({ ...header, part }, sha256), body, {
        httpMetadata: gzipContent,
        customMetadata: { ...CONTENT_SNAPSHOT_PUBLIC_METADATA }
      })
      return { sha256, byteLength, rootCount }
    }
    kinds[kind] = {
      index: await store('index'),
      list: await store('list'),
      documents: await store('documents')
    }
  }
  return { scope: 'SOURCE', scopeId: SRD_CONTENT_SOURCE.id, revision: 1, builtRevision: 1, kinds }
}

/**
 * Consistent inputs for one assigned SRD Character held by an active Encounter: its Character
 * page and published content in R2, the SRD System, and the Run with the Character's actor.
 * Every identity, pin, checksum and revision comes from one set of values.
 */
export async function characterSheetInputsFixture({
  campaignId,
  characterId,
  ownerUserId
}: {
  campaignId: string
  characterId: string
  ownerUserId: string
}) {
  const systemId = srdSystemRecord.id
  const characterRevision = crypto.randomUUID()
  const manifest: ContentSnapshotManifestDto = {
    systemId,
    sources: [
      {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        kind: SRD_CONTENT_SOURCE.kind,
        head: await publishSrdSource()
      }
    ],
    campaign: {
      id: campaignId,
      contentMaturity: 'STANDARD',
      head: { scope: 'CAMPAIGN', scopeId: campaignId, revision: 0, builtRevision: 0, kinds: {} }
    }
  }
  const part = liveRoomCharacterPartSchema.parse(
    characterPageFixtureFor({
      characterId,
      userId: ownerUserId,
      campaignId,
      contentSnapshots: manifest,
      revisions: [
        { scope: 'SYSTEM', id: systemId, revision: null },
        { scope: 'CAMPAIGN', id: campaignId, revision: null },
        { scope: 'PLAY', id: campaignId, revision: null },
        { scope: 'CHARACTER', id: characterId, revision: characterRevision }
      ]
    })
  )

  const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
  const vocabularyIdentity = {
    snapshotId: crypto.randomUUID(),
    systemId,
    snapshotVersion: 1,
    schemaVersion: 1,
    document: system
  }
  const systemInputs: RoomCharacterInputs['system'] = {
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

  const encounterId = crypto.randomUUID()
  const sideId = crypto.randomUUID()
  const actor = encounterRunActorStateSchema.parse({
    id: crypto.randomUUID(),
    encounterId,
    sideId,
    kind: 'CHARACTER',
    sourceId: characterId,
    frozenState: null,
    label: 'Aria',
    systemId,
    stableTieKey: crypto.randomUUID(),
    public: true,
    controllerUserIds: [],
    disposition: 'FRIENDLY',
    healthDisplay: null,
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    createdAt: NOW,
    updatedAt: NOW,
    snapshot: { kind: 'CHARACTER', id: characterId, label: 'Aria', systemId }
  })
  const optionalCombatSnapshot = { schemaVersion: 1, gameSystemId: systemId, definitions: [] }
  const state = encounterRunStateSchema.parse({
    id: encounterId,
    campaignId,
    gameSystemId: systemId,
    blueprintId: crypto.randomUUID(),
    blueprintVersion: 1,
    blueprintChecksum: 'b'.repeat(64),
    name: 'Native Sheet Encounter',
    status: 'ACTIVE',
    automationMode: 'MANUAL',
    manualReminderMode: 'OFF',
    healthDisplayDefault: 'HIDDEN',
    version: 1,
    round: 1,
    currentActorId: null,
    actorIds: [actor.id],
    initiativePolicySnapshot: null,
    initiativePolicySnapshotChecksum: null,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: checksumCanonicalJson(optionalCombatSnapshot),
    turnSequence: 0,
    sides: [{ id: sideId, label: 'Party', sortOrder: 0 }],
    createdAt: NOW,
    updatedAt: NOW
  })
  const native = createMemoryEncounterStore({ idPrefix: 'sheet-fixture' })
  await native.store.insert(
    'encounterRuns',
    encounterStoredRunSchema.parse({
      id: encounterId,
      campaignId,
      gameSystemId: systemId,
      status: state.status,
      version: state.version,
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state),
      createdAt: NOW,
      updatedAt: NOW
    })
  )
  await insertRunActor({ db: native.store }, actor)
  // An ACTIVE Run projects from its normalized initiative round.
  const initiative = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      encounterId,
      round: 1,
      procedure: 'MANUAL',
      cadence: 'ENCOUNTER_START',
      status: 'ACTIVE',
      policySnapshotChecksum: null,
      nextTurnOrderOrdinal: 1,
      version: 0,
      createdAt: NOW,
      updatedAt: NOW
    },
    sides: [],
    participants: [
      {
        encounterId,
        round: 1,
        actorId: actor.id,
        sideId,
        status: 'READY',
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 0,
        version: 0,
        createdAt: NOW,
        updatedAt: NOW
      }
    ]
  })
  await native.store.insert('encounterInitiativeRounds', initiative.round)
  await native.store.insert('encounterInitiativeParticipants', initiative.participants[0]!)
  const documents: RoomCharacterInputs['run']['documents'] = []
  for (const table of [
    'encounterRuns',
    'encounterRunActors',
    'encounterActorProjectionFacts',
    'encounterSourceProjectionFacts',
    'encounterInitiativeRounds',
    'encounterInitiativeParticipants'
  ] as const) {
    for (const { _id, _creationTime, ...fields } of native.documents(table))
      documents.push({ table, id: _id, creationTime: _creationTime, fields })
  }

  const characterInputs: RoomCharacterInputs = {
    parts: [part],
    system: systemInputs,
    run: {
      kind: 'RUN',
      encounterVersion: state.version,
      activeEncounterId: null,
      maintenanceCharacterOwners: [],
      documents,
      continueCursor: null
    }
  }
  return { actorId: actor.id, characterInputs, characterRevision, encounterId, systemId }
}
