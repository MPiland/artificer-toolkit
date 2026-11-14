import { describe, expect, it } from 'vitest'

import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS } from '../shared/reusableDefinitionIdentity.js'
import { installedDefinitionDocumentFamilies } from '../systems/installedSystemDefinitionDocuments.js'
import {
  installedDefinitionFamilyKeys,
  installedModifierGrantKinds
} from '../systems/installedSystemSchemas.js'

/** QUALITY-16.T3: the persisted contracts take each installed System's extensions from its lists. */

const base = {
  grantKind: 'MODIFIER_GRANT',
  id: 'system-grant',
  order: 1,
  selectionKind: 'GRANTED',
  scope: 'GLOBAL'
}

describe('System schema extensions', () => {
  it.each(installedModifierGrantKinds)(
    'accepts the $valueDomainCode grant kind as a bare flag and refuses it with a domain, a payload or another modifier kind',
    ({ valueDomainCode, modifierKind }) => {
      const grant = { ...base, valueDomainCode, modifierKind, domain: {} }
      expect(modifierGrantDtoSchema.safeParse(grant).success).toBe(true)
      expect(
        modifierGrantDtoSchema.safeParse({ ...grant, domain: { speedId: 'walk' } }).success
      ).toBe(false)
      expect(modifierGrantDtoSchema.safeParse({ ...grant, payload: { amount: 1 } }).success).toBe(
        false
      )
      expect(
        modifierGrantDtoSchema.safeParse({
          ...grant,
          modifierKind: modifierKind === 'BONUS' ? 'PENALTY' : 'BONUS'
        }).success
      ).toBe(false)
    }
  )

  it('authors every installed definition family, with one document family per stored key', () => {
    expect(REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS).toEqual(
      expect.arrayContaining([...installedDefinitionFamilyKeys])
    )
    expect(installedDefinitionDocumentFamilies.map(({ familyKey }) => familyKey)).toEqual([
      ...installedDefinitionFamilyKeys
    ])
  })
})
