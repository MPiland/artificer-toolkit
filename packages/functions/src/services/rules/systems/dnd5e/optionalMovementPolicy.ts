import { checksumCanonicalJson } from '@artificer-toolkit/db'
import {
  activeOptionalCombatDefinitions,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_OPERATION_KEY,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { resolveD20Contributors, type D20RollContributor } from '@artificer-toolkit/shared/rolls'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'

export const DND5E_OVERRUN_POLICY_MODULE = {
  key: DND5E_OVERRUN_OPERATION_KEY,
  contractVersion: 1
} as const

export const DND5E_SHOVE_ASIDE_POLICY_MODULE = {
  key: DND5E_SHOVE_ASIDE_OPERATION_KEY,
  contractVersion: 1
} as const

export const DND5E_TUMBLE_POLICY_MODULE = {
  key: DND5E_TUMBLE_OPERATION_KEY,
  contractVersion: 1
} as const

type AutomationMode = 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
type ActionEconomy = 'ACTION' | 'BONUS_ACTION'
type AbilityCheck = 'ATHLETICS' | 'ACROBATICS'
type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

export interface Dnd5eOptionalMovementPin {
  readonly definitionChecksum: string
  readonly definitionId: string
  readonly definitionVersion: number
  readonly moduleContractVersion: number
  readonly moduleKey: string
}

/** A server-qualified contributor. This policy only appends its own size contributor. */
export interface Dnd5eOptionalMovementContributor extends D20RollContributor {
  readonly id: string
  readonly reason: 'EXISTING_QUALIFIED_FACT' | 'SHOVE_ASIDE_POLICY' | 'SIZE_RELATION'
}

interface ContestEvidence {
  readonly initiatorTotal: number | null
  readonly targetTotal: number | null
}

interface PolicyInput {
  readonly automationMode: AutomationMode
  readonly gameSystemId: string
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
}

export type Dnd5eOptionalMovementResolution<T> =
  | { readonly kind: 'INERT' }
  | { readonly kind: 'JUDGMENT_REQUIRED'; readonly reason: string }
  | { readonly kind: 'NOT_APPLICABLE' }
  | { readonly kind: 'PROPOSED'; readonly proposal: T }

function exactDefinition(
  input: PolicyInput & {
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

function pin(definition: PolicyDefinition): Dnd5eOptionalMovementPin {
  return {
    definitionId: definition.definitionId,
    definitionVersion: definition.definitionVersion,
    definitionChecksum: definition.definitionChecksum,
    moduleContractVersion: definition.document.module.contractVersion,
    moduleKey: definition.document.module.policyModuleKey
  }
}

function exactUuid(value: string): boolean {
  const parsed = postgresUuidSchema.safeParse(value)
  return parsed.success && parsed.data === value
}

function validSizeRank(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0
}

function validContest(value: ContestEvidence): value is {
  readonly initiatorTotal: number
  readonly targetTotal: number
} {
  return (
    value.initiatorTotal !== null &&
    value.targetTotal !== null &&
    Number.isSafeInteger(value.initiatorTotal) &&
    Number.isSafeInteger(value.targetTotal)
  )
}

function sizeContributor(input: {
  readonly definitionId: string
  readonly initiatorSizeRank: number
  readonly targetSizeRank: number
}): Dnd5eOptionalMovementContributor | null {
  if (input.initiatorSizeRank === input.targetSizeRank) return null
  return {
    id: `${input.definitionId}:size-relation`,
    influence: input.initiatorSizeRank > input.targetSizeRank ? 'ADVANTAGE' : 'DISADVANTAGE',
    reason: 'SIZE_RELATION'
  }
}

function resolvedInitiatorD20(
  definition: PolicyDefinition,
  initiatorSizeRank: number,
  targetSizeRank: number,
  qualifiedContributors: readonly Dnd5eOptionalMovementContributor[]
) {
  const contributors = [...qualifiedContributors]
  const contribution = sizeContributor({
    definitionId: definition.definitionId,
    initiatorSizeRank,
    targetSizeRank
  })
  if (contribution) contributors.push(contribution)
  return resolveD20Contributors(contributors)
}

interface PassageProposal {
  readonly currentTurnOnly: true
  readonly hostileActorId: string
  readonly kind: 'PASS_THROUGH_HOSTILE'
  readonly opportunityAttackSuppression: false
  readonly prohibitEndingInOccupiedSpace: true
}

interface CommonPassageInput extends PolicyInput {
  readonly actionEconomy: ActionEconomy | null
  readonly actionEconomyAvailable: boolean | null
  readonly blockerActorId: string
  readonly contest: ContestEvidence
  readonly initiatorActorId: string
  readonly initiatorSizeRank: number | null
  readonly passageAlreadyUsedThisTurn: boolean | null
  readonly targetSizeRank: number | null
  readonly qualifiedInitiatorContributors: readonly Dnd5eOptionalMovementContributor[]
}

type ValidCommonPassageInput = CommonPassageInput & {
  readonly actionEconomy: ActionEconomy
  readonly actionEconomyAvailable: boolean
  readonly contest: { readonly initiatorTotal: number; readonly targetTotal: number }
  readonly initiatorSizeRank: number
  readonly passageAlreadyUsedThisTurn: boolean
  readonly targetSizeRank: number
}

function validCommonPassageFacts(input: CommonPassageInput): input is ValidCommonPassageInput {
  return (
    exactUuid(input.initiatorActorId) &&
    exactUuid(input.blockerActorId) &&
    input.initiatorActorId !== input.blockerActorId &&
    input.actionEconomy !== null &&
    input.actionEconomyAvailable !== null &&
    input.passageAlreadyUsedThisTurn !== null &&
    validSizeRank(input.initiatorSizeRank) &&
    validSizeRank(input.targetSizeRank) &&
    validContest(input.contest)
  )
}

function passage(blockerActorId: string): PassageProposal {
  return {
    kind: 'PASS_THROUGH_HOSTILE',
    hostileActorId: blockerActorId,
    currentTurnOnly: true,
    opportunityAttackSuppression: false,
    prohibitEndingInOccupiedSpace: true
  }
}

export interface Dnd5eOverrunProposal {
  readonly contest: ContestEvidence & {
    readonly initiatorCheck: 'ATHLETICS'
    readonly initiatorContributors: readonly Dnd5eOptionalMovementContributor[]
    readonly initiatorMode: 'ADVANTAGE' | 'DISADVANTAGE' | 'NORMAL'
    readonly targetCheck: 'ATHLETICS'
  }
  readonly consumes: { readonly amount: 1; readonly economy: ActionEconomy }
  readonly passage: PassageProposal
  readonly pin: Dnd5eOptionalMovementPin
}

/** Pure D&D policy; it proposes a one-turn passage and never changes Scene occupancy. */
export function resolveDnd5eOverrun(
  input: CommonPassageInput
): Dnd5eOptionalMovementResolution<Dnd5eOverrunProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'OVERRUN',
    module: DND5E_OVERRUN_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (!validCommonPassageFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_OVERRUN_FACTS' }
  }
  if (!input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (input.contest.initiatorTotal <= input.contest.targetTotal) {
    return { kind: 'NOT_APPLICABLE' }
  }
  const d20 = resolvedInitiatorD20(
    definition,
    input.initiatorSizeRank,
    input.targetSizeRank,
    input.qualifiedInitiatorContributors
  )
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      consumes: { economy: input.actionEconomy, amount: 1 },
      contest: {
        ...input.contest,
        initiatorCheck: 'ATHLETICS',
        targetCheck: 'ATHLETICS',
        initiatorContributors: d20.contributors,
        initiatorMode: d20.rollMode
      },
      passage: passage(input.blockerActorId)
    }
  }
}

export interface Dnd5eTumbleProposal {
  readonly contest: ContestEvidence & {
    readonly initiatorCheck: 'ACROBATICS'
    readonly targetCheck: 'ACROBATICS'
  }
  readonly consumes: { readonly amount: 1; readonly economy: ActionEconomy }
  readonly passage: PassageProposal
  readonly pin: Dnd5eOptionalMovementPin
}

type TumbleInput = Omit<
  CommonPassageInput,
  'initiatorSizeRank' | 'qualifiedInitiatorContributors' | 'targetSizeRank'
>

type ValidTumbleInput = TumbleInput & {
  readonly actionEconomy: ActionEconomy
  readonly actionEconomyAvailable: boolean
  readonly contest: { readonly initiatorTotal: number; readonly targetTotal: number }
  readonly passageAlreadyUsedThisTurn: boolean
}

function validTumbleFacts(input: TumbleInput): input is ValidTumbleInput {
  return (
    exactUuid(input.initiatorActorId) &&
    exactUuid(input.blockerActorId) &&
    input.initiatorActorId !== input.blockerActorId &&
    input.actionEconomy !== null &&
    input.actionEconomyAvailable !== null &&
    input.passageAlreadyUsedThisTurn !== null &&
    validContest(input.contest)
  )
}

/** Tumble uses its own Acrobatics contest and deliberately does not suppress opportunity attacks. */
export function resolveDnd5eTumble(
  input: TumbleInput
): Dnd5eOptionalMovementResolution<Dnd5eTumbleProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'TUMBLE',
    module: DND5E_TUMBLE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (!validTumbleFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_TUMBLE_FACTS' }
  }
  if (!input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (input.contest.initiatorTotal <= input.contest.targetTotal) {
    return { kind: 'NOT_APPLICABLE' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      consumes: { economy: input.actionEconomy, amount: 1 },
      contest: { ...input.contest, initiatorCheck: 'ACROBATICS', targetCheck: 'ACROBATICS' },
      passage: passage(input.blockerActorId)
    }
  }
}

export interface Dnd5eShoveAsideProposal {
  readonly contest: {
    readonly initiatorCheck: 'ATHLETICS'
    readonly initiatorContributors: readonly Dnd5eOptionalMovementContributor[]
    readonly initiatorMode: 'DISADVANTAGE' | 'NORMAL'
    readonly initiatorTotal: number | null
    readonly targetCheck: AbilityCheck
    readonly targetTotal: number | null
  }
  readonly displacement: {
    readonly distanceFeet: 5
    readonly opportunityAttackSuppression: false
    readonly remainsWithinInitiatorReach: true
    readonly targetActorId: string
    readonly type: 'FORCED'
  }
  readonly replacesAttack: true
  readonly pin: Dnd5eOptionalMovementPin
}

/** Pure D&D policy; destination geometry is supplied only after the Scene validates it. */
export function resolveDnd5eShoveAside(
  input: PolicyInput & {
    readonly attackerActorId: string
    readonly attackerSizeRank: number | null
    readonly attackReplacementAvailable: boolean | null
    readonly contest: ContestEvidence
    readonly destination: {
      readonly isLegal: boolean
      readonly remainsWithinAttackerReach: boolean
      readonly distanceFeet: number
    } | null
    readonly targetActorId: string
    readonly targetCheck: AbilityCheck | null
    readonly targetIncapacitated: boolean | null
    readonly targetInReach: boolean | null
    readonly targetSizeRank: number | null
    readonly qualifiedInitiatorContributors: readonly Dnd5eOptionalMovementContributor[]
  }
): Dnd5eOptionalMovementResolution<Dnd5eShoveAsideProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'SHOVE_ASIDE',
    module: DND5E_SHOVE_ASIDE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  if (
    !exactUuid(input.attackerActorId) ||
    !exactUuid(input.targetActorId) ||
    input.attackerActorId === input.targetActorId ||
    !validSizeRank(input.attackerSizeRank) ||
    !validSizeRank(input.targetSizeRank) ||
    input.attackReplacementAvailable === null ||
    input.targetInReach === null ||
    input.targetIncapacitated === null ||
    input.destination === null
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_SHOVE_ASIDE_FACTS' }
  }
  if (
    !input.destination.isLegal ||
    !input.destination.remainsWithinAttackerReach ||
    input.destination.distanceFeet !== 5
  ) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'SHOVE_ASIDE_DESTINATION_UNRESOLVED' }
  }
  if (
    !input.attackReplacementAvailable ||
    !input.targetInReach ||
    input.targetSizeRank > input.attackerSizeRank + 1
  ) {
    return { kind: 'NOT_APPLICABLE' }
  }
  if (!input.targetIncapacitated && (!validContest(input.contest) || input.targetCheck === null)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_SHOVE_ASIDE_CONTEST_FACTS' }
  }
  if (
    !input.targetIncapacitated &&
    input.contest.initiatorTotal !== null &&
    input.contest.targetTotal !== null &&
    input.contest.initiatorTotal <= input.contest.targetTotal
  ) {
    return { kind: 'NOT_APPLICABLE' }
  }
  const contributor: Dnd5eOptionalMovementContributor = {
    id: `${definition.definitionId}:shove-aside`,
    influence: 'DISADVANTAGE',
    reason: 'SHOVE_ASIDE_POLICY'
  }
  const d20 = resolveD20Contributors([...input.qualifiedInitiatorContributors, contributor])
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      replacesAttack: true,
      contest: {
        initiatorCheck: 'ATHLETICS',
        targetCheck: input.targetCheck ?? 'ATHLETICS',
        initiatorTotal: input.contest.initiatorTotal,
        targetTotal: input.contest.targetTotal,
        initiatorContributors: d20.contributors,
        initiatorMode: d20.rollMode === 'ADVANTAGE' ? 'NORMAL' : d20.rollMode
      },
      displacement: {
        type: 'FORCED',
        targetActorId: input.targetActorId,
        distanceFeet: 5,
        remainsWithinInitiatorReach: true,
        opportunityAttackSuppression: false
      }
    }
  }
}
