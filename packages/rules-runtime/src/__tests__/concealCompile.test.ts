import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'

import {
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY,
  dnd5eCharacterRuleActionSystemAdapter
} from '../systems/dnd5e/effectActionCompiler.js'
import { characterActionDescriptor } from '../testing/characterActionDescriptor.js'
import { catalogueBasicActionEffect } from '../testing/concealmentFixture.js'

/** Every operation key the compiled output names, wherever it nests. */
function operationKeys(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return []
  const own =
    'operation' in value &&
    typeof value.operation === 'object' &&
    value.operation !== null &&
    'key' in value.operation &&
    typeof value.operation.key === 'string'
      ? [value.operation.key]
      : []
  return [...own, ...Object.values(value).flatMap(operationKeys)]
}

function compile(effect: EffectAuthored) {
  return dnd5eCharacterRuleActionSystemAdapter.compile({
    action: characterActionDescriptor(compileEffect(effect))
  })
}

describe('the SRD Hide and Search actions compile through core options (ATTACK-10.T1)', () => {
  it('compiles Hide, authored as a Stealth check against observers passive scores, to the conceal proposal', () => {
    expect(operationKeys(compile(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE)))).toContain(
      DND5E_CONCEAL_PROPOSAL_OPERATION_KEY
    )
  })

  it('compiles Search, authored as a Perception check against concealment, to the detect proposal', () => {
    expect(
      operationKeys(compile(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.SEARCH)))
    ).toContain(DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY)
  })

  it('plans the Hide concealment as an indefinite active effect consumed by the first attack roll', () => {
    const plans = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: characterActionDescriptor(
        compileEffect(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE))
      ),
      published: compile(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE))
    })
    expect(plans).toHaveLength(1)
    expect(plans?.[0]?.concealmentContribution).toEqual({ observers: 'NON_ALLIES' })
    expect(plans?.[0]?.initialRemaining).toBeNull()
    expect(plans?.[0]?.modifierGrantContribution ?? null).toBeNull()
  })
})
