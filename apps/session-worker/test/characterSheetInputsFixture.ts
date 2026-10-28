import { env } from 'cloudflare:workers'
import {
  CONTENT_SNAPSHOT_PUBLIC_METADATA,
  contentSnapshotObjectKey,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto,
  type ContentSnapshotPart
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import {
  characterPageFixtureFor,
  type CharacterPlayOverrides
} from '../src/testing/characterPageFixture.js'
import { encounterRunFixture } from '../src/testing/encounterRunFixture.js'
import { createMemoryEncounterStore } from '@artificer-toolkit/encounter-persistence/memoryEncounterStore'
import { insertPendingMovementDecision } from './pendingMovementFixture.js'
import type {
  ClassAuthored,
  CreatureAuthored,
  EquipmentAuthored
} from '@artificer-toolkit/shared/subjects/authored'
import {
  buildSrdSourceKinds,
  type ClassFeature,
  type ClassSpells
} from '../src/testing/srdCharacterSource.js'
import type { RoomCharacterInputs } from './roomInputsFixture.js'
import { srdSystemRoomInputs } from './srdSenseInputsFixture.js'

const NOW = '2026-09-30T00:00:00.000Z'
const gzipContent = {
  contentType: 'application/json',
  contentEncoding: 'gzip'
}

/** Builds the SRD source's snapshot objects, stores them in R2 as the build does, and returns its head. */
async function publishSrdSource(
  darkvision: boolean,
  classFeatures: readonly ClassFeature[],
  equipment: readonly EquipmentAuthored[],
  spells: ClassSpells | undefined,
  creatures: readonly CreatureAuthored[] | undefined,
  characterClass: ClassAuthored | undefined,
  characterSubclass: ClassAuthored | undefined
): Promise<ContentSnapshotHead> {
  const kinds: ContentSnapshotHead['kinds'] = {}
  for (const { kind, header, built } of buildSrdSourceKinds(
    darkvision,
    false,
    classFeatures,
    equipment,
    spells,
    creatures,
    characterClass,
    characterSubclass
  )) {
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
 * The Character and System reads of one assigned SRD Character: its Character page and published
 * content in R2, and the SRD System. `darkvision` gives the Character a 60 ft Darkvision Sense.
 */
export async function characterRoomInputs({
  campaignId,
  characterId,
  ownerUserId,
  darkvision = false,
  classFeatures = [],
  equipment = [],
  publishedEquipment = [],
  play,
  spellcasting,
  creatures
}: {
  campaignId: string
  characterId: string
  ownerUserId: string
  darkvision?: boolean
  /** Further Features the Character's Class carries. */
  classFeatures?: readonly ClassFeature[]
  /** Further SRD Equipment the Character carries (equipped) and the source publishes. */
  equipment?: readonly EquipmentAuthored[]
  /** Further SRD Equipment the source publishes that the Character does not carry. */
  publishedEquipment?: readonly EquipmentAuthored[]
  /** The play state the Character starts with, where it differs from the capture. */
  play?: CharacterPlayOverrides
  /** Makes the Class a spellcaster: the spells it publishes, learns and prepares. */
  spellcasting?: { spells: ClassSpells; prepared: readonly string[] }
  /** Creatures the source publishes, which the room reads as the Campaign's play content. */
  creatures?: readonly CreatureAuthored[]
}) {
  const systemId = srdSystemRecord.id
  const characterRevision = crypto.randomUUID()
  const manifest: ContentSnapshotManifestDto = {
    systemId,
    sources: [
      {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        kind: SRD_CONTENT_SOURCE.kind,
        head: await publishSrdSource(
          darkvision,
          classFeatures,
          [...equipment, ...publishedEquipment],
          spellcasting?.spells,
          creatures,
          play?.characterClass,
          play?.characterSubclass
        )
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
      play: {
        ...play,
        carried: equipment,
        ...(spellcasting && {
          spells: {
            learned: spellcasting.spells.map(({ id }) => id),
            prepared: spellcasting.prepared
          }
        })
      },
      revisions: [
        { scope: 'SYSTEM', id: systemId, revision: null },
        { scope: 'CAMPAIGN', id: campaignId, revision: null },
        { scope: 'PLAY', id: campaignId, revision: null },
        { scope: 'CHARACTER', id: characterId, revision: characterRevision }
      ]
    })
  )

  return {
    parts: [part],
    system: srdSystemRoomInputs(campaignId),
    contentSnapshots: manifest,
    characterRevision,
    systemId
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
  classFeatures,
  scene,
  actor,
  status,
  pendingDecision = false
}: {
  campaignId: string
  characterId: string
  ownerUserId: string
  darkvision?: boolean
  /** Further Features the Character's Class carries. */
  classFeatures?: readonly ClassFeature[]
  scene?: { sceneId: string; tokenId: string }
  /** How the Run's actor for this Character shows: hidden from players, and whose turn it is. */
  actor?: { public?: boolean; current?: boolean }
  status?: 'ACTIVE' | 'PREPARED'
  /** Holds the Run on a PENDING movement decision addressed to the Character's owner. */
  pendingDecision?: boolean
}) {
  const { parts, system, characterRevision, systemId } = await characterRoomInputs({
    campaignId,
    characterId,
    ownerUserId,
    darkvision,
    classFeatures
  })
  const { encounterId, actorIds, documents, version } = await encounterRunFixture({
    campaignId,
    systemId,
    actors: [{ characterId, ...actor }],
    scene,
    status
  })

  if (pendingDecision) {
    const pending = createMemoryEncounterStore({ idPrefix: 'pending-fixture' })
    await insertPendingMovementDecision(pending.store, {
      campaignId,
      encounterId,
      encounterVersion: version,
      sceneId: crypto.randomUUID(),
      sceneVersion: 1,
      tokenId: crypto.randomUUID(),
      userId: ownerUserId,
      sourceActorId: actorIds[0]!,
      gameSystemId: systemId,
      now: NOW
    })
    for (const table of ['encounterRuleOccurrences', 'encounterPendingSnapshotParts'] as const)
      for (const { _id, _creationTime, ...fields } of pending.documents(table))
        documents.push({ table, id: _id, creationTime: _creationTime, fields })
  }

  const characterInputs: RoomCharacterInputs = {
    parts,
    system,
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
