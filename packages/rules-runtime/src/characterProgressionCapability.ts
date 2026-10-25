/** System-owned Character progression arithmetic: hit dice, the hit points a level adds and proficiency. */
export interface CharacterProgressionCapabilityAdapter {
  gameSystemId: string
  /** The size of a class hit die config; null when the config is not a single hit die. */
  hitDieSize(dieConfig: string | undefined): number | null
  /** The fixed value a hit die gives at levels after the first. */
  hitDieAverage(die: number): number
  /** The hit points one Character level adds, from its hit die, the method and the ability modifier. */
  hitPointGain(input: {
    die: number
    characterLevel: number
    fixed: boolean
    roll: number | null
    modifier: number
  }): number
  /** The proficiency bonus at a total Character level. */
  proficiencyBonus(totalLevel: number): number
  /** The authored codes of the abilities whose modifiers the Character's derived statistics add. */
  derivedStatisticAbilityCodes: {
    readonly armorClass: string
    readonly initiative: string
    /** Every class level's hit point gain and each hit die spent on a rest (D193). */
    readonly hitPoints: string
  }
}
