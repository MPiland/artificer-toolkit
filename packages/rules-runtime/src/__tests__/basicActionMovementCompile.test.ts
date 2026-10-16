import { describe, expect, it } from 'vitest'

import { compileEffect } from '@artificer-toolkit/shared/compilers'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'

import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const ADD_SPEED_OPERATION_KEY = 'dnd5e.add-speed-to-movement-proposal'

/** The graph the real dnd5e compiler publishes for one SRD basic action's authored effect. */
function publishedGraphOf(actionId: string): string {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === actionId)?.document.effects[0]
  if (!effect) throw new Error('The SRD basic action has no authored effect.')
  const action = characterActionDescriptor(compileEffect({ ...effect, id: ACTION_EFFECT_ID }))
  return JSON.stringify(dnd5eCharacterRuleActionSystemAdapter.compile({ action }))
}

describe('the movement basic actions compile through the dnd5e adapter', () => {
  it('compiles Dash to the instant add-speed-to-movement proposal', () => {
    expect(publishedGraphOf(SRD_BASIC_ACTION_IDS.DASH)).toContain(ADD_SPEED_OPERATION_KEY)
  })

  it('compiles Disengage to a grant, not a movement proposal', () => {
    expect(publishedGraphOf(SRD_BASIC_ACTION_IDS.DISENGAGE)).not.toContain(ADD_SPEED_OPERATION_KEY)
  })
})
