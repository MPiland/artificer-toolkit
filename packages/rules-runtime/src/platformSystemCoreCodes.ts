import { createSystemCoreCodeRegistry } from './systemCoreCodeCapability.js'
import { dnd5eCoreCodeAdapter } from './systems/dnd5e/coreCodes.js'

/**
 * The installed Systems' vocabulary, the one home of each System's code lists. It loads no play
 * execution, so authoring reads it without the platform policy registry (`schemaBoundary.test.ts`).
 */
export const systemCoreCodeRegistry = createSystemCoreCodeRegistry([dnd5eCoreCodeAdapter])
