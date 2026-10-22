import {
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type FeatureAuthored,
  type ModifierDamageInterceptionAuthored
} from '@artificer-toolkit/shared'

/**
 * A feature's damage interception: damage that would drop the Creature to 0 hit points leaves it at
 * `dropToHitPoints` (Undead Fortitude, Relentless). A feature with limited-use charges spends one
 * per interception.
 */
export function damageInterceptionGrants(
  id: string,
  payload: ModifierDamageInterceptionAuthored
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: [
      {
        id,
        grantKind: GRANT_KIND.MODIFIER_GRANT,
        valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_INTERCEPTION,
        domain: {},
        modifierKind: MODIFIER_KIND.ENABLE,
        scope: MODIFIER_SCOPE_KIND.GLOBAL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        payload,
        order: 0
      }
    ]
  }
}
