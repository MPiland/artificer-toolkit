import type { SystemDefinitionDocumentFamily } from '../../shared/systemSchemaExtension.js'
import { dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema } from '../../shared/encounterLifecycle.js'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from '../../shared/optionalCombat.js'
import { DND5E_OPTIONAL_COMBAT_RULE_KINDS } from '../../shared/reusableDefinitionIdentity.js'
import {
  DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
  DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY
} from './schemaExtension.js'

/** The D&D System's reusable definition families and their document schemas (QUALITY-16.T3). */
export const dnd5eDefinitionDocumentFamilies = [
  {
    familyKey: DND5E_ENCOUNTER_LIFECYCLE_DEFINITION_FAMILY_KEY,
    documentKinds: ['LEGENDARY_ACTION', 'LEGENDARY_RESISTANCE', 'RECHARGE'],
    documentSchema: dnd5eEncounterLifecycleReusableDefinitionDocumentDtoSchema
  },
  {
    familyKey: DND5E_OPTIONAL_COMBAT_DEFINITION_FAMILY_KEY,
    documentKinds: DND5E_OPTIONAL_COMBAT_RULE_KINDS,
    documentSchema: dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema
  }
] as const satisfies readonly SystemDefinitionDocumentFamily[]
