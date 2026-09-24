import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { prepareNativeCharacterActionState } from './character/characterNativeActionResources.js'
import {
  buildCompiledActionCompilerSource,
  buildCompiledActionTargetPolicy
} from './encounterActionEntryPointCompiler.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import { featureChargeUsed } from './encounterActorState.js'
import { featureActionMechanic } from './encounterFeatureActionCapabilityDiscovery.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import {
  mergeCanonicalD20Contributors,
  type EncounterRelationshipD20Contributor
} from './encounterRelationshipActionFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type {
  EncounterActionSourceInput,
  NativeEncounterActionSource
} from './encounterActionSources.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'

type CharacterActionMovementFacts = CharacterMovementFacts & {
  sheetState: Pick<CharacterSheetState, 'resourceUsage'>
}

/** Preserves the issued pending-action checksum across native and DO preparation. */
export function encounterActionCurrentnessChecksum(input: {
  prepared: Pick<
    Awaited<ReturnType<typeof prepareEncounterActionMechanics>>,
    | 'sourceFacts'
    | 'targetFacts'
    | 'binding'
    | 'source'
    | 'resourceUse'
    | 'featureResource'
    | 'featureUsed'
  >
  actionEconomy: EncounterActionEconomyConsumption | null
  maintenance: object | null
  sceneContext: object | null
}) {
  const { prepared, actionEconomy, maintenance, sceneContext } = input
  const { characterFacts: sourceCharacterFacts, ...sourceCurrentnessFacts } = prepared.sourceFacts
  const { characterFacts: targetCharacterFacts, ...targetCurrentnessFacts } = prepared.targetFacts
  return checksumRuleDocument({
    sourceFacts: sourceCharacterFacts === null ? prepared.sourceFacts : sourceCurrentnessFacts,
    targetFacts: targetCharacterFacts === null ? prepared.targetFacts : targetCurrentnessFacts,
    binding: prepared.binding,
    source: prepared.source,
    resourceUse: prepared.resourceUse,
    featureResource: prepared.featureResource,
    featureUsed: prepared.featureUsed,
    actionEconomy,
    ...(maintenance ? { maintenance } : {}),
    ...(sceneContext ? { sceneContext } : {})
  })
}

/** Prepares current source, target, and resource facts without persistence access. */
export async function prepareEncounterActionMechanics<
  TCharacterFacts extends CharacterActionMovementFacts
>(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  target: EncounterRunActorState
  actors: readonly EncounterRunActorState[]
  actionId: string
  movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  loadSource: (
    input: Omit<EncounterActionSourceInput, 'system'>
  ) => Promise<NativeEncounterActionSource>
  loadRelationshipFacts: (input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    sourceActorId: string
    targetActorId: string
    actionEffectId: string
    activeEffectsByActorId?: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  }) => Promise<readonly EncounterRelationshipD20Contributor[]>
}) {
  const { state, actor, target, actors, actionId } = input
  const currentTargets = input.movementTargets
  const sourceFacts = currentTargets.get(actor.id)
  const targetFacts = currentTargets.get(target.id)
  if (
    !sourceFacts ||
    !targetFacts ||
    checksumCanonicalJson(sourceFacts.actor) !== checksumCanonicalJson(actor) ||
    checksumCanonicalJson(targetFacts.actor) !== checksumCanonicalJson(target)
  )
    throw new Error('Encounter action facts are stale.')
  const characterAction = sourceFacts.characterReactionSource
  const candidate = characterAction?.mechanics.rulePolicyInput.actionCandidates.find(
    (value) => value.actionId === actionId
  )
  const entry = candidate
    ? characterAction?.mechanics.compiledActionEntryPoints.find(
        (
          value
        ): value is Extract<
          CompiledActionEntryPoint,
          { kind: 'CHARACTER_ACTION'; compilation: { kind: 'COMPILED' } }
        > =>
          value.actionId === candidate.actionId &&
          value.effectId === candidate.effectId &&
          value.kind === 'CHARACTER_ACTION' &&
          value.compilation.kind === 'COMPILED'
      )
    : undefined
  const source = await input.loadSource({
    actor,
    actionId,
    gameSystemId: state.gameSystemId,
    ...(characterAction && candidate && entry && sourceFacts.effectiveRulePolicyOutput
      ? {
          characterSource: {
            id: characterAction.id,
            streamVersion: characterAction.streamVersion,
            candidate,
            entry,
            effectivePolicyOutput: sourceFacts.effectiveRulePolicyOutput
          }
        }
      : {})
  })
  const adapter = characterRuleActionSystemAdapterRegistry.get(state.gameSystemId)
  if (!adapter) throw new Error('The Encounter Game System cannot execute this action.')
  const targetPolicy =
    source.kind === 'CHARACTER_ACTION'
      ? source.entry.targetPolicy
      : buildCompiledActionTargetPolicy(source.capability)
  if (!targetPolicy) throw new Error('The selected Character action target policy is stale.')
  const plan =
    source.kind === 'CHARACTER_ACTION'
      ? source.entry.schemaVersion === 4
        ? source.entry.compilation.executionPlan
        : { kind: 'SINGLE_GRAPH' as const, published: source.entry.compilation.published }
      : (() => {
          const compilerSource = buildCompiledActionCompilerSource(source.capability)
          return (
            adapter.compileExecutionPlan?.({ action: source.capability, compilerSource }) ?? {
              kind: 'SINGLE_GRAPH' as const,
              published: adapter.compile({ action: source.capability })
            }
          )
        })()
  const characterFacts = source.kind === 'CHARACTER_ACTION' ? sourceFacts.characterFacts : null
  const characterActionState =
    source.kind === 'CHARACTER_ACTION'
      ? (() => {
          if (
            !characterFacts ||
            characterFacts.active.streamVersion !== source.characterStreamVersion ||
            characterFacts.character.systemId !== state.gameSystemId
          )
            throw new Error('The selected Character action source is stale.')
          return prepareNativeCharacterActionState({
            entry: source.entry,
            candidate: source.candidate,
            policyOutput: source.effectivePolicyOutput,
            resourceUsage: characterFacts.sheetState.resourceUsage,
            characterId: source.characterId,
            expectedStreamVersion: source.characterStreamVersion,
            automationMode: state.automationMode
          })
        })()
      : null
  const facts = buildEncounterActorRuleFacts({ actors })
  const actorRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const resourceUse = source.kind === 'CREATURE' ? source.capability.featureResourceUse : null
  const sourceRules = actorRules.actors.find((entry) => entry.actorId === actor.id)
  const featureResource =
    source.kind === 'CREATURE' && resourceUse
      ? sourceRules?.featureResources.find(
          (entry) => entry.featureId === source.capability.ownerFeatureId
        )
      : null
  const featureUsed =
    source.kind === 'CREATURE' ? featureChargeUsed(actor, source.capability.ownerFeatureId) : 0
  if (
    resourceUse &&
    (!featureResource ||
      featureResource.maximum === null ||
      featureResource.remaining === null ||
      featureResource.used !== featureUsed ||
      featureResource.rawUsed !== featureUsed ||
      featureResource.remaining !== featureResource.maximum - featureResource.used ||
      featureResource.remaining < resourceUse.cost)
  )
    throw new Error('The selected Encounter feature action resource is unavailable.')
  const contributors = await input.loadRelationshipFacts({
    state,
    actors,
    sourceActorId: actor.id,
    targetActorId: target.id,
    activeEffectsByActorId: new Map(
      [...currentTargets].map(([id, value]) => [id, value.activeEffects])
    ),
    actionEffectId:
      source.kind === 'CHARACTER_ACTION' ? source.candidate.effectId : source.capability.effectId
  })
  return {
    state,
    actor,
    target,
    actors,
    sourceFacts,
    targetFacts,
    movementTargets: currentTargets,
    source,
    adapter,
    targetPolicy,
    plan,
    characterActionState,
    actorRules,
    resourceUse,
    featureResource,
    featureUsed,
    relationshipContributors: contributors,
    binding: {
      actionMechanic:
        source.kind === 'CHARACTER_ACTION'
          ? characterActionState!.actionMechanic
          : featureActionMechanic(source.capability),
      sourceDerivedFacts: {
        ...(source.kind === 'CHARACTER_ACTION'
          ? source.effectivePolicyOutput
          : sourceFacts.targetDerivedFacts),
        rollContributorEvidence: {
          attacks: {
            MELEE:
              source.kind === 'CHARACTER_ACTION'
                ? mergeCanonicalD20Contributors(
                    source.effectivePolicyOutput.rollContributorEvidence.attacks.MELEE,
                    contributors
                  )
                : contributors,
            RANGED:
              source.kind === 'CHARACTER_ACTION'
                ? mergeCanonicalD20Contributors(
                    source.effectivePolicyOutput.rollContributorEvidence.attacks.RANGED,
                    contributors
                  )
                : contributors
          }
        }
      },
      targetActorId: target.id,
      targetDerivedFacts: targetFacts.targetDerivedFacts,
      targetConditionIds: targetFacts.state.conditions,
      currentHitPoints: targetFacts.state.current,
      temporaryHitPoints: targetFacts.state.temporary,
      maximumHitPoints: targetFacts.effectiveMaximumHitPoints,
      targetScalarValues: targetFacts.effectiveScalarValues,
      defenses: targetFacts.defenses,
      conditionImmunityIds: targetFacts.conditionImmunityIds
    }
  }
}
