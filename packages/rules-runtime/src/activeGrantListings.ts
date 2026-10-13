import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ActiveGrantListingDto,
  ConcentrationListingDto
} from '@artificer-toolkit/schema/shared/activeGrantListing'

import { record } from './character/activeEffectGrantTotals.js'

type GrantPolarity = ActiveGrantListingDto['polarity']

const INVERSE_POLARITY = {
  BENEFICIAL: 'HARMFUL',
  HARMFUL: 'BENEFICIAL',
  NEUTRAL: 'NEUTRAL'
} as const satisfies Record<GrantPolarity, GrantPolarity>

/** What adding one of these options does for the holder; any other option domain is neutral. */
const OPTION_DOMAIN_POLARITY: Readonly<Record<string, GrantPolarity>> = {
  DAMAGE_RESISTANCE: 'BENEFICIAL',
  DAMAGE_IMMUNITY: 'BENEFICIAL',
  CONDITION_IMMUNITY: 'BENEFICIAL',
  MOVEMENT_MODE: 'BENEFICIAL',
  DAMAGE_VULNERABILITY: 'HARMFUL',
  CONDITION: 'HARMFUL'
}

/** A bonus or penalty's sign: a negative amount or multiplier flips it, zero cancels it. */
function scalarSign(payload: unknown): number {
  const scalar = record(payload)
  const value = scalar?.valueKind === 'FIXED' ? scalar.amount : (scalar?.multiplier ?? 1)
  return typeof value === 'number' ? Math.sign(value) : 1
}

function modifierPolarity(modifier: CharacterGrantFoldModifier): GrantPolarity {
  switch (modifier.modifierKind) {
    case 'ADVANTAGE':
      return modifier.valueDomainCode === 'ATTACKS_AGAINST' ? 'HARMFUL' : 'BENEFICIAL'
    case 'DISADVANTAGE':
      return modifier.valueDomainCode === 'ATTACKS_AGAINST' ? 'BENEFICIAL' : 'HARMFUL'
    case 'BONUS':
    case 'PENALTY': {
      const sign = scalarSign(record(modifier.grant)?.payload)
      if (sign === 0) return 'NEUTRAL'
      return (modifier.modifierKind === 'BONUS') === sign > 0 ? 'BENEFICIAL' : 'HARMFUL'
    }
    case 'ABILITY_MODIFIER_BONUS':
    case 'OPTIONAL_ABILITY_MODIFIER_BONUS':
    case 'ADD_BONUS_DIE':
    case 'ENABLE':
      return 'BENEFICIAL'
    case 'ADD_OPTION':
      return OPTION_DOMAIN_POLARITY[modifier.valueDomainCode] ?? 'NEUTRAL'
    case 'REMOVE_OPTION':
      return INVERSE_POLARITY[OPTION_DOMAIN_POLARITY[modifier.valueDomainCode] ?? 'NEUTRAL']
    default:
      return 'NEUTRAL'
  }
}

/**
 * What a grant does for its holder, derived from its frozen modifiers and never authored: beneficial
 * or harmful only when every piece agrees, neutral when they mix or any piece is neutral. Advantage
 * on attacks against the holder harms them.
 */
function grantPolarity(grant: {
  modifiers: readonly CharacterGrantFoldModifier[]
  senses: readonly CharacterGrantFoldSense[]
}): GrantPolarity {
  const pieces = [
    ...grant.modifiers.map(modifierPolarity),
    ...grant.senses.map((): GrantPolarity => 'BENEFICIAL')
  ]
  const [first] = pieces
  return first !== undefined && pieces.every((piece) => piece === first) ? first : 'NEUTRAL'
}

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
                    expiresAtCampaignMinute: lifecycle.expiresAtCampaignMinute ?? null,
                    polarity: grantPolarity(contribution)
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
