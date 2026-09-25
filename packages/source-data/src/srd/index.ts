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
export { readSrdSemanticLedgerEntries, type SrdSemanticLedgerEntry } from './semanticLedger.js'

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

type QualifiedDamageDefense = NonNullable<CreatureAuthored['qualifiedDamageDefenses']>[number]

/**
 * Splits SRD damage-defense prose into plain damage types and typed "from nonmagical attacks"
 * defenses, so a qualified defense never becomes an unconditional one. Qualifiers the model cannot
 * represent (spell-only resistance, vulnerability to magic weapons of good wielders) are dropped:
 * the creature then takes normal damage rather than gaining an unconditional defense.
 */
function splitSrdDamageDefenses(
  values: readonly string[] | undefined,
  kind: QualifiedDamageDefense['kind'] | 'VULNERABILITY',
  context: string
): { plain: string[] | undefined; qualified: QualifiedDamageDefense[] } {
  if (!values) return { plain: undefined, qualified: [] }
  const plain: string[] = []
  const qualified: QualifiedDamageDefense[] = []
  for (const segment of values.flatMap((value) => value.split(';')).map((part) => part.trim())) {
    if (segment.length === 0 || /\bfrom spells\b|\bmagic weapons wielded\b/i.test(segment)) continue
    const damageTypeIds = normalizeVocabularyList([segment], srdSystemRecord.damageTypes, context)!
    if (!/\bnonmagical\b/i.test(segment)) {
      plain.push(...damageTypeIds)
      continue
    }
    if (kind === 'VULNERABILITY')
      throw new Error(`Unable to represent ${context} qualifier "${segment}".`)
    qualified.push({
      kind,
      damageTypeIds,
      bypassedBy: [
        'MAGICAL',
        ...(/\bsilvered\b/i.test(segment) ? (['SILVERED'] as const) : []),
        ...(/\badamantine\b/i.test(segment) ? (['ADAMANTINE'] as const) : [])
      ]
    })
  }
  return { plain: [...new Set(plain)], qualified }
}

function normalizeSrdCreature(creature: CreatureAuthored): CreatureAuthored {
  const resistances = splitSrdDamageDefenses(
    creature.damageResistances,
    'RESISTANCE',
    `${creature.label} damage resistance`
  )
  const immunities = splitSrdDamageDefenses(
    creature.damageImmunities,
    'IMMUNITY',
    `${creature.label} damage immunity`
  )
  const vulnerabilities = splitSrdDamageDefenses(
    creature.damageVulnerabilities,
    'VULNERABILITY',
    `${creature.label} damage vulnerability`
  )
  const qualifiedDamageDefenses = [...resistances.qualified, ...immunities.qualified]
  return {
    ...creature,
    damageResistances: resistances.plain,
    damageImmunities: immunities.plain,
    damageVulnerabilities: vulnerabilities.plain,
    ...(qualifiedDamageDefenses.length > 0 ? { qualifiedDamageDefenses } : {}),
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
