import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterActionEconomyConsumption } from './encounterActionEconomyConsumption.js'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CompiledActionEntryPoint } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { CharacterSheetState } from '@artificer-toolkit/schema/projections/characterSheetState'
import { prepareNativeCharacterActionState } from './character/characterNativeActionResources.js'
import {
  buildCompiledActionTargetPolicy,
  compileEncounterFeatureActionPlan
} from './encounterActionEntryPointCompiler.js'
import {
  creatureActiveGrantAttackContributors,
  creatureAttackAbility,
  withSourceSightSave
} from './encounterActiveGrants.js'
import type { EncounterPreparedAttackSight } from './encounterAttackBelief.js'
import { CastChoiceUnavailableError, StaleCharacterActionError } from './encounterErrors.js'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { pickedCastChoiceEffect } from './encounterCastChoice.js'
import {
  encounterAttackSightContributors,
  type EncounterAttackPerception,
  type EncounterPerceptionRoller
} from './encounterAttackPerception.js'
import { buildEncounterActorRuleFacts } from './encounterActorRuleFacts.js'
import {
  encounterConditionAttackContributors,
  encounterConditionHitIsCritical,
  encounterConditionMechanicsInSourceSight,
  encounterConditionSaveAutoFailAbilityIds,
  encounterConditionSources
} from './encounterConditionMechanics.js'
import { featureChargeUsed } from './encounterActorState.js'
import { featureActionMechanic } from './encounterFeatureActionCapabilityDiscovery.js'
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
import {
  effectReadsEnemyProximity,
  effectReadsTurnUses,
  spentTurnUses,
  type Dnd5eEnemyProximity
} from './systems/dnd5e/attackRestrictions.js'
import { dndSourceFromCompilerSource } from './systems/dnd5e/effectActionCompiler.js'
import { dnd5eAttackRollContributors } from './systems/dnd5e/characterRollModes.js'
import { dnd5eCharacterActionTarget } from './systems/dnd5e/modifierApplicability.js'
import { attackDomainCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type {
  EncounterActionSourceRequest,
  NativeEncounterActionSource
} from './encounterActionSources.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  evaluateEncounterCharacterActionWieldConflict,
  type EncounterWieldConflictAcceptance
} from './encounterWieldConflict.js'

type CharacterActionMovementFacts = CharacterMovementFacts & {
  sheetState: Pick<CharacterSheetState, 'resourceUsage' | 'itemUsage'>
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
  attackAction: EncounterAttackActionTransitionDto | null
  maintenance: object | null
  sceneContext: object | null
}) {
  const { prepared, actionEconomy, attackAction, maintenance, sceneContext } = input
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
    ...(attackAction ? { attackAction } : {}),
    ...(maintenance ? { maintenance } : {}),
    ...(sceneContext ? { sceneContext } : {})
  })
}

/** A capability source that runs `compiledEffect`: the option its actor picked (D148). */
function withCompiledEffect<Source extends { capability: { compiledEffect: CompiledEffectGroup } }>(
  source: Source,
  compiledEffect: CompiledEffectGroup
): Source {
  return { ...source, capability: { ...source.capability, compiledEffect } }
}

/**
 * The action the source actor takes: its source, the adapter and execution plan that run it, and the
 * target policy that decides what it may be aimed at. It reads nothing about any target, so an area
 * action learns its policy before it knows whom the area catches.
 */
export async function prepareEncounterActionSource<
  TCharacterFacts extends CharacterActionMovementFacts
>(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  actionId: string
  sourceFacts: MovementTarget<TCharacterFacts>
  loadSource: (input: EncounterActionSourceRequest) => Promise<NativeEncounterActionSource>
  /** The option the caster picked of an action that offers a pick at cast (D140, D148). */
  choiceOptionId?: string
  /**
   * A read of the action's test alone, before any pick: every option shares it (options that test
   * differently compile MANUAL), so the top-level option serves and no pick is asked for.
   */
  readsSharedTest?: boolean
}) {
  const { state, actor, actionId, sourceFacts } = input
  const characterAction = sourceFacts.characterReactionSource
  const spellCast = sourceFacts.characterSpellCast
  const candidate = [
    ...(characterAction?.mechanics.rulePolicyInput.actionCandidates ?? []),
    ...(spellCast?.candidates ?? [])
  ].find((value) => value.actionId === actionId)
  const entry = candidate
    ? [
        ...(characterAction?.mechanics.compiledActionEntryPoints ?? []),
        ...(spellCast?.compiledActionEntryPoints ?? [])
      ].find(
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
  // The one place a cast's pick swaps its option's plans in, before anything runs (D148). A zone
  // action places the zone its caster picked instead.
  const compilation = entry?.schemaVersion === 4 ? entry.compilation : null
  const picked = compilation?.choice?.options.find(
    ({ optionId }) => optionId === input.choiceOptionId
  )
  if (
    entry &&
    (compilation?.choice
      ? !picked && !input.readsSharedTest
      : input.choiceOptionId !== undefined && !compilation?.zonePlacement)
  )
    throw new CastChoiceUnavailableError()
  const castEntry =
    entry?.schemaVersion === 4 && picked
      ? {
          ...entry,
          compilation: {
            ...entry.compilation,
            activeEffectPlan: picked.activeEffectPlan,
            executionPlan: picked.executionPlan
          }
        }
      : entry
  const loaded = await input.loadSource({
    actor,
    actionId,
    gameSystemId: state.gameSystemId,
    ...(characterAction && candidate && castEntry && sourceFacts.effectiveRulePolicyOutput
      ? {
          characterSource: {
            id: characterAction.id,
            streamVersion: characterAction.streamVersion,
            candidate,
            entry: castEntry,
            // A cast is decided by the spell decisions, which the Sheet's own actions never carry.
            effectivePolicyOutput:
              candidate.mechanicsOwner.kind === 'SPELL' && spellCast
                ? {
                    ...sourceFacts.effectiveRulePolicyOutput,
                    actionDecisions: [
                      ...sourceFacts.effectiveRulePolicyOutput.actionDecisions,
                      ...spellCast.decisions
                    ]
                  }
                : sourceFacts.effectiveRulePolicyOutput
          }
        }
      : {})
  })
  // An authored capability (a basic action's Shove) runs as the option its actor picked (D148).
  const source =
    loaded.kind === 'CHARACTER_ACTION'
      ? loaded
      : withCompiledEffect(
          loaded,
          pickedCastChoiceEffect(
            loaded.capability.compiledEffect,
            input.choiceOptionId,
            input.readsSharedTest
          )
        )
  const adapter = characterRuleActionSystemAdapterRegistry.get(state.gameSystemId)
  if (!adapter) throw new Error('The Encounter Game System cannot execute this action.')
  const targetPolicy =
    source.kind === 'CHARACTER_ACTION'
      ? source.entry.targetPolicy
      : buildCompiledActionTargetPolicy(source.capability)
  if (!targetPolicy) throw new Error('The selected Character action target policy is stale.')
  const plan =
    source.kind === 'CHARACTER_ACTION'
      ? source.entry.compilation.executionPlan
      : compileEncounterFeatureActionPlan(adapter, source.capability)
  return { source, adapter, targetPolicy, plan }
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
  /** The option the caster picked at cast, as `prepareEncounterActionSource` takes it. */
  choiceOptionId?: string
  /** A read of the shared test before any pick, as `prepareEncounterActionSource` takes it. */
  readsSharedTest?: boolean
  wieldConflictAcceptance: EncounterWieldConflictAcceptance
  /** RESOLVE_ACTION reports overridable warnings; reactions, legendary actions and Disarm refuse them. */
  overridable: boolean
  movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  /** The locked Scene positions of a RESOLVE_ACTION, for range-derived roll modes. */
  sceneContext?: EncounterActionSceneContext | null
  /**
   * Whether each side of an attack sees the other (SRD unseen attacker/target), or whether a saver
   * sees the effect's source (`roller` TARGET, D100). Called only for an attack roll or a save with
   * a source-sight grant; omitted by flows that do not read perception, which leave sight out of
   * the roll.
   */
  loadAttackPerception?: (input: {
    sourceFacts: MovementTarget<TCharacterFacts>
    targetFacts: MovementTarget<TCharacterFacts>
    roller: EncounterPerceptionRoller
  }) => Promise<{ actual: EncounterAttackPerception; believed: EncounterAttackPerception }>
  /**
   * Which of a sourced, sight-gated condition's recorded sources its holder sees now (Frightened).
   * Called only when the source or the target has one; any Encounter actor can be a source, and
   * one no longer in the Encounter is unseen.
   */
  loadSourcesSeen?: (input: {
    holder: MovementTarget<TCharacterFacts>
    sourceActorIds: readonly string[]
  }) => Promise<ReadonlySet<string>>
  /**
   * How near an enemy stands to the target on the Scene, for an attack with a path that asks
   * (Sneak Attack's nearby enemy). Called only for such an attack; null when it has no Scene to
   * measure on, which leaves the check unanswerable.
   */
  loadEnemyProximity?: (input: {
    sourceFacts: MovementTarget<TCharacterFacts>
    targetFacts: MovementTarget<TCharacterFacts>
  }) => Promise<Dnd5eEnemyProximity | null>
  /**
   * The once-per-turn uses the attacker has spent this turn (sorted usage keys), for an attack with
   * a path limited that way (Sneak Attack). Called only for such an attack.
   */
  loadTurnUses?: () => Promise<readonly string[]>
  loadSource: (input: EncounterActionSourceRequest) => Promise<NativeEncounterActionSource>
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
  const currentSourceFacts = currentTargets.get(actor.id)
  const currentTargetFacts = currentTargets.get(target.id)
  if (
    !currentSourceFacts ||
    !currentTargetFacts ||
    checksumCanonicalJson(currentSourceFacts.actor) !== checksumCanonicalJson(actor) ||
    checksumCanonicalJson(currentTargetFacts.actor) !== checksumCanonicalJson(target)
  )
    throw new Error('Encounter action facts are stale.')
  // A sourced condition's sight-gated roll modes hold only while its holder sees a source
  // (Frightened, SPELLS-29); a flow that reads no perception keeps them always on.
  const inSourceSight = async (facts: MovementTarget<TCharacterFacts>) => {
    const sources = encounterConditionSources(facts)
    const gatedSourceIds = new Set(
      facts.conditionMechanics.flatMap(({ conditionDefinitionId, mechanic }) =>
        mechanic.kind === 'D20_ROLL_MODE' && mechanic.requiresHolderSeesSource
          ? (sources.get(conditionDefinitionId) ?? [])
          : []
      )
    )
    if (!gatedSourceIds.size || !input.loadSourcesSeen) return facts
    return {
      ...facts,
      conditionMechanics: encounterConditionMechanicsInSourceSight({
        mechanics: facts.conditionMechanics,
        sources,
        seenActorIds: await input.loadSourcesSeen({
          holder: facts,
          sourceActorIds: [...gatedSourceIds].sort()
        })
      })
    }
  }
  const [sourceFacts, targetFacts] = await Promise.all([
    inSourceSight(currentSourceFacts),
    inSourceSight(currentTargetFacts)
  ])
  const { source, adapter, targetPolicy, plan } = await prepareEncounterActionSource({
    state,
    actor,
    actionId,
    sourceFacts,
    loadSource: input.loadSource,
    choiceOptionId: input.choiceOptionId,
    readsSharedTest: input.readsSharedTest
  })
  const characterFacts = source.kind === 'CHARACTER_ACTION' ? sourceFacts.characterFacts : null
  const characterActionState =
    source.kind === 'CHARACTER_ACTION'
      ? (() => {
          if (
            !characterFacts ||
            characterFacts.active.play.streamVersion !== source.characterStreamVersion ||
            characterFacts.character.systemId !== state.gameSystemId
          )
            throw new StaleCharacterActionError('The selected Character action source is stale.')
          return prepareNativeCharacterActionState({
            entry: source.entry,
            candidate: source.candidate,
            policyOutput: source.effectivePolicyOutput,
            resourceUsage: characterFacts.sheetState.resourceUsage,
            inventory: characterFacts.character.state.equipment.inventory,
            itemUsage: characterFacts.sheetState.itemUsage,
            characterId: source.characterId,
            expectedStreamVersion: source.characterStreamVersion,
            classLevels: characterFacts.ruleEvaluation.facts.grantFoldFacts.base.classes,
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
  const shieldStow = wieldConflict?.kind === 'STOW_SHIELD' ? wieldConflict : null
  const accepted = acceptance.kind === 'PROMPTED' ? acceptance.accepted : null
  // A Character's basic action may stow a held weapon for free; the room's basic-action admission
  // checks it against the holder's hands (`encounterBasicActionAdmission`, D152).
  const heldWeaponStow =
    accepted?.kind === 'STOW_HELD_WEAPON' &&
    source.kind === 'BASIC_ACTION' &&
    input.actor.kind === 'CHARACTER'
      ? accepted
      : null
  if (
    !heldWeaponStow &&
    (shieldStow
      ? accepted?.kind !== 'STOW_SHIELD' ||
        accepted.shieldItemInstanceId !== shieldStow.shieldItemInstanceId
      : accepted !== null)
  )
    throw new Error(
      shieldStow
        ? 'This attack would stow a shield; confirm it first.'
        : 'This attack does not stow a shield.'
    )
  const acceptedWieldConflict = heldWeaponStow ?? shieldStow
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
  // A target's active ATTACKS_AGAINST grants (Dodge, applied to its facts) give attacks against it
  // their advantage or disadvantage, those that require the holder to see the attacker only when it
  // can, and so does a target beyond a ranged attack's normal range (D62). The attacker's and the
  // target's condition mechanics add their own contributors (D94), and so does sight: an unseen
  // attacker has advantage, an unseen target disadvantage.
  const attackDomain = isDnd5eSpellAttackKind(attackKind) ? 'SPELL' : attackKind
  const attacksAgainst = targetFacts.attackAgainstContributors.filter(
    (entry) => entry.attackDomain === attackDomain
  )
  const longRange = encounterActionLongRangeContributor({
    targetPolicy,
    sceneContext: input.sceneContext ?? null
  })
  const dndSource =
    plan.kind === 'TEST_OUTCOME' ? dndSourceFromCompilerSource(plan.compilerSource) : null
  const compiledEffect = dndSource?.compiledEffect ?? null
  // A target's grants that hold only while it sees the effect's source (Danger Sense) decide a save
  // by sight, as an attack's unseen attacker does; a save riding on an attack keeps its rows.
  const sourceSightSaves =
    attackKind === null && dndSource?.savingThrowAbilityDefinitionId
      ? targetFacts.sourceSightSaves.filter(
          ({ abilityDefinitionId }) =>
            abilityDefinitionId === dndSource.savingThrowAbilityDefinitionId
        )
      : []
  const perception =
    (attackKind !== null || sourceSightSaves.length > 0) && input.loadAttackPerception
      ? await input.loadAttackPerception({
          sourceFacts,
          targetFacts,
          roller: attackKind === null ? 'TARGET' : 'ATTACKER'
        })
      : null
  const enemyProximity =
    attackKind !== null &&
    input.loadEnemyProximity &&
    compiledEffect &&
    effectReadsEnemyProximity(compiledEffect)
      ? await input.loadEnemyProximity({ sourceFacts, targetFacts })
      : null
  const turnUses =
    attackKind !== null &&
    input.loadTurnUses &&
    compiledEffect &&
    effectReadsTurnUses(compiledEffect)
      ? await input.loadTurnUses()
      : null
  const sightContributors = (seen: EncounterAttackPerception) =>
    attackKind === null
      ? seen.targetSeesAttacker === 'SEES'
        ? sourceSightSaves.map(({ contributor }) => contributor)
        : []
      : encounterAttackSightContributors({ perception: seen, attacksAgainst })
  const attackSight: EncounterPreparedAttackSight | null = perception && {
    ...perception,
    subject: attackKind === null ? 'SAVE' : 'ATTACK',
    trueSight: sightContributors(perception.actual),
    believedSight: sightContributors(perception.believed),
    attackerLabel: actor.label,
    targetLabel: target.label
  }
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
    attackSight && attackKind !== null
      ? attackSight.trueSight
      : attacksAgainst.map(({ contributor }) => contributor),
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
    makesAttackRoll: attackKind !== null,
    attackSight,
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
        ...(enemyProximity ? { attackEnemyProximity: enemyProximity } : {}),
        ...(turnUses ? { attackTurnUses: turnUses } : {}),
        // A Character attack uses the same scoped roll-mode contributors as its Sheet action.
        rollContributorEvidence: {
          attacks: Object.fromEntries(
            attackDomainCodeSchema.options.map((attackKind) => [
              attackKind,
              source.kind === 'CHARACTER_ACTION'
                ? mergeCanonicalD20Contributors(
                    dnd5eAttackRollContributors(source.effectivePolicyOutput, attackKind, {
                      ...dnd5eCharacterActionTarget(source.candidate),
                      attackAbility: characterActionState?.actionMechanic.attackAbility ?? null
                    }),
                    contributors
                  )
                : mergeCanonicalD20Contributors(
                    creatureActiveGrantAttackContributors(
                      actor.id,
                      attackKind,
                      creatureAttackAbility(source.capability.mechanicFacts.outcomes),
                      sourceFacts.activeEffects
                    ),
                    contributors
                  )
            ])
          )
        }
      },
      sourceHitPoints: {
        current: sourceFacts.state.current,
        maximum: sourceFacts.effectiveMaximumHitPoints
      },
      targetActorId: target.id,
      targetDerivedFacts:
        attackSight && attackKind === null && dndSource?.savingThrowAbilityDefinitionId
          ? withSourceSightSave(
              targetFacts.targetDerivedFacts,
              dndSource.savingThrowAbilityDefinitionId,
              attackSight.trueSight
            )
          : targetFacts.targetDerivedFacts,
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
        attackTraits,
        source.kind === 'CHARACTER_ACTION' ? source.candidate.mechanicsOwner.id : null
      ),
      conditionImmunityIds: targetFacts.conditionImmunityIds
    }
  }
}

/**
 * The once-per-turn uses an executed attack spent: those of its entries whose damage the final
 * phase dealt, which its evidence binds by entry (D119). A miss or an unmet gate binds none.
 */
export function encounterActionSpentTurnUses(
  prepared: { plan: Awaited<ReturnType<typeof prepareEncounterActionSource>>['plan'] },
  evidence: { sourceEntryBindings?: readonly { sourceEntryId: string }[] }
): string[] {
  const { plan } = prepared
  return plan.kind === 'TEST_OUTCOME'
    ? spentTurnUses(
        dndSourceFromCompilerSource(plan.compilerSource).compiledEffect,
        new Set((evidence.sourceEntryBindings ?? []).map((binding) => binding.sourceEntryId))
      )
    : []
}
