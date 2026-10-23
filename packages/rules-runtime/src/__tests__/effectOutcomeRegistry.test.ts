import { describe, expect, it } from 'vitest'

import { serverPublishedRuleDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument, type RuleGraphDefinition } from '@artificer-toolkit/shared/rules'
import { SRD_ABILITIES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { executeNativeActionGraphs } from '../encounterActionExecution.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import {
  effectOutcomeProposalNode,
  effectOutcomeProposalOutputs
} from '../effectOutcomeRegistry.js'
import { createPlatformRulesRuntime } from '../platformRulesRuntime.js'
import { executionAddsSpeedToMovement } from '../systems/dnd5e/addSpeedToMovement.js'
import { executionCancelsTriggeringEvent } from '../systems/dnd5e/cancelTriggeringEvent.js'
import { dnd5eAddedDiceNode } from '../systems/dnd5e/d20AddedDiceGraph.js'
import { DND5E_SAVE_TEST_OPERATION_KEY } from '../systems/dnd5e/dnd5eTestOperationKeys.js'
import {
  DND5E_CONDITION_IMMUNE_FACT_KEYS,
  DND5E_EFFECT_ACTION_FAMILY_KEY,
  DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_SAVE_MODIFIER_FACT_KEY,
  DND5E_TARGET_ACTOR_FACT_KEY,
  DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY,
  DND5E_TARGET_STATE_CHECKSUM_FACT_KEY,
  DND5E_TEST_OUTCOME_RULE_FACT_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION,
  DND5E_EFFECT_OUTCOMES,
  dnd5eOutcomeDefinition,
  type Dnd5eRegisteredOutcome
} from '../systems/dnd5e/effectActionOutcomes.js'
import {
  dnd5ePathGatedTargetProposalOperations,
  dnd5eTestDamageProposalOperation
} from '../systems/dnd5e/effectActionOperationRegistry.js'
import { executionTeleportAllowance } from '../systems/dnd5e/teleportAllowance.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD_SYSTEM_ID as DND5E_SYSTEM_ID, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { FIRE_DAMAGE_TYPE_ID, PRONE_CONDITION_ID } from './encounterActiveEffectFixtures.js'

const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
const STRENGTH = SRD_ABILITIES.find(({ code }) => code === 'STRENGTH')!.id
const TARGET_ID = testUuid(0x6c10)
const DEFINITION_ID = testUuid(0x6c11)
const OCCURRENCE_ID = testUuid(0x6c12)
/** Out of reach of any d20 total, so every target fails the save. */
const UNSAVEABLE_DC = 99
const TARGET = {
  targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
  targetStateChecksum: { kind: 'FACT', factKey: DND5E_TARGET_STATE_CHECKSUM_FACT_KEY }
} as const

/**
 * One outcome of every kind a path-gated proposal applies, with the application it settles on the
 * target, or null when its owner (the room or the triggering event) acts on the authorized proposal.
 */
const PATH_GATED_OUTCOMES: readonly [Dnd5eRegisteredOutcome, string | null][] = [
  [{ kind: 'HEAL', amount: 5 }, 'HEAL'],
  [{ kind: 'TEMPORARY_HIT_POINTS', amount: 5 }, 'TEMPORARY_HIT_POINTS'],
  [{ kind: 'DAMAGE', amount: 4, damageTypeId: FIRE_DAMAGE_TYPE_ID }, 'DAMAGE'],
  [{ kind: 'CONDITION_APPLY', conditionId: PRONE_CONDITION_ID }, 'CONDITION_APPLY'],
  [
    {
      kind: 'SCALAR_REDUCTION',
      amount: 1,
      valueDefinitionId: STRENGTH,
      recoveryTriggers: ['LONG_REST'],
      terminalConsequence: 'TARGET_DIED'
    },
    'SCALAR_REDUCTION'
  ],
  [{ kind: 'STABILIZE' }, 'STABILIZE'],
  [{ kind: 'KILL' }, 'KILL'],
  [{ kind: 'REVIVE', hitPoints: { kind: 'FIXED', amount: 1 } }, 'REVIVE'],
  [{ kind: 'DEPART' }, 'DEPART'],
  [{ kind: 'MANUAL_ADJUDICATION' }, null],
  [{ kind: 'ADD_SPEED_TO_MOVEMENT' }, null],
  [{ kind: 'TELEPORT_ALLOWANCE', maxFeet: 30, destinationKind: 'VISIBLE' }, null],
  [{ kind: 'CANCEL_TRIGGERING_EVENT' }, null]
]

function publish(graph: RuleGraphDefinition) {
  return serverPublishedRuleDefinitionDtoSchema.parse({
    id: DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    checksum: checksumRuleDocument(graph),
    definition: graph
  })
}

function graphOf(
  nodes: RuleGraphDefinition['nodes'],
  outputs: RuleGraphDefinition['outputs']
): RuleGraphDefinition {
  return {
    schemaVersion: 1,
    id: DEFINITION_ID,
    gameSystemId: DND5E_SYSTEM_ID,
    definitionFamilyKey: DND5E_EFFECT_ACTION_FAMILY_KEY,
    nodes,
    outputs
  }
}

/** The outcome proposed with no test. */
function directGraph(outcome: Dnd5eRegisteredOutcome) {
  const definition = dnd5eOutcomeDefinition(outcome.kind)
  return graphOf(
    [
      effectOutcomeProposalNode({
        id: 'proposal',
        definition,
        outcome,
        context: { conditionImmuneFactKey: DND5E_TARGET_CONDITION_IMMUNE_FACT_KEY },
        target: TARGET,
        phase: { kind: 'DIRECT', contractVersion: 1 }
      })
    ],
    effectOutcomeProposalOutputs(definition, 'proposal')
  )
}

/** A Constitution save whose outcome is proposed, gated on the save's result path, on `authoredPath`. */
function saveGraph(
  outcome: Dnd5eRegisteredOutcome,
  authoredPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
) {
  return graphOf(
    [
      {
        id: 'd20',
        operation: { key: 'evidence.integer-range', contractVersion: 1 },
        inputs: { min: { kind: 'LITERAL', value: 1 }, max: { kind: 'LITERAL', value: 20 } }
      },
      dnd5eAddedDiceNode('d20'),
      {
        id: 'test',
        operation: { key: DND5E_SAVE_TEST_OPERATION_KEY, contractVersion: 3 },
        inputs: {
          targetActorId: { kind: 'FACT', factKey: DND5E_TARGET_ACTOR_FACT_KEY },
          naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'd20', port: 'value' },
          addedTotal: { kind: 'NODE_OUTPUT', nodeId: 'd20-added-dice', port: 'value' },
          modifier: { kind: 'FACT', factKey: DND5E_SAVE_MODIFIER_FACT_KEY },
          threshold: { kind: 'FACT', factKey: DND5E_SAVE_DC_FACT_KEY },
          contributorChecksum: { kind: 'FACT', factKey: DND5E_ROLL_CONTRIBUTOR_CHECKSUM_FACT_KEY },
          outcomeRule: { kind: 'FACT', factKey: DND5E_TEST_OUTCOME_RULE_FACT_KEY }
        }
      },
      effectOutcomeProposalNode({
        id: `proposal-${authoredPath.toLowerCase()}`,
        definition: dnd5eOutcomeDefinition(outcome.kind),
        outcome,
        context: { conditionImmuneFactKey: DND5E_CONDITION_IMMUNE_FACT_KEYS[authoredPath] },
        target: TARGET,
        phase: {
          kind: 'PATH_GATED',
          resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
          authoredPath
        }
      })
    ],
    {
      targetActorId: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'targetActorId' },
      naturalD20: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'naturalD20' },
      total: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'total' },
      resultPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
      contributorChecksum: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'contributorChecksum' }
    }
  )
}

/** Runs one graph against a dying target that cannot make its save, through the native action executor. */
function run(graph: RuleGraphDefinition) {
  return executeNativeActionGraphs({
    runtime: createPlatformRulesRuntime({
      definitions: {
        async requireCurrent() {
          throw new Error('Definitions are not used by sealed graphs.')
        }
      }
    }),
    adapter: dnd5eCharacterRuleActionSystemAdapter,
    plan: { kind: 'SINGLE_GRAPH', published: publish(graph) },
    occurrenceId: OCCURRENCE_ID,
    binding: {
      actionMechanic: {
        attackBonus: null,
        attackKind: null,
        attackAbility: null,
        attackRollMode: 'NORMAL',
        save: { abilityDefinitionId: CONSTITUTION, dc: UNSAVEABLE_DC },
        outcomes: []
      },
      sourceDerivedFacts: {},
      targetActorId: TARGET_ID,
      targetDerivedFacts: {
        statBlock: { armorClass: 12 },
        savingThrowDefinitions: [
          { abilityDefinitionId: CONSTITUTION, modifier: 0, rollMode: 'NORMAL', contributors: [] }
        ]
      },
      targetConditionIds: [],
      currentHitPoints: 0,
      temporaryHitPoints: 0,
      maximumHitPoints: 20,
      targetScalarValues: { [STRENGTH]: 10 },
      defenses: []
    },
    afterTest: async () => undefined
  })
}

function proposalAuthorized(
  execution: Awaited<ReturnType<typeof run>>['execution'],
  nodeId: string
) {
  return execution.evidence.trace.find((trace) => trace.nodeId === nodeId)?.outputs.authorized
}

describe('the effect outcome registry (RULES-2.T6c1)', () => {
  it('registers one definition per outcome kind, each with its own direct proposal', () => {
    for (const [kind, definition] of Object.entries(DND5E_EFFECT_OUTCOMES))
      expect(definition.operationKey, kind).toMatch(/^dnd5e\./)
  })

  it('maps every path-gated proposal to an installed operation and back to its direct proposal', () => {
    const installed = new Set([
      ...dnd5ePathGatedTargetProposalOperations.map(({ key }) => key),
      ...DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.keys()
    ])
    for (const [outcome] of PATH_GATED_OUTCOMES) {
      const definition = dnd5eOutcomeDefinition(outcome.kind)
      expect(definition.pathGatedOperationKey).not.toBeNull()
      expect(installed.has(definition.pathGatedOperationKey!)).toBe(true)
      expect(
        DND5E_DIRECT_OPERATION_BY_PATH_GATED_OPERATION.get(definition.pathGatedOperationKey!)
      ).toBe(definition.operationKey)
    }
  })

  it.each([
    'MODIFIER_GRANT',
    'ACTOR_LINK',
    'CREATURE_FORM',
    'CONCEAL',
    'DETECT_CONCEALED'
  ] as const)(
    'has no path-gated %s, which its active-effect plan carries behind a result gate',
    (kind) => {
      expect(dnd5eOutcomeDefinition(kind).pathGatedOperationKey).toBeNull()
      expect(() =>
        effectOutcomeProposalNode({
          id: 'proposal-on_save_fail',
          definition: dnd5eOutcomeDefinition(kind),
          outcome: { kind },
          context: { conditionImmuneFactKey: undefined },
          target: TARGET,
          phase: {
            kind: 'PATH_GATED',
            resolvedPath: { kind: 'NODE_OUTPUT', nodeId: 'test', port: 'resultPath' },
            authoredPath: 'ON_SAVE_FAIL'
          }
        })
      ).toThrow('An outcome without a path-gated proposal cannot follow a test.')
    }
  )

  describe.each(PATH_GATED_OUTCOMES)('%o', (outcome, application) => {
    it('applies when proposed directly', async () => {
      const { applications, execution } = await run(directGraph(outcome))
      expect(proposalAuthorized(execution, 'proposal')).toBe(true)
      expect(applications.map(({ kind }) => kind)).toEqual(application ? [application] : [])
    })

    it('applies when the save resolves to its authored path', async () => {
      const { applications, execution } = await run(saveGraph(outcome, 'ON_SAVE_FAIL'))
      expect(proposalAuthorized(execution, 'proposal-on_save_fail')).toBe(true)
      expect(applications).toMatchObject(
        application
          ? [
              {
                kind: application,
                authoredPath: 'ON_SAVE_FAIL',
                resolvedPath: 'ON_SAVE_FAIL',
                sourceOperationKey: dnd5eOutcomeDefinition(outcome.kind).pathGatedOperationKey
              }
            ]
          : []
      )
    })

    it('applies nothing when the save resolves to another path', async () => {
      const { applications, execution } = await run(saveGraph(outcome, 'ON_SAVE_SUCCESS'))
      expect(proposalAuthorized(execution, 'proposal-on_save_success')).toBe(false)
      expect(applications).toEqual([])
    })
  })
})

type AuthoredEffect = Parameters<typeof compileEffect>[0]

/** An authored Constitution save of one target whose failure has one outcome. */
function saveEffect(outcome: Record<string, unknown>): AuthoredEffect {
  return {
    id: ACTION_EFFECT_ID,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.SAVING_THROW,
      savingThrow: {
        id: testUuid(0x6c20),
        dcMethod: 'FIXED_DC',
        abilityDefinitionId: CONSTITUTION,
        baseDc: 13
      },
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: testUuid(0x6c21), rangeKind: RANGE_KIND.UNLIMITED },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: testUuid(0x6c22),
        order: 1,
        pathCode: PATH_CODE.ON_SAVE_FAIL,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: testUuid(0x6c23),
          resultKind: 'SINGLE',
          outcomes: [{ id: testUuid(0x6c24), ...outcome }]
        }
      }
    ]
  } as AuthoredEffect
}

/** Compiles an authored Effect the way a Character action is compiled. */
function compileAction(effect: AuthoredEffect) {
  const action = { ...characterActionDescriptor(compileEffect(effect)), conditionDefinitionIds: [] }
  return dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan!({
    action,
    compilerSource: buildCompiledActionCompilerSource(action)
  })
}

describe('outcomes under a test (RULES-2.T6c2)', () => {
  it.each([
    ['STABILIZE', { effectKind: EFFECT_KIND.STABILIZE, requiresZeroHitPoints: true }],
    [
      'MANUAL_ADJUDICATION',
      {
        effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
        label: 'Ruling',
        reasonCode: 'GM_CHOICE',
        instructions: 'The GM rules the result.'
      }
    ],
    [
      'ADD_SPEED_TO_MOVEMENT',
      { effectKind: EFFECT_KIND.MOVEMENT_RULE, ruleKind: 'ADD_SPEED_TO_MOVEMENT' }
    ],
    ['DEPART', { effectKind: 'TELEPORT', targetKind: 'TARGET', destinationKind: 'LINKED_LOCATION' }]
  ])('compiles a failed save that proposes %s', (_kind, outcome) => {
    const plan = compileAction(saveEffect(outcome))
    expect(plan.kind).toBe('TEST_OUTCOME')
    if (plan.kind !== 'TEST_OUTCOME') return
    expect(plan.outcomes.map(({ pathCode }) => pathCode)).toEqual(['ON_SAVE_FAIL'])
  })

  it('compiles a single target sent away with no test as a departure', () => {
    const effect = saveEffect({
      effectKind: 'TELEPORT',
      targetKind: 'TARGET',
      destinationKind: 'SPECIAL'
    })
    const plan = compileAction({
      ...effect,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: { id: testUuid(0x6c21), rangeKind: RANGE_KIND.UNLIMITED },
        targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
      },
      paths: effect.paths.map((path) => ({ ...path, pathCode: PATH_CODE.ON_USE }))
    } as AuthoredEffect)
    expect(plan.kind).toBe('SINGLE_GRAPH')
    if (plan.kind !== 'SINGLE_GRAPH') return
    expect(plan.published.definition.nodes.map(({ operation }) => operation.key)).toContain(
      dnd5eOutcomeDefinition('DEPART').operationKey
    )
  })

  it.each([
    [
      { effectKind: 'TELEPORT', targetKind: 'SELF', destinationKind: 'VISIBLE' },
      "D&D self teleport takes its reach from a self-targeted action's range, which a test action does not have."
    ],
    [
      { effectKind: EFFECT_KIND.CANCEL_TRIGGERING_EVENT },
      'D&D cancel-triggering-event outcome belongs to a spell-cast reaction.'
    ],
    [
      { effectKind: 'TELEPATHIC_LINK' },
      "D&D ACTOR_LINK under a test must be one bounded effect its active-effect plan carries on the test's result path."
    ],
    [
      { effectKind: EFFECT_KIND.CONCEAL_FROM_OBSERVERS, observers: 'NON_ALLIES' },
      "D&D CONCEAL is settled from its holder's own check total, which an attack or a saving throw never produces."
    ],
    [
      { effectKind: EFFECT_KIND.DETECT_CONCEALED },
      "D&D DETECT_CONCEALED is settled from its holder's own check total, which an attack or a saving throw never produces."
    ]
  ])('refuses %o under a test for its genuine reason', (outcome, message) => {
    expect(() => compileAction(saveEffect(outcome))).toThrow(message)
  })

  type Execution = Awaited<ReturnType<typeof run>>['execution']
  it.each<[string, Dnd5eRegisteredOutcome, (execution: Execution) => boolean]>([
    ['ADD_SPEED_TO_MOVEMENT', { kind: 'ADD_SPEED_TO_MOVEMENT' }, executionAddsSpeedToMovement],
    [
      'CANCEL_TRIGGERING_EVENT',
      { kind: 'CANCEL_TRIGGERING_EVENT' },
      executionCancelsTriggeringEvent
    ],
    [
      'TELEPORT_ALLOWANCE',
      { kind: 'TELEPORT_ALLOWANCE', maxFeet: 30, destinationKind: 'VISIBLE' },
      (execution) => executionTeleportAllowance(execution) !== null
    ]
  ])(
    'commits %s only when the save resolves to its authored path',
    async (_kind, outcome, commits) => {
      const direct = await run(directGraph(outcome))
      const authored = await run(saveGraph(outcome, 'ON_SAVE_FAIL'))
      const other = await run(saveGraph(outcome, 'ON_SAVE_SUCCESS'))
      expect(commits(direct.execution)).toBe(true)
      expect(commits(authored.execution)).toBe(true)
      expect(commits(other.execution)).toBe(false)
    }
  )
})

describe('a path-gated damage proposal (RULES-2.T6d2)', () => {
  // SRD: "half as much damage on a successful one" — half of a rolled 1 rounds down to 0.
  it('proposes the 0 damage a made save leaves of a halved roll of 1', () => {
    expect(
      dnd5eTestDamageProposalOperation.execute({
        targetActorId: TARGET_ID,
        resolvedPath: 'ON_SAVE_SUCCESS',
        authoredPath: 'ON_SAVE_SUCCESS',
        targetStateChecksum: 'a'.repeat(64),
        amount: 0,
        damageTypeId: 'poison'
      })
    ).toMatchObject({ authorized: true, applicationCandidate: true, amount: 0 })
  })
})
