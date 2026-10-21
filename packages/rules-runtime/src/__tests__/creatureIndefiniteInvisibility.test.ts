import { describe, expect, it } from 'vitest'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import { actionEndedEffects } from '../encounterEndedEffectRelease.js'
import { discoverUncompiledEncounterFeatureActions } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ENCOUNTER_ID,
  SRD_SYSTEM_ID,
  creatureFeature,
  srdCreatureActor,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'

const INVISIBLE = srdSystemRecord.conditionTypes.find(({ code }) => code === 'INVISIBLE')!.id
const conditionDefinitionIds = srdSystemRecord.conditionTypes.map(({ id }) => id)
const abilityDefinitions = (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))

/** SRD text: the Imp and Quasit end on an attack; the Sprite and Green Hag also end on a cast. */
const TRAITS = [
  { creature: 'Imp', feature: 'Invisibility', events: ['ON_ATTACK_ROLL'] },
  { creature: 'Quasit', feature: 'Invisibility', events: ['ON_ATTACK_ROLL'] },
  { creature: 'Sprite', feature: 'Invisibility', events: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL'] },
  {
    creature: 'Green Hag',
    feature: 'Invisible Passage',
    events: ['ON_ATTACK_ROLL', 'ON_CAST_SPELL']
  },
  { creature: "Will-o'-Wisp", feature: 'Invisibility', events: ['ON_ATTACK_ROLL'] }
]

type CreatureFeature = NonNullable<CreatureAuthored['features']>[number]

/** The action the room runs for a Creature trait: its capability, compiled graph and active-effect plan. */
function compiledTrait(
  creatureLabel: string,
  featureLabel: string,
  authorFeature?: (feature: CreatureFeature) => CreatureFeature
) {
  const srdCreature = srdBaselineContent.subjects.creatures.find(
    ({ label }) => label === creatureLabel
  )
  if (!srdCreature) throw new Error(`SRD Creature "${creatureLabel}" is missing.`)
  const creature = authorFeature
    ? {
        ...srdCreature,
        features: srdCreature.features?.map((entry) =>
          entry.label === featureLabel ? authorFeature(entry) : entry
        )
      }
    : srdCreature
  const feature = creatureFeature(creature, featureLabel)
  const actor = srdCreatureActor({ id: testUuid(0x2000), creature })
  const capability = discoverUncompiledEncounterFeatureActions({
    spells: new Map(),
    actor,
    conditionDefinitionIds,
    abilityDefinitions
  }).available.find((candidate) => candidate.ownerFeatureId === feature.id)
  if (!capability) throw new Error(`${creatureLabel} ${featureLabel} is not offered as an action.`)
  const executionPlan = compileEncounterFeatureActionPlan(
    dnd5eCharacterRuleActionSystemAdapter,
    capability
  )
  if (executionPlan.kind !== 'SINGLE_GRAPH') throw new Error('Expected a single graph.')
  const [activeEffectPlan] =
    dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: capability,
      published: executionPlan.published
    }) ?? []
  return { actor, published: executionPlan.published, activeEffectPlan }
}

describe('a Creature trait that turns it invisible with no duration (SPELLS-27.T10)', () => {
  it.each(TRAITS)(
    '$creature’s $feature owns Invisible indefinitely, ends on $events, and is kept by Concentration',
    ({ creature, feature, events }) => {
      const { activeEffectPlan } = compiledTrait(creature, feature)
      expect(activeEffectPlan).toMatchObject({
        recurrenceStage: 'NONE',
        initialRemaining: null,
        conditionContributions: [{ conditionId: INVISIBLE }],
        lifecycle: {
          consumeOnFirstEvents: [],
          endOnEvents: [...events].sort()
        }
      })
      expect(activeEffectPlan?.maintenance?.definitionId).toBe(
        SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
      )
    }
  )

  it('plans an indefinite effect that an attack or a cast ends, and nothing else does', () => {
    const { actor, published, activeEffectPlan } = compiledTrait('Sprite', 'Invisibility')
    const execution = {
      status: 'COMPLETE',
      outputs: {},
      evidence: {
        source: {
          definitionId: published.id,
          gameSystemId: SRD_SYSTEM_ID,
          definitionFamilyKey: published.definitionFamilyKey,
          checksum: published.checksum
        },
        capabilityContractVersion: 1,
        facts: {},
        trace: [],
        outputs: {}
      }
    } satisfies ServerCompletedRuleExecutionDto
    const { recurringEffect } = prepareEncounterActionEffectPlans({
      encounterId: ENCOUNTER_ID,
      occurrenceId: testUuid(0x2001),
      commandId: testUuid(0x2002),
      sourceActorId: actor.id,
      sourceLabel: 'Invisibility',
      sourceHidden: false,
      currentActorId: actor.id,
      target: {
        actorId: actor.id,
        conditionIds: [],
        effectiveSize: 'SMALL',
        lifetimeScope: 'ENCOUNTER',
        activeEffects: []
      },
      activeEffectsByActorId: new Map(),
      activeEffectPlan,
      published,
      execution,
      d20: null,
      applications: []
    })
    if (!recurringEffect) throw new Error('The trait planned no effect.')
    expect(recurringEffect.definition.recurrence.expiration).toEqual({ kind: 'INDEFINITE' })

    const [placeholder] = [
      activeEffect({
        id: testUuid(0x2003),
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: actor.id },
        createdOrdinal: 1,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
        ]
      })
    ]
    const held = [{ ...placeholder!, definition: recurringEffect.definition }]
    const ended = (input: { makesAttackRoll: boolean; castsSpell?: boolean }) =>
      actionEndedEffects({
        holderActorId: actor.id,
        held,
        againstEnemy: false,
        ...input
      })
    const endedIds = (input: Parameters<typeof ended>[0]) =>
      ended(input).consumedGrants.map(({ id }) => id)
    expect(endedIds({ makesAttackRoll: true })).toEqual([testUuid(0x2003)])
    expect(endedIds({ makesAttackRoll: false, castsSpell: true })).toEqual([testUuid(0x2003)])
    expect(endedIds({ makesAttackRoll: false })).toEqual([])
    // The attack also releases the Invisible condition the trait alone held.
    expect(
      ended({ makesAttackRoll: true }).sourceReleases.map((release) =>
        release.kind === 'CONDITION_REMOVE' ? release.conditionId : release.kind
      )
    ).toEqual([INVISIBLE])
  })

  // Parity: a trait written out in core options alone, with no SRD helper, compiles to the same plan.
  it('compiles a trait authored from core options only to the same plan as the SRD data', () => {
    const effectId = testUuid(0x2100)
    const pathId = testUuid(0x2101)
    const authored = compiledTrait('Imp', 'Invisibility', (feature) => ({
      ...feature,
      effects: [
        {
          id: effectId,
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'ACTIVATED',
            activation: { code: 'ACTION', amount: 1 },
            range: { id: testUuid(0x2102), rangeKind: 'SELF' },
            targeting: { selectionKind: 'SELF' }
          },
          paths: [
            {
              id: pathId,
              order: 1,
              pathCode: 'ON_USE',
              groupType: 'SINGLE',
              originKind: 'SOURCE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: testUuid(0x2103),
                resultKind: 'SINGLE',
                maintenanceDefinitionId: SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID,
                lifecycle: { endOnEvents: ['ON_ATTACK_ROLL'] },
                outcomes: [{ id: pathId, effectKind: 'CONDITION', conditionId: INVISIBLE }]
              }
            }
          ]
        }
      ]
    }))
    const srd = compiledTrait('Imp', 'Invisibility')
    expect(authored.activeEffectPlan).toMatchObject({
      recurrenceStage: srd.activeEffectPlan?.recurrenceStage,
      initialRemaining: srd.activeEffectPlan?.initialRemaining,
      conditionContributions: srd.activeEffectPlan?.conditionContributions,
      lifecycle: srd.activeEffectPlan?.lifecycle,
      maintenance: srd.activeEffectPlan?.maintenance
    })
    expect(authored.activeEffectPlan).not.toBeNull()
  })
})
