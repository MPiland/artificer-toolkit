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
  /** The authored codes of the abilities whose modifiers the System's derived statistics add. */
  derivedStatisticAbilityCodes: {
    readonly armorClass: string
    readonly initiative: string
    /**
     * The Character-wide hit point modifier and each hit die spent on a rest. Each class level's
     * hit point row adds its class's authored `hitpoint.ability` instead.
     */
    readonly hitPoints: string
  }
}
