import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { contestedActionApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  activeOptionalCombatDefinitions,
  encounterOptionalCombatSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { systemCoreCodeSchema } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { ServerContestCheckPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { isHandSlot } from '@artificer-toolkit/shared/core'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  characterCheckSkillId,
  toCharacterInitiativeActorFacts
} from './character/characterInitiativeFacts.js'
import { unequipCharacterItem } from './character/sheetCommandReducer.js'
import {
  applyEncounterActorOptionalContestSuccess,
  readEncounterActorOptionalContestContext,
  readEncounterActorOptionalContestFacts
} from './encounterActorOptionalContestContext.js'
import type { prepareEncounterActionEconomy } from './encounterActionEconomy.js'
import type { prepareEncounterActionMechanics } from './encounterActionMechanicsPreparation.js'
import type { ReceiptApplications } from './encounterCharacterMechanicsBatch.js'
import { freezeD20Context } from './encounterD20Settlement.js'
import { evaluateEncounterActionTargetPolicy } from './encounterActionTargetPolicy.js'
import type { FacingRule } from './optionalCombatPolicyCapability.js'
import {
  creatureActiveGrantAttackContributors,
  creatureAttackAbility,
  creatureActiveGrantCheckContributors,
  mergedCanonicalContributors,
  mergedRollContributors
} from './encounterActiveGrants.js'
import { withEncounterConditionCheckContributors } from './encounterConditionMechanics.js'
import {
  checkAbilityCode,
  encounterBasicActionCheckLabel
} from './encounterMovementPassagePreparation.js'
import {
  snapshotCreatureEquipmentLoadout,
  snapshotCreatureEquipmentSources
} from './encounterCreatureEquipmentSources.js'
import {
  contestCheckCapabilityRegistry,
  optionalCombatPolicyCapabilityRegistry
} from './platformEncounterPolicy.js'
import { attackProfileCapabilityRegistry } from './platformEncounterPolicy.js'
import {
  createOptionalCombatActionSelectionDescriptor,
  resolveOptionalCombatActionSelection
} from './encounterOptionalCombatActionSelection.js'
import {
  isEncounterContestPendingContextCurrent,
  prepareEncounterContestPendingContext
} from './encounterContestPendingContext.js'

type PreparedMechanics = Awaited<ReturnType<typeof prepareEncounterActionMechanics>>
type TargetPolicyScene = NonNullable<
  Parameters<typeof evaluateEncounterActionTargetPolicy>[0]['sceneContext']
>
/** The action's bound Scene geometry, as the action's scene capture reads it. */
type SceneContext =
  | (TargetPolicyScene & {
      sceneId: string
      sceneVersion: number
      sourceToken: TargetPolicyScene['sourceToken'] & { tokenId: string }
      targetToken: TargetPolicyScene['targetToken'] & { tokenId: string }
    })
  | null

/** The Run's current Disarm definition for a current actor and target; nothing is prepared yet. */
export function requireEncounterDisarmDefinition(input: {
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  actor: EncounterRunActorState
  target: EncounterRunActorState
  command: {
    encounterId: string
    expectedVersion: number
    actorId: string
    targetActorId: string
    definitionId: string
  }
}) {
  const { state, actors, actor, target, command } = input
  if (
    state.status !== 'ACTIVE' ||
    state.currentActorId !== actor.id ||
    state.automationMode === 'MANUAL' ||
    state.id !== command.encounterId ||
    state.version !== command.expectedVersion ||
    actor.id !== command.actorId ||
    target.id !== command.targetActorId ||
    actor.id === target.id ||
    actor.encounterId !== state.id ||
    target.encounterId !== state.id ||
    !state.actorIds.includes(actor.id) ||
    !state.actorIds.includes(target.id) ||
    actors.filter((value) => value.id === actor.id).length !== 1 ||
    actors.filter((value) => value.id === target.id).length !== 1 ||
    checksumCanonicalJson(actors.find((value) => value.id === actor.id)) !==
      checksumCanonicalJson(actor) ||
    checksumCanonicalJson(actors.find((value) => value.id === target.id)) !==
      checksumCanonicalJson(target)
  )
    throw new Error('Optional combat contest is not current.')
  const snapshot = encounterOptionalCombatSnapshotDtoSchema.safeParse(state.optionalCombatSnapshot)
  if (
    !snapshot.success ||
    checksumCanonicalJson(snapshot.data) !== state.optionalCombatSnapshotChecksum
  )
    throw new Error('Optional combat Disarm snapshot is stale.')
  const definition = activeOptionalCombatDefinitions({
    automationMode: state.automationMode,
    snapshot: snapshot.data
  }).find(
    (value) => value.document.kind === 'DISARM' && value.definitionId === command.definitionId
  )
  if (!definition) throw new Error('Optional combat Disarm is unavailable.')
  return definition
}

/**
 * The source's and defender's contest facts and the issued Disarm choices for prepared action
 * mechanics. Disarm has no "Do it anyway", so any targeting warning refuses it.
 */
export function readEncounterDisarmSelection(input: {
  actor: EncounterRunActorState
  target: EncounterRunActorState
  actionId: string
  definition: ReturnType<typeof requireEncounterDisarmDefinition>
  prepared: PreparedMechanics
  sceneContext: SceneContext
  facing: FacingRule | null
  /** Refuses a target that cannot be disarmed (neither a Character nor a Creature). */
  rejectTarget(): never
}) {
  const { actor, target, prepared } = input
  const { source, sourceFacts, targetFacts } = prepared
  if (source.kind === 'BASIC_ACTION' || source.kind === 'REPEAT_PATH')
    throw new Error('Disarm requires a weapon attack action.')
  const targetWarnings = evaluateEncounterActionTargetPolicy({
    actor,
    target,
    targetPolicy: prepared.targetPolicy,
    sceneContext: input.sceneContext,
    makesAttackRoll: prepared.makesAttackRoll,
    facing: input.facing
  })
  if (targetWarnings === null || targetWarnings.length)
    throw new Error('The selected action does not permit this target.')
  const invocation =
    source.kind === 'CHARACTER_ACTION'
      ? source.candidate.mechanicFacts.invocation
      : source.capability.mechanicFacts.invocation
  if (invocation.activation?.code !== 'ACTION' || invocation.activation.amount !== 1)
    throw new Error('Disarm requires one normalized ACTION activation.')
  const profile = attackProfileCapabilityRegistry.require(prepared.adapter.gameSystemId)

  const sourcePolicyFacts = (() => {
    if (source.kind === 'CHARACTER_ACTION') {
      const character = sourceFacts.characterFacts
      if (!character || !sourceFacts.characterCurrentness)
        throw new Error('Optional combat Character source is stale.')
      const decisions = source.effectivePolicyOutput.actionDecisions.filter(
        (value) =>
          value.status === 'AVAILABLE' &&
          value.actionId === source.candidate.actionId &&
          value.effectId === source.candidate.effectId
      )
      if (decisions.length !== 1 || !decisions[0])
        throw new Error('Optional combat Character action policy is stale.')
      const equipment = source.candidate.equipment
      // The same scoped contributors that resolved this action's roll mode.
      const attack = {
        candidate: source.candidate,
        ammunition: null,
        attackAbility: decisions[0].mechanic.attackAbility
      }
      const contributors = (attackKind: 'MELEE' | 'RANGED' | 'SPELL' | 'UNARMED') =>
        profile.characterAttackRollContributors(source.effectivePolicyOutput, attackKind, attack)
      return {
        // A carried weapon used to attack is drawn for the attack unless its action requires equipping.
        equipment:
          equipment?.equipmentId && (equipment.equipped || !equipment.requiresEquipped)
            ? {
                id: equipment.itemInstanceId,
                category: equipment.category ?? null,
                properties: equipment.properties ?? [],
                state: 'EQUIPPED' as const
              }
            : null,
        size: toCharacterInitiativeActorFacts({
          snapshot: character.ruleEvaluation.snapshot,
          registry: character.ruleEvaluation.registry,
          rulePolicyOutput: source.effectivePolicyOutput
        }).effectiveSize,
        attack: {
          modifier: decisions[0].mechanic.attackBonus,
          rollMode: decisions[0].mechanic.attackRollMode,
          baseContributors: {
            MELEE: contributors('MELEE'),
            RANGED: contributors('RANGED'),
            SPELL: contributors('SPELL'),
            UNARMED: contributors('UNARMED')
          },
          relationshipContributors: prepared.relationshipContributors
        }
      }
    }
    const binding = source.capability.equipmentBinding
    const loadout = binding
      ? snapshotCreatureEquipmentLoadout(actor).find(
          (entry) => entry.id === binding.loadoutEntryId && isHandSlot(entry.useState)
        )
      : null
    const equipment = binding
      ? snapshotCreatureEquipmentSources(actor).find(
          (entry) =>
            entry.loadoutEntryId === binding.loadoutEntryId &&
            entry.equipmentId === binding.equipmentId &&
            entry.sourceRevision === binding.sourceRevision &&
            entry.sourceVersionId === binding.sourceVersionId &&
            entry.sourceChecksum === binding.sourceChecksum
        )
      : null
    const payload =
      typeof actor.snapshot === 'object' &&
      actor.snapshot !== null &&
      !Array.isArray(actor.snapshot) &&
      typeof actor.snapshot.payload === 'object' &&
      actor.snapshot.payload !== null &&
      !Array.isArray(actor.snapshot.payload)
        ? actor.snapshot.payload
        : null
    const size = systemCoreCodeSchema.safeParse(payload?.size)
    return {
      equipment:
        loadout && equipment
          ? {
              id: equipment.loadoutEntryId,
              category: equipment.compiled.category,
              properties: equipment.compiled.properties,
              state: 'HELD' as const
            }
          : null,
      size: size.success ? size.data : null,
      attack: {
        modifier: source.capability.attackMechanic?.attackBonus ?? null,
        rollMode: source.capability.attackMechanic?.rollMode ?? null,
        baseContributors:
          source.capability.attackMechanic?.rollMode === 'NORMAL'
            ? { MELEE: [], RANGED: [], SPELL: [], UNARMED: [] }
            : null,
        // Its active attack grants (a Help) are read here: a Creature has no policy to fold them.
        relationshipContributors: mergedCanonicalContributors(
          prepared.relationshipContributors,
          creatureActiveGrantAttackContributors(
            actor.id,
            profile.attackKind(source.capability.compiledEffect.invocation.triggerCode ?? '') ?? '',
            creatureAttackAbility(source.capability.mechanicFacts.outcomes),
            sourceFacts.activeEffects
          )
        )
      }
    }
  })()
  const defenderFacts = (() => {
    if (target.kind === 'CHARACTER') {
      const character = targetFacts.characterFacts
      if (!character || !targetFacts.characterCurrentness || !targetFacts.effectiveRulePolicyOutput)
        throw new Error('Optional combat Character target is stale.')
      const facts = toCharacterInitiativeActorFacts({
        snapshot: character.ruleEvaluation.snapshot,
        registry: character.ruleEvaluation.registry,
        rulePolicyOutput: targetFacts.effectiveRulePolicyOutput
      })
      // A form that replaces the Character's proficiencies contests with its stat block (D191).
      const form = targetFacts.formCreature
        ? readEncounterActorOptionalContestFacts(targetFacts.formCreature)
        : undefined
      if (form === null) throw new Error('Optional combat Character form is stale.')
      return {
        ownerState: 'CHARACTER_SHEET' as const,
        // Only what a hand holds can be struck away; worn items stay.
        heldItemIds: character.character.state.equipment.equipped
          .filter(({ slot }) => slot !== 'WORN')
          .map(({ itemId }) => itemId),
        equipped: character.character.state.equipment.equipped,
        checkTotals: form ? form.ruleFacts.checkTotals : facts.checkTotals,
        equipment: facts.equippedItems,
        size: form ? form.size : facts.effectiveSize,
        character,
        currentness: targetFacts.characterCurrentness
      }
    }
    if (target.kind !== 'CREATURE') return input.rejectTarget()
    const facts = readEncounterActorOptionalContestFacts(target)
    return {
      ownerState: 'ENCOUNTER_ACTOR' as const,
      heldItemIds: snapshotCreatureEquipmentLoadout(target)
        .filter((entry) => isHandSlot(entry.useState))
        .map((entry) => entry.id),
      checkTotals: facts?.ruleFacts.checkTotals ?? {},
      equipment: [],
      size: facts?.size ?? null
    }
  })()
  const descriptor = createOptionalCombatActionSelectionDescriptor({
    actionId: input.actionId,
    actorId: actor.id,
    definition: input.definition,
    heldItemIds: defenderFacts.heldItemIds,
    targetCheckDefinitionIds: Object.keys(defenderFacts.checkTotals),
    targetActorId: target.id
  })
  return { sourcePolicyFacts, defenderFacts, descriptor }
}

/** Reconstructs the sealed Disarm contest from current facts; it rolls and writes nothing. */
export function prepareEncounterDisarmContest(input: {
  state: EncounterRunState
  actor: EncounterRunActorState
  target: EncounterRunActorState
  command: ResolveEncounterActionInputDto
  definition: ReturnType<typeof requireEncounterDisarmDefinition>
  prepared: PreparedMechanics
  sceneContext: SceneContext
  selection: ReturnType<typeof readEncounterDisarmSelection>
  system: SystemAuthoredDto
  actionEconomy: Awaited<ReturnType<typeof prepareEncounterActionEconomy>>
  priorContest?: ServerContestCheckPendingApplicationContextDto
}) {
  const { state, actor, target, command, prepared, sceneContext, actionEconomy } = input
  const intent = command.optionalCombatIntent
  if (!intent) throw new Error('Optional combat Disarm is unavailable.')
  if (command.acceptedWieldConflict) throw new Error('Disarm does not stow a shield.')
  const { sourcePolicyFacts, defenderFacts, descriptor } = input.selection
  const { source, sourceFacts, plan } = prepared
  if (source.kind === 'BASIC_ACTION' || source.kind === 'REPEAT_PATH')
    throw new Error('Disarm requires a weapon attack action.')
  const selection = resolveOptionalCombatActionSelection({
    definition: input.definition,
    descriptor,
    intent
  })
  const heldItemId = selection.entities.HELD_ITEM
  const checkDefinitionId = selection.entities.DEFENDER_CHECK
  if (!heldItemId || !checkDefinitionId) throw new Error('Disarm selection is incomplete.')
  const targetContext =
    defenderFacts.ownerState === 'ENCOUNTER_ACTOR'
      ? readEncounterActorOptionalContestContext({ actor: target, loadoutEntryId: heldItemId })
      : null
  const targetItem =
    defenderFacts.ownerState === 'CHARACTER_SHEET'
      ? defenderFacts.equipment.find((item) => item.itemInstanceId === heldItemId)
      : targetContext?.equipment
  if (!targetItem) throw new Error('Disarm item is no longer held.')
  const preparation = optionalCombatPolicyCapabilityRegistry
    .require(state.gameSystemId)
    .prepareDisarmContest({
      automationMode: state.automationMode,
      gameSystemId: state.gameSystemId,
      optionalCombatSnapshot: state.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      attackerActorId: actor.id,
      attackerSize: sourcePolicyFacts.size,
      heldItemId,
      targetActorId: target.id,
      targetCheckDefinitionId: checkDefinitionId,
      targetEquipment: { properties: targetItem.properties },
      targetItemOwnerState: defenderFacts.ownerState,
      targetSize: defenderFacts.size,
      triggerCode:
        source.kind === 'CHARACTER_ACTION'
          ? (source.candidate.mechanicFacts.invocation.triggerCode ?? null)
          : (source.capability.compiledEffect.invocation.triggerCode ?? null),
      sourceEquipment: sourcePolicyFacts.equipment,
      attack: sourcePolicyFacts.attack
    })
  if (preparation.kind !== 'PROPOSED')
    throw new Error('Disarm cannot be resolved from the selected facts.')
  const modifier = sourcePolicyFacts.attack.modifier
  const targetCheckTotal = defenderFacts.checkTotals[checkDefinitionId]
  if (
    modifier === null ||
    targetCheckTotal === undefined ||
    !Number.isSafeInteger(targetCheckTotal)
  )
    throw new Error('Disarm contest modifier is unavailable.')
  const graph = contestCheckCapabilityRegistry
    .require(state.gameSystemId)
    .optionalCombatContestGraph(preparation.proposal.pin)
  const published = plan.kind === 'SINGLE_GRAPH' ? plan.published : plan.test.published
  const sourceContext =
    source.kind === 'CHARACTER_ACTION'
      ? {
          kind: 'CHARACTER_ACTION' as const,
          characterId: source.characterId,
          streamVersion: source.characterStreamVersion,
          projectionChecksum: sourceFacts.characterCurrentness!.projectionChecksum,
          mechanicalContextChecksum: sourceFacts.characterCurrentness!.mechanicalContextChecksum,
          publishedDefinitionId: published.id,
          publishedDefinitionChecksum: published.checksum
        }
      : {
          kind: 'ENCOUNTER_FEATURE' as const,
          creatureSourceId: source.capability.creatureSourceId,
          sourceRevision: source.capability.sourceRevision,
          sourceVersionId: source.capability.sourceVersionId,
          sourceChecksum: source.capability.sourceChecksum,
          ownerFeatureId: source.capability.ownerFeatureId,
          featureOptionId: source.capability.featureOptionId ?? null,
          effectId: source.capability.effectId,
          authoredEffectChecksum: source.capability.authoredEffectChecksum,
          compiledEffectChecksum: source.capability.compiledEffectChecksum,
          publishedDefinitionId: published.id,
          publishedDefinitionChecksum: published.checksum
        }
  const sceneDependency = sceneContext
    ? {
        sceneId: sceneContext.sceneId,
        sceneVersion: sceneContext.sceneVersion,
        sourceTokenId: sceneContext.sourceToken.tokenId,
        targetTokenId: sceneContext.targetToken.tokenId
      }
    : null
  // The defender's own active check grants (a Help) join the size relation; a Character's come
  // from its policy evidence, a Creature's from its grants directly.
  const defenderGrantContributors =
    target.kind === 'CHARACTER' && !prepared.targetFacts.formCreature
      ? (prepared.targetFacts.effectiveRulePolicyOutput?.rollContributorEvidence.skillChecks[
          characterCheckSkillId(
            prepared.targetFacts.characterFacts?.ruleEvaluation.registry,
            checkDefinitionId
          ) ?? ''
        ] ?? [])
      : creatureActiveGrantCheckContributors(
          target.id,
          checkAbilityCode(input.system, 'SKILL', checkDefinitionId),
          prepared.targetFacts.activeEffects
        )
  const defenderRoll = withEncounterConditionCheckContributors({
    gameSystemId: state.gameSystemId,
    holderActorId: target.id,
    mechanics: prepared.targetFacts.conditionMechanics,
    roll: mergedRollContributors(
      state.gameSystemId,
      preparation.proposal.contest.targetContributors,
      defenderGrantContributors
    )
  })
  const current: Parameters<typeof prepareEncounterContestPendingContext>[0] = {
    origin: {
      kind: 'OPTIONAL_COMBAT',
      actionKind: 'DISARM',
      pin: {
        snapshotChecksum: state.optionalCombatSnapshotChecksum,
        ...preparation.proposal.pin
      },
      optionId: descriptor.optionId,
      selectionContractChecksum: descriptor.selectionContract,
      resolvedSelectionChecksum: checksumRuleDocument(selection),
      selection: {
        kind: 'DISARM',
        heldItemId,
        defenderCheckDefinitionId: checkDefinitionId,
        heldItemStateChecksum:
          defenderFacts.ownerState === 'CHARACTER_SHEET'
            ? checksumRuleDocument({
                itemId: heldItemId,
                properties: targetItem.properties,
                state: 'EQUIPPED'
              })
            : targetContext!.stateChecksum
      }
    },
    actionId: command.actionId,
    sourceActorId: actor.id,
    targetActorId: target.id,
    initiatorControllerCharacterId: source.kind === 'CHARACTER_ACTION' ? source.characterId : null,
    sceneContext: sceneDependency,
    positionalDependencyChecksum: checksumRuleDocument(sceneDependency),
    contestGraph: {
      definitionId: graph.published.id,
      checksum: graph.published.checksum,
      identityChecksum: graph.identityChecksum
    },
    source: sourceContext,
    target:
      defenderFacts.ownerState === 'CHARACTER_SHEET'
        ? {
            kind: 'CHARACTER',
            characterId: defenderFacts.character.active.id,
            streamVersion: defenderFacts.character.active.play.streamVersion,
            projectionChecksum: defenderFacts.currentness.projectionChecksum,
            mechanicalContextChecksum: defenderFacts.currentness.mechanicalContextChecksum,
            stateChecksum: checksumRuleDocument({
              itemId: heldItemId,
              streamVersion: defenderFacts.character.active.play.streamVersion,
              equipped: defenderFacts.equipped
            })
          }
        : { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: targetContext!.stateChecksum },
    initiator: {
      actorId: actor.id,
      requestNodeId: 'initiator_d20',
      ...freezeD20Context({
        gameSystemId: state.gameSystemId,
        rollMode: preparation.proposal.contest.initiatorMode,
        contributors: preparation.proposal.contest.initiatorContributors,
        modifier
      })
    },
    defender: {
      actorId: target.id,
      requestNodeId: 'target_d20',
      checks: [
        {
          checkDefinitionId,
          label: encounterBasicActionCheckLabel(input.system, checkDefinitionId),
          ...freezeD20Context({
            gameSystemId: state.gameSystemId,
            ...defenderRoll,
            modifier: targetCheckTotal
          })
        }
      ]
    },
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
    throw new Error('Optional combat contest pending facts changed.')
  const currentnessChecksum = checksumRuleDocument({ actor, target, sceneContext, contest })
  return { contest, graph, currentnessChecksum }
}

type DisarmContest = ReturnType<typeof prepareEncounterDisarmContest>['contest']
type ContestStateTransition = ReturnType<
  typeof contestedActionApplicationOutputDtoSchema.parse
>['stateTransition']

/**
 * What a won Disarm changes, from the target's current facts: the held item moves to carried on
 * the Character's Sheet or in the Creature's loadout. Both the room plan and the Convex commit use
 * it, so a target changed since the contest was sealed refuses the commit.
 */
export function planEncounterDisarmSuccess(input: {
  target: EncounterRunActorState
  contest: DisarmContest
  /** The target Character's current record; null for a Creature. */
  character: { id: string; streamVersion: number; document: CharacterAuthored } | null
}):
  | { kind: 'CHARACTER'; character: CharacterAuthored; stateTransition: ContestStateTransition }
  | { kind: 'CREATURE'; actor: EncounterRunActorState; stateTransition: ContestStateTransition } {
  const { target, contest, character } = input
  const { origin } = contest
  if (
    origin.kind !== 'OPTIONAL_COMBAT' ||
    origin.actionKind !== 'DISARM' ||
    origin.selection.kind !== 'DISARM'
  )
    throw new Error('Disarm settlement requires a Disarm contest.')
  const { selection } = origin
  const itemId = selection.heldItemId
  if (target.kind === 'CHARACTER') {
    if (
      !character ||
      contest.target.kind !== 'CHARACTER' ||
      target.sourceId !== character.id ||
      contest.target.characterId !== character.id ||
      contest.target.streamVersion !== character.streamVersion ||
      !character.document.state.equipment.equipped.some((entry) => entry.itemId === itemId) ||
      contest.target.stateChecksum !==
        checksumRuleDocument({
          itemId,
          streamVersion: character.streamVersion,
          equipped: character.document.state.equipment.equipped
        })
    )
      throw new Error('Disarm Character item changed before settlement.')
    const next = unequipCharacterItem(structuredClone(character.document), itemId)
    return {
      kind: 'CHARACTER',
      character: next,
      stateTransition: {
        kind: 'CHARACTER_ITEM_USE_STATE',
        characterId: character.id,
        itemInstanceId: itemId,
        fromState: 'EQUIPPED',
        toState: 'CARRIED',
        beforeStreamVersion: character.streamVersion,
        afterStreamVersion: character.streamVersion + 1,
        beforeStateChecksum: checksumRuleDocument(character.document.state.equipment),
        afterStateChecksum: checksumRuleDocument(next.state.equipment)
      }
    }
  }
  if (target.kind !== 'CREATURE') throw new Error('Disarm target is unavailable.')
  const context = readEncounterActorOptionalContestContext({
    actor: target,
    loadoutEntryId: itemId
  })
  if (!context || context.stateChecksum !== selection.heldItemStateChecksum)
    throw new Error('Disarm Creature item changed before settlement.')
  const applied = applyEncounterActorOptionalContestSuccess({ context, actor: target })
  return {
    kind: 'CREATURE',
    actor: encounterRunActorStateSchema.parse(applied.actor),
    stateTransition: {
      kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
      actorId: target.id,
      loadoutEntryId: context.equipment.loadoutEntryId,
      equipmentId: context.equipment.equipmentId,
      fromState: context.equipment.state,
      toState: 'CARRIED',
      beforeStateChecksum: applied.beforeStateChecksum,
      afterStateChecksum: applied.afterStateChecksum
    }
  }
}

/** Each participant's settled d20: a completed execution's rolls, or a stored receipt's. */
type ContestRolls = Record<'initiator' | 'defender', { total: number }>

/** A settled contest's receipt outputs; the source wins only on a higher total. */
export function contestApplicationOutputs(input: {
  occurrenceId: string
  contest: DisarmContest
  rolls: ContestRolls
  stateTransition: ContestStateTransition
  actionEconomy: Awaited<ReturnType<typeof prepareEncounterActionEconomy>>
  /** The Attack action a contest that replaces one attack fills (Grapple, Shove). */
  attackAction?: EncounterAttackActionTransitionDto | null
  /** What the initiator's ended effects released from the initiator; receipted with the contest. */
  sourceApplications: ReceiptApplications
}) {
  const { contest, rolls } = input
  // Only an optional combat contest has a policy pin; a basic action or escape has none (D152).
  const pin = contest.origin.kind === 'OPTIONAL_COMBAT' ? contest.origin.pin : null
  return contestedActionApplicationOutputDtoSchema.parse({
    kind: 'CONTESTED_ACTION',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    sourceActorId: contest.sourceActorId,
    targetActorId: contest.targetActorId,
    sealedContextChecksum: checksumRuleDocument(contest),
    policy: pin && {
      definitionId: pin.definitionId,
      definitionVersion: pin.definitionVersion,
      definitionChecksum: pin.definitionChecksum,
      moduleKey: pin.moduleKey,
      moduleContractVersion: pin.moduleContractVersion
    },
    contestGraph: contest.contestGraph,
    sourceRoll: rolls.initiator,
    targetRoll: rolls.defender,
    outcome: contestSourceWins(rolls) ? 'SOURCE_WIN' : 'TARGET_WIN_OR_TIE',
    stateTransition: input.stateTransition,
    actionEconomyTransition: input.actionEconomy,
    ...(input.attackAction ? { attackActionTransition: input.attackAction } : {}),
    sourceApplications: input.sourceApplications
  })
}

export function contestSourceWins(rolls: ContestRolls) {
  return rolls.initiator.total > rolls.defender.total
}
