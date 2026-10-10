import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ActiveGrantListingDto,
  ConcentrationListingDto
} from '@artificer-toolkit/schema/shared/activeGrantListing'

/**
 * A holder's active grants as a viewer lists them (D99), oldest first, with the GM's view of each
 * label. Players read them through `hideActiveGrantSources`.
 */
export function listActiveGrantListings(
  effects: readonly Pick<
    ActiveRuleEffectRecord,
    'id' | 'createdOrdinal' | 'definition' | 'lifecycle'
  >[]
): ActiveGrantListingDto[] {
  return [...effects]
    .sort(
      (left, right) => left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
    )
    .flatMap(({ id, definition, lifecycle }) =>
      definition.schemaVersion === 2
        ? definition.stateContributions.flatMap((contribution) =>
            contribution.kind === 'MODIFIER_GRANT'
              ? [
                  {
                    effectId: id,
                    label: contribution.sourceLabel,
                    sourceHidden: contribution.sourceHidden,
                    remainingTicks: lifecycle.remainingTicks,
                    expiresAtCampaignMinute: lifecycle.expiresAtCampaignMinute ?? null
                  }
                ]
              : []
          )
        : []
    )
}

/** A held Concentration, named by the first grant that depends on it (SPELLS-5.11). */
export function heldConcentration(
  dependents: Parameters<typeof listActiveGrantListings>[0]
): ConcentrationListingDto {
  const [first] = listActiveGrantListings(dependents)
  return { label: first?.label ?? null, sourceHidden: first?.sourceHidden ?? false }
}

/** The Concentration the caster's carried grants depend on; null when none are carried. */
export function carriedConcentration(
  effects: Parameters<typeof listActiveGrantListings>[0]
): ConcentrationListingDto | null {
  return effects.length === 0 ? null : heldConcentration(effects)
}

/** Only the GM learns what a hidden source was (D99). */
export function hideActiveGrantSources(
  grants: readonly ActiveGrantListingDto[]
): ActiveGrantListingDto[] {
  return grants.map((grant) => (grant.sourceHidden ? { ...grant, label: null } : grant))
}

/** A Concentration as a player reads it: a hidden source's label is withheld. */
export function hideConcentrationSource(
  concentration: ConcentrationListingDto | null
): ConcentrationListingDto | null {
  return concentration?.sourceHidden ? { ...concentration, label: null } : concentration
}
