import { defineBaselineContentBundle } from '../content.js'
import { srdSystemRecord, SRD_SYSTEM_ID } from './vocabulary.js'

export { SRD_SYSTEM_ID }

export const srdBaselineContent = defineBaselineContentBundle({
  vocabulary: {
    systems: [srdSystemRecord]
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
