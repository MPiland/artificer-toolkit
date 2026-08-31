import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  activeOptionalCombatDefinitions,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_MARK_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

export const DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE = {
  key: DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  contractVersion: 1
} as const

export const DND5E_DISARM_POLICY_MODULE = {
  key: DND5E_DISARM_OPERATION_KEY,
  contractVersion: 1
} as const

export const DND5E_MARK_POLICY_MODULE = {
  key: DND5E_MARK_OPERATION_KEY,
  contractVersion: 1
} as const

type AutomationMode = 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
type D20Influence = 'ADVANTAGE' | 'DISADVANTAGE'
type D20Mode = 'ADVANTAGE' | 'DISADVANTAGE' | 'NORMAL'
type AbilityCheckKind = 'ATHLETICS' | 'ACROBATICS'

export interface Dnd5eOptionalActionPin {
  readonly definitionChecksum: string
  readonly definitionId: string
  readonly definitionVersion: number
  readonly moduleKey: string
}

export interface Dnd5eOptionalActionContributor {
  readonly influence: D20Influence
  readonly reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS' | 'SIZE_RELATION'
}

interface D20ContestEvidence {
  readonly initiatorTotal: number | null
  readonly targetTotal: number | null
}

interface Dnd5ePolicyInput {
  readonly automationMode: AutomationMode
  readonly gameSystemId: string
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
}

type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

export type Dnd5eOptionalActionResolution<T> =
  | { readonly kind: 'INERT' }
  | { readonly kind: 'JUDGMENT_REQUIRED'; readonly reason: string }
  | { readonly kind: 'NOT_APPLICABLE' }
  | { readonly kind: 'PROPOSED'; readonly proposal: T }

function exactDefinition(
  input: Dnd5ePolicyInput & {
    readonly kind: Dnd5eOptionalCombatRuleKindDto
    readonly module: { readonly key: string; readonly contractVersion: number }
  }
): PolicyDefinition | null {
  if (
    input.automationMode === 'MANUAL' ||
    input.gameSystemId !== DND5E_SYSTEM_ID ||
    input.optionalCombatSnapshot === null ||
    input.optionalCombatSnapshotChecksum === null
  ) {
    return null
  }
  const parsed = encounterOptionalCombatSnapshotDtoSchema.safeParse(input.optionalCombatSnapshot)
  if (
    !parsed.success ||
    parsed.data.gameSystemId !== input.gameSystemId ||
    checksumCanonicalJson(parsed.data) !== input.optionalCombatSnapshotChecksum
  ) {
    return null
  }
  const matches = activeOptionalCombatDefinitions({
    automationMode: input.automationMode,
    snapshot: parsed.data
  }).filter(
    (definition) =>
      definition.document.kind === input.kind &&
      checksumRuleDocument(definition.document) === definition.definitionChecksum &&
      definition.document.module.policyModuleKey === input.module.key &&
      definition.document.module.contractVersion === input.module.contractVersion
  )
  return matches.length === 1 ? matches[0]! : null
}

function pin(definition: PolicyDefinition): Dnd5eOptionalActionPin {
  return {
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum,
    moduleKey: definition.document.module.policyModuleKey
  }
}

function exactUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function validContest(evidence: D20ContestEvidence): boolean {
  return (
    evidence.initiatorTotal !== null &&
    evidence.targetTotal !== null &&
    Number.isInteger(evidence.initiatorTotal) &&
    Number.isInteger(evidence.targetTotal)
  )
}

function resolveMode(contributors: readonly Dnd5eOptionalActionContributor[]): D20Mode {
  const hasAdvantage = contributors.some((contributor) => contributor.influence === 'ADVANTAGE')
  const hasDisadvantage = contributors.some(
    (contributor) => contributor.influence === 'DISADVANTAGE'
  )
  return hasAdvantage === hasDisadvantage ? 'NORMAL' : hasAdvantage ? 'ADVANTAGE' : 'DISADVANTAGE'
}

export interface Dnd5eClimbAttachmentProposal {
  readonly attachment: {
    readonly climberActorId: string
    readonly targetActorId: string
    readonly inheritsTargetMovement: true
    readonly movementWithinTargetFootprint: 'DIFFICULT'
  }
  readonly attackContributor: {
    readonly influence: 'ADVANTAGE'
    readonly scope: 'CLIMBER_VERSUS_ATTACHMENT_TARGET'
  }
  readonly contest: D20ContestEvidence & {
    readonly initiatorCheck: AbilityCheckKind
    readonly targetCheck: 'ACROBATICS'
  }
  readonly pin: Dnd5eOptionalActionPin
}

export interface Dnd5eClimbDislodgeProposal {
  readonly attachment: {
    readonly climberActorId: string
    readonly targetActorId: string
    readonly transition: 'REMOVE'
  }
  readonly contest: D20ContestEvidence & {
    readonly climberCheck: AbilityCheckKind
    readonly targetCheck: 'ATHLETICS'
  }
  readonly landing: 'JUDGMENT_REQUIRED'
  readonly pin: Dnd5eOptionalActionPin
}

/** Pure D&D policy: it proposes a tactical attachment but never writes an Encounter row. */
export function resolveDnd5eClimbOntoLargerCreature(
  input: Dnd5ePolicyInput & {
    readonly climberActorId: string
    readonly climberCheck: AbilityCheckKind | null
    readonly contest: D20ContestEvidence
    readonly suitability: 'SUITABLE' | 'UNSUITABLE' | 'JUDGMENT_REQUIRED' | null
    readonly targetActorId: string
    readonly targetCheck: 'ACROBATICS' | null
    readonly targetSizeRank: number | null
    readonly climberSizeRank: number | null
  }
): Dnd5eOptionalActionResolution<Dnd5eClimbAttachmentProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    module: DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (
    !exactUuid(input.climberActorId) ||
    !exactUuid(input.targetActorId) ||
    input.climberActorId === input.targetActorId ||
    input.climberCheck === null ||
    input.targetCheck !== 'ACROBATICS' ||
    input.targetSizeRank === null ||
    input.climberSizeRank === null ||
    !Number.isInteger(input.targetSizeRank) ||
    !Number.isInteger(input.climberSizeRank) ||
    !validContest(input.contest) ||
    input.suitability === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_CLIMB_FACTS' }
  }
  if (input.suitability === 'JUDGMENT_REQUIRED')
    return { kind: 'JUDGMENT_REQUIRED', reason: 'CLIMB_SUITABILITY_UNRESOLVED' }
  if (input.suitability === 'UNSUITABLE' || input.targetSizeRank <= input.climberSizeRank)
    return { kind: 'NOT_APPLICABLE' }
  const { initiatorTotal, targetTotal } = input.contest
  if (initiatorTotal === null || targetTotal === null || initiatorTotal <= targetTotal)
    return { kind: 'NOT_APPLICABLE' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      contest: {
        ...input.contest,
        initiatorCheck: input.climberCheck,
        targetCheck: input.targetCheck
      },
      attachment: {
        climberActorId: input.climberActorId,
        targetActorId: input.targetActorId,
        inheritsTargetMovement: true,
        movementWithinTargetFootprint: 'DIFFICULT'
      },
      attackContributor: {
        influence: 'ADVANTAGE',
        scope: 'CLIMBER_VERSUS_ATTACHMENT_TARGET'
      }
    }
  }
}

/** Resolves an already-authorized dislodge attempt; safe landing is intentionally not inferred. */
export function resolveDnd5eClimbDislodge(
  input: Dnd5ePolicyInput & {
    readonly climberActorId: string
    readonly climberCheck: AbilityCheckKind | null
    readonly contest: D20ContestEvidence
    readonly targetActorId: string
    readonly targetCheck: 'ATHLETICS' | null
  }
): Dnd5eOptionalActionResolution<Dnd5eClimbDislodgeProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'CLIMB_ONTO_LARGER_CREATURE',
    module: DND5E_CLIMB_ONTO_LARGER_CREATURE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (
    !exactUuid(input.climberActorId) ||
    !exactUuid(input.targetActorId) ||
    input.climberActorId === input.targetActorId ||
    input.climberCheck === null ||
    input.targetCheck !== 'ATHLETICS' ||
    !validContest(input.contest)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_DISLODGE_FACTS' }
  }
  const { initiatorTotal, targetTotal } = input.contest
  if (initiatorTotal === null || targetTotal === null || initiatorTotal <= targetTotal)
    return { kind: 'NOT_APPLICABLE' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      contest: {
        ...input.contest,
        climberCheck: input.climberCheck,
        targetCheck: input.targetCheck
      },
      attachment: {
        climberActorId: input.climberActorId,
        targetActorId: input.targetActorId,
        transition: 'REMOVE'
      },
      landing: 'JUDGMENT_REQUIRED'
    }
  }
}

export interface Dnd5eDisarmProposal {
  readonly contest: D20ContestEvidence & {
    readonly targetCheck: AbilityCheckKind
    readonly initiatorMode: D20Mode
    readonly targetMode: D20Mode
    readonly initiatorContributors: readonly Dnd5eOptionalActionContributor[]
    readonly targetContributors: readonly Dnd5eOptionalActionContributor[]
  }
  readonly disposition: {
    readonly placement: 'JUDGMENT_REQUIRED'
    readonly heldItemId: string
    readonly ownerActorId: string
    readonly ownerState: 'CHARACTER_SHEET' | 'ENCOUNTER_ACTOR'
    readonly transition: 'NO_LONGER_HELD'
  }
  readonly pin: Dnd5eOptionalActionPin
}

/** Pure D&D policy: a successful disarm leaves item placement to table adjudication. */
export function resolveDnd5eDisarm(
  input: Dnd5ePolicyInput & {
    readonly attackerActorId: string
    readonly attackerSizeRank: number | null
    readonly contest: D20ContestEvidence
    readonly heldItemId: string | null
    readonly targetActorId: string
    readonly targetCheck: AbilityCheckKind | null
    readonly targetHoldsItemWithTwoOrMoreHands: boolean | null
    readonly targetItemOwnerState: 'CHARACTER_SHEET' | 'ENCOUNTER_ACTOR' | null
    readonly targetSizeRank: number | null
    readonly qualifyingWeaponAttack: boolean | null
  }
): Dnd5eOptionalActionResolution<Dnd5eDisarmProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'DISARM',
    module: DND5E_DISARM_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (
    !exactUuid(input.attackerActorId) ||
    !exactUuid(input.targetActorId) ||
    input.attackerActorId === input.targetActorId ||
    input.qualifyingWeaponAttack === null ||
    input.targetHoldsItemWithTwoOrMoreHands === null ||
    input.targetCheck === null ||
    input.heldItemId === null ||
    !exactUuid(input.heldItemId) ||
    input.targetItemOwnerState === null ||
    input.attackerSizeRank === null ||
    input.targetSizeRank === null ||
    !Number.isInteger(input.attackerSizeRank) ||
    !Number.isInteger(input.targetSizeRank) ||
    !validContest(input.contest)
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_DISARM_FACTS' }
  }
  if (!input.qualifyingWeaponAttack) return { kind: 'NOT_APPLICABLE' }
  const initiatorContributors: Dnd5eOptionalActionContributor[] = []
  const targetContributors: Dnd5eOptionalActionContributor[] = []
  if (input.targetHoldsItemWithTwoOrMoreHands)
    initiatorContributors.push({
      influence: 'DISADVANTAGE',
      reason: 'TARGET_HELD_WITH_TWO_OR_MORE_HANDS'
    })
  if (input.attackerSizeRank > input.targetSizeRank)
    initiatorContributors.push({ influence: 'ADVANTAGE', reason: 'SIZE_RELATION' })
  if (input.targetSizeRank > input.attackerSizeRank)
    targetContributors.push({ influence: 'ADVANTAGE', reason: 'SIZE_RELATION' })
  const { initiatorTotal, targetTotal } = input.contest
  if (initiatorTotal === null || targetTotal === null || initiatorTotal <= targetTotal)
    return { kind: 'NOT_APPLICABLE' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      contest: {
        ...input.contest,
        targetCheck: input.targetCheck,
        initiatorContributors,
        targetContributors,
        initiatorMode: resolveMode(initiatorContributors),
        targetMode: resolveMode(targetContributors)
      },
      disposition: {
        heldItemId: input.heldItemId,
        ownerActorId: input.targetActorId,
        ownerState: input.targetItemOwnerState,
        transition: 'NO_LONGER_HELD',
        placement: 'JUDGMENT_REQUIRED'
      }
    }
  }
}

export interface Dnd5eMarkEffectProposal {
  readonly expiresAt: 'END_OF_MARKER_NEXT_TURN'
  readonly markerActorId: string
  readonly targetActorId: string
  readonly pin: Dnd5eOptionalActionPin
  readonly reaction: {
    readonly doesNotConsumeNormalReactionAllowance: true
    readonly maximumUsesPerTurn: 1
    readonly requiresReactionEnabled: true
    readonly trigger: 'EXISTING_OPPORTUNITY_ATTACK'
  }
}

/** Applies on either a hit or miss of the already-qualified melee attack. */
export function resolveDnd5eMark(
  input: Dnd5ePolicyInput & {
    readonly markerActorId: string
    readonly qualifyingMeleeAttackResolved: boolean | null
    readonly targetActorId: string
  }
): Dnd5eOptionalActionResolution<Dnd5eMarkEffectProposal> {
  const definition = exactDefinition({ ...input, kind: 'MARK', module: DND5E_MARK_POLICY_MODULE })
  if (!definition) return { kind: 'INERT' }
  if (
    !exactUuid(input.markerActorId) ||
    !exactUuid(input.targetActorId) ||
    input.markerActorId === input.targetActorId ||
    input.qualifyingMeleeAttackResolved === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MARK_FACTS' }
  }
  if (!input.qualifyingMeleeAttackResolved) return { kind: 'NOT_APPLICABLE' }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      markerActorId: input.markerActorId,
      targetActorId: input.targetActorId,
      expiresAt: 'END_OF_MARKER_NEXT_TURN',
      reaction: {
        trigger: 'EXISTING_OPPORTUNITY_ATTACK',
        requiresReactionEnabled: true,
        doesNotConsumeNormalReactionAllowance: true,
        maximumUsesPerTurn: 1
      }
    }
  }
}

export interface Dnd5eMarkedOpportunityAttackProposal {
  readonly contributor: { readonly influence: 'ADVANTAGE'; readonly source: 'MARK' }
  readonly consumesMarkedOpportunityAttackUse: true
  readonly pin: Dnd5eOptionalActionPin
}

/** Does not create an opportunity attack; it augments one already deemed eligible. */
export function resolveDnd5eMarkedOpportunityAttack(
  input: Dnd5ePolicyInput & {
    readonly existingOpportunityAttackEligible: boolean | null
    readonly markEffect: Dnd5eMarkEffectProposal | null
    readonly markedOpportunityAttackUsesThisTurn: number | null
    readonly reactionsEnabled: boolean | null
  }
): Dnd5eOptionalActionResolution<Dnd5eMarkedOpportunityAttackProposal> {
  const definition = exactDefinition({ ...input, kind: 'MARK', module: DND5E_MARK_POLICY_MODULE })
  if (!definition) return { kind: 'INERT' }
  if (
    input.existingOpportunityAttackEligible === null ||
    input.reactionsEnabled === null ||
    input.markedOpportunityAttackUsesThisTurn === null ||
    !Number.isInteger(input.markedOpportunityAttackUsesThisTurn) ||
    input.markedOpportunityAttackUsesThisTurn < 0 ||
    input.markEffect === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_MARK_REACTION_FACTS' }
  }
  if (
    !input.existingOpportunityAttackEligible ||
    !input.reactionsEnabled ||
    input.markedOpportunityAttackUsesThisTurn >= 1 ||
    input.markEffect.pin.definitionId !== definition.definitionId ||
    input.markEffect.pin.definitionChecksum !== definition.definitionChecksum ||
    input.markEffect.pin.definitionVersion !== definition.definitionVersion ||
    input.markEffect.pin.moduleKey !== DND5E_MARK_POLICY_MODULE.key
  ) {
    return { kind: 'NOT_APPLICABLE' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      contributor: { influence: 'ADVANTAGE', source: 'MARK' },
      consumesMarkedOpportunityAttackUse: true
    }
  }
}
