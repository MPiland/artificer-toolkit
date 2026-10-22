import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  DeleteCampaignInput,
  CampaignDeletionResult
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  AppendSceneDefinitionInput,
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { acquiredEquipmentRulesSchema } from '@artificer-toolkit/schema/projections/acquiredEquipmentRules'
import { acolyte } from '@artificer-toolkit/source-data/srd/backgrounds/acolyte.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../_generated/api'
import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { readCharacterDraft } from '../characters/documents'
import { readCharacterRecord } from '../characters/stateDocuments'
import {
  readAuthoredVersionCompilation,
  readStoredAuthoredVersionDocument
} from '../content/documents'
import type { Id, TableNames } from '../_generated/dataModel'
import schema from '../schema'
import * as accountUsage from '../lib/accountUsage'
import { fixture, input } from '../../tests/fixtures/characters'
import { makePublishedRootOwned } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import {
  createSceneDefinitionFixture,
  publishEmptyScene
} from '../../tests/fixtures/sceneDefinitions'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const remove = makeFunctionReference<'mutation', DeleteCampaignInput, CampaignDeletionResult>(
  'campaigns/deletion:remove'
)
const runDeletion = makeFunctionReference<
  'action',
  { jobId: Id<'campaignDeletionJobs'>; revision: number },
  null
>('campaigns/deletionJobs:run')
const begin = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const append = makeFunctionReference<
  'mutation',
  { input: AppendSceneDefinitionInput },
  SceneDefinitionSaveProgress
>('scenes/definitions:append')
const campaignInput: CreateCampaignInput = {
  name: 'Campaign deletion',
  format: 'ONGOING',
  toneTags: ['HEROIC'],
  contentMaturity: 'STANDARD',
  gameSystemId: srdSystemRecord.id,
  primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
}
const command = (campaign: CampaignDetailDto): DeleteCampaignInput => ({
  campaignId: campaign.id,
  expectedVersion: campaign.version,
  confirmation: 'DELETE'
})
const tableNames = Object.keys(schema.tables) as TableNames[]
const snapshot = (t: Awaited<ReturnType<typeof fixture>>['t']) =>
  t.run(async (ctx) => ({
    tables: Object.fromEntries(
      await Promise.all(
        tableNames.map(async (name) => [name, await ctx.db.query(name).collect()] as const)
      )
    ),
    scheduled: await ctx.db.system.query('_scheduled_functions').collect()
  }))

async function finishDeletion(t: Awaited<ReturnType<typeof fixture>>['t'], campaignId: string) {
  for (let page = 0; page < 500; page++) {
    const job = await t.run((ctx) =>
      ctx.db
        .query('campaignDeletionJobs')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
        .unique()
    )
    if (!job) throw new Error('Missing Campaign deletion job.')
    if (job.status === 'DELETED') return
    if (job.status === 'FAILED') throw new Error('Campaign deletion failed.')
    await t.action(runDeletion, { jobId: job._id, revision: job.revision })
  }
  throw new Error('Campaign deletion did not converge.')
}

describe('native Campaign deletion', () => {
  it('removes Session and Run state while preserving the personal Blueprint and an unrelated draft', async () => {
    const base = await fixture()
    const campaign = await base.owner.caller.mutation(create, campaignInput)
    await base.owner.caller.mutation(api.campaigns.sessions.create, { campaignId: campaign.id })
    const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
      gameSystemId: campaign.gameSystemId,
      name: 'Keep personal Blueprint',
      commandId: crypto.randomUUID(),
      enemies: [
        { kind: 'CUSTOM', label: 'First target', maxHitPoints: 3 },
        { kind: 'CUSTOM', label: 'Second target', maxHitPoints: 4 }
      ]
    })
    await base.owner.caller.mutation(api.encounters.runs.create, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    await base.other.caller.mutation(api.characters.drafts.create, input())
    const before = await snapshot(base.t)
    expect(before.tables.encounterRuns).toHaveLength(1)
    expect(before.tables.encounterRunActors).toHaveLength(2)
    expect(before.tables.campaignSessions).toHaveLength(1)
    await expect(base.owner.caller.mutation(remove, command(campaign))).resolves.toEqual({
      ok: true
    })
    const fenced = await snapshot(base.t)
    expect(fenced.tables.campaignSessions).toEqual(before.tables.campaignSessions)
    await expect(
      base.owner.caller.query(api.campaigns.queries.get, { id: campaign.id })
    ).rejects.toThrow('Campaign not found')
    await finishDeletion(base.t, campaign.id)
    const after = await snapshot(base.t)
    for (const name of [
      'campaigns',
      'campaignMemberships',
      'campaignPlaySettings',
      'campaignSessions',
      'campaignSessionAttendance',
      'campaignSessionRsvps',
      'campaignSessionReferences',
      'campaignSessionNotes',
      'campaignCommands',
      'campaignClocks',
      'campaignClockSegments',
      'campaignClockRecoveries',
      'campaignClockRecoveryPrompts',
      'encounterRuns',
      'encounterRunActors',
      'encounterRunCommands',
      'encounterRuleReceipts',
      'encounterReplayIndex',
      'encounterRuleOccurrences',
      'encounterInitiativeParticipants',
      'encounterInitiativeSides',
      'encounterInitiativeRounds',
      'encounterSceneBindings',
      'encounterActorTokenBindings',
      'campaignCharacterAssignments',
      'campaignCharacterStates'
    ])
      expect(after.tables[name], name).toEqual([])
    for (const name of [
      'encounterBlueprints',
      'encounterBlueprintUpdates',
      'characterDrafts',
      'characterCommandReceipts',
      'authoredRoots',
      'authoredVersions',
      'contentSources',
      'rulesCatalogues'
    ])
      expect(after.tables[name], name).toEqual(before.tables[name])
    expect(
      after.tables.sceneVisionRevisions.filter(
        (row) => 'scope' in row && (row.scope === 'CAMPAIGN' || row.scope === 'PLAY')
      )
    ).toEqual([])
  }, 60_000)
  it('deletes only the Campaign root and owned state, retaining personal drafts and an unrelated Campaign', async () => {
    const base = await fixture()
    const campaign = await base.owner.caller.mutation(create, campaignInput)
    const unrelated = await base.other.caller.mutation(create, {
      ...campaignInput,
      name: 'Retain this table'
    })
    const draft = await base.owner.caller.mutation(api.characters.drafts.create, input())
    const before = await snapshot(base.t)
    await expect(base.owner.caller.mutation(remove, command(campaign))).resolves.toEqual({
      ok: true
    })
    await finishDeletion(base.t, campaign.id)
    const after = await snapshot(base.t)
    const changed = new Set([
      'campaigns',
      'campaignMemberships',
      'campaignPlaySettings',
      'authoredRouteIds',
      'sceneVisionRevisions',
      'accountUsageEntries',
      'userProfiles',
      'campaignDeletionJobs'
    ])
    for (const name of tableNames)
      if (!changed.has(name)) expect(after.tables[name], name).toEqual(before.tables[name])
    expect(
      after.scheduled.filter(
        (job) =>
          job.name !== 'campaigns/deletionJobs:run' &&
          job.name !== 'campaigns/deletionJobs:watchdog'
      )
    ).toEqual(before.scheduled)
    expect(
      after.scheduled.filter((job) => job.name === 'campaigns/deletionJobs:watchdog')
    ).toHaveLength(1)
    expect(after.tables.campaigns).toEqual(
      before.tables.campaigns.filter((row) => !('id' in row && row.id === campaign.id))
    )
    for (const name of ['campaignMemberships', 'campaignPlaySettings'])
      expect(after.tables[name]).toEqual(
        before.tables[name].filter(
          (row) => !('campaignId' in row && row.campaignId === campaign.id)
        )
      )
    expect(after.tables.authoredRouteIds).toEqual(
      before.tables.authoredRouteIds.filter(
        (row) => !('subjectId' in row && row.subjectId === campaign.id)
      )
    )
    expect(after.tables.sceneVisionRevisions).toEqual(
      before.tables.sceneVisionRevisions.filter(
        (row) =>
          !(
            'scope' in row &&
            'id' in row &&
            (row.scope === 'CAMPAIGN' || row.scope === 'PLAY') &&
            row.id === campaign.id
          )
      )
    )
    expect(after.tables.accountUsageEntries).toEqual(
      before.tables.accountUsageEntries.filter(
        (row) =>
          !(
            'resource' in row &&
            row.resource === 'activeHostedCampaigns' &&
            row.sourceId === campaign.id
          )
      )
    )
    expect(after.tables.characterDrafts).toEqual(before.tables.characterDrafts)
    expect(after.tables.authoredRouteIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ subjectId: draft.characterId, subjectKind: 'CHARACTER' }),
        expect.objectContaining({ subjectId: unrelated.id, subjectKind: 'CAMPAIGN' })
      ])
    )
    const profilesAfter = await base.t.run((ctx) => ctx.db.query('userProfiles').collect())
    const ownerBefore = before.tables.userProfiles.find(
      (row) => 'userId' in row && row.userId === base.owner.userId
    )
    if (!ownerBefore || !('entitlementUsage' in ownerBefore))
      throw new Error('Missing owner usage fixture.')
    expect(profilesAfter).toEqual(
      before.tables.userProfiles.map((row) =>
        row._id === ownerBefore._id
          ? {
              ...ownerBefore,
              entitlementUsage: { ...ownerBefore.entitlementUsage, activeHostedCampaigns: 0 }
            }
          : row
      )
    )
    await expect(base.owner.caller.mutation(remove, command(campaign))).resolves.toEqual({
      ok: true
    })
    expect(await snapshot(base.t)).toEqual(after)
  }, 60_000)

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'refuses %s anonymous, outsider, player, departed, inconsistent, stale and malformed requests without any writes',
    async (status) => {
      const base = await fixture()
      const campaign = await base.owner.caller.mutation(create, campaignInput)
      const currentCampaign =
        status === 'ARCHIVED'
          ? await base.owner.caller.mutation(api.campaigns.archive.archive, {
              campaignId: campaign.id,
              expectedVersion: campaign.version
            })
          : campaign
      const args = command(currentCampaign)
      const beforeMembership = await snapshot(base.t)
      for (const caller of [base.t, base.other.caller]) {
        await expect(caller.mutation(remove, args)).rejects.toThrow()
        expect(await snapshot(base.t)).toEqual(beforeMembership)
      }
      const memberId = await base.t.run((ctx) =>
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
      const before = await snapshot(base.t)
      await expect(base.other.caller.mutation(remove, args)).rejects.toThrow('cannot perform')
      await expect(
        base.owner.caller.mutation(remove, { ...args, expectedVersion: args.expectedVersion + 1 })
      ).rejects.toThrow('Campaign changed')
      const malformed = makeFunctionReference<
        'mutation',
        Omit<DeleteCampaignInput, 'confirmation'> & { confirmation: string },
        CampaignDeletionResult
      >('campaigns/deletion:remove')
      await expect(
        base.owner.caller.mutation(malformed, { ...args, confirmation: 'delete' })
      ).rejects.toThrow()
      const impersonated = makeFunctionReference<
        'mutation',
        DeleteCampaignInput & { userId: string },
        CampaignDeletionResult
      >('campaigns/deletion:remove')
      await expect(
        base.owner.caller.mutation(impersonated, { ...args, userId: base.other.userId })
      ).rejects.toThrow()
      expect(await snapshot(base.t)).toEqual(before)
      await base.t.run((ctx) =>
        ctx.db.patch(memberId, { status: 'LEFT', leftAt: new Date().toISOString() })
      )
      const departed = await snapshot(base.t)
      await expect(base.other.caller.mutation(remove, args)).rejects.toThrow('Campaign not found.')
      expect(await snapshot(base.t)).toEqual(departed)
      await base.t.run(async (ctx) => {
        await ctx.db.patch(memberId, { role: 'OWNER', status: 'ACTIVE', leftAt: null })
        const stored = await ctx.db
          .query('campaigns')
          .withIndex('by_publicId', (q) => q.eq('id', currentCampaign.id))
          .unique()
        if (!stored) throw new Error('Missing Campaign.')
        await ctx.db.patch(stored._id, { ownerUserId: base.other.userId })
      })
      const inconsistent = await snapshot(base.t)
      await expect(base.owner.caller.mutation(remove, args)).rejects.toThrow(
        'Stored Campaign authority mismatch.'
      )
      expect(await snapshot(base.t)).toEqual(inconsistent)
    }
  )

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'removes live Scenes, receiving and expired saves from former owners, while retaining unrelated Scenes and map billing until cleanup for %s Campaigns',
    async (status) => {
      const base = await createSceneDefinitionFixture()
      const baseScene = await publishEmptyScene(base)
      const receiving = await base.owner.caller.mutation(begin, {
        ...base.input,
        commandId: crypto.randomUUID(),
        counts: { ...base.input.counts, annotations: 1 }
      })
      await base.owner.caller.mutation(append, {
        input: {
          saveId: receiving.saveId,
          collection: 'annotations',
          offset: 0,
          entities: [
            {
              id: crypto.randomUUID(),
              position: { x: 10, y: 20 },
              text: 'Pending private note',
              visibility: 'GM_ONLY'
            }
          ]
        }
      })
      await base.t.run(async (ctx) => {
        const save = await ctx.db
          .query('sceneDefinitionSaves')
          .withIndex('by_publicId', (q) => q.eq('id', receiving.saveId))
          .unique()
        if (!save) throw new Error('Missing receiving save.')
        const { _id, _creationTime, ...stored } = save
        await ctx.db.insert('sceneDefinitionSaves', {
          ...stored,
          id: crypto.randomUUID(),
          commandId: crypto.randomUUID(),
          ownerUserId: base.other.userId,
          status: 'EXPIRED'
        })
      })
      const unrelated = await base.other.caller.mutation(create, {
        ...campaignInput,
        name: 'Retain other Scenes'
      })
      const unrelatedMapId = crypto.randomUUID()
      await base.t.run(async (ctx) => {
        const map = await ctx.db
          .query('mediaAssets')
          .withIndex('by_publicId', (q) => q.eq('id', base.input.settings.map.assetId))
          .unique()
        if (!map || map.profileClass !== 'VTT_MAP') throw new Error('Missing map.')
        const { _id, _creationTime, ...stored } = map
        await ctx.db.insert('mediaAssets', {
          ...stored,
          id: unrelatedMapId,
          ownerUserId: base.other.userId,
          storageAssetId: unrelatedMapId,
          hasSceneReferences: false,
          variants: stored.variants.map((variant) => ({
            ...variant,
            objectKey: variant.objectKey.replace(map.id, unrelatedMapId)
          }))
        })
        const profile = await ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
          .unique()
        if (!profile) throw new Error('Missing map uploader.')
        await ctx.db.patch(profile._id, { mediaBytes: 3 })
      })
      const otherScene = await publishEmptyScene({
        ...base,
        owner: base.other,
        campaign: unrelated,
        input: {
          ...base.input,
          commandId: crypto.randomUUID(),
          settings: {
            ...base.input.settings,
            campaignId: unrelated.id,
            map: { ...base.input.settings.map, assetId: unrelatedMapId }
          }
        }
      })
      await base.t.run(async (ctx) => {
        for (const [campaignId, sceneId] of [
          [base.campaign.id, baseScene.sceneId],
          [unrelated.id, otherScene.sceneId]
        ] as const)
          await ctx.db.insert('lootTables', {
            owner: { kind: 'SCENE', campaignId, sceneDefinitionId: sceneId },
            version: 1,
            tables: [],
            updatedAt: new Date().toISOString()
          })
        await ctx.db.insert('campaignSceneShowings', {
          campaignId: base.campaign.id,
          sceneId: baseScene.sceneId,
          shownBy: base.owner.userId,
          shownAt: new Date().toISOString()
        })
      })
      const currentCampaign =
        status === 'ARCHIVED'
          ? await base.owner.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
          : base.campaign
      const deletedCampaign =
        status === 'ARCHIVED'
          ? await base.owner.caller.mutation(api.campaigns.archive.archive, {
              campaignId: currentCampaign.id,
              expectedVersion: currentCampaign.version
            })
          : currentCampaign
      const before = await snapshot(base.t)
      const requestStarted = Date.now()
      await base.owner.caller.mutation(remove, command(deletedCampaign))
      await finishDeletion(base.t, deletedCampaign.id)
      const requestCompleted = Date.now()
      const after = await snapshot(base.t)
      for (const name of [
        'campaignScenes',
        'sceneDefinitions',
        'sceneDefinitionSaves',
        'sceneDefinitionEntities',
        'sceneLiveStates',
        'sceneLiveEntities',
        'sceneFogSaves',
        'sceneFogLayers',
        'sceneFogChunks',
        'campaignScenePresentations',
        'campaignSceneShowings',
        'lootTables',
        'campaignContentUsage'
      ]) {
        expect(after.tables[name], name).toEqual(
          before.tables[name].filter((row) => {
            if ('campaignId' in row) return row.campaignId === unrelated.id
            if ('owner' in row) return row.owner.campaignId === unrelated.id
            if ('settings' in row && 'campaignId' in row.settings)
              return row.settings.campaignId === unrelated.id
            if ('saveId' in row) return row.saveId === otherScene.save.saveId
            return 'sceneId' in row && row.sceneId === otherScene.sceneId
          })
        )
      }
      const maps = await base.t.run((ctx) => ctx.db.query('mediaAssets').collect())
      const detached = maps.find((row) => row.id === base.input.settings.map.assetId)
      if (!detached || detached.profileClass !== 'VTT_MAP') throw new Error('Missing retained map.')
      expect(detached).toMatchObject({
        status: 'READY',
        hasSceneReferences: false,
        chargedBytes: 3,
        ownerUserId: base.owner.userId
      })
      expect(detached.cleanupAt).toBeGreaterThanOrEqual(requestStarted + 86_400_000)
      expect(detached.cleanupAt).toBeLessThanOrEqual(requestCompleted + 86_400_000)
      const protectedMap = before.tables.mediaAssets.find(
        (row) => 'id' in row && row.id === unrelatedMapId
      )
      expect(maps.find((row) => row.id === unrelatedMapId)).toEqual(protectedMap)
      expect(
        after.scheduled.filter(
          (job) => job.name === 'media/assets:cleanup' && job.args[0]?.assetId === detached.id
        )
      ).not.toHaveLength(0)
      const profiles = await base.t.run((ctx) => ctx.db.query('userProfiles').collect())
      expect(profiles.find((row) => row.userId === base.owner.userId)?.mediaBytes).toBe(3)
      expect(profiles.find((row) => row.userId === base.other.userId)).toEqual(
        before.tables.userProfiles.find(
          (row) => 'userId' in row && row.userId === base.other.userId
        )
      )
    },
    60_000
  )

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'rolls back all Campaign, Scene, map, usage and scheduled changes after a failure following the final root and usage writes for %s Campaigns',
    async (status) => {
      const base = await createSceneDefinitionFixture()
      await publishEmptyScene(base)
      await base.owner.caller.mutation(api.campaigns.sessions.create, {
        campaignId: base.campaign.id
      })
      const currentCampaign =
        status === 'ARCHIVED'
          ? await base.owner.caller.query(api.campaigns.queries.get, { id: base.campaign.id })
          : base.campaign
      const deletedCampaign =
        status === 'ARCHIVED'
          ? await base.owner.caller.mutation(api.campaigns.archive.archive, {
              campaignId: currentCampaign.id,
              expectedVersion: currentCampaign.version
            })
          : currentCampaign
      await base.owner.caller.mutation(remove, command(deletedCampaign))
      let rootStep: {
        jobId: Id<'campaignDeletionJobs'>
        revision: number
      } | null = null
      for (let page = 0; page < 20; page++) {
        const job = await base.t.run((ctx) =>
          ctx.db
            .query('campaignDeletionJobs')
            .withIndex('by_campaignId', (q) => q.eq('campaignId', deletedCampaign.id))
            .unique()
        )
        if (!job) throw new Error('Missing Campaign deletion job.')
        const membership = await base.t.run((ctx) =>
          ctx.db
            .query('campaignMemberships')
            .withIndex('by_campaignId_userId', (q) => q.eq('campaignId', deletedCampaign.id))
            .first()
        )
        if (job.stage === 'MEMBERSHIPS' && !membership) {
          rootStep = { jobId: job._id, revision: job.revision }
          break
        }
        await base.t.action(runDeletion, { jobId: job._id, revision: job.revision })
      }
      if (!rootStep) throw new Error('Campaign deletion did not reach root removal.')
      const beforeFailure = await snapshot(base.t)
      const original = accountUsage.syncAccountUsage
      let observedDeletedRoot = false
      let observedDeletedRoute = false
      const fault = vi
        .spyOn(accountUsage, 'syncAccountUsage')
        .mockImplementation(async (ctx, resource, sourceId) => {
          await original(ctx, resource, sourceId)
          if (resource === 'activeHostedCampaigns' && sourceId === base.campaign.id) {
            observedDeletedRoot =
              (await ctx.db
                .query('campaigns')
                .withIndex('by_publicId', (q) => q.eq('id', sourceId))
                .unique()) === null
            observedDeletedRoute =
              (await ctx.db
                .query('authoredRouteIds')
                .withIndex('by_subjectId', (q) => q.eq('subjectId', sourceId))
                .unique()) === null
            throw new Error('Injected failure after Campaign root and usage deletion.')
          }
        })
      try {
        await expect(base.t.action(runDeletion, rootStep)).rejects.toThrow('Injected failure')
        expect(observedDeletedRoot).toBe(true)
        expect(observedDeletedRoute).toBe(true)
        const afterFailure = await snapshot(base.t)
        for (const name of tableNames)
          if (name !== 'campaignDeletionJobs')
            expect(afterFailure.tables[name], name).toEqual(beforeFailure.tables[name])
        expect(afterFailure.tables.campaignDeletionJobs).toEqual([
          expect.objectContaining({ stage: 'MEMBERSHIPS', status: 'FAILED' })
        ])
        expect(
          afterFailure.scheduled.filter((job) => job.name !== 'campaigns/deletionJobs:retry')
        ).toEqual(beforeFailure.scheduled)
      } finally {
        fault.mockRestore()
      }
      await base.owner.caller.mutation(remove, command(deletedCampaign))
      await finishDeletion(base.t, deletedCampaign.id)
      expect((await snapshot(base.t)).tables.campaigns).toEqual([])
    },
    60_000
  )

  it.each(['ACTIVE', 'ARCHIVED'] as const)(
    'reconciles assigned Characters and saved drafts while retaining acquired equipment, private HP and personal rules for %s Campaigns',
    async (status) => {
      const base = await readySheetFixture()
      const campaign = await base.other.caller.mutation(create, campaignInput)
      await base.t.run(async (ctx) => {
        await ctx.db.insert('campaignMemberships', {
          campaignId: campaign.id,
          userId: base.owner.userId,
          role: 'PLAYER',
          status: 'ACTIVE',
          accessStartedAt: campaign.createdAt,
          joinedAt: campaign.createdAt,
          leftAt: null
        })
        await makePublishedRootOwned(ctx, acolyte.id, base.other.userId)
      })
      await base.other.caller.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'BACKGROUND',
        subjectId: acolyte.id
      })
      await base.owner.caller.mutation(api.campaigns.assignments.assign, {
        campaignId: campaign.id,
        characterId: base.character.id
      })
      const opened = await base.owner.caller.mutation(api.characters.drafts.create, {
        id: base.character.id,
        systemId: base.character.systemId
      })
      const saved = await base.owner.caller.mutation(api.characters.drafts.save, {
        characterId: base.character.id,
        expectedDraftId: opened.id,
        mode: 'edit',
        character: { ...opened.payload.character, label: 'Keep private draft' }
      })
      const before = await base.readState()
      if (!before.character) throw new Error('Missing assigned Character.')
      const originalDocument = readCharacterRecord(before.character)
      const protectedRoots = await base.t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').collect(),
        versions: await ctx.db.query('authoredVersions').collect(),
        sources: await ctx.db.query('contentSources').collect(),
        catalogues: await ctx.db.query('rulesCatalogues').collect()
      }))
      const currentCampaign =
        status === 'ARCHIVED'
          ? await base.other.caller.query(api.campaigns.queries.get, { id: campaign.id })
          : campaign
      const deletedCampaign =
        status === 'ARCHIVED'
          ? await base.other.caller.mutation(api.campaigns.archive.archive, {
              campaignId: currentCampaign.id,
              expectedVersion: currentCampaign.version
            })
          : currentCampaign
      await base.other.caller.mutation(remove, command(deletedCampaign))
      await finishDeletion(base.t, deletedCampaign.id)
      const after = await base.readState()
      if (!after.character) throw new Error('Deleted personal Character.')
      const active = after.character
      expect(after.character).toMatchObject({
        status: 'DRAFT',
        play: { streamVersion: before.character.play.streamVersion + 1 }
      })
      expect(readCharacterSheetState(after.character)).toEqual(
        readCharacterSheetState(before.character)
      )
      expect(after.receipts).toEqual(before.receipts)
      const repaired = readCharacterRecord(after.character)
      expect(repaired.intent.background.backgroundId).toBe('')
      expect(repaired.intent.race).toEqual(originalDocument.intent.race)
      expect(repaired.intent.classes).toEqual(originalDocument.intent.classes)
      expect(repaired.state.currency).toEqual(originalDocument.state.currency)
      expect(
        repaired.state.equipment.inventory.map((item) => ({
          ...item,
          retainedRulesJson: undefined
        }))
      ).toEqual(
        originalDocument.state.equipment.inventory.map((item) => ({
          ...item,
          retainedRulesJson: undefined
        }))
      )
      for (const item of repaired.state.equipment.inventory) {
        if (!item.retainedRulesJson) throw new Error('Missing acquired Equipment rules.')
        const retained = acquiredEquipmentRulesSchema.parse(JSON.parse(item.retainedRulesJson))
        expect(retained).toMatchObject({
          equipmentId: item.equipmentId,
          systemId: repaired.systemId
        })
        for (const source of retained.sources) {
          expect(source.compilation.authoredChecksum).toBe(source.checksum)
          const root = protectedRoots.roots.find(
            (row) => row.id === source.subjectId && row.subjectKind === source.subjectKind
          )
          const version = protectedRoots.versions.find((row) => row._id === root?.currentVersionId)
          if (!version) throw new Error('Missing retained publication.')
          const [published, compilation] = await base.t.run(async (ctx) => [
            await readStoredAuthoredVersionDocument(ctx, version),
            await readAuthoredVersionCompilation(ctx, { versionId: version.versionId })
          ])
          expect(source.compilation).toEqual(compilation)
          expect(published).toMatchObject({ label: source.presentation.label })
        }
      }
      const draft = await base.t.run((ctx) =>
        ctx.db
          .query('characterDrafts')
          .withIndex('by_characterId', (q) => q.eq('characterId', base.character.id))
          .unique()
      )
      expect(draft).toMatchObject({ id: saved.id, label: 'Keep private draft' })
      if (!draft) throw new Error('Deleted saved draft.')
      const repairedPayload = await base.t.run(
        async (ctx) => (await readCharacterDraft(ctx, draft, active)).payload
      )
      const repairedDraft = characterAuthoredDtoSchema.parse(repairedPayload.character)
      expect(repairedDraft.intent.background.backgroundId).toBe('')
      expect(repairedDraft.label).toBe('Keep private draft')
      const afterState = await base.t.run(async (ctx) => ({
        roots: await ctx.db.query('authoredRoots').collect(),
        versions: await ctx.db.query('authoredVersions').collect(),
        sources: await ctx.db.query('contentSources').collect(),
        catalogues: await ctx.db.query('rulesCatalogues').collect()
      }))
      expect(afterState).toEqual(protectedRoots)
      const afterTables = (await snapshot(base.t)).tables
      for (const name of [
        'campaigns',
        'campaignMemberships',
        'campaignContentShares',
        'campaignCharacterAssignments',
        'campaignCharacterStates',
        'campaignEvents'
      ])
        expect(afterTables[name]).toEqual([])
      await expect(
        base.owner.caller.query(api.characters.sheet.get, { id: base.character.id })
      ).rejects.toThrow('Builder repair')
    },
    60_000
  )
})
