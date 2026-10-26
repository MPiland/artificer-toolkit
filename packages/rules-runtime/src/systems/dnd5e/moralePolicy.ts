import {
  MORALE_TRIGGER_SCOPE,
  type EncounterMoraleOfferDto
} from '@artificer-toolkit/schema/shared/encounterMorale'
import type {
  MoraleDispositionDto,
  MoraleTriggerKindDto
} from '@artificer-toolkit/schema/shared/optionalCombat'

import type {
  MoraleActorFacts,
  MoraleOfferInput,
  MoralePreparationInput,
  MoraleSaveProposal,
  OptionalCombatPolicyInput,
  OptionalCombatResolution
} from '../../optionalCombatPolicyCapability.js'
import {
  exactOptionalCombatDefinition,
  optionalCombatContributor,
  optionalCombatPolicyPin,
  type OptionalCombatPolicyDefinition
} from './optionalCombatDefinition.js'
import { DND5E_MORALE_POLICY_MODULE } from './policyModuleRegistration.js'

type MoraleParameters = Extract<
  OptionalCombatPolicyDefinition['document']['parameters'],
  { kind: 'MORALE' }
>

function moraleDefinition(input: OptionalCombatPolicyInput) {
  const definition = exactOptionalCombatDefinition({
    ...input,
    kind: 'MORALE',
    module: DND5E_MORALE_POLICY_MODULE
  })
  const parameters = definition?.document.parameters
  return definition && parameters?.kind === 'MORALE' ? { definition, parameters } : null
}

/** Characters never check morale: players drive their own Characters. */
function sideMembers(actors: readonly MoraleActorFacts[], sideId: string) {
  return actors.filter((actor) => actor.sideId === sideId && actor.kind !== 'CHARACTER')
}

/**
 * Whether the Run's state holds a trigger now: hit points, removed side members and a leader named
 * on an earlier group check. Triggers the Run holds no facts for are the GM's to declare.
 */
function triggerOrigin(
  triggerKind: MoraleTriggerKindDto,
  subject: MoraleActorFacts,
  actors: readonly MoraleActorFacts[]
): EncounterMoraleOfferDto['origin'] | null {
  switch (triggerKind) {
    case 'INDIVIDUAL_REDUCED_TO_HALF':
      return subject.maxHitPoints > 0 && subject.currentHitPoints * 2 <= subject.maxHitPoints
        ? 'RUN_STATE'
        : null
    case 'GROUP_HALF_REMOVED': {
      const members = sideMembers(actors, subject.sideId)
      return members.filter((member) => member.removed).length * 2 >= members.length
        ? 'RUN_STATE'
        : null
    }
    case 'GROUP_LEADER_REMOVED': {
      const leaderActorId = subject.morale?.groupLeaderActorId ?? null
      if (leaderActorId === null) return 'GM_DECLARED'
      const leader = actors.find((actor) => actor.actorId === leaderActorId)
      return leader === undefined || leader.removed ? 'RUN_STATE' : null
    }
    default:
      return 'GM_DECLARED'
  }
}

/** A trigger already checked for an actor is not offered again. */
function actorOffers(
  parameters: MoraleParameters,
  subject: MoraleActorFacts,
  actors: readonly MoraleActorFacts[]
): readonly EncounterMoraleOfferDto[] {
  if (subject.kind === 'CHARACTER' || subject.removed) return []
  const fired = new Set(subject.morale?.firedTriggerKinds ?? [])
  return parameters.triggerKinds.flatMap((triggerKind) => {
    if (fired.has(triggerKind)) return []
    const origin = triggerOrigin(triggerKind, subject, actors)
    return origin === null ? [] : [{ triggerKind, origin }]
  })
}

export function offerDnd5eMoraleTriggers(
  input: MoraleOfferInput
): ReadonlyMap<string, readonly EncounterMoraleOfferDto[]> {
  const morale = moraleDefinition(input)
  if (!morale) return new Map()
  return new Map(
    input.actors.flatMap((subject) => {
      const offers = actorOffers(morale.parameters, subject, input.actors)
      return offers.length === 0 ? [] : [[subject.actorId, offers] as const]
    })
  )
}

/** The disposition the authored outcome of this kind sets. */
function outcomeDisposition(
  outcomes: MoraleParameters['individualOutcomes'],
  kind: MoraleDispositionDto
): MoraleDispositionDto | null {
  const operation = outcomes
    .find((outcome) => outcome.kind === kind)
    ?.operations.find((candidate) => candidate.primitive === 'SET_MORALE_DISPOSITION')
  return operation?.primitive === 'SET_MORALE_DISPOSITION' ? operation.disposition : null
}

/**
 * The group's named leader rolls when present and able to act; without one, the member with the
 * best save for the authored ability does, ties to the lower actor id.
 */
function groupRoller(
  input: MoralePreparationInput,
  memberActorIds: readonly string[],
  abilityDefinitionId: string
): string | null {
  const modifier = (actorId: string) => {
    const roller = input.rollers.get(actorId)
    return roller?.canAct ? (roller.saveModifiers.get(abilityDefinitionId) ?? null) : null
  }
  if (input.leaderActorId !== null)
    return memberActorIds.includes(input.leaderActorId) && modifier(input.leaderActorId) !== null
      ? input.leaderActorId
      : null
  let best: { actorId: string; modifier: number } | null = null
  for (const actorId of memberActorIds) {
    const value = modifier(actorId)
    if (value !== null && (best === null || value > best.modifier))
      best = { actorId, modifier: value }
  }
  return best?.actorId ?? null
}

/** Seals one morale save for the active Morale definition before the roller rolls. */
export function prepareDnd5eMoraleSave(
  input: MoralePreparationInput
): OptionalCombatResolution<MoraleSaveProposal> {
  const morale = moraleDefinition(input)
  if (!morale) return { kind: 'INERT' }
  const { definition, parameters } = morale
  const subject = input.actors.find((actor) => actor.actorId === input.subjectActorId)
  if (
    subject === undefined ||
    !actorOffers(parameters, subject, input.actors).some(
      (offer) => offer.triggerKind === input.triggerKind
    )
  )
    return { kind: 'NOT_APPLICABLE' }
  const scope = MORALE_TRIGGER_SCOPE[input.triggerKind]
  const abilityDefinitionId = parameters.savingThrowAbilityDefinitionId
  const memberActorIds =
    scope === 'GROUP'
      ? sideMembers(input.actors, subject.sideId)
          .filter((member) => !member.removed)
          .map((member) => member.actorId)
          .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
      : [subject.actorId]
  if (scope === 'SUBJECT' && input.leaderActorId !== null)
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_LEADER_FOR_INDIVIDUAL_TRIGGER' }
  const rollerActorId =
    scope === 'GROUP'
      ? groupRoller(input, memberActorIds, abilityDefinitionId)
      : input.rollers.get(subject.actorId)?.saveModifiers.has(abilityDefinitionId)
        ? subject.actorId
        : null
  if (rollerActorId === null)
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_ROLLER_UNAVAILABLE' }
  const outcomes = scope === 'GROUP' ? parameters.groupOutcomes : parameters.individualOutcomes
  const successDisposition = outcomeDisposition(outcomes, 'CONTINUE')
  const failureDisposition = outcomeDisposition(
    outcomes,
    input.escapePossible ? 'FLEE' : 'SURRENDER'
  )
  if (successDisposition === null || failureDisposition === null)
    return { kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_OUTCOME_UNRESOLVED' }
  const opposition = input.overwhelmingOpposition ? parameters.overwhelmingOpposition : null
  return {
    kind: 'PROPOSED',
    proposal: {
      pin: optionalCombatPolicyPin(definition),
      triggerKind: input.triggerKind,
      scope,
      rollerActorId,
      groupLeaderActorId:
        scope === 'GROUP' ? input.leaderActorId : (subject.morale?.groupLeaderActorId ?? null),
      memberActorIds,
      abilityDefinitionId,
      difficultyClass: parameters.savingThrowDifficultyClass,
      contributors:
        opposition?.rollMode === 'DISADVANTAGE' && !opposition.automaticFailure
          ? [
              optionalCombatContributor({
                definition,
                influence: 'DISADVANTAGE',
                reason: 'OVERWHELMING_OPPOSITION'
              })
            ]
          : [],
      automaticFailure: opposition?.automaticFailure ?? false,
      successDisposition,
      failureDisposition
    }
  }
}
