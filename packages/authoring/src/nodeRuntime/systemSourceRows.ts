import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { NodeRuntimeQueryRow } from './nodeRuntimeSourceContract.js'

/** The System vocabulary behind each resolver source table that the System, not a root, owns. */
export function systemVocabularyRows(
  system: SystemAuthoredDto
): Readonly<Record<string, readonly NodeRuntimeQueryRow[]>> {
  return {
    ability_definitions: 'abilities' in system ? system.abilities : [],
    alignments: system.alignments,
    challenge_ratings: system.challengeRatings,
    condition_types: system.conditionTypes,
    creature_types: system.creatureTypes,
    currencies: system.currencies,
    damage_types: system.damageTypes,
    heritages: system.heritages,
    languages: system.languages,
    magic_schools: system.magicSchools,
    rarities: system.rarities,
    senses: system.senses,
    skills: system.skills,
    speeds: system.speeds
  }
}

/** Authored-root rows in the order every option list shows them. */
export function sortAuthoredSourceRows(rows: NodeRuntimeQueryRow[]): NodeRuntimeQueryRow[] {
  return rows.sort(
    (left, right) =>
      String(left.label ?? '').localeCompare(String(right.label ?? '')) ||
      String(left.id ?? '').localeCompare(String(right.id ?? '')) ||
      JSON.stringify(left).localeCompare(JSON.stringify(right))
  )
}
