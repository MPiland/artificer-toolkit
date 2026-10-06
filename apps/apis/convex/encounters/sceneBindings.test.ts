import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type { LiveSessionAuthorityDto } from '@artificer-toolkit/schema/api/liveSessionState'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  createCampaign,
  createEncounterSceneFixture as setup
} from '../../tests/fixtures/encounterScene'

const bind = makeFunctionReference<
  'mutation',
  BindEncounterToPresentedSceneInputDto,
  BindEncounterToPresentedSceneResultDto
>('encounters/sceneBindings:bind')
const claim = makeFunctionReference<'mutation', { campaignId: string }, LiveSessionAuthorityDto>(
  'liveSessions/authority:claim'
)

describe('native Encounter Scene bindings', () => {
  it('binds the presented Scene and replays the original result after presentation changes', async () => {
    const base = await setup()
    const input: BindEncounterToPresentedSceneInputDto = {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    }
    const first = await base.other.caller.mutation(bind, input)
    expect(first).toEqual({
      commandId: input.commandId,
      encounterId: input.encounterId,
      sceneId: base.sceneId,
      replayed: false
    })
    await base.t.run(async (ctx) => {
      const presentation = await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
      if (!presentation) throw new Error('Missing presentation')
      await ctx.db.patch(presentation._id, { sceneId: null, version: 1 })
    })
    expect(
      await base.other.caller.mutation(bind, {
        ...input,
        commandId: input.commandId.toUpperCase(),
        encounterId: input.encounterId.toUpperCase()
      })
    ).toEqual({ ...first, replayed: true })
    expect(
      await base.t.run((ctx) =>
        ctx.db
          .query('encounterSceneBindings')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
          .collect()
      )
    ).toHaveLength(1)
  }, 30000)

  it('rejects null, missing, and foreign presented Scenes without binding or changing state', async () => {
    const base = await setup()
    const input: BindEncounterToPresentedSceneInputDto = {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    }
    const before = await base.t.run(async (ctx) => ({
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      scene: await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
        .unique(),
      presentation: await ctx.db
        .query('campaignScenePresentations')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', base.campaign.id))
        .unique()
    }))
    if (!before.presentation || !before.scene) throw new Error('Missing Scene fixture')
    await base.t.run((ctx) => ctx.db.patch(before.presentation!._id, { sceneId: null }))
    await expect(base.other.caller.mutation(bind, input)).rejects.toThrow('not presenting')
    await base.t.run((ctx) =>
      ctx.db.patch(before.presentation!._id, { sceneId: crypto.randomUUID() })
    )
    await expect(
      base.other.caller.mutation(bind, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow('unavailable')
    await base.t.run((ctx) => ctx.db.patch(before.presentation!._id, { sceneId: base.sceneId }))
    const foreignCampaign = await base.owner.caller.mutation(createCampaign, {
      name: 'Foreign Scene Campaign',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: base.campaign.gameSystemId,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await base.t.run((ctx) => ctx.db.patch(before.scene!._id, { campaignId: foreignCampaign.id }))
    await expect(
      base.other.caller.mutation(bind, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow('unavailable')
    await base.t.run((ctx) => ctx.db.patch(before.scene!._id, { campaignId: base.campaign.id }))
    expect(await base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())).toEqual([])
    expect(
      await base.t.run(async (ctx) => ({
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique(),
        scene: await ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
          .unique()
      }))
    ).toEqual({ run: before.run, scene: before.scene })
  }, 30000)

  it('rejects a new binding while the Campaign live table owns the presented Scene', async () => {
    const base = await setup()
    await base.other.caller.mutation(claim, { campaignId: base.campaign.id })

    await expect(
      base.other.caller.mutation(bind, {
        type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
        commandId: crypto.randomUUID(),
        encounterId: base.run.id
      })
    ).rejects.toThrow('owned by its Campaign live table')
    await expect(
      base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())
    ).resolves.toEqual([])
  })

  it('rolls back a nested binding mutation without changing the Run or Scene', async () => {
    const base = await setup()
    const input: BindEncounterToPresentedSceneInputDto = {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    }
    const before = await base.t.run(async (ctx) => ({
      run: await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
        .unique(),
      scene: await ctx.db
        .query('campaignScenes')
        .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
        .unique()
    }))
    await expect(
      base.other.caller.run(async (ctx) => {
        await ctx.runMutation(bind, input)
        throw new Error('Injected binding rollback')
      })
    ).rejects.toThrow('Injected binding rollback')
    expect(await base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())).toEqual([])
    expect(
      await base.t.run(async (ctx) => ({
        run: await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique(),
        scene: await ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
          .unique()
      }))
    ).toEqual(before)
  }, 30000)

  it('rejects a competing binding and authorization or lifecycle failures without rows', async () => {
    const base = await setup()
    const input: BindEncounterToPresentedSceneInputDto = {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    }
    await expect(base.t.mutation(bind, input)).rejects.toThrow('Unauthenticated')
    await expect(base.owner.caller.mutation(bind, input)).rejects.toThrow('Campaign not found')
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing owner membership')
      await ctx.db.patch(membership._id, { status: 'LEFT' })
    })
    await expect(base.other.caller.mutation(bind, input)).rejects.toThrow('Campaign not found')
    await expect(
      base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())
    ).resolves.toEqual([])
    await base.t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
        )
        .unique()
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!membership || !campaign) throw new Error('Missing Campaign authority')
      await ctx.db.patch(membership._id, { status: 'ACTIVE' })
      await ctx.db.patch(campaign._id, { status: 'ARCHIVED' })
    })
    await expect(base.other.caller.mutation(bind, input)).rejects.toThrow('Archived')
    await expect(
      base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())
    ).resolves.toEqual([])
    await base.t.run(async (ctx) => {
      const campaign = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
        .unique()
      if (!campaign) throw new Error('Missing Campaign')
      await ctx.db.patch(campaign._id, { status: 'ACTIVE' })
    })
    await base.other.caller.mutation(bind, input)
    await expect(
      base.other.caller.mutation(bind, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow('different Campaign Scene binding')
    await base.t.run(async (ctx) => {
      const binding = await ctx.db
        .query('encounterSceneBindings')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
        .unique()
      if (!binding) throw new Error('Missing binding')
      await ctx.db.patch(binding._id, { campaignId: crypto.randomUUID() })
    })
    await expect(base.other.caller.mutation(bind, input)).rejects.toThrow(
      'Stored Encounter Scene binding belongs to another Campaign.'
    )
    expect(
      await base.t.run((ctx) => ctx.db.query('encounterSceneBindings').collect())
    ).toHaveLength(1)
  }, 30000)
})
