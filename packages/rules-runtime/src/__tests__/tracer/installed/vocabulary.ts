import type { SystemCoreCodeAdapter } from '../../../systemCoreCodeCapability.js'
import { dnd5eCoreCodeAdapter } from '../../../systems/dnd5e/coreCodes.js'
import { tracerCoreCodeAdapter } from '../system.js'

export const installedVocabularySystems: readonly SystemCoreCodeAdapter[] = [
  dnd5eCoreCodeAdapter,
  tracerCoreCodeAdapter
]
