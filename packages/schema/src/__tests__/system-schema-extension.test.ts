import { describe, expect, it } from 'vitest'

import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { REUSABLE_DEFINITION_AUTHORING_FAMILY_KEYS } from '../shared/reusableDefinitionIdentity.js'
import {
  uniqueReceiptBindings,
  type SystemModifierGrantKind,
  type SystemReceiptBindings
} from '../shared/systemSchemaExtension.js'
import { installedDefinitionDocumentFamilies } from '../systems/installedSystemDefinitionDocuments.js'
import {
  installedDefinitionFamilyKeys,
  installedModifierGrantKinds,
  installedReceiptBindings
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
    ({ valueDomainCode, modifierKind }: SystemModifierGrantKind) => {
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

describe('installed receipt bindings (QUALITY-16.T4)', () => {
  const [dnd5e] = installedReceiptBindings
  const another = (testOperationKey: string): SystemReceiptBindings => ({
    relationshipStateOperationKey: `${testOperationKey}.relationship`,
    durationOperationKey: `${testOperationKey}.duration`,
    repeatSave: {
      ...dnd5e.repeatSave,
      testOperationKey,
      rulingOperationKey: `${testOperationKey}.ruling`
    }
  })

  it('accepts bindings whose operation keys are all distinct, as the installed ones are', () => {
    expect(uniqueReceiptBindings([dnd5e, another('other.save-test')])).toHaveLength(2)
    expect(uniqueReceiptBindings(installedReceiptBindings)).toBe(installedReceiptBindings)
  })

  it.each([
    ['two Systems', () => [dnd5e, dnd5e]],
    [
      'one System for two roles',
      () => [{ ...dnd5e, durationOperationKey: dnd5e.relationshipStateOperationKey }]
    ],
    [
      'a ruling that repeats the save test',
      () => [
        {
          ...dnd5e,
          repeatSave: { ...dnd5e.repeatSave, rulingOperationKey: dnd5e.repeatSave.testOperationKey }
        }
      ]
    ]
  ])('fails the install when an operation key is bound twice by %s', (_name, build) => {
    expect(() => uniqueReceiptBindings(build())).toThrow(
      /Receipt binding operation key ".+" is bound by .+ and by .+; each must be unique\./
    )
  })
})
