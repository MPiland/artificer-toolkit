import {
  readLiveMovementAdmission,
  type LiveMovementAdmissionCallbacks
} from '@artificer-toolkit/encounter-persistence/liveMovementAdmission'
import { parseGeometrySave } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import type { EncounterReadTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import { liveSessionCheckpointSceneSourceSchema } from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import type { SceneSessionVisionScope } from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import type { EncounterDocument } from '@artificer-toolkit/encounter-persistence/store'
import { sceneStoredDefinitionEntitySchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveEntitySchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomTransaction } from './roomEncounterStore.js'
import { ROOM_SCENE_DEFINITION_ENTITY } from './roomSceneDefinition.js'
import { readRoomScene } from './roomSceneRead.js'
import { readRoomSceneRow } from './roomSceneRecords.js'

/** Source pins come from the hydrated Scene; presentation comes from the current room view. */
export async function readRoomGeometrySave(input: {
  ctx: EncounterReadTransaction
  transaction: RoomTransaction
  saveId: string
  presentation: { sceneId: string; version: number }
}) {
  const { ctx, transaction, presentation } = input
  const row = readRoomSceneRow(transaction, 'sceneGeometrySaves', [input.saveId.toLowerCase()])
  if (!row) throw new Error('Scene geometry save is unavailable.')
  const save = parseGeometrySave(row)
  const scene = readRoomScene(transaction, save.sceneId)
  const { userId } = await ctx.ports.requireIdentity()
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    scene.header.campaignId,
    userId
  )
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (
    save.input.type !== 'MOVE_SCENE_TOKEN' &&
    save.input.type !== 'SET_SCENE_DOOR_STATE' &&
    membership.role !== 'OWNER'
  )
    throw new Error('Only the GM may change this Scene.')
  let presented: Awaited<
    ReturnType<LiveMovementAdmissionCallbacks['readGeometrySave']>
  >['presented'] = null
  if (save.sessionVision) {
    if (
      save.sessionVision.campaignId !== campaign.id ||
      save.sessionVision.systemId !== campaign.gameSystemId
    )
      throw new Error('Stored Scene geometry presentation identity is inconsistent.')
    const source = transaction.record('SCENE_CHECKPOINT_SOURCE', save.sceneId)
    if (!source) throw new Error('Room Scene source is unavailable.')
    const pin = liveSessionCheckpointSceneSourceSchema.parse(JSON.parse(source.json))
    if (presentation.sceneId !== save.sceneId || pin.presentationVersion !== presentation.version)
      throw new Error('Scene vision presentation is stale.')
    presented = { presentation: { campaignId: campaign.id, ...presentation } }
  }
  return { ...scene, save, campaign, membership, userId, presented }
}

/** The same Scene, presentation and input revision fence as the application boundary. */
export function readRoomSessionVisionScope(
  scope: SceneSessionVisionScope,
  current: {
    header: SceneLiveStateHeader
    campaign: EncounterDocument<'campaigns'>
    userId: string
    presentation: { campaignId: string; sceneId: string | null; version: number }
  },
  observed: LiveSessionRulesRevisions
) {
  const { header, campaign, presentation } = current
  if (header.id !== scope.sceneId) throw new Error('Scene vision Scene identity does not match.')
  if (campaign.id !== scope.campaignId || campaign.gameSystemId !== scope.systemId)
    throw new Error('Scene vision Campaign identity does not match.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (header.version !== scope.expectedSceneVersion)
    throw new Error('Scene vision Scene version is stale.')
  if (
    presentation.campaignId !== scope.campaignId ||
    presentation.sceneId !== scope.sceneId ||
    presentation.version !== scope.expectedPresentationVersion
  )
    throw new Error('Scene vision presentation is stale.')
  const revision = (kind: 'SYSTEM' | 'CAMPAIGN' | 'PLAY', id: string) => {
    const matches = observed.filter((entry) => entry.scope === kind && entry.id === id)
    if (matches.length !== 1) throw new Error('Room Scene vision revision is unavailable.')
    return matches[0]!.revision
  }
  const freshness = {
    system: revision('SYSTEM', scope.systemId),
    campaign: revision('CAMPAIGN', scope.campaignId),
    play: revision('PLAY', scope.campaignId)
  }
  if (
    scope.freshness.system !== freshness.system ||
    scope.freshness.campaign !== freshness.campaign ||
    scope.freshness.play !== freshness.play
  )
    throw new Error('Scene vision dependencies changed; capture a fresh play snapshot.')
  return { ...current, freshness }
}

export function readRoomDefinitionEntity(
  transaction: RoomTransaction,
  saveId: string,
  collection: 'tokens' | 'barriers',
  ordinal: number
) {
  const prefix = canonicalizeJson([saveId, collection, ordinal]).slice(0, -1) + ','
  const rows = transaction
    .records(ROOM_SCENE_DEFINITION_ENTITY)
    .filter((entry) => entry.key.startsWith(prefix))
  if (rows.length > 1) throw new Error('Room Scene source ordinal is ambiguous.')
  const row = rows[0]
  if (!row) return null
  const value = sceneStoredDefinitionEntitySchema.parse(JSON.parse(row.json))
  if (
    row.key !==
    canonicalizeJson([value.saveId, value.value.collection, value.ordinal, value.entityId])
  )
    throw new Error('Room Scene definition entity identity is inconsistent.')
  return value
}

export function readRoomLiveMovementAdmission(
  ctx: EncounterReadTransaction,
  transaction: RoomTransaction,
  scope: Parameters<typeof readLiveMovementAdmission>[1],
  observed: LiveSessionRulesRevisions,
  presentation: { sceneId: string; version: number }
) {
  return readLiveMovementAdmission(ctx, scope, {
    readGeometrySave: (saveId) => readRoomGeometrySave({ ctx, transaction, saveId, presentation }),
    readSessionVisionScope: async (scope, current) =>
      readRoomSessionVisionScope(scope, current, observed),
    readLiveEntity: async (sceneId, tokenId) => {
      const row = readRoomSceneRow(transaction, 'sceneLiveEntities', [sceneId, 'tokens', tokenId])
      return row ? sceneStoredLiveEntitySchema.parse(row) : null
    },
    readDefinitionToken: async (saveId, ordinal) =>
      readRoomDefinitionEntity(transaction, saveId, 'tokens', ordinal)
  })
}
