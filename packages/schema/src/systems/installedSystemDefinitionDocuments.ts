import { dnd5eDefinitionDocumentFamilies } from './dnd5e/definitionDocuments.js'

// The installed Systems' reusable definition document families (QUALITY-16.T3). Apart from
// `installedSystemSchemas.ts` because the document schemas are heavy: storage identity reads only the
// family keys.
export const installedDefinitionDocumentFamilies = [...dnd5eDefinitionDocumentFamilies] as const
