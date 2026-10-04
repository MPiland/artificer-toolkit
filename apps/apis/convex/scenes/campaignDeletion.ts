import { RECEIPT_LEDGER_MAX_PARTS } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import type { MutationCtx } from '../_generated/server'
import { refreshMapReferenceFlag, scheduleDetachedMapCleanup } from '../media/vttMapDocuments'

export async function removeCampaignScenes(ctx: MutationCtx, campaignId: string) {
  const [scenes, definitions, saves] = await Promise.all([
    ctx.db
      .query('campaignScenes')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaignId))
      .take(1),
    ctx.db
      .query('sceneDefinitions')
      .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaignId))
      .take(1),
    ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_campaignId_commandId', (q) => q.eq('settings.campaignId', campaignId))
      .take(1)
  ])
  const mapIds = new Set([
    ...scenes.map((scene) => scene.map.assetId),
    ...definitions.map((definition) => definition.map.assetId),
    ...saves.map((save) => save.settings.map.assetId)
  ])
  for (const scene of scenes) {
    const [fogSaves, ledgers, ...groups] = await Promise.all([
      ctx.db
        .query('sceneFogSaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
        .take(1),
      ctx.db
        .query('receiptLedgers')
        .withIndex('by_scope_scopeId', (q) => q.eq('scope', 'SCENE').eq('scopeId', scene.id))
        .take(1),
      ctx.db
        .query('sceneGeometrySaves')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
        .take(1),
      ctx.db
        .query('sceneFogLayers')
        .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', scene.id))
        .take(1),
      ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', scene.id))
        .take(1),
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
        .take(1),
      ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
        .take(1)
    ])
    for (const save of fogSaves) {
      const chunks = await ctx.db
        .query('sceneFogChunks')
        .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
        .take(8)
      for (const chunk of chunks) await ctx.db.delete(chunk._id)
      if (chunks.length > 0) return false
      await ctx.db.delete(save._id)
    }
    for (const ledger of ledgers) {
      const parts = await ctx.db
        .query('receiptLedgerParts')
        .withIndex('by_ledgerId_index', (q) => q.eq('ledgerId', ledger.id))
        .take(RECEIPT_LEDGER_MAX_PARTS)
      for (const part of parts) await ctx.db.delete(part._id)
      await ctx.db.delete(ledger._id)
    }
    for (const rows of groups) for (const row of rows) await ctx.db.delete(row._id)
    if (fogSaves.length > 0 || ledgers.length > 0 || groups.some((rows) => rows.length > 0))
      return false
  }
  for (const save of saves) {
    const entities = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId', (q) => q.eq('saveId', save.id))
      .take(8)
    for (const entity of entities) await ctx.db.delete(entity._id)
    if (entities.length > 0) return false
    await ctx.db.delete(save._id)
  }
  const [presentations, showings] = await Promise.all([
    ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .take(8),
    ctx.db
      .query('campaignSceneShowings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .take(8)
  ])
  for (const row of [...presentations, ...showings, ...scenes, ...definitions])
    await ctx.db.delete(row._id)
  for (const assetId of mapIds) {
    await refreshMapReferenceFlag(ctx, assetId)
    await scheduleDetachedMapCleanup(ctx, assetId)
  }
  return (
    scenes.length + definitions.length + saves.length + presentations.length + showings.length === 0
  )
}
