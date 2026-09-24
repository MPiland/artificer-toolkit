import { campaignPlaySettingsOptionsDtoSchema } from '@artificer-toolkit/schema/api/campaignSettings'
import { initiativePolicyReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/initiativePolicy'
import { dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { isIntegratedOptionalCombatRule } from './optionalCombatSourceAccess.js'

export function presentCampaignPlaySettingsOptions(
  definitions: readonly ReusableDefinitionCurrentDto[]
) {
  const byId = new Map(definitions.map((definition) => [definition.id, definition]))
  const initiativePolicies = definitions.flatMap((definition) => {
    const policy = initiativePolicyReusableDefinitionDocumentDtoSchema.safeParse(
      definition.document
    )
    if (!policy.success) return []
    const tieResolvers = policy.data.tieResolvers.flatMap((pin) => {
      const current = byId.get(pin.definitionId)
      return current ? [{ definitionId: current.id, label: current.label }] : []
    })
    if (tieResolvers.length !== policy.data.tieResolvers.length) return []
    return [
      {
        definitionId: definition.id,
        label: definition.label,
        defaultTieResolverDefinitionId: policy.data.defaultTieResolverDefinitionId,
        tieResolvers
      }
    ]
  })
  const optionalCombatRules = definitions.flatMap((definition) => {
    const rule = dnd5eOptionalCombatReusableDefinitionDocumentDtoSchema.safeParse(
      definition.document
    )
    return rule.success && isIntegratedOptionalCombatRule(rule.data)
      ? [{ definitionId: definition.id, label: definition.label, kind: rule.data.kind }]
      : []
  })
  return campaignPlaySettingsOptionsDtoSchema.parse({ initiativePolicies, optionalCombatRules })
}
