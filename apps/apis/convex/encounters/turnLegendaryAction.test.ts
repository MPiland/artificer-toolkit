import { makeFunctionReference } from 'convex/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterExecuteInput,
  EncounterGmProjectionDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionEncounterRulesInputSchema,
  liveSessionEncounterRulesResponseSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import {
  liveSessionEncounterTurnCommitInputSchema,
  liveSessionEncounterTurnPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  createPlatformRulesRuntime,
  deriveRulesContinuationKey
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  SRD_CONTENT_SOURCE,
  SRD_RULES_CATALOGUE
} from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  createDnd5eLegendaryActionEligibilityDefinition,
  createDnd5eLegendaryActionLifecycleDefinition,
  createDnd5eRechargeDefinition,
  createDnd5eRechargeLifecycleDefinition
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/encounterLifecyclePolicy'
import { DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/reactionEligibilityPolicy'
import { fixture } from '../../tests/fixtures/characters'
import {
  automaticChargedBiteFeatureId,
  automaticChargedCreature,
  automaticChargedCreatureId
} from '../../tests/fixtures/encounterAction'
import { createEncounterInitiativeDefinitions } from '../../tests/fixtures/encounterInitiative'
import { importedSubject } from '../../tests/fixtures/publication'
import { setAutoRollDice, type FixtureRolls } from '../../tests/fixtures/rollPreferences'
import { api, components, internal } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import * as movementTargets from './movementTargets'
import { planNativeLiveEncounterTurn } from '../../../session-worker/src/nativeEncounterTurn'
import { callLiveSessionRoute } from '../../../session-worker/src/liveSessionRoutes'
import {
  executeRoomEncounterCommand,
  insertActiveLiveAuthority,
  stubLiveSessionFetch,
  workerEnvironment,
  executeInRoom,
  replayInRoom
} from '../../tests/fixtures/liveSessionWorker'

const rechargeFeatureId = '00000000-0000-4000-8000-000000000a21'
const rechargeChargeId = '00000000-0000-4000-8000-000000000a22'
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
const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

async function stored(t: Awaited<ReturnType<typeof fixture>>['t'], encounterId: string) {
  return t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .collect(),
    rounds: await ctx.db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
      .collect(),
    participants: await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
      .collect(),
    occurrences: (await ctx.db.query('encounterRuleOccurrences').collect()).filter(
      (row) => row.encounterId === encounterId
    ),
    receipts: (await ctx.db.query('encounterRuleReceipts').collect()).filter(
      (row) => row.encounterId === encounterId
    ),
    commands: (await ctx.db.query('encounterRunCommands').collect()).filter(
      (row) => row.encounterId === encounterId
    )
  }))
}

function unchangedMechanics(
  before: Awaited<ReturnType<typeof stored>>,
  after: Awaited<ReturnType<typeof stored>>
) {
  expect(after.run).toEqual(before.run)
  expect(after.actors).toEqual(before.actors)
  expect(after.rounds).toEqual(before.rounds)
  expect(after.participants).toEqual(before.participants)
  expect(after.receipts).toEqual(before.receipts)
  expect(after.commands).toEqual(before.commands)
}

const allowanceIds = [
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
]

async function seedUsedAllowances(base: Awaited<ReturnType<typeof setup>>) {
  const allowances = SRD_RULE_STATE_DEFINITIONS.filter((definition) =>
    allowanceIds.includes(definition.id)
  )
  expect(allowances).toHaveLength(allowanceIds.length)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: allowances
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing allowance refresh Run.')
    const resourcesByActorId = new Map<string, EncounterRunActorState['resources']>()
    for (const actorRow of await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', base.run.id))
      .collect()) {
      let actor = encounterRunActorStateSchema.parse(JSON.parse(actorRow.stateJson))
      for (const definitionId of allowanceIds)
        actor = encounterRunActorStateSchema.parse({
          ...actor,
          resources: withEncounterRuleUsageUsed(actor, definitionId, 1)
        })
      resourcesByActorId.set(actor.id, actor.resources)
      await ctx.db.patch(actorRow._id, {
        stateJson: JSON.stringify(actor),
        stateChecksum: checksumCanonicalJson(actor)
      })
    }
    const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
    const updated = encounterGmProjectionDtoSchema.parse({
      ...projection,
      actors: projection.actors.map((actor) => ({
        ...actor,
        resources: resourcesByActorId.get(actor.id) ?? actor.resources
      }))
    })
    await ctx.db.patch(row._id, {
      projectionJson: JSON.stringify(updated),
      projectionChecksum: checksumCanonicalJson(updated)
    })
  })
}

function response(
  encounterId: string,
  result: {
    projection: { version: number }
    occurrence?: { occurrenceId: string; occurrenceVersion: number } | null
  },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  if (!result.occurrence) throw new Error('Expected a pending turn occurrence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      occurrenceId: result.occurrence.occurrenceId,
      expectedOccurrenceVersion: result.occurrence.occurrenceVersion,
      correlationId: null,
      resolution
    }
  } satisfies EncounterExecuteInput
}

/** The Legendary option at `index`, aimed at its first offered target (its user, for a self action). */
function legendaryOption(
  pending: { options: readonly { optionId: string; targetActorIds: readonly string[] }[] },
  index = 0
) {
  const option = pending.options[index]
  const targetActorId = option?.targetActorIds[0]
  if (!option || !targetActorId) throw new Error('Expected a Legendary option with a target.')
  return { kind: 'LEGENDARY_OPTION' as const, optionId: option.optionId, targetActorId }
}

async function setup(
  rolls: FixtureRolls,
  creatures = 3,
  recharge = false,
  cadence: 'ENCOUNTER_START' | 'EACH_ROUND' = 'ENCOUNTER_START',
  procedure: 'ACTOR_ROLL' | 'DECLARED_ACTION_ROLL' = 'ACTOR_ROLL',
  fixedCharges = true
) {
  const base = await fixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  await base.t.run(async (ctx) => {
    for (const [index, userId] of [base.owner.userId, base.other.userId].entries()) {
      const profile = await ctx.db
        .query('userProfiles')
        .withIndex('by_userId', (q) => q.eq('userId', userId))
        .unique()
      if (!profile) throw new Error('Missing Legendary Action fixture profile.')
      await ctx.runMutation(components.betterAuth.adapter.updateOne, {
        input: {
          model: 'user',
          where: [{ field: '_id', value: profile.authUserId }],
          update: { email: `draft_123456abcde${index}@example.invalid` }
        }
      })
    }
  })
  const graph = createDnd5eLegendaryActionEligibilityDefinition()
  const lifecycle = createDnd5eLegendaryActionLifecycleDefinition()
  const rechargeGraph = createDnd5eRechargeDefinition(5)
  const rechargeLifecycle = createDnd5eRechargeLifecycleDefinition(5)
  const initiative = createEncounterInitiativeDefinitions([{ procedure, cadence }])
  const actionCapability = {
    schemaVersion: 1 as const,
    kind: 'RULE_CAPABILITY' as const,
    id: DND5E_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
    gameSystemId: srdSystemRecord.id,
    usage: null
  }
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [
      ...initiative.definitions,
      {
        id: actionCapability.id,
        definitionFamilyKey: 'rule-capability',
        label: 'Actor action capability',
        description: 'Actor action capability',
        document: actionCapability,
        checksum: checksumRuleDocument(actionCapability)
      },
      ...[graph, rechargeGraph].map((definition) => ({
        id: definition.id,
        definitionFamilyKey: definition.definitionFamilyKey,
        label: 'Native turn graph fixture',
        description: 'Native turn graph fixture',
        document: definition.definition,
        checksum: definition.checksum
      })),
      ...[lifecycle, rechargeLifecycle].map((definition) => ({
        id: definition.id,
        definitionFamilyKey: 'dnd5e-encounter-lifecycle',
        label: 'Native turn lifecycle fixture',
        description: 'Native turn lifecycle fixture',
        document: definition,
        checksum: checksumRuleDocument(definition)
      }))
    ]
  })
  const sourceFeature = automaticChargedCreature.features?.find(
    (feature) => feature.id === automaticChargedBiteFeatureId
  )
  if (!sourceFeature?.charges) throw new Error('Missing fixed-charge Feature fixture.')
  const legendaryFeature = {
    ...sourceFeature,
    ruleDefinitionIds: fixedCharges ? [lifecycle.id] : [],
    charges: fixedCharges ? { ...sourceFeature.charges, amount: 3 } : undefined,
    ...(rolls === 'PROMPT'
      ? {
          rollDefinitions: [
            {
              id: '00000000-0000-4000-8000-000000000a23',
              label: 'Legendary attack',
              kind: 'ATTACK' as const,
              expression: { count: 1, die: 20, modifier: 4 },
              rollMode: 'NORMAL' as const,
              chargeCost: null,
              order: 1
            }
          ]
        }
      : {}),
    effects: sourceFeature.effects?.map((effect) => ({
      ...effect,
      invocation: {
        ...effect.invocation,
        triggerCode: rolls === 'PROMPT' ? ('MELEE_WEAPON_ATTACK' as const) : ('ACTIVATED' as const),
        range: {
          id: effect.invocation.range.id,
          rangeKind: rolls === 'PROMPT' ? ('UNLIMITED' as const) : ('SELF' as const)
        },
        targeting:
          rolls === 'PROMPT'
            ? { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
            : { selectionKind: 'SELF' as const }
      },
      paths: effect.paths?.map((path) => ({
        ...path,
        pathCode: rolls === 'PROMPT' ? ('ON_HIT' as const) : ('ON_USE' as const)
      }))
    }))
  }
  await base.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({
        ...automaticChargedCreature,
        subjectKind: 'CREATURE',
        document: {
          ...automaticChargedCreature,
          features: [
            legendaryFeature,
            ...(recharge
              ? [
                  {
                    ...sourceFeature,
                    id: rechargeFeatureId,
                    label: 'Recharge pool',
                    charges: { ...sourceFeature.charges, id: rechargeChargeId },
                    effects: undefined,
                    ruleDefinitionIds: [rechargeLifecycle.id]
                  }
                ]
              : [])
          ]
        }
      })
    ]
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
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
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Legendary turn fixture',
    commandId: crypto.randomUUID(),
    enemies: Array.from({ length: creatures }, () => ({
      kind: 'CREATURE' as const,
      sourceId: automaticChargedCreatureId
    }))
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  let expectedVersion = run.version
  for (const actor of run.actors) {
    for (const featureId of fixedCharges
      ? [automaticChargedBiteFeatureId, ...(recharge ? [rechargeFeatureId] : [])]
      : []) {
      await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADJUST_FEATURE_RESOURCE',
          encounterId: run.id,
          commandId: crypto.randomUUID(),
          expectedVersion,
          actorId: actor.id,
          featureId,
          direction: 'USE',
          amount: 1
        }
      })
      expectedVersion += 1
    }
  }
  const current = await base.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: run.id
  })
  return { ...base, campaign, run: current, graph, lifecycle }
}

async function start(base: Awaited<ReturnType<typeof setup>>) {
  const input = {
    command: {
      type: 'START',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: base.run.version
    }
  } satisfies EncounterExecuteInput
  let result = await executeInRoom(base.owner.caller, input)
  let responses = 0
  while (result.occurrence?.status === 'PENDING') {
    expect(responses++).toBeLessThan(12)
    const pending = result.occurrence.pending
    if (
      !pending ||
      (pending.kind !== 'INITIATIVE_EVIDENCE' &&
        pending.kind !== 'INITIATIVE_ORDER' &&
        pending.kind !== 'INITIATIVE_DECLARATION' &&
        pending.kind !== 'RECHARGE_EVIDENCE')
    )
      throw new Error('START must only request initiative or entering Recharge evidence.')
    let resolution: ResolveRuleOccurrenceInputDto['resolution']
    if (pending.kind === 'INITIATIVE_DECLARATION') {
      const option = pending.primaryOptions.find(
        (entry) => entry.kind === 'CREATURE_FEATURE_ACTION'
      )
      if (!option) throw new Error('Expected the issued Creature Feature declaration.')
      resolution = {
        kind: 'INITIATIVE_DECLARATION',
        requestId: pending.requestId,
        primary: { kind: 'CREATURE_FEATURE_ACTION', optionId: option.optionId },
        bonus: null
      }
    } else {
      resolution =
        pending.kind === 'INITIATIVE_ORDER'
          ? {
              kind: 'INITIATIVE_ENTITY',
              requestId: pending.requestId,
              entityId: pending.optionIds[0]!
            }
          : {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: pending.kind === 'RECHARGE_EVIDENCE' ? 5 : 20
            }
    }
    result = await executeInRoom(base.owner.caller, response(base.run.id, result, resolution))
  }
  expect(result.projection.status).toBe('ACTIVE')
  await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
  return result
}

describe('native Encounter turn Legendary Actions', () => {
  it('skips movement target discovery for an 11-Creature Run without fixed unscaled Feature charges', async () => {
    const base = await setup('AUTO_ROLL', 11, false, 'ENCOUNTER_START', 'ACTOR_ROLL', false)
    const started = await start(base)
    const loadTargets = vi.spyOn(movementTargets, 'loadMovementTargets')
    try {
      const result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: started.projection.version
        }
      })

      expect(result.occurrence).toBeNull()
      expect(loadTargets).not.toHaveBeenCalled()
    } finally {
      loadTargets.mockRestore()
    }
  }, 30000)

  it.each(['ACTOR_ROLL', 'DECLARED_ACTION_ROLL'] as const)(
    'finishes the outgoing Legendary window before EACH_ROUND %s initiative and entering Recharge',
    async (procedure) => {
      const base = await setup('PROMPT', 2, true, 'EACH_ROUND', procedure)
      let result = await start(base)
      result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: result.projection.version
        }
      })
      if (result.occurrence?.pending?.kind !== 'LEGENDARY_ACTION_CHOICE')
        throw new Error('Expected the first turn owner window.')
      result = await executeInRoom(
        base.owner.caller,
        response(base.run.id, result, { kind: 'DECLINE' })
      )
      const firstRecharge = result.occurrence?.pending
      if (!firstRecharge || firstRecharge.kind !== 'RECHARGE_EVIDENCE')
        throw new Error('Expected second actor Recharge.')
      result = await executeInRoom(
        base.owner.caller,
        response(base.run.id, result, {
          kind: 'ENTER_INTEGER',
          requestId: firstRecharge.request.requestId,
          value: 5
        })
      )
      let expectedVersion = result.projection.version
      for (const actor of base.run.actors) {
        await executeInRoom(base.owner.caller, {
          command: {
            type: 'ADJUST_FEATURE_RESOURCE',
            encounterId: base.run.id,
            commandId: crypto.randomUUID(),
            expectedVersion,
            actorId: actor.id,
            featureId: rechargeFeatureId,
            direction: 'USE',
            amount: 1
          }
        })
        expectedVersion += 1
      }
      const before = await stored(base.t, base.run.id)
      const advance = {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion
        }
      } satisfies EncounterExecuteInput
      result = await executeInRoom(base.owner.caller, advance)
      const choice = result.occurrence?.pending
      if (!choice || choice.kind !== 'LEGENDARY_ACTION_CHOICE')
        throw new Error('EACH_ROUND must offer the outgoing Legendary window before initiative.')
      unchangedMechanics(before, await stored(base.t, base.run.id))
      const option = response(base.run.id, result, legendaryOption(choice))
      result = await executeInRoom(base.owner.caller, option).catch((cause: unknown) => {
        throw new Error('Legendary option failed.', { cause })
      })
      const dicePending = result.occurrence?.pending
      if (!dicePending || dicePending.kind !== 'D20_EVIDENCE')
        throw new Error('Legendary action dice must precede new initiative.')
      unchangedMechanics(before, await stored(base.t, base.run.id))
      const dice = response(base.run.id, result, {
        kind: 'ENTER_DICE',
        requestId: dicePending.request.requestId,
        rawFaces: dicePending.request.rollMode === 'NORMAL' ? [15] : [15, 15],
        rollMode: dicePending.request.rollMode
      })
      result = await executeInRoom(base.owner.caller, dice).catch((cause: unknown) => {
        throw new Error('Legendary dice response failed.', { cause })
      })
      expect(result.occurrence?.pending?.kind).toBe(
        procedure === 'DECLARED_ACTION_ROLL' ? 'INITIATIVE_DECLARATION' : 'INITIATIVE_EVIDENCE'
      )
      const initiativeResponses: EncounterExecuteInput[] = []
      while (
        result.occurrence?.pending?.kind === 'INITIATIVE_EVIDENCE' ||
        result.occurrence?.pending?.kind === 'INITIATIVE_ORDER' ||
        result.occurrence?.pending?.kind === 'INITIATIVE_DECLARATION'
      ) {
        expect(initiativeResponses.length).toBeLessThan(8)
        unchangedMechanics(before, await stored(base.t, base.run.id))
        const pending = result.occurrence.pending
        let resolution: ResolveRuleOccurrenceInputDto['resolution']
        if (pending.kind === 'INITIATIVE_DECLARATION') {
          const option = pending.primaryOptions.find(
            (entry) => entry.kind === 'CREATURE_FEATURE_ACTION'
          )
          if (!option) throw new Error('Expected the issued Creature Feature declaration.')
          resolution = {
            kind: 'INITIATIVE_DECLARATION',
            requestId: pending.requestId,
            primary: { kind: 'CREATURE_FEATURE_ACTION', optionId: option.optionId },
            bonus: null
          }
        } else {
          resolution =
            pending.kind === 'INITIATIVE_ORDER'
              ? {
                  kind: 'INITIATIVE_ENTITY',
                  requestId: pending.requestId,
                  entityId: pending.optionIds[0]!
                }
              : { kind: 'ENTER_INTEGER', requestId: pending.request.requestId, value: 20 }
        }
        const input = response(base.run.id, result, resolution)
        initiativeResponses.push(input)
        result = await executeInRoom(base.owner.caller, input)
      }
      const recharge = result.occurrence?.pending
      if (!recharge || recharge.kind !== 'RECHARGE_EVIDENCE')
        throw new Error('Expected Recharge after new initiative settles.')
      unchangedMechanics(before, await stored(base.t, base.run.id))
      for (const input of [advance, option, dice, ...initiativeResponses])
        await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
      const rechargeInput = response(base.run.id, result, {
        kind: 'ENTER_INTEGER',
        requestId: recharge.request.requestId,
        value: 5
      })
      result = await executeInRoom(base.owner.caller, rechargeInput)
      expect(result).toMatchObject({
        projection: { status: 'ACTIVE', round: 2, version: expectedVersion + 1 },
        occurrence: { status: 'COMPLETE', pending: null }
      })
      const terminal = await stored(base.t, base.run.id)
      expect(terminal.rounds).toHaveLength(before.rounds.length + 1)
      expect(terminal.receipts).toHaveLength(before.receipts.length + 1)
      expect(terminal.commands).toHaveLength(before.commands.length + 1)
      // The Legendary attack hit its target, not its owner (D51 option B).
      const hit = encounterRunActorStateSchema.parse(
        JSON.parse(
          terminal.actors.find((row) => row.id === legendaryOption(choice).targetActorId)!.stateJson
        )
      )
      if (hit.kind === 'CHARACTER') throw new Error('Expected a Creature actor.')
      expect(hit.currentHitPoints).toBe(10)
      for (const input of [advance, option, dice, ...initiativeResponses, rechargeInput])
        await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
      expect(await stored(base.t, base.run.id)).toEqual(terminal)
    },
    30000
  )

  it('orders other owners, retains decline and Automatic execution, refreshes only the entering owner, and replays once', async () => {
    const base = await setup('AUTO_ROLL')
    const started = await start(base)
    await seedUsedAllowances(base)
    const before = await stored(base.t, base.run.id)
    const advance = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    } satisfies EncounterExecuteInput
    let result = await executeInRoom(base.owner.caller, advance)
    const expectedOwners = base.run.actors
      .map((actor) => actor.id)
      .filter((id) => id !== started.projection.currentActorId)
      .sort()
    const responses: EncounterExecuteInput[] = []
    for (const [index, ownerId] of expectedOwners.entries()) {
      const pending = result.occurrence?.pending
      if (!pending || pending.kind !== 'LEGENDARY_ACTION_CHOICE')
        throw new Error('Expected an owner choice.')
      expect(pending.ownerActorId).toBe(ownerId)
      expect(pending.options).toHaveLength(1)
      expect(pending.options[0]).toMatchObject({
        targetActorIds: [ownerId],
        ownerFeatureId: automaticChargedBiteFeatureId
      })
      await expect(
        base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toEqual(pending)
      await expect(
        base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
          encounterId: base.run.id
        })
      ).resolves.toBeNull()
      unchangedMechanics(before, await stored(base.t, base.run.id))
      await expect(replayInRoom(base.owner.caller, advance)).resolves.toEqual(result)
      const command = response(
        base.run.id,
        result,
        index === 0 ? { kind: 'DECLINE' } : legendaryOption(pending)
      )
      responses.push(command)
      result = await executeInRoom(base.owner.caller, command)
      await expect(replayInRoom(base.owner.caller, command)).resolves.toEqual(result)
    }
    expect(result).toMatchObject({
      projection: { version: started.projection.version + 1, status: 'ACTIVE' },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    expect(result.projection.currentActorId).not.toBe(started.projection.currentActorId)
    const terminal = await stored(base.t, base.run.id)
    expect(terminal.receipts).toHaveLength(before.receipts.length + 1)
    expect(terminal.commands).toHaveLength(before.commands.length + 1)
    const receipt = terminal.receipts.find((row) => row.commandId === advance.command.commandId)
    expect(JSON.parse(receipt!.resultJson)).toMatchObject({
      legendaryActions: [
        { choice: { ownerActorId: expectedOwners[0] }, resolution: { kind: 'DECLINED' } },
        {
          choice: { ownerActorId: expectedOwners[1] },
          resolution: {
            kind: 'EXECUTED',
            application: { featureResourceConsumption: { beforeUsed: 1, afterUsed: 2, cost: 1 } }
          }
        }
      ],
      legendaryActionRefreshes: [
        expect.objectContaining({ actorId: result.projection.currentActorId })
      ],
      actionEconomyRefreshes: [...allowanceIds].sort().map((capabilityDefinitionId) =>
        expect.objectContaining({
          actorId: result.projection.currentActorId,
          capabilityDefinitionId,
          beforeUsed: 1,
          afterUsed: 0
        })
      )
    })
    for (const row of terminal.actors) {
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      if (actor.kind === 'CHARACTER') throw new Error('Expected a Creature actor.')
      expect(actor.currentHitPoints).toBe(row.id === expectedOwners[1] ? 10 : 11)
      expect(actor.resources).toMatchObject({
        featureCharges: {
          [automaticChargedBiteFeatureId]:
            row.id === result.projection.currentActorId ||
            row.id === started.projection.currentActorId
              ? 0
              : row.id === expectedOwners[1]
                ? 2
                : 1
        },
        ruleUsage: Object.fromEntries(
          allowanceIds.map((definitionId) => [
            definitionId,
            row.id === result.projection.currentActorId ? 0 : 1
          ])
        )
      })
    }
    for (const input of [advance, ...responses])
      await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
    expect(await stored(base.t, base.run.id)).toEqual(terminal)
  }, 30000)

  it('holds Assisted d20, both owner choices, refresh and Recharge until one terminal commit', async () => {
    const base = await setup('PROMPT', 3, true)
    const started = await start(base)
    await seedUsedAllowances(base)
    const before = await stored(base.t, base.run.id)
    const advance = {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    } satisfies EncounterExecuteInput
    let result = await executeInRoom(base.owner.caller, advance)
    const first = result.occurrence?.pending
    if (!first || first.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the first Legendary owner.')
    const selectedOwner = first.ownerActorId
    const option = response(base.run.id, result, legendaryOption(first))
    result = await executeInRoom(base.owner.caller, option).catch((cause: unknown) => {
      throw new Error('Legendary option failed.', { cause })
    })
    const dicePending = result.occurrence?.pending
    if (!dicePending || dicePending.kind !== 'D20_EVIDENCE')
      throw new Error('Expected Assisted Legendary d20 evidence.')
    unchangedMechanics(before, await stored(base.t, base.run.id))
    await expect(
      base.owner.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toEqual(dicePending)
    await expect(
      base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    await expect(replayInRoom(base.owner.caller, option)).resolves.toEqual(result)
    const dice = response(base.run.id, result, {
      kind: 'ENTER_DICE',
      requestId: dicePending.request.requestId,
      rawFaces: dicePending.request.rollMode === 'NORMAL' ? [15] : [15, 15],
      rollMode: dicePending.request.rollMode
    })
    result = await executeInRoom(base.owner.caller, dice).catch((cause: unknown) => {
      throw new Error('Legendary dice response failed.', { cause })
    })
    const second = result.occurrence?.pending
    if (!second || second.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the remaining Legendary owner.')
    expect(second.ownerActorId).not.toBe(selectedOwner)
    unchangedMechanics(before, await stored(base.t, base.run.id))
    await expect(replayInRoom(base.owner.caller, dice)).resolves.toEqual(result)
    const afterDice = await stored(base.t, base.run.id)
    const differentDice: EncounterExecuteInput = {
      command: {
        ...dice.command,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: dicePending.request.requestId,
          rawFaces: [1],
          rollMode: 'NORMAL'
        }
      }
    }
    await expect(executeInRoom(base.owner.caller, differentDice)).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(afterDice)
    const decline = response(base.run.id, result, { kind: 'DECLINE' })
    result = await executeInRoom(base.owner.caller, decline).catch((cause: unknown) => {
      throw new Error('Remaining owner decline failed.', { cause })
    })
    const recharge = result.occurrence?.pending
    if (!recharge || recharge.kind !== 'RECHARGE_EVIDENCE')
      throw new Error('Expected entering Recharge after every owner resolves.')
    unchangedMechanics(before, await stored(base.t, base.run.id))
    for (const input of [advance, option, dice, decline])
      await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
    const rechargeInput = response(base.run.id, result, {
      kind: 'ENTER_INTEGER',
      requestId: recharge.request.requestId,
      value: 5
    })
    result = await executeInRoom(base.owner.caller, rechargeInput)
    expect(result).toMatchObject({
      projection: { version: started.projection.version + 1 },
      occurrence: { status: 'COMPLETE', pending: null }
    })
    const terminal = await stored(base.t, base.run.id)
    expect(terminal.commands).toHaveLength(before.commands.length + 1)
    expect(terminal.receipts).toHaveLength(before.receipts.length + 1)
    const receipt = terminal.receipts.find((row) => row.commandId === advance.command.commandId)
    expect(JSON.parse(receipt!.resultJson)).toMatchObject({
      legendaryActions: [
        {
          choice: { ownerActorId: selectedOwner },
          resolution: {
            kind: 'EXECUTED',
            application: {
              d20: { rawFaces: [15] },
              featureResourceConsumption: { beforeUsed: 1, afterUsed: 2 }
            }
          }
        },
        { choice: { ownerActorId: second.ownerActorId }, resolution: { kind: 'DECLINED' } }
      ],
      rechargeExecutions: [expect.objectContaining({ rawDie: 5, recharged: true })],
      actionEconomyRefreshes: [...allowanceIds].sort().map((capabilityDefinitionId) =>
        expect.objectContaining({
          actorId: result.projection.currentActorId,
          capabilityDefinitionId,
          beforeUsed: 1,
          afterUsed: 0
        })
      )
    })
    const hitActor = encounterRunActorStateSchema.parse(
      JSON.parse(
        terminal.actors.find((row) => row.id === legendaryOption(first).targetActorId)!.stateJson
      )
    )
    if (hitActor.kind === 'CHARACTER') throw new Error('Expected a Creature actor.')
    expect(hitActor.currentHitPoints).toBe(10)
    const enteringActor = encounterRunActorStateSchema.parse(
      JSON.parse(
        terminal.actors.find((row) => row.id === result.projection.currentActorId)!.stateJson
      )
    )
    expect(enteringActor.resources).toMatchObject({
      featureCharges: { [automaticChargedBiteFeatureId]: 0, [rechargeFeatureId]: 0 },
      ruleUsage: Object.fromEntries(allowanceIds.map((definitionId) => [definitionId, 0]))
    })
    const entropy = vi.spyOn(crypto, 'getRandomValues').mockImplementation(() => {
      throw new Error('Replay must retain dice.')
    })
    try {
      for (const input of [advance, option, dice, decline, rechargeInput])
        await expect(replayInRoom(base.owner.caller, input)).resolves.toEqual(result)
    } finally {
      entropy.mockRestore()
    }
    expect(await stored(base.t, base.run.id)).toEqual(terminal)
  }, 30000)

  it('lets a granted Creature controller pick and roll its Legendary Action, with GM override', async () => {
    for (const variant of ['PLAYER_PROMPT', 'PLAYER_AUTO_ROLL', 'GM_OVERRIDE'] as const) {
      // The GM prompts, so only the controller's preference can auto-roll the Legendary d20.
      const base = await setup('PROMPT', 2)
      await setAutoRollDice(base.t, base.other.userId, variant === 'PLAYER_AUTO_ROLL')
      const started = await start(base)
      const ownerActorId = started.projection.actors.find(
        (actor) => actor.id !== started.projection.currentActorId
      )!.id
      const granted = await executeInRoom(base.owner.caller, {
        command: {
          type: 'UPDATE_ACTOR',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: started.projection.version,
          actorId: ownerActorId,
          controllerUserIds: [base.other.userId]
        }
      })
      let result = await executeInRoom(base.owner.caller, {
        command: {
          type: 'ADVANCE_TURN',
          encounterId: base.run.id,
          commandId: crypto.randomUUID(),
          expectedVersion: granted.projection.version
        }
      })
      const choice = result.occurrence?.pending
      if (!choice || choice.kind !== 'LEGENDARY_ACTION_CHOICE')
        throw new Error('Expected the granted Creature Legendary choice.')
      expect(choice.ownerActorId).toBe(ownerActorId)
      for (const member of [base.owner, base.other])
        await expect(
          member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: base.run.id
          })
        ).resolves.toEqual(choice)
      const answerer = variant === 'GM_OVERRIDE' ? base.owner : base.other
      result = await executeInRoom(
        answerer.caller,
        response(base.run.id, result, legendaryOption(choice))
      )
      if (variant === 'PLAYER_AUTO_ROLL') {
        expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
        continue
      }
      const dice = result.occurrence?.pending
      if (!dice || dice.kind !== 'D20_EVIDENCE')
        throw new Error('Expected the controller Legendary d20 prompt.')
      expect(dice.rollerActorId).toBe(ownerActorId)
      for (const member of [base.owner, base.other])
        await expect(
          member.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
            encounterId: base.run.id
          })
        ).resolves.toEqual(dice)
      result = await executeInRoom(
        answerer.caller,
        response(base.run.id, result, {
          kind: 'ENTER_DICE',
          requestId: dice.request.requestId,
          rawFaces: dice.request.rollMode === 'NORMAL' ? [15] : [15, 15],
          rollMode: dice.request.rollMode
        })
      )
      expect(result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    }
  }, 90000)

  it('rejects another player, stale options, changed retained owner source and changed lifecycle publication without writes', async () => {
    const base = await setup('AUTO_ROLL')
    const started = await start(base)
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    const first = result.occurrence?.pending
    if (!first || first.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected Legendary choice.')
    // An ungranted Creature's Legendary choice stays with the GM.
    await expect(
      base.other.caller.query(api.encounters.pendingReads.pendingRuleOccurrence, {
        encounterId: base.run.id
      })
    ).resolves.toBeNull()
    const valid = response(base.run.id, result, { kind: 'DECLINE' })
    const before = await stored(base.t, base.run.id)
    await expect(executeInRoom(base.other.caller, valid)).rejects.toThrow()
    await expect(
      executeInRoom(
        base.owner.caller,
        response(base.run.id, result, {
          kind: 'LEGENDARY_OPTION',
          optionId: 'f'.repeat(64),
          targetActorId: first.ownerActorId
        })
      )
    ).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(before)
    result = await executeInRoom(base.owner.caller, valid)
    const remaining = response(base.run.id, result, { kind: 'DECLINE' })
    const original = (await stored(base.t, base.run.id)).actors.find(
      (row) => row.id === first.ownerActorId
    )!
    await base.t.run(async (ctx) => {
      const actor = encounterRunActorStateSchema.parse(JSON.parse(original.stateJson))
      const snapshot = actor.snapshot as { payload: { features: unknown[] } }
      snapshot.payload.features = []
      await ctx.db.patch(original._id, {
        stateJson: JSON.stringify(actor),
        stateChecksum: checksumCanonicalJson(actor)
      })
    })
    const changedSource = await stored(base.t, base.run.id)
    await expect(executeInRoom(base.owner.caller, remaining)).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(changedSource)
    await base.t.run((ctx) =>
      ctx.db.patch(original._id, {
        stateJson: original.stateJson,
        stateChecksum: original.stateChecksum
      })
    )
    await base.t.run(async (ctx) => {
      const definition = await ctx.db
        .query('reusableDefinitions')
        .withIndex('by_publicId', (q) => q.eq('id', base.lifecycle.id))
        .unique()
      if (!definition) throw new Error('Missing Legendary lifecycle definition.')
      await ctx.db.patch(definition._id, {
        version: definition.version + 1,
        contractVersion: 1,
        publishedAt: new Date().toISOString(),
        publishedBy: srdSystemRecord.userId
      })
    })
    const changedDefinition = await stored(base.t, base.run.id)
    await expect(executeInRoom(base.owner.caller, remaining)).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(changedDefinition)
  }, 30000)

  it('settles the terminal Legendary response once, with the spend, target damage, cursor and receipt', async () => {
    const base = await setup('AUTO_ROLL', 2)
    const started = await start(base)
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    const pending = result.occurrence?.pending
    if (!pending || pending.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected one Legendary owner.')
    const terminalInput = response(base.run.id, result, legendaryOption(pending))
    const before = await stored(base.t, base.run.id)
    const terminal = await executeInRoom(base.owner.caller, terminalInput)
    expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(terminal.projection.version).toBe(started.projection.version + 1)
    await expect(replayInRoom(base.owner.caller, terminalInput)).resolves.toEqual(terminal)
    expect((await stored(base.t, base.run.id)).receipts).toHaveLength(before.receipts.length + 1)
  }, 30000)

  it('skips the next Creature’s turn when a Legendary Action at the end of the turn defeats it (D63)', async () => {
    const base = await setup('AUTO_ROLL', 3)
    const started = await start(base)
    const [current, next, after] = started.projection.actors.map((actor) => actor.id)
    expect(started.projection.currentActorId).toBe(current)
    const hurt = await setHitPoints(base, started.projection.version, next!, 1)
    // The next Creature spends its Legendary Action on itself for 1 damage and falls.
    const ended = await advanceTurn(base, hurt.projection.version, next!)
    expect(ended.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(ended.projection.actors.find((actor) => actor.id === next)).toMatchObject({
      currentHitPoints: 0,
      defeated: true
    })
    expect(ended.projection).toMatchObject({ round: 1, currentActorId: after })
  }, 60000)

  it('opens the new round past its opener when a Legendary Action at the end of the round defeats it (D63)', async () => {
    const base = await setup('AUTO_ROLL', 2)
    const started = await start(base)
    const [opener, last] = started.projection.actors.map((actor) => actor.id)
    const second = await advanceTurn(base, started.projection.version, null)
    expect(second.projection.currentActorId).toBe(last)
    const hurt = await setHitPoints(base, second.projection.version, opener!, 1)
    const wrapped = await advanceTurn(base, hurt.projection.version, opener!)
    expect(wrapped.projection.actors.find((actor) => actor.id === opener)).toMatchObject({
      defeated: true
    })
    expect(wrapped.projection).toMatchObject({ round: 2, currentActorId: last })
  }, 60000)
})

async function setHitPoints(
  base: Awaited<ReturnType<typeof setup>>,
  expectedVersion: number,
  actorId: string,
  currentHitPoints: number
) {
  return executeInRoom(base.owner.caller, {
    command: {
      type: 'UPDATE_ACTOR',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion,
      actorId,
      currentHitPoints
    }
  })
}

/** Ends the turn; only `userActorId` (when given) takes its Legendary Action, everyone else declines. */
async function advanceTurn(
  base: Awaited<ReturnType<typeof setup>>,
  expectedVersion: number,
  userActorId: string | null
) {
  let result = await executeInRoom(base.owner.caller, {
    command: {
      type: 'ADVANCE_TURN',
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion
    }
  })
  for (let responses = 0; result.occurrence?.status === 'PENDING'; responses += 1) {
    expect(responses).toBeLessThan(4)
    const pending = result.occurrence.pending
    if (!pending || pending.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected only Legendary owner choices.')
    result = await executeInRoom(
      base.owner.caller,
      response(
        base.run.id,
        result,
        pending.ownerActorId === userActorId ? legendaryOption(pending) : { kind: 'DECLINE' }
      )
    )
  }
  return result
}

describe('private DO turn Legendary Action response', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('commits one choice and d20 response through pending snapshots before the terminal turn', async () => {
    const base = await setup('PROMPT', 2, false)
    const started = await start(base)
    const epoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: base.campaign.createdAt
      })
    )
    const secret = 'private-legendary-turn-test-secret-at-least-32-bytes'
    const environment = workerEnvironment(secret)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
    const routes: string[] = []
    stubLiveSessionFetch((pathname, init) => {
      if (
        pathname !== '/live-sessions/encounter-rules' &&
        pathname !== '/live-sessions/encounter-turn-pending' &&
        pathname !== '/live-sessions/encounter-turn'
      )
        throw new Error(`Unexpected private turn request: ${pathname}`)
      if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
        throw new Error('Missing private turn bearer token.')
      if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
        throw new Error('Missing private turn secret.')
      if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
      if (pathname === '/live-sessions/encounter-rules')
        liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
      else if (pathname === '/live-sessions/encounter-turn-pending')
        liveSessionEncounterTurnPendingInputSchema.parse(JSON.parse(init.body))
      else liveSessionEncounterTurnCommitInputSchema.parse(JSON.parse(init.body))
      routes.push(pathname)
      return base.owner.caller.fetch(pathname, init)
    })
    const scope = {
      campaignId: base.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: base.run.id,
      expectedVersion: started.projection.version
    }
    const runtimeSecret = process.env.BETTER_AUTH_SECRET
    if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: await deriveRulesContinuationKey(
        process.env.RULES_CONTINUATION_SECRET
      ),
      definitions: {
        async requireCurrent(definitionId) {
          const response = await fetch(
            `${environment.CONVEX_SITE_URL}/live-sessions/encounter-rules`,
            {
              method: 'POST',
              headers: {
                authorization: 'Bearer fixture-access-token',
                'x-artificer-live-session-secret': secret,
                'content-type': 'application/json'
              },
              body: JSON.stringify({ ...scope, request: { kind: 'DEFINITION', definitionId } })
            }
          )
          if (!response.ok) throw new Error('Private Legendary definition capture failed.')
          const captured = liveSessionEncounterRulesResponseSchema.parse(await response.json())
          if (captured.kind !== 'DEFINITION' || !captured.definition)
            throw new Error('Private Legendary definition is unavailable.')
          return serverPublishedRuleDefinitionDtoSchema.parse({
            id: captured.definition.id,
            gameSystemId: captured.definition.gameSystemId,
            definitionFamilyKey: captured.definition.definitionFamilyKey,
            checksum: captured.definition.checksum,
            definition: captured.definition.document
          })
        }
      }
    })
    const advance = {
      type: 'ADVANCE_TURN' as const,
      encounterId: base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: started.projection.version
    }
    const before = await stored(base.t, base.run.id)
    const options = { runtime, random: () => 0 }
    const root = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      scope,
      advance,
      options
    )
    if (root.kind !== 'PLANNED' || root.prepared.kind !== 'PENDING')
      throw new Error('Expected pending Legendary choice plan.')
    const initial = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnPending',
      {
        ...scope,
        command: root.command,
        revisions: root.revisions,
        scenes: root.scenes,
        snapshot: root.prepared.snapshot
      }
    )
    const choice = initial.occurrence?.pending
    if (!initial.occurrence || !choice || choice.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected DO Legendary Action choice.')
    const occurrenceId = initial.occurrence.occurrenceId
    expect(initial.occurrence.occurrenceVersion).toBe(0)
    unchangedMechanics(before, await stored(base.t, base.run.id))
    const ownerId = choice.ownerActorId
    const chosenCommand = response(base.run.id, initial, legendaryOption(choice)).command
    const chosen = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      scope,
      chosenCommand,
      options
    )
    if (chosen.kind !== 'PLANNED' || chosen.prepared.kind !== 'PENDING')
      throw new Error('Expected pending Legendary d20 plan.')
    const evidenceResult = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnPending',
      {
        ...scope,
        command: chosen.command,
        revisions: chosen.revisions,
        scenes: chosen.scenes,
        snapshot: chosen.prepared.snapshot
      }
    )
    const evidence = evidenceResult.occurrence?.pending
    if (!evidenceResult.occurrence || !evidence || evidence.kind !== 'D20_EVIDENCE')
      throw new Error('Expected DO Legendary d20 evidence.')
    expect(evidenceResult.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 1,
      status: 'PENDING'
    })
    unchangedMechanics(before, await stored(base.t, base.run.id))
    const choiceReplay = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      scope,
      chosenCommand,
      options
    )
    expect(choiceReplay).toEqual({ kind: 'REPLAY', result: evidenceResult })
    const diceCommand = response(base.run.id, evidenceResult, {
      kind: 'ENTER_DICE',
      requestId: evidence.request.requestId,
      rawFaces: evidence.request.rollMode === 'NORMAL' ? [15] : [15, 15],
      rollMode: evidence.request.rollMode
    }).command
    const finished = await planNativeLiveEncounterTurn(
      environment,
      'fixture-access-token',
      scope,
      diceCommand,
      options
    )
    if (finished.kind !== 'PLANNED' || finished.prepared.kind !== 'COMPLETE' || !finished.terminal)
      throw new Error('Expected complete DO Legendary turn plan.')
    unchangedMechanics(before, await stored(base.t, base.run.id))
    const terminal = await callLiveSessionRoute(
      environment,
      'fixture-access-token',
      'encounterTurnCommit',
      finished.terminal
    )
    expect(
      routes.filter((route) => route === '/live-sessions/encounter-turn-pending')
    ).toHaveLength(2)
    expect(routes.at(-1)).toBe('/live-sessions/encounter-turn')
    expect(terminal.occurrence).toMatchObject({
      occurrenceId,
      occurrenceVersion: 2,
      status: 'COMPLETE',
      pending: null
    })
    expect(terminal.projection.version).toBe(started.projection.version + 1)
    const after = await stored(base.t, base.run.id)
    expect(after.commands).toHaveLength(before.commands.length + 1)
    expect(after.receipts).toHaveLength(before.receipts.length + 1)
    const receipt = after.receipts.find((row) => row.commandId === advance.commandId)
    if (!receipt) throw new Error('Missing terminal Legendary turn receipt.')
    expect(JSON.parse(receipt.resultJson)).toMatchObject({
      legendaryActions: [
        {
          choice: { ownerActorId: ownerId },
          resolution: {
            kind: 'EXECUTED',
            application: {
              d20: { rawFaces: [15] },
              featureResourceConsumption: { beforeUsed: 1, afterUsed: 2 }
            }
          }
        }
      ]
    })
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (metadata.transition !== 'TURN_EFFECTS') throw new Error('Missing turn response history.')
    expect(
      metadata.resolutionCommands.map((entry) => ({ commandId: entry.commandId, kind: entry.kind }))
    ).toEqual([
      { commandId: chosenCommand.commandId, kind: 'LEGENDARY_OPTION' },
      { commandId: diceCommand.commandId, kind: 'LEGENDARY_ENTER_DICE' }
    ])
    const spent = encounterRunActorStateSchema.parse(
      JSON.parse(after.actors.find((row) => row.id === ownerId)!.stateJson)
    )
    const hit = encounterRunActorStateSchema.parse(
      JSON.parse(
        after.actors.find((row) => row.id === legendaryOption(choice).targetActorId)!.stateJson
      )
    )
    expect(terminal.projection.currentActorId).toBe(ownerId)
    if (spent.kind === 'CHARACTER' || hit.kind === 'CHARACTER')
      throw new Error('Expected Creature actors.')
    // The owner's spent pool refreshes as its turn starts; its Tail-style attack hit the other actor.
    expect(spent.resources).toMatchObject({
      featureCharges: { [automaticChargedBiteFeatureId]: 0 }
    })
    expect(hit.id).not.toBe(ownerId)
    expect(hit.currentHitPoints).toBe(10)
    expect(
      await callLiveSessionRoute(
        environment,
        'fixture-access-token',
        'encounterTurnCommit',
        finished.terminal
      )
    ).toEqual(terminal)
    expect(
      await planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        diceCommand,
        options
      )
    ).toEqual({ kind: 'REPLAY', result: terminal })
    expect(await stored(base.t, base.run.id)).toEqual(after)
  }, 60_000)

  it('replays an accepted Legendary decline after the turn reaches pending initiative order', async () => {
    const base = await setup('AUTO_ROLL', 2, false, 'EACH_ROUND')
    const started = await start(base)
    let result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    if (result.occurrence?.pending?.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the first outgoing Legendary choice.')
    result = await executeInRoom(
      base.owner.caller,
      response(base.run.id, result, { kind: 'DECLINE' })
    )
    expect(result.occurrence?.status).toBe('COMPLETE')
    const secondAdvanceVersion = result.projection.version
    result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: secondAdvanceVersion
      }
    })
    const choice = result.occurrence?.pending
    if (!choice || choice.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the last actor outgoing Legendary choice.')
    const decline = response(base.run.id, result, { kind: 'DECLINE' }).command
    const rolls = vi.spyOn(rollRandom, 'nextRollInt').mockImplementation((maximum) => maximum - 1)
    try {
      result = await executeInRoom(base.owner.caller, {
        command: decline
      })
    } finally {
      rolls.mockRestore()
    }
    expect(result.occurrence?.pending?.kind).toBe('INITIATIVE_ORDER')
    expect(result.projection.version).toBe(secondAdvanceVersion)
    const beforeReplay = await stored(base.t, base.run.id)

    const epoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: base.campaign.createdAt
      })
    )
    const secret = 'private-legendary-turn-test-secret-at-least-32-bytes'
    const environment = workerEnvironment(secret)
    vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
    stubLiveSessionFetch((pathname, init) => {
      if (pathname !== '/live-sessions/encounter-rules')
        throw new Error(`Unexpected private turn request: ${pathname}`)
      if (new Headers(init?.headers).get('authorization') !== 'Bearer fixture-access-token')
        throw new Error('Missing private turn bearer token.')
      if (new Headers(init?.headers).get('x-artificer-live-session-secret') !== secret)
        throw new Error('Missing private turn secret.')
      if (typeof init?.body !== 'string') throw new Error('Missing private turn body.')
      liveSessionEncounterRulesInputSchema.parse(JSON.parse(init.body))
      return base.owner.caller.fetch(pathname, init)
    })
    const scope = {
      campaignId: base.campaign.id,
      authorityEpoch: epoch,
      expectedUserId: base.owner.userId,
      expectedRole: 'OWNER' as const,
      encounterId: base.run.id,
      expectedVersion: secondAdvanceVersion
    }
    const runtimeSecret = process.env.BETTER_AUTH_SECRET
    if (!runtimeSecret) throw new Error('Missing fixture rule continuation secret.')
    const runtime = createPlatformRulesRuntime({
      continuationIntegrityKey: await deriveRulesContinuationKey(
        process.env.RULES_CONTINUATION_SECRET
      ),
      definitions: {
        async requireCurrent(definitionId) {
          const response = await fetch(
            `${environment.CONVEX_SITE_URL}/live-sessions/encounter-rules`,
            {
              method: 'POST',
              headers: {
                authorization: 'Bearer fixture-access-token',
                'x-artificer-live-session-secret': secret,
                'content-type': 'application/json'
              },
              body: JSON.stringify({ ...scope, request: { kind: 'DEFINITION', definitionId } })
            }
          )
          if (!response.ok) throw new Error('Private Legendary definition capture failed.')
          const captured = liveSessionEncounterRulesResponseSchema.parse(await response.json())
          if (captured.kind !== 'DEFINITION' || !captured.definition)
            throw new Error('Private Legendary definition is unavailable.')
          return serverPublishedRuleDefinitionDtoSchema.parse({
            id: captured.definition.id,
            gameSystemId: captured.definition.gameSystemId,
            definitionFamilyKey: captured.definition.definitionFamilyKey,
            checksum: captured.definition.checksum,
            definition: captured.definition.document
          })
        }
      }
    })
    const replayOptions = {
      runtime,
      random: () => {
        throw new Error('Accepted Legendary replay must not roll again.')
      }
    }
    await expect(
      planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        decline,
        replayOptions
      )
    ).resolves.toEqual({ kind: 'REPLAY', result })
    expect(await stored(base.t, base.run.id)).toEqual(beforeReplay)
    await expect(
      planNativeLiveEncounterTurn(
        environment,
        'fixture-access-token',
        scope,
        {
          ...decline,
          resolution: legendaryOption(choice)
        },
        replayOptions
      )
    ).rejects.toThrow()
    expect(await stored(base.t, base.run.id)).toEqual(beforeReplay)
  }, 60_000)
  it('declines a Legendary choice the GM voids in the room, then records the void once', async () => {
    const base = await setup('AUTO_ROLL', 2, false, 'EACH_ROUND')
    const started = await start(base)
    const result = await executeInRoom(base.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: started.projection.version
      }
    })
    const choice = result.occurrence?.pending
    if (!choice || choice.kind !== 'LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected the first outgoing Legendary choice.')
    const epoch = crypto.randomUUID()
    await base.t.run((ctx) =>
      insertActiveLiveAuthority(ctx, {
        campaignId: base.campaign.id,
        epoch,
        createdAt: base.campaign.createdAt
      })
    )
    const before = await stored(base.t, base.run.id)
    const voided = await executeRoomEncounterCommand({
      caller: base.owner.caller,
      actor: {
        campaignId: base.campaign.id,
        authorityEpoch: epoch,
        expectedUserId: base.owner.userId,
        expectedRole: 'OWNER'
      },
      command: {
        type: 'VOID_RULE_OCCURRENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: choice.encounterVersion,
        occurrenceId: choice.occurrenceId,
        expectedOccurrenceVersion: choice.occurrenceVersion
      },
      random: () => {
        throw new Error('Declining a Legendary choice rolls nothing.')
      }
    })
    // The room planned the GM's decline, which finished the turn, then Convex recorded the void.
    expect(voided.occurrence).toMatchObject({
      occurrenceId: choice.occurrenceId,
      status: 'COMPLETE'
    })
    const after = await stored(base.t, base.run.id)
    expect(after).not.toEqual(before)
    const commands = await base.t.run((ctx) =>
      ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', base.run.id))
        .collect()
    )
    // The decline completed the turn, whose root receipt records it, then the void was recorded.
    expect(commands.map((command) => command.commandType).slice(-2)).toEqual([
      'ADVANCE_TURN',
      'VOID_RULE_OCCURRENCE'
    ])
  }, 60_000)
})
