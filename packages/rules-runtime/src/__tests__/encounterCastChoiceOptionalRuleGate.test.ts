import { effectDtoSchema } from '@artificer-toolkit/schema/effects'
import { DND5E_SHOVE_ASIDE_DEFINITION_ID } from '@artificer-toolkit/schema/shared/optionalCombat'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { PATH_NODE_MAP } from '@artificer-toolkit/shared/maps'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { describe, expect, it } from 'vitest'

import {
  buildCompiledActionTargetPolicy,
  compileCastChoicePlans
} from '../encounterActionEntryPointCompiler.js'
import {
  castChoiceOptions,
  offeredCastChoiceOptions,
  pickedCastChoiceEffect
} from '../encounterCastChoice.js'
import { CastChoiceUnavailableError } from '../encounterErrors.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

const TRIP_OPTION_ID = '00000000-0000-4000-8000-0000000002a1'
const SHOVE_ASIDE = { definitionId: DND5E_SHOVE_ASIDE_DEFINITION_ID }

/**
 * The SRD Shove with a Trip option added to its pick, offered only under the Shove Aside optional
 * rule; `first` places Trip before the SRD options.
 */
function gatedShoveEffect(first = false) {
  const effect = SRD_BASIC_ACTION_DEFINITIONS.find(({ id }) => id === SRD_BASIC_ACTION_IDS.SHOVE)
    ?.document.effects[0]
  const path = effect?.paths[0]
  if (path?.selectionKind !== 'CHOICE') throw new Error('Shove has no pick.')
  const [knockProne] = path.options
  const trip = {
    ...knockProne!,
    id: TRIP_OPTION_ID,
    label: 'Trip',
    requiresOptionalRule: SHOVE_ASIDE,
    resultBlock: {
      ...knockProne!.resultBlock,
      id: '00000000-0000-4000-8000-0000000002a2',
      outcomes: knockProne!.resultBlock.outcomes.map((outcome) => ({
        ...outcome,
        id: '00000000-0000-4000-8000-0000000002a3'
      }))
    }
  }
  const options = first ? [trip, ...path.options] : [...path.options, trip]
  return {
    ...effect!,
    id: ACTION_EFFECT_ID,
    paths: [{ ...path, options: options.map((option, index) => ({ ...option, order: index + 1 })) }]
  }
}

const compiledGatedShove = (first = false) => compileEffect(gatedShoveEffect(first))
const labels = (options: readonly { label: string }[]) => options.map(({ label }) => label)

describe('A cast pick option gated on an optional combat rule (MOVE-2.T2a)', () => {
  it('is authored from core options: the schema accepts the gate and the option map offers it', () => {
    expect(effectDtoSchema.safeParse(gatedShoveEffect()).success).toBe(true)
    const optionsNode = PATH_NODE_MAP.nodes.options
    if (optionsNode?.kind !== 'GROUP') throw new Error('Expected choice options to be a group.')
    const optionMap =
      typeof optionsNode.nodes === 'function' ? optionsNode.nodes() : optionsNode.nodes
    const gateNode = optionMap.nodes.requiresOptionalRule
    if (gateNode?.kind !== 'GROUP') throw new Error('Expected the option gate to be a group.')
    const gateMap = typeof gateNode.nodes === 'function' ? gateNode.nodes() : gateNode.nodes
    expect(gateMap.nodes.definitionId).toMatchObject({ kind: 'INPUT', type: 'SELECT_SINGLE' })
  })

  it('carries the gate from the authored option onto its compiled pick option', () => {
    const options = castChoiceOptions(compiledGatedShove())
    expect(
      options?.map(({ label, requiresOptionalRule }) => ({ label, requiresOptionalRule }))
    ).toEqual([
      { label: 'Knock prone', requiresOptionalRule: undefined },
      { label: 'Push 5 feet away', requiresOptionalRule: undefined },
      { label: 'Trip', requiresOptionalRule: SHOVE_ASIDE }
    ])
  })

  it('offers the gated option only while its rule is among the active ones', () => {
    const options = castChoiceOptions(compiledGatedShove())!
    expect(labels(offeredCastChoiceOptions(options, []))).toEqual([
      'Knock prone',
      'Push 5 feet away'
    ])
    expect(labels(offeredCastChoiceOptions(options, [{ definitionId: 'another-rule' }]))).toEqual([
      'Knock prone',
      'Push 5 feet away'
    ])
    expect(labels(offeredCastChoiceOptions(options, [SHOVE_ASIDE]))).toEqual([
      'Knock prone',
      'Push 5 feet away',
      'Trip'
    ])
  })

  it('refuses a pick of the gated option without its rule and runs it with the rule', () => {
    const compiledEffect = compiledGatedShove()
    expect(() => pickedCastChoiceEffect(compiledEffect, TRIP_OPTION_ID, [])).toThrow(
      CastChoiceUnavailableError
    )
    const picked = pickedCastChoiceEffect(compiledEffect, TRIP_OPTION_ID, [SHOVE_ASIDE])
    expect(picked.entries.filter(({ groupKind }) => groupKind === 'CHOICE')).toEqual([])
    expect(picked.entries.some((entry) => entry.entryId === TRIP_OPTION_ID)).toBe(true)
  })

  it('skips a gated first option for the default read of the shared test', () => {
    const compiledEffect = compiledGatedShove(true)
    const fallback = pickedCastChoiceEffect(compiledEffect, undefined, [], true)
    expect(fallback.entries.some((entry) => entry.entryId === TRIP_OPTION_ID)).toBe(false)
    const ruled = pickedCastChoiceEffect(compiledEffect, undefined, [SHOVE_ASIDE], true)
    expect(ruled.entries.some((entry) => entry.entryId === TRIP_OPTION_ID)).toBe(true)
  })

  it('persists the gate on the Character entry point pick it compiles', () => {
    const descriptor = {
      ...characterActionDescriptor(compiledGatedShove()),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id)
    }
    const { choice } = compileCastChoicePlans(
      dnd5eCharacterRuleActionSystemAdapter,
      descriptor,
      buildCompiledActionTargetPolicy(descriptor)
    )
    expect(
      choice?.options.map(({ label, requiresOptionalRule }) => ({ label, requiresOptionalRule }))
    ).toEqual([
      { label: 'Knock prone', requiresOptionalRule: undefined },
      { label: 'Push 5 feet away', requiresOptionalRule: undefined },
      { label: 'Trip', requiresOptionalRule: SHOVE_ASIDE }
    ])
  })
})
