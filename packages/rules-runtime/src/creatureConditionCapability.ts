/** The conditions a System's own rules apply to a creature, which no authored effect holds. */
export interface CreatureConditionCapabilityAdapter {
  gameSystemId: string
  /**
   * The condition a Character gains on dropping to 0 hit points and loses on regaining any (D63);
   * null when the System adds none.
   */
  zeroHitPointsConditionDefinitionId: string | null
  /** The condition a Character's exhaustion level is a level of; null when the System has none. */
  exhaustionConditionDefinitionId: string | null
}
