import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { NodeRuntimeQueryRow, NodeRuntimeSourceReader } from './nodeRuntimeSourceContract.js'
import type { NodeRuntimeSourceTable } from './nodeRuntimeSourceManifest.js'

/**
 * The code-owned policy vocabulary of the System (rules-runtime `systemCoreCodeRegistry`). The
 * caller supplies it, so this package never depends on rules-runtime.
 */
export type NodeRuntimePolicyVocabulary = Readonly<
  Record<
    'rollInfluence' | 'rollMode' | 'spellSlotPool',
    readonly { code: string; label: string; description?: string }[]
  >
>

const policyRows = (entries: NodeRuntimePolicyVocabulary['rollMode']) =>
  entries.map(({ code, label, description }) => ({
    id: code,
    label,
    description: description ?? null
  }))

/** The System vocabulary behind each resolver source table that the System, not a root, owns. */
export function systemCoreCodeRows(
  system: SystemAuthoredDto,
  coreCodes: NodeRuntimePolicyVocabulary
): Readonly<Record<string, readonly NodeRuntimeQueryRow[]>> {
  return {
    roll_influences: policyRows(coreCodes.rollInfluence),
    roll_modes: policyRows(coreCodes.rollMode),
    spell_slot_pools: policyRows(coreCodes.spellSlotPool),
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
  system,
  coreCodes
}: {
  readAuthoredRows: (
    table: NodeRuntimeSourceTable
  ) => readonly NodeRuntimeQueryRow[] | Promise<readonly NodeRuntimeQueryRow[]>
  readReusableDefinitions: () => Promise<readonly { id: string; label: string }[]>
  system: SystemAuthoredDto
  coreCodes: NodeRuntimePolicyVocabulary
}): NodeRuntimeSourceReader {
  const systemId = system.id.toLowerCase()
  const vocabulary = systemCoreCodeRows(system, coreCodes)
  // Nested feature maps share this read for the life of one reader.
  let definitions: Promise<NodeRuntimeQueryRow[]> | undefined

  return async (table, columns, _where, scopeSystemId) => {
    if (scopeSystemId?.toLowerCase() !== systemId) throw new Error('Authoring System mismatch.')
    const rows =
      table === 'reusable_definitions'
        ? await (definitions ??= readReusableDefinitions().then((rows) =>
            sortAuthoredSourceRows(rows.map(({ id, label }) => ({ id, label })))
          ))
        : (vocabulary[table] ?? (await readAuthoredRows(table)))
    // The shared executor applies the validated predicate; this reader only supplies trusted facts.
    return rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
    )
  }
}
