export type ActionEconomyCapabilityBinding =
  | { kind: 'NONE' }
  | {
      kind: 'REQUIRED'
      capabilityDefinitionId: string
      /** The value domain whose active `SET_VALUE` grants raise this allowance's maximum. */
      grantedCountDomain?: string
      /**
       * The allowance an `ACTION_BONUS_ACTION_EXCLUSIVITY` grant makes this one exclusive with:
       * once the other is spent this turn, this one is unavailable.
       */
      exclusiveWithCapabilityDefinitionId?: string
    }

/**
 * System-owned mapping from an exact authored activation to its aggregate
 * usage capability. The Encounter layer never assigns semantics to an
 * activation label itself.
 */
export interface ActionEconomyCapabilityAdapter {
  gameSystemId: string
  resolveActionEconomyCapability(input: {
    activationKind: string
    activationAmount: number
  }): ActionEconomyCapabilityBinding
  /**
   * Whether an activation spends the Action an Attack action opens with. Only such an action can
   * fill the slots of an open Attack action; a bonus, reaction or legendary action never does.
   */
  spendsAttackAction(input: { activationKind: string; activationAmount: number }): boolean
  /**
   * Whether an action is an attack of the Attack action: several of them share the one Action the
   * first spends, up to the actor's attacks per Attack action.
   */
  isAttackActionAttack(input: {
    activationKind: string
    activationAmount: number
    triggerCode: string
    /** The action takes the place of one attack (a basic action that costs ATTACK). */
    replacesAttack: boolean
  }): boolean
  /**
   * The limit a spell cast with this activation falls under, given the spells the actor has already
   * cast this turn. `refusal` is the reason the cast is not allowed; `marks` is the record a cast
   * that is allowed leaves for the actor's later spells. Absent when the System limits no spells.
   */
  spellCastingLimit?(input: {
    activationKind: string
    activationAmount: number
    cantrip: boolean
    held: { bonusActionSpell: boolean; actionSpell: boolean }
  }): { refusal: string | null; marks: 'bonusActionSpell' | 'actionSpell' | null }
  /**
   * The allowance each count value domain names: an active `SET_VALUE 0` grant on the domain
   * suppresses it (D99).
   */
  allowanceDefinitionIdByCountDomain: Readonly<Partial<Record<string, string>>>
  /** The capability an actor that can't act (incapacitated) has suppressed. */
  actorActionCapabilityDefinitionId(): string
  /** The allowances a turn start refreshes: distinct, sorted ascending. */
  refreshCapabilityDefinitionIds(): readonly string[]
}
