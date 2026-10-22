/**
 * System-owned ability-score policy. The ability catalog itself (definition ids and codes) is
 * System vocabulary data; this adapter holds the rules that read it.
 */
export interface AbilityScoreCapabilityAdapter {
  gameSystemId: string
  /** The modifier an ability score gives. */
  abilityModifier(score: number): number
  /** Ability definition ids by authored code. */
  abilityDefinitionIdByCode: Readonly<Record<string, string>>
  /** The authored code of an ability definition id; an id outside the System throws. */
  abilityCode(abilityDefinitionId: string): string
  /**
   * The ability scores a Character keeps in a Creature form (D130 amendment), definition id by
   * authored code; the form brings the rest.
   */
  formRetainedAbilityIds: Readonly<Record<string, string>>
}
