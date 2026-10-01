import {
  bindEncounterToPresentedSceneInputDtoSchema,
  type BindEncounterToPresentedSceneInputDto,
  type BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import { encounterSceneBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readRunState } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import type { EncounterReadPorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/** Binds to the checked presentation; a room fence replaces the host's outside-room guard. */
export async function bindEncounterToPresentedScene(
  ctx: EncounterWriteContext & {
    ports: Pick<EncounterReadPorts, 'requireIdentity' | 'requireCampaignAuthority'>
  },
  args: BindEncounterToPresentedSceneInputDto,
  room: { sceneId: string; expectedPresentationVersion: number } | null,
  callbacks: {
    readPresentation(
      campaignId: string
    ): Promise<Pick<LiveSessionScenePublicationDto['presentation'], 'sceneId' | 'version'> | null>
    readScene(sceneId: string): Promise<Pick<SceneLiveStateHeader, 'id' | 'campaignId'> | null>
    assertOutsideRoom?(campaignId: string, sceneId: string): Promise<void>
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
  readRunState(encounter)
  const commandFingerprint = checksumCanonicalJson(input)
  const existing = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', encounter.id))
    .unique()
  if (existing) {
    if (
      existing.campaignId !== campaign.id ||
      existing.commandId !== input.commandId ||
      existing.commandFingerprint !== commandFingerprint
    )
      throw new Error('Encounter already has a different Campaign Scene binding.')
    return {
      commandId: input.commandId,
      encounterId: encounter.id,
      replayed: true,
      sceneId: existing.sceneId
    }
  }
  const presentation = await callbacks.readPresentation(campaign.id)
  const sceneId = presentation?.sceneId
  if (!sceneId) throw new Error('The Campaign is not presenting a Scene.')
  if (!room) {
    if (!callbacks.assertOutsideRoom)
      throw new Error('Outside-room Scene ownership guard is unavailable.')
    await callbacks.assertOutsideRoom(campaign.id, sceneId)
  } else if (
    sceneId !== room.sceneId.toLowerCase() ||
    presentation.version !== room.expectedPresentationVersion
  )
    throw new Error('Scene presentation is stale.')
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
