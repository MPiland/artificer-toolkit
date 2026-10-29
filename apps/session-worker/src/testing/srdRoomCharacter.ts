import {
  contentSnapshotDocumentsObjectSchema,
  contentSnapshotIndexObjectSchema,
  type ContentSnapshotHead,
  type ContentSnapshotManifestDto
} from '@artificer-toolkit/schema/api/contentSnapshots'
import { liveRoomCharacterPartSchema } from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { LiveSessionCharacterRulesInput } from '@artificer-toolkit/schema/api/liveSessionCharacterRules'
import { characterStoredRowSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { RoomEncounterStore } from '../roomEncounterStore.js'
import { characterHeadDocument } from '../roomInputs.js'
import { characterPageFixtureFor } from './characterPageFixture.js'
import { buildSrdSourceKinds } from './srdCharacterSource.js'

/**
 * One assigned SRD Character as a room holds it: its Character part with the SRD source in its
 * content manifest, the SRD System, and the loader that serves the SRD snapshot objects the
 * way the content store does. The real preparation runs over these; nothing is prepared by hand.
 */
export function srdRoomCharacter({
  characterId,
  userId,
  campaignId,
  authorizeSource = true,
  secondWind = false
}: {
  characterId: string
  userId: string
  campaignId: string
  /** False leaves the SRD source out of the manifest, so its objects are foreign to the Character. */
  authorizeSource?: boolean
  /** Gives the Fighter Second Wind, a Resource pool; 'UNRESOLVED_MAXIMUM' makes that pool's maximum unevaluable. */
  secondWind?: boolean | 'UNRESOLVED_MAXIMUM'
}) {
  const kinds = buildSrdSourceKinds(false, secondWind)
  const head: ContentSnapshotHead = {
    scope: 'SOURCE',
    scopeId: SRD_CONTENT_SOURCE.id,
    revision: 1,
    builtRevision: 1,
    kinds: Object.fromEntries(
      kinds.map(({ kind, built }) => [
        kind,
        Object.fromEntries(
          (['index', 'list', 'documents'] as const).map((part) => {
            const { sha256, byteLength, rootCount } = built[part]
            return [part, { sha256, byteLength, rootCount }]
          })
        )
      ])
    )
  }
  const system = systemAuthoredDtoSchema.parse(srdSystemRecord)
  const manifest: ContentSnapshotManifestDto = {
    systemId: system.id,
    sources: authorizeSource
      ? [{ contentSourceId: SRD_CONTENT_SOURCE.id, kind: SRD_CONTENT_SOURCE.kind, head }]
      : [],
    campaign: { id: campaignId, contentMaturity: 'STANDARD', head: null }
  }
  const part = liveRoomCharacterPartSchema.parse(
    characterPageFixtureFor({ characterId, userId, campaignId, contentSnapshots: manifest })
  )
  if (part.status !== 'ASSIGNED' || !part.inputs) throw new Error('Missing Character fixture.')
  const objects = kinds.flatMap(({ built }) => [
    contentSnapshotIndexObjectSchema.parse(JSON.parse(built.index.json)),
    contentSnapshotDocumentsObjectSchema.parse(JSON.parse(built.documents.json))
  ])
  return { part, system, loadContent: async () => objects }
}

/**
 * Hydrates a room with one Character exactly as the room stages its first read: the stored head and
 * play rows, and the held CHARACTER and SYSTEM inputs. `owner` may carry a different play record.
 */
export function srdRoomHydration(
  { part, system }: Pick<ReturnType<typeof srdRoomCharacter>, 'part' | 'system'>,
  owner = part.inputs?.owner
): Pick<Parameters<RoomEncounterStore['hydrate']>[0], 'documents' | 'records'> {
  if (!owner) throw new Error('Missing Character fixture.')
  const stored = characterStoredRowSchema.parse(owner)
  const { _id: playId, _creationTime: playCreationTime, ...playFields } = stored.play
  const held = { ...part, inputs: part.inputs && { ...part.inputs, owner: stored } }
  // The System inputs are not stamped with the Character's revision, so a Builder edit leaves them current.
  const systemRevisions = part.revisions.filter(({ scope }) => scope !== 'CHARACTER')
  return {
    documents: [
      characterHeadDocument(stored),
      {
        table: 'characterPlayStates',
        id: playId,
        creationTime: playCreationTime,
        fields: playFields
      }
    ],
    records: [
      {
        kind: 'ROOM_INPUT',
        key: `CHARACTER:${stored.id}`,
        revision: JSON.stringify(part.revisions),
        json: JSON.stringify(held)
      },
      {
        kind: 'ROOM_INPUT',
        key: 'SYSTEM:SYSTEM',
        revision: JSON.stringify(systemRevisions),
        json: JSON.stringify({
          kind: 'SYSTEM',
          revisions: systemRevisions,
          system,
          vocabulary: null
        })
      }
    ]
  }
}

/** The room scope a Character's rules preparation is admitted under. */
export function srdCharacterScope(
  { part }: Pick<ReturnType<typeof srdRoomCharacter>, 'part'>,
  epoch: string
): LiveSessionCharacterRulesInput {
  if (!part.inputs) throw new Error('Missing Character fixture.')
  return {
    campaignId: part.inputs.campaign.id,
    authorityEpoch: epoch,
    characterId: part.inputs.owner.id,
    expectedUserId: part.inputs.owner.userId,
    expectedRole: 'PLAYER'
  }
}
