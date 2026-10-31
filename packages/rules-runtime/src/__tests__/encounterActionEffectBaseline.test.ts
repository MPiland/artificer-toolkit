import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { crocodile } from '@artificer-toolkit/source-data/srd/creatures/crocodile.js'
import { giantInsect } from '@artificer-toolkit/source-data/srd/spells/giant-insect.js'
import { telepathicBond } from '@artificer-toolkit/source-data/srd/spells/telepathic-bond.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import {
  SRD_ABILITIES,
  SRD_CONDITION_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { ActorRelationshipAuthored } from '@artificer-toolkit/shared/authored'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import type { EncounterFeatureActionCapabilityDescriptor } from '../encounterFeatureActionCapabilityDiscovery.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import {
  DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY,
  DND5E_DAMAGE_TOTAL_OPERATION_KEY,
  DND5E_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY,
  DND5E_SAVE_DC_FACT_KEY,
  DND5E_TEST_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const ids = {
  encounter: '00000000-0000-4000-8000-000000000901',
  occurrence: '00000000-0000-4000-8000-000000000902',
  command: '00000000-0000-4000-8000-000000000903',
  target: '00000000-0000-4000-8000-000000000904',
  source: '00000000-0000-4000-8000-000000000905'
} as const

const rugIds = {
  breathing: '00000000-0000-4000-8000-000000009801',
  blinded: '00000000-0000-4000-8000-000000009802',
  grappled: '00000000-0000-4000-8000-000000009803',
  restrained: '00000000-0000-4000-8000-000000009804',
  actor: '00000000-0000-4000-8000-000000009831',
  creature: '00000000-0000-4000-8000-000000009832',
  feature: '00000000-0000-4000-8000-000000009833',
  effect: '00000000-0000-4000-8000-000000009834',
  sourceVersion: '00000000-0000-4000-8000-000000009835',
  attack: '00000000-0000-4000-8000-000000009836',
  relationship: '00000000-0000-4000-8000-000000009838',
  moduleA: '00000000-0000-4000-8000-000000009841',
  moduleB: '00000000-0000-4000-8000-000000009842',
  moduleC: '00000000-0000-4000-8000-000000009843',
  conditionA: '00000000-0000-4000-8000-000000009844',
  conditionB: '00000000-0000-4000-8000-000000009845',
  conditionC: '00000000-0000-4000-8000-000000009846',
  recurrenceDamage: '00000000-0000-4000-8000-000000009847',
  bludgeoning: '00000000-0000-4000-8000-000000009807'
} as const

type RelationshipDefinition = Extract<
  NonNullable<
    ReturnType<typeof prepareEncounterActionEffectPlans>['recurringEffect']
  >['definition'],
  { schemaVersion: 2 }
>

type RecurrenceOverrides = Partial<
  Pick<
    NonNullable<ActorRelationshipAuthored['recurrence']>,
    'turnAnchor' | 'savingThrow' | 'outcome'
  >
>

function rugSmotherCapability(heldAtOnce = 1, recurrence: RecurrenceOverrides = {}) {
  const compiledEffect = compileEffect({
    id: rugIds.effect,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: { id: rugIds.attack, rangeKind: RANGE_KIND.DISTANCE, amount: 5, unit: 'FEET' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
    },
    paths: [
      {
        id: rugIds.attack,
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: PATH_GROUP_TYPE.SEQUENTIAL,
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${rugIds.attack}-result`,
          resultKind: 'SEQUENCE',
          outcomes: [
            {
              id: rugIds.relationship,
              effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
              heldAtOnce,
              modules: [
                {
                  id: rugIds.moduleA,
                  order: 1,
                  kind: 'TARGET_SIZE_MAXIMUM',
                  sizeCode: 'MEDIUM'
                },
                {
                  id: rugIds.moduleC,
                  order: 3,
                  kind: 'TARGET_CAPABILITY_SUPPRESSION',
                  capabilityDefinitionIds: [rugIds.breathing]
                }
              ],
              conditions: [
                {
                  id: rugIds.conditionA,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: rugIds.grappled
                },
                {
                  id: rugIds.conditionB,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: rugIds.restrained
                },
                {
                  id: rugIds.conditionC,
                  effectKind: EFFECT_KIND.CONDITION,
                  conditionId: rugIds.blinded
                }
              ],
              recurrence: {
                turnAnchor: { actor: 'TARGET', boundary: 'START_OF_TURN' },
                outcome: {
                  id: rugIds.recurrenceDamage,
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: rugIds.bludgeoning,
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '2d6+3'
                },
                ...recurrence
              }
            }
          ]
        }
      }
    ]
  })
  return {
    kind: 'ENCOUNTER_FEATURE',
    label: 'RUG_SMOTHER',
    grip: null,
    spellCast: null,
    encounterActorId: rugIds.actor,
    creatureSourceId: rugIds.creature,
    gameSystemId: DND5E_SYSTEM_ID,
    authoredRootKind: 'effect',
    entryPointDefinitionId: rugIds.effect,
    effectId: rugIds.effect,
    actionId: `${rugIds.feature}:ACTION:${rugIds.effect}`,
    sourceId: rugIds.feature,
    mechanicFacts: normalizeCharacterActionMechanicFacts(compiledEffect),
    conditionDefinitionIds: [rugIds.grappled, rugIds.restrained, rugIds.blinded],
    savingThrowAbilityDefinitionId: null,
    compiledEffect,
    ownerFeatureId: rugIds.feature,
    featureOptionId: null,
    actionFeatureId: null,
    ownerRuleDefinitionIds: [],
    optionRuleDefinitionIds: [],
    sourceRevision: 1,
    sourceVersionId: rugIds.sourceVersion,
    sourceChecksum: 'a'.repeat(64),
    authoredEffectChecksum: checksumRuleDocument(compiledEffect),
    compiledEffectChecksum: checksumRuleDocument(compiledEffect),
    featureResourceUse: null,
    spellSlotUse: null,
    spellSaveDc: null,
    equipmentBinding: null,
    attackMechanic: {
      rollDefinitionId: rugIds.attack,
      attackBonus: 5,
      damageBonus: 0,
      rollMode: 'NORMAL',
      definitionChecksum: checksumRuleDocument({
        kind: 'RUG_SMOTHER',
        abilityScores: { STRENGTH: 17 }
      })
    }
  } satisfies EncounterFeatureActionCapabilityDescriptor
}

function fixturePlan(authoredPath: 'ON_HIT' | 'ON_CRIT' = 'ON_HIT', heldAtOnce = 1) {
  const fixture = rugSmotherCapability(heldAtOnce)
  const capability = {
    ...fixture,
    compiledEffect: {
      ...fixture.compiledEffect,
      entries: fixture.compiledEffect.entries.map((entry) =>
        'outcome' in entry && entry.outcome.effectKind === 'ACTOR_RELATIONSHIP'
          ? { ...entry, pathCode: authoredPath }
          : entry
      )
    }
  }
  const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action: capability })
  const plan = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
    action: capability,
    published
  })[0]
  if (!plan?.actorRelationshipContribution) throw new Error('Missing relationship fixture plan.')
  return { plan, published }
}

function execution() {
  return {
    status: 'COMPLETE',
    outputs: {},
    evidence: {
      source: {
        definitionId: ids.command,
        gameSystemId: ids.encounter,
        definitionFamilyKey: 'rules-runtime-graph',
        checksum: 'd'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: {}
    }
  } satisfies ServerCompletedRuleExecutionDto
}

function relationshipEffect(definition: RelationshipDefinition, baselinePresent: boolean) {
  if (definition.origin.kind !== 'ENCOUNTER')
    throw new Error('Expected Encounter relationship origin.')
  return {
    id: '00000000-0000-4000-8000-000000000906',
    owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ids.encounter, targetActorId: ids.target },
    sourceEncounterId: ids.encounter,
    maintainedEffectStateId: null,
    createdOrdinal: 1,
    version: 1,
    definition: {
      ...definition,
      origin: { ...definition.origin, sourceActorId: '00000000-0000-4000-8000-000000000908' },
      stateContributions: definition.stateContributions.map((contribution) =>
        contribution.kind === 'CONDITION_OWNERSHIP'
          ? { ...contribution, baselinePresent }
          : contribution
      )
    },
    definitionChecksum: 'a'.repeat(64),
    lifecycle: { schemaVersion: 1, remainingTicks: null },
    lifecycleChecksum: 'b'.repeat(64),
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z'
  } satisfies ActiveRuleEffectRecord
}

function relationshipDefinition(result: ReturnType<typeof planWith>) {
  const definition = result.recurringEffect?.definition
  if (!definition) throw new Error('Expected relationship state contributions.')
  return definition
}

function planWith(
  activeEffects: readonly ActiveRuleEffectRecord[],
  conditionIds: readonly string[],
  input: {
    authoredPath?: 'ON_HIT' | 'ON_CRIT'
    resultPath?: 'ON_HIT' | 'ON_CRIT' | 'ON_CHECK_SUCCESS' | 'ON_CHECK_FAIL'
    heldAtOnce?: number
    otherHolds?: ReadonlyArray<readonly [string, readonly ActiveRuleEffectRecord[]]>
    fixture?: ReturnType<typeof fixturePlan>
    sealedReachFeet?: number
  } = {}
) {
  const { plan, published } = input.fixture ?? fixturePlan(input.authoredPath, input.heldAtOnce)
  return prepareEncounterActionEffectPlans({
    encounterId: ids.encounter,
    occurrenceId: ids.occurrence,
    commandId: ids.command,
    sourceActorId: ids.source,
    sourceLabel: null,
    sourceHidden: false,
    currentActorId: null,
    target: {
      actorId: ids.target,
      conditionIds,
      effectiveSize: 'MEDIUM',
      lifetimeScope: 'ENCOUNTER',
      activeEffects
    },
    activeEffectsByActorId: new Map([[ids.target, activeEffects], ...(input.otherHolds ?? [])]),
    activeEffectPlan: plan,
    sealedReachFeet: 'sealedReachFeet' in input ? input.sealedReachFeet : 5,
    published,
    execution: execution(),
    d20: {
      requestId: ids.command,
      rollMode: 'NORMAL',
      keep: 'FIRST',
      derivedRollMode: 'NORMAL',
      rawFaces: [10],
      selectedNatural: 10,
      contributors: [],
      contributorChecksum: 'c'.repeat(64),
      modifier: 0,
      total: 10,
      defenseOrDc: 10,
      resultPath: input.resultPath ?? 'ON_HIT'
    },
    applications: []
  })
}

describe('encounter action effect condition baselines', () => {
  it('retains an existing false relationship baseline for a second independent source', () => {
    const first = planWith([], [])
    const activeEffect = relationshipEffect(relationshipDefinition(first), false)
    const conditionId = relationshipDefinition(first).stateContributions.find(
      (contribution) => contribution.kind === 'CONDITION_OWNERSHIP'
    )!.conditionId
    const second = planWith([activeEffect], [conditionId])
    expect(
      relationshipDefinition(second)
        .stateContributions.filter((contribution) => contribution.kind === 'CONDITION_OWNERSHIP')
        .every((contribution) => !contribution.baselinePresent)
    ).toBe(true)
  })

  it('retains a true existing relationship baseline when the current condition is present', () => {
    const first = planWith([], [])
    const activeEffect = relationshipEffect(relationshipDefinition(first), true)
    const conditionIds = activeEffect.definition.stateContributions.flatMap((contribution) =>
      contribution.kind === 'CONDITION_OWNERSHIP' ? [contribution.conditionId] : []
    )
    const second = planWith([activeEffect], conditionIds)
    expect(
      relationshipDefinition(second)
        .stateContributions.filter((contribution) => contribution.kind === 'CONDITION_OWNERSHIP')
        .every((contribution) => contribution.baselinePresent)
    ).toBe(true)
  })

  it('rejects inconsistent existing relationship baselines', () => {
    const first = planWith([], [])
    const definition = relationshipDefinition(first)
    const falseEffect = relationshipEffect(definition, false)
    const trueEffect = {
      ...relationshipEffect(definition, true),
      id: '00000000-0000-4000-8000-000000000907'
    }
    expect(() => planWith([falseEffect, trueEffect], [])).toThrow(
      'The target condition contribution baseline is inconsistent.'
    )
  })

  it('creates a critical-only relationship only for a critical hit', () => {
    const ordinaryHit = planWith([], [], { authoredPath: 'ON_CRIT', resultPath: 'ON_HIT' })
    expect(ordinaryHit.recurringEffect).toBeNull()
    expect(ordinaryHit.relationshipConditionApplications).toEqual([])

    const criticalHit = planWith([], [], { authoredPath: 'ON_CRIT', resultPath: 'ON_CRIT' })
    expect(criticalHit.recurringEffect).not.toBeNull()
    expect(criticalHit.relationshipConditionApplications).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ authoredPath: 'ON_CRIT', resolvedPath: 'ON_CRIT' })
      ])
    )
  })
})

describe('a contest win holds the target (Grapple, D152)', () => {
  function grapplePlan() {
    const effect = SRD_BASIC_ACTION_DEFINITIONS.find(
      ({ id }) => id === SRD_BASIC_ACTION_IDS.GRAPPLE
    )?.document.effects[0]
    if (!effect) throw new Error('Missing the SRD Grapple.')
    const action = {
      ...characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID })),
      conditionDefinitionIds: SRD_CONDITION_TYPES.map(({ id }) => id)
    }
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    const plan = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({ action, published })[0]
    if (!plan?.actorRelationshipContribution) throw new Error('Missing the Grapple plan.')
    return { plan, published }
  }
  const grappledId = SRD_CONDITION_TYPES.find(({ code }) => code === 'GRAPPLED')!.id

  it('applies Grappled when the initiator wins the contest', () => {
    const won = planWith([], [], { fixture: grapplePlan(), resultPath: 'ON_CHECK_SUCCESS' })
    expect(won.recurringEffect).not.toBeNull()
    expect(won.relationshipConditionApplications).toEqual([
      expect.objectContaining({
        conditionId: grappledId,
        authoredPath: 'ON_CHECK_SUCCESS',
        resolvedPath: 'ON_CHECK_SUCCESS'
      })
    ])
  })

  it("seals the grappler's reach on the hold", () => {
    const definition = planWith([], [], {
      fixture: grapplePlan(),
      resultPath: 'ON_CHECK_SUCCESS',
      sealedReachFeet: 10
    }).recurringEffect?.definition
    if (!definition) throw new Error('Expected state contributions.')
    expect(definition.stateContributions).toContainEqual(
      expect.objectContaining({ kind: 'ACTOR_RELATIONSHIP', sealedReachFeet: 10 })
    )
  })

  it('refuses a hold planned without the reach it seals', () => {
    expect(() =>
      planWith([], [], {
        fixture: grapplePlan(),
        resultPath: 'ON_CHECK_SUCCESS',
        sealedReachFeet: undefined
      })
    ).toThrow('reach')
  })

  it('holds nothing when the initiator loses the contest', () => {
    const lost = planWith([], [], { fixture: grapplePlan(), resultPath: 'ON_CHECK_FAIL' })
    expect(lost.recurringEffect).toBeNull()
    expect(lost.relationshipConditionApplications).toEqual([])
  })
})

describe('a held creature’s relationship recurrence (SPELLS-33.T6n1)', () => {
  const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id
  const fixedSave = {
    id: '00000000-0000-4000-8000-000000009848',
    dcMethod: 'FIXED_DC',
    abilityDefinitionId: CONSTITUTION,
    baseDc: 14
  } as const

  /** The Rug's one relationship plan, its recurrence shaped by `recurrence`. */
  const recurrencePlan = (recurrence: RecurrenceOverrides) => {
    const action = rugSmotherCapability(1, recurrence)
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    const [plan, ...rest] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action,
      published
    })
    expect(rest).toEqual([])
    if (!plan) throw new Error('The relationship has no active-effect plan.')
    return plan
  }

  it('recurs as a plain damage roll without a saving throw', () => {
    const plan = recurrencePlan({})
    expect(plan).toMatchObject({
      frozenGraphNodeId: 'relationship-recurrence',
      recurrenceStage: 'START_OF_TURN'
    })
    expect(plan.adapterFacts).not.toHaveProperty(DND5E_SAVE_DC_FACT_KEY)
  })

  it('freezes a fixed-DC save whose failure deals the damage with its modifier', () => {
    const plan = recurrencePlan({ savingThrow: fixedSave })
    expect(plan).toMatchObject({
      frozenGraphNodeId: 'proposal-on_save_fail',
      recurrenceStage: 'START_OF_TURN',
      actorRelationshipContribution: expect.objectContaining({ heldAtOnce: 1 })
    })
    expect(plan.adapterFacts).toMatchObject({
      [DND5E_ACTIVE_EFFECT_SAVE_ABILITY_DEFINITION_FACT_KEY]: CONSTITUTION,
      [DND5E_SAVE_DC_FACT_KEY]: 14,
      'dnd5e.relationship-authored-path': 'ON_HIT'
    })
    const { nodes } = plan.frozenGraph.definition
    expect(nodes.map(({ id }) => id)).toContain('proposal-on_save_fail')
    // 2d6+3: the failed save's dice total takes the authored modifier.
    expect(
      nodes.find(({ operation }) => operation.key === DND5E_DAMAGE_TOTAL_OPERATION_KEY)?.inputs
        .modifier
    ).toEqual({ kind: 'LITERAL', value: 3 })
  })

  it.each([
    { actor: 'TARGET', anchor: 'HOLDER' },
    { actor: 'SOURCE', anchor: 'SOURCE' }
  ] as const)(
    'stores a $actor-anchored recurrence on its $anchor’s turn starts (SPELLS-33.T6n2)',
    ({ actor, anchor }) => {
      const action = rugSmotherCapability(1, { turnAnchor: { actor, boundary: 'START_OF_TURN' } })
      const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
      const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({ action, published })
      if (!plan) throw new Error('The relationship has no active-effect plan.')
      expect(plan).toMatchObject({ recurrenceStage: 'START_OF_TURN', tickAnchor: anchor })
      // An indefinite hold is no grant tick: the turn-effect kernel runs it on the anchor's turns.
      expect(
        relationshipDefinition(planWith([], [], { fixture: { plan, published } })).recurrence
      ).toMatchObject({
        recurrenceStage: 'START_OF_TURN',
        anchor,
        expiration: { kind: 'INDEFINITE' }
      })
    }
  )

  describe('as hit points lost directly (SPELLS-33.T6n2b)', () => {
    const hitPointLoss = {
      id: rugIds.recurrenceDamage,
      effectKind: 'HIT_POINT_LOSS',
      diceConfig: '2d6+3'
    } as const
    /** The plan's frozen graph nodes that propose an outcome to the held creature. */
    const proposals = (plan: ReturnType<typeof recurrencePlan>) =>
      plan.frozenGraph.definition.nodes.filter(({ operation }) =>
        operation.key.endsWith('-proposal')
      )

    it('proposes the loss, with no damage type, without a saving throw', () => {
      const plan = recurrencePlan({ outcome: hitPointLoss })
      expect(plan).toMatchObject({ frozenGraphNodeId: 'relationship-recurrence' })
      const [proposal, ...others] = proposals(plan)
      expect(others).toEqual([])
      expect(proposal).toMatchObject({
        id: 'relationship-recurrence',
        operation: { key: DND5E_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY }
      })
      expect(proposal!.inputs).not.toHaveProperty('damageTypeId')
      expect(plan.frozenGraph.definition.outputs).not.toHaveProperty('damageTypeId')
    })

    it('proposes the loss, unhalved and with no damage type, only on a failed save', () => {
      const plan = recurrencePlan({ outcome: hitPointLoss, savingThrow: fixedSave })
      expect(plan).toMatchObject({ frozenGraphNodeId: 'proposal-on_save_fail' })
      const [proposal, ...others] = proposals(plan)
      expect(others).toEqual([])
      expect(proposal).toMatchObject({
        id: 'proposal-on_save_fail',
        operation: { key: DND5E_TEST_HIT_POINT_LOSS_PROPOSAL_OPERATION_KEY },
        inputs: { authoredPath: { kind: 'LITERAL', value: 'ON_SAVE_FAIL' } }
      })
      expect(proposal!.inputs).not.toHaveProperty('damageTypeId')
      // 2d6+3: the failed save's dice total takes the authored modifier.
      expect(
        plan.frozenGraph.definition.nodes.find(
          ({ operation }) => operation.key === DND5E_DAMAGE_TOTAL_OPERATION_KEY
        )?.inputs.modifier
      ).toEqual({ kind: 'LITERAL', value: 3 })
    })
  })

  it('refuses a recurrence at the end of a turn', () => {
    expect(() =>
      recurrencePlan({ turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } })
    ).toThrow('D&D relationship recurrence counts only at the start of a turn.')
    expect(() =>
      recurrencePlan({ turnAnchor: { actor: 'SOURCE', boundary: 'END_OF_TURN' } })
    ).toThrow('D&D relationship recurrence counts only at the start of a turn.')
  })

  it('refuses a save against the holder’s save DC, which the hold’s attack never settles', () => {
    expect(() =>
      recurrencePlan({
        savingThrow: {
          id: fixedSave.id,
          dcMethod: 'SOURCE_SAVE_DC',
          abilityDefinitionId: CONSTITUTION
        }
      })
    ).toThrow('D&D relationship recurrence saves against one fixed DC.')
  })
})

describe('encounter Grappled outcome held at once', () => {
  const heldA = '00000000-0000-4000-8000-000000000911'
  const heldB = '00000000-0000-4000-8000-000000000912'
  const otherOutcome = '00000000-0000-4000-8000-000000000913'

  function holdBySource(actorId: string, relationshipOutcomeId?: string) {
    const effect = relationshipEffect(relationshipDefinition(planWith([], [])), false)
    if (effect.definition.origin.kind !== 'ENCOUNTER')
      throw new Error('Expected Encounter relationship origin.')
    const hold: ActiveRuleEffectRecord = {
      ...effect,
      id: `00000000-0000-4000-8000-0000000009${actorId.slice(-2)}`,
      owner: { ...effect.owner, targetActorId: actorId },
      definition: {
        ...effect.definition,
        origin: { ...effect.definition.origin, sourceActorId: ids.source },
        stateContributions: effect.definition.stateContributions.map((contribution) =>
          contribution.kind === 'ACTOR_RELATIONSHIP' && relationshipOutcomeId
            ? { ...contribution, relationshipOutcomeId }
            : contribution
        )
      }
    }
    return [actorId, [hold]] as const
  }

  it('holds as many creatures as its held-at-once count and refuses one more', () => {
    expect(
      planWith([], [], { heldAtOnce: 2, otherHolds: [holdBySource(heldA)] }).recurringEffect
    ).not.toBeNull()
    expect(
      planWith([], [], {
        heldAtOnce: 2,
        otherHolds: [holdBySource(heldA), holdBySource(heldB)]
      }).recurringEffect
    ).toBeNull()
  })

  it('refuses a second creature when it holds one at once', () => {
    expect(planWith([], [], { otherHolds: [holdBySource(heldA)] }).recurringEffect).toBeNull()
  })

  it('counts only holds made by the same outcome', () => {
    expect(
      planWith([], [], {
        otherHolds: [holdBySource(heldA, otherOutcome), holdBySource(heldB, otherOutcome)]
      }).recurringEffect
    ).not.toBeNull()
  })
})

describe('encounter actor link plan (SPELLS-28)', () => {
  const bondPlan = (memberActorIds: readonly string[]) => {
    const effect = telepathicBond.effects?.[0]
    if (!effect) throw new Error('Telepathic Bond has no effect.')
    const action = characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
    const published = dnd5eCharacterRuleActionSystemAdapter.compile({ action })
    const [plan] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({ action, published })
    return prepareEncounterActionEffectPlans({
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: ids.command,
      sourceActorId: ids.source,
      sourceLabel: null,
      sourceHidden: false,
      currentActorId: null,
      target: {
        actorId: ids.target,
        conditionIds: [],
        effectiveSize: 'MEDIUM',
        lifetimeScope: 'ENCOUNTER',
        activeEffects: []
      },
      activeEffectsByActorId: new Map(),
      activeEffectPlan: plan ?? null,
      link: { memberActorIds },
      published,
      execution: execution(),
      d20: null,
      applications: []
    }).recurringEffect
  }

  it('freezes every bonded creature, sorted, into the bond each target holds', () => {
    const definition = bondPlan([ids.target, ids.source, ids.occurrence])?.definition
    if (!definition) throw new Error('Expected state contributions.')
    expect(definition.stateContributions).toEqual([
      expect.objectContaining({
        kind: 'ACTOR_LINK',
        linkKind: 'TELEPATHIC',
        memberActorIds: [ids.target, ids.source, ids.occurrence].sort()
      })
    ])
  })

  it('leaves no bond when fewer than two creatures were reached', () => {
    expect(bondPlan([ids.target])).toBeNull()
  })
})

describe('plan-owned outcomes on a test result path (RULES-2.T6d)', () => {
  type SpellEffect = NonNullable<typeof telepathicBond.effects>[number]
  const CONSTITUTION = SRD_ABILITIES.find(({ code }) => code === 'CONSTITUTION')!.id

  /** `effect` cast as a Constitution save of one target, its outcome authored on `pathCode`. */
  const asSave = (effect: SpellEffect | undefined, pathCode: string): SpellEffect => {
    if (!effect) throw new Error('The spell has no effect.')
    return JSON.parse(
      JSON.stringify({
        ...effect,
        id: ACTION_EFFECT_ID,
        invocation: {
          kind: 'ACTION',
          triggerCode: TRIGGER.SAVING_THROW,
          savingThrow: {
            id: '00000000-0000-4000-8000-000000000906',
            dcMethod: 'FIXED_DC',
            abilityDefinitionId: CONSTITUTION,
            baseDc: 13
          },
          ...('activation' in effect.invocation && { activation: effect.invocation.activation }),
          range: { id: '00000000-0000-4000-8000-000000000907', rangeKind: RANGE_KIND.UNLIMITED },
          targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind: 'ANY' }
        },
        paths: (effect.paths ?? []).map((path) => ({ ...path, pathCode }))
      })
    ) as SpellEffect
  }

  /** The save action's one active-effect plan, compiled as a Character action is. */
  const savePlan = (effect: Parameters<typeof compileEffect>[0]) => {
    const action = {
      ...characterActionDescriptor(compileEffect(effect), 4),
      conditionDefinitionIds: SRD_CONDITION_TYPES.map((condition) => condition.id)
    }
    const executionPlan = dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
      action,
      compilerSource: buildCompiledActionCompilerSource(action)
    })
    if (executionPlan?.kind !== 'TEST_OUTCOME') throw new Error('The save is not a TEST/OUTCOME.')
    const [plan, ...rest] = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans!({
      action,
      published: executionPlan.test.published
    })
    expect(rest).toEqual([])
    if (!plan) throw new Error('The save has no active-effect plan.')
    return { plan, published: executionPlan.test.published }
  }

  /** The effect the room makes once the save resolves to `resultPath`. */
  const madeOn = (
    compiled: ReturnType<typeof savePlan>,
    resultPath: 'ON_SAVE_FAIL' | 'ON_SAVE_SUCCESS'
  ) =>
    prepareEncounterActionEffectPlans({
      encounterId: ids.encounter,
      occurrenceId: ids.occurrence,
      commandId: ids.command,
      sourceActorId: ids.source,
      sourceLabel: null,
      sourceHidden: false,
      currentActorId: null,
      target: {
        actorId: ids.target,
        conditionIds: [],
        effectiveSize: 'MEDIUM',
        lifetimeScope: 'ENCOUNTER',
        activeEffects: []
      },
      activeEffectsByActorId: new Map(),
      activeEffectPlan: compiled.plan,
      link: { memberActorIds: [ids.source, ids.target] },
      sealedReachFeet: 5,
      form: {
        creatureId: compiled.plan.creatureFormContribution?.forms[0]?.creatureId ?? ids.target
      },
      published: compiled.published,
      execution: execution(),
      d20: {
        requestId: ids.command,
        rollMode: 'NORMAL',
        keep: 'FIRST',
        derivedRollMode: 'NORMAL',
        rawFaces: [5],
        selectedNatural: 5,
        contributors: [],
        contributorChecksum: 'c'.repeat(64),
        modifier: 0,
        total: 5,
        defenseOrDc: 13,
        resultPath
      },
      applications: []
    }).recurringEffect

  const stateKinds = (effect: ReturnType<typeof madeOn>) =>
    effect?.definition.stateContributions.map(({ kind }) => kind) ?? null

  it('bonds a creature that fails the save, and no creature that makes it', () => {
    const compiled = savePlan(asSave(telepathicBond.effects?.[0], PATH_CODE.ON_SAVE_FAIL))
    expect(compiled.plan).toMatchObject({
      resultGate: { paths: ['ON_SAVE_FAIL'] },
      actorLinkContribution: { linkKind: 'TELEPATHIC' }
    })
    expect(stateKinds(madeOn(compiled, 'ON_SAVE_FAIL'))).toEqual(['ACTOR_LINK'])
    expect(madeOn(compiled, 'ON_SAVE_SUCCESS')).toBeNull()
  })

  it('swaps a creature that makes the save into the chosen form, and no creature that fails it', () => {
    const compiled = savePlan(asSave(giantInsect.effects?.[0], PATH_CODE.ON_SAVE_SUCCESS))
    expect(compiled.plan).toMatchObject({
      resultGate: { paths: ['ON_SAVE_SUCCESS'] },
      creatureFormContribution: { excessDamageCarriesOver: false }
    })
    expect(stateKinds(madeOn(compiled, 'ON_SAVE_SUCCESS'))).toEqual(['CREATURE_FORM'])
    expect(madeOn(compiled, 'ON_SAVE_FAIL')).toBeNull()
  })

  it('holds a creature that fails the save, and no creature that makes it (SPELLS-33.T6n4)', () => {
    const bite = crocodile.features.find(({ label }) => label === 'Bite')?.effects?.[0]
    const compiled = savePlan(asSave(bite, PATH_CODE.ON_SAVE_FAIL))
    expect(compiled.plan).toMatchObject({
      resultGate: { paths: ['ON_SAVE_FAIL'] },
      adapterFacts: { 'dnd5e.relationship-authored-path': 'ON_SAVE_FAIL' }
    })
    expect(stateKinds(madeOn(compiled, 'ON_SAVE_FAIL'))).toContain('ACTOR_RELATIONSHIP')
    expect(madeOn(compiled, 'ON_SAVE_SUCCESS')).toBeNull()
  })
})
