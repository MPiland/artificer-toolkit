import { describe, expect, it } from 'vitest'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/concentration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { prepareEncounterActionEffectPlans } from '../encounterActionEffectPlans.js'
import { compileEncounterFeatureActionPlan } from '../encounterActionEntryPointCompiler.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'
import { actionEndedEffects } from '../encounterEndedEffectRelease.js'
import { createEncounterFeatureActionCapabilityDiscoveryRegistry } from '../encounterFeatureActionCapabilityDiscovery.js'
import { dnd5eEncounterFeatureActionCapabilityAdapter } from '../systems/dnd5e/encounterFeatureActionCapabilityDiscovery.js'
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
const discovery = createEncounterFeatureActionCapabilityDiscoveryRegistry([
  dnd5eEncounterFeatureActionCapabilityAdapter
])

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

/** The action the room runs for a Creature trait: its capability, compiled graph and active-effect plan. */
function compiledTrait(creatureLabel: string, featureLabel: string) {
  const creature = srdBaselineContent.subjects.creatures.find(
    ({ label }) => label === creatureLabel
  )
  if (!creature) throw new Error(`SRD Creature "${creatureLabel}" is missing.`)
  const feature = creatureFeature(creature, featureLabel)
  const actor = srdCreatureActor({ id: testUuid(0x2000), creature })
  const capability = discovery
    .discover({ actor, conditionDefinitionIds, abilityDefinitions })
    .available.find((candidate) => candidate.ownerFeatureId === feature.id)
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
        conditionContribution: {
          conditionId: INVISIBLE,
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
      }).map(({ id }) => id)
    expect(ended({ makesAttackRoll: true })).toEqual([testUuid(0x2003)])
    expect(ended({ makesAttackRoll: false, castsSpell: true })).toEqual([testUuid(0x2003)])
    expect(ended({ makesAttackRoll: false })).toEqual([])
  })
})
