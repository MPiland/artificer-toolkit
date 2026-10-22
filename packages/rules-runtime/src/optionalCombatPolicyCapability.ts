import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'

/** Exact optional-combat policy identity a proposal and its contest graph are sealed against. */
export interface OptionalCombatPolicyPin {
  readonly definitionChecksum: string
  readonly definitionId: string
  readonly definitionVersion: number
  readonly moduleContractVersion: number
  readonly moduleKey: string
}

/** INERT: the policy is not enabled for this Encounter; NOT_APPLICABLE: enabled, but not here. */
export type OptionalCombatResolution<T> =
  | { readonly kind: 'INERT' }
  | { readonly kind: 'JUDGMENT_REQUIRED'; readonly reason: string }
  | { readonly kind: 'NOT_APPLICABLE' }
  | { readonly kind: 'PROPOSED'; readonly proposal: T }

/** The Encounter's sealed optional-combat snapshot; the System validates it against its own policy. */
export interface OptionalCombatPolicyInput {
  readonly automationMode: AutomationModeDto
  readonly gameSystemId: string
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
}

export type OptionalCombatEconomy = 'ACTION' | 'BONUS_ACTION'

/** A server-qualified d20 contributor. A policy only appends its own contributors. */
export interface OptionalMovementContributor {
  readonly influence: string
  readonly id: string
  readonly reason: 'EXISTING_QUALIFIED_FACT' | 'SHOVE_ASIDE_POLICY' | 'SIZE_RELATION'
}

export interface MovementPassageProposal {
  readonly currentTurnOnly: true
  readonly hostileActorId: string
  readonly kind: 'PASS_THROUGH_HOSTILE'
  readonly opportunityAttackSuppression: false
  readonly prohibitEndingInOccupiedSpace: true
}

export interface TumblePreparationInput extends OptionalCombatPolicyInput {
  readonly actionEconomy: OptionalCombatEconomy | null
  readonly actionEconomyAvailable: boolean | null
  readonly blockerActorId: string
  readonly initiatorActorId: string
  readonly passageAlreadyUsedThisTurn: boolean | null
}

export interface OverrunPreparationInput extends TumblePreparationInput {
  readonly initiatorSizeRank: number | null
  readonly targetSizeRank: number | null
  readonly qualifiedInitiatorContributors: readonly OptionalMovementContributor[]
}

/** A sealed passage contest before either participant rolls. */
export interface TumbleContestProposal {
  readonly contest: {
    readonly initiatorCheckDefinitionId: string
    readonly targetCheckDefinitionId: string
  }
  readonly consumes: { readonly amount: 1; readonly economy: OptionalCombatEconomy }
  readonly passage: MovementPassageProposal
  readonly pin: OptionalCombatPolicyPin
}

export interface OverrunContestProposal extends TumbleContestProposal {
  readonly contest: TumbleContestProposal['contest'] & {
    readonly initiatorContributors: readonly OptionalMovementContributor[]
    readonly initiatorMode: string
  }
}

export interface CleavingInput extends OptionalCombatPolicyInput {
  readonly attackKind: 'MELEE' | 'OTHER' | null
  readonly attackTotal: number | null
  readonly attackerActorId: string
  readonly chainStep: number | null
  readonly eligibleTargetActorIds: readonly string[] | null
  readonly initialTargetActorId: string
  readonly initialTargetReducedToZero: boolean | null
  readonly initialTargetWasUndamaged: boolean | null
  readonly mixedDamageOrRiderAmbiguity: boolean | null
  readonly nextTarget: {
    readonly actorId: string
    readonly armorClass: number | null
    readonly withinAttackerReach: boolean | null
    readonly originalAttackResolution: {
      readonly naturalRoll: number | null
      readonly originalAttackCanHitNextTarget: boolean | null
    } | null
  } | null
  readonly remainingFinalDamage: number | null
  readonly visitedTargetActorIds: readonly string[] | null
}

/** One exact next target; outcome settlement owns damage application and further chaining. */
export interface CleavingProposal {
  readonly attackTotal: number
  readonly chainStep: number
  readonly eligibleTargetActorIds: readonly string[]
  readonly nextTargetActorId: string
  readonly pin: OptionalCombatPolicyPin
  readonly remainingFinalDamage: number
  readonly visitedTargetActorIds: readonly string[]
}

/** A System's optional-combat policy modules: movement passage contests and Cleaving. */
export interface OptionalCombatPolicyCapabilityAdapter {
  readonly gameSystemId: string
  prepareOverrunContest(
    input: OverrunPreparationInput
  ): OptionalCombatResolution<OverrunContestProposal>
  prepareTumbleContest(
    input: TumblePreparationInput
  ): OptionalCombatResolution<TumbleContestProposal>
  resolveCleaving(input: CleavingInput): OptionalCombatResolution<CleavingProposal>
}
