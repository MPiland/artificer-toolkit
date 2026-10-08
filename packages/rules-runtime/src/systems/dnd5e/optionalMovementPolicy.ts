import type { AutomationModeDto } from '@artificer-toolkit/schema/api/campaignSettings'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { resolveD20Contributors, type D20RollContributor } from '@artificer-toolkit/shared/rolls'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_OVERRUN_POLICY_MODULE,
  DND5E_TUMBLE_POLICY_MODULE
} from './policyModuleRegistration.js'

type ActionEconomy = 'ACTION' | 'BONUS_ACTION'
type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

interface Dnd5eOptionalMovementPin {
  readonly definitionChecksum: string
  readonly definitionId: string
  readonly definitionVersion: number
  readonly moduleContractVersion: number
  readonly moduleKey: string
}

/** A server-qualified contributor. This policy only appends its own size contributor. */
interface Dnd5eOptionalMovementContributor extends D20RollContributor {
  readonly id: string
  readonly reason: 'EXISTING_QUALIFIED_FACT' | 'SHOVE_ASIDE_POLICY' | 'SIZE_RELATION'
}

interface ContestEvidence {
  readonly initiatorTotal: number | null
  readonly targetTotal: number | null
}

interface PolicyInput {
  readonly automationMode: AutomationModeDto
  readonly gameSystemId: string
  readonly optionalCombatSnapshot: unknown
  readonly optionalCombatSnapshotChecksum: string | null | undefined
}

type Dnd5eOptionalMovementResolution<T> =
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

type CommonPassagePreparationInput = Omit<CommonPassageInput, 'contest'>

type ValidCommonPassageInput = CommonPassageInput & {
  readonly actionEconomy: ActionEconomy
  readonly actionEconomyAvailable: boolean
  readonly contest: { readonly initiatorTotal: number; readonly targetTotal: number }
  readonly initiatorSizeRank: number
  readonly passageAlreadyUsedThisTurn: boolean
  readonly targetSizeRank: number
}

function validCommonPassageFacts(
  input: CommonPassagePreparationInput
): input is Omit<ValidCommonPassageInput, 'contest'> {
  return (
    exactUuid(input.initiatorActorId) &&
    exactUuid(input.blockerActorId) &&
    input.initiatorActorId !== input.blockerActorId &&
    input.actionEconomy !== null &&
    input.actionEconomyAvailable !== null &&
    input.passageAlreadyUsedThisTurn !== null &&
    validSizeRank(input.initiatorSizeRank) &&
    validSizeRank(input.targetSizeRank)
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

interface Dnd5eOverrunProposal {
  readonly contest: ContestEvidence & {
    readonly initiatorCheckDefinitionId: string
    readonly initiatorContributors: readonly Dnd5eOptionalMovementContributor[]
    readonly initiatorMode: 'ADVANTAGE' | 'DISADVANTAGE' | 'NORMAL'
    readonly targetCheckDefinitionId: string
  }
  readonly consumes: { readonly amount: 1; readonly economy: ActionEconomy }
  readonly passage: PassageProposal
  readonly pin: Dnd5eOptionalMovementPin
}

/** Seals an available Overrun contest before either participant rolls. */
export function prepareDnd5eOverrunContest(
  input: CommonPassagePreparationInput
): Dnd5eOptionalMovementResolution<
  Omit<Dnd5eOverrunProposal, 'contest'> & {
    readonly contest: Omit<Dnd5eOverrunProposal['contest'], 'initiatorTotal' | 'targetTotal'>
  }
> {
  const definition = exactDefinition({
    ...input,
    kind: 'OVERRUN',
    module: DND5E_OVERRUN_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'OVERRUN') return { kind: 'INERT' }
  if (!validCommonPassageFacts(input)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_OVERRUN_FACTS' }
  }
  const economy = input.actionEconomy
  if (economy === null || !input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
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
      consumes: { economy, amount: 1 },
      contest: {
        initiatorCheckDefinitionId: parameters.initiatorCheckDefinitionId,
        targetCheckDefinitionId: parameters.targetCheckDefinitionId,
        initiatorContributors: d20.contributors,
        initiatorMode: d20.rollMode
      },
      passage: passage(input.blockerActorId)
    }
  }
}

interface Dnd5eTumbleProposal {
  readonly contest: ContestEvidence & {
    readonly initiatorCheckDefinitionId: string
    readonly targetCheckDefinitionId: string
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
    input.passageAlreadyUsedThisTurn !== null
  )
}

/** Seals an available Tumble contest before either participant rolls. */
export function prepareDnd5eTumbleContest(
  input: Omit<TumbleInput, 'contest'>
): Dnd5eOptionalMovementResolution<
  Omit<Dnd5eTumbleProposal, 'contest'> & {
    readonly contest: Omit<Dnd5eTumbleProposal['contest'], 'initiatorTotal' | 'targetTotal'>
  }
> {
  const definition = exactDefinition({
    ...input,
    kind: 'TUMBLE',
    module: DND5E_TUMBLE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'TUMBLE') return { kind: 'INERT' }
  if (!validTumbleFacts(input as TumbleInput)) {
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MISSING_TUMBLE_FACTS' }
  }
  const economy = input.actionEconomy
  if (economy === null || !input.actionEconomyAvailable || input.passageAlreadyUsedThisTurn) {
    return { kind: 'NOT_APPLICABLE' }
  }
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: pin(definition),
      consumes: { economy, amount: 1 },
      contest: {
        initiatorCheckDefinitionId: parameters.initiatorCheckDefinitionId,
        targetCheckDefinitionId: parameters.targetCheckDefinitionId
      },
      passage: passage(input.blockerActorId)
    }
  }
}
