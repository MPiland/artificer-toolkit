import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput,
  UpdateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  type CampaignPlaySettingsDto,
  type CampaignPlaySettingsOptionsDto,
  type SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { ruleGraphDefinitionDtoSchema } from '@artificer-toolkit/schema/api/rulesRuntime'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { jsonValueSchema } from '@artificer-toolkit/schema/projections/identity'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_OPTIONAL_COMBAT_DEFINITIONS } from '@artificer-toolkit/source-data/srd/optionalCombat.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { internal } from '../_generated/api'
import { snapshotEncounterPolicies } from '../encounters/policySnapshots'
import { requireCampaignAuthority } from './documents'
import { encodeDefinitionDocument } from '../content/definitionDocumentJson'

const create = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const updateCampaign = makeFunctionReference<'mutation', UpdateCampaignInput, CampaignDetailDto>(
  'campaigns/update:update'
)
const get = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const options = makeFunctionReference<
  'query',
  { campaignId: string },
  CampaignPlaySettingsOptionsDto
>('campaigns/playSettings:options')
const save = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
// Widened to send an automation mode the contract no longer accepts.
const saveUnchecked = makeFunctionReference<
  'mutation',
  Omit<SaveCampaignPlaySettingsInput, 'automationMode'> & { automationMode: string },
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')
const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(create, {
    name: 'Settings test',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(get, { campaignId: campaign.id })
  return { ...base, campaign, settings }
}

function input(settings: CampaignPlaySettingsDto): SaveCampaignPlaySettingsInput {
  const { version, updatedAt: _updatedAt, ...fields } = settings
  return { ...fields, expectedVersion: version }
}

async function stored(t: Awaited<ReturnType<typeof setup>>['t']) {
  return t.run(async (ctx) => ({
    campaigns: await ctx.db.query('campaigns').collect(),
    memberships: await ctx.db.query('campaignMemberships').collect(),
    settings: await ctx.db.query('campaignPlaySettings').collect()
  }))
}

async function initiative(t: Awaited<ReturnType<typeof setup>>['t']) {
  const score = ruleGraphDefinitionDtoSchema.parse({
    schemaVersion: 1,
    id: crypto.randomUUID(),
    gameSystemId: srdSystemRecord.id,
    definitionFamilyKey: 'rules-runtime-graph',
    nodes: [
      {
        id: 'score',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'LITERAL', value: 1 },
          right: { kind: 'LITERAL', value: 0 }
        }
      }
    ],
    outputs: {
      score: { kind: 'NODE_OUTPUT', nodeId: 'score', port: 'value' },
      automatic: { kind: 'LITERAL', value: true }
    }
  })
  const choice = ruleGraphDefinitionDtoSchema.parse({
    ...score,
    id: crypto.randomUUID(),
    nodes: [
      {
        id: 'score',
        operation: { key: 'number.add', contractVersion: 1 },
        inputs: {
          left: { kind: 'FACT', factKey: 'minimum-index' },
          right: { kind: 'LITERAL', value: 0 }
        }
      }
    ]
  })
  const scorePin = {
    definitionId: score.id,
    definitionVersion: 1,
    definitionChecksum: checksumRuleDocument(score),
    scoreOutput: 'score',
    sortDirection: 'DESCENDING',
    automaticOutput: 'automatic'
  }
  const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.parse({
    schemaVersion: 1,
    kind: 'INITIATIVE_POLICY',
    id: crypto.randomUUID(),
    gameSystemId: srdSystemRecord.id,
    procedure: 'ACTOR_ROLL',
    cadence: 'ENCOUNTER_START',
    evaluationGraph: scorePin,
    orderChoiceGraph: {
      definitionId: choice.id,
      definitionVersion: 1,
      definitionChecksum: checksumRuleDocument(choice),
      selectionOutput: 'score',
      minimumIndexFact: 'minimum-index',
      maximumIndexFact: 'maximum-index'
    },
    tieResolvers: [{ ...scorePin, repeatOnTie: false, maximumAttempts: 1 }],
    defaultTieResolverDefinitionId: score.id
  })
  await t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [score, choice, policy].map((document) => ({
      id: document.id,
      definitionFamilyKey: 'kind' in document ? 'initiative-policy' : 'rules-runtime-graph',
      label: document.id,
      description: 'Campaign initiative fixture',
      document: jsonValueSchema.parse(document),
      checksum: checksumRuleDocument(document)
    }))
  })
  return { policy, score, choice }
}

async function frozenOptionalRun(
  base: Awaited<ReturnType<typeof setup>>,
  contentSourceId: string,
  catalogueId: string,
  optionalId: string
) {
  const { owner, campaign, settings } = base
  const updated = await owner.caller.mutation(updateCampaign, {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    additionalRulesCatalogueIds: [catalogueId]
  })
  const selected = await owner.caller.mutation(save, {
    ...input(settings),
    optionalCombatRuleDefinitionIds: [optionalId]
  })
  const blueprint = await owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Frozen policy fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
  })
  const run = await owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await owner.caller.mutation(save, {
    ...input(selected),
    optionalCombatRuleDefinitionIds: []
  })
  return { ...base, campaign: updated, run, contentSourceId }
}

async function optionalCatalogue(base: Awaited<ReturnType<typeof setup>>) {
  const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
    (definition) => definition.document.kind === 'DISARM'
  )!
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [optional]
  })
  const contentSourceId = crypto.randomUUID()
  const catalogueId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: contentSourceId })
    await ctx.db.insert('rulesCatalogues', {
      ...SRD_RULES_CATALOGUE,
      id: catalogueId,
      contentSourceIds: [contentSourceId]
    })
    const definition = await ctx.db
      .query('reusableDefinitions')
      .withIndex('by_publicId', (q) => q.eq('id', optional.id))
      .unique()
    if (!definition) throw new Error('Missing optional combat fixture.')
    await ctx.db.patch(definition._id, { contentSourceId })
  })
  return { optional, contentSourceId, catalogueId }
}

describe('native Campaign play settings', () => {
  it('freezes exact Run policy snapshots through current Campaign source authorization', async () => {
    const { t, owner, campaign, settings } = await setup()
    const read = () =>
      t.run(async (ctx) => {
        const authorized = await requireCampaignAuthority(ctx, campaign.id, owner.userId)
        return snapshotEncounterPolicies(ctx, authorized.campaign, owner.userId)
      })
    expect(await read()).toMatchObject({
      automationMode: settings.automationMode,
      zoneNoticing: 'GM_PROMPT',
      initiativePolicySnapshot: null,
      initiativePolicySnapshotChecksum: null,
      optionalCombatSnapshot: { definitions: [] }
    })
    const { policy, score, choice } = await initiative(t)
    const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )!
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [optional]
    })
    const saved = await owner.caller.mutation(save, {
      ...input(settings),
      automationMode: 'MANUAL',
      trackAmmunition: true,
      zoneNoticing: 'SEARCH_ONLY',
      initiativePolicyDefinitionId: policy.id,
      initiativeTieDefinitionId: score.id,
      optionalCombatRuleDefinitionIds: [optional.id]
    })
    const frozen = await read()
    expect(frozen).toMatchObject({
      automationMode: 'MANUAL',
      trackAmmunition: true,
      zoneNoticing: 'SEARCH_ONLY',
      initiativePolicySnapshot: {
        gameSystemId: campaign.gameSystemId,
        policy: {
          definitionId: policy.id,
          definitionVersion: 1,
          definitionChecksum: checksumRuleDocument(policy),
          document: policy
        },
        evaluationGraph: {
          definitionId: score.id,
          definitionChecksum: checksumRuleDocument(score),
          document: score
        },
        orderChoiceGraph: {
          definitionId: choice.id,
          definitionChecksum: checksumRuleDocument(choice),
          document: choice
        },
        tieResolver: { definitionId: score.id, document: score }
      },
      optionalCombatSnapshot: {
        definitions: [
          {
            definitionId: optional.id,
            contentSourceId: SRD_CONTENT_SOURCE.id,
            document: optional.document
          }
        ]
      }
    })
    expect(frozen.initiativePolicySnapshotChecksum).toBe(
      checksumCanonicalJson(frozen.initiativePolicySnapshot)
    )
    expect(frozen.optionalCombatSnapshotChecksum).toBe(
      checksumCanonicalJson(frozen.optionalCombatSnapshot)
    )
    await owner.caller.mutation(save, {
      ...input(saved),
      automationMode: 'ASSISTED',
      trackAmmunition: false,
      zoneNoticing: 'GM_PROMPT'
    })
    expect(await read()).toMatchObject({
      automationMode: 'ASSISTED',
      trackAmmunition: false,
      zoneNoticing: 'GM_PROMPT'
    })
    expect(frozen).toMatchObject({
      automationMode: 'MANUAL',
      trackAmmunition: true,
      zoneNoticing: 'SEARCH_ONLY'
    })
    await t.run(async (ctx) => {
      const graph = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', score.id))
        .unique()
      if (!graph) throw new Error('Missing graph fixture.')
      await ctx.db.patch(graph._id, { contentSourceId: crypto.randomUUID() })
    })
    await expect(read()).rejects.toThrow('available')
  }, 30000)

  it.each(['policy', 'score', 'choice', 'optional'] as const)(
    'rejects catalogue removal needed by the selected %s definition without changing Campaign/settings',
    async (kind) => {
      const { t, owner, campaign, settings } = await setup()
      const definitions = await initiative(t)
      const optional = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
        (definition) => definition.document.kind === 'DISARM'
      )!
      await t.mutation(internal.content.import.importDefinitions, {
        contentSourceId: SRD_CONTENT_SOURCE.id,
        definitions: [optional]
      })
      const definitionId = kind === 'optional' ? optional.id : definitions[kind].id
      const contentSourceId = crypto.randomUUID()
      const catalogueId = crypto.randomUUID()
      await t.run(async (ctx) => {
        await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: contentSourceId })
        await ctx.db.insert('rulesCatalogues', {
          ...SRD_RULES_CATALOGUE,
          id: catalogueId,
          contentSourceIds: [contentSourceId]
        })
        const definition = await ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', definitionId))
          .unique()
        if (!definition) throw new Error('Missing definition fixture.')
        await ctx.db.patch(definition._id, { contentSourceId })
      })
      const updated = await owner.caller.mutation(updateCampaign, {
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        additionalRulesCatalogueIds: [catalogueId]
      })
      await owner.caller.mutation(save, {
        ...input(settings),
        initiativePolicyDefinitionId: definitions.policy.id,
        initiativeTieDefinitionId: definitions.score.id,
        optionalCombatRuleDefinitionIds: [optional.id]
      })
      const before = await stored(t)
      await expect(
        owner.caller.mutation(updateCampaign, {
          campaignId: campaign.id,
          expectedVersion: updated.version,
          additionalRulesCatalogueIds: []
        })
      ).rejects.toThrow(kind === 'optional' ? optional.id : definitions.policy.id)
      expect(await stored(t)).toEqual(before)
    }
  )

  it.each(['PREPARED', 'ACTIVE', 'COMPLETED'] as const)(
    'uses the frozen optional-policy source for %s Runs after current settings are cleared',
    async (status) => {
      const base = await setup()
      const { optional, contentSourceId, catalogueId } = await optionalCatalogue(base)
      const { t, owner, campaign, run } = await frozenOptionalRun(
        base,
        contentSourceId,
        catalogueId,
        optional.id
      )
      if (status !== 'PREPARED') {
        await t.run(async (ctx) => {
          const row = await ctx.db
            .query('encounterRuns')
            .withIndex('by_publicId', (q) => q.eq('id', run.id))
            .unique()
          if (!row) throw new Error('Missing Run fixture.')
          const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
          const updatedState = encounterRunStateSchema.parse({ ...state, status })
          await ctx.db.patch(row._id, {
            status,
            stateJson: JSON.stringify(updatedState),
            stateChecksum: checksumCanonicalJson(updatedState)
          })
        })
      }
      const before = await stored(t)
      const removal = owner.caller.mutation(updateCampaign, {
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        additionalRulesCatalogueIds: []
      })
      if (status === 'COMPLETED') {
        await expect(removal).resolves.toMatchObject({ additionalRulesCatalogueIds: [] })
      } else {
        await expect(removal).rejects.toThrow('active combat-policy dependency')
        expect(await stored(t)).toEqual(before)
      }
    },
    30000
  )

  it('rejects frozen Run catalogue removal when its stored state checksum is corrupt', async () => {
    const base = await setup()
    const { optional, contentSourceId, catalogueId } = await optionalCatalogue(base)
    const { t, owner, campaign, run } = await frozenOptionalRun(
      base,
      contentSourceId,
      catalogueId,
      optional.id
    )
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run fixture.')
      await ctx.db.patch(row._id, { stateChecksum: '0'.repeat(64) })
    })
    const before = await stored(t)
    await expect(
      owner.caller.mutation(updateCampaign, {
        campaignId: campaign.id,
        expectedVersion: campaign.version,
        additionalRulesCatalogueIds: []
      })
    ).rejects.toThrow('Stored Encounter policy snapshot mismatch')
    expect(await stored(t)).toEqual(before)
  }, 30000)

  it('protects frozen initiative sources after current settings are cleared', async () => {
    const base = await setup()
    const { t, owner, campaign, settings } = base
    const { policy, score, choice } = await initiative(t)
    const contentSourceId = crypto.randomUUID()
    const catalogueId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: contentSourceId })
      await ctx.db.insert('rulesCatalogues', {
        ...SRD_RULES_CATALOGUE,
        id: catalogueId,
        contentSourceIds: [contentSourceId]
      })
      for (const definitionId of [policy.id, score.id, choice.id]) {
        const definition = await ctx.db
          .query('reusableDefinitions')
          .withIndex('by_publicId', (q) => q.eq('id', definitionId))
          .unique()
        if (!definition) throw new Error('Missing initiative fixture.')
        await ctx.db.patch(definition._id, { contentSourceId })
      }
    })
    const updated = await owner.caller.mutation(updateCampaign, {
      campaignId: campaign.id,
      expectedVersion: campaign.version,
      additionalRulesCatalogueIds: [catalogueId]
    })
    const selected = await owner.caller.mutation(save, {
      ...input(settings),
      initiativePolicyDefinitionId: policy.id,
      initiativeTieDefinitionId: score.id
    })
    const blueprint = await owner.caller.mutation(createBlueprint, {
      gameSystemId: campaign.gameSystemId,
      name: 'Frozen initiative fixture',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 }]
    })
    await owner.caller.mutation(createRun, {
      campaignId: campaign.id,
      blueprintId: blueprint.id,
      commandId: crypto.randomUUID()
    })
    await owner.caller.mutation(save, {
      ...input(selected),
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null
    })
    const before = await stored(t)
    await expect(
      owner.caller.mutation(updateCampaign, {
        campaignId: updated.id,
        expectedVersion: updated.version,
        additionalRulesCatalogueIds: []
      })
    ).rejects.toThrow('active combat-policy dependency')
    expect(await stored(t)).toEqual(before)
  }, 30000)

  it('projects initiative labels only when every advertised tie resolver is currently enabled', async () => {
    const { t, owner, campaign } = await setup()
    const { policy, score } = await initiative(t)
    const result = await owner.caller.query(options, { campaignId: campaign.id })
    expect(result).toEqual({
      initiativePolicies: [
        {
          definitionId: policy.id,
          label: policy.id,
          defaultTieResolverDefinitionId: score.id,
          tieResolvers: [{ definitionId: score.id, label: score.id }]
        }
      ],
      optionalCombatRules: []
    })
    await t.run(async (ctx) => {
      const sourceId = crypto.randomUUID()
      await ctx.db.insert('contentSources', { ...SRD_CONTENT_SOURCE, id: sourceId })
      const graph = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', score.id))
        .unique()
      if (!graph) throw new Error('Missing graph.')
      await ctx.db.patch(graph._id, { contentSourceId: sourceId })
    })
    await expect(owner.caller.query(options, { campaignId: campaign.id })).resolves.toEqual({
      initiativePolicies: [],
      optionalCombatRules: []
    })
  })

  it('saves the shared settings contract without advancing the Campaign root and preserves owner/member text views', async () => {
    const { t, owner, other, campaign, settings } = await setup()
    const before = await stored(t)
    const text = 'Avoid the shitstorm.'
    const saved = await owner.caller.mutation(save, {
      ...input(settings),
      normalCadenceDays: 14,
      expectedDurationMinutes: 240,
      quorum: 3,
      absentCharacterPolicy: text,
      contentGuidance: text,
      allowedContentRules: text,
      tableConduct: text,
      contentBoundaries: text,
      safetyPractices: ['SESSION_ZERO'],
      liveSafetyMethod: text,
      automationMode: 'MANUAL'
    })
    expect(saved).toMatchObject({
      version: 1,
      contentGuidance: text,
      automationMode: 'MANUAL'
    })
    expect((await stored(t)).campaigns).toEqual(before.campaigns)
    await expect(owner.caller.query(get, { campaignId: campaign.id })).resolves.toEqual(saved)
    await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    const shared = await other.caller.query(get, { campaignId: campaign.id })
    for (const field of [
      'absentCharacterPolicy',
      'contentGuidance',
      'allowedContentRules',
      'tableConduct',
      'contentBoundaries',
      'liveSafetyMethod'
    ] as const)
      expect(shared[field]).toBe('Avoid the ****storm.')
    expect(shared.safetyPractices).toEqual(['SESSION_ZERO'])
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!record) throw new Error('Missing Campaign.')
      await ctx.db.patch(record._id, { contentMaturity: 'MATURE' })
    })
    await expect(other.caller.query(get, { campaignId: campaign.id })).resolves.toEqual(saved)
    expect((await stored(t)).settings[0]?.contentGuidance).toBe(text)
  })

  it('requires current active-owner authority for writes, while archived members retain reads', async () => {
    const { t, owner, other, campaign, settings } = await setup()
    const command = input(settings)
    const before = await stored(t)
    await expect(t.query(get, { campaignId: campaign.id })).rejects.toThrow('Unauthenticated')
    await expect(t.mutation(save, command)).rejects.toThrow('Unauthenticated')
    await expect(other.caller.query(get, { campaignId: campaign.id })).rejects.toThrow('not found')
    await expect(other.caller.mutation(save, command)).rejects.toThrow('not found')
    expect(await stored(t)).toEqual(before)
    const membershipId = await t.run((ctx) =>
      ctx.db.insert('campaignMemberships', {
        campaignId: campaign.id,
        userId: other.userId,
        role: 'PLAYER',
        status: 'ACTIVE',
        accessStartedAt: campaign.createdAt,
        joinedAt: campaign.createdAt,
        leftAt: null
      })
    )
    await expect(other.caller.mutation(save, command)).rejects.toThrow('cannot perform')
    await t.run((ctx) =>
      ctx.db.patch(membershipId, { status: 'LEFT', leftAt: new Date().toISOString() })
    )
    await expect(other.caller.query(get, { campaignId: campaign.id })).rejects.toThrow('not found')
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!record) throw new Error('Missing Campaign.')
      await ctx.db.patch(record._id, { status: 'ARCHIVED' })
    })
    const archived = await stored(t)
    await expect(owner.caller.mutation(save, command)).rejects.toThrow('read-only')
    await expect(owner.caller.query(get, { campaignId: campaign.id })).resolves.toEqual(settings)
    expect(await stored(t)).toEqual(archived)
  })

  it('allows one same-version save and rejects stale or malformed replacements without partial writes', async () => {
    const { t, owner, settings } = await setup()
    const results = await Promise.allSettled([
      owner.caller.mutation(save, { ...input(settings), quorum: 2 }),
      owner.caller.mutation(save, { ...input(settings), quorum: 4 })
    ])
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    const after = await stored(t)
    expect(after.settings[0]?.version).toBe(1)
    await expect(owner.caller.mutation(save, input(settings))).rejects.toThrow(
      'changed before saving'
    )
    await expect(
      owner.caller.mutation(save, { ...input(settings), expectedVersion: 1, quorum: 0 })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(save, {
        ...input(settings),
        expectedVersion: 1,
        initiativeTieDefinitionId: crypto.randomUUID()
      })
    ).rejects.toThrow()
    await expect(
      owner.caller.mutation(saveUnchecked, {
        ...input(settings),
        expectedVersion: 1,
        automationMode: 'AUTOMATIC'
      })
    ).rejects.toThrow()
    expect(await stored(t)).toEqual(after)
  })

  it('validates explicit initiative choices and the v4 System default against current enabled graph sources', async () => {
    const { t, owner, campaign, settings } = await setup()
    const { policy, score, choice } = await initiative(t)
    const saved = await owner.caller.mutation(save, {
      ...input(settings),
      initiativePolicyDefinitionId: policy.id,
      initiativeTieDefinitionId: score.id
    })
    expect(saved.initiativePolicyDefinitionId).toBe(policy.id)
    await t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.gameSystemId))
        .unique()
      if (!system) throw new Error('Missing System.')
      const document = jsonValueSchema.parse({
        ...srdSystemRecord,
        initiativePolicy: { defaultDefinitionId: policy.id }
      })
      await ctx.db.patch(system._id, { document, checksum: checksumRuleDocument(document) })
    })
    const defaults = {
      ...input(saved),
      initiativePolicyDefinitionId: null,
      initiativeTieDefinitionId: null
    }
    const defaultSaved = await owner.caller.mutation(save, defaults)
    expect(defaultSaved.initiativePolicyDefinitionId).toBeNull()
    const orphanSourceId = crypto.randomUUID()
    await t.run(async (ctx) => {
      await ctx.db.insert('contentSources', {
        ...SRD_CONTENT_SOURCE,
        id: orphanSourceId,
        code: 'unselected',
        label: 'Unselected'
      })
      const graph = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', choice.id))
        .unique()
      if (!graph) throw new Error('Missing graph.')
      await ctx.db.patch(graph._id, { contentSourceId: orphanSourceId })
    })
    const before = await stored(t)
    await expect(owner.caller.mutation(save, input(defaultSaved))).rejects.toThrow('available')
    expect(await stored(t)).toEqual(before)
  })

  it('rejects stale initiative graph checksums and unpermitted ties without changing settings', async () => {
    const { t, owner, settings } = await setup()
    const { policy, score } = await initiative(t)
    const command = { ...input(settings), initiativePolicyDefinitionId: policy.id }
    const before = await stored(t)
    await expect(
      owner.caller.mutation(save, { ...command, initiativeTieDefinitionId: crypto.randomUUID() })
    ).rejects.toThrow('not permitted')
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', score.id))
        .unique()
      if (!record) throw new Error('Missing graph.')
      const document = {
        ...score,
        outputs: { ...score.outputs, automatic: { kind: 'LITERAL' as const, value: false } }
      }
      await ctx.db.patch(record._id, {
        documentJson: encodeDefinitionDocument(document),
        checksum: checksumRuleDocument(document)
      })
    })
    await expect(owner.caller.mutation(save, command)).rejects.toThrow('exact published version')
    expect(await stored(t)).toEqual(before)
  })

  it('validates optional rules through the installed policy and current typed System vocabulary', async () => {
    const { t, owner, settings } = await setup()
    const disarm = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'DISARM'
    )
    const mark = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'MARK'
    )
    if (!disarm || !mark) throw new Error('Missing optional combat fixtures.')
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [disarm, mark]
    })
    const saved = await owner.caller.mutation(save, {
      ...input(settings),
      optionalCombatRuleDefinitionIds: [disarm.id]
    })
    expect(saved.optionalCombatRuleDefinitionIds).toEqual([disarm.id])
    const before = await stored(t)
    await expect(
      owner.caller.mutation(save, { ...input(saved), optionalCombatRuleDefinitionIds: [mark.id] })
    ).rejects.toThrow('not available for Encounter execution')
    await expect(
      owner.caller.mutation(save, {
        ...input(saved),
        optionalCombatRuleDefinitionIds: [disarm.id, disarm.id]
      })
    ).rejects.toThrow('unique')
    await t.run(async (ctx) => {
      const system = await ctx.db
        .query('systems')
        .withIndex('by_publicId', (q) => q.eq('id', srdSystemRecord.id))
        .unique()
      if (!system) throw new Error('Missing System.')
      const document = jsonValueSchema.parse({ ...srdSystemRecord, skills: [], passives: [] })
      await ctx.db.patch(system._id, { document, checksum: checksumRuleDocument(document) })
    })
    await expect(owner.caller.mutation(save, input(saved))).rejects.toThrow(
      'current Game System vocabulary'
    )
    expect(await stored(t)).toEqual(before)
  })

  it('offers and saves Injuries only while its System policy resolves it (ATTACK-15.3)', async () => {
    const { t, owner, campaign, settings } = await setup()
    const injuries = SRD_OPTIONAL_COMBAT_DEFINITIONS.find(
      (definition) => definition.document.kind === 'INJURIES'
    )
    if (!injuries) throw new Error('Missing Injuries fixture.')
    const unresolvedDocument = {
      ...injuries.document,
      id: crypto.randomUUID(),
      module: {
        ...injuries.document.module,
        contractVersion: injuries.document.module.contractVersion + 1
      }
    }
    const unresolved = {
      ...injuries,
      id: unresolvedDocument.id,
      label: 'Injuries, unsupported contract',
      document: unresolvedDocument,
      checksum: checksumRuleDocument(unresolvedDocument)
    }
    await t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: [injuries, unresolved]
    })
    const offered = await owner.caller.query(options, { campaignId: campaign.id })
    expect(offered.optionalCombatRules).toContainEqual({
      definitionId: injuries.id,
      label: injuries.label,
      kind: 'INJURIES'
    })
    expect(offered.optionalCombatRules.map(({ definitionId }) => definitionId)).not.toContain(
      unresolved.id
    )
    const saved = await owner.caller.mutation(save, {
      ...input(settings),
      optionalCombatRuleDefinitionIds: [injuries.id]
    })
    expect(saved.optionalCombatRuleDefinitionIds).toEqual([injuries.id])
    const before = await stored(t)
    await expect(
      owner.caller.mutation(save, {
        ...input(saved),
        optionalCombatRuleDefinitionIds: [unresolved.id]
      })
    ).rejects.toThrow('not available for Encounter execution')
    expect(await stored(t)).toEqual(before)
  })

  it('fails closed for missing native settings instead of manufacturing a second lifecycle', async () => {
    const { t, owner, campaign, settings } = await setup()
    await t.run(async (ctx) => {
      const record = await ctx.db
        .query('campaignPlaySettings')
        .withIndex('by_campaignId', (q) => q.eq('campaignId', campaign.id))
        .unique()
      if (!record) throw new Error('Missing settings.')
      await ctx.db.delete(record._id)
    })
    const before = await stored(t)
    await expect(owner.caller.query(get, { campaignId: campaign.id })).rejects.toThrow(
      'unavailable'
    )
    await expect(owner.caller.mutation(save, input(settings))).rejects.toThrow('unavailable')
    expect(await stored(t)).toEqual(before)
  })
})
