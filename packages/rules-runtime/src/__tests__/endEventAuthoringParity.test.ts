import { describe, expect, it } from 'vitest'
import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { featureDtoSchema } from '@artificer-toolkit/schema/features/feature'
import { facetDtoSchema } from '@artificer-toolkit/schema/shared/facet'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_STEALTH_SKILL_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { normalizeCharacterGrantRestrictions } from '../character/characterGrantFoldRestrictionFacts.js'
import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { creatureFeature, srdCreatureActor, testUuid } from '../testing/dnd5eSrdEncounter.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

const srdClassFeature = (classLabel: string, featureLabel: string) => {
  const feature = srdBaselineContent.subjects.classes
    .find(({ label }) => label === classLabel)
    ?.features?.find(({ label }) => label === featureLabel)
  if (!feature) throw new Error(`SRD ${classLabel} feature "${featureLabel}" is missing.`)
  return feature
}

/** The active-effect plan the room builds for a feature's action, run from an SRD Imp that carries it. */
function plannedAction(effects: NonNullable<CreatureAuthored['features']>[number]['effects']) {
  const imp = srdBaselineContent.subjects.creatures.find(({ label }) => label === 'Imp')!
  const creature: CreatureAuthored = {
    ...imp,
    features: imp.features?.map((entry) =>
      entry.label === 'Invisibility' ? { ...entry, effects } : entry
    )
  }
  const feature = creatureFeature(creature, 'Invisibility')
  const actor = srdCreatureActor({ id: testUuid(0x2200), creature })
  const capability = discoverUncompiledEncounterFeatureActions({
    spells: new Map(),
    actor,
    conditionDefinitionIds,
    abilityDefinitions
  }).available.find((candidate) => candidate.ownerFeatureId === feature.id)
  if (!capability) throw new Error('The feature is not offered as an action.')
  const executionPlan = compileEncounterFeatureActionPlan(
    dnd5eCharacterRuleActionSystemAdapter,
    capability
  )
  if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected a single graph.')
  const [plan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: capability,
      published: executionPlan.published
    }) ?? []
  return plan
}

describe('Hide in Plain Sight is authorable from core options (D156, SPELLS-31.T5n)', () => {
  const srd = srdClassFeature('Ranger', 'Hide in Plain Sight')

  it('keeps no closed rule kind and ends on a move or any action', () => {
    expect(JSON.stringify(srd)).not.toContain('CLOSED_RULE')
    expect(plannedAction(srd.effects)?.modifierGrantContribution?.endOnEvents).toEqual([
      'ON_MOVE',
      'ON_TAKE_ACTION'
    ])
  })

  it('compiles a homebrew action written from core options alone to the same plan', () => {
    const homebrew = [
      {
        id: testUuid(0x2210),
        order: 1,
        invocation: {
          kind: 'ACTION' as const,
          triggerCode: 'ACTIVATED' as const,
          activation: { code: 'ACTION' as const, amount: 1 },
          range: { id: testUuid(0x2211), rangeKind: 'SELF' as const },
          targeting: { selectionKind: 'SELF' as const }
        },
        paths: [
          {
            id: testUuid(0x2212),
            order: 1,
            pathCode: 'ON_USE' as const,
            groupType: 'SINGLE' as const,
            originKind: 'SOURCE' as const,
            selectionKind: 'FIXED' as const,
            resultBlock: {
              id: testUuid(0x2213),
              resultKind: 'SINGLE' as const,
              lifecycle: { endOnEvents: ['ON_MOVE' as const, 'ON_TAKE_ACTION' as const] },
              outcomes: [
                {
                  id: testUuid(0x2214),
                  effectKind: 'APPLY_GRANT' as const,
                  grants: {
                    modifiers: [
                      {
                        id: testUuid(0x2215),
                        grantKind: 'MODIFIER_GRANT' as const,
                        valueDomainCode: 'SKILL_MODIFIER' as const,
                        domain: { skillId: SRD_STEALTH_SKILL_ID },
                        modifierKind: 'BONUS' as const,
                        scope: 'GLOBAL' as const,
                        selectionKind: 'GRANTED' as const,
                        payload: { valueKind: 'FIXED' as const, amount: 10 },
                        order: 1
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    ]
    const authored = plannedAction(homebrew)
    const baseline = plannedAction(srd.effects)
    expect(authored).not.toBeUndefined()
    const shape = (plan: typeof authored) => {
      const contribution = plan?.modifierGrantContribution
      return {
        recurrenceStage: plan?.recurrenceStage,
        initialRemaining: plan?.initialRemaining,
        tickAnchor: plan?.tickAnchor,
        endOnEvents: contribution?.endOnEvents,
        consumeOnFirstEvents: contribution?.consumeOnFirstEvents,
        modifiers: contribution?.modifiers.map(({ grantId: _grantId, ...modifier }) => modifier)
      }
    }
    expect(shape(authored)).toEqual(shape(baseline))
  })
})

describe('Supreme Sneak is authorable from core options (D156, SPELLS-31.T5n)', () => {
  const srd = srdBaselineContent.subjects.classes
    .find(({ label }) => label === 'Thief')
    ?.features?.find(({ label }) => label === 'Supreme Sneak')
  const restriction = (facet: FacetAuthored | undefined) =>
    normalizeCharacterGrantRestrictions(facet).flatMap(({ conditions }) => conditions)

  it('is a feature-level Stealth advantage gated by the TURN_MOVEMENT predicate, with no closed rule', () => {
    expect(JSON.stringify(srd)).not.toContain('CLOSED_RULE')
    expect(srd?.grants?.modifiers?.[0]).toMatchObject({
      valueDomainCode: 'SKILL_MODIFIER',
      modifierKind: 'ROLL_INFLUENCE',
      payload: { influence: 'ADVANTAGE' },
      scope: 'GLOBAL'
    })
    expect(featureDtoSchema.safeParse(srd).success).toBe(true)
  })

  it('normalizes a homebrew restriction written from core options to the same condition', () => {
    const homebrew: FacetAuthored = {
      id: testUuid(0x2230),
      groups: [
        {
          id: testUuid(0x2231),
          order: 0,
          contexts: [
            {
              id: testUuid(0x2232),
              order: 0,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: testUuid(0x2233),
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'TURN_MOVEMENT',
                  maxSpeedFraction: 0.5
                }
              ]
            }
          ]
        }
      ]
    }
    const baseline = restriction(srd?.grants?.modifiers?.[0]?.restrictions)
    expect(baseline).toContainEqual(expect.objectContaining({ kind: 'TURN_MOVEMENT' }))
    const withoutIds = (conditions: typeof baseline) =>
      conditions.map(({ conditionId: _conditionId, ...condition }) => condition)
    expect(withoutIds(restriction(homebrew))).toEqual(withoutIds(baseline))
    expect(facetDtoSchema.safeParse(homebrew).success).toBe(true)
  })

  it('refuses a TURN_MOVEMENT predicate that names neither a distance nor a fraction', () => {
    const [condition] = restriction({
      id: testUuid(0x2240),
      groups: [
        {
          id: testUuid(0x2241),
          order: 0,
          contexts: [
            {
              id: testUuid(0x2242),
              order: 0,
              subject: 'CHARACTER',
              conditions: [
                {
                  id: testUuid(0x2243),
                  order: 0,
                  kind: 'PREDICATE',
                  constraint: 'INCLUDE',
                  predicateCode: 'TURN_MOVEMENT'
                }
              ]
            }
          ]
        }
      ]
    }).filter(({ kind }) => kind !== 'HOLDER_KIND')
    expect(condition).toMatchObject({ kind: 'UNSUPPORTED' })
  })
})

describe('One with Shadows is authorable from core options (D156, SPELLS-31.T5n)', () => {
  const srd = srdBaselineContent.subjects.classes
    .find(({ label }) => label === 'Warlock')
    ?.features?.flatMap((feature) => feature.options ?? [])
    .find(({ label }) => label === 'One with Shadows')
  if (!srd?.effects) throw new Error('The SRD Warlock has no One with Shadows invocation.')
  const invisible = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')!.id
  const homebrew = [
    {
      id: testUuid(0x2240),
      order: 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: 'ACTIVATED' as const,
        activation: { code: 'ACTION' as const, amount: 1 },
        range: { id: testUuid(0x2241), rangeKind: 'SELF' as const },
        targeting: { selectionKind: 'SELF' as const }
      },
      paths: [
        {
          id: testUuid(0x2242),
          order: 1,
          pathCode: 'ON_USE' as const,
          groupType: 'SINGLE' as const,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          resultBlock: {
            id: testUuid(0x2243),
            resultKind: 'SINGLE' as const,
            lifecycle: { endOnEvents: ['ON_MOVE' as const, 'ON_TAKE_ACTION' as const] },
            outcomes: [
              { id: testUuid(0x2244), effectKind: 'CONDITION' as const, conditionId: invisible }
            ]
          }
        }
      ]
    }
  ]
  /** The plan with every id replaced and the checksums over them dropped, so two authorings of one rule compare equal. */
  const withoutIds = (plan: unknown) =>
    JSON.parse(
      JSON.stringify(plan, (key, value) => (/hecksum$/.test(key) ? undefined : value)).replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
        'ID'
      )
    )

  it('keeps no closed rule kind and plans an Invisible condition that ends on a move or any action', () => {
    expect(JSON.stringify(srd)).not.toContain('CLOSED_RULE')
    const plan = plannedAction(srd.effects)
    expect(plan).not.toBeUndefined()
    expect(JSON.stringify(plan)).toContain('"ON_MOVE"')
    expect(JSON.stringify(plan)).toContain('"ON_TAKE_ACTION"')
    expect(JSON.stringify(plan)).toContain(invisible)
  })

  it('compiles a homebrew action written from core options alone to the same plan', () => {
    expect(withoutIds(plannedAction(homebrew))).toEqual(withoutIds(plannedAction(srd.effects)))
  })
})
