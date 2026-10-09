import { describe, expect, it } from 'vitest'

import {
  CHARACTER_GRANT_FOLD_MODEL_KEY,
  characterGrantFoldInputSchema,
  characterGrantFoldOutputSchema
} from '../api/characterGrantFoldRules.js'

const emptyInput = {
  contractVersion: 1,
  base: {
    systemId: 'dnd5e',
    totalLevel: 0,
    raceId: null,
    subraceId: null,
    size: null,
    abilities: {},
    heritageIds: [],
    featureIds: [],
    optionIds: [],
    featIds: [],
    classes: [],
    equipment: []
  },
  upstreamSpellIds: [],
  classes: [],
  background: null,
  features: [],
  activeEffects: [],
  equipmentItems: []
}

const emptyOutput = {
  proficiencies: [],
  senses: [],
  modifiers: [],
  unlockedFeatIds: [],
  unlockedSpellIds: [],
  activeSourceIds: [],
  activeEquipmentInstanceIds: [],
  equipmentFeatureChargeUses: [],
  modifierGroups: []
}

describe('Character grant-fold contracts', () => {
  it('publishes the reserved model key and accepts the bounded empty contract', () => {
    expect(CHARACTER_GRANT_FOLD_MODEL_KEY).toBe('character-grant-fold')
    expect(characterGrantFoldInputSchema.parse(emptyInput)).toEqual(emptyInput)
    expect(characterGrantFoldOutputSchema.parse(emptyOutput)).toEqual(emptyOutput)
  })

  it('rejects unknown fields and oversized collections', () => {
    expect(
      characterGrantFoldInputSchema.safeParse({ ...emptyInput, unexpected: true }).success
    ).toBe(false)
    expect(
      characterGrantFoldInputSchema.safeParse({
        ...emptyInput,
        upstreamSpellIds: Array.from({ length: 5_001 }, (_, index) => `spell-${index}`)
      }).success
    ).toBe(false)
    expect(
      characterGrantFoldOutputSchema.safeParse({ ...emptyOutput, unexpected: true }).success
    ).toBe(false)
  })
})
