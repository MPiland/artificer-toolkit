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
    completedContest: false,
    ...overrides
  }
}

describe('classifyNativeEncounterOccurrence', () => {
  it('assigns every pending context kind to its native coordinator', () => {
    const cases: Array<[NativeEncounterOccurrenceFacts, string]> = [
      [facts({ kind: 'ENCOUNTER_ACTION' }), 'ACTION'],
      [
        facts({
          kind: 'ENCOUNTER_ACTION',
          contest: { origin: { kind: 'OPTIONAL_COMBAT', actionKind: 'DISARM' } }
        }),
        'CONTEST'
      ],
      [
        facts({
          kind: 'ENCOUNTER_ACTION',
          contest: { origin: { kind: 'OPTIONAL_COMBAT', actionKind: 'SHOVE' } }
        }),
        'ACTION'
      ],
      [
        facts({ kind: 'ENCOUNTER_ACTION', contest: { origin: { kind: 'BASIC_ACTION' } } }),
        'CONTEST'
      ],
      [
        facts(
          { kind: 'ENCOUNTER_ACTION', contest: { origin: { kind: 'ESCAPE' } } },
          { rootCommandType: 'ESCAPE' }
        ),
        'CONTEST'
      ],
      [facts({ kind: 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING' }), 'CLEAVING'],
      [facts({ kind: 'ENCOUNTER_CONCEALMENT_CHECK' }), 'BASIC_ACTION'],
      [facts({ kind: 'ENCOUNTER_ESCAPE_CHECK' }), 'ESCAPE'],
      [facts(null, { rootCommandType: 'ESCAPE' }), 'ESCAPE'],
      [facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_INITIATIVE_DECLARATION' }), 'TURN'],
      [facts({ kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_REACTION' }), 'MOVEMENT'],
      [facts({ kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }), 'MOVEMENT'],
      [
        facts({
          kind: 'ENCOUNTER_CONTEST_CHECK',
          origin: { kind: 'OPTIONAL_COMBAT', movementContinuation: {} }
        }),
        'MOVEMENT'
      ],
      [facts({ kind: 'ENCOUNTER_CONTEST_CHECK' }), 'OTHER'],
      [facts({ kind: 'ENCOUNTER_DAMAGE_SAVE_CHECK' }), 'OTHER'],
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
          {
            kind: 'ENCOUNTER_ACTION',
            contest: { origin: { kind: 'OPTIONAL_COMBAT', actionKind: 'DISARM' } }
          },
          {
            occurrence: concentrationRoot
          }
        )
      )
    ).toBe('CONTEST')
    expect(
      classifyNativeEncounterOccurrence(
        facts({ kind: 'ENCOUNTER_TURN_RECHARGE' }, { rootCommandType: 'RESOLVE_ACTION' })
      )
    ).toBe('ACTION')
    expect(classifyNativeEncounterOccurrence(facts(null, { completedContest: true }))).toBe(
      'CONTEST'
    )
  })
})
