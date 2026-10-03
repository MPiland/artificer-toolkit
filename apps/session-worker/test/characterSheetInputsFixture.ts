import { env } from 'cloudflare:workers'
import { v5 as uuidV5 } from 'uuid'
import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto,
  type ContentSnapshotPart
} from '@artificer-toolkit/schema/api/contentSnapshots'
import {
  liveRoomCharacterPartSchema,
  liveRoomDefinitionSchema
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import { reusableDefinitionCurrentDtoSchema } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { systemVocabularySnapshotSchema } from '@artificer-toolkit/schema/projections/systemVocabulary'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { parsePublicationDocument } from '@artificer-toolkit/rules-runtime/authoredPublicationRead'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import {
  buildContentSnapshotKind,
  type ContentSnapshotListSource
} from '@artificer-toolkit/rules-runtime/contentSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEquipmentAuthored } from '@artificer-toolkit/shared/subjects/compilers'
import { SRD_SENSE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/senses.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { fighter } from '@artificer-toolkit/source-data/srd/classes/fighter.js'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { elf } from '@artificer-toolkit/source-data/srd/races/elf.js'
import { human } from '@artificer-toolkit/source-data/srd/races/human.js'
import {
  SRD_DARKVISION_SENSE_ID,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { characterPageFixtureFor } from '../src/testing/characterPageFixture.js'
import { encounterRunFixture } from '../src/testing/encounterRunFixture.js'
import type { RoomCharacterInputs } from './roomInputsFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'
const gzipContent = {
  contentType: 'application/json',
  contentEncoding: 'gzip'
}

// The captured Character's starting-equipment choice; the Background below offers exactly it.
const GROUP_ID = '3b74a8d0-eb08-47c9-b103-8d3ec46bd283'
const OPTION_ID = '319962bb-3446-4b1e-bc19-3f3d5e78a36d'

// The Elf's 60 ft Darkvision Feature, the one way the captured Character gains a Sense.
const darkvisionFeature = elf.features![1]!

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
                      currencies: [
                        {
                          currencyId: fighter.startingGold.currencyId,
                          amount: 15
                        }
                      ]
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
    {
      subjectKind: 'RACE' as const,
      document: { ...human, features: [] as (typeof darkvisionFeature)[] }
    },
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
        canonicalizeRuleDocument({
          id: publication.document.id,
          kind: subjectKind,
          checksum
        }),
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
  return {
    subjectKind: 'EQUIPMENT',
    document: publication.document,
    builder,
    ...identity
  }
}

const darkvisionSeed = SRD_SENSE_DEFINITIONS.find(({ id }) => id === SRD_DARKVISION_SENSE_ID)!

/** The platform Sense definition a room reads for the Darkvision `darkvision` grants. */
export const darkvisionDefinition = liveRoomDefinitionSchema.parse({
  id: darkvisionSeed.id,
  sourceKind: 'PLATFORM',
  definition: reusableDefinitionCurrentDtoSchema.parse({
    id: darkvisionSeed.id,
    gameSystemId: srdSystemRecord.id,
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitionFamilyKey: 'sense',
    label: darkvisionSeed.label,
    description: darkvisionSeed.description,
    document: darkvisionSeed.document,
    checksum: darkvisionSeed.checksum,
    contractVersion: 1,
    version: 1,
    publishedAt: NOW,
    publishedBy: crypto.randomUUID()
  })
})

/** Builds the SRD source's snapshot objects, stores them in R2 as the build does, and returns its head. */
async function publishSrdSource(darkvision: boolean): Promise<ContentSnapshotHead> {
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
      roots
        .filter((root) => root.subjectKind === kind)
        .map((root) =>
          darkvision && root.subjectKind === 'RACE'
            ? {
                ...root,
                document: { ...root.document, features: [darkvisionFeature] }
              }
            : root
        )
        .map(listSource)
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
  return {
    scope: 'SOURCE',
    scopeId: SRD_CONTENT_SOURCE.id,
    revision: 1,
    builtRevision: 1,
    kinds
  }
}

/**
 * Consistent inputs for one assigned SRD Character held by an active Encounter: its Character
 * page and published content in R2, the SRD System, and the Run with the Character's actor.
 * Every identity, pin, checksum and revision comes from one set of values. `darkvision` gives the
 * Character a 60 ft Darkvision Sense; `scene` binds the Encounter and the actor's token to a Scene.
 */
export async function characterSheetInputsFixture({
  campaignId,
  characterId,
  ownerUserId,
  darkvision = false,
  scene
}: {
  campaignId: string
  characterId: string
  ownerUserId: string
  darkvision?: boolean
  scene?: { sceneId: string; tokenId: string }
}) {
  const systemId = srdSystemRecord.id
  const characterRevision = crypto.randomUUID()
  const manifest: ContentSnapshotManifestDto = {
    systemId,
    sources: [
      {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        kind: SRD_CONTENT_SOURCE.kind,
        head: await publishSrdSource(darkvision)
      }
    ],
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

  const { encounterId, actorIds, documents, version } = await encounterRunFixture({
    campaignId,
    systemId,
    actors: [{ characterId }],
    scene
  })

  const characterInputs: RoomCharacterInputs = {
    parts: [part],
    system: systemInputs,
    run: {
      kind: 'RUN',
      encounterVersion: version,
      activeEncounterId: null,
      maintenanceCharacterOwners: [],
      documents,
      continueCursor: null
    }
  }
  return {
    actorId: actorIds[0]!,
    characterInputs,
    characterRevision,
    encounterId,
    systemId
  }
}
