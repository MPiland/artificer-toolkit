import type {
  CharacterGrantFoldModifier,
  CharacterGrantFoldSense
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  ActiveGrantListingDto,
  ConcentrationListingDto
} from '@artificer-toolkit/schema/shared/activeGrantListing'
import { modifierRollInfluence, type ValueDomainCode } from '@artificer-toolkit/shared/core'

import { isLengthModifierDomain } from './modifierLength.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'

type GrantPolarity = ActiveGrantListingDto['polarity']

const INVERSE_POLARITY = {
  BENEFICIAL: 'HARMFUL',
  HARMFUL: 'BENEFICIAL',
  NEUTRAL: 'NEUTRAL'
} as const satisfies Record<GrantPolarity, GrantPolarity>

/** What adding one of these options does for the holder; any other option domain is neutral. */
const OPTION_DOMAIN_POLARITY: Readonly<Partial<Record<ValueDomainCode, GrantPolarity>>> = {
  DAMAGE_RESISTANCE: 'BENEFICIAL',
  DAMAGE_IMMUNITY: 'BENEFICIAL',
  CONDITION_IMMUNITY: 'BENEFICIAL',
  SPELL_SCHOOL_IMMUNITY: 'BENEFICIAL',
  CHECKS_AGAINST_HOLDER: 'BENEFICIAL',
  MOVEMENT_MODE: 'BENEFICIAL',
  MOVEMENT_PASSAGE: 'BENEFICIAL',
  CONDITION: 'BENEFICIAL',
  DAMAGE_VULNERABILITY: 'HARMFUL'
}

/** What enabling something does for the holder; any other enabled domain is neutral. */
const ENABLE_DOMAIN_POLARITY: Readonly<Partial<Record<ValueDomainCode, GrantPolarity>>> = {
  OPPORTUNITY_ATTACK_IMMUNITY: 'BENEFICIAL',
  FREE_OPPORTUNITY_REACTION: 'HARMFUL',
  ATTACK_TRAIT: 'BENEFICIAL',
  WEAPON_PROFICIENCY: 'BENEFICIAL',
  SPELLCASTING_LOCK: 'HARMFUL',
  ACTION_BONUS_ACTION_EXCLUSIVITY: 'HARMFUL',
  ATTACK_DECOYS: 'BENEFICIAL',
  DAMAGE_INTERCEPTION: 'BENEFICIAL',
  DAMAGE_MIRROR: 'BENEFICIAL',
  END_EVENT_EXEMPTION: 'BENEFICIAL',
  INCOMING_DAMAGE: 'BENEFICIAL',
  INCOMING_ATTACK_GATE: 'BENEFICIAL',
  HEALING_RECEIVED: 'BENEFICIAL'
}

/**
 * What setting a domain's value does (D110): its polarity when set to zero and when set above zero.
 * Setting any other domain, or a value in between, is neutral.
 */
const SET_VALUE_DOMAIN_POLARITY: Readonly<
  Partial<Record<ValueDomainCode, { zero?: GrantPolarity; positive?: GrantPolarity }>>
> = {
  SPEED: { zero: 'HARMFUL', positive: 'BENEFICIAL' },
  ACTION_COUNT: { zero: 'HARMFUL', positive: 'BENEFICIAL' },
  BONUS_ACTION_COUNT: { zero: 'HARMFUL' },
  WEAPON_DAMAGE_DIE: { positive: 'BENEFICIAL' },
  REACTION_COUNT: { zero: 'HARMFUL' }
}

/** A bonus or penalty's sign: a negative amount or multiplier flips it, zero cancels it. */
function scalarSign(
  domain: ValueDomainCode,
  payload: CharacterGrantFoldModifier['payload']
): number {
  if (payload === undefined) return 1
  // A fixed amount or a typed length (speed, sense range) carries its sign in `amount`.
  if (('valueKind' in payload && payload.valueKind === 'FIXED') || isLengthModifierDomain(domain))
    return 'amount' in payload ? Math.sign(payload.amount) : 1
  return 'multiplier' in payload ? Math.sign(payload.multiplier ?? 1) : 1
}

/** What a roll influence alone does for the roller: the face the System's roll-mode policy keeps. */
function rollInfluencePolarity(gameSystemId: string, influence: string): GrantPolarity {
  const { keep } = rollModeCapabilityRegistry.resolveRollMode({
    gameSystemId,
    contributors: [{ influence }]
  })
  return keep === 'HIGHER' ? 'BENEFICIAL' : keep === 'LOWER' ? 'HARMFUL' : 'NEUTRAL'
}

function modifierPolarity(
  gameSystemId: string,
  modifier: CharacterGrantFoldModifier
): GrantPolarity {
  const { modifierKind: kind, valueDomainCode: domain, payload } = modifier
  switch (kind) {
    case 'ROLL_INFLUENCE':
    case 'SUPPRESS_ROLL_INFLUENCE': {
      const influence = modifierRollInfluence(modifier, kind)
      if (influence === null) return 'NEUTRAL'
      const polarity = rollInfluencePolarity(gameSystemId, influence)
      // Suppressing an influence inverts it, and so does an attack made against the holder.
      return (kind === 'SUPPRESS_ROLL_INFLUENCE') !== (domain === 'ATTACKS_AGAINST')
        ? INVERSE_POLARITY[polarity]
        : polarity
    }
    case 'BONUS':
    case 'PENALTY': {
      const sign = scalarSign(domain, payload)
      if (sign === 0) return 'NEUTRAL'
      return (kind === 'BONUS') === sign > 0 ? 'BENEFICIAL' : 'HARMFUL'
    }
    case 'ABILITY_MODIFIER_BONUS': {
      const sign = scalarSign(domain, payload)
      return sign === 0 ? 'NEUTRAL' : sign > 0 ? 'BENEFICIAL' : 'HARMFUL'
    }
    case 'ADD_BONUS_DIE':
      return payload !== undefined && 'sign' in payload && payload.sign === 'SUBTRACT'
        ? 'HARMFUL'
        : 'BENEFICIAL'
    case 'OPTIONAL_ABILITY_MODIFIER_BONUS':
    case 'MINIMUM_ROLL':
      return 'BENEFICIAL'
    case 'ENABLE':
      return ENABLE_DOMAIN_POLARITY[domain] ?? 'NEUTRAL'
    case 'SET_VALUE': {
      if (payload === undefined || !('amount' in payload)) return 'NEUTRAL'
      const { amount } = payload
      const byValue = SET_VALUE_DOMAIN_POLARITY[domain]
      return (
        (amount === 0 ? byValue?.zero : amount > 0 ? byValue?.positive : undefined) ?? 'NEUTRAL'
      )
    }
    case 'MULTIPLY': {
      if (payload === undefined || !('numerator' in payload)) return 'NEUTRAL'
      if (domain !== 'SPEED') return 'NEUTRAL'
      // A speed multiplied below one (Slow, a lethargy's zero) harms; above one (Haste) helps.
      const ratio = payload.numerator / payload.denominator
      return ratio < 1 ? 'HARMFUL' : ratio > 1 ? 'BENEFICIAL' : 'NEUTRAL'
    }
    case 'CAP_VALUE':
      return 'HARMFUL'
    case 'ADD_OPTION':
      return OPTION_DOMAIN_POLARITY[domain] ?? 'NEUTRAL'
    case 'REMOVE_OPTION':
      return INVERSE_POLARITY[OPTION_DOMAIN_POLARITY[domain] ?? 'NEUTRAL']
    default:
      return 'NEUTRAL'
  }
}

/**
 * What a grant does for its holder, derived from its frozen modifiers and never authored: beneficial
 * or harmful only when every piece agrees, neutral when they mix or any piece is neutral. Each piece
 * reads as follows:
 * - A roll influence follows the face the System keeps under it (advantage helps, disadvantage
 *   harms), inverted on attacks against the holder; suppressing an influence inverts it.
 * - A bonus or penalty follows its sign; a negative amount or multiplier flips it, zero is neutral.
 * - An ability modifier bonus helps; a negative multiplier harms and a zero one is neutral. An
 *   optional ability modifier bonus always helps.
 * - A rolled die helps when it adds (Bless) and harms when it subtracts (Bane).
 * - Enabling something is read by the domains in `ENABLE_DOMAIN_POLARITY` (opportunity attack
 *   immunity helps, the spellcasting lock harms); any other enabled domain is neutral.
 * - Setting a value is read by domain and value (D110): speed above zero helps (Fly); speed or
 *   reactions set to zero harms (Shocking Grasp); the Action count set above zero helps (Action
 *   Surge); every other set value is neutral.
 * - Multiplying speed harms below one (Slow, a lethargy's zero) and helps above one (Haste).
 * - Adding an option follows `OPTION_DOMAIN_POLARITY`; removing one inverts it.
 * - Senses help.
 */
function grantPolarity(
  gameSystemId: string,
  grant: {
    modifiers: readonly CharacterGrantFoldModifier[]
    senses: readonly CharacterGrantFoldSense[]
  }
): GrantPolarity {
  const pieces = [
    ...grant.modifiers.map((modifier) => modifierPolarity(gameSystemId, modifier)),
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
      definition.stateContributions.flatMap((contribution) =>
        contribution.kind === 'MODIFIER_GRANT'
          ? [
              {
                effectId: id,
                label: contribution.sourceLabel,
                sourceHidden: contribution.sourceHidden,
                sourceActorId:
                  definition.origin.kind === 'ENCOUNTER' ? definition.origin.sourceActorId : null,
                remainingTicks: lifecycle.remainingTicks,
                expiresAtCampaignMinute: lifecycle.expiresAtCampaignMinute ?? null,
                polarity: grantPolarity(definition.frozenGraph.source.gameSystemId, contribution)
              }
            ]
          : []
      )
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

/**
 * Grants as a player reads them: only the GM learns what a hidden source was (D99), and a source
 * actor the player is not listed is withheld, so its id cannot reveal an unseen actor (ATTACK-17.3).
 */
export function hideActiveGrantSources(
  grants: readonly ActiveGrantListingDto[],
  listedActorIds: ReadonlySet<string>
): ActiveGrantListingDto[] {
  return grants.map((grant) =>
    grant.sourceHidden
      ? { ...grant, label: null, sourceActorId: null }
      : grant.sourceActorId && !listedActorIds.has(grant.sourceActorId)
        ? { ...grant, sourceActorId: null }
        : grant
  )
}

/** A Concentration as a player reads it: a hidden source's label is withheld. */
export function hideConcentrationSource(
  concentration: ConcentrationListingDto | null
): ConcentrationListingDto | null {
  return concentration?.sourceHidden ? { ...concentration, label: null } : concentration
}
