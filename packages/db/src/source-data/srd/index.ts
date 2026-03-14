import { defineBaselineContentBundle } from '../content.js'

/**
 * Canonical repo-owned SRD baseline source data.
 *
 * This file is intentionally sparse for now: it establishes the stable home
 * for authored SRD seed content so later content entry does not have to pick
 * ad hoc locations or invent a second content shape.
 */
export const SRD_SYSTEM_ID = '00000000-0000-0000-0000-000000000001'

export const srdBaselineContent = defineBaselineContentBundle({
  vocabulary: {
    systems: [
      {
        id: SRD_SYSTEM_ID,
        label: 'D&D 5e SRD 5.1',
        description: 'Baseline SRD content bundle for Artificer Toolkit.',
        alignments: [],
        conditionTypes: [],
        currencies: [],
        damageTypes: [],
        languages: [],
        magicSchools: [],
        passives: [],
        rarities: [],
        senses: [],
        skills: [],
        speeds: [],
        terrains: [],
        userId: '00000000-0000-0000-0000-000000000000'
      }
    ]
  },
  shared: {
    charges: [],
    details: [],
    savingThrows: [],
    startingEquipment: []
  },
  effects: {
    effects: []
  },
  features: {
    features: [],
    options: []
  },
  grants: {
    feats: [],
    modifiers: [],
    proficiencies: [],
    senses: [],
    spells: []
  },
  subjects: {
    backgrounds: [],
    classes: [],
    equipment: [],
    feats: [],
    races: [],
    spells: []
  }
})
