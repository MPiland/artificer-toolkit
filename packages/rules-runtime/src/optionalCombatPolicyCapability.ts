import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  ConsequenceRollTableDto,
  ConsequenceRollTriggerDto
} from '@artificer-toolkit/schema/shared/consequenceRolls'
import type {
  EncounterActorMoraleDto,
  EncounterMoraleOfferDto
} from '@artificer-toolkit/schema/shared/encounterMorale'
import type {
  MoraleDispositionDto,
  MoraleTriggerKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import type { ReceiptD20ContributorDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'
import type { CharacterRuleActionActiveEffectPlan } from './characterRuleActionSystemAdapter.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { MaintenanceLinkSaveFacts } from './maintenanceLinkCapability.js'
import type { ResolvedRuleCapabilityAvailabilityDto } from '@artificer-toolkit/schema/shared/ruleState'
import type { SceneGrid, SceneToken } from '@artificer-toolkit/shared/vtt'
import type { FacingArc } from '@artificer-toolkit/shared/vtt/facingArc'

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

/** Climb-onto facts; the initiator check is the climber's pick from the rule's authored checks. */
export interface ClimbOntoPreparationInput extends TumblePreparationInput {
  readonly initiatorCheckDefinitionId: string
  readonly initiatorSizeRank: number | null
  readonly targetSizeRank: number | null
}

/** A sealed climb-onto contest before either participant rolls; winning stops at contact. */
export interface ClimbOntoContestProposal {
  readonly contest: TumbleContestProposal['contest']
  readonly consumes: TumbleContestProposal['consumes']
  readonly pin: OptionalCombatPolicyPin
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

export type OptionalCombatD20Contributor = Readonly<ReceiptD20ContributorDto>
/** A code from the System's `rollMode` vocabulary. */
type OptionalCombatD20Mode = string

/** Exact Disarm facts; the System alone interprets sizes, item properties and the trigger. */
export interface DisarmPreparationInput extends OptionalCombatPolicyInput {
  readonly attackerActorId: string
  readonly attackerSize: string | null
  readonly heldItemId: string | null
  readonly targetActorId: string
  readonly targetCheckDefinitionId: string | null
  readonly targetEquipment: { readonly properties: readonly string[] } | null
  readonly targetItemOwnerState: 'CHARACTER_SHEET' | 'ENCOUNTER_ACTOR' | null
  readonly targetSize: string | null
  /** Exact authored action trigger. */
  readonly triggerCode: string | null
  /** Exact selected action's Equipment binding; labels never participate. */
  readonly sourceEquipment: {
    readonly category: string | null
    readonly id: string
    readonly properties: readonly string[]
    readonly state: 'EQUIPPED' | 'HELD'
  } | null
  /** Exact source policy plus target-specific active relationship contributors. */
  readonly attack: {
    readonly modifier: number | null
    readonly rollMode: OptionalCombatD20Mode | null
    readonly baseContributors: Readonly<
      Record<'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED', readonly OptionalCombatD20Contributor[]>
    > | null
    readonly relationshipContributors: readonly OptionalCombatD20Contributor[]
  } | null
}

/** A sealed Disarm contest before either participant rolls. */
export interface DisarmContestProposal {
  readonly contest: {
    readonly targetCheckDefinitionId: string
    readonly initiatorMode: OptionalCombatD20Mode
    readonly targetMode: OptionalCombatD20Mode
    readonly initiatorContributors: readonly OptionalCombatD20Contributor[]
    readonly targetContributors: readonly OptionalCombatD20Contributor[]
  }
  readonly disposition: {
    readonly placement: 'JUDGMENT_REQUIRED'
    readonly heldItemId: string
    readonly ownerActorId: string
    readonly ownerState: 'CHARACTER_SHEET' | 'ENCOUNTER_ACTOR'
    readonly transition: 'NO_LONGER_HELD'
  }
  readonly pin: OptionalCombatPolicyPin
}

/** One Encounter actor's Run facts that morale triggers read; `removed` is defeated or absent. */
export interface MoraleActorFacts {
  readonly actorId: string
  readonly sideId: string
  readonly kind: 'CHARACTER' | 'CREATURE' | 'CUSTOM'
  readonly currentHitPoints: number
  readonly maxHitPoints: number
  readonly removed: boolean
  readonly morale: EncounterActorMoraleDto | null
}

export interface MoraleOfferInput extends OptionalCombatPolicyInput {
  readonly actors: readonly MoraleActorFacts[]
}

export interface MoralePreparationInput extends MoraleOfferInput {
  readonly subjectActorId: string
  readonly triggerKind: MoraleTriggerKindDto
  /** The group's leader the GM names; null asks the policy for the fallback roller. */
  readonly leaderActorId: string | null
  readonly overwhelmingOpposition: boolean
  readonly escapePossible: boolean
  /** The save modifiers by ability of each present member of the subject's side. */
  readonly rollers: ReadonlyMap<
    string,
    { readonly canAct: boolean; readonly saveModifiers: ReadonlyMap<string, number> }
  >
}

/** A sealed morale save before the roller rolls; settlement records it on every member. */
export interface MoraleSaveProposal {
  readonly pin: OptionalCombatPolicyPin
  readonly triggerKind: MoraleTriggerKindDto
  readonly scope: 'GROUP' | 'SUBJECT'
  readonly rollerActorId: string
  readonly groupLeaderActorId: string | null
  readonly memberActorIds: readonly string[]
  readonly abilityDefinitionId: string
  readonly difficultyClass: number
  readonly contributors: readonly OptionalCombatD20Contributor[]
  /** Authored overwhelming opposition fails the check without a roll. */
  readonly automaticFailure: boolean
  readonly successDisposition: MoraleDispositionDto
  readonly failureDisposition: MoraleDispositionDto
}

/**
 * An effect a passage rule's won contest gives the creature it contested, sourced by the mover (the
 * cling a climb leaves). definitionId is the rule that authors it.
 */
export interface PassageAppliedEffect {
  readonly definitionId: string
  readonly effectId: string
  readonly label: string
  readonly plan: CharacterRuleActionActiveEffectPlan
}

/** An effect an enabled optional rule has a qualifying attack give its target, sourced by the attacker. */
export interface AttackAppliedEffect {
  readonly effectId: string
  readonly label: string
  /** Only a melee attack qualifies; otherwise any attack roll does. */
  readonly meleeOnly: boolean
  readonly plan: CharacterRuleActionActiveEffectPlan
}

/**
 * An authored table the GM may be offered a roll on (ATTACK-15): the events that offer it and the
 * rows of its die. Rows are ordered and never overlap; a roll between rows lands on none.
 */
export interface ConsequenceRollTable extends Readonly<ConsequenceRollTableDto> {
  readonly pin: OptionalCombatPolicyPin
  readonly label: string
  readonly triggers: readonly ConsequenceRollTriggerDto[]
}

/**
 * The Encounter's Facing rule as its definition authors it (ATTACK-12): the steps a token may face
 * in, the arc each offset from its facing falls in, the d20 influence an attacker in a target's arc
 * gets, and the arcs of its own facing a creature cannot target into.
 */
export interface FacingRule {
  readonly pin: OptionalCombatPolicyPin
  readonly facingStepDegrees: number
  readonly arcs: readonly {
    readonly arc: FacingArc
    readonly fromDegrees: number
    readonly toDegrees: number
  }[]
  readonly attackerInTargetArc: readonly { readonly arc: FacingArc; readonly influence: string }[]
  readonly sourceCannotTargetInOwnArcs: readonly FacingArc[]
}

type FlankingRelationship = 'ALLIED' | 'HOSTILE' | 'NEUTRAL'

/** One creature of a flanking check: its token, its participant capability and its sight of the target. */
export interface FlankingParticipant {
  readonly actorId: string
  readonly token: Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>
  /** The actor's resolved participant capability; null when it has none (suppressed or absent). */
  readonly participantCapability: ResolvedRuleCapabilityAvailabilityDto | null
  readonly canSeeTarget: boolean
}

/** The facts a melee attack's flanking is decided on: the attacker, its target and its allies by the target. */
export interface FlankingInput extends OptionalCombatPolicyInput {
  readonly melee: boolean
  readonly grid: SceneGrid
  readonly attacker: FlankingParticipant & { readonly targetRelationship: FlankingRelationship }
  readonly target: {
    readonly actorId: string
    readonly token: Pick<SceneToken, 'height' | 'id' | 'position' | 'width'>
  }
  readonly alliedCandidates: readonly (FlankingParticipant & {
    readonly attackerRelationship: FlankingRelationship
    readonly targetRelationship: FlankingRelationship
  })[]
}

/**
 * The Encounter's active massive-damage rule (ATTACK-16): one damage source of at least
 * `threshold` of the holder's maximum hit points owes a save of `savingThrowAbilityDefinitionId`
 * against `difficultyClass`, rolled through `published`, the graph this exact definition builds.
 */
export interface MassiveDamageRule {
  readonly pin: OptionalCombatPolicyPin
  readonly threshold: { readonly numerator: number; readonly denominator: number }
  readonly savingThrowAbilityDefinitionId: string
  readonly difficultyClass: number
  readonly published: ServerPublishedRuleDefinitionDto
}

/**
 * A System's optional-combat policy modules: Disarm, movement passage contests, Cleaving, Morale,
 * Facing, Flanking, Massive Damage, attack-applied effects and consequence tables.
 */
export interface OptionalCombatPolicyCapabilityAdapter {
  readonly gameSystemId: string
  prepareDisarmContest(
    input: DisarmPreparationInput
  ): OptionalCombatResolution<DisarmContestProposal>
  prepareOverrunContest(
    input: OverrunPreparationInput
  ): OptionalCombatResolution<OverrunContestProposal>
  prepareTumbleContest(
    input: TumblePreparationInput
  ): OptionalCombatResolution<TumbleContestProposal>
  prepareClimbOntoContest(
    input: ClimbOntoPreparationInput
  ): OptionalCombatResolution<ClimbOntoContestProposal>
  resolveCleaving(input: CleavingInput): OptionalCombatResolution<CleavingProposal>
  /** Triggers each actor may be checked for now; an actor with none is absent from the map. */
  offerMoraleTriggers(
    input: MoraleOfferInput
  ): ReadonlyMap<string, readonly EncounterMoraleOfferDto[]>
  prepareMoraleSave(input: MoralePreparationInput): OptionalCombatResolution<MoraleSaveProposal>
  /** The enabled consequence tables, empty when the rules that author them are off. */
  consequenceRollTables(input: OptionalCombatPolicyInput): readonly ConsequenceRollTable[]
  /** The effects the Encounter's enabled rules have an attack give its target; none when off. */
  attackAppliedEffects(input: OptionalCombatPolicyInput): readonly AttackAppliedEffect[]
  /** The effects the Encounter's enabled passage rules give the creature a won contest passed; none when off. */
  passageAppliedEffects(input: OptionalCombatPolicyInput): readonly PassageAppliedEffect[]
  /** The Encounter's active Facing rule, or null when facing is off. */
  facingRule(input: OptionalCombatPolicyInput): FacingRule | null
  /** The capability an actor needs to flank, or null when flanking is off. */
  flankingParticipantCapabilityDefinitionId(input: OptionalCombatPolicyInput): string | null
  /** The attack's flanking contributor, or null when the attack is not flanked. */
  resolveFlanking(input: FlankingInput): OptionalCombatD20Contributor | null
  /** The Encounter's active massive-damage rule, or null when it is off. */
  massiveDamageRule(input: OptionalCombatPolicyInput): MassiveDamageRule | null
  /** The facts a holder's massive-damage save runs `rule.published` with. */
  massiveDamageSaveFacts(input: {
    rule: MassiveDamageRule
    targetActorId: string
    target: Pick<MovementTarget, 'effectiveRulePolicyOutput' | 'targetDerivedFacts'>
  }): MaintenanceLinkSaveFacts
}
