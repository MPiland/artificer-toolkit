import { describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { ancientRedDragon } from '@artificer-toolkit/source-data/srd/creatures/ancient-red-dragon.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { SRD_DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import { featureChargeUsed } from '../encounterActorState.js'
import {
  applyStagedLegendaryActionRefreshes,
  stageEncounterLegendaryActionRefreshes
} from '../encounterLegendaryActionDiscovery.js'
import { resolveEncounterRuleCapabilityStates } from '../encounterRuleCapabilityState.js'
import { prepareTurnLegendaryActions } from '../encounterTurnLegendaryAction.js'
import { discoverTurnLegendaryWindows } from '../encounterTurnLegendaryDiscovery.js'
import {
  evaluateLegendaryActionEligibility,
  requireLegendaryActionCapabilityDefinitionIds
} from '../legendaryActionEligibilityRegistry.js'
import {
  createSrdRulesRuntime,
  creatureFeature,
  SRD_SYSTEM_ID,
  srdActorRules,
  srdCondition,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState
} from './dnd5eSrdEncounter.js'

const DRAGON_ID = '00000000-0000-4000-8000-00000000b001'
const WOLF_ID = '00000000-0000-4000-8000-00000000b002'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000b003'
const USER_ID = '00000000-0000-4000-8000-00000000b004'
const srdLegendaryActions = creatureFeature(ancientRedDragon, 'Legendary Actions')
/**
 * The Ancient Red Dragon's pool of 3: Detect and Tail Attack cost 1, Wing Attack costs 2. The SRD
 * attack options do not compile as executable Legendary Actions yet, so each option keeps its
 * identity, charge and cost but takes the supported self-action shape the Convex fixture uses.
 */
const legendaryActions: typeof srdLegendaryActions = {
  ...srdLegendaryActions,
  options: srdLegendaryActions.options?.map((option) => ({
    ...option,
    ...(option.effects && {
      effects: option.effects.map((effect) => {
        if (effect.invocation.kind !== 'ACTION') throw new Error('Expected an action option.')
        return {
          id: effect.id,
          order: effect.order,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: 'ACTIVATED' as const,
            activation: { code: 'ACTION' as const, amount: 1 },
            range: { id: effect.invocation.range.id, rangeKind: 'SELF' as const },
            targeting: { selectionKind: 'SELF' as const },
            resourceUse: effect.invocation.resourceUse
          },
          paths: [
            {
              id: `${effect.id}-use`,
              order: 1,
              pathCode: 'ON_USE' as const,
              groupType: 'SINGLE' as const,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: `${effect.id}-use__result`,
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: `${effect.id}-use`,
                    effectKind: 'DAMAGE' as const,
                    damageTypeId: srdDamageTypeId('Fire'),
                    valueKind: 'FIXED' as const,
                    scalingKind: 'NONE' as const,
                    amount: 1
                  }
                ]
              }
            }
          ]
        }
      })
    })
  }))
}
const legendaryDragon: CreatureAuthored = {
  ...ancientRedDragon,
  features: ancientRedDragon.features?.map((feature) =>
    feature.id === legendaryActions.id ? legendaryActions : feature
  )
}
const legendaryCharge = legendaryActions.charges
const system = systemAuthoredDtoSchema.parse(srdSystemRecord)

function srdDamageTypeId(label: string) {
  const damageType = SRD_DAMAGE_TYPES.find((entry) => entry.label === label)
  if (!damageType) throw new Error(`SRD damage type "${label}" is missing.`)
  return damageType.id
}

function dragon(input: { used?: number; conditions?: readonly string[] } = {}) {
  return srdCreatureActor({
    id: DRAGON_ID,
    creature: legendaryDragon,
    featureCharges: { [legendaryActions.id]: input.used ?? 0 },
    conditionIds: input.conditions ?? []
  })
}

const wolfActor = srdCreatureActor({ id: WOLF_ID, creature: wolf })

async function legendaryPin() {
  const current = await srdDefinitions.requireCurrent(
    DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID
  )
  const lifecycle = dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema.parse(
    current.document
  )
  if (lifecycle.kind !== 'LEGENDARY_ACTION')
    throw new Error('Expected the Legendary Action lifecycle.')
  return {
    definitionId: current.id,
    definitionVersion: current.version,
    definitionChecksum: current.checksum,
    eligibilityGraphDefinitionId: lifecycle.eligibilityGraph.definitionId,
    eligibilityGraphDefinitionVersion: lifecycle.eligibilityGraph.definitionVersion,
    eligibilityGraphDefinitionChecksum: lifecycle.eligibilityGraph.definitionChecksum,
    eligibleOutput: lifecycle.eligibilityGraph.eligibleOutput
  }
}

function discoverWindows(input: {
  actors: readonly EncounterRunActorState[]
  outgoingActorId: string
}) {
  return discoverTurnLegendaryWindows({
    state: srdEncounterState({ actors: input.actors, currentActorId: input.outgoingActorId }),
    occurrenceId: OCCURRENCE_ID,
    outgoingActorId: input.outgoingActorId,
    actors: input.actors,
    loadTargets: async (actorIds) =>
      new Map(
        input.actors
          .filter((actor) => actorIds.includes(actor.id))
          .map((actor) => [actor.id, srdCreatureTarget(actor)])
      ),
    loadSystem: async () => system,
    definitions: srdDefinitions,
    createRuntime: createSrdRulesRuntime
  })
}

/** The offered options by Feature option label, in their issued order. */
async function offered(input: Parameters<typeof discoverWindows>[0]) {
  const windows = await discoverWindows(input)
  return windows.map((window) => ({
    ownerActorId: window.choice.ownerActorId,
    options: window.choice.options.map((option) => ({
      label: window.candidatesByOptionId.get(option.optionId)?.action.label,
      featureCost: option.featureCost,
      poolBefore: option.poolBefore,
      poolRemaining: option.poolRemaining
    }))
  }))
}

describe('Legendary Action eligibility policy', () => {
  it('allows one option only at the end of another creature’s turn, while the owner can act and has a pool', async () => {
    const lifecycle = await legendaryPin()
    // A stunned creature's capability state stands in for a stunned owner.
    const stunnedWolf = srdCreatureActor({
      id: WOLF_ID,
      creature: wolf,
      conditionIds: [srdCondition('Stunned')]
    })
    const capabilityStates = await resolveEncounterRuleCapabilityStates({
      encounter: { gameSystemId: SRD_SYSTEM_ID, actors: [dragon(), stunnedWolf] },
      lockedCharacters: new Map(),
      activeEffectsByActorId: new Map([
        [DRAGON_ID, []],
        [WOLF_ID, []]
      ]),
      definitions: srdDefinitions,
      capabilityDefinitionIds: requireLegendaryActionCapabilityDefinitionIds(SRD_SYSTEM_ID)
    })
    const able = capabilityStates.get(DRAGON_ID)?.capabilityState
    const stunned = capabilityStates.get(WOLF_ID)?.capabilityState
    if (!able || !stunned) throw new Error('Expected both capability states.')
    const source = {
      ownerActorId: DRAGON_ID,
      ownerFeatureId: legendaryActions.id,
      actionId: 'tail-attack',
      gameSystemId: SRD_SYSTEM_ID,
      lifecycle
    }
    const cases = [
      { outgoingActorId: WOLF_ID, capabilityState: able, poolRemaining: 3, windowUsed: false },
      { outgoingActorId: DRAGON_ID, capabilityState: able, poolRemaining: 3, windowUsed: false },
      { outgoingActorId: WOLF_ID, capabilityState: stunned, poolRemaining: 3, windowUsed: false },
      { outgoingActorId: WOLF_ID, capabilityState: able, poolRemaining: 0, windowUsed: false },
      { outgoingActorId: WOLF_ID, capabilityState: able, poolRemaining: 1, windowUsed: true }
    ]
    const evaluated = await evaluateLegendaryActionEligibility({
      runtime: await createSrdRulesRuntime(),
      definitions: srdDefinitions,
      occurrenceId: OCCURRENCE_ID,
      candidates: cases.map((facts) => ({ source, facts }))
    })
    expect(evaluated.map((entry) => entry.policy)).toEqual([
      { eligible: true },
      { eligible: false },
      { eligible: false },
      { eligible: false },
      { eligible: false }
    ])
    expect(evaluated.map((entry) => entry.evidence.source.definitionId)).toEqual(
      cases.map(() => SRD_DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID)
    )
  })
})

describe('Legendary Action choices offered at the end of a turn', () => {
  it('offers each affordable option with its cost against the remaining pool', async () => {
    const [choice, ...others] = await offered({
      actors: [dragon(), wolfActor],
      outgoingActorId: WOLF_ID
    })
    expect(others).toEqual([])
    expect(choice?.ownerActorId).toBe(DRAGON_ID)
    // Detect is a check with no executable effect, so only the two attacks are offered.
    expect(
      [...(choice?.options ?? [])].sort((left, right) =>
        (left.label ?? '').localeCompare(right.label ?? '')
      )
    ).toEqual([
      { label: 'Tail Attack', featureCost: 1, poolBefore: 3, poolRemaining: 2 },
      { label: 'Wing Attack (Costs 2 Actions)', featureCost: 2, poolBefore: 3, poolRemaining: 1 }
    ])
    const [window] = await discoverWindows({
      actors: [dragon(), wolfActor],
      outgoingActorId: WOLF_ID
    })
    expect(window?.choice.options.map((option) => option.actionId)).toEqual(
      window?.choice.options
        .map((option) => option.actionId)
        .sort((left, right) => left.localeCompare(right))
    )
  })

  it('pins each option to its owner, charge and lifecycle, and derives its identity from them', async () => {
    const lifecycle = await legendaryPin()
    const [window] = await discoverWindows({
      actors: [dragon(), wolfActor],
      outgoingActorId: WOLF_ID
    })
    if (!window) throw new Error('Expected the dragon’s Legendary Action window.')
    for (const option of window.choice.options) {
      const { optionId, ...identity } = option
      expect(identity).toMatchObject({
        ownerActorId: DRAGON_ID,
        ownerFeatureId: legendaryActions.id,
        targetActorId: DRAGON_ID,
        chargeId: legendaryCharge?.id,
        lifecycle
      })
      expect(optionId).toBe(checksumRuleDocument(identity))
      expect(window.candidatesByOptionId.get(optionId)?.actionId).toBe(option.actionId)
    }
  })

  it('drops options that cost more than the pool has left', async () => {
    expect(
      await offered({ actors: [dragon({ used: 2 }), wolfActor], outgoingActorId: WOLF_ID })
    ).toEqual([
      {
        ownerActorId: DRAGON_ID,
        options: [{ label: 'Tail Attack', featureCost: 1, poolBefore: 1, poolRemaining: 0 }]
      }
    ])
    expect(
      await offered({ actors: [dragon({ used: 3 }), wolfActor], outgoingActorId: WOLF_ID })
    ).toEqual([])
  })

  it('offers nothing at the end of the owner’s own turn or while the owner is incapacitated', async () => {
    expect(await offered({ actors: [dragon(), wolfActor], outgoingActorId: DRAGON_ID })).toEqual([])
    for (const condition of ['Incapacitated', 'Stunned', 'Paralyzed'])
      expect(
        await offered({
          actors: [dragon({ conditions: [srdCondition(condition)] }), wolfActor],
          outgoingActorId: WOLF_ID
        })
      ).toEqual([])
  })
})

describe('Legendary Action pool refresh', () => {
  async function stage(actorId: string, actors: readonly EncounterRunActorState[]) {
    return stageEncounterLegendaryActionRefreshes({
      actorId,
      encounter: { gameSystemId: SRD_SYSTEM_ID, actors },
      actorRules: srdActorRules(actors),
      definitions: srdDefinitions
    })
  }

  it('regains every spent Legendary Action at the start of the owner’s own turn', async () => {
    const spent = dragon({ used: 2 })
    const lifecycle = await legendaryPin()
    const plan = await stage(DRAGON_ID, [spent, wolfActor])
    expect(plan.refreshes).toEqual([
      {
        ordinal: 0,
        actorId: DRAGON_ID,
        actorCurrentnessChecksum: checksumRuleDocument({
          id: spent.id,
          sourceId: spent.sourceId,
          sourceRevision: 1,
          systemId: spent.systemId,
          snapshot: spent.snapshot,
          resources: spent.resources
        }),
        ownerFeatureId: legendaryActions.id,
        chargeId: legendaryCharge?.id,
        lifecycleDefinitionId: lifecycle.definitionId,
        lifecycleDefinitionVersion: 1,
        lifecycleDefinitionChecksum: lifecycle.definitionChecksum,
        beforeUsed: 2,
        afterUsed: 0
      }
    ])
    if (!plan.refreshedActor) throw new Error('Expected the refreshed dragon.')
    expect(featureChargeUsed(plan.refreshedActor, legendaryActions.id)).toBe(0)

    const [applied] = await applyStagedLegendaryActionRefreshes({
      encounter: { gameSystemId: SRD_SYSTEM_ID, actors: [spent, wolfActor] },
      definitions: srdDefinitions,
      refreshes: plan.refreshes
    })
    expect(applied).toEqual(plan.refreshedActor)
  })

  it('refreshes nothing for an unspent pool or at another creature’s turn start', async () => {
    expect(await stage(DRAGON_ID, [dragon(), wolfActor])).toEqual({
      refreshes: [],
      refreshedActor: null
    })
    expect(await stage(WOLF_ID, [dragon({ used: 2 }), wolfActor])).toEqual({
      refreshes: [],
      refreshedActor: null
    })
  })

  it('refuses to apply a staged refresh once the owner changed', async () => {
    const plan = await stage(DRAGON_ID, [dragon({ used: 2 }), wolfActor])
    await expect(
      applyStagedLegendaryActionRefreshes({
        encounter: { gameSystemId: SRD_SYSTEM_ID, actors: [dragon({ used: 3 }), wolfActor] },
        definitions: srdDefinitions,
        refreshes: plan.refreshes
      })
    ).rejects.toThrow('Legendary Action refresh owner is stale.')
  })
})

describe('Legendary Action turn window', () => {
  function root(input: { currentActorId: string }) {
    return turnCoordinatorRootDtoSchema.parse({
      rootCommandId: '00000000-0000-4000-8000-00000000b010',
      commandFingerprint: 'f'.repeat(64),
      commandType: 'ADVANCE_TURN',
      initiatorUserId: USER_ID,
      requestedByUserId: USER_ID,
      correlationId: null,
      expectedEncounterVersion: 7,
      proposedTerminalTransition: {
        status: 'ACTIVE',
        round: 1,
        currentActorId: input.currentActorId
      }
    })
  }

  function prepare(input: {
    actors: readonly EncounterRunActorState[]
    turnRoot: ReturnType<typeof root>
    automationMode?: 'MANUAL'
    pending?: Parameters<typeof prepareTurnLegendaryActions>[0]['pending']
    decline?: boolean
  }) {
    return prepareTurnLegendaryActions({
      state: srdEncounterState({
        actors: input.actors,
        currentActorId: WOLF_ID,
        ...(input.automationMode ? { automationMode: input.automationMode } : {})
      }),
      userId: USER_ID,
      autoRollByActorId: {},
      occurrenceId: OCCURRENCE_ID,
      root: input.turnRoot,
      ...(input.pending ? { pending: input.pending } : {}),
      ...(input.decline ? { resolution: { kind: 'DECLINE' as const } } : {}),
      updatedAt: '2026-09-26T00:00:01.000Z',
      actors: input.actors,
      discoverWindows: ({ outgoingActorId, actors }) =>
        discoverWindows({ actors, outgoingActorId }),
      prepareMechanics: () => {
        throw new Error('A declined Legendary Action prepares no mechanics.')
      },
      definitions: srdDefinitions,
      createRuntime: createSrdRulesRuntime,
      rollD20: () => {
        throw new Error('A declined Legendary Action rolls no d20.')
      }
    })
  }

  it('pauses the end of another creature’s turn on the owner’s Legendary Action choice', async () => {
    const actors = [dragon({ used: 1 }), wolfActor]
    const result = await prepare({ actors, turnRoot: root({ currentActorId: DRAGON_ID }) })
    if (result.kind !== 'PENDING') throw new Error('Expected the Legendary Action choice.')
    const [window] = await discoverWindows({ actors, outgoingActorId: WOLF_ID })
    if (!window) throw new Error('Expected the dragon’s Legendary Action window.')
    const pausedRoot = {
      ...root({ currentActorId: DRAGON_ID }),
      outgoingTurn: { kind: 'NONE' as const },
      legendaryActionQueue: { ownerActorIds: [DRAGON_ID], nextOwnerIndex: 0 },
      completedLegendaryActions: []
    }
    expect(result.snapshot).toEqual(
      serverAggregateChoicePendingSnapshotDtoSchema.parse({
        snapshotKind: 'AGGREGATE_CHOICE',
        schemaVersion: 1,
        occurrenceId: OCCURRENCE_ID,
        applicationContext: {
          kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
          schemaVersion: 1,
          root: pausedRoot,
          choice: window.choice,
          selectionChecksum: checksumRuleDocument(window.choice)
        }
      })
    )
  })

  it('records a declined window, then regains the owner’s spent pool as its own turn starts', async () => {
    const actors = [dragon({ used: 1 }), wolfActor]
    const paused = await prepare({ actors, turnRoot: root({ currentActorId: DRAGON_ID }) })
    if (paused.kind !== 'PENDING') throw new Error('Expected the Legendary Action choice.')
    const context = paused.snapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice context.')
    const declined = await prepare({
      actors,
      turnRoot: context.root,
      pending: paused.snapshot,
      decline: true
    })
    if (declined.kind !== 'COMPLETE') throw new Error('A declined window completes the turn.')
    expect(declined.root.legendaryActionQueue).toBeUndefined()
    expect(declined.root.completedLegendaryActions).toEqual([
      {
        choice: context.choice,
        selectionChecksum: checksumRuleDocument(context.choice),
        resolution: { kind: 'DECLINED' }
      }
    ])
    expect(declined.root.stagedLegendaryActionRefreshes).toMatchObject([
      { actorId: DRAGON_ID, ownerFeatureId: legendaryActions.id, beforeUsed: 1, afterUsed: 0 }
    ])
    const refreshedDragon = declined.actors.find((actor) => actor.id === DRAGON_ID)
    if (!refreshedDragon) throw new Error('Expected the dragon.')
    expect(featureChargeUsed(refreshedDragon, legendaryActions.id)).toBe(0)
  })

  it('never opens a window in a Manual Encounter', async () => {
    const actors = [dragon({ used: 1 }), wolfActor]
    const turnRoot = root({ currentActorId: DRAGON_ID })
    expect(await prepare({ actors, turnRoot, automationMode: 'MANUAL' })).toEqual({
      kind: 'COMPLETE',
      root: turnRoot,
      actors
    })
    await expect(
      prepare({
        actors,
        automationMode: 'MANUAL',
        turnRoot: {
          ...turnRoot,
          legendaryActionQueue: { ownerActorIds: [DRAGON_ID], nextOwnerIndex: 0 }
        }
      })
    ).rejects.toThrow('Manual turns cannot contain Legendary Actions.')
  })
})
