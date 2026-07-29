import { defineBaselineContentBundle } from '../content.js'
import { srdSystemRecord, SRD_SYSTEM_ID } from './vocabulary.js'
import { srdBackgrounds } from './backgrounds/index.js'
import { srdClasses } from './classes/index.js'
import { srdCreatures as srdCreatureSource } from './creatures/index.js'
import { srdEquipment } from './equipment/index.js'
import { srdFeats } from './feats/index.js'
import { srdRaces } from './races/index.js'
import { srdSpells } from './spells/index.js'
import { srdVehicles } from './vehicles/index.js'
import type { CreatureAuthored } from '@artificer-toolkit/shared'

export { SRD_SYSTEM_ID }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function normalizeVocabularyList(
  values: readonly string[] | undefined,
  vocabulary: readonly { code: string; id: string; label: string }[],
  context: string
): string[] | undefined {
  if (!values) {
    return undefined
  }

  const resolvedIds = values.flatMap((value) => {
    if (UUID_PATTERN.test(value)) {
      return [value]
    }

    const normalizedValue = value.toLowerCase()
    const matches = vocabulary.filter((entry) => {
      const code = entry.code.toLowerCase()
      const label = entry.label.toLowerCase()

      return normalizedValue.includes(code) || normalizedValue.includes(label)
    })

    if (matches.length === 0) {
      throw new Error(`Unable to resolve ${context} vocabulary reference "${value}".`)
    }

    return matches.map((entry) => entry.id)
  })

  return [...new Set(resolvedIds)]
}

function normalizeSrdCreature(creature: CreatureAuthored): CreatureAuthored {
  return {
    ...creature,
    damageResistances: normalizeVocabularyList(
      creature.damageResistances,
      srdSystemRecord.damageTypes,
      `${creature.label} damage resistance`
    ),
    damageImmunities: normalizeVocabularyList(
      creature.damageImmunities,
      srdSystemRecord.damageTypes,
      `${creature.label} damage immunity`
    ),
    damageVulnerabilities: normalizeVocabularyList(
      creature.damageVulnerabilities,
      srdSystemRecord.damageTypes,
      `${creature.label} damage vulnerability`
    ),
    conditionImmunities: normalizeVocabularyList(
      creature.conditionImmunities,
      srdSystemRecord.conditionTypes,
      `${creature.label} condition immunity`
    )
  }
}

const srdCreatures = srdCreatureSource.map(normalizeSrdCreature)

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
