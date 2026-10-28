import { describe, expect, it } from 'vitest'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
} from '@artificer-toolkit/schema/shared/encounterLifecycle'
import { serverAggregateChoicePendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { turnCoordinatorRootDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { systemAuthoredDtoSchema } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_DND5E_LEGENDARY_ACTION_ELIGIBILITY_GRAPH_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/encounterLifecycle.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_DAMAGE_TYPES, srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  encounterRuleUsageUsed,
  featureChargeUsed,
  withEncounterRuleUsageUsed
} from '../encounterActorState.js'
import {
  applyStagedLegendaryActionRefreshes,
  stageEncounterLegendaryActionRefreshes
} from '../encounterLegendaryActionDiscovery.js'
import { prepareEncounterActionMechanics } from '../encounterActionMechanicsPreparation.js'
import { resolveEncounterActionSource } from '../encounterActionSources.js'
import { resolveEncounterRuleCapabilityStates } from '../encounterRuleCapabilityState.js'
import {
  delegatedLegendaryOption,
  prepareTurnLegendaryActions
} from '../encounterTurnLegendaryAction.js'
import { discoverTurnLegendaryWindows } from '../encounterTurnLegendaryDiscovery.js'
import {
  evaluateLegendaryActionEligibility,
  requireLegendaryActionCapabilityDefinitionIds
} from '../legendaryActionEligibilityService.js'
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
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

const ancientRedDragon = srdByLabel(SRD.creatures, 'Ancient Red Dragon')
const wolf = srdByLabel(SRD.creatures, 'Wolf')
const unicorn = srdByLabel(SRD.creatures, 'Unicorn')
const vampire = srdByLabel(SRD.creatures, 'Vampire')
const vampireLegendaryActions = creatureFeature(vampire, 'Legendary Actions')

const DRAGON_ID = '00000000-0000-4000-8000-00000000b001'
const WOLF_ID = '00000000-0000-4000-8000-00000000b002'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000b003'
const USER_ID = '00000000-0000-4000-8000-00000000b004'
const BAT_ID = '00000000-0000-4000-8000-00000000b005'
const srdLegendaryActions = creatureFeature(ancientRedDragon, 'Legendary Actions')
/**
 * The Ancient Red Dragon's pool of 3: Detect and Tail Attack cost 1, Wing Attack costs 2. Tail Attack
 * runs the dragon's own Tail (D51 option B). Wing Attack is an area save, which a turn cannot run
 * yet, so it keeps its identity, charge and cost but takes a supported self-action shape.
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
  /** The actors with a token in a Scene; none by default. */
  tokenBoundActorIds?: readonly string[]
  delegatedLegendaryAction?: EncounterRunState['delegatedLegendaryAction']
}) {
  return discoverTurnLegendaryWindows({
    spells: new Map(),
    state: {
      ...srdEncounterState({ actors: input.actors, currentActorId: input.outgoingActorId }),
      ...(input.delegatedLegendaryAction
        ? { delegatedLegendaryAction: input.delegatedLegendaryAction }
        : {})
    },
    tokenBoundActorIds: new Set(input.tokenBoundActorIds ?? []),
    occurrenceId: OCCURRENCE_ID,
    outgoingActorId: input.outgoingActorId,
    actors: input.actors,
    deadCharacterIds: new Set(),
    loadTargets: async (actorIds) =>
      new Map(
        input.actors
          .filter((actor) => actorIds.includes(actor.id))
          .map((actor) => [actor.id, srdCreatureTarget(actor)])
      ),
    loadSystem: async () => system,
    definitions: srdDefinitions,
    createRuntime: async () => createSrdRulesRuntime()
  })
}

/** The offered options by Feature option label, in their issued order. */
async function offered(input: Parameters<typeof discoverWindows>[0]) {
  const windows = await discoverWindows(input)
  return windows.map((window) => ({
    ownerActorId: window.choice.ownerActorId,
    options: window.choice.options.map((option) => ({
      label: option.label,
      targetActorIds: option.targetActorIds,
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
      runtime: createSrdRulesRuntime(),
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
    // Detect is a check with no executable effect, so only the two attacks are offered. Tail Attack
    // runs the dragon's Tail against another actor; the stand-in Wing Attack targets its user.
    expect(
      [...(choice?.options ?? [])].sort((left, right) => left.label.localeCompare(right.label))
    ).toEqual([
      {
        label: 'Tail Attack',
        targetActorIds: [WOLF_ID],
        featureCost: 1,
        poolBefore: 3,
        poolRemaining: 2
      },
      {
        label: 'Wing Attack (Costs 2 Actions)',
        targetActorIds: [DRAGON_ID],
        featureCost: 2,
        poolBefore: 3,
        poolRemaining: 1
      }
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
        options: [
          {
            label: 'Tail Attack',
            targetActorIds: [WOLF_ID],
            featureCost: 1,
            poolBefore: 1,
            poolRemaining: 0
          }
        ]
      }
    ])
    expect(
      await offered({ actors: [dragon({ used: 3 }), wolfActor], outgoingActorId: WOLF_ID })
    ).toEqual([])
  })

  it('leaves out an SRD option it cannot execute instead of failing the whole window, and offers an area centered on its owner only to an owner with a token', async () => {
    const srdDragon = (options: typeof srdLegendaryActions.options) =>
      srdCreatureActor({
        id: DRAGON_ID,
        creature: {
          ...ancientRedDragon,
          features: ancientRedDragon.features?.map((feature) =>
            feature.id === srdLegendaryActions.id ? { ...feature, options } : feature
          )
        },
        featureCharges: { [srdLegendaryActions.id]: 0 }
      })
    // The SRD Wing Attack is an area centered on the dragon, which only its token can center; Tail
    // Attack runs the Tail.
    const tailAttack = {
      label: 'Tail Attack',
      targetActorIds: [WOLF_ID],
      featureCost: 1,
      poolBefore: 3,
      poolRemaining: 2
    }
    const actors = [srdDragon(srdLegendaryActions.options), wolfActor]
    expect(await offered({ actors, outgoingActorId: WOLF_ID })).toEqual([
      { ownerActorId: DRAGON_ID, options: [tailAttack] }
    ])
    // With a token, Wing Attack is offered as an option the area coordinator runs, naming its owner.
    const [window] = await discoverWindows({
      actors,
      outgoingActorId: WOLF_ID,
      tokenBoundActorIds: [DRAGON_ID]
    })
    expect(
      window?.choice.options
        .map(({ label, targetActorIds, featureCost, poolBefore, poolRemaining, delegated }) => ({
          label,
          targetActorIds,
          featureCost,
          poolBefore,
          poolRemaining,
          delegated
        }))
        .sort((left, right) => left.label.localeCompare(right.label))
    ).toEqual([
      { ...tailAttack, delegated: undefined },
      {
        label: 'Wing Attack (Costs 2 Actions)',
        targetActorIds: [DRAGON_ID],
        featureCost: 2,
        poolBefore: 3,
        poolRemaining: 1,
        delegated: true
      }
    ])
  })

  it('offers no second window to an owner already settled before a turn end split around a delegated option', async () => {
    expect(
      await offered({
        actors: [dragon(), wolfActor],
        outgoingActorId: WOLF_ID,
        delegatedLegendaryAction: {
          parentCommandId: '00000000-0000-4000-8000-00000000b010',
          holderActorId: BAT_ID,
          actionId: 'any-action',
          settledOwnerActorIds: [DRAGON_ID]
        }
      })
    ).toEqual([])
  })
  it('offers the Vampire Unarmed Strike, whose action authors a damage-or-grapple pick (SPELLS-33.T4i1f)', async () => {
    const vampireActor = srdCreatureActor({
      id: DRAGON_ID,
      creature: vampire,
      featureCharges: { [vampireLegendaryActions.id]: 0 }
    })
    const [choice] = await offered({ actors: [vampireActor, wolfActor], outgoingActorId: WOLF_ID })
    expect(choice?.options.map((option) => option.label)).toContain('Unarmed Strike')
  })

  it('offers the unicorn Shimmering Shield on any creature, itself included (D99)', async () => {
    const unicornActor = srdCreatureActor({
      id: DRAGON_ID,
      creature: unicorn,
      featureCharges: { [creatureFeature(unicorn, 'Legendary Actions').id]: 0 }
    })
    const [choice] = await offered({ actors: [unicornActor, wolfActor], outgoingActorId: WOLF_ID })
    expect(
      choice?.options.find((option) => option.label.startsWith('Shimmering Shield'))
    ).toMatchObject({
      targetActorIds: [DRAGON_ID, WOLF_ID],
      featureCost: 2
    })
  })

  it('offers a defeated owner nothing and never offers a defeated target (D63)', async () => {
    const defeatedDragon = srdCreatureActor({
      id: DRAGON_ID,
      creature: legendaryDragon,
      featureCharges: { [legendaryActions.id]: 0 },
      currentHitPoints: 0,
      defeated: true
    })
    expect(
      await offered({ actors: [defeatedDragon, wolfActor], outgoingActorId: WOLF_ID })
    ).toEqual([])
    const deadWolf = srdCreatureActor({
      id: WOLF_ID,
      creature: wolf,
      currentHitPoints: 0,
      defeated: true
    })
    const bat = srdCreatureActor({ id: BAT_ID, creature: wolf })
    const [choice] = await offered({ actors: [dragon(), deadWolf, bat], outgoingActorId: BAT_ID })
    expect(
      choice?.options.find((option) => option.label === 'Tail Attack')?.targetActorIds
    ).toEqual([BAT_ID])
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

  it('loads no targets unless a Creature has a fixed, unscaled Feature charge pool', async () => {
    const wolves = Array.from({ length: 11 }, () =>
      srdCreatureActor({ id: crypto.randomUUID(), creature: wolf })
    )
    const loaded: string[][] = []
    const discover = (actors: readonly EncounterRunActorState[]) =>
      discoverTurnLegendaryWindows({
        spells: new Map(),
        state: srdEncounterState({ actors, currentActorId: actors[0]!.id }),
        occurrenceId: OCCURRENCE_ID,
        outgoingActorId: actors[0]!.id,
        actors,
        deadCharacterIds: new Set(),
        tokenBoundActorIds: new Set(),
        loadTargets: async (actorIds) => {
          loaded.push([...actorIds])
          return new Map(
            actors
              .filter((actor) => actorIds.includes(actor.id))
              .map((actor) => [actor.id, srdCreatureTarget(actor)])
          )
        },
        loadSystem: async () => system,
        definitions: srdDefinitions,
        createRuntime: async () => createSrdRulesRuntime()
      })
    expect(await discover(wolves)).toEqual([])
    expect(loaded).toEqual([])
    await discover([wolves[0]!, dragon()])
    expect(loaded).toHaveLength(1)
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
    resolution?: Parameters<typeof prepareTurnLegendaryActions>[0]['resolution']
    autoRollByActorId?: Readonly<Record<string, boolean>>
    /** Every die the turn rolls, as 0-based faces in request order. */
    faces?: readonly number[]
    tokenBoundActorIds?: readonly string[]
  }) {
    const state = srdEncounterState({
      actors: input.actors,
      currentActorId: WOLF_ID,
      ...(input.automationMode ? { automationMode: input.automationMode } : {})
    })
    const faces = [...(input.faces ?? [])]
    return prepareTurnLegendaryActions({
      state,
      userId: USER_ID,
      autoRollByActorId: input.autoRollByActorId ?? {},
      occurrenceId: OCCURRENCE_ID,
      root: input.turnRoot,
      ...(input.pending ? { pending: input.pending } : {}),
      ...(input.resolution ? { resolution: input.resolution } : {}),
      updatedAt: '2026-09-26T00:00:01.000Z',
      actors: input.actors,
      discoverWindows: ({ outgoingActorId, actors }) =>
        discoverWindows({
          actors,
          outgoingActorId,
          ...(input.tokenBoundActorIds ? { tokenBoundActorIds: input.tokenBoundActorIds } : {})
        }),
      // The same preparation every Encounter action runs, against each actor's current facts.
      prepareMechanics: (mechanics) =>
        prepareEncounterActionMechanics({
          ...mechanics,
          state,
          overridable: false,
          movementTargets: new Map([
            ...[mechanics.actor, mechanics.target].map(
              (actor) => [actor.id, srdCreatureTarget(actor)] as const
            ),
            ...(mechanics.movementTargets ?? [])
          ]),
          loadSource: async (source) =>
            resolveEncounterActionSource({ spells: new Map(), ...source, system: srdSystemRecord }),
          loadRelationshipFacts: async () => []
        }),
      definitions: srdDefinitions,
      createRuntime: async () => createSrdRulesRuntime(),
      random: (maximum) => {
        const face = faces.shift()
        if (face === undefined || face >= maximum) throw new Error(`Unexpected roll (d${maximum}).`)
        return face
      }
    })
  }

  /** The owner's paused Legendary Action choice and its option with this label. */
  async function pausedChoice(
    actors: readonly EncounterRunActorState[],
    label = 'Tail Attack',
    tokenBoundActorIds?: readonly string[]
  ) {
    const paused = await prepare({
      actors,
      turnRoot: root({ currentActorId: WOLF_ID }),
      ...(tokenBoundActorIds ? { tokenBoundActorIds } : {})
    })
    if (paused.kind !== 'PENDING') throw new Error('Expected the Legendary Action choice.')
    const context = paused.snapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice context.')
    const tailAttack = context.choice.options.find((option) => option.label === label)
    if (!tailAttack) throw new Error(`Expected the ${label} option.`)
    return { snapshot: paused.snapshot, context, tailAttack }
  }

  function wolfHitPoints(actors: readonly EncounterRunActorState[]) {
    const wolf = actors.find((actor) => actor.id === WOLF_ID)
    return wolf?.kind === 'CREATURE' ? wolf.currentHitPoints : undefined
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
      resolution: { kind: 'DECLINE' }
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
      actors,
      movementTargets: new Map()
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

  it('runs the Tail its Tail Attack names against the picked target, spending one Legendary Action (D51)', async () => {
    const actors = [dragon(), wolfActor]
    const { snapshot, context, tailAttack } = await pausedChoice(actors)
    // The dragon auto-rolls: a 15 hits (+17), and its Tail deals 2d8 + 10 = 1 + 2 + 10.
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: {
        kind: 'LEGENDARY_OPTION',
        optionId: tailAttack.optionId,
        targetActorId: WOLF_ID
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [14, 0, 1]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Tail Attack settles the window.')
    const [evidence] = done.root.completedLegendaryActions ?? []
    if (evidence?.resolution.kind !== 'EXECUTED') throw new Error('Expected the executed window.')
    expect(evidence.resolution).toMatchObject({
      selectedOptionId: tailAttack.optionId,
      targetActorId: WOLF_ID,
      application: {
        kind: 'ENCOUNTER_ACTOR_MECHANICS_BATCH',
        sourceApplications: [],
        sourceActorId: DRAGON_ID,
        targetActorId: WOLF_ID,
        d20: { selectedNatural: 15, resultPath: 'ON_HIT' },
        featureResourceConsumption: { cost: 1, beforeUsed: 0, afterUsed: 1 }
      }
    })
    expect(
      evidence.resolution.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
        evidence.resolution.application.applications.map((application) =>
          application.kind === 'DAMAGE'
            ? [application.requestedAmount, application.damageTypeId]
            : null
        )
    ).toEqual([[13, srdDamageTypeId('Bludgeoning')]])
    expect(wolfHitPoints(done.actors)).toBe(0)
    const settledDragon = done.actors.find((actor) => actor.id === DRAGON_ID)
    if (!settledDragon) throw new Error('Expected the dragon.')
    expect(featureChargeUsed(settledDragon, legendaryActions.id)).toBe(1)
    // Later turn stages see the wounded Wolf.
    expect(done.movementTargets.get(WOLF_ID)?.state.current).toBe(0)
  })

  it('runs the first option of the Vampire Unarmed Strike pick, since a Legendary Action cannot prompt (SPELLS-33.T4i1f)', async () => {
    const actors = [
      srdCreatureActor({
        id: DRAGON_ID,
        creature: vampire,
        featureCharges: { [vampireLegendaryActions.id]: 0 }
      }),
      wolfActor
    ]
    const { snapshot, context, tailAttack } = await pausedChoice(actors, 'Unarmed Strike')
    // A 15 hits (+9 against the Wolf's 13), and the damage option deals 1d8 + 4 = 1 + 4 bludgeoning.
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: {
        kind: 'LEGENDARY_OPTION',
        optionId: tailAttack.optionId,
        targetActorId: WOLF_ID
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [14, 0]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Unarmed Strike settles the window.')
    const [evidence] = done.root.completedLegendaryActions ?? []
    if (evidence?.resolution.kind !== 'EXECUTED') throw new Error('Expected the executed window.')
    expect(
      evidence.resolution.application.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' &&
        evidence.resolution.application.applications.map((application) =>
          application.kind === 'DAMAGE'
            ? [application.requestedAmount, application.damageTypeId]
            : null
        )
    ).toEqual([[5, srdDamageTypeId('Bludgeoning')]])
  })

  it('doubles the Tail’s damage dice on a critical hit', async () => {
    const actors = [dragon(), wolfActor]
    const { snapshot, context, tailAttack } = await pausedChoice(actors)
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: {
        kind: 'LEGENDARY_OPTION',
        optionId: tailAttack.optionId,
        targetActorId: WOLF_ID
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [19, 0, 0, 0, 0]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Tail Attack settles the window.')
    const application = done.root.completedLegendaryActions?.[0]?.resolution
    expect(application).toMatchObject({
      application: {
        d20: { selectedNatural: 20, resultPath: 'ON_CRIT' },
        applications: [{ kind: 'DAMAGE', requestedAmount: 4 + 10 }]
      }
    })
  })

  it('pauses on the owner’s attack roll and each damage die for its controllers, then settles', async () => {
    const actors = [dragon(), wolfActor]
    const { snapshot, context, tailAttack } = await pausedChoice(actors)
    const attack = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: {
        kind: 'LEGENDARY_OPTION',
        optionId: tailAttack.optionId,
        targetActorId: WOLF_ID
      }
    })
    if (attack.kind !== 'PENDING' || attack.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
      throw new Error('Expected the dragon’s attack roll.')
    expect(attack.snapshot.applicationContext).toMatchObject({
      kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
      targetActorId: WOLF_ID,
      rollerActorId: DRAGON_ID,
      d20Policy: { rollMode: 'NORMAL' }
    })
    let pending = attack
    let answer: Parameters<typeof prepare>[0]['resolution'] = {
      kind: 'ENTER_DICE',
      requestId: attack.snapshot.request.requestId,
      rawFaces: [15],
      rollMode: 'NORMAL'
    }
    for (const face of [8, 8]) {
      const next = await prepare({
        actors,
        turnRoot: context.root,
        pending: pending.snapshot,
        resolution: answer
      })
      if (next.kind !== 'PENDING' || next.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Expected a damage die.')
      expect(next.snapshot.applicationContext).toMatchObject({ d20Policy: null })
      pending = next
      answer = { kind: 'ENTER_INTEGER', requestId: next.snapshot.request.requestId, value: face }
    }
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: pending.snapshot,
      resolution: answer
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Tail Attack settles the window.')
    expect(done.root.completedLegendaryActions?.[0]?.resolution).toMatchObject({
      application: {
        d20: { rawFaces: [15] },
        applications: [{ kind: 'DAMAGE', requestedAmount: 8 + 8 + 10 }]
      }
    })
  })

  it('replays a settled window from its recorded dice, without rolling again', async () => {
    const actors = [dragon(), wolfActor]
    const { snapshot, context, tailAttack } = await pausedChoice(actors)
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: {
        kind: 'LEGENDARY_OPTION',
        optionId: tailAttack.optionId,
        targetActorId: WOLF_ID
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [14, 0, 1]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Tail Attack settles the window.')
    const decision = {
      kind: 'LEGENDARY_OPTION' as const,
      commandId: '00000000-0000-4000-8000-00000000b011',
      commandFingerprint: 'e'.repeat(64),
      actorUserId: USER_ID,
      correlationId: null,
      expectedOccurrenceVersion: 0,
      selectionChecksum: context.selectionChecksum,
      optionId: tailAttack.optionId,
      targetActorId: WOLF_ID
    }
    const replayed = await prepare({
      actors,
      turnRoot: { ...done.root, resolutionCommands: [decision] }
    })
    if (replayed.kind !== 'COMPLETE') throw new Error('The replay completes.')
    expect(replayed.root.completedLegendaryActions).toEqual(done.root.completedLegendaryActions)
    expect(wolfHitPoints(replayed.actors)).toBe(0)
    await expect(
      prepare({
        actors,
        turnRoot: {
          ...done.root,
          resolutionCommands: [{ ...decision, targetActorId: DRAGON_ID }]
        }
      })
    ).rejects.toThrow('Retained Legendary Action decision is stale.')
  })

  it('pauses a save its action forces for the target’s controllers, then applies its outcome', async () => {
    // A Giant Spider whose Legendary option runs its Bite: a hit, then a DC 11 Constitution save
    // against 2d8 poison that the Wolf rolls (ADR 0034 decision 3).
    const giantSpider = srdByLabel(SRD.creatures, 'Giant Spider')
    const bite = creatureFeature(giantSpider, 'Bite')
    const spiderLegendary = {
      ...legendaryActions,
      options: [
        {
          id: '00000000-0000-4000-8000-00000000b021',
          label: 'Bite',
          description: 'The spider makes one bite attack.',
          order: 1,
          actionReference: { featureId: bite.id, chargeCost: 1 }
        }
      ]
    }
    const spider = srdCreatureActor({
      id: DRAGON_ID,
      creature: { ...giantSpider, features: [...(giantSpider.features ?? []), spiderLegendary] },
      featureCharges: { [spiderLegendary.id]: 0 }
    })
    const actors = [spider, wolfActor]
    const { snapshot, context, tailAttack: option } = await pausedChoice(actors, 'Bite')
    // The spider auto-rolls its hit (a 19) and its 1d8 + 3 piercing (a 4); the Wolf's save waits.
    const save = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: { kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: WOLF_ID },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [18, 3]
    })
    if (save.kind !== 'PENDING' || save.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
      throw new Error('Expected the Wolf’s save.')
    expect(save.snapshot.applicationContext).toMatchObject({
      rollerActorId: WOLF_ID,
      d20Policy: { dc: 11 }
    })
    // A natural 1 fails: 2d8 poison rolls 1 and 2.
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: save.snapshot,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: save.snapshot.request.requestId,
        rawFaces: [1],
        rollMode: 'NORMAL'
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [0, 1]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Bite settles the window.')
    expect(done.root.completedLegendaryActions?.[0]?.resolution).toMatchObject({
      application: {
        nestedD20: { selectedNatural: 1, resultPath: 'ON_SAVE_FAIL' },
        applications: [
          { kind: 'DAMAGE', requestedAmount: 4 + 3 },
          { kind: 'DAMAGE', requestedAmount: 1 + 2 }
        ]
      }
    })
  })

  it('offers and runs a free save option that spends the pool, as the SRD authors Wing Attack', async () => {
    // The SRD Wing Attack keeps its FREE activation, Legendary charge cost, save, damage and prone,
    // but targets one creature within 15 feet instead of its area, which the turn delegates.
    const wingAttack = srdLegendaryActions.options?.find((option) =>
      option.label.startsWith('Wing Attack')
    )
    const [effect] = wingAttack?.effects ?? []
    if (!wingAttack || effect?.invocation.kind !== 'ACTION')
      throw new Error('Expected the SRD Wing Attack action.')
    const { shape: _area, ...invocation } = effect.invocation
    const singleTargetWing = {
      ...wingAttack,
      effects: [
        {
          ...effect,
          invocation: {
            ...invocation,
            range: {
              id: effect.invocation.range.id,
              rangeKind: 'DISTANCE' as const,
              amount: 15,
              unit: 'FEET' as const
            },
            targeting: { selectionKind: 'SINGLE_TARGET' as const, dispositionKind: 'ANY' as const }
          }
        }
      ]
    }
    const wingDragon = srdCreatureActor({
      id: DRAGON_ID,
      creature: {
        ...ancientRedDragon,
        features: ancientRedDragon.features?.map((feature) =>
          feature.id === srdLegendaryActions.id
            ? { ...feature, options: [singleTargetWing] }
            : feature
        )
      },
      featureCharges: { [srdLegendaryActions.id]: 0 }
    })
    const actors = [wingDragon, wolfActor]
    const { snapshot, context, tailAttack: option } = await pausedChoice(actors, wingAttack.label)
    // Any creature may be its target, the dragon included (D99).
    expect(option).toMatchObject({
      targetActorIds: [DRAGON_ID, WOLF_ID],
      featureCost: 2,
      poolRemaining: 1
    })
    const save = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: { kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: WOLF_ID }
    })
    if (save.kind !== 'PENDING' || save.snapshot.snapshotKind !== 'KERNEL_EVIDENCE')
      throw new Error('Expected the Wolf’s save.')
    expect(save.snapshot.applicationContext).toMatchObject({
      rollerActorId: WOLF_ID,
      d20Policy: { dc: 25 }
    })
    // A natural 1 fails: 2d6 + 10 bludgeoning rolls 1 and 2.
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: save.snapshot,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: save.snapshot.request.requestId,
        rawFaces: [1],
        rollMode: 'NORMAL'
      },
      autoRollByActorId: { [DRAGON_ID]: true },
      faces: [0, 1]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The Wing Attack settles the window.')
    expect(done.root.completedLegendaryActions?.[0]?.resolution).toMatchObject({
      application: {
        featureResourceConsumption: { cost: 2, beforeUsed: 0, afterUsed: 2 },
        applications: [
          {
            kind: 'DAMAGE',
            requestedAmount: 1 + 2 + 10,
            damageTypeId: srdDamageTypeId('Bludgeoning')
          },
          { kind: 'CONDITION_APPLY', conditionId: srdCondition('Prone') }
        ]
      }
    })
    const settledDragon = done.actors.find((actor) => actor.id === DRAGON_ID)
    if (!settledDragon) throw new Error('Expected the dragon.')
    expect(featureChargeUsed(settledDragon, srdLegendaryActions.id)).toBe(2)
  })

  it('delegates the SRD Wing Attack area to its own root, ending the turn’s windows unspent', async () => {
    const srdDragon = srdCreatureActor({
      id: DRAGON_ID,
      creature: ancientRedDragon,
      featureCharges: { [srdLegendaryActions.id]: 0 }
    })
    const actors = [srdDragon, wolfActor]
    const tokenBoundActorIds = [DRAGON_ID]
    const {
      snapshot,
      context,
      tailAttack: wing
    } = await pausedChoice(actors, 'Wing Attack (Costs 2 Actions)', tokenBoundActorIds)
    // Its area names no creature, so the owner stands for it; another target is a stale choice.
    await expect(
      prepare({
        actors,
        turnRoot: context.root,
        pending: snapshot,
        resolution: { kind: 'LEGENDARY_OPTION', optionId: wing.optionId, targetActorId: WOLF_ID },
        tokenBoundActorIds
      })
    ).rejects.toThrow('Legendary Action choice is stale.')
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: snapshot,
      resolution: { kind: 'LEGENDARY_OPTION', optionId: wing.optionId, targetActorId: DRAGON_ID },
      tokenBoundActorIds
    })
    if (done.kind !== 'COMPLETE') throw new Error('The delegation settles the window.')
    expect(done.root.legendaryActionQueue).toBeUndefined()
    expect(done.root.completedLegendaryActions).toEqual([
      {
        choice: context.choice,
        selectionChecksum: checksumRuleDocument(context.choice),
        resolution: { kind: 'DELEGATED', selectedOptionId: wing.optionId }
      }
    ])
    expect(delegatedLegendaryOption(done.root)).toEqual(wing)
    // The delegated root spends the charges and rolls the saves, so the turn changes no one.
    expect(done.actors).toEqual(actors)
  })

  it('checks each owner again before its window, after earlier windows this turn (D51)', async () => {
    // A first owner whose Legendary option runs a Tail that stuns on a hit, and the dragon after it.
    const tail = creatureFeature(ancientRedDragon, 'Tail')
    const [tailEffect] = tail.effects ?? []
    const [hitPath] = tailEffect?.paths ?? []
    if (!tailEffect || !hitPath || !('resultBlock' in hitPath) || !hitPath.resultBlock)
      throw new Error('Expected the Tail hit path.')
    const { resultBlock } = hitPath
    const stunningTail = {
      ...tail,
      effects: [
        {
          ...tailEffect,
          paths: [
            {
              ...hitPath,
              resultBlock: {
                ...resultBlock,
                outcomes: [
                  {
                    id: '00000000-0000-4000-8000-00000000b031',
                    effectKind: 'CONDITION' as const,
                    conditionId: srdCondition('Stunned')
                  }
                ]
              }
            }
          ]
        }
      ]
    }
    const stunner = srdCreatureActor({
      id: '00000000-0000-4000-8000-00000000a001',
      creature: {
        ...legendaryDragon,
        features: legendaryDragon.features?.map((feature) =>
          feature.id === tail.id ? stunningTail : feature
        )
      },
      featureCharges: { [legendaryActions.id]: 0 }
    })
    const actors = [stunner, dragon(), wolfActor]
    const first = await prepare({ actors, turnRoot: root({ currentActorId: WOLF_ID }) })
    if (first.kind !== 'PENDING') throw new Error('Expected the first owner’s choice.')
    const context = first.snapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice context.')
    expect(context.root.legendaryActionQueue?.ownerActorIds).toEqual([stunner.id, DRAGON_ID])
    const option = context.choice.options.find((entry) => entry.label === 'Tail Attack')
    if (!option) throw new Error('Expected the stunning Tail Attack.')
    // A natural 19 hits and stuns the dragon, so its window is never offered.
    const done = await prepare({
      actors,
      turnRoot: context.root,
      pending: first.snapshot,
      resolution: { kind: 'LEGENDARY_OPTION', optionId: option.optionId, targetActorId: DRAGON_ID },
      autoRollByActorId: { [stunner.id]: true },
      faces: [18]
    })
    if (done.kind !== 'COMPLETE') throw new Error('The stunned dragon gets no window.')
    expect(done.root.completedLegendaryActions?.map((entry) => entry.choice.ownerActorId)).toEqual([
      stunner.id
    ])
  })
  it('refuses a retained decision, or a decline, once its owner can no longer act', async () => {
    const actors = [dragon({ used: 1 }), wolfActor]
    const incapacitated = [
      dragon({ used: 1, conditions: [srdCondition('Incapacitated')] }),
      wolfActor
    ]
    const paused = await prepare({ actors, turnRoot: root({ currentActorId: DRAGON_ID }) })
    if (paused.kind !== 'PENDING') throw new Error('Expected the Legendary Action choice.')
    const context = paused.snapshot.applicationContext
    if (context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
      throw new Error('Expected a Legendary Action choice context.')
    await expect(
      prepare({
        actors: incapacitated,
        turnRoot: context.root,
        pending: paused.snapshot,
        resolution: { kind: 'DECLINE' }
      })
    ).rejects.toThrow('Legendary Action choice is stale.')
    const declined = await prepare({
      actors,
      turnRoot: context.root,
      pending: paused.snapshot,
      resolution: { kind: 'DECLINE' }
    })
    if (declined.kind !== 'COMPLETE') throw new Error('A declined window completes the turn.')
    await expect(prepare({ actors: incapacitated, turnRoot: declined.root })).rejects.toThrow(
      'Retained Legendary Action owner is stale.'
    )
  })

  it('stages the incoming actor’s spent action allowance and refuses a different staged refresh', async () => {
    const spent = encounterRunActorStateSchema.parse({
      ...wolfActor,
      resources: withEncounterRuleUsageUsed(wolfActor, SRD_ACTION_ALLOWANCE_DEFINITION_ID, 1)
    })
    const allowance = await srdDefinitions.requireCurrent(SRD_ACTION_ALLOWANCE_DEFINITION_ID)
    const turnRoot = root({ currentActorId: WOLF_ID })
    const staged = await prepare({ actors: [spent], turnRoot })
    if (staged.kind !== 'COMPLETE') throw new Error('A turn without owners completes.')
    const refreshes = [
      {
        ordinal: 0,
        actorId: WOLF_ID,
        capabilityDefinitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
        definitionVersion: allowance.version,
        definitionChecksum: allowance.checksum,
        beforeUsed: 1,
        afterUsed: 0 as const
      }
    ]
    expect(staged.root.stagedActionEconomyRefreshes).toEqual(refreshes)
    expect(staged.root.stagedLegendaryActionRefreshes).toBeUndefined()
    const refreshed = staged.actors.find((actor) => actor.id === WOLF_ID)
    if (!refreshed) throw new Error('Expected the incoming actor.')
    expect(encounterRuleUsageUsed(refreshed, SRD_ACTION_ALLOWANCE_DEFINITION_ID)).toBe(0)
    // A replay of the same root reproduces the staged refresh exactly.
    const replay = await prepare({ actors: [spent], turnRoot: staged.root })
    if (replay.kind !== 'COMPLETE') throw new Error('A replayed turn completes.')
    expect(replay.root.stagedActionEconomyRefreshes).toEqual(refreshes)
    await expect(
      prepare({
        actors: [spent],
        turnRoot: {
          ...staged.root,
          stagedActionEconomyRefreshes: [{ ...refreshes[0]!, beforeUsed: 2 }]
        }
      })
    ).rejects.toThrow('Action-economy refresh is stale.')
  })

  it('refuses a target the option does not offer', async () => {
    const actors = [dragon(), wolfActor]
    const { snapshot, context, tailAttack } = await pausedChoice(actors)
    await expect(
      prepare({
        actors,
        turnRoot: context.root,
        pending: snapshot,
        resolution: {
          kind: 'LEGENDARY_OPTION',
          optionId: tailAttack.optionId,
          targetActorId: DRAGON_ID
        }
      })
    ).rejects.toThrow('Legendary Action target is unavailable.')
  })
})
