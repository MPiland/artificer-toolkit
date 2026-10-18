import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerContestCheckPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { EncounterValidationError } from './encounterErrors.js'
import {
  actorContestFacts,
  encounterBasicActionCheckLabel
} from './encounterMovementPassagePreparation.js'
import {
  isDnd5eOptionalCombatContestPendingContextCurrent,
  prepareDnd5eOptionalCombatContestPendingContext
} from './systems/dnd5e/optionalCombatContestPendingContext.js'

type PreparedMechanics = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>

/**
 * Seals a basic action's contest (Grapple) from current facts: the initiator rolls the action's own
 * check, and the defender is offered each check the action's contest DC lists, with its modifier,
 * contributors and roll mode (D152). It rolls and writes nothing.
 */
export function prepareEncounterBasicActionContest(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  target: EncounterRunActorState
  command: ResolveEncounterActionInputDto
  prepared: PreparedMechanics
  sceneContext: {
    sceneId: string
    sceneVersion: number
    sourceToken: { tokenId: string }
    targetToken: { tokenId: string }
  } | null
  system: SystemAuthoredDto
  actionEconomy: EncounterActionEconomyConsumption | null
  priorContest?: ServerContestCheckPendingApplicationContextDto
}) {
  const { state, actor, target, command, prepared, sceneContext, system } = input
  const { source, plan } = prepared
  if (source.kind !== 'BASIC_ACTION' || plan.kind !== 'SINGLE_GRAPH')
    throw new EncounterValidationError('The selected action is not a basic action contest.')
  const { capability } = source
  const invocation = capability.compiledEffect.invocation
  if (invocation.triggerCode !== 'CHECK' || invocation.check.dc.kind !== 'CONTEST')
    throw new EncounterValidationError('The selected action makes no contested check.')
  const initiatorSkillId = invocation.check.checks.skillIds[0]
  const initiatorCheckDefinitionId =
    initiatorSkillId ?? invocation.check.checks.abilityDefinitionIds[0]
  if (!initiatorCheckDefinitionId)
    throw new EncounterValidationError('A contest action lists one check.')
  const targets = new Map([
    [actor.id, prepared.sourceFacts],
    [target.id, prepared.targetFacts]
  ])
  const facts = (actorId: string, checkKind: 'SKILL' | 'ABILITY', checkDefinitionId: string) =>
    actorContestFacts({
      actorId,
      checkKind,
      checkDefinitionId,
      gameSystemId: state.gameSystemId,
      system,
      targets
    })
  const initiator = facts(
    actor.id,
    initiatorSkillId ? 'SKILL' : 'ABILITY',
    initiatorCheckDefinitionId
  )
  if (initiator.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  const { skillIds, abilityDefinitionIds } = invocation.check.dc.checks
  // The defender is offered only the listed checks it has a total for.
  const defenderChecks = [
    ...skillIds.map((id) => ({ id, kind: 'SKILL' as const })),
    ...abilityDefinitionIds.map((id) => ({ id, kind: 'ABILITY' as const }))
  ].flatMap(({ id, kind }) => {
    const check = facts(target.id, kind, id)
    return check.modifier === null
      ? []
      : [
          {
            checkDefinitionId: id,
            label: encounterBasicActionCheckLabel(system, id),
            rollMode: check.rollMode,
            contributors: check.contributors,
            contributorChecksum: checksumRuleDocument(check.contributors),
            modifier: check.modifier
          }
        ]
  })
  if (!defenderChecks.length)
    throw new EncounterValidationError('The target has no check to contest this action.')
  const sceneDependency = sceneContext
    ? {
        sceneId: sceneContext.sceneId,
        sceneVersion: sceneContext.sceneVersion,
        sourceTokenId: sceneContext.sourceToken.tokenId,
        targetTokenId: sceneContext.targetToken.tokenId
      }
    : null
  const targetCharacter = prepared.targetFacts.characterFacts
  const targetCurrentness = prepared.targetFacts.characterCurrentness
  const { actionEconomy } = input
  const current: Parameters<typeof prepareDnd5eOptionalCombatContestPendingContext>[0] = {
    origin: { kind: 'BASIC_ACTION', initiatorCheckDefinitionId, actionLabel: capability.label },
    actionId: command.actionId,
    sourceActorId: actor.id,
    targetActorId: target.id,
    initiatorControllerCharacterId: initiator.controllerCharacterId,
    sceneContext: sceneDependency,
    positionalDependencyChecksum: checksumRuleDocument(sceneDependency),
    contestGraph: {
      definitionId: plan.published.id,
      checksum: plan.published.checksum,
      identityChecksum: checksumRuleDocument({
        kind: 'BASIC_ACTION',
        definitionId: capability.definitionId,
        definitionChecksum: capability.definitionChecksum,
        compiledEffectChecksum: capability.compiledEffectChecksum,
        graphChecksum: plan.published.checksum
      })
    },
    source: {
      kind: 'BASIC_ACTION',
      definitionId: capability.definitionId,
      definitionVersion: capability.definitionVersion,
      definitionChecksum: capability.definitionChecksum,
      effectId: capability.effectId,
      authoredEffectChecksum: capability.authoredEffectChecksum,
      compiledEffectChecksum: capability.compiledEffectChecksum
    },
    target:
      target.kind === 'CHARACTER'
        ? (() => {
            if (!targetCharacter || !targetCurrentness)
              throw new EncounterValidationError('The contest Character target is stale.')
            const { streamVersion } = targetCharacter.active.play
            return {
              kind: 'CHARACTER' as const,
              characterId: targetCharacter.active.id,
              streamVersion,
              projectionChecksum: targetCurrentness.projectionChecksum,
              mechanicalContextChecksum: targetCurrentness.mechanicalContextChecksum,
              stateChecksum: checksumRuleDocument({
                streamVersion,
                state: prepared.targetFacts.state
              })
            }
          })()
        : { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: checksumRuleDocument(target) },
    initiator: {
      actorId: actor.id,
      requestNodeId: 'initiator_d20',
      rollMode: initiator.rollMode,
      contributors: initiator.contributors,
      contributorChecksum: checksumRuleDocument(initiator.contributors),
      modifier: initiator.modifier
    },
    defender: { actorId: target.id, requestNodeId: 'target_d20', checks: defenderChecks },
    actionEconomy: actionEconomy
      ? {
          definitionId: actionEconomy.definitionId,
          definitionVersion: actionEconomy.definitionVersion,
          definitionChecksum: actionEconomy.definitionChecksum,
          maximum: actionEconomy.maximum,
          beforeUsed: actionEconomy.beforeUsed
        }
      : null,
    rollEvidence: input.priorContest?.rollEvidence ?? { initiator: null, defender: null }
  }
  const contest = prepareDnd5eOptionalCombatContestPendingContext(current)
  if (
    input.priorContest &&
    !isDnd5eOptionalCombatContestPendingContextCurrent({ pending: input.priorContest, current })
  )
    throw new EncounterValidationError('The pending contest facts changed.')
  return {
    contest,
    published: plan.published,
    currentnessChecksum: checksumRuleDocument({ actor, target, sceneContext, contest })
  }
}
