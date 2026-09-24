// @vitest-environment node
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignSessionDto,
  createCampaignSessionInputSchema
} from '@artificer-toolkit/schema/api/campaignSessions'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { z } from 'zod'
import { fixture } from '../../tests/fixtures/characters'

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
const get = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/projectionReads:get'
)
const timeline = makeFunctionReference<'query', { encounterId: string; limit: number }, unknown>(
  'encounters/timelineReads:timeline'
)
const pending = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/pendingReads:pendingRuleOccurrence'
)

it('V12 current native reads redact hidden actors and deny outsider or departed viewers', async () => {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'V12 privacy',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const session = await base.owner.caller.mutation(createSession, { campaignId: campaign.id })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'V12 hidden actor',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'Visible', maxHitPoints: 10 },
      { kind: 'CUSTOM', label: 'Hidden', maxHitPoints: 10 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Encounter Run.')
    const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
    const hidden = projection.actors[1]
    if (!hidden) throw new Error('Missing hidden actor.')
    const changed = encounterGmProjectionDtoSchema.parse({
      ...projection,
      currentActorId: hidden.id,
      actors: projection.actors.map((actor) =>
        actor.id === hidden.id
          ? {
              ...actor,
              public: false,
              gmNotes: 'V12 secret',
              currentHitPoints: 1,
              tempHitPoints: 3
            }
          : actor
      )
    })
    await ctx.db.patch(row._id, {
      projectionJson: JSON.stringify(changed),
      projectionChecksum: checksumCanonicalJson(changed)
    })
  })
  const owner = encounterGmProjectionDtoSchema.parse(
    await base.owner.caller.query(get, { encounterId: run.id })
  )
  const player = await base.other.caller.query(get, { encounterId: run.id })
  expect(owner.actors).toHaveLength(2)
  expect(JSON.stringify(player)).not.toContain('V12 secret')
  expect(JSON.stringify(player)).not.toContain(owner.actors[1]!.id)
  await expect(
    base.other.caller.query(timeline, { encounterId: run.id, limit: 20 })
  ).resolves.toEqual({ entries: [], nextCursor: null })
  await expect(base.other.caller.query(pending, { encounterId: run.id })).resolves.toBeNull()
  await expect(base.t.query(get, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
  await base.t.run(async (ctx) => {
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
  })
  await expect(base.other.caller.query(get, { encounterId: run.id })).rejects.toThrow(
    'Campaign not found'
  )
  await expect(
    base.other.caller.query(timeline, { encounterId: run.id, limit: 20 })
  ).rejects.toThrow('Campaign not found')
}, 30000)
