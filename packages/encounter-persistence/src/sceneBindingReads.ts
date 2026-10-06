import type { SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneEncounterBindingSchema,
  type SceneEncounterBinding
} from '@artificer-toolkit/schema/api/sceneRecipient'
import { readRunState } from './documents.js'
import { rejectDomain } from './domainRejections.js'
import type { CampaignAuthority } from './ports.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'

/**
 * The Run's binding to this Scene, null when it is bound to another. Each host reads its own
 * Scene (the caller must be allowed to see it) and its Campaign's presented Scene id.
 */
export async function readBoundEncounterScene<
  TScene extends { header: Pick<SceneLiveStateHeader, 'campaignId'> }
>(
  ctx: EncounterReadContext,
  input: Pick<CampaignAuthority, 'campaign'> & {
    run: EncounterDocument<'encounterRuns'>
    sceneId: string
    expectedEncounterVersion?: number
  },
  host: {
    readScene(): Promise<TScene>
    readPresentedSceneId(): Promise<string | null>
  }
) {
  const { run, campaign } = input
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (run.gameSystemId !== campaign.gameSystemId)
    throw new Error('Encounter does not match the Campaign Game System.')
  if (
    input.expectedEncounterVersion !== undefined &&
    run.version !== input.expectedEncounterVersion
  )
    rejectDomain('VERSION_STALE')
  readRunState(run)

  const scene = await host.readScene()
  if (scene.header.campaignId !== campaign.id)
    throw new Error('Encounter and Scene Campaign identity does not match.')
  if ((await host.readPresentedSceneId()) !== input.sceneId)
    throw new Error('Scene presentation is stale.')
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
    .unique()
  if (binding && (binding.encounterId !== run.id || binding.campaignId !== campaign.id))
    throw new Error('Encounter Scene binding is inconsistent.')
  const bound = binding?.sceneId === input.sceneId ? binding : null
  presentSceneEncounterBinding(run, bound)
  return { binding: bound, scene }
}

/** The Run's binding as a Scene's members read it; null when the Run is not bound to the Scene. */
export function presentSceneEncounterBinding(
  run: Pick<EncounterDocument<'encounterRuns'>, 'id' | 'version'>,
  binding: Pick<EncounterDocument<'encounterSceneBindings'>, 'sceneId'> | null
): SceneEncounterBinding | null {
  return binding === null
    ? null
    : sceneEncounterBindingSchema.parse({
        encounterId: run.id,
        encounterVersion: run.version,
        sceneId: binding.sceneId
      })
}

/**
 * The fight being played on a Scene: the Campaign's single ACTIVE Run, only when its binding names
 * `sceneId`. A PREPARED Run bound to the Scene is not being played and a Run's binding recency
 * never ranks Runs, so a later bind cannot take the Scene's controls or vision.
 */
export async function readActiveSceneEncounter(
  ctx: EncounterReadContext,
  input: { campaignId: string; sceneId: string }
) {
  const active = await ctx.db
    .query('encounterRuns')
    .withIndex('by_campaignId_status', (q) =>
      q.eq('campaignId', input.campaignId).eq('status', 'ACTIVE')
    )
    .take(2)
  if (active.length > 1) throw new Error('Campaign has multiple active Encounters.')
  const run = active[0]
  if (!run) return null
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', run.id))
    .unique()
  if (binding && (binding.encounterId !== run.id || binding.campaignId !== input.campaignId))
    throw new Error('Encounter Scene binding is inconsistent.')
  return binding?.sceneId === input.sceneId ? { run, binding } : null
}
