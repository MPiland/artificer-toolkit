import {
  encounterActionEconomyWarnings,
  encounterActionSuppressedWarning
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterActionRequirementsHold } from '@artificer-toolkit/rules-runtime/encounterActionRequirements'
import { encounterActionChoiceRange } from '@artificer-toolkit/rules-runtime/encounterActionRange'
import { encounterActionChoiceTarget } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { buildCompiledActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { characterFormCreatureView } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { encounterAttackActionState } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterActorDefeated } from './characterStates.js'
import { discoverEncounterBasicActions } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { encounterBasicActionRestrictionsHold } from '@artificer-toolkit/rules-runtime/encounterBasicActionRestrictions'
import { requireEncounterBasicActionDefinition } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterBasicActionCheck'
import { findEncounterHolderEscape } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { snapshotCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { evaluateEncounterCharacterActionWieldConflict } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import { projectCharacterTurnActions } from '@artificer-toolkit/rules-runtime/character/turnFacts'
import {
  encounterActionChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  type EncounterActionChoiceDto,
  type EncounterActionChoicesDto,
  type EncounterActionChoicesResponseDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { activationCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { requireEncounterActorControl } from './actorController.js'
import {
  evaluateActionAttackAction,
  readActionHolderState,
  readDisarmSelection
} from './actionPreparationReads.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import { loadMovementTargets } from './movementTargetReads.js'
import type { CampaignAuthority, EncounterTurnReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/** A member's reads of one Run, with the Run and the member's Campaign authority already resolved. */
export type ActionChoiceReadInput<Request> = CampaignAuthority & {
  run: EncounterDocument<'encounterRuns'>
  request: Request
}

/** The Run and acting actor a member may read action choices for; null when the request is stale. */
export async function readActionChoicesRun(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<
    Pick<GetEncounterActionChoicesInputDto, 'expectedVersion' | 'actorId'>
  >
) {
  const { campaign, membership, request } = input
  const state = readRunState(input.run)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (
    state.status !== 'ACTIVE' ||
    state.automationMode === 'MANUAL' ||
    state.version !== request.expectedVersion ||
    state.currentActorId !== request.actorId
  )
    return null
  const actor = await readRunActor(tx, state, request.actorId)
  // A player sees the choices of an actor they control; creature actions included only then.
  await requireEncounterActorControl(tx, { campaign, membership, actor })
  // A defeated actor has no choices (D63).
  if (await readEncounterActorDefeated(tx, actor)) return null
  return { state, actor, campaign, membership }
}

/** The current action choices of the Run's acting actor; null when the request is stale. */
export async function readEncounterActionChoices(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterActionChoicesInputDto>
): Promise<EncounterActionChoicesResponseDto> {
  const current = await readActionChoicesRun(tx, input)
  if (!current) return null
  const { state, actor, campaign, membership } = current
  const actorTarget =
    actor.kind === 'CHARACTER'
      ? (
          await loadMovementTargets(tx, {
            state,
            campaign,
            targetActorIds: [actor.id],
            includeReactionSources: true
          })
        ).get(actor.id)
      : undefined
  // One allowance read per activation and attack kind; Encounter rules read as the Campaign owner.
  type EconomyRead = {
    warnings: EncounterRuleWarningDto[]
    attackSlot: EncounterActionChoiceDto['attackSlot']
  }
  const economyReads = new Map<string, Promise<EconomyRead>>()
  const readEconomy = (
    activation: { code: string; amount: number | null } | null,
    triggerCode = ''
  ): Promise<EconomyRead> => {
    if (!activation || activation.amount === null)
      return Promise.resolve({ warnings: [], attackSlot: null })
    const key = `${activation.code}:${activation.amount}:${triggerCode}`
    const known = economyReads.get(key)
    if (known) return known
    const read = evaluateActionAttackAction(tx, {
      actor,
      state,
      campaign,
      activation: { code: activation.code, amount: activation.amount },
      target: actorTarget,
      triggerCode
    }).then(({ economy, suppressed, slot }) => ({
      warnings: [
        ...encounterActionEconomyWarnings(economy, activation.code),
        ...(suppressed ? [encounterActionSuppressedWarning(activation.code)] : [])
      ],
      attackSlot: slot
    }))
    economyReads.set(key, read)
    return read
  }
  const openAttackAction = encounterAttackActionState(actor)
  let actions: EncounterActionChoiceDto[] = []
  let unavailableActions: EncounterActionChoicesDto['unavailableActions'] = []
  // A Character in a creature form offers the form stat block's actions, not its Sheet's (SPELLS-28.T4d).
  const creature =
    actor.kind === 'CHARACTER'
      ? characterFormCreatureView(actor)
      : actor.kind === 'CREATURE'
        ? actor
        : null
  if (actor.kind === 'CHARACTER' && creature === null) {
    const facts = actorTarget?.characterFacts
    const mechanics = actorTarget?.characterReactionSource?.mechanics
    const spellCast = actorTarget?.characterSpellCast
    const policyOutput = actorTarget?.effectiveRulePolicyOutput
    if (!facts || !mechanics || !spellCast || !policyOutput)
      throw new Error('Encounter Character actions are unavailable.')
    // Each spell the Character may cast now is one choice per cast level (upcasting is the higher one).
    const actionCandidates = [
      ...mechanics.rulePolicyInput.actionCandidates,
      ...spellCast.candidates
    ]
    const entryPoints = [
      ...mechanics.compiledActionEntryPoints,
      ...spellCast.compiledActionEntryPoints
    ]
    // An item action offered only after another action this turn (an off-hand attack) hides until then.
    const requirementsHold = (actionId: string) => {
      const equipment = actionCandidates.find((value) => value.actionId === actionId)?.equipment
      return (
        !equipment ||
        encounterActionRequirementsHold(equipment.requirements, {
          attackAction: openAttackAction,
          turnSequence: state.turnSequence,
          actingItemInstanceId: equipment.itemInstanceId
        })
      )
    }
    const available = projectCharacterTurnActions(facts, policyOutput, spellCast.decisions).filter(
      (action) =>
        // Unequipped or exhausted actions stay selectable; resolving them warns ("Do it anyway").
        (action.availability.status === 'AVAILABLE' ||
          action.availability.reasonCode === 'SOURCE_NOT_EQUIPPED' ||
          action.availability.reasonCode === 'INSUFFICIENT_RESOURCE') &&
        action.mechanic &&
        requirementsHold(action.id) &&
        entryPoints.some(
          (entry) =>
            entry.kind === 'CHARACTER_ACTION' &&
            entry.actionId === action.id &&
            entry.compilation.kind === 'COMPILED'
        )
    )
    actions = await Promise.all(
      available.map(async (action) => {
        const reasonCode =
          action.availability.status === 'UNAVAILABLE' ? action.availability.reasonCode : null
        const candidate = actionCandidates.find((value) => value.actionId === action.id)
        const entry = entryPoints.find(
          (value) =>
            value.kind === 'CHARACTER_ACTION' &&
            value.actionId === action.id &&
            value.effectId === candidate?.effectId
        )
        const targetPolicy = entry?.kind === 'CHARACTER_ACTION' ? entry.targetPolicy : undefined
        const wieldConflict = candidate
          ? evaluateEncounterCharacterActionWieldConflict({
              candidate,
              ruleFacts: facts.ruleEvaluation.facts,
              policyOutput
            })
          : null
        const damageLabel = action.mechanic?.outcomes
          .flatMap((outcome) =>
            outcome.kind === 'DAMAGE' ? [`${outcome.expression} ${outcome.damageTypeLabel}`] : []
          )
          .join(' + ')
        const economy = await readEconomy(
          candidate?.mechanicFacts.invocation.activation ?? null,
          candidate?.mechanicFacts.invocation.triggerCode
        )
        // A cast or an item attack names the activation its Effect authors, whatever it is: an
        // off-hand attack is told apart from the Action attack by it.
        const itemOrCastActivation =
          (candidate?.mechanicsOwner.kind === 'SPELL' || candidate?.equipment) &&
          candidate.mechanicFacts.invocation.activation
            ? activationCodeSchema.parse(candidate.mechanicFacts.invocation.activation.code)
            : undefined
        return {
          id: action.id,
          // A cast is titled with its level; every other action with the Sheet's own label.
          label:
            (candidate?.mechanicsOwner.kind === 'SPELL' ? candidate.label : undefined) ??
            action.label,
          ...(action.sourceLabel ? { sourceLabel: action.sourceLabel } : {}),
          ...encounterActionChoiceRange(targetPolicy, action.mechanic?.rangeLabel),
          ...(itemOrCastActivation ? { actionCost: itemOrCastActivation } : {}),
          ...(action.mechanic?.attackBonus === undefined
            ? {}
            : { attackBonus: action.mechanic.attackBonus }),
          ...(damageLabel ? { damageLabel } : {}),
          grip: candidate?.equipment?.grip
            ? {
                value: candidate.equipment.grip,
                attackKey: `${candidate.equipment.itemInstanceId}:${candidate.mechanicFacts.invocation.triggerCode}`
              }
            : null,
          wieldConflict: wieldConflict?.kind === 'STOW_SHIELD' ? wieldConflict : null,
          attackSlot: economy.attackSlot,
          target: encounterActionChoiceTarget(
            targetPolicy,
            entry?.kind === 'CHARACTER_ACTION' &&
              entry.schemaVersion !== 1 &&
              entry.compilation.kind === 'COMPILED'
              ? entry.compilation.activeEffectPlan?.creatureFormContribution
              : undefined,
            entry?.kind === 'CHARACTER_ACTION' && entry.schemaVersion === 4
              ? entry.compilation.zonePlacement
              : undefined,
            entry?.kind === 'CHARACTER_ACTION' && entry.schemaVersion === 4
              ? entry.compilation.choice
              : undefined
          ),
          warnings: [
            ...economy.warnings,
            ...(reasonCode === 'SOURCE_NOT_EQUIPPED'
              ? [
                  {
                    code: 'SOURCE_NOT_EQUIPPED' as const,
                    message: "The item this action uses isn't equipped."
                  }
                ]
              : reasonCode === 'INSUFFICIENT_RESOURCE'
                ? [{ code: 'RESOURCE_UNAVAILABLE' as const, message: 'Not enough uses left.' }]
                : [])
          ]
        }
      })
    )
  } else if (creature) {
    const system = await tx.ports.requireSystem(state.gameSystemId)
    const discovered = discoverEncounterFeatureActions({
      actor: creature,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions:
        'abilities' in system ? system.abilities.map(({ id, code }) => ({ id, code })) : []
    })
    // A Legendary Action is taken only at the end of another creature's turn (SRD 5.1), in its
    // Legendary window, never from the owner's own action drawer; the room refuses it too.
    const legendaryFeatureIds = encounterLegendaryActionFeatureIds(creature)
    unavailableActions = discovered.unavailable
      .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
      .map(({ actionId, label, reason }) => ({ id: actionId, label, reason }))
    actions = await Promise.all(
      discovered.available
        .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
        .map(async (action) => {
          const economy = await readEconomy(
            action.mechanicFacts.invocation.activation,
            action.mechanicFacts.invocation.triggerCode
          )
          const targetPolicy = buildCompiledActionTargetPolicy(action)
          return {
            id: action.actionId,
            label: action.label,
            ...encounterActionChoiceRange(targetPolicy),
            ...(action.attackMechanic ? { attackBonus: action.attackMechanic.attackBonus } : {}),
            grip: action.grip
              ? {
                  value: action.grip,
                  attackKey: `${action.ownerFeatureId}:${action.featureOptionId ?? ''}:${action.mechanicFacts.invocation.triggerCode}`
                }
              : null,
            wieldConflict: null,
            attackSlot: economy.attackSlot,
            target: encounterActionChoiceTarget(targetPolicy),
            warnings: economy.warnings
          }
        })
    )
  }
  // The System's basic-action catalogue (Q11): its published platform entries, by label.
  const catalogue = (
    await tx.ports.listBasicActionDefinitions(state.gameSystemId, campaign.ownerUserId)
  ).map((current) =>
    requireEncounterBasicActionDefinition({ gameSystemId: state.gameSystemId }, current)
  )
  // Every entry is an authored action that resolves through RESOLVE_ACTION.
  let basicActionChoices: EncounterActionChoiceDto[] = []
  if (catalogue.length > 0 && actor.kind !== 'CUSTOM') {
    const system = await tx.ports.requireSystem(state.gameSystemId)
    const discovered = discoverEncounterBasicActions({
      actorId: actor.id,
      gameSystemId: state.gameSystemId,
      entries: catalogue,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions:
        'abilities' in system ? system.abilities.map(({ id, code }) => ({ id, code })) : []
    })
    // An action is offered only to an actor that meets its restrictions; none means every actor.
    const holderState = discovered.available.some(({ restrictions }) => restrictions)
      ? await readActionHolderState(tx, { actor, state, campaign, target: actorTarget })
      : null
    const offered = discovered.available.filter(
      ({ restrictions }) =>
        !holderState || encounterBasicActionRestrictionsHold(restrictions, holderState)
    )
    basicActionChoices = await Promise.all(
      offered.map(async (action) => {
        const economy = await readEconomy(
          action.mechanicFacts.invocation.activation,
          action.mechanicFacts.invocation.triggerCode
        )
        const document = catalogue.find(
          ({ definition }) => definition.id === action.definitionId
        )?.document
        const targetPolicy = buildCompiledActionTargetPolicy(action)
        return {
          id: action.actionId,
          label: action.label,
          ...encounterActionChoiceRange(targetPolicy),
          rulesText: document?.rulesText,
          actionCost: document?.actionCost,
          grip: null,
          wieldConflict: null,
          attackSlot: economy.attackSlot,
          target: encounterActionChoiceTarget(targetPolicy),
          warnings: economy.warnings
        }
      })
    )
  }
  // The relationships the actor holds and may try to break free of against a fixed DC (D105).
  const heldEscapes = (
    actor.kind === 'CUSTOM' ? [] : await listActiveRuleEffects(tx, turnEffectOwner(actor, state.id))
  ).flatMap((effect) => {
    const escape = findEncounterHolderEscape(effect)
    return escape ? [{ effect, ...escape }] : []
  })
  const escapes: EncounterActionChoicesDto['escapes'] = []
  if (heldEscapes.length > 0) {
    const [system, runActors] = await Promise.all([
      tx.ports.requireSystem(state.gameSystemId),
      readRunActors(tx, state)
    ])
    for (const { effect, module, dc } of heldEscapes) {
      const { origin } = effect.definition
      const grappler =
        origin.kind === 'ENCOUNTER'
          ? runActors.find((candidate) => candidate.id === origin.sourceActorId)
          : undefined
      const economy = await readEconomy({
        code: module.activation.code,
        amount: 'amount' in module.activation ? module.activation.amount : null
      })
      escapes.push({
        activeEffectId: effect.id,
        label:
          grappler && (membership.role === 'OWNER' || grappler.public)
            ? `Escape from ${grappler.label}`
            : 'Escape a grapple',
        dc,
        actionCost: module.activation.code,
        checks: [...module.checks.skillIds, ...module.checks.abilityDefinitionIds].map((id) => ({
          checkDefinitionId: id,
          label: encounterBasicActionCheckLabel(system, id)
        })),
        warnings: economy.warnings
      })
    }
  }
  // The grants the actor holds and may end itself, at the cost each grant's own `holderEnd` names (D113).
  const heldGrantEnds: EncounterActionChoicesDto['heldGrantEnds'] = []
  for (const effect of actor.kind === 'CUSTOM'
    ? []
    : await listActiveRuleEffects(tx, turnEffectOwner(actor, state.id))) {
    const { holderEnd } = effect.definition.recurrence
    if (!holderEnd || effect.maintainedEffectStateId !== null) continue
    const grant =
      effect.definition.schemaVersion === 2
        ? effect.definition.stateContributions.find(
            (contribution) => contribution.kind === 'MODIFIER_GRANT'
          )
        : undefined
    const economy = await readEconomy({ code: holderEnd.activation, amount: 1 })
    heldGrantEnds.push({
      activeEffectId: effect.id,
      label:
        grant && !(grant.sourceHidden && membership.role !== 'OWNER')
          ? `End ${grant.sourceLabel}`
          : 'End effect',
      actionCost: holderEnd.activation,
      warnings: economy.warnings
    })
  }
  return encounterActionChoicesDtoSchema.parse({
    encounterId: state.id,
    encounterVersion: state.version,
    actorId: actor.id,
    openAttackAction:
      openAttackAction && openAttackAction.turnSequence === state.turnSequence
        ? {
            made: openAttackAction.attacks.length,
            total: openAttackAction.total,
            lastActionId: openAttackAction.attacks.at(-1)!.actionId,
            lastTargetIds: openAttackAction.attacks.at(-1)!.targetIds
          }
        : null,
    actions,
    unavailableActions,
    basicActionChoices,
    escapes,
    heldGrantEnds,
    optionalRules: activeOptionalCombatDefinitions({
      automationMode: state.automationMode,
      snapshot: state.optionalCombatSnapshot
    })
      .filter((definition) => definition.document.kind === 'DISARM')
      .map((definition) => ({
        definitionId: definition.definitionId,
        label: definition.label
      }))
  })
}

/** The current Disarm choices for one target of the Run's acting actor. */
export async function readEncounterOptionalActionChoices(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterOptionalActionChoicesInputDto>
): Promise<EncounterOptionalActionChoicesDto> {
  const { request } = input
  const command = request.sceneContext
    ? {
        ...request,
        sceneContext: {
          ...request.sceneContext,
          sceneId: request.sceneContext.sceneId.toLowerCase(),
          sourceTokenId: request.sceneContext.sourceTokenId.toLowerCase(),
          targetTokenId: request.sceneContext.targetTokenId.toLowerCase()
        }
      }
    : request
  const current = await readActionChoicesRun(tx, { ...input, request: command })
  if (!current) throw new Error('Encounter action choices are stale or unavailable.')
  const { state, actor, campaign, membership } = current
  const [actors, target] = await Promise.all([
    readRunActors(tx, state),
    readRunActor(tx, state, command.targetActorId)
  ])
  await requireTargetSeenByMember(tx, { encounterId: state.id, target, membership })
  const { descriptor, definition, targetCharacter } = await readDisarmSelection(tx, {
    state,
    campaign,
    actors,
    actor,
    target,
    command
  })
  const system = await tx.ports.requireSystem(state.gameSystemId)
  const heldItems =
    target.kind === 'CHARACTER' && targetCharacter
      ? targetCharacter.prepared.character.state.equipment.inventory.map((item) => ({
          id: item.id,
          label:
            item.customName ??
            targetCharacter.prepared.resolution.registry.equipment.find(
              (equipment) => equipment.id === item.equipmentId
            )?.label ??
            'Unknown item'
        }))
      : snapshotCreatureEquipmentSources(target).map((item) => ({
          id: item.loadoutEntryId,
          label: item.payload.label
        }))
  return encounterOptionalActionChoicesDtoSchema.parse({
    definitionId: descriptor.definitionId,
    optionId: descriptor.optionId,
    selectionContract: descriptor.selectionContract,
    label: definition.label,
    fields: descriptor.fields.map((field) => {
      if (
        field.kind !== 'ENTITY' ||
        (field.role !== 'HELD_ITEM' && field.role !== 'DEFENDER_CHECK')
      )
        throw new Error('Disarm selection field is unavailable.')
      const choices = field.role === 'HELD_ITEM' ? heldItems : system.skills
      return {
        fieldId: field.fieldId,
        kind: field.kind,
        label: field.role === 'HELD_ITEM' ? 'Held item' : 'Defender check',
        options: field.allowedEntityIds.map((id) => {
          const choice = choices.find((value) => value.id === id)
          if (!choice) throw new Error('Disarm selection label is unavailable.')
          return { id, label: choice.label }
        })
      }
    })
  })
}
