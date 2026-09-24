import { describe, expect, it } from 'vitest'
import { SRD_REUSABLE_DEFINITIONS } from './catalogue.js'
import { srdBaselineContent } from './index.js'
import { prepareSrdImport } from './import.js'
import {
  SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID,
  SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
} from './concentration.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { BaselineContentBundle } from '../content.js'

function emptySubjectBundle(): BaselineContentBundle {
  return {
    ...structuredClone(srdBaselineContent),
    subjects: {
      backgrounds: [],
      classes: [],
      creatures: [],
      equipment: [],
      feats: [],
      races: [],
      spells: [],
      vehicles: []
    }
  }
}

describe('canonical Convex import preparation', () => {
  it('preserves every authored root and separate policy definition deterministically', () => {
    const result = prepareSrdImport()
    expect(result.subjects).toHaveLength(Object.values(srdBaselineContent.subjects).flat().length)
    expect(result.definitions).toHaveLength(SRD_REUSABLE_DEFINITIONS.length)
    expect(result.systems).toHaveLength(srdBaselineContent.vocabulary.systems.length)
    expect(result.manifestChecksum).toMatch(/^[a-f0-9]{64}$/)
    const reordered = structuredClone(srdBaselineContent)
    for (const records of Object.values(reordered.subjects)) records.reverse()
    expect(
      prepareSrdImport(reordered, [...SRD_REUSABLE_DEFINITIONS].reverse()).manifestChecksum
    ).toBe(result.manifestChecksum)
  }, 20_000)

  it('publishes the canonical concentration maintenance definition with its damage graph link', () => {
    const result = prepareSrdImport()
    const maintenance = result.definitions.find(
      (definition) => definition.id === SRD_DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    )
    expect(maintenance).toMatchObject({
      definitionFamilyKey: 'rule-maintenance',
      document: {
        kind: 'RULE_MAINTENANCE',
        gameSystemId: result.catalogue.gameSystemId,
        replacementPolicy: 'REPLACE_SAME_DEFINITION',
        emptyDependentPolicy: 'TERMINATE_WHEN_EMPTY',
        damageCheckDefinitionId: SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID
      }
    })
    expect(maintenance?.checksum).toBe(checksumRuleDocument(maintenance?.document))
    expect(
      result.definitions.some(
        (definition) => definition.id === SRD_DND5E_CONCENTRATION_CHECK_DEFINITION_ID
      )
    ).toBe(true)
  })

  it('rejects duplicate roots before persistence', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.backgrounds.push(
      srdBaselineContent.subjects.backgrounds[0],
      srdBaselineContent.subjects.backgrounds[0]
    )
    expect(() => prepareSrdImport(bundle)).toThrow('Duplicate canonical authored UUID')
  })

  it('rejects missing typed references and forged definition checksums', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.spells.push(structuredClone(srdBaselineContent.subjects.spells[0]))
    bundle.subjects.spells[0].classIds = ['ffffffff-ffff-4fff-8fff-ffffffffffff']
    expect(() => prepareSrdImport(bundle)).toThrow('references missing')
    const definitions = structuredClone(SRD_REUSABLE_DEFINITIONS)
    definitions[0].checksum = '0'.repeat(64)
    expect(() => prepareSrdImport(emptySubjectBundle(), definitions)).toThrow(
      'Invalid canonical definition'
    )
  })

  it('does not silently strip unknown canonical fields', () => {
    const bundle = emptySubjectBundle()
    bundle.subjects.backgrounds.push(structuredClone(srdBaselineContent.subjects.backgrounds[0]))
    Object.assign(bundle.subjects.backgrounds[0], { unknownMechanic: true })
    expect(() => prepareSrdImport(bundle)).toThrow('would change canonical source')
  })
})
