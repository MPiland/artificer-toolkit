import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import { encounterRuleUsageUsed } from './encounterActorState.js'
import { revalidateEncounterMovementReactionOption } from './encounterMovementReactionDiscovery.js'
import type { PreparedEncounterMovementReactionAction } from './encounterMovementReactionActionExecution.js'
import type { buildEncounterMovementReactionFacts } from './encounterMovementReactionFacts.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import type { EncounterWieldConflictAcceptance } from './encounterWieldConflict.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type PreparedMechanics<TCharacterFacts extends ProjectableCharacterFacts> = Awaited<
  ReturnType<typeof prepareEncounterActionMechanics<TCharacterFacts>>
>

type RevalidateInput = Pick<
  Parameters<typeof revalidateEncounterMovementReactionOption>[0],
  'movementKind' | 'occurrenceId' | 'option' | 'actorIdByTokenId' | 'tokens' | 'resolvePerception'
>

/** Movement reactions only permit one non-self target; source currentness is revalidated separately. */
function requireReactionTargetPolicy(input: {
  sourceActorId: string
  targetActorId: string
  prepared: Pick<PreparedMechanics<ProjectableCharacterFacts>, 'targetPolicy'>
}) {
  const { targetPolicy } = input.prepared
  if (
    targetPolicy.shape !== null ||
    targetPolicy.pathOverrides.length !== 0 ||
    !targetPolicy.targeting ||
    targetPolicy.targeting.selectionKind !== 'SINGLE_TARGET' ||
    targetPolicy.targeting.dispositionKind === 'WILLING' ||
    (targetPolicy.targeting.excludedCreatureTypeIds?.length ?? 0) !== 0 ||
    input.sourceActorId === input.targetActorId
  )
    throw new Error('The selected reaction action cannot target the moving actor.')
}

/** Revalidates one issued movement reaction and binds it to current mechanics facts. */
export async function prepareEncounterMovementReactionAction<
  TCharacterFacts extends ProjectableCharacterFacts,
  TPrepared extends PreparedMechanics<TCharacterFacts>,
  TProjection,
  TMaintenance
>(input: {
  facts: ReturnType<typeof buildEncounterMovementReactionFacts<TCharacterFacts>> & {
    runtime: RulesRuntimeService
  }
  revalidate: RevalidateInput
  maintenanceProjection?: TProjection
  prepareMechanics: (input: {
    state: EncounterRunState
    actor: EncounterRunActorState
    target: EncounterRunActorState
    actors: readonly EncounterRunActorState[]
    actionId: string
    campaignOwnerUserId: string
    wieldConflictAcceptance: EncounterWieldConflictAcceptance
    movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  }) => Promise<TPrepared>
  prepareMaintenance: (
    prepared: TPrepared,
    userId: string,
    projection?: TProjection
  ) => Promise<TMaintenance>
}) {
  const { facts, revalidate } = input
  const revalidated = await revalidateEncounterMovementReactionOption({
    ...revalidate,
    ...facts
  })
  const { userId, state, campaignOwnerUserId } = facts
  const actors = facts.encounter.actors
  const actor = actors.find((entry) => entry.id === revalidated.action.actorId)
  const target = actors.find((entry) => entry.id === revalidate.option.candidate.movingActorId)
  if (!actor || !target) throw new Error('The movement reaction actors are stale.')
  const prepared = await input.prepareMechanics({
    state,
    actor,
    target,
    actors,
    actionId: revalidate.option.actionId,
    campaignOwnerUserId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    movementTargets: facts.targets
  })
  if (
    (revalidated.action.kind === 'CHARACTER_ACTION' &&
      (prepared.source.kind !== 'CHARACTER_ACTION' ||
        prepared.source.characterId !== revalidated.action.characterId ||
        prepared.source.characterStreamVersion !== revalidated.action.characterStreamVersion ||
        prepared.source.candidate.actionId !== revalidated.action.candidate.actionId ||
        prepared.source.entry.effectId !== revalidated.action.entry.effectId)) ||
    (revalidated.action.kind === 'ENCOUNTER_FEATURE' &&
      (prepared.source.kind !== 'CREATURE' ||
        prepared.source.capability.actionId !== revalidated.action.capability.actionId ||
        prepared.source.capability.ownerFeatureId !== revalidated.action.capability.ownerFeatureId))
  )
    throw new Error('The selected movement reaction source is stale.')
  requireReactionTargetPolicy({
    sourceActorId: actor.id,
    targetActorId: target.id,
    prepared
  })
  const initialPublished =
    prepared.plan.kind === 'SINGLE_GRAPH' ? prepared.plan.published : prepared.plan.test.published
  const maintenance = await input.prepareMaintenance(prepared, userId, input.maintenanceProjection)
  const beforeUsed = encounterRuleUsageUsed(actor, revalidate.option.policy.allowanceDefinitionId)
  if (beforeUsed >= revalidate.option.policy.allowanceMaximum)
    throw new Error('The selected movement reaction allowance is no longer available.')
  const action: PreparedEncounterMovementReactionAction = {
    adapter: prepared.adapter,
    published: initialPublished,
    actionMechanic: prepared.binding.actionMechanic,
    movementInterruption: revalidate.option.binding.movementInterruption,
    sourceDerivedFacts: prepared.binding.sourceDerivedFacts,
    target: {
      actorId: target.id,
      currentHitPoints: prepared.binding.currentHitPoints,
      temporaryHitPoints: prepared.binding.temporaryHitPoints,
      maximumHitPoints: prepared.binding.maximumHitPoints,
      scalarValues: prepared.binding.targetScalarValues,
      conditionIds: prepared.binding.targetConditionIds,
      derivedFacts: prepared.binding.targetDerivedFacts,
      defenses: prepared.binding.defenses,
      conditionImmunityIds: prepared.binding.conditionImmunityIds
    }
  }
  return {
    option: revalidate.option,
    prepared,
    maintenance,
    maintenanceProjection: input.maintenanceProjection,
    executionPlan: prepared.plan,
    action,
    allowance: {
      definitionId: revalidate.option.policy.allowanceDefinitionId,
      maximum: revalidate.option.policy.allowanceMaximum,
      beforeUsed,
      afterUsed: beforeUsed + 1
    }
  }
}
