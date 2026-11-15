import { dnd5eDefinitionPublishers } from './dnd5e/definitionPublishers.js'

// The installed Systems' reusable definition publishers, one list for every installed System
// (QUALITY-16.T4). With `installedSystemSchemas.ts` in the schema package, this is the only authoring
// module that names a System: the reusable definition service reads the family keys it accepts from it.
export const installedDefinitionPublishers = [...dnd5eDefinitionPublishers] as const
