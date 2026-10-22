import { systemVocabularyRegistry } from '@artificer-toolkit/rules-runtime/systemVocabulary'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { NodeRuntimeQueryRow, NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'

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
    passives: system.passives,
    rarities: system.rarities,
    senses: system.senses,
    skills: system.skills,
    speeds: system.speeds
  }
}

/** The vocabulary lists a System supplies in code (rules-runtime), served as resolver source tables. */
function systemSuppliedRows(
  systemId: string,
  table: NodeRuntimeSourceTable
): readonly NodeRuntimeQueryRow[] | undefined {
  if (table === 'spell_slot_pools')
    return systemVocabularyRegistry
      .entries(systemId, 'spellSlotPool')
      .map(({ code, label }) => ({ code, label }))
  return undefined
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

/**
 * The one resolver source reader: System vocabulary and reusable definitions come from the
 * System, every other table from the authored roots. Callers (the Convex reader, the web test
 * harness) supply only where those rows are stored.
 */
export function createNodeRuntimeSourceReader({
  readAuthoredRows,
  readReusableDefinitions,
  system
}: {
  readAuthoredRows: (
    table: NodeRuntimeSourceTable
  ) => readonly NodeRuntimeQueryRow[] | Promise<readonly NodeRuntimeQueryRow[]>
  readReusableDefinitions: () => Promise<readonly { id: string; label: string }[]>
  system: SystemAuthoredDto
}): NodeRuntimeSourceReader {
  const systemId = system.id.toLowerCase()
  const vocabulary = systemVocabularyRows(system)
  // Nested feature maps share this read for the life of one reader.
  let definitions: Promise<NodeRuntimeQueryRow[]> | undefined

  return async (table, columns, _where, scopeSystemId) => {
    if (scopeSystemId?.toLowerCase() !== systemId) throw new Error('Authoring System mismatch.')
    const rows =
      table === 'reusable_definitions'
        ? await (definitions ??= readReusableDefinitions().then((rows) =>
            sortAuthoredSourceRows(rows.map(({ id, label }) => ({ id, label })))
          ))
        : (vocabulary[table] ??
          systemSuppliedRows(system.id, table) ??
          (await readAuthoredRows(table)))
    // The shared executor applies the validated predicate; this reader only supplies trusted facts.
    return rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
    )
  }
}
