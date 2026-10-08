import {
  reusableDefinitionDocumentDtoSchema,
  type ReusableDefinitionCurrentDto
} from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONDITION_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CurrentReusableDefinitionSource } from '../ruleCapabilityStateService.js'

/** A published current definition of an authored definition document. */
export function currentConditionDefinition(
  seed: Pick<ReusableDefinitionCurrentDto, 'id' | 'definitionFamilyKey' | 'label' | 'document'>
): ReusableDefinitionCurrentDto {
  return {
    id: seed.id,
    gameSystemId: SRD_SYSTEM_ID,
    contentSourceId: '44444444-4444-4444-8444-444444444444',
    definitionFamilyKey: seed.definitionFamilyKey,
    label: seed.label,
    description: null,
    document: reusableDefinitionDocumentDtoSchema.parse(seed.document),
    checksum: checksumRuleDocument(seed.document),
    contractVersion: 1,
    version: 1,
    publishedAt: '2026-10-07T00:00:00.000Z',
    publishedBy: '55555555-5555-4555-8555-555555555555'
  }
}

/**
 * The seeded SRD condition definitions as a current-definition source, plus any `extra` authored
 * definitions; each read id is recorded in `reads`.
 */
export function srdConditionDefinitionSource(
  input: { extra?: readonly ReusableDefinitionCurrentDto[]; reads?: string[] } = {}
): CurrentReusableDefinitionSource {
  return {
    requireCurrent: async (id: string) => {
      input.reads?.push(id)
      const extra = input.extra?.find((definition) => definition.id === id)
      if (extra) return extra
      const seed = SRD_CONDITION_RULE_STATE_DEFINITIONS.find((entry) => entry.id === id)
      if (!seed) throw new Error(`Unexpected definition ${id}.`)
      return currentConditionDefinition(seed)
    }
  }
}
