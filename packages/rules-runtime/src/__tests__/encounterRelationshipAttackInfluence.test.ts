import type { ActiveRuleEffectDefinitionDto } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { describe, expect, it } from 'vitest'

import { lockedRelationshipActionFacts } from '../encounterRelationshipActionFacts.js'
import { escapeGrappleEffectDefinition } from '../testing/escapeGrappleEffectFixture.js'

const ENCOUNTER = '00000000-0000-4000-8000-000000000001'
const SOURCE = '00000000-0000-4000-8000-0000000000a1'
const TARGET = '00000000-0000-4000-8000-0000000000a2'
const SCOPED_ACTION = '00000000-0000-4000-8000-0000000000b1'
const OTHER_ACTION = '00000000-0000-4000-8000-0000000000b2'

function influenceEffect(actionEffectIds: string[]) {
  const definition = escapeGrappleEffectDefinition({
    encounterId: ENCOUNTER,
    grapplerId: SOURCE,
    conditionIds: []
  })
  if (definition.schemaVersion !== 2) throw new Error('Expected a schema 2 effect.')
  const [contribution] = definition.stateContributions
  if (contribution?.kind !== 'ACTOR_RELATIONSHIP') throw new Error('Expected a relationship.')
  const scoped: ActiveRuleEffectDefinitionDto = {
    ...definition,
    stateContributions: [
      {
        ...contribution,
        modules: [
          {
            id: '00000000-0000-4000-8000-0000000000c1',
            order: 0,
            kind: 'SOURCE_ATTACK_ROLL_INFLUENCE',
            actionEffectIds,
            influence: 'ADVANTAGE'
          }
        ]
      }
    ]
  }
  return { id: 'effect-1', definition: scoped }
}

function contributorsFor(actionEffectIds: string[], actionEffectId: string) {
  return lockedRelationshipActionFacts({
    actionEffectId,
    sourceActorId: SOURCE,
    targetActorId: TARGET,
    targets: { activeEffectsByActorId: new Map([[TARGET, [influenceEffect(actionEffectIds)]]]) }
  })
}

describe('a relationship that influences the source attack rolls', () => {
  it('gives advantage on every attack when its scope is empty', () => {
    for (const actionEffectId of [SCOPED_ACTION, OTHER_ACTION])
      expect(contributorsFor([], actionEffectId)).toMatchObject([{ influence: 'ADVANTAGE' }])
  })

  it('stays limited to the listed attacks when it names them', () => {
    expect(contributorsFor([SCOPED_ACTION], SCOPED_ACTION)).toHaveLength(1)
    expect(contributorsFor([SCOPED_ACTION], OTHER_ACTION)).toEqual([])
  })
})
