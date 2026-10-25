import {
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type AttackDomainCode,
  type FeatureAuthored
} from '@artificer-toolkit/shared'
import { grantId } from './shared.js'
import { ABILITY_CODE, type SrdAbilityCode } from '../vocabulary.js'

/** An enemy of the target that can act stands within 5 feet of it (Pack Tactics). */
export const ENEMY_WITHIN_5_FEET_OF_TARGET = {
  predicateCode: 'ENEMY_NEAR_TARGET' as const,
  feet: 5
}

/** The target has yet to take a turn in the Encounter (Assassinate). */
export const TARGET_HAS_NOT_TAKEN_TURN = {
  predicateCode: 'TARGET_HAS_NOT_TAKEN_TURN' as const
}

/** The holder stands in bright light, or in the Scene's daylight when `requiresDaylight` (D189). */
export function holderInBrightLight(requiresDaylight: boolean) {
  return { predicateCode: 'HOLDER_IN_BRIGHT_LIGHT' as const, requiresDaylight }
}

type GatingPredicate =
  | typeof ENEMY_WITHIN_5_FEET_OF_TARGET
  | typeof TARGET_HAS_NOT_TAKEN_TURN
  | ReturnType<typeof holderInBrightLight>

type RollInfluenceGrantInput = { influence: 'ADVANTAGE' | 'DISADVANTAGE' } & (
  | {
      valueDomainCode: typeof VALUE_DOMAIN_CODE.ATTACK_ROLL
      domain: { attackDomain: AttackDomainCode }
    }
  | {
      valueDomainCode: typeof VALUE_DOMAIN_CODE.ABILITY_CHECK
      domain: { ability: SrdAbilityCode }
    }
)

/**
 * One roll-influence grant gated by one Encounter-state predicate. Takes the five IDs
 * `grantId(creatureIndex, firstId)` onward: the grant, its restriction set, group, context and
 * condition.
 */
function predicateGatedRollInfluenceGrant(
  creatureIndex: number,
  firstId: number,
  order: number,
  input: RollInfluenceGrantInput,
  predicate: GatingPredicate
) {
  const id = (offset: number) => grantId(creatureIndex, firstId + offset)
  const { influence, ...rollDomain } = input
  return {
    id: id(0),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    ...rollDomain,
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence },
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    order,
    restrictions: {
      id: id(1),
      groups: [
        {
          id: id(2),
          order: 0,
          contexts: [
            {
              id: id(3),
              order: 0,
              subject: 'EQUIPMENT' as const,
              authoringModeKind: 'ALL' as const,
              conditions: [
                {
                  id: id(4),
                  order: 0,
                  kind: 'PREDICATE' as const,
                  constraint: 'INCLUDE' as const,
                  ...predicate
                }
              ]
            }
          ]
        }
      ]
    }
  }
}

const ATTACK_ROLL_INPUTS = (influence: RollInfluenceGrantInput['influence']) =>
  Object.values(ATTACK_DOMAIN_CODE).map((attackDomain): RollInfluenceGrantInput => ({
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    domain: { attackDomain },
    influence
  }))

/**
 * A feature's advantage on attack rolls of every attack domain while the Encounter state `predicate`
 * holds (Pack Tactics, Assassinate). One grant per attack domain, each with its own restriction,
 * takes the IDs `grantId(creatureIndex, firstLocalIndex)` onward (five per domain).
 */
export function conditionalAttackAdvantageGrants(
  creatureIndex: number,
  firstLocalIndex: number,
  predicate: Exclude<GatingPredicate, ReturnType<typeof holderInBrightLight>>
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: ATTACK_ROLL_INPUTS('ADVANTAGE').map((input, order) =>
      predicateGatedRollInfluenceGrant(
        creatureIndex,
        firstLocalIndex + order * 5,
        order,
        input,
        predicate
      )
    )
  }
}

/**
 * A feature's disadvantage on attack rolls of every attack domain, and on checks of each of
 * `checkAbilities` (the sight-based Wisdom (Perception) check has no narrower domain), while the
 * holder stands in bright light (Light Sensitivity) or in the Scene's daylight (Sunlight
 * Sensitivity). Five IDs per grant from `grantId(creatureIndex, firstLocalIndex)` onward.
 */
export function lightSensitivityGrants(
  creatureIndex: number,
  firstLocalIndex: number,
  requiresDaylight: boolean,
  checkAbilities: readonly SrdAbilityCode[] = [ABILITY_CODE.WISDOM]
): NonNullable<FeatureAuthored['grants']> {
  const inputs: RollInfluenceGrantInput[] = [
    ...ATTACK_ROLL_INPUTS('DISADVANTAGE'),
    ...checkAbilities.map((ability): RollInfluenceGrantInput => ({
      valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_CHECK,
      domain: { ability },
      influence: 'DISADVANTAGE'
    }))
  ]
  return {
    modifiers: inputs.map((input, order) =>
      predicateGatedRollInfluenceGrant(
        creatureIndex,
        firstLocalIndex + order * 5,
        order,
        input,
        holderInBrightLight(requiresDaylight)
      )
    )
  }
}
