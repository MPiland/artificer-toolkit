import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  createCampaignSessionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CreateEncounterInputDto,
  EncounterGmProjectionDto,
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { readyCharacterFixture } from '../../tests/fixtures/readyCharacter'
import { importedSubject } from '../../tests/fixtures/publication'
import { api, internal } from '../_generated/api'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const createSession = makeFunctionReference<
  'mutation',
  z.input<typeof createCampaignSessionInputSchema>,
  CampaignSessionDto
>('campaigns/sessions:create')
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
  const base = await readyCharacterFixture()
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Run creation',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const { draft, character } = await base.createCharacter()
  await base.owner.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: draft.id,
    mode: 'create',
    character
  })
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
    await ctx.db.insert('campaignCharacterAssignments', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      characterId: character.id,
      assignedAt: campaign.createdAt
    })
  })
  const session = await base.other.caller.mutation(createSession, { campaignId: campaign.id })
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Training',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 10 }]
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignSessionAttendance')
      .withIndex('by_campaignId_sessionId_characterId', (q) =>
        q.eq('campaignId', campaign.id).eq('sessionId', session.id).eq('characterId', character.id)
      )
      .unique()
    if (!row) throw new Error('Missing fixture attendance')
    await ctx.db.patch(row._id, { present: true })
  })
  const input = {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  }
  return { ...base, campaign, session, blueprint, character, input }
}

describe('native Encounter Run creation', () => {
  it('evaluates a real Creature snapshot through the native policy', async () => {
    const { t, other, input } = await setup()
    await t.mutation(internal.content.import.importSubjects, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
    })
    const blueprint = await other.caller.mutation(createBlueprint, {
      gameSystemId: wolf.systemId,
      name: 'Wolves',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CREATURE', sourceId: wolf.id }]
    })
    const result = await other.caller.mutation(createRun, { ...input, blueprintId: blueprint.id })
    const actor = result.actors.find((candidate) => candidate.kind === 'CREATURE')
    expect(actor).toMatchObject({
      sourceId: wolf.id,
      currentHitPoints: wolf.hitPoints,
      statBlock: { armorClass: wolf.armorClass }
    })
    expect(actor?.features.map((feature) => feature.id)).toEqual(
      wolf.features?.map((feature) => feature.id) ?? []
    )
    expect(result.rulePackRevisionId).toBeNull()
  }, 30000)
  it('atomically snapshots attending Characters and enemies, and replays without source reads', async () => {
    const { t, other, input, character, blueprint } = await setup()
    const uppercaseInput = {
      ...input,
      campaignId: input.campaignId.toUpperCase(),
      sessionId: input.sessionId.toUpperCase(),
      blueprintId: input.blueprintId.toUpperCase(),
      commandId: input.commandId.toUpperCase()
    }
    const result = await other.caller.mutation(createRun, uppercaseInput)
    expect(result).toMatchObject({
      status: 'PREPARED',
      version: 0,
      round: 0,
      rulePackRevisionId: null,
      blueprintId: blueprint.id,
      blueprintVersion: blueprint.version,
      blueprintChecksum: blueprint.setupChecksum
    })
    expect(result.actors).toHaveLength(2)
    expect(result.actors.find((actor) => actor.kind === 'CHARACTER')).toMatchObject({
      sourceId: character.id,
      sourceRevision: 1
    })
    expect(result.actors.find((actor) => actor.kind === 'CUSTOM')).toMatchObject({
      label: 'Dummy',
      currentHitPoints: 10
    })
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', result.id))
        .unique()
      if (!row) throw new Error('Missing Run')
      const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
      expect(checksumCanonicalJson(state)).toBe(row.stateChecksum)
      expect(checksumCanonicalJson(result)).toBe(row.projectionChecksum)
      expect(state.sides).toHaveLength(2)
      expect(state.sideRelationships[0]?.relationshipKind).toBe('HOSTILE')
      const relationship = state.sideRelationships[0]!
      expect(relationship.firstSideId < relationship.secondSideId).toBe(true)
      const actors = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', result.id))
        .collect()
      expect(actors).toHaveLength(2)
      for (const actor of actors) {
        const decoded = encounterRunActorStateSchema.parse(JSON.parse(actor.stateJson))
        expect(decoded.encounterId).toBe(result.id)
        expect(state.actorIds).toContain(decoded.id)
        expect(state.sides.map((side) => side.id)).toContain(decoded.sideId)
        expect(checksumCanonicalJson(decoded)).toBe(actor.stateChecksum)
      }
      const blueprintRow = await ctx.db
        .query('encounterBlueprints')
        .withIndex('by_publicId', (q) => q.eq('id', blueprint.id))
        .unique()
      if (!blueprintRow) throw new Error('Missing Blueprint')
      await ctx.db.patch(blueprintRow._id, { enemiesJson: 'invalid' })
    })
    expect(await other.caller.mutation(createRun, uppercaseInput)).toEqual(result)
    expect(await other.caller.mutation(createRun, input)).toEqual(result)
    expect(await t.run((ctx) => ctx.db.query('encounterRuns').collect())).toHaveLength(1)
    await expect(
      other.caller.mutation(createRun, { ...input, blueprintId: crypto.randomUUID() })
    ).rejects.toThrow('different input')
    expect(await t.run((ctx) => ctx.db.query('encounterRunCommands').collect())).toHaveLength(1)
  }, 30000)

  it('rejects anonymous, non-GM and finished-session commands without creating state', async () => {
    const { t, owner, other, input, campaign, session } = await setup()
    await expect(t.mutation(createRun, input)).rejects.toThrow('Unauthenticated')
    await expect(owner.caller.mutation(createRun, input)).rejects.toThrow('Campaign not found')
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('campaignSessions')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', campaign.id).eq('id', session.id))
        .unique()
      if (!row) throw new Error('Missing Session')
      await ctx.db.patch(row._id, { status: 'FINISHED' })
    })
    await expect(other.caller.mutation(createRun, input)).rejects.toThrow('open Sessions')
    expect(await t.run((ctx) => ctx.db.query('encounterRuns').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('encounterRunActors').collect())).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('encounterRunCommands').collect())).toEqual([])
  }, 30000)

  it('fails closed for missing attendee authority and corrupt replay projections', async () => {
    const { t, other, input, character } = await setup()
    const result = await other.caller.mutation(createRun, input)
    await t.run(async (ctx) => {
      const assignment = await ctx.db
        .query('campaignCharacterAssignments')
        .withIndex('by_characterId', (q) => q.eq('characterId', character.id))
        .unique()
      if (!assignment) throw new Error('Missing assignment')
      await ctx.db.delete(assignment._id)
    })
    await expect(
      other.caller.mutation(createRun, { ...input, commandId: crypto.randomUUID() })
    ).rejects.toThrow()
    expect(await t.run((ctx) => ctx.db.query('encounterRuns').collect())).toHaveLength(1)
    await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', result.id))
        .unique()
      if (!row) throw new Error('Missing Run')
      await ctx.db.patch(row._id, { projectionChecksum: '0'.repeat(64) })
    })
    await expect(other.caller.mutation(createRun, input)).rejects.toThrow('projection mismatch')
  }, 30000)

  it.each(['sessionId', 'gameSystemId'] as const)(
    'rejects replay when a checksum-valid projection has a different %s',
    async (field) => {
      const { t, other, input } = await setup()
      const result = await other.caller.mutation(createRun, input)
      await t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', result.id))
          .unique()
        if (!row) throw new Error('Missing Run')
        const replacement = crypto.randomUUID()
        const projection = { ...result, [field]: replacement }
        await ctx.db.patch(row._id, {
          [field]: replacement,
          projectionJson: JSON.stringify(projection),
          projectionChecksum: checksumCanonicalJson(projection)
        })
      })
      await expect(other.caller.mutation(createRun, input)).rejects.toThrow(
        'Encounter is unavailable.'
      )
      expect(await t.run((ctx) => ctx.db.query('encounterRunCommands').collect())).toHaveLength(1)
    },
    30000
  )
})
