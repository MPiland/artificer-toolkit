import { describe, expect, it } from 'vitest'

import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import type { EffectAuthored } from '@artificer-toolkit/shared/authored'
import { SRD_BASIC_ACTION_IDS } from '@artificer-toolkit/source-data/srd/basicActions.js'

import { prepareEncounterConcealmentEffect } from '../encounterActionEffectPlans.js'
import {
  DND5E_CONCEAL_PROPOSAL_OPERATION_KEY,
  DND5E_DETECT_CONCEALED_PROPOSAL_OPERATION_KEY
} from '../systems/dnd5e/effectActionContracts.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import { characterActionDescriptor } from '../testing/characterActionDescriptor.js'
import { catalogueBasicActionEffect } from '../testing/concealmentFixture.js'
import { testUuid } from '../testing/dnd5eSrdEncounter.js'

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

  /** `actionId`'s authored effect with the check (and so the DC) of another catalogue action. */
  function withCheckOf(actionId: string, checkActionId: string): EffectAuthored {
    const effect = catalogueBasicActionEffect(actionId)
    const { invocation } = catalogueBasicActionEffect(checkActionId)
    if (!('check' in invocation) || !('check' in effect.invocation))
      throw new Error('The basic action has no check.')
    return { ...effect, invocation: { ...effect.invocation, check: invocation.check } }
  }

  it('rejects a passive DC on any outcome but a conceal', () => {
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.SEARCH, SRD_BASIC_ACTION_IDS.HIDE))
    ).toThrow('passive DC and conceal outcome must be authored together')
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.FIRST_AID, SRD_BASIC_ACTION_IDS.HIDE))
    ).toThrow('passive DC and conceal outcome must be authored together')
  })

  it('rejects a concealment DC on any outcome but a detect', () => {
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.FIRST_AID, SRD_BASIC_ACTION_IDS.SEARCH))
    ).toThrow('concealment DC and detect outcome must be authored together')
  })

  it('rejects a conceal or detect outcome behind any other DC', () => {
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.HIDE, SRD_BASIC_ACTION_IDS.SEARCH))
    ).toThrow('passive DC and conceal outcome must be authored together')
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.HIDE, SRD_BASIC_ACTION_IDS.FIRST_AID))
    ).toThrow('passive DC and conceal outcome must be authored together')
    expect(() =>
      compile(withCheckOf(SRD_BASIC_ACTION_IDS.SEARCH, SRD_BASIC_ACTION_IDS.FIRST_AID))
    ).toThrow('concealment DC and detect outcome must be authored together')
  })

  it('rejects a conceal or detect outcome on an action that is not a check', () => {
    const dash = catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.DASH)
    for (const checkActionId of [SRD_BASIC_ACTION_IDS.HIDE, SRD_BASIC_ACTION_IDS.SEARCH]) {
      const [checkPath] = catalogueBasicActionEffect(checkActionId).paths
      if (checkPath?.selectionKind !== 'FIXED') throw new Error('Expected a fixed check path.')
      const effect: EffectAuthored = {
        ...dash,
        paths: dash.paths.map((path) => {
          if (path.selectionKind !== 'FIXED') throw new Error('Expected a fixed Dash path.')
          return {
            ...path,
            resultBlock: { ...path.resultBlock, outcomes: checkPath.resultBlock.outcomes }
          }
        })
      }
      expect(() => compile(effect)).toThrow('conceal and detect outcomes belong to a check action')
    }
  })

  it('plans the Hide concealment as an indefinite active effect consumed by the first attack roll', () => {
    const plans = dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({
      action: characterActionDescriptor(
        compileEffect(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE))
      ),
      published: compile(catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE))
    })
    expect(plans).toHaveLength(1)
    expect(plans?.[0]?.concealmentContribution).toEqual({
      observers: 'NON_ALLIES',
      endTriggers: [{ event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }]
    })
    expect(plans?.[0]?.initialRemaining).toBeNull()
    expect(plans?.[0]?.modifierGrantContribution ?? null).toBeNull()
  })

  it('plans the consume events the concealment authors, not a fixed one', () => {
    const hide = catalogueBasicActionEffect(SRD_BASIC_ACTION_IDS.HIDE)
    const effect: EffectAuthored = {
      ...hide,
      paths: hide.paths.map((path) => {
        if (path.selectionKind !== 'FIXED') throw new Error('Expected the Hide path to be fixed.')
        return {
          ...path,
          resultBlock: {
            ...path.resultBlock,
            lifecycle: {
              endTriggers: [
                { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ABILITY_CHECK' },
                { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }
              ]
            }
          }
        }
      })
    }
    const action = characterActionDescriptor(compileEffect(effect))
    const published = compile(effect)
    const [plan] =
      dnd5eCharacterRuleActionSystemAdapter.activeEffectPlans?.({ action, published }) ?? []
    expect(plan?.concealmentContribution?.endTriggers).toEqual([
      { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ABILITY_CHECK' },
      { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }
    ])
    const stored = prepareEncounterConcealmentEffect({
      encounterId: testUuid(0xc330),
      occurrenceId: testUuid(0xc331),
      commandId: testUuid(0xc332),
      sourceActorId: testUuid(0xc333),
      sourceLabel: 'Hide',
      sourceHidden: false,
      currentActorId: testUuid(0xc333),
      activeEffectPlan: plan ?? null,
      concealment: { concealmentTotal: 15, observerActorIds: [testUuid(0xc334)] },
      published: published as ServerPublishedRuleDefinitionDto
    })
    expect(stored?.definition.recurrence.endTriggers).toEqual([
      { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ABILITY_CHECK' },
      { event: 'LIFECYCLE', timing: 'CONSUME', code: 'ON_ATTACK_ROLL' }
    ])
  })
})
