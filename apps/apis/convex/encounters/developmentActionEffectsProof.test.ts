// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { verifyEncounterEffects } from '../../tests/developmentEncounterEffects'
import {
  encounterEffectCreature,
  encounterEffectCreatureId
} from '../../tests/fixtures/encounterEffects'
import { createEncounterLifecyclePolicyFixture } from '../../tests/fixtures/encounterInitiative'
import { fixture } from '../../tests/fixtures/characters'
import { api, components, internal } from '../_generated/api'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  roomDevelopmentClient,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
afterEach(() => {
  vi.unstubAllEnvs()
})

const removeFixtureState = makeFunctionReference<
  'mutation',
  {
    ownerUserId: string
    playerUserId: string
    campaignId: string
    characterId: string
  },
  null
>('encounters/developmentRuns:removeFixtureState')

async function prepareActionEffectFixture() {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  await base.t.mutation(internal.accountEntitlements.setTier, {
    userId: base.owner.userId,
    tier: 'GM'
  })
  const policies = createEncounterLifecyclePolicyFixture(base.owner.userId)
  await base.t.mutation(internal.content.import.bootstrap, policies.bootstrap)
  await base.t.mutation(internal.content.import.importDefinitions, policies.imported)
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('The SRD Frightened condition is unavailable.')
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID || definition.id === frightened.id
    )
  })
  const draft = await base.owner.caller.mutation(api.content.drafts.save, {
    subjectKind: 'CREATURE',
    subjectId: encounterEffectCreatureId,
    systemId: srdSystemRecord.id,
    label: encounterEffectCreature.label,
    payload: encounterEffectCreature
  })
  if (!draft.updatedAt)
    throw new Error('Action-effect fixture draft is missing publication identity.')
  await base.owner.caller.mutation(api.content.publication.publishDraft, {
    subjectKind: 'CREATURE',
    subjectId: draft.subjectId,
    expectedDraftUpdatedAt: draft.updatedAt
  })
  await attachRoomWorker(base.t)
  const owner = roomDevelopmentClient(base.owner.caller)
  const player = roomDevelopmentClient(base.other.caller)
  return { base, policies, draft, owner, player }
}

async function createFixtureCampaign(
  base: Awaited<ReturnType<typeof fixture>>,
  initiativePolicyCatalogueId: string
) {
  const campaign = await base.owner.caller.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id,
    additionalRulesCatalogueIds: [initiativePolicyCatalogueId]
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  await seedRoomContentSnapshots(campaign.id)
  return campaign
}

async function effectSnapshot(base: Awaited<ReturnType<typeof fixture>>, campaignId: string) {
  return base.t.run(async (ctx) => {
    const runs = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_createdAt_id', (q) => q.eq('campaignId', campaignId))
      .take(8)
    const effects = await Promise.all(
      runs.map(async (run) => ({
        runId: run.id,
        rows: await ctx.db
          .query('encounterActiveRuleEffects')
          .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', run.id))
          .take(101)
      }))
    )
    return { runs, effects }
  })
}

function effectRows(snapshot: Awaited<ReturnType<typeof effectSnapshot>>) {
  return snapshot.effects.flatMap((effect) => effect.rows)
}

async function effectsForRuns(
  base: Awaited<ReturnType<typeof fixture>>,
  runIds: readonly string[]
) {
  return base.t.run(async (ctx) =>
    (
      await Promise.all(
        runIds.map((runId) =>
          ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', runId))
            .take(101)
        )
      )
    ).flat()
  )
}

it('persists one failed-save effect, leaves another Campaign unchanged, and retries cleanup safely', async () => {
  const { base, policies, draft, owner, player } = await prepareActionEffectFixture()
  const campaign = await createFixtureCampaign(base, policies.bootstrap.catalogue.id)
  const preservedCampaign = await createFixtureCampaign(base, policies.bootstrap.catalogue.id)
  await verifyEncounterEffects({
    owner,
    player,
    campaignId: campaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
    creatureId: draft.subjectId,
    leaveLastRunActive: true,
    saveTable: () => checkpointRoom(campaign.id)
  })
  await verifyEncounterEffects({
    owner,
    player,
    campaignId: preservedCampaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
    creatureId: draft.subjectId,
    leaveLastRunActive: true,
    saveTable: () => checkpointRoom(preservedCampaign.id)
  })
  // Closing a room checkpoints it and releases the Campaign's live authority before cleanup.
  await closeRoom(campaign.id)
  await closeRoom(preservedCampaign.id)
  const targetBefore = await effectSnapshot(base, campaign.id)
  const preservedBefore = await effectSnapshot(base, preservedCampaign.id)
  expect(targetBefore.runs).toHaveLength(2)
  expect(effectRows(targetBefore)).toHaveLength(1)
  expect(targetBefore.effects.map(({ rows }) => rows.length).sort()).toEqual([0, 1])
  expect(preservedBefore.runs).toHaveLength(2)
  expect(effectRows(preservedBefore)).toHaveLength(1)

  const targetRunIds = targetBefore.runs.map((run) => run.id)
  const cleanup = {
    ownerUserId: base.owner.userId,
    playerUserId: base.other.userId,
    campaignId: campaign.id,
    characterId: crypto.randomUUID()
  }
  await base.t.mutation(removeFixtureState, cleanup)
  expect(await effectSnapshot(base, campaign.id)).toEqual({
    runs: [],
    effects: []
  })
  expect(await effectsForRuns(base, targetRunIds)).toEqual([])
  expect(await effectSnapshot(base, preservedCampaign.id)).toEqual(preservedBefore)
  await expect(base.t.mutation(removeFixtureState, cleanup)).resolves.toBeNull()
  expect(await effectsForRuns(base, targetRunIds)).toEqual([])
  expect(await effectSnapshot(base, preservedCampaign.id)).toEqual(preservedBefore)
}, 120000)

it('rejects malformed stored action-effect ownership without changing fixture rows', async () => {
  const { base, policies, draft, owner, player } = await prepareActionEffectFixture()
  const campaign = await createFixtureCampaign(base, policies.bootstrap.catalogue.id)
  await verifyEncounterEffects({
    owner,
    player,
    campaignId: campaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
    creatureId: draft.subjectId,
    leaveLastRunActive: true,
    saveTable: () => checkpointRoom(campaign.id)
  })
  await closeRoom(campaign.id)
  const before = await effectSnapshot(base, campaign.id)
  const effect = effectRows(before)[0]
  if (!effect) throw new Error('Action-effect fixture did not persist the failed save.')
  await base.t.run((ctx) => ctx.db.patch(effect._id, { targetActorId: crypto.randomUUID() }))
  const malformed = await effectSnapshot(base, campaign.id)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      playerUserId: base.other.userId,
      campaignId: campaign.id,
      characterId: crypto.randomUUID()
    })
  ).rejects.toThrow('Fixture Encounter dependency or ownership mismatch.')
  expect(await effectSnapshot(base, campaign.id)).toEqual(malformed)
}, 120000)

it('removes the maintained state a concentration effect points to, and refuses one the Run does not own', async () => {
  const { base, policies, draft, owner, player } = await prepareActionEffectFixture()
  const campaign = await createFixtureCampaign(base, policies.bootstrap.catalogue.id)
  await verifyEncounterEffects({
    owner,
    player,
    campaignId: campaign.id,
    initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
    initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
    creatureId: draft.subjectId,
    leaveLastRunActive: true,
    saveTable: () => checkpointRoom(campaign.id)
  })
  await closeRoom(campaign.id)
  const effect = effectRows(await effectSnapshot(base, campaign.id))[0]
  if (!effect) throw new Error('Action-effect fixture did not persist the failed save.')
  const cleanup = {
    ownerUserId: base.owner.userId,
    playerUserId: base.other.userId,
    campaignId: campaign.id,
    characterId: crypto.randomUUID()
  }
  const maintainedStateId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('encounterMaintainedEffectStates', {
      id: maintainedStateId,
      encounterId: effect.encounterId,
      ownerActorId: effect.targetActorId,
      maintenanceDefinitionId: crypto.randomUUID(),
      descriptorJson: '{}',
      descriptorChecksum: effect.definitionChecksum,
      version: 1,
      createdAt: effect.createdAt,
      updatedAt: effect.updatedAt
    })
    await ctx.db.patch(effect._id, { maintainedEffectStateId: crypto.randomUUID() })
  })
  await expect(base.t.mutation(removeFixtureState, cleanup)).rejects.toThrow(
    'Fixture Encounter dependency or ownership mismatch.'
  )
  await base.t.run((ctx) =>
    ctx.db.patch(effect._id, { maintainedEffectStateId: maintainedStateId })
  )
  await base.t.mutation(removeFixtureState, cleanup)
  expect(
    await base.t.run((ctx) => ctx.db.query('encounterMaintainedEffectStates').collect())
  ).toEqual([])
  expect(await effectSnapshot(base, campaign.id)).toEqual({ runs: [], effects: [] })
}, 120000)
