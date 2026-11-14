import { uniqueReceiptBindings } from '../shared/systemSchemaExtension.js'
import {
  dnd5eDefinitionFamilyKeys,
  dnd5eModifierGrantKinds,
  dnd5eReceiptBindings
} from './dnd5e/schemaExtension.js'

// The installed Systems' light schema extensions, one list per capability (QUALITY-16.T3, ADR 0042
// amendment). With `installedSystemDefinitionDocuments.ts` this is the only schema module that names a
// System; neutral schema modules read these lists.

export const installedModifierGrantKinds = [...dnd5eModifierGrantKinds] as const

export const installedDefinitionFamilyKeys = [...dnd5eDefinitionFamilyKeys] as const

export const installedReceiptBindings = uniqueReceiptBindings([dnd5eReceiptBindings])
