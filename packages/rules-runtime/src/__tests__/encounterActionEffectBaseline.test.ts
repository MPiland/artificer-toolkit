import { describe, expect, it } from 'vitest'

import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { telepathicBond } from '@artificer-toolkit/source-data/srd/spells/telepathic-bond.js'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { normalizeCharacterActionMechanicFacts } from '../character/characterActionRuleFacts.js'
import type { EncounterFeatureActionCapabilityDescriptor } from '../encounterFeatureActionCapabilityDiscovery.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/characterActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
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

function rugSmotherCapability(heldAtOnce = 1) {
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
                stage: 'START_OF_TURN',
                damage: {
                  id: rugIds.recurrenceDamage,
                  effectKind: EFFECT_KIND.DAMAGE,
                  damageTypeId: rugIds.bludgeoning,
                  valueKind: 'DICE',
                  scalingKind: 'NONE',
                  diceConfig: '2d6+3'
                }
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
    equipmentBinding: null,
    attackMechanic: {
      rollDefinitionId: rugIds.attack,
      attackBonus: 5,
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
  if (definition?.schemaVersion !== 2) throw new Error('Expected relationship state contributions.')
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
    if (definition?.schemaVersion !== 2) throw new Error('Expected state contributions.')
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
    if (definition?.schemaVersion !== 2) throw new Error('Expected state contributions.')
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
