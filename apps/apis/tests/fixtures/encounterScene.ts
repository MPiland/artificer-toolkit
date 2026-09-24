import { makeFunctionReference } from 'convex/server'

import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'
import type { SceneDefinitionDto } from '@artificer-toolkit/schema/api/vttScenes'
import type {
  CreateEncounterInputDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'

import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readyCharacterFixture } from './readyCharacter'

export const createCampaign = makeFunctionReference<
  'mutation',
  CreateCampaignInput,
  CampaignDetailDto
>('campaigns/create:create')
const createSession = makeFunctionReference<'mutation', { campaignId: string }, CampaignSessionDto>(
  'campaigns/sessions:create'
)
const createBlueprint = makeFunctionReference<
  'mutation',
  {
    gameSystemId: string
    name: string
    commandId: string
    enemies: { kind: 'CUSTOM'; label: string; maxHitPoints: number }[]
  },
  { id: string }
>('encounters/blueprints:create')
export const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
export async function createEncounterSceneFixture(
  characterOptions: Parameters<typeof readyCharacterFixture>[0] = {}
) {
  const base = await readyCharacterFixture(characterOptions)
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Scene binding tests',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const session = await base.other.caller.mutation(createSession, { campaignId: campaign.id })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Binding target',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 },
      { kind: 'CUSTOM', label: 'Second dummy', maxHitPoints: 1 }
    ]
  })
  const run = await base.other.caller.mutation(createRun, {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const now = new Date().toISOString()
  const sceneId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const tokens = [crypto.randomUUID().toUpperCase(), crypto.randomUUID()].map(
    (id, ordinal): SceneDefinitionDto['tokens'][number] => ({
      id,
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      label: `Token ${ordinal}`,
      locked: false,
      position: { x: ordinal, y: 0 },
      rotationDegrees: 0,
      vision: null,
      width: 1
    })
  )
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        id: sceneId,
        definitionId: crypto.randomUUID(),
        definitionVersion: 1,
        definitionSaveId: saveId,
        version: 0,
        materializationCommandId: crypto.randomUUID(),
        materializationCommandFingerprint: '0'.repeat(64),
        campaignId: campaign.id,
        name: 'Bound Scene',
        ambientIllumination: 'BRIGHT',
        fogMode: 'PER_PLAYER',
        visionRevealMode: 'ON_DRAG',
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
        map: { assetId: crypto.randomUUID(), width: 64, height: 64, tileManifestAssetId: null },
        createdAt: now,
        updatedAt: now
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: campaign.id,
        sessionId: session.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
  })
  return { ...base, campaign, session, blueprint, run, sceneId, saveId, tokens }
}
