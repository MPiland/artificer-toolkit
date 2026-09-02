import type { DBLike, EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type {
  OptionalCombatPassageChoicePendingContextDto,
  ServerOptionalCombatContestPendingApplicationContextDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { createDnd5eOptionalCombatContestGraph } from '../rules/systems/dnd5e/optionalCombatContestGraph.js'
import { prepareDnd5eOptionalCombatContestPendingContext } from '../rules/systems/dnd5e/optionalCombatContestPendingContext.js'
import {
  prepareDnd5eOverrunContest,
  prepareDnd5eTumbleContest
} from '../rules/systems/dnd5e/optionalMovementPolicy.js'
import type { LockedEncounterActiveEffectTargets } from './encounterActiveEffectTargetState.js'
import { prepareActionEconomyConsumption } from './encounterActionSettlementCore.js'
import { prepareEncounterActorOptionalContestFacts } from './encounterActorOptionalContestContext.js'
import { EncounterConflictError } from './encounterErrors.js'

function sizeRank(size: string | null): number | null {
  return (
    ({ TINY: 0, SMALL: 1, MEDIUM: 2, LARGE: 3, HUGE: 4, GARGANTUAN: 5 } as const)[
      size as keyof typeof sizeRankTable
    ] ?? null
  )
}
const sizeRankTable = { TINY: 0, SMALL: 1, MEDIUM: 2, LARGE: 3, HUGE: 4, GARGANTUAN: 5 } as const

function effectivePolicy(
  character: LockedEncounterActiveEffectTargets['lockedCharacters'] extends ReadonlyMap<
    string,
    infer Value
  >
    ? Value
    : never
) {
  return (
    character.effectiveRulePolicyOutput ??
    (character.overlay.kind === 'MATERIALIZED'
      ? character.overlay.rulePolicyOutput
      : character.mechanics.rulePolicyOutput)
  )
}

function actorSize(input: {
  actor: EncounterActorRecord
  targets: LockedEncounterActiveEffectTargets
}): string | null {
  if (input.actor.kind === 'CHARACTER' && input.actor.sourceId) {
    const character = input.targets.lockedCharacters.get(input.actor.sourceId)
    if (!character) throw new EncounterConflictError('Movement passage Character facts are stale.')
    return character.mechanics.initiativeActorFacts.effectiveSize
  }
  if (input.actor.kind === 'CREATURE') {
    return (
      prepareEncounterActorOptionalContestFacts({
        targets: input.targets,
        targetActorId: input.actor.id
      })?.size ?? null
    )
  }
  return null
}

function actorCheckFacts(input: {
  actor: EncounterActorRecord
  checkDefinitionId: string
  targets: LockedEncounterActiveEffectTargets
}) {
  if (input.actor.kind === 'CHARACTER' && input.actor.sourceId) {
    const character = input.targets.lockedCharacters.get(input.actor.sourceId)
    if (!character) throw new EncounterConflictError('Movement passage Character facts are stale.')
    const policy = effectivePolicy(character)
    const modifier = character.mechanics.initiativeActorFacts.checkTotals[input.checkDefinitionId]
    return {
      controllerCharacterId: character.id,
      contributors: (policy.rollContributorEvidence.skillChecks[input.checkDefinitionId] ?? []).map(
        ({ domainKey, grantId, influence, sourceId }) => ({
          domainKey: domainKey ?? null,
          grantId: grantId ?? null,
          influence,
          sourceId
        })
      ),
      modifier: Number.isSafeInteger(modifier) ? modifier : null,
      rollMode: policy.rollModes.skillChecks[input.checkDefinitionId] ?? 'NORMAL',
      size: actorSize(input)
    }
  }
  if (input.actor.kind === 'CREATURE') {
    const facts = prepareEncounterActorOptionalContestFacts({
      targets: input.targets,
      targetActorId: input.actor.id
    })
    return {
      controllerCharacterId: null,
      contributors: [],
      modifier: facts?.ruleFacts.checkTotals[input.checkDefinitionId] ?? null,
      rollMode: 'NORMAL' as const,
      size: actorSize(input)
    }
  }
  return {
    controllerCharacterId: null,
    contributors: [],
    modifier: null,
    rollMode: 'NORMAL' as const,
    size: null
  }
}

/** Builds a sealed Overrun/Tumble contest only from an issued passage option and locked facts. */
export async function prepareEncounterMovementPassageContest(input: {
  readonly choice: OptionalCombatPassageChoicePendingContextDto
  readonly db: DBLike
  readonly encounter: EncounterRecord
  readonly targets: LockedEncounterActiveEffectTargets
  readonly optionId: string
}): Promise<ServerOptionalCombatContestPendingApplicationContextDto> {
  const option = input.choice.options.find((candidate) => candidate.optionId === input.optionId)
  if (!option) throw new EncounterConflictError('Movement passage option is unavailable.')
  const sourceActor = input.encounter.actors.find(
    (actor) => actor.id === input.choice.sourceActorId
  )
  const blocker = input.encounter.actors.find(
    (actor) => actor.id === input.choice.movement.blockerActorId
  )
  if (!sourceActor || !blocker)
    throw new EncounterConflictError('Movement passage actors are stale.')
  const economy = await prepareActionEconomyConsumption({
    db: input.db,
    encounter: input.encounter,
    activation: { code: option.economy, amount: 1 },
    gameSystemId: input.encounter.gameSystemId,
    sourceActor,
    targets: input.targets
  })
  if (!economy) throw new EncounterConflictError('Movement passage allowance is unavailable.')
  const sourceSize = actorSize({ actor: sourceActor, targets: input.targets })
  const blockerSize = actorSize({ actor: blocker, targets: input.targets })
  const common = {
    actionEconomy: option.economy,
    actionEconomyAvailable: true,
    automationMode: input.encounter.automationMode,
    blockerActorId: blocker.id,
    gameSystemId: input.encounter.gameSystemId,
    initiatorActorId: sourceActor.id,
    optionalCombatSnapshot: input.encounter.optionalCombatSnapshot,
    optionalCombatSnapshotChecksum: input.encounter.optionalCombatSnapshotChecksum,
    passageAlreadyUsedThisTurn: false
  }
  const preliminary =
    option.ruleKind === 'OVERRUN'
      ? prepareDnd5eOverrunContest({
          ...common,
          initiatorSizeRank: sizeRank(sourceSize),
          targetSizeRank: sizeRank(blockerSize),
          qualifiedInitiatorContributors: []
        })
      : prepareDnd5eTumbleContest(common)
  if (preliminary.kind !== 'PROPOSED')
    throw new EncounterConflictError('Movement passage policy is unavailable.')
  const initiator = actorCheckFacts({
    actor: sourceActor,
    checkDefinitionId: preliminary.proposal.contest.initiatorCheckDefinitionId,
    targets: input.targets
  })
  const defender = actorCheckFacts({
    actor: blocker,
    checkDefinitionId: preliminary.proposal.contest.targetCheckDefinitionId,
    targets: input.targets
  })
  if (initiator.modifier === null || defender.modifier === null)
    throw new EncounterConflictError('Movement passage contest facts are unavailable.')
  const resolved =
    option.ruleKind === 'OVERRUN'
      ? prepareDnd5eOverrunContest({
          ...common,
          initiatorSizeRank: sizeRank(initiator.size),
          targetSizeRank: sizeRank(defender.size),
          qualifiedInitiatorContributors: initiator.contributors.map((contributor) => ({
            id: contributor.sourceId,
            influence: contributor.influence,
            reason: 'EXISTING_QUALIFIED_FACT' as const
          }))
        })
      : prepareDnd5eTumbleContest(common)
  if (resolved.kind !== 'PROPOSED')
    throw new EncounterConflictError('Movement passage policy changed before contest.')
  const proposal = resolved.proposal
  if (
    proposal.pin.definitionId !== option.definitionId ||
    proposal.pin.definitionVersion !== option.definitionVersion ||
    proposal.pin.definitionChecksum !== option.definitionChecksum ||
    proposal.pin.moduleKey !== option.moduleKey ||
    proposal.pin.moduleContractVersion !== option.moduleContractVersion
  ) {
    throw new EncounterConflictError('Movement passage definition is stale.')
  }
  let initiatorContributors: ServerOptionalCombatContestPendingApplicationContextDto['initiator']['contributors'] =
    [...initiator.contributors]
  let initiatorRollMode = initiator.rollMode
  if (option.ruleKind === 'OVERRUN') {
    const overrun = prepareDnd5eOverrunContest({
      ...common,
      initiatorSizeRank: sizeRank(initiator.size),
      targetSizeRank: sizeRank(defender.size),
      qualifiedInitiatorContributors: initiator.contributors.map((contributor) => ({
        id: contributor.sourceId,
        influence: contributor.influence,
        reason: 'EXISTING_QUALIFIED_FACT' as const
      }))
    })
    if (overrun.kind !== 'PROPOSED')
      throw new EncounterConflictError('Movement passage policy changed before contest.')
    initiatorContributors = overrun.proposal.contest.initiatorContributors.map((contributor) => ({
      sourceId: contributor.id,
      grantId: null,
      domainKey: null,
      influence: contributor.influence
    }))
    initiatorRollMode = overrun.proposal.contest.initiatorMode
  }
  const graph = createDnd5eOptionalCombatContestGraph(proposal.pin)
  return prepareDnd5eOptionalCombatContestPendingContext({
    actionKind: option.ruleKind,
    actionId: option.optionId,
    sourceActorId: sourceActor.id,
    targetActorId: blocker.id,
    initiatorControllerCharacterId: initiator.controllerCharacterId,
    sceneContext: {
      sceneId: input.choice.movement.root.sceneId,
      sceneVersion: input.choice.movement.root.currentSceneVersion,
      sourceTokenId: input.choice.sourceTokenId,
      targetTokenId: input.choice.movement.blockerTokenId
    },
    positionalDependencyChecksum: checksumRuleDocument(input.choice.movement),
    optionalCombat: {
      snapshotChecksum: input.encounter.optionalCombatSnapshotChecksum!,
      definitionId: proposal.pin.definitionId,
      definitionVersion: proposal.pin.definitionVersion,
      definitionChecksum: proposal.pin.definitionChecksum,
      moduleKey: proposal.pin.moduleKey,
      moduleContractVersion: proposal.pin.moduleContractVersion
    },
    contestGraph: {
      definitionId: graph.published.id,
      checksum: graph.published.checksum,
      identityChecksum: graph.identityChecksum
    },
    optionId: option.optionId,
    selectionContractChecksum: checksumRuleDocument(option),
    resolvedSelectionChecksum: checksumRuleDocument({ optionId: option.optionId }),
    source: {
      kind: 'OPTIONAL_COMBAT_DEFINITION',
      definitionId: proposal.pin.definitionId,
      definitionVersion: proposal.pin.definitionVersion,
      definitionChecksum: proposal.pin.definitionChecksum,
      moduleKey: proposal.pin.moduleKey,
      moduleContractVersion: proposal.pin.moduleContractVersion
    },
    target: {
      kind: 'ENCOUNTER_ACTOR',
      currentnessChecksum: input.choice.movement.blockerCurrentnessChecksum
    },
    initiator: {
      actorId: sourceActor.id,
      requestNodeId: 'initiator_d20',
      rollMode: initiatorRollMode,
      contributors: initiatorContributors,
      contributorChecksum: checksumRuleDocument(initiatorContributors),
      modifier: initiator.modifier
    },
    defender: {
      actorId: blocker.id,
      requestNodeId: 'target_d20',
      rollMode: defender.rollMode,
      contributors: defender.contributors,
      contributorChecksum: checksumRuleDocument(defender.contributors),
      modifier: defender.modifier,
      checkDefinitionId: proposal.contest.targetCheckDefinitionId
    },
    rollEvidence: { initiator: null, defender: null },
    selection:
      option.ruleKind === 'OVERRUN'
        ? {
            kind: 'OVERRUN',
            economy: option.economy,
            defenderCheckDefinitionId: proposal.contest.targetCheckDefinitionId
          }
        : {
            kind: 'TUMBLE',
            economy: option.economy,
            defenderCheckDefinitionId: proposal.contest.targetCheckDefinitionId
          },
    actionEconomy: {
      definitionId: economy.definitionId,
      definitionVersion: economy.definitionVersion,
      definitionChecksum: economy.definitionChecksum,
      maximum: economy.maximum,
      beforeUsed: economy.beforeUsed
    },
    movementContinuation: input.choice.movement
  })
}
