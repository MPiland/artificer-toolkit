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
import {
  encounterConditionAttackContributors,
  encounterConditionHitIsCritical,
  encounterConditionSaveAutoFailAbilityIds
} from './encounterConditionMechanics.js'
import { featureChargeUsed } from './encounterActorState.js'
import {
  featureActionMechanic,
  type EncounterFeatureActionCapabilityDescriptor
} from './encounterFeatureActionCapabilityDiscovery.js'
import type {
  CharacterRuleActionExecutionPlan,
  CharacterRuleActionSystemAdapter
} from './characterRuleActionSystemAdapter.js'
import { characterRuleActionSystemAdapterRegistry } from './characterRuleActionSystemAdapterRegistry.js'
import {
  mergeCanonicalD20Contributors,
  type EncounterRelationshipD20Contributor
} from './encounterRelationshipActionFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import {
  encounterActionLongRangeContributor,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import {
  dnd5eAttackDamageDefenses,
  dnd5eCharacterAttackTraits
} from './systems/dnd5e/attackDamageDefenses.js'
import { isDnd5eSpellAttackKind } from './systems/dnd5e/attackKind.js'
import { dnd5eAttackRollContributors } from './systems/dnd5e/characterRollModes.js'
import { dnd5eCharacterActionTarget } from './systems/dnd5e/modifierApplicability.js'
import { attackDomainCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type {
  EncounterActionSourceInput,
  NativeEncounterActionSource
} from './encounterActionSources.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  evaluateEncounterCharacterActionWieldConflict,
  type EncounterWieldConflictAcceptance
} from './encounterWieldConflict.js'

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

/** The execution plan a Creature's feature action runs; Legendary discovery pins the same plan. */
export function compileEncounterFeatureActionPlan(
  adapter: CharacterRuleActionSystemAdapter,
  capability: EncounterFeatureActionCapabilityDescriptor
): CharacterRuleActionExecutionPlan {
  return (
    adapter.compileExecutionPlan?.({
      action: capability,
      compilerSource: buildCompiledActionCompilerSource(capability)
    }) ?? { kind: 'SINGLE_GRAPH', published: adapter.compile({ action: capability }) }
  )
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
  wieldConflictAcceptance: EncounterWieldConflictAcceptance
  /** RESOLVE_ACTION reports overridable warnings; reactions, legendary actions and Disarm refuse them. */
  overridable: boolean
  movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  /** The locked Scene positions of a RESOLVE_ACTION, for range-derived roll modes. */
  sceneContext?: EncounterActionSceneContext | null
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
      : compileEncounterFeatureActionPlan(adapter, source.capability)
  const characterFacts = source.kind === 'CHARACTER_ACTION' ? sourceFacts.characterFacts : null
  const characterActionState =
    source.kind === 'CHARACTER_ACTION'
      ? (() => {
          if (
            !characterFacts ||
            characterFacts.active.play.streamVersion !== source.characterStreamVersion ||
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
            automationMode: state.automationMode,
            overridable: input.overridable
          })
        })()
      : null
  const acceptance = input.wieldConflictAcceptance
  const wieldConflict =
    source.kind === 'CHARACTER_ACTION' && characterFacts && acceptance.kind === 'PROMPTED'
      ? evaluateEncounterCharacterActionWieldConflict({
          candidate: source.candidate,
          ruleFacts: characterFacts.ruleEvaluation.facts,
          policyOutput: source.effectivePolicyOutput
        })
      : null
  const acceptedWieldConflict = wieldConflict?.kind === 'STOW_SHIELD' ? wieldConflict : null
  const accepted = acceptance.kind === 'PROMPTED' ? acceptance.accepted : null
  if (
    acceptedWieldConflict
      ? accepted?.shieldItemInstanceId !== acceptedWieldConflict.shieldItemInstanceId
      : accepted !== null
  )
    throw new Error(
      acceptedWieldConflict
        ? 'This attack would stow a shield; confirm it first.'
        : 'This attack does not stow a shield.'
    )
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
      (!input.overridable && featureResource.remaining < resourceUse.cost))
  )
    throw new Error('The selected Encounter feature action resource is unavailable.')
  // "Do it anyway" spends only the charges that remain; the warning records the shortfall.
  const featureSpent = resourceUse
    ? Math.min(resourceUse.cost, Math.max(0, featureResource?.remaining ?? 0))
    : 0
  const ruleWarnings = [
    ...(characterActionState?.ruleWarnings ?? []),
    ...(resourceUse && featureSpent < resourceUse.cost
      ? [
          {
            code: 'RESOURCE_UNAVAILABLE' as const,
            message: `Not enough charges left: needs ${resourceUse.cost}, has ${featureSpent}.`
          }
        ]
      : [])
  ]
  const actionMechanic =
    source.kind === 'CHARACTER_ACTION'
      ? characterActionState!.actionMechanic
      : featureActionMechanic(source.capability)
  const attackKind =
    typeof actionMechanic.attackKind === 'string' ? actionMechanic.attackKind : null
  // Only attack damage meets "from nonmagical attacks" defenses; Creature weapons are nonmagical.
  const attackTraits =
    attackKind === null
      ? null
      : source.kind === 'CHARACTER_ACTION'
        ? dnd5eCharacterAttackTraits({
            candidate: source.candidate,
            attackKind,
            itemMechanics: source.effectivePolicyOutput.itemMechanics
          })
        : { magical: isDnd5eSpellAttackKind(attackKind), silvered: false, adamantine: false }
  // A Dodging target (basic action, Q11, applied to its facts) gives attacks against it
  // disadvantage, and so does a target beyond a ranged attack's normal range (D62). The attacker's
  // and the target's condition mechanics add their own contributors (D94).
  const longRange = encounterActionLongRangeContributor({
    targetPolicy,
    sceneContext: input.sceneContext ?? null
  })
  const conditionAttack = {
    melee: attackKind === 'MELEE' || attackKind === 'UNARMED' || attackKind === 'MELEE_SPELL',
    sceneContext: input.sceneContext ?? null
  }
  const contributors = mergeCanonicalD20Contributors(
    await input.loadRelationshipFacts({
      state,
      actors,
      sourceActorId: actor.id,
      targetActorId: target.id,
      activeEffectsByActorId: new Map(
        [...currentTargets].map(([id, value]) => [id, value.activeEffects])
      ),
      actionEffectId:
        source.kind === 'CHARACTER_ACTION' ? source.candidate.effectId : source.capability.effectId
    }),
    targetFacts.basicActionAttackContributors,
    longRange ? [longRange] : [],
    attackKind === null
      ? []
      : encounterConditionAttackContributors({
          attackerActorId: actor.id,
          attacker: sourceFacts.conditionMechanics,
          targetActorId: target.id,
          target: targetFacts.conditionMechanics,
          attack: conditionAttack
        })
  )
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
    acceptedWieldConflict,
    actorRules,
    resourceUse,
    featureResource,
    featureUsed,
    featureSpent,
    ruleWarnings,
    relationshipContributors: contributors,
    binding: {
      actionMechanic,
      sourceDerivedFacts: {
        ...(source.kind === 'CHARACTER_ACTION'
          ? source.effectivePolicyOutput
          : sourceFacts.targetDerivedFacts),
        // A Character attack uses the same scoped roll-mode contributors as its Sheet action.
        rollContributorEvidence: {
          attacks: Object.fromEntries(
            attackDomainCodeSchema.options.map((attackKind) => [
              attackKind,
              source.kind === 'CHARACTER_ACTION'
                ? mergeCanonicalD20Contributors(
                    dnd5eAttackRollContributors(
                      source.effectivePolicyOutput,
                      attackKind,
                      dnd5eCharacterActionTarget(source.candidate)
                    ),
                    contributors
                  )
                : contributors
            ])
          )
        }
      },
      sourceHitPoints: {
        current: sourceFacts.state.current,
        maximum: sourceFacts.effectiveMaximumHitPoints
      },
      targetActorId: target.id,
      targetDerivedFacts: targetFacts.targetDerivedFacts,
      targetConditionIds: targetFacts.state.conditions,
      conditionOutcomeRules: {
        hitIsCritical:
          attackKind !== null &&
          encounterConditionHitIsCritical({
            target: targetFacts.conditionMechanics,
            attack: conditionAttack
          }),
        saveAutoFailAbilityIds: encounterConditionSaveAutoFailAbilityIds(
          targetFacts.conditionMechanics
        )
      },
      currentHitPoints: targetFacts.state.current,
      temporaryHitPoints: targetFacts.state.temporary,
      maximumHitPoints: targetFacts.effectiveMaximumHitPoints,
      targetScalarValues: targetFacts.effectiveScalarValues,
      defenses: dnd5eAttackDamageDefenses(
        targetFacts.defenses,
        targetFacts.qualifiedDefenses,
        attackTraits
      ),
      conditionImmunityIds: targetFacts.conditionImmunityIds
    }
  }
}
