import { createSystemVocabularyRegistry } from './systemVocabularyCapability.js'
import { dnd5eVocabularyCapabilityAdapter } from './systems/dnd5e/vocabulary.js'

/**
 * The installed Systems' vocabulary, the one home of each System's code lists. It loads no play
 * execution, so authoring reads it without the platform policy registry (`schemaBoundary.test.ts`).
 */
export const systemVocabularyRegistry = createSystemVocabularyRegistry([
  dnd5eVocabularyCapabilityAdapter
])
