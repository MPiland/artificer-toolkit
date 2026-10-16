import { describe, expect, it } from 'vitest'
import { cleavingChildCommandIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { concentrationCommandId } from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  classifyNativeEncounterOccurrence,
  type NativeEncounterOccurrenceFacts
} from '../occurrenceOwner.js'

function facts(
  context: NativeEncounterOccurrenceFacts['context'],
  overrides: Partial<Omit<NativeEncounterOccurrenceFacts, 'context'>> = {}
): NativeEncounterOccurrenceFacts {
  return {
    occurrence: { id: 'occurrence-1', rootCommandId: 'root-1' },
    context,
    rootCommandType: null,
    completedDisarm: false,
    ...overrides
  }
}

describe('classifyNativeEncounterOccurrence', () => {
  it('assigns every pending context kind to its native coordinator', () => {
    const cases: Array<[NativeEncounterOccurrenceFacts, string]> = [
      [facts({ kind: 'ENCOUNTER_ACTION' }), 'ACTION'],
      [facts({ kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'DISARM' } }), 'DISARM'],
      [facts({ kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'SHOVE' } }), 'ACTION'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }), 'CLEAVING'],
      [facts({ kind: 'ENCOUNTER_BASIC_ACTION_CHECK' }), 'BASIC_ACTION'],
      [facts({ kind: 'ENCOUNTER_CONCEALMENT_CHECK' }), 'BASIC_ACTION'],
      [facts({ kind: 'ENCOUNTER_ESCAPE_CHECK' }), 'ESCAPE'],
      [facts(null, { rootCommandType: 'ESCAPE_RELATIONSHIP' }), 'ESCAPE'],
      [facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE_DECLARATION' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_REACTION' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST', movementContinuation: {} }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }), 'OTHER'],
      [facts({ kind: 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK' }), 'OTHER'],
      [facts(null), 'OTHER']
    ]
    for (const [input, owner] of cases)
      expect(classifyNativeEncounterOccurrence(input), input.context?.kind ?? 'null').toBe(owner)
  })

  it('keeps native resume precedence ahead of the context kind', () => {
    const concentrationRoot = {
      id: 'occurrence-1',
      rootCommandId: concentrationCommandId('occurrence-1')
    }
    const cleavingRoot = {
      id: 'occurrence-1',
      rootCommandId: cleavingChildCommandIdentity('occurrence-1')
    }
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_ACTION' }, { occurrence: concentrationRoot })
      )
    ).toBe('CONCENTRATION')
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_ACTION' }, { occurrence: cleavingRoot })
      )
    ).toBe('CLEAVING')
    expect(
      classifyNativeEncounterOccurrence(
        facts(
          { kind: 'ENCOUNTER_ACTION', contest: { actionKind: 'DISARM' } },
          {
            occurrence: concentrationRoot
          }
        )
      )
    ).toBe('DISARM')
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }, { rootCommandType: 'RESOLVE_ACTION' })
      )
    ).toBe('ACTION')
    expect(classifyNativeEncounterOccurrence(facts(null, { completedDisarm: true }))).toBe('DISARM')
  })
})
