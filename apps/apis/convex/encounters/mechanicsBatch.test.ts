import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { readTestActor } from '../../tests/fixtures/storedActors'
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
import { restoreConsumedGrants } from '@artificer-toolkit/encounter-persistence/consumedGrantPersistence'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'
import { plannedModifierGrant } from '@artificer-toolkit/rules-runtime/testing/modifierGrantFixture'
import { fixture } from '../../tests/fixtures/characters'
import {
  applyEncounterMechanicsBatch,
  type EncounterMechanicsBatchInput
} from '../../tests/fixtures/mechanicsBatch'

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
        critical: false,
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

type MechanicsFixture = Awaited<ReturnType<typeof mechanicsFixture>>

/** One hit point regained, which ends every effect that lasts until hit points are regained. */
async function heal(base: MechanicsFixture) {
  return base.owner.caller.run((ctx) =>
    applyEncounterMechanicsBatch(ctx, {
      ...base.input,
      occurrenceId: crypto.randomUUID(),
      sourceCommandId: crypto.randomUUID(),
      commandId: crypto.randomUUID(),
      applications: [
        {
          sourceNodeId: 'native-test',
          sourceOperationKey: 'heal',
          authoredPath: null,
          resolvedPath: 'TEST',
          kind: 'HEAL',
          targetActorId: base.actor.id,
          requestedAmount: 1,
          resolvedAmount: 1,
          appliedAmount: 1,
          beforeCurrentHitPoints: 1,
          afterCurrentHitPoints: 2,
          beforeTemporaryHitPoints: 0,
          afterTemporaryHitPoints: 0,
          maximumHitPoints: 3
        }
      ]
    })
  )
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
    expect(stored?.stateChecksum).toBe(checksumRunActorPlayState(result.updatedActor))
    expect(readStoredRunActor(stored!)).toEqual({
      ...readStoredRunActor(before),
      currentHitPoints: 1,
      damageTypesSinceTurnStart: base.input.applications.flatMap((application) =>
        application.kind === 'DAMAGE'
          ? [{ damageTypeId: application.damageTypeId, commandId: base.input.sourceCommandId }]
          : []
      )
    })
  })

  it('ends a grant that lasts until healed only when hit points rise (SPELLS-17.6)', async () => {
    const base = await mechanicsFixture()
    const grantId = crypto.randomUUID()
    await base.t.run(async (ctx) => {
      const planned = plannedModifierGrant({
        encounterId: base.run.id,
        sourceActorId: base.actor.id,
        holderActorId: base.actor.id,
        lifecycle: { endOnEvents: ['ON_HIT_POINTS_REGAINED'] },
        rounds: 10,
        lifetimeScope: 'OWNER'
      })
      await createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).create({
        id: grantId,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: base.run.id, targetActorId: base.actor.id },
        definition: planned.definition,
        lifecycle: planned.lifecycle
      })
    })
    const damaged = await base.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(ctx, base.input)
    )
    expect(damaged.endedGrants).toEqual([])
    const healed = await heal(base)
    expect(healed.endedGrants.map(({ id }) => id)).toEqual([grantId])
  })

  it('ends an effect linked to an ended one in the same batch, and an undo gives both back (D172)', async () => {
    const base = await mechanicsFixture()
    const primaryId = crypto.randomUUID()
    const linkedId = crypto.randomUUID()
    const owner = {
      kind: 'ENCOUNTER_ACTOR' as const,
      encounterId: base.run.id,
      targetActorId: base.actor.id
    }
    const grant = (lifecycle: { endOnEvents: ['ON_HIT_POINTS_REGAINED'] } | { endOnEvents: [] }) =>
      plannedModifierGrant({
        encounterId: base.run.id,
        sourceActorId: base.actor.id,
        holderActorId: base.actor.id,
        lifecycle,
        rounds: 10,
        lifetimeScope: 'OWNER'
      })
    await base.t.run(async (ctx) => {
      const store = createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) })
      const primary = grant({ endOnEvents: ['ON_HIT_POINTS_REGAINED'] })
      await store.create({
        id: primaryId,
        owner,
        definition: primary.definition,
        lifecycle: primary.lifecycle
      })
      const linked = grant({ endOnEvents: [] })
      await store.create({
        id: linkedId,
        owner,
        definition: { ...linked.definition, linkedEffectId: primaryId },
        lifecycle: linked.lifecycle
      })
    })
    await base.owner.caller.run((ctx) => applyEncounterMechanicsBatch(ctx, base.input))
    const healed = await heal(base)
    expect(healed.endedGrants.map(({ id }) => id).sort()).toEqual([primaryId, linkedId].sort())
    const held = () =>
      base.t.run(async (ctx) =>
        createActiveRuleEffectStore({ db: createConvexEncounterStore(ctx) }).list(owner)
      )
    expect(await held()).toEqual([])
    await base.t.run(async (ctx) =>
      restoreConsumedGrants({ db: createConvexEncounterStore(ctx) }, healed.endedGrants)
    )
    const restored = await held()
    expect(restored.map(({ id }) => id).sort()).toEqual([primaryId, linkedId].sort())
    expect(restored.find(({ id }) => id === linkedId)?.definition.linkedEffectId).toBe(primaryId)
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

  it('rejects a spell slot spend for a non-Character actor', async () => {
    const base = await mechanicsFixture()
    const before = await base.readActor()
    await expect(
      base.owner.caller.run((ctx) =>
        applyEncounterMechanicsBatch(ctx, {
          ...base.input,
          characterSpellConsumptions: [
            {
              characterId: crypto.randomUUID(),
              spellId: crypto.randomUUID(),
              candidateId: 'candidate',
              slotKey: 'STANDARD:1',
              beforeUsed: 0,
              afterUsed: 1,
              expectedStreamVersion: 1
            }
          ]
        })
      )
    ).rejects.toThrow('cannot spend Character spell slots')
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
        const actor = await readTestActor(ctx, row)
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
