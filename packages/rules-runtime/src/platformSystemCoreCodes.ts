import { createSystemCoreCodeRegistry } from './systemCoreCodeCapability.js'
import { installedVocabularySystems } from './systems/installedGameSystems/vocabulary.js'

/**
 * The installed Systems' vocabulary, the one home of each System's code lists. It loads no play
 * execution, so authoring reads it without the platform policy registry (`schemaBoundary.test.ts`).
 */
export const systemCoreCodeRegistry = createSystemCoreCodeRegistry(installedVocabularySystems)
