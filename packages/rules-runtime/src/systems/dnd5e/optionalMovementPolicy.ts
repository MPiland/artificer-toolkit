import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema,
  type Dnd5eOptionalCombatRuleKindDto,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { DND5E_SYSTEM_ID } from './characterActionCapabilityDiscovery.js'
import {
  DND5E_OVERRUN_POLICY_MODULE,
  DND5E_TUMBLE_POLICY_MODULE
} from './policyModuleRegistration.js'
import { resolveDnd5eRollMode } from './rollModePolicy.js'
import type {
  MovementPassageProposal,
  OptionalCombatPolicyInput,
  OptionalCombatPolicyPin,
  OptionalCombatResolution,
  OptionalMovementContributor,
  OverrunContestProposal,
  OverrunPreparationInput,
  TumbleContestProposal,
  TumblePreparationInput
} from '../../optionalCombatPolicyCapability.js'

type PolicyDefinition = EncounterOptionalCombatSnapshotDto['definitions'][number]

function exactDefinition(
  input: OptionalCombatPolicyInput & {
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

function pin(definition: PolicyDefinition): OptionalCombatPolicyPin {
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
}): OptionalMovementContributor | null {
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
  qualifiedContributors: readonly OptionalMovementContributor[]
) {
  const contributors = [...qualifiedContributors]
  const contribution = sizeContributor({
    definitionId: definition.definitionId,
    initiatorSizeRank,
    targetSizeRank
  })
  if (contribution) contributors.push(contribution)
  return { contributors, rollMode: resolveDnd5eRollMode(contributors).rollMode }
}

type ValidPassageFacts<TInput extends TumblePreparationInput> = TInput & {
  readonly actionEconomy: NonNullable<TumblePreparationInput['actionEconomy']>
  readonly actionEconomyAvailable: boolean
  readonly passageAlreadyUsedThisTurn: boolean
}

function validCommonPassageFacts(input: OverrunPreparationInput): input is ValidPassageFacts<
  OverrunPreparationInput & { readonly initiatorSizeRank: number; readonly targetSizeRank: number }
> {
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

function passage(blockerActorId: string): MovementPassageProposal {
  return {
    kind: 'PASS_THROUGH_HOSTILE',
    hostileActorId: blockerActorId,
    currentTurnOnly: true,
    opportunityAttackSuppression: false,
    prohibitEndingInOccupiedSpace: true
  }
}

/** Seals an available Overrun contest before either participant rolls. */
export function prepareDnd5eOverrunContest(
  input: OverrunPreparationInput
): OptionalCombatResolution<OverrunContestProposal> {
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

function validTumbleFacts(
  input: TumblePreparationInput
): input is ValidPassageFacts<TumblePreparationInput> {
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
  input: TumblePreparationInput
): OptionalCombatResolution<TumbleContestProposal> {
  const definition = exactDefinition({
    ...input,
    kind: 'TUMBLE',
    module: DND5E_TUMBLE_POLICY_MODULE
  })
  if (!definition) return { kind: 'INERT' }
  const parameters = definition.document.parameters
  if (parameters.kind !== 'TUMBLE') return { kind: 'INERT' }
  if (!validTumbleFacts(input)) {
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
