import { v } from 'convex/values'
import { campaignLiveScenePresentationReceiptDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'
import { refreshMapReferenceFlag } from '../media/vttMapDocuments'
import { parseFogSave, parseFogLayer } from './fogDocuments'
import { parseGeometryCommand, parseGeometrySave } from './geometryDocuments'

const FIXTURE_CAMPAIGN_NAME = 'Encounter execution fixture'

export const removeFixtureState = internalMutation({
  args: { ownerUserId: v.string(), campaignId: v.string() },
  returns: v.null(),
  handler: async (ctx, { ownerUserId, campaignId }) => {
    await requireFixtureAccount(ctx, ownerUserId)
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaignId))
      .unique()
    const ownerSaves = await ctx.db
      .query('sceneDefinitionSaves')
      .withIndex('by_ownerUserId_commandId', (q) => q.eq('ownerUserId', ownerUserId))
      .take(9)
    if (!campaign) {
      if (ownerSaves.length === 0) return null
      throw new Error('Fixture Scene Campaign is missing.')
    }
    if (campaign.ownerUserId !== ownerUserId || campaign.name !== FIXTURE_CAMPAIGN_NAME)
      throw new Error('Fixture Scene Campaign ownership mismatch.')
    if (
      ownerSaves.length > 8 ||
      ownerSaves.some((save) => save.settings.campaignId !== campaign.id)
    )
      throw new Error('Fixture Scene save bounds or Campaign ownership mismatch.')

    const [definitions, liveScenes, presentations, events] = await Promise.all([
      ctx.db
        .query('sceneDefinitions')
        .withIndex('by_campaignId_updatedAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(4),
      ctx.db
        .query('campaignScenes')
        .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaign.id))
        .take(4),
      ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId_sessionId', (q) => q.eq('campaignId', campaign.id))
        .take(3),
      ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id))
        .take(6)
    ])
    const campaignPresentations = presentations.filter(
      (presentation) => presentation.campaignId === campaign.id
    )
    const selectedSaveIds = new Set(ownerSaves.map((save) => save.id))
    if (
      definitions.length > 3 ||
      liveScenes.length > 3 ||
      campaignPresentations.length > 2 ||
      events.length > 5 ||
      definitions.some(
        (definition) =>
          !selectedSaveIds.has(definition.saveId) || definition.campaignId !== campaign.id
      ) ||
      liveScenes.some(
        (scene) => !selectedSaveIds.has(scene.definitionSaveId) || scene.campaignId !== campaign.id
      )
    )
      throw new Error('Fixture Scene bounds or ownership mismatch.')

    const bindings = await Promise.all(
      liveScenes.map((scene) =>
        ctx.db
          .query('encounterSceneBindings')
          .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
          .first()
      )
    )
    if (bindings.some((binding) => binding !== null))
      throw new Error('Fixture Scene has retained Encounter bindings.')

    const saveDependencies = await Promise.all(
      ownerSaves.map(async (save) => {
        const [entities, saveDefinitions, saveLiveScenes] = await Promise.all([
          ctx.db
            .query('sceneDefinitionEntities')
            .withIndex('by_saveId', (q) => q.eq('saveId', save.id))
            .take(17),
          ctx.db
            .query('sceneDefinitions')
            .withIndex('by_saveId', (q) => q.eq('saveId', save.id))
            .take(2),
          ctx.db
            .query('campaignScenes')
            .withIndex('by_definitionSaveId', (q) => q.eq('definitionSaveId', save.id))
            .take(2)
        ])
        return { save, entities, saveDefinitions, saveLiveScenes }
      })
    )
    if (
      saveDependencies.reduce((count, dependency) => count + dependency.entities.length, 0) > 16 ||
      saveDependencies.some(
        ({ save, entities, saveDefinitions, saveLiveScenes }) =>
          entities.length > 16 ||
          saveDefinitions.length > 1 ||
          saveLiveScenes.length > 1 ||
          saveDefinitions.some(
            (definition) =>
              definition.campaignId !== campaign.id ||
              definition.id !== save.definitionId ||
              definition.saveId !== save.id
          ) ||
          saveLiveScenes.some(
            (scene) =>
              scene.campaignId !== campaign.id ||
              scene.definitionId !== save.definitionId ||
              scene.definitionSaveId !== save.id ||
              scene.id !== save.liveSceneId
          )
      )
    )
      throw new Error('Fixture Scene dependency or foreign reference mismatch.')

    if (
      campaignPresentations.some(
        (presentation) =>
          presentation.sceneId !== null &&
          !liveScenes.some((scene) => scene.id === presentation.sceneId)
      )
    )
      throw new Error('Fixture Scene presentation mismatch.')
    const receipts = events.filter((event) => event.type === 'SESSION_SCENE_PRESENTATION_SET')
    const results = receipts.map((receipt) =>
      campaignLiveScenePresentationReceiptDtoSchema.safeParse(
        JSON.parse(receipt.payloadJson) as unknown
      )
    )
    if (
      receipts.some((receipt) => receipt.actorUserId !== ownerUserId) ||
      receipts.some((receipt, index) => {
        const parsed = results[index]!
        if (!parsed.success) return true
        const presentation = campaignPresentations.find(
          (candidate) => candidate.sessionId === parsed.data.result.sessionId
        )
        return (
          !presentation ||
          parsed.data.result.commandId !== receipt.commandId ||
          parsed.data.commandFingerprint !== receipt.inputFingerprint ||
          (parsed.data.result.sceneId !== null &&
            !liveScenes.some((scene) => scene.id === parsed.data.result.sceneId)) ||
          (parsed.data.result.version === presentation.version &&
            parsed.data.result.sceneId !== presentation.sceneId)
        )
      }) ||
      campaignPresentations.some((presentation) => {
        const versions = results
          .flatMap((result) =>
            result.success && result.data.result.sessionId === presentation.sessionId
              ? [result.data.result.version]
              : []
          )
          .sort((left, right) => left - right)
        return (
          versions.length !== presentation.version + 1 ||
          versions.some((version, index) => version !== index)
        )
      })
    )
      throw new Error('Fixture Scene presentation receipt mismatch.')

    const validatedPlayerIds = new Set<string>()
    const requireFixtureCampaignPlayer = async (playerId: string) => {
      if (playerId === ownerUserId || validatedPlayerIds.has(playerId)) return
      await requireFixtureAccount(ctx, playerId)
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', playerId)
        )
        .unique()
      if (!membership) throw new Error('Fixture Scene command actor is outside this Campaign.')
      validatedPlayerIds.add(playerId)
    }
    const liveChildren = await Promise.all(
      liveScenes.map(async (scene) => {
        const [head, entities, commands] = await Promise.all([
          ctx.db
            .query('sceneLiveStates')
            .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
            .unique(),
          ctx.db
            .query('sceneLiveEntities')
            .withIndex('by_sceneId_collection_entityId', (q) => q.eq('sceneId', scene.id))
            .take(17),
          ctx.db
            .query('sceneLiveCommands')
            .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
            .take(17)
        ])
        const advancingVersions = commands
          .filter(
            (command) =>
              command.encoding !== 'GEOMETRY' ||
              command.result.delta !== null ||
              command.result.fogPatches.length > 0
          )
          .map((command) => command.result.version)
          .sort((left, right) => left - right)
        if (
          entities.length > 16 ||
          commands.length > 16 ||
          (head?.version ?? 0) !== advancingVersions.length ||
          advancingVersions.some((version, index) => version !== index + 1)
        )
          throw new Error('Fixture live Scene command bounds or ownership mismatch.')
        for (const command of commands) {
          if (command.actorUserId === ownerUserId) continue
          if (
            command.input.type !== 'UPSERT_SCENE_MEASUREMENT' &&
            command.input.type !== 'REMOVE_SCENE_MEASUREMENT' &&
            command.input.type !== 'MOVE_SCENE_TOKEN'
          )
            throw new Error('Fixture live Scene command ownership mismatch.')
          await requireFixtureCampaignPlayer(command.actorUserId)
        }
        return { scene, head, entities, commands }
      })
    )
    if (liveChildren.reduce((count, children) => count + children.commands.length, 0) > 16)
      throw new Error('Fixture live Scene command bounds exceeded.')
    const fogChildren = await Promise.all(
      liveScenes.map(async (scene) => {
        const [saves, layers, geometrySaves] = await Promise.all([
          ctx.db
            .query('sceneFogSaves')
            .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
            .take(17),
          ctx.db
            .query('sceneFogLayers')
            .withIndex('by_sceneId_ownerUserId', (q) => q.eq('sceneId', scene.id))
            .take(17),
          ctx.db
            .query('sceneGeometrySaves')
            .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', scene.id))
            .take(17)
        ])
        return { scene, saves, layers, geometrySaves }
      })
    )
    if (
      fogChildren.reduce((count, child) => count + child.saves.length, 0) > 16 ||
      fogChildren.reduce((count, child) => count + child.layers.length, 0) > 16
    )
      throw new Error('Fixture Scene fog bounds exceeded.')
    if (fogChildren.reduce((count, child) => count + child.geometrySaves.length, 0) > 16)
      throw new Error('Fixture Scene geometry bounds exceeded.')
    const geometryParents = new Map<string, ReturnType<typeof parseGeometrySave>>()
    const geometryParentsByCommand = new Map<string, ReturnType<typeof parseGeometrySave>>()
    for (const child of fogChildren) {
      for (const row of child.geometrySaves) {
        const save = parseGeometrySave(row)
        if (
          save.sceneId !== child.scene.id ||
          (save.actorUserId !== ownerUserId && save.input.type !== 'MOVE_SCENE_TOKEN')
        )
          throw new Error('Fixture Scene geometry ownership mismatch.')
        await requireFixtureCampaignPlayer(save.actorUserId)
        geometryParents.set(save.id, save)
        geometryParentsByCommand.set(`${save.sceneId}:${save.commandId}`, save)
      }
    }
    const geometryReceipts = new Map<string, ReturnType<typeof parseGeometryCommand>>()
    for (const child of liveChildren) {
      for (const row of child.commands) {
        if (row.encoding !== 'GEOMETRY') continue
        const receipt = parseGeometryCommand(row, child.head?.version ?? 0)
        if (
          receipt.sceneId !== child.scene.id ||
          (receipt.actorUserId !== ownerUserId && receipt.input.type !== 'MOVE_SCENE_TOKEN')
        )
          throw new Error('Fixture Scene geometry receipt ownership mismatch.')
        await requireFixtureCampaignPlayer(receipt.actorUserId)
        geometryReceipts.set(`${receipt.sceneId}:${receipt.commandId}`, receipt)
      }
    }
    for (const receipt of geometryReceipts.values()) {
      const parent = geometryParentsByCommand.get(`${receipt.sceneId}:${receipt.commandId}`)
      if (!parent || parent.status !== 'PUBLISHED' || parent.sceneId !== receipt.sceneId)
        throw new Error('Fixture Scene geometry receipt mismatch.')
    }
    const fogChunkRows = []
    for (const [index, child] of fogChildren.entries()) {
      const saves = new Map(
        child.saves.map((row) => {
          const save = parseFogSave(row)
          if (
            save.sceneId !== child.scene.id ||
            (save.actorUserId !== ownerUserId &&
              (!save.geometrySaveId ||
                geometryParents.get(save.geometrySaveId)?.actorUserId !== save.actorUserId))
          )
            throw new Error('Fixture Scene fog ownership mismatch.')
          return [save.id, save]
        })
      )
      for (const save of saves.values()) {
        if (!save.geometrySaveId) continue
        const parent = geometryParents.get(save.geometrySaveId)
        if (!parent) {
          if (save.status === 'PUBLISHED')
            throw new Error('Fixture Scene published geometry fog parent is missing.')
          continue
        }
        if (
          parent.sceneId !== save.sceneId ||
          parent.actorUserId !== save.actorUserId ||
          !parent.fogSaves.some(
            (reference) =>
              reference.saveId === save.id && reference.ownerUserId === save.input.layer.ownerUserId
          )
        )
          throw new Error('Fixture Scene geometry fog reference mismatch.')
        if (save.status === 'PUBLISHED' && parent.status !== 'PUBLISHED')
          throw new Error('Fixture Scene published geometry fog parent mismatch.')
      }
      for (const parent of child.geometrySaves.map(parseGeometrySave)) {
        const receipt = geometryReceipts.get(`${parent.sceneId}:${parent.commandId}`)
        if (receipt) {
          if (
            receipt.inputChecksum !== parent.inputChecksum ||
            receipt.actorUserId !== parent.actorUserId ||
            receipt.result.version !==
              parent.snapshotVersion +
                (receipt.result.delta !== null || receipt.result.fogPatches.length > 0 ? 1 : 0)
          )
            throw new Error('Fixture Scene geometry receipt mismatch.')
        }
        if (parent.status === 'PUBLISHED' && !receipt)
          throw new Error('Fixture Scene geometry receipt mismatch.')
        for (const reference of parent.fogSaves) {
          const save = saves.get(reference.saveId)
          if (
            !save ||
            save.geometrySaveId !== parent.id ||
            save.input.expectedSceneVersion !== parent.snapshotVersion ||
            (parent.status === 'PUBLISHED' && save.status !== 'PUBLISHED') ||
            (parent.status !== 'PUBLISHED' && save.status === 'PUBLISHED')
          )
            throw new Error('Fixture Scene geometry fog reference mismatch.')
          if (
            parent.status === 'PUBLISHED' &&
            !receipt?.result.fogPatches.some(
              (patch) =>
                patch.saveId === save.id &&
                patch.ownerUserId === reference.ownerUserId &&
                patch.width === save.input.layer.width &&
                patch.height === save.input.layer.height &&
                patch.chunkCount === save.input.chunkManifest.length
            )
          )
            throw new Error('Fixture Scene geometry receipt mismatch.')
        }
        if (
          parent.status === 'PUBLISHED' &&
          receipt?.result.fogPatches.length !== parent.fogSaves.length
        )
          throw new Error('Fixture Scene geometry receipt mismatch.')
      }
      for (const row of child.layers) {
        const layer = parseFogLayer(row, liveChildren[index]!.head?.version ?? 0)
        if (
          layer.chunks.some((reference) => {
            const save = saves.get(reference.saveId)
            return (
              !save ||
              save.status !== 'PUBLISHED' ||
              save.input.layer.ownerUserId !== layer.ownerUserId ||
              save.input.layer.width !== layer.width ||
              save.input.layer.height !== layer.height
            )
          })
        )
          throw new Error('Fixture Scene fog reference mismatch.')
      }
      for (const save of saves.values()) {
        const chunks = await ctx.db
          .query('sceneFogChunks')
          .withIndex('by_saveId_ordinal', (q) => q.eq('saveId', save.id))
          .take(257 - fogChunkRows.length)
        fogChunkRows.push(...chunks)
        if (fogChunkRows.length > 256) throw new Error('Fixture Scene fog chunk bounds exceeded.')
      }
    }
    // Bounds above keep the complete fixture deletion inside one transaction, even for
    // one full 256-chunk fog layer. Published history is removed only with its fixture Scene.
    for (const chunk of fogChunkRows) await ctx.db.delete(chunk._id)
    for (const child of fogChildren) {
      for (const layer of child.layers) await ctx.db.delete(layer._id)
      for (const save of child.saves) await ctx.db.delete(save._id)
      for (const geometrySave of child.geometrySaves) await ctx.db.delete(geometrySave._id)
    }
    for (const { head, entities, commands } of liveChildren) {
      for (const entity of entities) await ctx.db.delete(entity._id)
      for (const command of commands) await ctx.db.delete(command._id)
      if (head) await ctx.db.delete(head._id)
    }
    for (const receipt of receipts) await ctx.db.delete(receipt._id)
    for (const presentation of campaignPresentations) await ctx.db.delete(presentation._id)
    for (const { entities } of saveDependencies)
      for (const entity of entities) await ctx.db.delete(entity._id)
    const mapIds = new Set([
      ...definitions.map((definition) => definition.map.assetId),
      ...liveScenes.map((scene) => scene.map.assetId)
    ])
    for (const scene of liveScenes) await ctx.db.delete(scene._id)
    for (const definition of definitions) await ctx.db.delete(definition._id)
    for (const mapId of mapIds) await refreshMapReferenceFlag(ctx, mapId)
    for (const save of ownerSaves) await ctx.db.delete(save._id)
    return null
  }
})
