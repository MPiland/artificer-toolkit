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
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  EncounterPlayerProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { importedSubject } from '../../tests/fixtures/publication'
import { internal } from '../_generated/api'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
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
const get = makeFunctionReference<
  'query',
  { encounterId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto
>('encounters/projectionReads:get')
const active = makeFunctionReference<
  'query',
  { campaignId: string },
  EncounterGmProjectionDto | EncounterPlayerProjectionDto | null
>('encounters/projectionReads:active')
const list = makeFunctionReference<
  'query',
  { campaignId: string },
  Array<EncounterGmProjectionDto | EncounterPlayerProjectionDto>
>('encounters/projectionReads:list')
const pending = makeFunctionReference<'query', { encounterId: string }, unknown>(
  'encounters/pendingReads:pendingRuleOccurrence'
)

async function setup() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter queries',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const session = await base.owner.caller.mutation(createSession, { campaignId: campaign.id })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [importedSubject({ ...wolf, subjectKind: 'CREATURE', document: wolf })]
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Query fixture',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CREATURE', sourceId: wolf.id },
      { kind: 'CUSTOM', label: 'Hidden Dummy', maxHitPoints: 10 }
    ]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    sessionId: session.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const privacyRun = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('Missing Run')
    const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
    const hidden = projection.actors.find((actor) => actor.kind === 'CUSTOM')
    const visible = projection.actors.find((actor) => actor.kind === 'CREATURE')
    if (!hidden || !visible) throw new Error('Missing privacy actors')
    const updated = encounterGmProjectionDtoSchema.parse({
      ...projection,
      currentActorId: hidden.id,
      actors: projection.actors.map((actor) =>
        actor.id === hidden.id
          ? {
              ...actor,
              public: false,
              gmNotes: 'secret GM note',
              currentHitPoints: 1,
              tempHitPoints: 3
            }
          : {
              ...actor,
              public: true,
              gmNotes: 'visible only to GM',
              currentHitPoints: 7,
              tempHitPoints: 2
            }
      )
    })
    await ctx.db.patch(row._id, {
      projectionJson: JSON.stringify(updated),
      projectionChecksum: checksumCanonicalJson(updated)
    })
    return updated
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
  return { ...base, campaign, run: privacyRun }
}

async function setStatus(
  t: Awaited<ReturnType<typeof fixture>>['t'],
  id: string,
  status: 'ACTIVE' | 'COMPLETED'
) {
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
    if (!row) throw new Error('Missing Run')
    const projection = encounterGmProjectionDtoSchema.parse({
      ...JSON.parse(row.projectionJson),
      status
    })
    const state = encounterRunStateSchema.parse({ ...JSON.parse(row.stateJson), status })
    await ctx.db.patch(row._id, {
      status,
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection),
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  })
}

describe('native Encounter reads', () => {
  it('presents System labels for stored condition IDs without changing receipts or revealing hidden actors', async () => {
    const { t, owner, other, campaign, run } = await setup()
    const frightened = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'FRIGHTENED'
    )!
    const poisoned = srdSystemRecord.conditionTypes.find(
      (condition) => condition.code === 'POISONED'
    )!
    await setStatus(t, run.id, 'ACTIVE')
    const stored = await t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', run.id))
        .unique()
      if (!row) throw new Error('Missing Run')
      const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
      const updated = {
        ...projection,
        actors: projection.actors.map((actor) => ({
          ...actor,
          conditions: actor.public
            ? [frightened.id, { conditionTypeId: poisoned.id, notes: 'Public condition note' }]
            : [{ conditionTypeId: frightened.id, notes: 'Private condition note' }]
        }))
      }
      const patch = {
        projectionJson: JSON.stringify(updated),
        projectionChecksum: checksumCanonicalJson(updated)
      }
      await ctx.db.patch(row._id, patch)
      return { ...row, ...patch }
    })
    const expected = [
      expect.objectContaining({ conditionTypeId: frightened.id, label: frightened.label }),
      expect.objectContaining({
        conditionTypeId: poisoned.id,
        label: poisoned.label,
        notes: 'Public condition note'
      })
    ]
    for (const viewer of [owner, other]) {
      const single = await viewer.caller.query(get, { encounterId: run.id })
      expect(single.actors.find((actor) => actor.public)?.conditions).toEqual(expected)
      expect(
        (await viewer.caller.query(active, { campaignId: campaign.id }))?.actors.find(
          (actor) => actor.public
        )?.conditions
      ).toEqual(expected)
      expect(
        (await viewer.caller.query(list, { campaignId: campaign.id }))[0]?.actors.find(
          (actor) => actor.public
        )?.conditions
      ).toEqual(expected)
      if (viewer === other) expect(JSON.stringify(single)).not.toContain('Private condition note')
    }
    expect(await t.run((ctx) => ctx.db.get(stored._id))).toEqual(stored)
  }, 30000)

  it('returns exact owner projections and redacted player projections, with ACTIVE-only player lists', async () => {
    const { t, owner, other, campaign, run } = await setup()
    const ownerProjection = encounterGmProjectionDtoSchema.parse(
      await owner.caller.query(get, { encounterId: run.id })
    )
    expect(ownerProjection).toEqual(run)
    const ownerCreature = ownerProjection.actors.find((actor) => actor.kind === 'CREATURE')
    const ownerHidden = ownerProjection.actors.find((actor) => actor.kind === 'CUSTOM')
    expect(ownerCreature).toMatchObject({
      sourceId: wolf.id,
      statBlock: expect.any(Object),
      features: expect.any(Array),
      gmNotes: 'visible only to GM'
    })
    expect(ownerHidden).toMatchObject({
      public: false,
      gmNotes: 'secret GM note',
      currentHitPoints: 1,
      tempHitPoints: 3
    })
    const playerProjection = await other.caller.query(get, { encounterId: run.id })
    expect(playerProjection).toEqual(projectPlayerEncounterProjection(ownerProjection))
    expect(playerProjection.currentActorId).toBeNull()
    expect(playerProjection.actors).toHaveLength(1)
    expect(playerProjection.actors[0]).toEqual({
      id: ownerCreature!.id,
      encounterId: run.id,
      kind: 'CREATURE',
      label: ownerCreature!.label,
      sourceId: null,
      sourceRevision: null,
      public: true,
      initiative: null,
      manualOrder: null,
      conditions: ownerCreature!.conditions,
      healthBand: 'WOUNDED'
    })
    expect(playerProjection.actors[0]).not.toHaveProperty('currentHitPoints')
    expect(playerProjection.actors[0]).not.toHaveProperty('tempHitPoints')
    expect(playerProjection.actors[0]).not.toHaveProperty('gmNotes')
    expect(playerProjection.actors[0]).not.toHaveProperty('statBlock')
    expect(playerProjection.actors[0]).not.toHaveProperty('features')
    expect(playerProjection.actors[0]).not.toHaveProperty('resources')
    expect(playerProjection).not.toHaveProperty('reminders')
    expect(playerProjection).not.toHaveProperty('manualReminderMode')
    expect(JSON.stringify(playerProjection)).not.toContain(ownerHidden!.id)
    expect(JSON.stringify(playerProjection)).not.toContain('secret GM note')
    expect(JSON.stringify(playerProjection)).not.toContain('visible only to GM')
    expect(await other.caller.query(list, { campaignId: campaign.id })).toEqual([])
    expect(await other.caller.query(active, { campaignId: campaign.id })).toBeNull()
    expect(await other.caller.query(pending, { encounterId: run.id })).toBeNull()

    await setStatus(t, run.id, 'COMPLETED')
    expect(await owner.caller.query(get, { encounterId: run.id })).toMatchObject({
      status: 'COMPLETED'
    })
    expect(await other.caller.query(get, { encounterId: run.id })).toMatchObject({
      status: 'COMPLETED'
    })
    expect(await owner.caller.query(list, { campaignId: campaign.id })).toHaveLength(1)
    expect(await other.caller.query(list, { campaignId: campaign.id })).toEqual([])

    await setStatus(t, run.id, 'ACTIVE')
    const activeOwnerProjection = encounterGmProjectionDtoSchema.parse(
      await owner.caller.query(get, { encounterId: run.id })
    )
    expect(await owner.caller.query(active, { campaignId: campaign.id })).toEqual(
      activeOwnerProjection
    )
    expect(await owner.caller.query(list, { campaignId: campaign.id })).toEqual([
      activeOwnerProjection
    ])
    expect(await other.caller.query(active, { campaignId: campaign.id })).toEqual(
      projectPlayerEncounterProjection(activeOwnerProjection)
    )
    expect(await other.caller.query(list, { campaignId: campaign.id })).toHaveLength(1)
  }, 30000)

  it('denies anonymous and nonmembers, and revocation removes current access', async () => {
    const { t, owner, other, campaign, run } = await setup()
    await expect(t.query(get, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
    await expect(t.query(active, { campaignId: campaign.id })).rejects.toThrow('Unauthenticated')
    await expect(t.query(list, { campaignId: campaign.id })).rejects.toThrow('Unauthenticated')
    await expect(t.query(pending, { encounterId: run.id })).rejects.toThrow('Unauthenticated')
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing membership')
      await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: campaign.createdAt })
    })
    await expect(other.caller.query(get, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(active, { campaignId: campaign.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(list, { campaignId: campaign.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(pending, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      if (!membership) throw new Error('Missing membership')
      await ctx.db.delete(membership._id)
    })
    await expect(other.caller.query(get, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(active, { campaignId: campaign.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(list, { campaignId: campaign.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(other.caller.query(pending, { encounterId: run.id })).rejects.toThrow(
      'Campaign not found'
    )
    await expect(owner.caller.query(get, { encounterId: run.id })).resolves.toEqual(run)
  }, 30000)

  it('switches exact ownership projection when Campaign ownership and membership change together', async () => {
    const { t, owner, other, campaign, run } = await setup()
    await t.run(async (ctx) => {
      const ownerMembership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', owner.userId)
        )
        .unique()
      const otherMembership = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', campaign.id).eq('userId', other.userId)
        )
        .unique()
      const campaignRow = await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
        .unique()
      if (!ownerMembership || !otherMembership || !campaignRow)
        throw new Error('Missing ownership fixture')
      await ctx.db.patch(ownerMembership._id, { role: 'PLAYER' })
      await ctx.db.patch(otherMembership._id, { role: 'OWNER' })
      await ctx.db.patch(campaignRow._id, { ownerUserId: other.userId })
    })
    expect(await other.caller.query(get, { encounterId: run.id })).toEqual(run)
    expect(await owner.caller.query(get, { encounterId: run.id })).toEqual(
      projectPlayerEncounterProjection(run)
    )
  }, 30000)
})
