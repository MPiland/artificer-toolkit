import {
  bindEncounterToPresentedSceneInputDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunState } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterReadPorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/** Binds to the presentation the room fence names; a moved presentation is stale (D47). */
export async function bindEncounterToPresentedScene(
  ctx: EncounterWriteContext & {
    ports: Pick<EncounterReadPorts, 'requireIdentity' | 'requireCampaignAuthority'>
  },
  args: BindEncounterToPresentedSceneInputDto,
  room: { sceneId: string; expectedPresentationVersion: number },
  callbacks: {
    readPresentation(
      campaignId: string
    ): Promise<{ sceneId: string | null; version: number } | null>
    readScene(sceneId: string): Promise<Pick<SceneLiveStateHeader, 'id' | 'campaignId'> | null>
  }
): Promise<BindEncounterToPresentedSceneResultDto> {
  const input = bindEncounterToPresentedSceneInputDtoSchema.parse({
    ...args,
    commandId: args.commandId.toLowerCase(),
    encounterId: args.encounterId.toLowerCase()
  })
  const { userId } = await ctx.ports.requireIdentity()
  const encounter = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!encounter) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    encounter.campaignId,
    userId
  )
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (encounter.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  // A completed Run keeps no binding, so a late retry cannot bind it again (Amendment 30).
  if (readRunState(encounter).status === 'COMPLETED') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const commandFingerprint = checksumCanonicalJson(input)
  const existing = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounter.id))
    .unique()
  if (existing) {
    if (existing.campaignId !== campaign.id)
      throw new Error('Stored Encounter Scene binding belongs to another Campaign.')
    if (
      existing.commandId !== input.commandId ||
      existing.commandFingerprint !== commandFingerprint
    )
      rejectDomain('VERSION_STALE', 'Encounter already has a different Campaign Scene binding.')
    return {
      commandId: input.commandId,
      encounterId: encounter.id,
      replayed: true,
      sceneId: existing.sceneId
    }
  }
  const presentation = await callbacks.readPresentation(campaign.id)
  const sceneId = presentation?.sceneId
  if (!sceneId) rejectDomain('SCENE_NOT_PRESENTED', 'The Campaign is not presenting a Scene.')
  if (
    sceneId !== room.sceneId.toLowerCase() ||
    presentation.version !== room.expectedPresentationVersion
  )
    rejectDomain('VERSION_STALE', 'Scene presentation is stale.')
  const scene = await callbacks.readScene(sceneId)
  if (!scene || scene.campaignId !== campaign.id)
    throw new Error('The presented Campaign Scene is unavailable.')
  const now = new Date().toISOString()
  await ctx.db.insert(
    'encounterSceneBindings',
    encounterSceneBindingSchema.parse({
      encounterId: encounter.id,
      campaignId: campaign.id,
      sceneId: scene.id,
      commandId: input.commandId,
      commandFingerprint,
      createdAt: now
    })
  )
  return {
    commandId: input.commandId,
    encounterId: encounter.id,
    replayed: false,
    sceneId: scene.id
  }
}
