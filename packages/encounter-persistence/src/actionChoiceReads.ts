import { resolveHandOccupancy } from '@artificer-toolkit/shared/core'
import {
  encounterActionEconomyWarnings,
  encounterActionSuppressedWarning
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { ammunitionInStock } from '@artificer-toolkit/rules-runtime/character/characterAmmunition'
import { encounterActionRequirementsHold } from '@artificer-toolkit/rules-runtime/encounterActionRequirements'
import { encounterActionChoiceRange } from '@artificer-toolkit/rules-runtime/encounterActionRange'
import { encounterActionChoiceTarget } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { castChoiceOptions } from '@artificer-toolkit/rules-runtime/encounterCastChoice'
import { buildCompiledActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { characterFormCreatureView } from '@artificer-toolkit/rules-runtime/encounterActorForm'
import { encounterAttackActionState } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import {
  creatureAttackSlotAlternatives,
  encounterAttackActionStanding
} from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  attackSlotTotal,
  isAttackSlotFiller
} from '@artificer-toolkit/rules-runtime/encounterAttackSlots'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import {
  encounterDefaultAttackActionId,
  type DefaultAttackChoice
} from '@artificer-toolkit/rules-runtime/encounterDefaultAttack'
import { snapshotCreatureEquipmentItems } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { encounterActorHeldItems } from '@artificer-toolkit/rules-runtime/encounterHolderDefense'
import { attackProfileCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import {
  characterActionDrawWeapon,
  creatureActionDrawWeapon,
  evaluateEncounterWeaponDraw
} from '@artificer-toolkit/rules-runtime/encounterWeaponDraw'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { readEncounterBoundSceneTokens } from './actionSceneInputs.js'
import { readEncounterActorDefeated, readZeroHitPointActorIds } from './characterStates.js'
import { discoverEncounterBasicActions } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { encounterBasicActionAdmission } from '@artificer-toolkit/rules-runtime/encounterBasicActionRestrictions'
import { requireEncounterBasicActionDefinition } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import {
  findEncounterHolderContestEscape,
  findEncounterHolderEscape,
  findEncounterRescues
} from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { encounterRelationships } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { encounterActorEffectiveSize } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { encounterDragDoublesCost } from '@artificer-toolkit/rules-runtime/encounterMovementDrag'
import { liveEffectOffers } from '@artificer-toolkit/rules-runtime/encounterEffectOffers'
import { repeatPathActionId } from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { snapshotCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { listEncounterChosenItems } from '@artificer-toolkit/rules-runtime/encounterChosenItem'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { evaluateEncounterCharacterActionWieldConflict } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import { projectCharacterTurnActions } from '@artificer-toolkit/rules-runtime/character/turnFacts'
import {
  encounterActionChoicesDtoSchema,
  encounterActionItemChoicesDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  type EncounterActionItemChoicesDto,
  type GetEncounterActionItemChoicesInputDto,
  type EncounterActionChoiceDto,
  type EncounterActionChoicesDto,
  type EncounterActionChoicesResponseDto,
  type EncounterHeldRelationshipDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto,
  type GetEncounterOptionalActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { activationCodeSchema } from '@artificer-toolkit/schema/shared/enums'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { readEncounterControlledActorIds, requireEncounterActorControl } from './actorController.js'
import {
  evaluateActionAttackAction,
  prepareActionMechanics,
  readActionHolderState,
  readDisarmSelection
} from './actionPreparationReads.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { readRunActor, readRunActors, readRunState } from './documents.js'
import { readEncounterSpellPins } from './spellPins.js'
import {
  actorGrantedActions,
  grantedActionId,
  nextGrantedActionUseKey
} from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import { listActiveRuleEffects, readActiveEffectsByActorId } from './effectStore.js'
import { readTurnUses } from './turnMovement.js'
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
    /** An open Attack action has no slot this action fills (D93); the drawer does not offer it. */
    blocked: boolean
  }
  const economyReads = new Map<string, Promise<EconomyRead>>()
  const readEconomy = (
    activation: { code: string; amount: number | null } | null,
    triggerCode = '',
    replacesAttack = false,
    featureId?: string
  ): Promise<EconomyRead> => {
    if (!activation || activation.amount === null)
      return Promise.resolve({ warnings: [], attackSlot: null, blocked: false })
    const key = `${activation.code}:${activation.amount}:${triggerCode}:${replacesAttack}:${featureId ?? ''}`
    const known = economyReads.get(key)
    if (known) return known
    const read = evaluateActionAttackAction(tx, {
      actor,
      state,
      campaign,
      activation: { code: activation.code, amount: activation.amount },
      target: actorTarget,
      triggerCode,
      replacesAttack,
      featureId
    }).then(({ economy, suppressed, slot, blocked }) => ({
      blocked,
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
  // The held item and activation of each item action, from which the default attack is picked (D107).
  const itemBindings = new Map<
    string,
    Pick<DefaultAttackChoice, 'itemId' | 'activationCode' | 'triggerCode'>
  >()
  let unavailableActions: EncounterActionChoicesDto['unavailableActions'] = []
  // A Character in a creature form offers the form stat block's actions, not its Sheet's (SPELLS-28.T4d).
  const creature =
    actor.kind === 'CHARACTER'
      ? characterFormCreatureView(actor)
      : actor.kind === 'CREATURE'
        ? actor
        : null
  // The creatures the actor holds through a relationship it applied; releasing one spends nothing (D152).
  const heldByActor = await readHeldRelationships(tx, {
    state,
    membership,
    sourceActorIds: new Set([actor.id])
  })
  const releases: EncounterActionChoicesDto['releases'] = heldByActor.map(
    ({ heldActorId, activeEffectId, label }) => ({ heldActorId, activeEffectId, label })
  )
  // An attack that must draw its weapon while only the holds that fill a hand keep one from it asks
  // the actor to release one first (D107, D152).
  const handHolds = heldByActor.filter(({ occupiesHand }) => occupiesHand)
  const heldItems = encounterActorHeldItems({
    actor: creature ?? actor,
    characterFacts: actorTarget?.characterFacts ?? null
  })
  const handReleaseChoice = (draw: ReturnType<typeof evaluateEncounterWeaponDraw>) =>
    draw.kind === 'RELEASE_REQUIRED'
      ? {
          handRelease: {
            holds: handHolds.map(({ activeEffectId, heldActorId }) => ({
              activeEffectId,
              heldActorId
            }))
          }
        }
      : {}
  const handReleaseFor = (weapon: Parameters<typeof evaluateEncounterWeaponDraw>[0]['weapon']) =>
    evaluateEncounterWeaponDraw({ weapon, hands: heldItems, holds: handHolds.length })
  if (actor.kind === 'CHARACTER' && creature === null) {
    const facts = actorTarget?.characterFacts
    const mechanics = actorTarget?.characterReactionSource?.mechanics
    const spellCast = actorTarget?.characterSpellCast
    const policyOutput = actorTarget?.effectiveRulePolicyOutput
    if (!facts || !mechanics || !spellCast || !policyOutput)
      throw new Error('Encounter Character actions are unavailable.')
    unavailableActions = [...spellCast.unavailable]
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
        const activeEffectPlan =
          entry?.kind === 'CHARACTER_ACTION' &&
          entry.schemaVersion !== 1 &&
          entry.compilation.kind === 'COMPILED'
            ? entry.compilation.activeEffectPlan
            : undefined
        const wieldConflict = candidate
          ? evaluateEncounterCharacterActionWieldConflict({
              gameSystemId: state.gameSystemId,
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
        const weapon = characterActionDrawWeapon(
          candidate?.equipment ?? null,
          candidate
            ? attackProfileCapabilityRegistry
                .require(state.gameSystemId)
                .attackKind(candidate.mechanicFacts.invocation.triggerCode)
            : null
        )
        const draw = handReleaseFor(weapon)
        if (candidate?.equipment)
          itemBindings.set(action.id, {
            itemId: candidate.equipment.itemInstanceId,
            activationCode: candidate.mechanicFacts.invocation.activation?.code ?? null,
            triggerCode: candidate.mechanicFacts.invocation.triggerCode
          })
        // A cast or an item attack names the activation its Effect authors, whatever it is: an
        // off-hand attack is told apart from the Action attack by it.
        const itemOrCastActivation =
          (candidate?.mechanicsOwner.kind === 'SPELL' || candidate?.equipment) &&
          candidate.mechanicFacts.invocation.activation
            ? activationCodeSchema.parse(candidate.mechanicFacts.invocation.activation.code)
            : undefined
        const componentsLabel =
          candidate?.mechanicsOwner.kind === 'SPELL'
            ? spellCast.componentsLabelBySpellId.get(candidate.mechanicsOwner.id)
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
          ...(componentsLabel ? { componentsLabel } : {}),
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
          ...handReleaseChoice(draw),
          ...ammunitionChoices(candidate?.equipment, facts.character.state.equipment.inventory),
          attackSlot: economy.attackSlot,
          target: encounterActionChoiceTarget(
            targetPolicy,
            activeEffectPlan?.creatureFormContribution,
            entry?.kind === 'CHARACTER_ACTION' && entry.schemaVersion === 4
              ? entry.compilation.zonePlacement
              : undefined,
            entry?.kind === 'CHARACTER_ACTION' && entry.schemaVersion === 4
              ? entry.compilation.choice
              : undefined,
            Boolean(activeEffectPlan?.chosenItem)
          ),
          warnings: [
            ...economy.warnings,
            // An attack draws or throws its carried weapon itself (D107), so a carried weapon is no warning.
            ...(reasonCode === 'SOURCE_NOT_EQUIPPED' && draw.kind !== 'DRAW' && !weapon?.thrown
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
        'abilities' in system ? system.abilities.map(({ id, code }) => ({ id, code })) : [],
      spells: await readEncounterSpellPins(tx, state.id)
    })
    // A Legendary Action is taken only at the end of another creature's turn (SRD 5.1), in its
    // Legendary window, never from the owner's own action drawer; the room refuses it too.
    const legendaryFeatureIds = encounterLegendaryActionFeatureIds(creature)
    unavailableActions = discovered.unavailable
      .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
      .map(({ actionId, label, reason }) => ({ id: actionId, label, reason }))
    const slotAlternatives = creatureAttackSlotAlternatives(creature)
    // A Recharge Feature that fills a slot is offered only while it is charged (D93).
    const featureResources = evaluateInstalledEncounterActors({
      gameSystemId: state.gameSystemId,
      facts: buildEncounterActorRuleFacts({ actors: [creature] })
    }).actors.find((entry) => entry.actorId === creature.id)?.featureResources
    const offered = await Promise.all(
      discovered.available
        .filter((action) => !legendaryFeatureIds.has(action.ownerFeatureId))
        .map(async (action) => {
          const fillsSlot = isAttackSlotFiller(slotAlternatives, action.ownerFeatureId)
          const economy = await readEconomy(
            action.mechanicFacts.invocation.activation,
            action.mechanicFacts.invocation.triggerCode,
            false,
            fillsSlot ? action.ownerFeatureId : undefined
          )
          const charged =
            !fillsSlot ||
            !action.featureResourceUse ||
            (featureResources?.find((entry) => entry.featureId === action.ownerFeatureId)
              ?.remaining ?? 0) >= action.featureResourceUse.cost
          if (economy.blocked || !charged) return null
          if (action.equipmentBinding)
            itemBindings.set(action.actionId, {
              itemId: action.equipmentBinding.loadoutEntryId,
              activationCode: action.mechanicFacts.invocation.activation?.code ?? null,
              triggerCode: action.mechanicFacts.invocation.triggerCode
            })
          const targetPolicy = buildCompiledActionTargetPolicy(action)
          const castChoice = castChoiceOptions(action.compiledEffect)
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
            ...handReleaseChoice(
              handReleaseFor(
                creatureActionDrawWeapon(
                  snapshotCreatureEquipmentItems(creature),
                  action.equipmentBinding?.loadoutEntryId,
                  attackProfileCapabilityRegistry
                    .require(state.gameSystemId)
                    .attackKind(action.mechanicFacts.invocation.triggerCode)
                )
              )
            ),
            attackSlot: economy.attackSlot,
            target: encounterActionChoiceTarget(
              targetPolicy,
              null,
              null,
              castChoice && { options: castChoice }
            ),
            warnings: economy.warnings
          }
        })
    )
    actions = offered.filter((choice) => choice !== null)
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
    // An action is offered only to an actor that meets its restrictions, or would by stowing a
    // held weapon (D152); none means every actor.
    const holderState = discovered.available.some(({ restrictions }) => restrictions)
      ? await readActionHolderState(tx, { actor, state, campaign, target: actorTarget })
      : null
    const offered = discovered.available.flatMap((action) => {
      const admission = holderState
        ? encounterBasicActionAdmission(action.restrictions, holderState)
        : ({ kind: 'MET' } as const)
      return admission.kind === 'UNMET' ? [] : [{ action, admission }]
    })
    // What a held effect offers the actor (D160): the same actions, taken through the offer's
    // activation and, when it is capped, its uses this turn.
    const spentKeys = await readTurnUses(tx, { state, actorId: actor.id })
    const heldOffers = actorGrantedActions(
      await listActiveRuleEffects(tx, turnEffectOwner(actor, state.id)),
      actor
    ).flatMap((held) => {
      if (nextGrantedActionUseKey(held, spentKeys) === undefined) return []
      return offered.flatMap(({ action, admission }) =>
        held.offer.actionDefinitionIds.includes(action.definitionId)
          ? [{ action, admission, held }]
          : []
      )
    })
    const choiceSources = [...offered.map((entry) => ({ ...entry, held: null })), ...heldOffers]
    basicActionChoices = await Promise.all(
      choiceSources.map(async ({ action: base, admission, held }) => {
        const action = held
          ? {
              ...base,
              actionId: grantedActionId(base.actionId, held.effectId, held.offerIndex),
              mechanicFacts: {
                ...base.mechanicFacts,
                invocation: {
                  ...base.mechanicFacts.invocation,
                  activation: {
                    ...base.mechanicFacts.invocation.activation,
                    code: held.offer.activation,
                    amount: 1
                  }
                }
              }
            }
          : base
        const { activation, triggerCode } = action.mechanicFacts.invocation
        const economy = await readEconomy(activation, triggerCode, action.actionCost === 'ATTACK')
        const document = catalogue.find(
          ({ definition }) => definition.id === action.definitionId
        )?.document
        const targetPolicy = buildCompiledActionTargetPolicy(action)
        // A basic action that picks its win's outcome with the attempt (Shove, D105) offers it.
        const castChoice = castChoiceOptions(action.compiledEffect)
        return {
          id: action.actionId,
          label: action.label,
          ...encounterActionChoiceRange(targetPolicy),
          rulesText: document?.rulesText,
          // The activation it spends; an attack it replaces shows as its `attackSlot`.
          ...(activation ? { actionCost: activationCodeSchema.parse(activation.code) } : {}),
          grip: null,
          wieldConflict: admission.kind === 'STOW_HELD_WEAPON' ? admission : null,
          attackSlot: economy.attackSlot,
          target: encounterActionChoiceTarget(
            targetPolicy,
            null,
            null,
            castChoice && { options: castChoice }
          ),
          warnings: economy.warnings
        }
      })
    )
  }
  // The relationships and zones holding the actor that it may break free of, against a fixed DC
  // (D105, D146) or contested by its holder, which has no DC (D152).
  const heldEscapes = (
    actor.kind === 'CUSTOM' ? [] : await listActiveRuleEffects(tx, turnEffectOwner(actor, state.id))
  ).flatMap((effect) => {
    const contested = findEncounterHolderContestEscape(effect)
    const escape = contested
      ? { activation: contested.activation, checks: contested.checks, dc: null, zoneLabel: null }
      : findEncounterHolderEscape(effect)
    return escape ? [{ effect, heldActorId: null, ...escape }] : []
  })
  const runActors = await readRunActors(tx, state)
  // The holds on creatures within reach that the actor may break for them (ATTACK-7.9).
  const rescues =
    actor.kind === 'CUSTOM' ? [] : await readEncounterRescues(tx, state, actor, runActors)
  const escapes: EncounterActionChoicesDto['escapes'] = []
  if (heldEscapes.length > 0 || rescues.length > 0) {
    const system = await tx.ports.requireSystem(state.gameSystemId)
    for (const { effect, heldActorId, activation, checks, dc, zoneLabel } of [
      ...heldEscapes,
      ...rescues
    ]) {
      const { origin } = effect.definition
      const grappler =
        origin.kind === 'ENCOUNTER'
          ? runActors.find((candidate) => candidate.id === origin.sourceActorId)
          : undefined
      const held = heldActorId ? runActors.find((candidate) => candidate.id === heldActorId) : null
      const economy = await readEconomy({
        code: activation.code,
        amount: 'amount' in activation ? activation.amount : null
      })
      escapes.push({
        heldActorId,
        activeEffectId: effect.id,
        label: held
          ? membership.role === 'OWNER' || held.public
            ? `Free ${held.label}`
            : 'Free a creature'
          : zoneLabel
            ? `Escape ${zoneLabel}`
            : grappler && (membership.role === 'OWNER' || grappler.public)
              ? `Escape from ${grappler.label}`
              : 'Escape a grapple',
        dc,
        actionCost: activation.code,
        checks: [...checks.skillIds, ...checks.abilityDefinitionIds].map((id) => ({
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
    const grant = effect.definition.stateContributions.find(
      (contribution) => contribution.kind === 'MODIFIER_GRANT'
    )
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
  // The choices effects held by other creatures offer the actor, such as moving a mark off a downed
  // creature (D160).
  const effectOffers: EncounterActionChoicesDto['effectOffers'] = []
  const effectsByHolder = await readActiveEffectsByActorId(tx, state.id, runActors)
  for (const offer of liveEffectOffers({
    actorId: actor.id,
    effectsByHolder,
    zeroHitPointActorIds: await readZeroHitPointActorIds(tx, runActors)
  })) {
    const economy = await readEconomy({ code: offer.activation, amount: 1 })
    const shared = {
      effectId: offer.effectId,
      offerIndex: offer.offerIndex,
      holderActorId: offer.holderActorId,
      activation: offer.activation,
      warnings: economy.warnings
    }
    if (offer.kind === 'MOVE_HELD_EFFECT') {
      effectOffers.push({ ...shared, kind: offer.kind, range: offer.range })
      continue
    }
    const carrier = effectsByHolder
      .get(offer.holderActorId)
      ?.find(({ id }) => id === offer.effectId)?.definition
    const grant =
      carrier?.schemaVersion === 2
        ? carrier.stateContributions.find((contribution) => contribution.kind === 'MODIFIER_GRANT')
        : undefined
    const { invocation } = offer.effect
    effectOffers.push({
      ...shared,
      kind: offer.kind,
      actionId: repeatPathActionId(actor.id, offer.effectId, offer.offerIndex),
      label:
        grant && !(grant.sourceHidden && membership.role !== 'OWNER')
          ? grant.sourceLabel
          : 'Repeat',
      ...(offer.castLevel === undefined ? {} : { castLevel: offer.castLevel }),
      ...('savingThrow' in invocation &&
        invocation.savingThrow.dcMethod === 'FIXED_DC' && { dc: invocation.savingThrow.baseDc })
    })
  }
  const attackActionThisTurn =
    openAttackAction && openAttackAction.turnSequence === state.turnSequence
      ? openAttackAction
      : null
  const lastAttack = attackActionThisTurn?.attacks.at(-1)
  return encounterActionChoicesDtoSchema.parse({
    encounterId: state.id,
    encounterVersion: state.version,
    actorId: actor.id,
    openAttackAction:
      attackActionThisTurn && lastAttack
        ? {
            made: attackActionThisTurn.attacks.length,
            total: attackSlotTotal(attackActionThisTurn.alternatives),
            complete: !encounterAttackActionStanding(attackActionThisTurn).incomplete,
            lastActionId: lastAttack.actionId,
            lastTargetIds: lastAttack.targetIds
          }
        : null,
    actions,
    defaultActionId: encounterDefaultAttackActionId({
      choices: actions.map((action) => ({
        id: action.id,
        available: action.warnings.length === 0,
        continuesAttack: action.attackSlot !== null,
        ...(itemBindings.get(action.id) ?? {
          itemId: null,
          activationCode: null,
          triggerCode: null
        })
      })),
      hands: resolveHandOccupancy(
        encounterActorHeldItems({
          actor: creature ?? actor,
          characterFacts: actorTarget?.characterFacts ?? null
        })
      ),
      lastAttackActionId: lastAttack?.actionId ?? null
    }),
    unavailableActions,
    basicActionChoices,
    escapes,
    heldGrantEnds,
    effectOffers,
    releases,
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

/**
 * The holds the Run's acting actor may break for a creature within reach of it (ATTACK-7.9),
 * measured on the Scene the Run is bound to; none when the Run has no Scene.
 */
async function readEncounterRescues(
  tx: EncounterTurnReadTransaction,
  state: ReturnType<typeof readRunState>,
  actor: { id: string },
  runActors: Awaited<ReturnType<typeof readRunActors>>
) {
  const activeEffectsByActorId = await readActiveEffectsByActorId(tx, state.id, runActors)
  return findEncounterRescues({
    actorId: actor.id,
    activeEffectsByActorId,
    scene: await readEncounterBoundSceneTokens(tx, state, tx.ports.sceneReaders)
  })
}

/** The holds `sourceActorIds` apply in the Run, each labelled for the member who may release it. */
async function readHeldRelationships(
  tx: EncounterTurnReadTransaction,
  input: {
    state: ReturnType<typeof readRunState>
    membership: CampaignAuthority['membership']
    sourceActorIds: ReadonlySet<string>
  }
): Promise<
  (Omit<EncounterHeldRelationshipDto, 'drag'> & { drags: boolean; occupiesHand: boolean })[]
> {
  const { state, membership, sourceActorIds } = input
  const runActors = await readRunActors(tx, state)
  const activeEffectsByActorId = await readActiveEffectsByActorId(tx, state.id, runActors)
  return encounterRelationships(activeEffectsByActorId)
    .filter(({ sourceActorId }) => sourceActorIds.has(sourceActorId))
    .map(({ sourceActorId, actorId: heldActorId, effect, contribution }) => {
      const held = runActors.find((candidate) => candidate.id === heldActorId)
      return {
        sourceActorId,
        heldActorId,
        activeEffectId: effect.id,
        label:
          held && (membership.role === 'OWNER' || held.public)
            ? `Release ${held.label}`
            : 'Release a creature',
        drags: contribution.modules.some(({ kind }) => kind === 'TARGET_DRAGGED'),
        occupiesHand: contribution.modules.some(({ kind }) => kind === 'SOURCE_OCCUPIES_HAND')
      }
    })
}

/**
 * The holds the member's creatures source, released for no action on any turn (D152); the GM's
 * are every hold. A Run without assisted play offers none.
 */
export async function readEncounterHeldRelationships(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<unknown>
): Promise<EncounterHeldRelationshipDto[]> {
  const { campaign, membership } = input
  const state = readRunState(input.run)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (state.status !== 'ACTIVE' || state.automationMode === 'MANUAL') return []
  const actors = await readRunActors(tx, state)
  const holds = await readHeldRelationships(tx, {
    state,
    membership,
    sourceActorIds: await readEncounterControlledActorIds(tx, { campaign, membership, actors })
  })
  const targets = await loadMovementTargets(tx, {
    state,
    campaign,
    targetActorIds: [
      ...new Set(
        holds
          .filter(({ drags }) => drags)
          .flatMap(({ sourceActorId, heldActorId }) => [sourceActorId, heldActorId])
      )
    ]
  })
  const sizeOf = (actorId: string) => {
    const target = targets.get(actorId)
    return target ? encounterActorEffectiveSize(target) : null
  }
  // The route preview prices a drag from the sizes now; settlement recomputes them (D105).
  return holds.map(({ drags, occupiesHand: _occupiesHand, ...hold }) => ({
    ...hold,
    drag: drags
      ? {
          doublesCost: encounterDragDoublesCost(sizeOf(hold.sourceActorId), [
            sizeOf(hold.heldActorId)
          ])
        }
      : null
  }))
}

/** The ammunition in stock a weapon attack may fire, for the client to pick from; none for a weapon without ammunition. */
function ammunitionChoices(
  equipment: Parameters<typeof ammunitionInStock>[0] | undefined,
  inventory: Parameters<typeof ammunitionInStock>[1]
) {
  if (!equipment?.ammunitionEquipmentId) return {}
  return {
    ammunition: ammunitionInStock(equipment, inventory).map(
      ({ itemInstanceId, label, quantity }) => ({
        itemInstanceId,
        label,
        quantity
      })
    )
  }
}

/** The items of one target the Run's acting actor may use a chosen-item action on. */
export async function readEncounterActionItemChoices(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterActionItemChoicesInputDto>
): Promise<EncounterActionItemChoicesDto> {
  const { request } = input
  const current = await readActionChoicesRun(tx, input)
  if (!current) throw new Error('Encounter action choices are stale or unavailable.')
  const { state, actor, campaign, membership } = current
  const [actors, target] = await Promise.all([
    readRunActors(tx, state),
    readRunActor(tx, state, request.targetActorId)
  ])
  await requireTargetSeenByMember(tx, { encounterId: state.id, target, membership })
  const prepared = await prepareActionMechanics(tx, {
    state,
    campaign,
    actors,
    actor,
    target,
    actionId: request.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: true
  })
  const plan =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.entry.compilation.activeEffectPlan?.chosenItem
      : null
  if (!plan) throw new Error('This action is not used on an item.')
  const facts = prepared.targetFacts.characterFacts
  const creatureItems = target.kind === 'CHARACTER' ? [] : snapshotCreatureEquipmentSources(target)
  return encounterActionItemChoicesDtoSchema.parse({
    items: listEncounterChosenItems({ plan, target: prepared.targetFacts }).map(({ item }) => {
      const owned = facts?.prepared.character.state.equipment.inventory.find(
        ({ id }) => id === item.itemInstanceId
      )
      return {
        id: item.itemInstanceId,
        label:
          owned?.customName ??
          facts?.prepared.resolution.registry.equipment.find(({ id }) => id === item.equipmentId)
            ?.label ??
          creatureItems.find(({ loadoutEntryId }) => loadoutEntryId === item.itemInstanceId)
            ?.compiled.label ??
          'Unknown item'
      }
    })
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
          label: item.compiled.label
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
