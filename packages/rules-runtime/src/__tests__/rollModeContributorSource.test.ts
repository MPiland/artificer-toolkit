import { describe, expect, it } from 'vitest'
import { ROLL_MODE_RULE_SOURCE_IDS } from '@artificer-toolkit/shared/rules/contributors'
import {
  rollModeContributorSourceOfMechanicSource,
  type D20Contributor
} from '@artificer-toolkit/shared/rules'

import {
  encounterRuleContributorSource,
  labelEncounterRollModeReasons,
  rollModeSourceKey
} from '../encounterRollModeReasons.js'

const EFFECT_ID = '3c1d2e4f-0a5b-4c6d-8e7f-1a2b3c4d5e6f'
const HOLDER_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d'

function contributor(overrides: Partial<D20Contributor>): D20Contributor {
  return {
    sourceId: 'opaque-source-id',
    grantId: null,
    domainKey: 'opaque-domain-key',
    influence: 'DISADVANTAGE',
    source: { kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: HOLDER_ID },
    ...overrides
  }
}

describe('roll-mode contributor source', () => {
  it('labels a contributor by its typed source, not by its opaque source id', () => {
    const typed = contributor({})
    const labelledByTypedSource = labelEncounterRollModeReasons(
      new Map([[rollModeSourceKey(typed.source), 'Dodge']])
    )
    const labelledByOpaqueId = labelEncounterRollModeReasons(new Map([[typed.sourceId, 'Dodge']]))
    const input = { rollMode: 'DISADVANTAGE', contributors: [typed] } as const

    expect(labelledByTypedSource(input)).toEqual(['Dodge'])
    expect(labelledByOpaqueId(input)).toEqual([])
  })

  it('labels a rules-owned contributor by its rule id whatever its other ids say', () => {
    const longRange = contributor({
      sourceId: 'unrelated',
      domainKey: null,
      source: encounterRuleContributorSource(ROLL_MODE_RULE_SOURCE_IDS.LONG_RANGE)
    })

    expect(
      labelEncounterRollModeReasons(new Map())({
        rollMode: 'DISADVANTAGE',
        contributors: [longRange]
      })
    ).toEqual(['Long range'])
  })

  it('keeps a hidden holder behind the generic reason, never its own label', () => {
    const typed = contributor({})
    const reasons = labelEncounterRollModeReasons(
      new Map([[rollModeSourceKey(typed.source), 'Dodge']]),
      () => true
    )

    expect(reasons({ rollMode: 'DISADVANTAGE', contributors: [typed] })).toEqual(['Unseen source'])
  })

  it('keys one active effect the same whichever Character mechanic source names it', () => {
    expect(
      rollModeContributorSourceOfMechanicSource({
        kind: 'ACTIVE_EFFECT',
        activeEffectId: EFFECT_ID
      })
    ).toEqual({ kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: null })
    expect(
      rollModeContributorSourceOfMechanicSource(
        { kind: 'ACTIVE_EFFECT', activeEffectId: EFFECT_ID },
        HOLDER_ID
      )
    ).toEqual({ kind: 'ACTIVE_EFFECT', id: EFFECT_ID, holderActorId: HOLDER_ID })
  })

  it('names an authored definition by the definition id', () => {
    expect(
      rollModeContributorSourceOfMechanicSource({ kind: 'AUTHORED', definitionId: EFFECT_ID })
    ).toEqual({ kind: 'AUTHORED', id: EFFECT_ID, holderActorId: null })
  })
})
