import { defineBaselineContentBundle } from '../content.js'
import { srdSystemRecord, SRD_SYSTEM_ID } from './vocabulary.js'
import { srdBackgrounds } from './backgrounds/index.js'
import { srdClasses } from './classes/index.js'
import { srdCreatures } from './creatures/index.js'
import { srdEquipment } from './equipment/index.js'
import { srdFeats } from './feats/index.js'
import { srdRaces } from './races/index.js'
import { srdSpells } from './spells/index.js'
import { srdVehicles } from './vehicles/index.js'

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
    backgrounds: srdBackgrounds,
    classes: srdClasses,
    creatures: srdCreatures,
    equipment: srdEquipment,
    feats: srdFeats,
    races: srdRaces,
    spells: srdSpells,
    vehicles: srdVehicles
  }
})
