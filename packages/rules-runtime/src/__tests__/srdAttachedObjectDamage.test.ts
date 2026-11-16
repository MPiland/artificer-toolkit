import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import { describe, expect, it } from 'vitest'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { compileSpellEffect } from '@artificer-toolkit/shared/compilers'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { compileCastChoicePlans } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'

/**
 * QUALITY-15.T3t2: an object a hit attaches to its target that deals damage at the target's turn
 * boundary compiles to one active effect that holds the object, rolls the damage row the cast level
 * reaches, frozen into its own graph, and offers the target the authored check that ends it.
 */

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)

/** The SRD subject's one Effect, compiled as a 20th-level Character's action and its plans. */
function attachedObjectPlans(
  { effects = [] }: { effects?: readonly EffectAuthored[] },
  castLevel: number | undefined
) {
  const [effect] = effects
  if (!effect) throw new Error('The subject has no Effect.')
  const action = {
    ...characterActionDescriptor(
      compileSpellEffect(
        { attributes: [], effects: [effect] },
        { ...effect, id: ACTION_EFFECT_ID }
      ),
      castLevel,
      20
    ),
    conditionDefinitionIds
  }
  const { executionPlan } = compileCastChoicePlans(dnd5eCharacterRuleActionSystemAdapter, action)
  const published =
    executionPlan.kind === 'SINGLE_GRAPH' ? executionPlan.published : executionPlan.test.published
  const plans =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
  return { effect, executionPlan, plans }
}

/** The faces of each die the frozen graph rolls. */
function frozenDice(frozenGraph: ServerPublishedRuleDefinitionDto) {
  return frozenGraph.definition.nodes.flatMap(({ operation, inputs }) =>
    operation.key === 'evidence.integer-range' && inputs.max?.kind === 'LITERAL'
      ? [inputs.max.value]
      : []
  )
}

/** The authored outcome of the subject's Effect with this effect kind. */
function authoredOutcome(effect: EffectAuthored, effectKind: string) {
  const outcome = effect.paths
    .flatMap((path) => ('resultBlock' in path ? path.resultBlock.outcomes : []))
    .find((candidate) => candidate.effectKind === effectKind)
  if (!outcome) throw new Error(`The Effect authors no ${effectKind}.`)
  return outcome
}

describe('an attached object that deals damage at its holder’s turn boundary', () => {
  it.each([
    { castLevel: 2, dice: 2 },
    { castLevel: 5, dice: 5 },
    { castLevel: 9, dice: 9 }
  ])(
    'Acid Arrow cast at level $castLevel deals its 4d4 on the hit and holds $dice d4 for the end of the target’s next turn',
    ({ castLevel, dice }) => {
      const { effect, executionPlan, plans } = attachedObjectPlans(
        srdByLabel(SRD.spells, 'Acid Arrow'),
        castLevel
      )
      // The hit's immediate damage and the miss's half stay the attack's outcomes.
      expect(executionPlan.kind).toBe('TEST_OUTCOME')
      if (executionPlan.kind !== 'TEST_OUTCOME') return
      expect(executionPlan.outcomes.map(({ pathCode }) => pathCode)).toEqual(
        expect.arrayContaining(['ON_HIT', 'ON_MISS'])
      )
      expect(plans).toHaveLength(1)
      const [plan] = plans
      expect(plan).toMatchObject({
        frozenGraphNodeId: 'attached-object-damage',
        recurrenceStage: 'END_OF_TURN',
        initialRemaining: 1,
        resultGate: { paths: expect.arrayContaining(['ON_HIT']) },
        objectManifestationContribution: {
          manifestationOutcomeId: authoredOutcome(effect, 'MANIFEST').id,
          label: 'Lingering acid',
          attachmentKind: 'PRIMARY_TARGET'
        }
      })
      expect(plan?.resultGate?.paths).not.toContain('ON_MISS')
      expect(plan?.conditionEscapeContribution).toBeUndefined()
      if (!plan) return
      expect(frozenDice(plan.frozenGraph)).toEqual(Array.from({ length: dice }, () => 4))
      expect(plan.frozenGraph.definition.sourceEntryBindings).toEqual([
        { sourceEntryId: plan.compiledEntryId, nodeId: 'attached-object-damage' }
      ])
    }
  )

  it("Alchemist's Fire holds 1d4 fire at the start of each of the target's turns until its holder extinguishes it", () => {
    const { effect, executionPlan, plans } = attachedObjectPlans(
      srdByLabel(SRD.equipment, "Alchemist's Fire (flask)"),
      undefined
    )
    // Both hit paths are the effect's: the attack selects no outcome graph of its own.
    expect(executionPlan.kind).toBe('TEST_OUTCOME')
    if (executionPlan.kind !== 'TEST_OUTCOME') return
    expect(executionPlan.outcomes).toEqual([])
    expect(plans).toHaveLength(1)
    const [plan] = plans
    const check = authoredOutcome(effect, 'FOLLOW_UP_CHECK')
    expect(plan).toMatchObject({
      frozenGraphNodeId: 'attached-object-damage',
      recurrenceStage: 'START_OF_TURN',
      initialRemaining: null,
      resultGate: { paths: expect.arrayContaining(['ON_HIT']) },
      objectManifestationContribution: {
        manifestationOutcomeId: authoredOutcome(effect, 'MANIFEST').id,
        label: "Burning alchemist's fire",
        attachmentKind: 'PRIMARY_TARGET'
      },
      conditionEscapeContribution: {
        label: 'Extinguish the flames',
        activation: { code: 'ACTION', amount: 1 },
        dc: 10,
        escapeOutcome: { outcomeId: check.id, actorKinds: ['TARGET'] }
      }
    })
    if (!plan) return
    expect(frozenDice(plan.frozenGraph)).toEqual([4])
  })
})
