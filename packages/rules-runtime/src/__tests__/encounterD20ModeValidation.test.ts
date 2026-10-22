import { describe, expect, it } from 'vitest'

import { EncounterValidationError } from '../encounterErrors.js'
import { requireDerivedD20Mode } from '../encounterD20ModeValidation.js'
import { resolveEncounterD20Answer } from '../encounterEvidenceAnswer.js'
import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'

const contributors = [{ influence: 'ADVANTAGE' }]
const derived = rollModeCapabilityRegistry.resolveRollMode({
  gameSystemId: DND5E_SYSTEM_ID,
  contributors
})

describe('stored d20 mode seam', () => {
  it('accepts the mode and keep the System derives from the contributors', () => {
    expect(() =>
      requireDerivedD20Mode({ gameSystemId: DND5E_SYSTEM_ID, contributors, ...derived })
    ).not.toThrow()
  })

  it('refuses a stored mode the contributors do not derive', () => {
    expect(() =>
      requireDerivedD20Mode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors,
        rollMode: 'NORMAL',
        keep: 'FIRST'
      })
    ).toThrow(EncounterValidationError)
  })

  it('names the contributor disagreement when a belief claims NORMAL under ADVANTAGE', () => {
    expect(() =>
      requireDerivedD20Mode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors,
        rollMode: 'NORMAL',
        keep: 'FIRST'
      })
    ).toThrow('The d20 roll mode does not match its contributors.')
  })

  it('refuses a stored keep the derived mode does not take', () => {
    expect(() =>
      requireDerivedD20Mode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors,
        rollMode: derived.rollMode,
        keep: 'LOWER'
      })
    ).toThrow(EncounterValidationError)
  })

  it('checks a derived mode that carries no keep by mode alone', () => {
    expect(() =>
      requireDerivedD20Mode({
        gameSystemId: DND5E_SYSTEM_ID,
        contributors,
        rollMode: derived.rollMode
      })
    ).not.toThrow()
    expect(() =>
      requireDerivedD20Mode({ gameSystemId: DND5E_SYSTEM_ID, contributors, rollMode: 'NORMAL' })
    ).toThrow(EncounterValidationError)
  })
})

describe('entered d20 keep seam', () => {
  const resolve = (rollMode: string, rawFaces: number[]) =>
    resolveEncounterD20Answer({
      gameSystemId: DND5E_SYSTEM_ID,
      derived,
      answer: { kind: 'ENTER_DICE' as const, requestId: 'request', rawFaces, rollMode },
      rollD20: () => 1
    })

  it('settles entered dice with the keep the System derives from their mode', () => {
    expect(resolve(derived.rollMode, [4, 15])).toMatchObject({ natural: 15, keep: derived.keep })
  })

  it('refuses entered dice whose face count their mode does not take', () => {
    expect(() => resolve(derived.rollMode, [4])).toThrow(EncounterValidationError)
  })
})
