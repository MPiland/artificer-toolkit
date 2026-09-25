import { describe, expect, it } from 'vitest'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'

import {
  encounterActorRelationship,
  evaluateEncounterActionTargetPolicy
} from '../encounterActionTargetPolicy.js'

const DISPOSITIONS: readonly EncounterActorDispositionDto[] = ['FRIENDLY', 'NEUTRAL', 'HOSTILE']

function dispositionWarnings(
  dispositionKind: 'ANY' | 'WILLING' | 'HOSTILE',
  source: EncounterActorDispositionDto,
  target: EncounterActorDispositionDto
) {
  const warnings = evaluateEncounterActionTargetPolicy({
    actor: { id: 'source', disposition: source },
    target: { id: 'target', disposition: target },
    targetPolicy: {
      range: { id: 'range', rangeKind: 'UNLIMITED' },
      targeting: { selectionKind: 'SINGLE_TARGET', dispositionKind },
      shape: null,
      pathOverrides: []
    },
    sceneContext: null
  })
  if (warnings === null) throw new Error('Expected a resolvable single-target policy.')
  return warnings.filter((warning) => warning.code === 'TARGET_DISPOSITION')
}

describe('encounter action target disposition', () => {
  it('treats neutral as neutral to everyone, equal dispositions as allied, and opposites as hostile', () => {
    expect(encounterActorRelationship('FRIENDLY', 'FRIENDLY')).toBe('ALLIED')
    expect(encounterActorRelationship('HOSTILE', 'HOSTILE')).toBe('ALLIED')
    expect(encounterActorRelationship('FRIENDLY', 'HOSTILE')).toBe('HOSTILE')
    expect(encounterActorRelationship('HOSTILE', 'FRIENDLY')).toBe('HOSTILE')
    for (const other of DISPOSITIONS) {
      expect(encounterActorRelationship('NEUTRAL', other)).toBe('NEUTRAL')
      expect(encounterActorRelationship(other, 'NEUTRAL')).toBe('NEUTRAL')
    }
  })

  it('warns a willing-target action only when source and target are hostile to each other', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS) {
        const hostile = encounterActorRelationship(source, target) === 'HOSTILE'
        expect(dispositionWarnings('WILLING', source, target)).toEqual(
          hostile
            ? [{ code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' }]
            : []
        )
      }
  })

  it('warns a hostile-target action only when source and target are allied', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS) {
        const allied = source !== 'NEUTRAL' && source === target
        expect(dispositionWarnings('HOSTILE', source, target)).toEqual(
          allied
            ? [{ code: 'TARGET_DISPOSITION', message: 'This action targets hostile creatures.' }]
            : []
        )
      }
  })

  it('never warns an any-target action about disposition', () => {
    for (const source of DISPOSITIONS)
      for (const target of DISPOSITIONS)
        expect(dispositionWarnings('ANY', source, target)).toEqual([])
  })
})
