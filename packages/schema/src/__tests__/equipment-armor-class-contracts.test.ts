import { describe, expect, it } from 'vitest'

import {
  equipmentAuthoredDtoSchema,
  equipmentAuthoringInputDtoSchema
} from '../subjects/equipment.js'
import type { z } from '../zod.js'

function equipment(category: string, armorClass?: number) {
  return {
    kind: 'EQUIPMENT',
    id: 'equipment',
    label: 'Equipment',
    description: null,
    rarityId: 'common',
    userId: 'user-1',
    systemId: 'system-1',
    category,
    properties: [],
    ...(armorClass === undefined ? {} : { armorClass })
  }
}

function armorClassIssues(schema: z.ZodMiniType, value: unknown) {
  const result = schema.safeParse(value)
  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path.join('.') === 'armorClass')
        .map((issue) => issue.message)
}

// D143: armor and shields author their Armor Class at authoring and publication.
describe('equipment Armor Class', () => {
  it.each([
    ['authored', equipmentAuthoredDtoSchema],
    ['authoring input', equipmentAuthoringInputDtoSchema]
  ] as const)('requires it on %s armor and shields only', (_name, schema) => {
    for (const category of ['ARMOR', 'SHIELD']) {
      expect(armorClassIssues(schema, equipment(category))).toEqual([
        'Armor and shields need an Armor Class.'
      ])
      expect(armorClassIssues(schema, equipment(category, 12))).toEqual([])
    }
    for (const category of ['WEAPON', 'ADVENTURING_GEAR', 'TOOL'])
      expect(armorClassIssues(schema, equipment(category))).toEqual([])
  })
})
