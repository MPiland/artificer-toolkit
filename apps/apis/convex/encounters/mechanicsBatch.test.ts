import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { writeRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { fixture } from '../../tests/fixtures/characters'
import {
  applyEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../../tests/fixtures/mechanicsBatch'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
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

async function mechanicsFixture() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Native mechanics fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Native mechanics fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Target', maxHitPoints: 3 }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors[0]
  if (!actor) throw new Error('Fixture Encounter actor is unavailable.')
  const input: EncounterMechanicsBatchInput = {
    encounterId: run.id,
    targetActorId: actor.id,
    expectedEncounterVersion: run.version,
    effectiveMaximumHitPoints: actor.maxHitPoints,
    occurrenceId: crypto.randomUUID(),
    sourceCommandId: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    occurredAt: '2026-09-12T00:00:00.000Z',
    expectedCharacterStreamVersion: null,
    forceVersionAdvance: false,
    applications: [
      {
        sourceNodeId: 'native-test',
        sourceOperationKey: 'damage',
        authoredPath: null,
        resolvedPath: 'TEST',
        kind: 'DAMAGE',
        targetActorId: actor.id,
        requestedAmount: 2,
        resolvedAmount: 2,
        appliedAmount: 2,
        beforeCurrentHitPoints: 3,
        afterCurrentHitPoints: 1,
        beforeTemporaryHitPoints: 0,
        afterTemporaryHitPoints: 0,
        maximumHitPoints: 3,
        damageTypeId: crypto.randomUUID(),
        damageDisposition: 'NORMAL'
      }
    ]
  }
  const readActor = () =>
    base.t.run((ctx) =>
      ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', run.id).eq('id', actor.id))
        .unique()
    )
  return { ...base, campaign, run, actor, input, readActor }
}

describe('applyEncounterMechanicsBatch', () => {
  it('persists a non-Character batch from the current actor row only', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    if (!before) throw new Error('Missing actor.')
    const result = await base.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, base.input)
    )
    if (result.updatedActor.kind === 'CHARACTER') throw new Error('Expected a non-Character actor.')
    expect(result.updatedActor.currentHitPoints).toBe(1)
    const stored = await base.readActor()
    expect(stored?.stateChecksum).toBe(checksumCanonicalJson(result.updatedActor))
    expect(JSON.parse(stored!.stateJson)).toEqual({
      ...JSON.parse(before.stateJson),
      currentHitPoints: 1
    })
  })

  it('rejects a stale Run before writing', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    await expect(
      base.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base.input,
          expectedEncounterVersion: base.run.version + 1
        })
      )
    ).rejects.toThrow('version is stale')
    expect(await base.readActor()).toEqual(before)
  })

  it('rejects a planned maximum that differs from the Run-owned maximum before writing', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    await expect(
      base.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base.input,
          effectiveMaximumHitPoints: base.actor.maxHitPoints + 1
        })
      )
    ).rejects.toThrow('Encounter actor maximum hit points are stale.')
    expect(await base.readActor()).toEqual(before)
  })

  it('rejects revoked Campaign authority before writing', async () => {
    const base = await mechanicsFixture()
    await base.t.run(async (ctx) => {
      const member = await ctx.db
        .query('campaignMemberships')
        .withIndex('by_campaignId_userId', (q) =>
          q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
        )
        .unique()
      if (!member) throw new Error('Missing membership.')
      await ctx.db.patch(member._id, { status: 'LEFT', leftAt: base.input.occurredAt })
    })
    const before = await base.readActor()
    await expect(
      base.owner.caller.run((ctx) => applyEncounterMechanicsBatch(ctx, base.input))
    ).rejects.toThrow()
    expect(await base.readActor()).toEqual(before)
  })

  it('rolls back actor publication when a later transaction operation fails', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    await expect(
      base.owner.caller.run(async (ctx) => {
        await applyEncounterMechanicsBatch(ctx, base.input)
        throw new Error('Injected terminal abort')
      })
    ).rejects.toThrow('Injected terminal abort')
    expect(await base.readActor()).toEqual(before)
  })

  it('leaves a non-Character no-op byte-identical', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    const result = await base.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, {
        ...base.input,
        applications: [],
        forceVersionAdvance: true
      })
    )
    expect(result.characterStreamVersion).toBeNull()
    expect(await base.readActor()).toEqual(before)
  })

  it('rejects Character spell-slot state for a non-Character actor', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    await expect(
      base.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base.input,
          spellSlotUsage: []
        })
      )
    ).rejects.toThrow()
    expect(await base.readActor()).toEqual(before)
  })

  it.each([false, true])(
    'persists condition replacement while honoring retained contributions: %s',
    async (retained) => {
      const base = await mechanicsFixture()
      const oldCondition = crypto.randomUUID()
      const newCondition = crypto.randomUUID()
      await base.t.run(async (ctx) => {
        const row = await ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', base.actor.id)
          )
          .unique()
        if (!row) throw new Error('Missing actor.')
        const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
        const updated = {
          ...actor,
          conditions: [{ conditionTypeId: oldCondition, label: 'Retained metadata' }]
        }
        await writeRunActor({ db: createConvexEncounterStore(ctx) }, row._id, updated)
      })
      const trace = {
        sourceNodeId: 'condition',
        sourceOperationKey: 'condition',
        authoredPath: null,
        resolvedPath: null
      }
      const result = await base.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base.input,
          retainedConditionIds: retained ? [oldCondition] : [],
          applications: [
            {
              ...trace,
              targetActorId: base.actor.id,
              kind: 'CONDITION_REMOVE',
              sourceActiveEffectId: crypto.randomUUID(),
              conditionId: oldCondition
            },
            {
              ...trace,
              targetActorId: base.actor.id,
              kind: 'CONDITION_APPLY',
              conditionId: newCondition
            }
          ]
        })
      )
      const expected = [
        ...(retained ? [{ conditionTypeId: oldCondition, label: 'Retained metadata' }] : []),
        { conditionTypeId: newCondition }
      ]
      if (result.updatedActor.kind === 'CHARACTER') throw new Error('Expected a custom actor.')
      expect(result.updatedActor.conditions).toEqual(expected)
      expect(JSON.parse((await base.readActor())!.stateJson).conditions).toEqual(expected)
    }
  )
})
