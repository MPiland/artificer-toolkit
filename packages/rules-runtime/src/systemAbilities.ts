import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import { abilityScoreCapabilityRegistry } from './platformPolicyModules.js'
import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'

/**
 * Refuses an authored Creature whose ability scores are not keyed by exactly its System's ability
 * codes. Authoring ingress calls it beside `requireAuthoredSizes`.
 */
export function requireAuthoredAbilities(subject: AuthoredPublicationDocument) {
  if (subject.subjectKind !== 'CREATURE') return
  const { systemId, abilityScores } = subject.document
  for (const code of Object.keys(abilityScores))
    systemCoreCodeRegistry.requireAbility(systemId, code)
  const missing = systemCoreCodeRegistry
    .abilityCodes(systemId)
    .filter((code) => !(code in abilityScores))
  if (missing.length > 0) throw new Error(`The Creature has no score for ${missing.join(', ')}.`)
}

/** A new stat block's ability scores: every System ability at the System's default score. */
export function defaultAbilityScores(gameSystemId: string): Record<string, number> {
  const { defaultScore } = abilityScoreCapabilityRegistry.require(gameSystemId)
  return Object.fromEntries(
    systemCoreCodeRegistry.abilityCodes(gameSystemId).map((code) => [code, defaultScore])
  )
}
