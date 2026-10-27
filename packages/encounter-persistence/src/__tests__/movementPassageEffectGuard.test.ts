import { prepareActiveRuleEffectRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import {
  ENCOUNTER_ID,
  creatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { escapeGrappleEffectDefinition } from '@artificer-toolkit/rules-runtime/testing/escapeGrappleEffectFixture'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import { assertPassageEffectMatches } from '../movementSettlementPersistence.js'

/**
 * The room plans the effect a won passage leaves on its blocker, but the commit re-validates it:
 * a step carrying an effect for another owner, source or command is refused before it is stored.
 */

const BLOCKER_ID = '00000000-0000-4000-8000-0000000000b1'
const SOURCE_ID = '00000000-0000-4000-8000-0000000000b2'
const OTHER_ID = '00000000-0000-4000-8000-0000000000b3'
const blocker = creatureActor({ id: BLOCKER_ID, kind: 'CUSTOM', snapshot: {} })

const definition = escapeGrappleEffectDefinition({
  encounterId: ENCOUNTER_ID,
  grapplerId: SOURCE_ID,
  conditionIds: []
})
if (definition.origin.kind !== 'ENCOUNTER') throw new Error('Expected an Encounter origin.')
const { sourceOccurrenceId, rootCommandId } = definition.origin

const effect = prepareActiveRuleEffectRecord({
  id: '00000000-0000-4000-8000-0000000000b4',
  owner: turnEffectOwner(blocker, ENCOUNTER_ID),
  definition,
  lifecycle: { schemaVersion: 1, remainingTicks: null },
  currentEffects: [],
  occurredAt: '2026-01-01T00:00:00.000Z'
})

const expected = {
  blocker,
  encounterId: ENCOUNTER_ID,
  gameSystemId: SRD_SYSTEM_ID,
  sourceActorId: SOURCE_ID,
  occurrenceId: sourceOccurrenceId,
  commandId: rootCommandId
}
const REFUSAL = 'Movement passage effect does not match its blocker and source.'

describe('assertPassageEffectMatches', () => {
  it('accepts the effect the passage planned for its blocker', () => {
    expect(() => assertPassageEffectMatches(effect, expected)).not.toThrow()
  })

  it.each([
    ['another owner', { ...effect, owner: { ...effect.owner, targetActorId: OTHER_ID } }],
    ['a maintained effect state', { ...effect, maintainedEffectStateId: OTHER_ID }],
    ['another sourcing Encounter', { ...effect, sourceEncounterId: OTHER_ID }]
  ])('refuses an effect carrying %s', (_name, tampered) => {
    expect(() => assertPassageEffectMatches(tampered as typeof effect, expected)).toThrow(REFUSAL)
  })

  it.each([
    ['another Encounter origin', { sourceAggregateId: OTHER_ID }],
    ['another source actor', { sourceActorId: OTHER_ID }],
    ['another occurrence', { sourceOccurrenceId: OTHER_ID }],
    ['another root command', { rootCommandId: OTHER_ID }]
  ])('refuses an effect with %s', (_name, origin) => {
    const tampered = {
      ...effect,
      definition: { ...effect.definition, origin: { ...effect.definition.origin, ...origin } }
    }
    expect(() => assertPassageEffectMatches(tampered as typeof effect, expected)).toThrow(REFUSAL)
  })

  it('refuses an effect of another Game System, or one whose blocker is missing', () => {
    const tampered = {
      ...effect,
      definition: {
        ...effect.definition,
        frozenGraph: {
          ...effect.definition.frozenGraph,
          source: { ...effect.definition.frozenGraph.source, gameSystemId: OTHER_ID }
        }
      }
    }
    expect(() => assertPassageEffectMatches(tampered as typeof effect, expected)).toThrow(REFUSAL)
    expect(() => assertPassageEffectMatches(effect, { ...expected, blocker: undefined })).toThrow(
      REFUSAL
    )
  })
})
