import { heldConditionIds } from './encounterInnateConditions.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { AttackOccasionCode } from '@artificer-toolkit/shared/core'
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
  activeEffectSourceAttackContributors,
  creatureActiveGrantAttackContributors,
  creatureFeatureAttackContributors,
  featureModifiersReadEnemyProximity,
  featureModifiersReadHolderLight,
  featureModifiersReadTargetTurn,
  creatureAttackAbility,
  encounterAttackAddedDice,
  conditionImmunityIdsAgainstSource,
  type EncounterHolderLight,
  type GrantSource,
  sourceQualifierAdmits,
  withSourceSaves,
  withSourceSightSave
} from './encounterActiveGrants.js'
import { type EncounterAttackDecoy, withAttackDecoyArmorClass } from './encounterAttackDecoys.js'
import type { EncounterPreparedAttackSight } from './encounterAttackBelief.js'
import {
  CastChoiceUnavailableError,
  EncounterValidationError,
  HandReleaseRequiredError,
  StaleCharacterActionError,
  UnavailableCreatureActionError
} from './encounterErrors.js'
import { encounterActorHeldItems } from './encounterHolderDefense.js'
import { preparedCastsSpell } from './encounterPreparedSpellCast.js'
import { refuseUnmetTargetRequirements } from './encounterTargetRequirements.js'
import {
  characterActionDrawWeapon,
  creatureActionDrawWeapon,
  evaluateEncounterWeaponDraw
} from './encounterWeaponDraw.js'
import { snapshotCreatureEquipmentItems } from './encounterCreatureEquipmentSources.js'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import { offeredCastChoiceOptions, pickedCastChoiceEffect } from './encounterCastChoice.js'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  attackAgainstHolds,
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
import { featureChargeUsed, snapshotCreatureTypeId } from './encounterActorState.js'
import { featureActionMechanic } from './encounterFeatureActionCapabilityDiscovery.js'
import { isInEffectEventScope } from './events/encounterEventHooks.js'
import {
  encounterHeldActorIds,
  mergeCanonicalD20Contributors,
  type EncounterRelationshipD20Contributor
} from './encounterRelationshipActionFacts.js'
import { reconcileEncounterActorRuleOutput } from './encounterActorRuleOutput.js'
import {
  encounterActionLongRangeContributor,
  type EncounterActionSceneContext
} from './encounterActionTargetPolicy.js'
import { encounterFacingRule } from './encounterFacing.js'
import { activeAttackCriticalRules, activeDamageDice } from './character/activeEffectGrantTotals.js'
import { attackDomainCodeSchema, attackKindSchema } from '@artificer-toolkit/schema/shared/enums'
import { evaluateInstalledEncounterActors } from './platformRulesRuntime.js'
import {
  attackProfileCapabilityRegistry,
  characterRuleActionSystemAdapterRegistry,
  optionalCombatPolicyCapabilityRegistry
} from './platformEncounterPolicy.js'
import type { CharacterAttack } from './attackProfileCapability.js'
import type { EnemyProximity } from './encounterEnemyProximity.js'
import {
  encounterActionPositionalContributors,
  type EncounterFlankingFacts
} from './encounterPositionalContributors.js'
import type { MoveToward } from './encounterMoveToward.js'
import {
  characterClassLevels,
  type CharacterMovementFacts,
  type MovementTarget
} from './encounterMovementTargets.js'
import type {
  EncounterActionSourceRequest,
  NativeEncounterActionSource
} from './encounterActionSources.js'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { damageTypeIdsTaken } from './encounterDamageTypesSinceTurnStart.js'
import {
  encounterStowedItemInstanceId,
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
  /**
   * A flow that cannot prompt (a reaction, an opportunity attack, a Legendary Action) names no
   * pick; the first authored option is the no-prompt default. A pick it does name is still refused
   * when unknown.
   */
  firstOptionByDefault?: boolean
}) {
  const { state, actor, actionId, sourceFacts } = input
  const fallsBackToFirst =
    input.readsSharedTest || (input.firstOptionByDefault && input.choiceOptionId === undefined)
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
  // action places the zone its caster picked instead. Only the options this Encounter's optional
  // combat rules offer can be picked, and a no-prompt flow runs the first of them.
  const activeOptionalRules = activeOptionalCombatDefinitions({
    automationMode: state.automationMode,
    snapshot: state.optionalCombatSnapshot
  })
  const compilation = entry?.schemaVersion === 4 ? entry.compilation : null
  const offered = compilation?.choice
    ? offeredCastChoiceOptions(compilation.choice.options, activeOptionalRules)
    : []
  const picked =
    offered.find(({ optionId }) => optionId === input.choiceOptionId) ??
    (fallsBackToFirst ? offered[0] : undefined)
  if (
    entry &&
    (compilation?.choice
      ? !picked
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
  // A ritual is listed with the reason it cannot be cast here, so choosing it is refused by name (D171).
  const refusedRitual = candidate
    ? undefined
    : spellCast?.unavailable.find((value) => value.id === actionId)
  if (refusedRitual)
    throw new UnavailableCreatureActionError(refusedRitual.label, refusedRitual.reason)
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
            activeOptionalRules,
            fallsBackToFirst
          )
        )
  const adapter = characterRuleActionSystemAdapterRegistry.require(state.gameSystemId)
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
  /** The ammunition a weapon attack fires and how many attacks the command makes; absent for a read, which previews the first stack in stock. */
  ammunition?: { itemInstanceId?: string; attacks: number }
  wieldConflictAcceptance: EncounterWieldConflictAcceptance
  /** RESOLVE_ACTION reports overridable warnings; reactions, legendary actions and Disarm refuse them. */
  overridable: boolean
  movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  /** The locked Scene positions of a RESOLVE_ACTION, for range-derived roll modes. */
  sceneContext?: EncounterActionSceneContext | null
  /**
   * The attack targets one of the target's decoys (`attackDecoyFor`): it is rolled against the
   * decoy's armor class and none of its OUTCOME reaches the target. Ignored for an action that
   * makes no attack roll.
   */
  attackDecoy?: EncounterAttackDecoy | null
  /** The occasion the attack is made on (an opportunity attack), which a target's grants can limit themselves to. */
  attackOccasion?: AttackOccasionCode | null
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
  }) => Promise<EnemyProximity | null>
  /**
   * How far the attacker's latest move this turn closed its distance to the target, for an attack
   * with a path that asks (a creature's Charge). Called only for such an attack; null when it has
   * no Scene to measure on, which leaves the check unanswerable.
   */
  loadMoveToward?: (input: {
    sourceFacts: MovementTarget<TCharacterFacts>
    targetFacts: MovementTarget<TCharacterFacts>
  }) => Promise<MoveToward | null>
  /**
   * The once-per-turn uses the attacker has spent this turn (sorted usage keys), for an attack with
   * a path limited that way (Sneak Attack). Called only for such an attack.
   */
  loadTurnUses?: () => Promise<readonly string[]>
  /**
   * Whether the attack's target has yet to take a turn in the Encounter (round 1, initiative
   * status READY), for a Creature whose feature grants ask (Assassinate). Called only for such an attack.
   */
  loadTargetHasNotTakenTurn?: (input: {
    targetFacts: MovementTarget<TCharacterFacts>
  }) => Promise<boolean>
  /**
   * The light on the attacker's square on the Scene (bright, and whether the Scene's daylight reaches
   * it), for a Creature whose feature grants ask (Sunlight Sensitivity); null without a Scene.
   * Called only for such an attack.
   */
  loadHolderLight?: (input: {
    sourceFacts: MovementTarget<TCharacterFacts>
  }) => Promise<EncounterHolderLight | null>
  /**
   * The Flanking facts of a melee attack (loadEncounterFlankingFacts), for its System's policy.
   * Called only while the Encounter's Flanking rule is on; null when it has no Scene to judge on.
   */
  loadFlanking?: (input: {
    sourceFacts: MovementTarget<TCharacterFacts>
    targetFacts: MovementTarget<TCharacterFacts>
    capabilityDefinitionId: string
  }) => Promise<EncounterFlankingFacts | null>
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
    readsSharedTest: input.readsSharedTest,
    // Only RESOLVE_ACTION prompts (it reports overridable warnings); every other flow runs the
    // first authored option of a pick it cannot ask for.
    firstOptionByDefault: !input.overridable
  })
  const { targeting } = targetPolicy
  if (
    targeting?.selectionKind === 'SINGLE_TARGET' &&
    targeting.heldBySource &&
    !encounterHeldActorIds(
      new Map([...currentTargets].map(([id, value]) => [id, value.activeEffects])),
      actor.id
    ).has(target.id)
  )
    throw new EncounterValidationError('The selected action target is not held by the user.')
  if (targeting?.selectionKind === 'SINGLE_TARGET')
    await refuseUnmetTargetRequirements({
      requirements: targeting.targetRequirements,
      actorId: actor.id,
      target: currentTargetFacts,
      loadSight: input.loadAttackPerception
        ? async () =>
            (
              await input.loadAttackPerception!({
                sourceFacts: currentSourceFacts,
                targetFacts: currentTargetFacts,
                roller: 'ATTACKER'
              })
            ).actual
        : undefined
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
            trackAmmunition: state.trackAmmunition,
            ammunition: input.ammunition ?? null,
            overridable: input.overridable
          })
        })()
      : null
  const acceptance = input.wieldConflictAcceptance
  const wieldConflict =
    source.kind === 'CHARACTER_ACTION' && characterFacts && acceptance.kind === 'PROMPTED'
      ? evaluateEncounterCharacterActionWieldConflict({
          gameSystemId: state.gameSystemId,
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
  // A directly resolved attack draws its bound weapon (D107) after any shield it stows, which
  // frees the hand the weapon takes.
  const stowedItemId = acceptedWieldConflict && encounterStowedItemInstanceId(acceptedWieldConflict)
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
  const repeatMechanic: Readonly<Record<string, unknown>> | null =
    source.kind === 'CHARACTER_ACTION'
      ? null
      : {
          ...featureActionMechanic(source.capability),
          // A repeat of a Character's spell scales by the levels it has when the repeat is made.
          ...(sourceFacts.characterFacts && {
            classLevels: characterClassLevels(sourceFacts.characterFacts)
          })
        }
  const actionMechanic = repeatMechanic ?? characterActionState!.actionMechanic
  const attackKind =
    actionMechanic.attackKind == null ? null : attackKindSchema.parse(actionMechanic.attackKind)
  const hands = encounterActorHeldItems(sourceFacts).filter(({ id }) => id !== stowedItemId)
  const boundWeapon =
    source.kind === 'CHARACTER_ACTION'
      ? characterActionDrawWeapon(source.candidate.equipment, attackKind)
      : creatureActionDrawWeapon(
          sourceFacts.actor.kind === 'CREATURE'
            ? snapshotCreatureEquipmentItems(sourceFacts.actor)
            : [],
          source.kind === 'CREATURE'
            ? source.capability.equipmentBinding?.loadoutEntryId
            : undefined,
          attackKind
        )
  const weaponDraw =
    acceptance.kind === 'PROMPTED'
      ? evaluateEncounterWeaponDraw({ weapon: boundWeapon, hands, holds: acceptance.handHolds })
      : ({ kind: 'NONE' } as const)
  if (weaponDraw.kind === 'RELEASE_REQUIRED') throw new HandReleaseRequiredError()
  const profile = attackProfileCapabilityRegistry.require(state.gameSystemId)
  // A Character attack's modifiers are evaluated for its action, its ammunition and its ability.
  const characterAttack = (candidate: CharacterAttack['candidate']): CharacterAttack => ({
    candidate,
    ammunition: characterActionState?.ammunition ?? null,
    attackAbility: characterActionState?.actionMechanic.attackAbility ?? null
  })
  // Only attack damage meets "from nonmagical attacks" defenses; any other attack than a
  // Character action's has its kind's traits and those its holder's grants give (Magic Weapons).
  const attackTraits =
    attackKind === null
      ? null
      : source.kind === 'CHARACTER_ACTION'
        ? profile.characterAttackTraits({
            candidate: source.candidate,
            attackKind,
            policy: source.effectivePolicyOutput
          })
        : profile.featureAttackTraits(attackKind, sourceFacts.grantedAttackTraits)
  // A target's ATTACKS_AGAINST grants (Dodge, applied to its facts) give attacks against it their
  // advantage or disadvantage, or take every advantage away (Elusive), those that require the holder
  // to see the attacker only when it can, those limited to an occasion only on it, and only from the
  // attackers and on the turn their effect admits, and so does a target
  // beyond a ranged attack's normal range (D62). The attacker's and the target's condition
  // mechanics add their own contributors (D94), and so does sight: an unseen attacker has
  // advantage, an unseen target disadvantage.
  const attackDomain = attackKind === null ? null : profile.attackDomain(attackKind)
  const attackSource: GrantSource = {
    creatureTypeIds: [snapshotCreatureTypeId(actor)].filter((id): id is string => id !== null),
    traits: Object.entries(attackTraits ?? {}).flatMap(([trait, present]) =>
      present ? [trait.toUpperCase()] : []
    )
  }
  // The traits a spell cast gives its effects (magical) decide the target's source-qualified grants.
  const spellCastSystemId = preparedCastsSpell({ source, characterActionState, state })
    ? state.gameSystemId
    : null
  const attacksAgainst = targetFacts.attackAgainstContributors.filter(
    (entry) =>
      entry.attackDomain === attackDomain &&
      sourceQualifierAdmits(entry.sourceQualifier, attackSource) &&
      (entry.attackOccasion === undefined || entry.attackOccasion === input.attackOccasion) &&
      isInEffectEventScope(entry.eventScope, {
        actorId: actor.id,
        turnActorId: state.currentActorId
      })
  )
  const longRange = encounterActionLongRangeContributor({
    targetPolicy,
    sceneContext: input.sceneContext ?? null
  })
  const compilerSource = plan.kind === 'TEST_OUTCOME' ? plan.compilerSource : null
  const compiledReads = compilerSource
    ? profile.compiledAttackReads(compilerSource.compiledEffect)
    : null
  // A target's grants that hold only while it sees the effect's source (Danger Sense) decide a save
  // by sight, as an attack's unseen attacker does; a save riding on an attack keeps its rows.
  const sourceSightSaves =
    attackKind === null && compilerSource?.savingThrowAbilityDefinitionId
      ? targetFacts.sourceSightSaves.filter(
          ({ abilityDefinitionId }) =>
            abilityDefinitionId === compilerSource.savingThrowAbilityDefinitionId
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
    (compiledReads?.enemyProximity ||
      (source.kind !== 'CHARACTER_ACTION' &&
        featureModifiersReadEnemyProximity(sourceFacts.featureModifiers)))
      ? await input.loadEnemyProximity({ sourceFacts, targetFacts })
      : null
  const targetHasNotTakenTurn =
    attackKind !== null &&
    input.loadTargetHasNotTakenTurn &&
    source.kind !== 'CHARACTER_ACTION' &&
    featureModifiersReadTargetTurn(sourceFacts.featureModifiers)
      ? await input.loadTargetHasNotTakenTurn({ targetFacts })
      : false
  const holderLight =
    attackKind !== null &&
    input.loadHolderLight &&
    source.kind !== 'CHARACTER_ACTION' &&
    featureModifiersReadHolderLight(sourceFacts.featureModifiers)
      ? await input.loadHolderLight({ sourceFacts })
      : null
  const moveToward =
    attackKind !== null && input.loadMoveToward && compiledReads?.moveToward
      ? await input.loadMoveToward({ sourceFacts, targetFacts })
      : null
  const turnUses =
    attackKind !== null && input.loadTurnUses && compiledReads?.turnUses
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
    gameSystemId: state.gameSystemId,
    subject: attackKind === null ? 'SAVE' : 'ATTACK',
    trueSight: sightContributors(perception.actual),
    believedSight: sightContributors(perception.believed),
    attackerLabel: actor.label,
    targetLabel: target.label
  }
  // A held grant that suppresses an influence (Elusive's advantage) takes it from the attack
  // whatever its source, the attacker's own grants and flanking included, so the compiler drops it
  // from the final roll.
  const attackSuppressedInfluences =
    attackKind === null
      ? []
      : attacksAgainst.flatMap((entry) =>
          entry.suppressedInfluence !== null &&
          attackAgainstHolds(entry, perception?.actual ?? null)
            ? [entry.suppressedInfluence]
            : []
        )
  const conditionAttack = {
    melee: attackKind === 'MELEE' || attackKind === 'UNARMED' || attackKind === 'MELEE_SPELL',
    sceneContext: input.sceneContext ?? null
  }
  const flankingCapabilityId =
    conditionAttack.melee && input.loadFlanking
      ? (optionalCombatPolicyCapabilityRegistry
          .find(state.gameSystemId)
          ?.flankingParticipantCapabilityDefinitionId(state) ?? null)
      : null
  const flanking =
    flankingCapabilityId !== null && input.loadFlanking
      ? await input.loadFlanking({
          sourceFacts,
          targetFacts,
          capabilityDefinitionId: flankingCapabilityId
        })
      : null
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
      : attacksAgainst.flatMap(({ contributor }) => (contributor ? [contributor] : [])),
    longRange ? [longRange] : [],
    attackKind === null
      ? []
      : encounterActionPositionalContributors({
          facing: encounterFacingRule(state),
          sceneContext: input.sceneContext ?? null,
          flanking: flanking && {
            automationMode: state.automationMode,
            gameSystemId: state.gameSystemId,
            optionalCombatSnapshot: state.optionalCombatSnapshot,
            optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
            melee: true,
            ...flanking
          }
        }),
    attackDomain === null
      ? []
      : activeEffectSourceAttackContributors({
          attackerActorId: actor.id,
          targetActorId: target.id,
          attackDomain,
          effects: sourceFacts.activeEffects
        }),
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
  const attackDecoy = attackKind === null ? null : (input.attackDecoy ?? null)
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
    /** The decoy the attack was rolled against, for the settlement to destroy when it hit. */
    attackDecoy,
    plan,
    characterActionState,
    acceptedWieldConflict,
    weaponDraw,
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
        ...(moveToward ? { attackMoveToward: moveToward } : {}),
        ...(turnUses ? { attackTurnUses: turnUses } : {}),
        ...(attackSuppressedInfluences.length > 0 ? { attackSuppressedInfluences } : {}),
        attackAddedDice: encounterAttackAddedDice(
          sourceFacts.activeEffects,
          source.kind === 'CHARACTER_ACTION'
            ? (characterActionState?.actionMechanic.attackAbility ?? null)
            : creatureAttackAbility(source.capability.mechanicFacts.outcomes)
        ),
        // The dice active grants add to, or take from, this source's damage to this target (D156).
        damageAddedDice: activeDamageDice({
          dealerActorId: actor.id,
          dealerEffects: sourceFacts.activeEffects,
          targetEffects: targetFacts.activeEffects,
          attackDomain
        }),
        // The critical range and extra critical dice the attacker's grants give this attack.
        ...(attackKind === null
          ? {}
          : {
              attackCriticalRules:
                source.kind === 'CHARACTER_ACTION'
                  ? profile.characterAttackCriticalRules(
                      source.effectivePolicyOutput,
                      profile.attackDomain(attackKind),
                      characterAttack(source.candidate)
                    )
                  : activeAttackCriticalRules(
                      sourceFacts.activeEffects,
                      profile.attackDomain(attackKind)
                    )
            }),
        // A Character attack uses the same scoped roll-mode contributors as its Sheet action.
        rollContributorEvidence: {
          attacks: Object.fromEntries(
            attackDomainCodeSchema.options.map((attackKind) => [
              attackKind,
              source.kind === 'CHARACTER_ACTION'
                ? mergeCanonicalD20Contributors(
                    profile.characterAttackRollContributors(
                      source.effectivePolicyOutput,
                      attackKind,
                      characterAttack(source.candidate)
                    ),
                    contributors
                  )
                : mergeCanonicalD20Contributors(
                    creatureActiveGrantAttackContributors(
                      actor.id,
                      attackKind,
                      creatureAttackAbility(source.capability.mechanicFacts.outcomes),
                      sourceFacts.activeEffects
                    ).concat(
                      creatureFeatureAttackContributors(
                        actor.id,
                        attackKind,
                        creatureAttackAbility(source.capability.mechanicFacts.outcomes),
                        sourceFacts.featureModifiers,
                        enemyProximity?.nearestFeet ?? null,
                        targetHasNotTakenTurn,
                        holderLight
                      )
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
      targetDerivedFacts: attackDecoy
        ? withAttackDecoyArmorClass(targetFacts.targetDerivedFacts, attackDecoy.armorClass)
        : withSourceSaves(
            state.gameSystemId,
            attackSight && attackKind === null && compilerSource?.savingThrowAbilityDefinitionId
              ? withSourceSightSave(
                  state.gameSystemId,
                  targetFacts.targetDerivedFacts,
                  compilerSource.savingThrowAbilityDefinitionId,
                  attackSight.trueSight
                )
              : targetFacts.targetDerivedFacts,
            targetFacts.sourceSaves,
            attackSource,
            spellCastSystemId
          ),
      ...(attackDecoy ? { absorbedByDecoy: true } : {}),
      targetConditionIds: heldConditionIds(targetFacts),
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
      defenses: profile.attackDamageDefenses(
        targetFacts.defenses,
        targetFacts.qualifiedDefenses,
        attackTraits,
        source.kind === 'CHARACTER_ACTION' ? source.candidate.mechanicsOwner.id : null
      ),
      conditionImmunityIds: conditionImmunityIdsAgainstSource(
        targetFacts.conditionImmunityIds,
        targetFacts.sourceConditionImmunities,
        attackSource,
        spellCastSystemId
      ),
      incomingHalved: targetFacts.incomingDamage.halved,
      targetDamageTypesTaken: damageTypeIdsTaken(targetFacts.actor)
    }
  }
}

/**
 * The once-per-turn uses an executed attack spent: those of its entries whose damage the final
 * phase dealt, which its evidence binds by entry (D119). A miss or an unmet gate binds none.
 */
export function encounterActionSpentTurnUses(
  prepared: Pick<Awaited<ReturnType<typeof prepareEncounterActionSource>>, 'plan' | 'adapter'>,
  evidence: { sourceEntryBindings?: readonly { sourceEntryId: string }[] }
): string[] {
  const { plan, adapter } = prepared
  return plan.kind === 'TEST_OUTCOME'
    ? attackProfileCapabilityRegistry
        .require(adapter.gameSystemId)
        .spentTurnUses(
          plan.compilerSource.compiledEffect,
          new Set((evidence.sourceEntryBindings ?? []).map((binding) => binding.sourceEntryId))
        )
    : []
}
