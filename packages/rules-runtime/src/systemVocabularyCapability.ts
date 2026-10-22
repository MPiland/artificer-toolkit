import { createSystemCapabilityRegistry } from './systemCapabilityRegistry.js'

const VOCABULARY_NOUNS = {
  rollInfluence: 'roll-mode influence',
  rollMode: 'roll mode'
} as const

/** A list a System supplies in place of a fixed wire enum (ADR 0039 decision 5). */
export type SystemVocabularyKind = keyof typeof VOCABULARY_NOUNS

export interface SystemVocabularyEntry {
  code: string
  label: string
}

/** A System's vocabulary lists: each code unique within its list, labels for display only. */
export interface SystemVocabularyCapabilityAdapter {
  gameSystemId: string
  lists: Readonly<Record<SystemVocabularyKind, readonly SystemVocabularyEntry[]>>
}

/**
 * The one seam that decides whether a wire code belongs to a System's vocabulary. Every ingress that
 * knows its `gameSystemId` (authoring, import, compile, command input, settlement) calls
 * `requireCode`; the schema only checks a code's shape.
 */
export function createSystemVocabularyRegistry(
  adapters: readonly SystemVocabularyCapabilityAdapter[]
) {
  for (const adapter of adapters)
    for (const [kind, entries] of Object.entries(adapter.lists))
      if (new Set(entries.map(({ code }) => code)).size !== entries.length)
        throw new Error(`Duplicate ${VOCABULARY_NOUNS[kind as SystemVocabularyKind]} code.`)
  const registry = createSystemCapabilityRegistry('vocabulary', adapters)
  return {
    entries(gameSystemId: string, kind: SystemVocabularyKind): readonly SystemVocabularyEntry[] {
      return registry.require(gameSystemId).lists[kind]
    },
    requireCode(gameSystemId: string, kind: SystemVocabularyKind, code: string) {
      const entry = registry.require(gameSystemId).lists[kind].find((item) => item.code === code)
      if (!entry)
        throw new Error(`The Game System does not define the ${VOCABULARY_NOUNS[kind]} "${code}".`)
      return entry
    }
  }
}

export type SystemVocabularyRegistry = ReturnType<typeof createSystemVocabularyRegistry>
