import { describe, expect, it } from 'vitest'
import { SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS } from '@artificer-toolkit/source-data/srd/initiativePolicies.js'

import { compileEncounterInitiativeDeclaration } from '../encounterInitiativeDeclarationCompiler.js'
import { EncounterValidationError } from '../encounterErrors.js'
import { ACTOR_A } from './encounterInitiativeFixtures.js'

/**
 * ENCOUNTER-4.T1: a GM-adjudicated declaration for a custom actor may name only the sizes and action
 * factors the frozen policy authored.
 */

const [authoredFactor] = SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS.factors

function compile(input: { actorSize: string; factorIds: string[] }) {
  return compileEncounterInitiativeDeclaration({
    source: { kind: 'CUSTOM', actor: { id: ACTOR_A } },
    declarationModifiers: SRD_DND5E_SPEED_FACTOR_DECLARATION_MODIFIERS,
    primary: {
      kind: 'GM_ADJUDICATED',
      optionId: 'GM_ADJUDICATED',
      actorSize: input.actorSize,
      factorIds: input.factorIds,
      spellLevel: null
    },
    bonus: null
  })
}

describe('compiling a custom actor declaration (ENCOUNTER-4.1)', () => {
  it('accepts an authored size and factor', () => {
    const { declaration } = compile({ actorSize: 'SMALL', factorIds: [authoredFactor!.id] })

    expect(declaration).toMatchObject({
      actorSize: 'SMALL',
      primary: { kind: 'GM_ADJUDICATED', factorIds: [authoredFactor!.id] }
    })
  })

  it('refuses an action factor the policy did not author', () => {
    expect(() =>
      compile({ actorSize: 'SMALL', factorIds: ['00000000-0000-4000-8000-00000000ffff'] })
    ).toThrow(new EncounterValidationError('The adjudicated action factor is not authored.'))
  })

  it('refuses an actor size the policy did not author', () => {
    expect(() => compile({ actorSize: 'COLOSSAL', factorIds: [] })).toThrow(
      new EncounterValidationError('The adjudicated actor size is not authored.')
    )
  })
})
