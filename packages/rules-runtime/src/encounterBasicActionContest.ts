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
import { freezeD20Context } from './encounterD20Settlement.js'
import { EncounterValidationError } from './encounterErrors.js'
import { ESCAPE_ACTION_LABEL, findEncounterHolderContestEscape } from './encounterEscapeCheck.js'
import {
  actorContestFacts,
  encounterBasicActionCheckLabel
} from './encounterMovementPassagePreparation.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { contestCheckCapabilityRegistry } from './platformEncounterPolicy.js'
import {
  isEncounterContestPendingContextCurrent,
  prepareEncounterContestPendingContext,
  type EncounterContestPendingContextInput
} from './encounterContestPendingContext.js'

type PreparedMechanics = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type ContestSceneContext = {
  sceneId: string
  sceneVersion: number
  sourceToken: { tokenId: string }
  targetToken: { tokenId: string }
} | null
type ContestCheck = { id: string; kind: 'SKILL' | 'ABILITY' }

/** The checks an authored check list names, skills first. */
const listedChecks = (checks: {
  skillIds: readonly string[]
  abilityDefinitionIds: readonly string[]
}) => [
  ...checks.skillIds.map((id): ContestCheck => ({ id, kind: 'SKILL' })),
  ...checks.abilityDefinitionIds.map((id): ContestCheck => ({ id, kind: 'ABILITY' }))
]

/**
 * Seals a two-roller contest from current facts (D152): the initiator's check, and each listed
 * defender check the defender has a total for, with its modifier, contributors and roll mode. A
 * paused contest must still match the facts it sealed.
 */
function sealEncounterContest(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  target: EncounterRunActorState
  sourceFacts: MovementTarget
  targetFacts: MovementTarget
  system: SystemAuthoredDto
  sceneContext: ContestSceneContext
  actionEconomy: EncounterActionEconomyConsumption | null
  priorContest: ServerContestCheckPendingApplicationContextDto | undefined
  origin: EncounterContestPendingContextInput['origin']
  actionId: string
  contestGraph: EncounterContestPendingContextInput['contestGraph']
  source: EncounterContestPendingContextInput['source']
  initiatorCheck: ContestCheck
  defenderChecks: readonly ContestCheck[]
}) {
  const { state, actor, target, system, sceneContext, targetFacts } = input
  const targets = new Map([
    [actor.id, input.sourceFacts],
    [target.id, targetFacts]
  ])
  const facts = (actorId: string, { id, kind }: ContestCheck) =>
    actorContestFacts({
      actorId,
      checkKind: kind,
      checkDefinitionId: id,
      gameSystemId: state.gameSystemId,
      system,
      targets
    })
  const initiator = facts(actor.id, input.initiatorCheck)
  if (initiator.modifier === null)
    throw new EncounterValidationError('This actor has no total for the check.')
  // The defender is offered only the listed checks it has a total for.
  const defenderChecks = input.defenderChecks.flatMap((listed) => {
    const check = facts(target.id, listed)
    return check.modifier === null
      ? []
      : [
          {
            checkDefinitionId: listed.id,
            label: encounterBasicActionCheckLabel(system, listed.id),
            ...freezeD20Context({
              gameSystemId: state.gameSystemId,
              rollMode: check.rollMode,
              contributors: check.contributors,
              modifier: check.modifier
            })
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
  const targetCharacter = targetFacts.characterFacts
  const targetCurrentness = targetFacts.characterCurrentness
  const { actionEconomy } = input
  const current: EncounterContestPendingContextInput = {
    origin: input.origin,
    actionId: input.actionId,
    sourceActorId: actor.id,
    targetActorId: target.id,
    initiatorControllerCharacterId: initiator.controllerCharacterId,
    sceneContext: sceneDependency,
    positionalDependencyChecksum: checksumRuleDocument(sceneDependency),
    contestGraph: input.contestGraph,
    source: input.source,
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
              stateChecksum: checksumRuleDocument({ streamVersion, state: targetFacts.state })
            }
          })()
        : { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: checksumRuleDocument(target) },
    initiator: {
      actorId: actor.id,
      requestNodeId: 'initiator_d20',
      ...freezeD20Context({
        gameSystemId: state.gameSystemId,
        rollMode: initiator.rollMode,
        contributors: initiator.contributors,
        modifier: initiator.modifier
      })
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
  const contest = prepareEncounterContestPendingContext(current)
  if (
    input.priorContest &&
    !isEncounterContestPendingContextCurrent({ pending: input.priorContest, current })
  )
    throw new EncounterValidationError('The pending contest facts changed.')
  return {
    contest,
    currentnessChecksum: checksumRuleDocument({ actor, target, sceneContext, contest })
  }
}

/**
 * Seals a basic action's contest (Grapple, Shove) from current facts: the initiator rolls the
 * action's own check, and the defender is offered each check the action's contest DC lists (D152).
 * A contest whose win runs an outcome (Shove, D105) tests by its contest graph. It rolls and writes
 * nothing.
 */
export function prepareEncounterBasicActionContest(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  target: EncounterRunActorState
  command: ResolveEncounterActionInputDto
  prepared: PreparedMechanics
  sceneContext: ContestSceneContext
  system: SystemAuthoredDto
  actionEconomy: EncounterActionEconomyConsumption | null
  priorContest?: ServerContestCheckPendingApplicationContextDto
}) {
  const { source, plan, sourceFacts, targetFacts } = input.prepared
  const published = plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  if (source.kind !== 'BASIC_ACTION')
    throw new EncounterValidationError('The selected action is not a basic action contest.')
  const { capability } = source
  const invocation = capability.compiledEffect.invocation
  if (invocation.triggerCode !== 'CHECK' || invocation.check.dc.kind !== 'CONTEST')
    throw new EncounterValidationError('The selected action makes no contested check.')
  const [initiatorCheck] = listedChecks(invocation.check.checks)
  if (!initiatorCheck) throw new EncounterValidationError('A contest action lists one check.')
  const sealed = sealEncounterContest({
    ...input,
    sourceFacts,
    targetFacts,
    priorContest: input.priorContest,
    origin: {
      kind: 'BASIC_ACTION',
      initiatorCheckDefinitionId: initiatorCheck.id,
      actionLabel: capability.label
    },
    actionId: input.command.actionId,
    contestGraph: {
      definitionId: published.id,
      checksum: published.checksum,
      identityChecksum: checksumRuleDocument({
        kind: 'BASIC_ACTION',
        definitionId: capability.definitionId,
        definitionChecksum: capability.definitionChecksum,
        compiledEffectChecksum: capability.compiledEffectChecksum,
        graphChecksum: published.checksum
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
    initiatorCheck,
    defenderChecks: listedChecks(invocation.check.dc.checks)
  })
  return { ...sealed, published }
}

/**
 * Seals a held creature's escape its holder contests (D152): the escaper rolls the allowed check it
 * chose, and the holder is offered each check the escape's contest lists. It rolls and writes
 * nothing.
 */
export function prepareEncounterEscapeContest(input: {
  state: EncounterRunState
  escaper: MovementTarget
  holder: MovementTarget
  activeEffectId: string
  checkDefinitionId: string
  system: SystemAuthoredDto
  actionEconomy: EncounterActionEconomyConsumption | null
  priorContest?: ServerContestCheckPendingApplicationContextDto
}) {
  const { escaper, holder } = input
  const effect = escaper.activeEffects.find((entry) => entry.id === input.activeEffectId)
  const escape = effect ? findEncounterHolderContestEscape(effect) : null
  if (!effect || !escape)
    throw new EncounterValidationError('The creature is not held by an effect its holder contests.')
  const initiatorCheck = listedChecks(escape.checks).find(
    ({ id }) => id === input.checkDefinitionId
  )
  if (!initiatorCheck) throw new EncounterValidationError('The escape does not allow that check.')
  const published = contestCheckCapabilityRegistry
    .require(input.state.gameSystemId)
    .contestGraph(escape.escapeSourceId)
  const definitionChecksum = checksumRuleDocument(effect.definition)
  const sealed = sealEncounterContest({
    state: input.state,
    actor: escaper.actor,
    target: holder.actor,
    sourceFacts: escaper,
    targetFacts: holder,
    system: input.system,
    sceneContext: null,
    actionEconomy: input.actionEconomy,
    priorContest: input.priorContest,
    origin: {
      kind: 'ESCAPE',
      activeEffectId: effect.id,
      initiatorCheckDefinitionId: initiatorCheck.id,
      actionLabel: ESCAPE_ACTION_LABEL
    },
    actionId: escape.escapeSourceId,
    contestGraph: {
      definitionId: published.id,
      checksum: published.checksum,
      identityChecksum: checksumRuleDocument({
        kind: 'ESCAPE',
        activeEffectId: effect.id,
        definitionChecksum,
        graphChecksum: published.checksum
      })
    },
    source: { kind: 'HELD_EFFECT', activeEffectId: effect.id, definitionChecksum },
    initiatorCheck,
    defenderChecks: listedChecks(escape.contestChecks)
  })
  return { ...sealed, published, escape }
}
