import { createSystemVocabularyRegistry } from './systemVocabularyCapability.js'
import { dnd5eVocabularyCapabilityAdapter } from './systems/dnd5e/vocabulary.js'

/**
 * The pure entry for System-supplied vocabulary. Authoring reads option lists through this
 * subpath, so it must import nothing from the compiler, executor or planning code
 * (apps/apis schemaBoundary.test.ts asserts the closure).
 */
export const systemVocabularyRegistry = createSystemVocabularyRegistry([
  dnd5eVocabularyCapabilityAdapter
])
