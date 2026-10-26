import type { SystemCoreCodeAdapter } from '../../systemCoreCodeCapability.js'
import { dnd5eCoreCodeAdapter } from '../dnd5e/coreCodes.js'

/**
 * The installed Systems' vocabulary tier (D195): what authoring may load. The tracer Vitest project
 * aliases each `installedGameSystems/` list to one that also installs its test-only System.
 */
export const installedVocabularySystems: readonly SystemCoreCodeAdapter[] = [dnd5eCoreCodeAdapter]
