import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { djinni } from '@artificer-toolkit/source-data/srd/creatures/djinni.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  srdSystemRecord
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  installedSrdCreature,
  srdCondition,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const RESTRAINED = srdCondition('Restrained')
const FEATURE = 'Create Whirlwind'

type CreatureFeature = CreatureAuthored['features'][number]
type FeatureOutcome = Extract<
  NonNullable<CreatureFeature['effects']>[number]['paths'][number],
  { selectionKind: 'FIXED' }
>['resultBlock']['outcomes'][number]

/**
 * The Djinni's whirlwind compiled the way the room compiles it, its follow-up check rewritten by
 * `authorCheck` when given: the active-effect plan of the failed save, or the compile's refusal.
 */
function compiledWhirlwind(
  authorCheck?: (
    check: Extract<FeatureOutcome, { effectKind: 'FOLLOW_UP_CHECK' }>
  ) => FeatureOutcome
) {
  const installed = installedSrdCreature(djinni)
  const creature: CreatureAuthored = {
    ...installed,
    features: installed.features.map((feature) =>
      feature.label !== FEATURE || !authorCheck
        ? feature
        : {
            ...feature,
            effects: feature.effects?.map((effect) => ({
              ...effect,
              paths: effect.paths.map((path) =>
                path.selectionKind !== 'FIXED'
                  ? path
                  : {
                      ...path,
                      resultBlock: {
                        ...path.resultBlock,
                        outcomes: path.resultBlock.outcomes.map((outcome) =>
                          outcome.effectKind === 'FOLLOW_UP_CHECK' ? authorCheck(outcome) : outcome
                        )
                      }
                    }
              )
            }))
          }
    )
  }
  const feature = creature.features.find(({ label }) => label === FEATURE)
  if (!feature) throw new Error('The Djinni has no Create Whirlwind.')
  const capability = discoverUncompiledEncounterFeatureActions({
    spells: new Map(),
    actor: srdCreatureActor({ id: testUuid(0x3000), creature }),
    conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
    abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
  }).available.find((candidate) => candidate.ownerFeatureId === feature.id)
  if (!capability) throw new Error('Create Whirlwind is not offered as an action.')
  const plan = compileEncounterFeatureActionPlan(dnd5eCharacterRuleActionSystemAdapter, capability)
  const published = plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  return (
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action: capability, published }) ??
    []
  )
}

describe('a follow-up check that ends the effect is its escape (QUALITY-15.T3t)', () => {
  it('compiles the whirlwind to an indefinite restraint its holder or a creature within reach escapes with a DC 18 Strength check', () => {
    const [plan, ...rest] = compiledWhirlwind()
    expect(rest).toEqual([])
    expect(plan).toMatchObject({
      recurrenceStage: 'NONE',
      initialRemaining: null,
      conditionContributions: [{ conditionId: RESTRAINED }],
      conditionEscapeContribution: {
        activation: { code: 'ACTION', amount: 1 },
        checks: { skillIds: [], abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH] },
        dc: 18,
        escapeOutcome: { actorKinds: ['TARGET', 'CREATURE_WITHIN_REACH'] }
      }
    })
  })

  it.each([
    { name: 'leaves the effect on a success', author: { onSuccess: { kind: 'CONTINUE' } } },
    { name: 'may be tried only once', author: { repeatable: false } }
  ] as const)('refuses a check that $name, which is no escape', ({ author }) => {
    expect(() => compiledWhirlwind((check) => ({ ...check, ...author }))).toThrow(
      'D&D test action outcome is not supported.'
    )
  })
})
