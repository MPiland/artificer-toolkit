import { encounterActionEconomyWarnings } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { requireEncounterBasicActionDefinition } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
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
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { requireEncounterActorControl } from './actorController.js'
import { evaluateActionEconomy, readDisarmSelection } from './actionPreparationReads.js'
import { rejectDomain } from './domainRejections.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import { loadMovementTargets } from './movementTargetReads.js'
import type { CampaignAuthority, EncounterTurnReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/** A member's reads of one Run, with the Run and the member's Campaign authority already resolved. */
type ActionChoiceReadInput<Request> = CampaignAuthority & {
  run: EncounterDocument<'encounterRuns'>
  request: Request
}

async function readActionChoicesRun(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterActionChoicesInputDto>
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
  if (isEncounterActorDefeated(actor)) return null
  return { state, actor, campaign, membership }
}

/** The current action choices of the Run's acting actor; null when the request is stale. */
export async function readEncounterActionChoices(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterActionChoicesInputDto>
): Promise<EncounterActionChoicesResponseDto> {
  const current = await readActionChoicesRun(tx, input)
  if (!current) return null
  const { state, actor, campaign } = current
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
  // One allowance read per activation; Encounter rules read as the Campaign owner.
  const economyWarnings = new Map<string, Promise<EncounterRuleWarningDto[]>>()
  const readEconomyWarnings = (activation: { code: string; amount: number | null } | null) => {
    if (!activation || activation.amount === null) return Promise.resolve([])
    const key = `${activation.code}:${activation.amount}`
    const known = economyWarnings.get(key)
    if (known) return known
    const read = evaluateActionEconomy(tx, {
      actor,
      state,
      campaign,
      activation: { code: activation.code, amount: activation.amount },
      target: actorTarget
    }).then((economy) => encounterActionEconomyWarnings(economy, activation.code))
    economyWarnings.set(key, read)
    return read
  }
  let actions: EncounterActionChoiceDto[] = []
  let unavailableActions: EncounterActionChoicesDto['unavailableActions'] = []
  if (actor.kind === 'CHARACTER') {
    const facts = actorTarget?.characterFacts
    const mechanics = actorTarget?.characterReactionSource?.mechanics
    const policyOutput = actorTarget?.effectiveRulePolicyOutput
    if (!facts || !mechanics || !policyOutput)
      throw new Error('Encounter Character actions are unavailable.')
    const available = projectCharacterTurnActions(facts, policyOutput).filter(
      (action) =>
        // Unequipped or exhausted actions stay selectable; resolving them warns ("Do it anyway").
        (action.availability.status === 'AVAILABLE' ||
          action.availability.reasonCode === 'SOURCE_NOT_EQUIPPED' ||
          action.availability.reasonCode === 'INSUFFICIENT_RESOURCE') &&
        action.rollable &&
        action.mechanic &&
        mechanics.compiledActionEntryPoints.some(
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
        const candidate = mechanics.rulePolicyInput.actionCandidates.find(
          (value) => value.actionId === action.id
        )
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
        return {
          id: action.id,
          label: action.label,
          ...(action.sourceLabel ? { sourceLabel: action.sourceLabel } : {}),
          ...(action.mechanic?.rangeLabel ? { rangeLabel: action.mechanic.rangeLabel } : {}),
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
          warnings: [
            ...(await readEconomyWarnings(candidate?.mechanicFacts.invocation.activation ?? null)),
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
  } else if (actor.kind === 'CREATURE') {
    const system = await tx.ports.requireSystem(state.gameSystemId)
    const discovered = discoverEncounterFeatureActions({
      actor,
      conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
      abilityDefinitions:
        'abilities' in system ? system.abilities.map(({ id, code }) => ({ id, code })) : []
    })
    // A Legendary Action is taken only at the end of another creature's turn (SRD 5.1), in its
    // Legendary window, never from the owner's own action drawer; the room refuses it too.
    const legendaryFeatureIds = encounterLegendaryActionFeatureIds(actor)
    unavailableActions = discovered.unavailable
      .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
      .map(({ actionId, label, reason }) => ({ id: actionId, label, reason }))
    actions = await Promise.all(
      discovered.available
        .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
        .map(async (action) => ({
          id: action.actionId,
          label: action.label,
          ...(action.attackMechanic ? { attackBonus: action.attackMechanic.attackBonus } : {}),
          grip: action.grip
            ? {
                value: action.grip,
                attackKey: `${action.ownerFeatureId}:${action.featureOptionId ?? ''}:${action.mechanicFacts.invocation.triggerCode}`
              }
            : null,
          wieldConflict: null,
          warnings: await readEconomyWarnings(action.mechanicFacts.invocation.activation)
        }))
    )
  }
  // The System's basic-action catalogue (Q11): its published platform entries, by label.
  const basicActions = await Promise.all(
    (await tx.ports.listBasicActionDefinitions(state.gameSystemId, campaign.ownerUserId))
      .map((current) =>
        requireEncounterBasicActionDefinition({ gameSystemId: state.gameSystemId }, current)
      )
      .map(async ({ definition, document }) => ({
        definitionId: definition.id,
        label: definition.label,
        rulesText: document.rulesText,
        actionCost: document.actionCost,
        needsAlly: document.mechanics.includes('ALLY_ADVANTAGE'),
        // A custom actor has no System allowance to spend.
        warnings:
          actor.kind === 'CUSTOM'
            ? []
            : await readEconomyWarnings({ code: document.actionCost, amount: 1 })
      }))
  )
  return encounterActionChoicesDtoSchema.parse({
    encounterId: state.id,
    encounterVersion: state.version,
    actorId: actor.id,
    actions,
    unavailableActions,
    basicActions,
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
  if (membership.role !== 'OWNER' && !target.public) rejectDomain('TARGET_UNAVAILABLE')
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
