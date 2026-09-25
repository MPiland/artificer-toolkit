import { makeFunctionReference } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto,
  ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { featureChargeUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { importedSubject } from '../../tests/fixtures/publication'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import type { TableNames } from '../_generated/dataModel'
import { api, internal } from '../_generated/api'
import schema from '../schema'
import { removeAccountCampaignMemberships } from '../campaigns/accountDeparture.helper'
import { removeAccountPrivateCharacters } from '../characters/accountDeletion'
import * as rollRandom from '../lib/rollRandom'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'

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

const creature = {
  ...wolf,
  features: wolf.features?.map((feature) =>
    feature.label !== 'Bite'
      ? feature
      : {
          ...feature,
          charges: {
            id: '00000000-0000-4000-8000-000000000099',
            limitKind: 'FIXED_AMOUNT' as const,
            scalingKind: 'NONE' as const,
            resetKind: 'MANUAL' as const,
            amount: 1
          },
          effects: feature.effects?.map((effect) => ({
            ...effect,
            invocation: {
              ...effect.invocation,
              triggerCode: 'ACTIVATED' as const,
              range: { id: effect.invocation.range.id, rangeKind: 'UNLIMITED' as const },
              targeting: {
                selectionKind: 'SINGLE_TARGET' as const,
                dispositionKind: 'ANY' as const
              },
              resourceUse: { chargeId: '00000000-0000-4000-8000-000000000099', cost: 1 }
            },
            paths: effect.paths?.slice(0, 1).map((path) => {
              if (!('resultBlock' in path)) return path
              return {
                ...path,
                pathCode: 'ON_USE' as const,
                resultBlock: {
                  ...path.resultBlock,
                  outcomes: path.resultBlock.outcomes.map((outcome) => {
                    if (outcome.effectKind !== 'DAMAGE')
                      throw new Error('Expected Bite damage fixture.')
                    return {
                      id: outcome.id,
                      effectKind: 'DAMAGE' as const,
                      damageTypeId: outcome.damageTypeId,
                      valueKind: 'FIXED' as const,
                      scalingKind: 'NONE' as const,
                      amount: 1
                    }
                  })
                }
              }
            })
          }))
        }
  )
}

function command(input: {
  encounterId: string
  actorId: string
  targetActorId: string
  actionId: string
  commandId?: string
  expectedVersion: number
}): ResolveEncounterActionInputDto {
  return {
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: [],
    encounterId: input.encounterId,
    commandId: input.commandId ?? crypto.randomUUID(),
    expectedVersion: input.expectedVersion,
    actorId: input.actorId,
    targetActorId: input.targetActorId,
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }
}

async function setup(relationship = false) {
  const base = await setupCharacterRun()
  const sourceCreature = relationship
    ? {
        ...creature,
        features: creature.features?.map((feature) =>
          feature.label !== 'Bite'
            ? feature
            : {
                ...feature,
                rollDefinitions: [
                  {
                    id: '00000000-0000-4000-8000-000000000091',
                    label: 'Binding attack',
                    kind: 'ATTACK' as const,
                    expression: { count: 1, die: 20, modifier: 10 },
                    rollMode: 'NORMAL' as const,
                    chargeCost: null,
                    order: 1
                  }
                ],
                effects: feature.effects?.map((effect) => ({
                  ...effect,
                  invocation: { ...effect.invocation, triggerCode: 'MELEE_WEAPON_ATTACK' as const },
                  paths: effect.paths?.map((path) =>
                    !('resultBlock' in path)
                      ? path
                      : {
                          ...path,
                          pathCode: 'ON_HIT' as const,
                          resultBlock: {
                            ...path.resultBlock,
                            outcomes: [
                              {
                                id: '00000000-0000-4000-8000-000000000092',
                                effectKind: 'ACTOR_RELATIONSHIP' as const,
                                modules: [
                                  {
                                    id: '00000000-0000-4000-8000-000000000093',
                                    order: 1,
                                    kind: 'TARGET_SIZE_MAXIMUM' as const,
                                    sizeCode: 'MEDIUM' as const
                                  }
                                ],
                                conditions: []
                              }
                            ]
                          }
                        }
                  )
                }))
              }
        )
      }
    : creature
  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'ENCOUNTER_START' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...SRD_RULE_STATE_DEFINITIONS.filter(
        (definition) => definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID
      ),
      ...initiative.definitions
    ]
  })
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ ...sourceCreature, subjectKind: 'CREATURE', document: sourceCreature })
    ]
  })
  const settings = await base.owner.caller.query(api.campaigns.playSettings.get, {
    campaignId: base.campaign.id
  })
  const { version, updatedAt: _updatedAt, ...settingFields } = settings
  await base.owner.caller.mutation(api.campaigns.playSettings.save, {
    ...settingFields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Character action target fixture',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: creature.id }]
  })
  const prepared = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = prepared.actors.find((candidate) => candidate.kind === 'CREATURE')
  const target = prepared.actors.find((candidate) => candidate.kind === 'CHARACTER')
  if (!actor || !target) throw new Error('Missing Creature or Character action fixture actor.')
  let active = await base.owner.caller.mutation(internal.encounters.commands.execute, {
    command: {
      type: 'START',
      encounterId: prepared.id,
      commandId: crypto.randomUUID(),
      expectedVersion: prepared.version
    }
  })
  while (active.occurrence?.status === 'PENDING') {
    const pending = active.occurrence.pending
    if (!pending || pending.kind !== 'INITIATIVE_ORDER' || !pending.optionIds[0])
      throw new Error('Unexpected Automatic initiative decision.')
    active = await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version,
        correlationId: null,
        occurrenceId: active.occurrence.occurrenceId,
        expectedOccurrenceVersion: active.occurrence.occurrenceVersion,
        resolution: {
          kind: 'INITIATIVE_ENTITY',
          requestId: pending.requestId,
          entityId: pending.optionIds[0]
        }
      }
    })
  }
  if (active.projection.currentActorId !== actor.id) {
    active = await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: prepared.id,
        commandId: crypto.randomUUID(),
        expectedVersion: active.projection.version
      }
    })
  }
  if (active.projection.currentActorId !== actor.id)
    throw new Error('Creature did not receive the current normalized initiative turn.')
  const run = encounterGmProjectionDtoSchema.parse(active.projection)
  const actionId = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', run.id).eq('id', actor.id))
      .unique()
    if (!row) throw new Error('Missing Creature actor.')
    const capability = discoverEncounterFeatureActionCapabilities({
      actor: encounterRunActorStateSchema.parse(JSON.parse(row.stateJson)),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map((condition) => condition.id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map((ability) => ({
        id: ability.id,
        code: ability.code
      }))
    }).find(
      (candidate) =>
        candidate.mechanicFacts.invocation.triggerCode ===
        (relationship ? 'MELEE_WEAPON_ATTACK' : 'ACTIVATED')
    )
    if (!capability) throw new Error('Missing Creature action capability.')
    return capability.actionId
  })
  return { ...base, run, actor, target, actionId }
}

async function records(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => {
    const [character, target, source, run, commands, occurrences, receipts, characterReceipts] =
      await Promise.all([
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
          .unique(),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', base.target.id)
          )
          .unique(),
        ctx.db
          .query('encounterRunActors')
          .withIndex('by_encounterId_id', (q) =>
            q.eq('encounterId', base.run.id).eq('id', base.actor.id)
          )
          .unique(),
        ctx.db
          .query('encounterRuns')
          .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
          .unique(),
        ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        ctx.db
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        ctx.db
          .query('encounterRuleReceipts')
          .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', base.run.id))
          .collect(),
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
          .collect()
      ])
    return { character, target, source, run, commands, occurrences, receipts, characterReceipts }
  })
}

describe('native Creature actions against Character targets', () => {
  it('records an effect-only Character mutation once with its typed receipt and exact replay', async () => {
    const base = await setup(true)
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      expectedVersion: base.run.version
    })
    const before = await records(base)
    const random = vi.spyOn(rollRandom, 'nextRollInt').mockReturnValue(14)
    try {
      const result = await base.owner.caller.mutation(internal.encounters.commands.execute, {
        command: input
      })
      const after = await records(base)
      if (!before.character || !after.character || !before.target || !after.target)
        throw new Error('Missing Character effect records.')
      expect(JSON.parse(after.character.documentJson).state.hitpoints.current).toBe(
        JSON.parse(before.character.documentJson).state.hitpoints.current
      )
      expect(JSON.parse(after.character.documentJson).state.conditions).toEqual(
        JSON.parse(before.character.documentJson).state.conditions ?? []
      )
      expect(after.target.stateJson).toBe(before.target.stateJson)
      expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
      const row = after.receipts.find((receipt) => receipt.commandId === input.commandId)
      if (!row) throw new Error('Missing Character effect receipt.')
      const receipt = storedRuleExecutionResultDtoSchema.parse(JSON.parse(row.resultJson))
      if (
        receipt.status !== 'COMPLETE' ||
        receipt.applicationOutputs.kind !== 'CHARACTER_MECHANICS_BATCH'
      )
        throw new Error('Expected Character effect receipt.')
      expect(receipt.applicationOutputs.activeEffectTransitions).toEqual([
        expect.objectContaining({
          characterId: base.character.id,
          sourceEncounterId: base.run.id,
          maintainedEffectStateId: null
        })
      ])
      const effects = () =>
        base.t.run((ctx) =>
          ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_createdOrdinal_id', (q) =>
              q.eq('characterId', base.character.id)
            )
            .collect()
        )
      const created = await effects()
      expect(created).toHaveLength(1)
      await expect(
        base.owner.caller.mutation(internal.encounters.commands.execute, { command: input })
      ).resolves.toEqual(result)
      expect(await records(base)).toEqual(after)
      expect(await effects()).toEqual(created)
    } finally {
      random.mockRestore()
    }
  }, 30000)

  it('settles Character hit points once without rewriting its Run actor, including replay and source charge', async () => {
    const base = await setup()
    const input = command({
      encounterId: base.run.id,
      actorId: base.actor.id,
      targetActorId: base.target.id,
      actionId: base.actionId,
      expectedVersion: base.run.version
    })
    const before = await records(base)
    const result = await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command: input
    })
    const after = await records(base)
    if (!before.character || !after.character || !before.target || !after.target || !after.source)
      throw new Error('Missing settled records.')
    expect(JSON.parse(after.character.documentJson).state.hitpoints.current).toBe(
      JSON.parse(before.character.documentJson).state.hitpoints.current - 1
    )
    expect(after.target.stateJson).toBe(before.target.stateJson)
    expect(
      result.projection.actors.find((candidate) => candidate.id === base.target.id)
    ).toMatchObject({
      sourceRevision: null,
      currentHitPoints: JSON.parse(after.character.documentJson).state.hitpoints.current
    })
    expect(
      featureChargeUsed(
        encounterRunActorStateSchema.parse(JSON.parse(after.source.stateJson)),
        creature.features!.find((feature) => feature.label === 'Bite')!.id
      )
    ).toBe(1)
    expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
    expect(after.characterReceipts).toHaveLength(1)
    const receipt = after.receipts.find((value) => value.commandId === input.commandId)
    if (!receipt) throw new Error('Missing Creature action receipt.')
    expect(JSON.parse(receipt.resultJson).applicationOutputs).toMatchObject({
      kind: 'CHARACTER_MECHANICS_BATCH',
      sourceActorId: base.actor.id,
      sourceCharacterId: null,
      targetActorId: base.target.id,
      featureResourceConsumption: expect.objectContaining({
        ownerActorId: base.actor.id,
        beforeUsed: 0,
        afterUsed: 1
      })
    })
    await expect(
      base.owner.caller.mutation(internal.encounters.commands.execute, { command: input })
    ).resolves.toEqual(result)
    expect(await records(base)).toEqual(after)
    expect(after.characterReceipts[0]).toMatchObject({ actorId: base.owner.userId })
    expect(base.owner.userId).not.toBe(base.player.userId)
    const tables = Object.keys(schema.tables) as TableNames[]
    const snapshot = () =>
      base.t.run(async (ctx) => ({
        app: Object.fromEntries(
          await Promise.all(
            tables.map(async (table) => [table, await ctx.db.query(table).collect()])
          )
        ),
        schedules: await ctx.db.system.query('_scheduled_functions').collect()
      }))
    const beforeCleanup = await snapshot()
    const preservedOwner = await base.t.run(async (ctx) => ({
      profile: await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
        .unique(),
      campaign: await ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.campaignId))
        .unique()
    }))
    await expect(
      base.t.run(async (ctx) => {
        await removeAccountCampaignMemberships(ctx, base.player.userId)
        await removeAccountPrivateCharacters(ctx, base.player.userId)
        throw new Error('Injected Character receipt cleanup rollback')
      })
    ).rejects.toThrow('Injected Character receipt cleanup rollback')
    expect(await snapshot()).toEqual(beforeCleanup)
    await base.t.run(async (ctx) => {
      await removeAccountCampaignMemberships(ctx, base.player.userId)
      await removeAccountPrivateCharacters(ctx, base.player.userId)
    })
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', base.character.id))
          .unique()
      )
    ).resolves.toBeNull()
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('characterCommandReceipts')
          .withIndex('by_characterId_commandId', (q) => q.eq('characterId', base.character.id))
          .collect()
      )
    ).resolves.toEqual([])
    await expect(
      base.t.run((ctx) =>
        ctx.db
          .query('userProfiles')
          .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
          .unique()
      )
    ).resolves.toEqual(preservedOwner.profile)
    const afterCampaign = await base.t.run((ctx) =>
      ctx.db
        .query('campaigns')
        .withIndex('by_publicId', (q) => q.eq('id', base.run.campaignId))
        .unique()
    )
    if (!preservedOwner.campaign || !afterCampaign) throw new Error('Missing retained Campaign.')
    expect(afterCampaign).toEqual({
      ...preservedOwner.campaign,
      version: preservedOwner.campaign.version + 1,
      updatedAt: afterCampaign.updatedAt
    })
    expect(Date.parse(afterCampaign.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(preservedOwner.campaign.updatedAt)
    )
  }, 30000)

  it('targets the current Character after a Sheet edit made after Run creation', async () => {
    const base = await setup()
    const created = (await records(base)).character
    if (!created) throw new Error('Missing Character.')
    await base.player.caller.mutation(api.characters.sheetCommands.execute, {
      id: base.character.id,
      command: {
        type: 'ADJUST_HIT_POINTS',
        mode: 'DAMAGE',
        amount: 1,
        expectedVersion: created.streamVersion,
        commandId: crypto.randomUUID()
      }
    })
    const before = await records(base)
    if (!before.character) throw new Error('Missing edited Character.')
    expect(before.character.streamVersion).toBe(created.streamVersion + 1)
    await base.owner.caller.mutation(internal.encounters.commands.execute, {
      command: command({
        encounterId: base.run.id,
        actorId: base.actor.id,
        targetActorId: base.target.id,
        actionId: base.actionId,
        expectedVersion: base.run.version
      })
    })
    const after = await records(base)
    if (!after.character) throw new Error('Missing settled Character.')
    expect(after.character.streamVersion).toBe(before.character.streamVersion + 1)
    expect(JSON.parse(after.character.documentJson).state.hitpoints.current).toBe(
      JSON.parse(before.character.documentJson).state.hitpoints.current - 1
    )
  }, 30000)

  it('rolls back Character, actors, Run, occurrence, receipts, and source charge when the caller throws', async () => {
    const base = await setup()
    const before = await records(base)
    await expect(
      base.owner.caller.run(async (ctx) => {
        await ctx.runMutation(internal.encounters.commands.execute, {
          command: command({
            encounterId: base.run.id,
            actorId: base.actor.id,
            targetActorId: base.target.id,
            actionId: base.actionId,
            expectedVersion: base.run.version
          })
        })
        throw new Error('terminal caller failed')
      })
    ).rejects.toThrow('terminal caller failed')
    expect(await records(base)).toEqual(before)
  }, 30000)
})
