import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterActionChoicesDtoSchema,
  encounterActionChoicesResponseDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  getEncounterActionChoicesInputDtoSchema,
  getEncounterOptionalActionChoicesInputDtoSchema,
  type EncounterActionChoiceDto,
  type EncounterActionChoicesDto,
  type EncounterActionChoicesResponseDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { snapshotCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { encounterLegendaryActionFeatureIds } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { isEncounterActorDefeated } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { evaluateEncounterCharacterActionWieldConflict } from '@artificer-toolkit/rules-runtime/encounterWieldConflict'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSystem } from '../content/systemDocuments'
import { projectCharacterSheetFacts } from '../characters/sheetPreparation'
import {
  readRunActor,
  readRunActors,
  readRunProjection,
  readRunState
} from '@artificer-toolkit/encounter-persistence/documents'
import { loadMovementTargets } from './movementTargets'
import { readNativeDisarmSelection } from './actionDisarmSelection'
import { requireEncounterActorControl } from './actorController'
import { evaluateNativeActionEconomy } from './actionEconomy'
import { encounterActionEconomyWarnings } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import type { EncounterRuleWarningDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { rejectDomain } from '@artificer-toolkit/encounter-persistence/domainRejections'
import { readDefinitionRoot } from '../content/definitionStore'
import { requireEncounterBasicActionDefinition } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { BASIC_ACTION_DEFINITION_FAMILY_KEY } from '@artificer-toolkit/schema/shared/reusableDefinitionIdentity'
import { MAX_BASIC_ACTION_CHOICES } from '@artificer-toolkit/schema/api/encounterActionChoices'

/**
 * The System's basic-action catalogue (Q11): its published platform entries, by label. User-authored
 * Systems are deferred, so no user-owned entry joins a catalogue.
 */
async function readSystemBasicActions(ctx: QueryCtx, gameSystemId: string, userId: string) {
  const rows = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
      q
        .eq('gameSystemId', gameSystemId)
        .eq('ownerUserId', undefined)
        .eq('definitionFamilyKey', BASIC_ACTION_DEFINITION_FAMILY_KEY)
    )
    .take(MAX_BASIC_ACTION_CHOICES + 1)
  if (rows.length > MAX_BASIC_ACTION_CHOICES)
    throw new Error('The basic-action catalogue exceeds its bound.')
  const entries = await Promise.all(
    rows.map(async (row) => {
      const root = await readDefinitionRoot(ctx, row.id, userId)
      return root?.sourceKind === 'PLATFORM' && root.current
        ? [requireEncounterBasicActionDefinition({ gameSystemId }, root.current)]
        : []
    })
  )
  return entries.flat()
}

const choicesValidator: Validator<EncounterActionChoicesResponseDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterActionChoicesResponseDto>>(
    encounterActionChoicesResponseDtoSchema
  )
const optionalChoicesValidator: Validator<EncounterOptionalActionChoicesDto, 'required', string> =
  zodToConvex<z.core.$ZodType<EncounterOptionalActionChoicesDto>>(
    encounterOptionalActionChoicesDtoSchema
  )

async function readActionChoicesRun(ctx: QueryCtx, input: GetEncounterActionChoicesInputDto) {
  const { userId } = await requireIdentity(ctx)
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  readRunProjection(run)
  const { campaign, membership } = await requireCampaignAuthority(ctx, state.campaignId, userId)
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (
    state.status !== 'ACTIVE' ||
    state.automationMode === 'MANUAL' ||
    state.version !== input.expectedVersion ||
    state.currentActorId !== input.actorId
  )
    return null
  const actor = await readRunActor(ctx, state, input.actorId)
  // A player sees the choices of an actor they control; creature actions included only then.
  await requireEncounterActorControl(ctx, { campaign, membership, actor })
  // A defeated actor has no choices (D63).
  if (isEncounterActorDefeated(actor)) return null
  return { state, actor, campaign, membership }
}

export const get = query({
  args: zodToConvexFields(getEncounterActionChoicesInputDtoSchema.shape),
  returns: choicesValidator,
  handler: async (ctx, args): Promise<EncounterActionChoicesResponseDto> => {
    const input = getEncounterActionChoicesInputDtoSchema.parse(args)
    const current = await readActionChoicesRun(ctx, input)
    if (!current) return null
    const { state, actor, campaign } = current
    const actorTarget =
      actor.kind === 'CHARACTER'
        ? (
            await loadMovementTargets(ctx, {
              encounterId: state.id,
              expectedEncounterVersion: state.version,
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
      const read = evaluateNativeActionEconomy(ctx, {
        actor,
        state,
        userId: campaign.ownerUserId,
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
      const sheet = projectCharacterSheetFacts({
        ...facts,
        ruleEvaluation: { ...facts.ruleEvaluation, output: policyOutput }
      }).sheet
      const available = sheet.actions.items.filter(
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
              ...(await readEconomyWarnings(
                candidate?.mechanicFacts.invocation.activation ?? null
              )),
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
      const system = await requireSystem(ctx, state.gameSystemId)
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
    const basicActions = await Promise.all(
      (await readSystemBasicActions(ctx, state.gameSystemId, campaign.ownerUserId)).map(
        async ({ definition, document }) => ({
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
        })
      )
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
})

export const optional = query({
  args: zodToConvexFields(getEncounterOptionalActionChoicesInputDtoSchema.shape),
  returns: optionalChoicesValidator,
  handler: async (ctx, args): Promise<EncounterOptionalActionChoicesDto> => {
    const input = getEncounterOptionalActionChoicesInputDtoSchema.parse(args)
    if (input.sceneContext)
      input.sceneContext = {
        ...input.sceneContext,
        sceneId: input.sceneContext.sceneId.toLowerCase(),
        sourceTokenId: input.sceneContext.sourceTokenId.toLowerCase(),
        targetTokenId: input.sceneContext.targetTokenId.toLowerCase()
      }
    const current = await readActionChoicesRun(ctx, input)
    if (!current) throw new Error('Encounter action choices are stale or unavailable.')
    const { state, actor, campaign, membership } = current
    const [actors, target] = await Promise.all([
      readRunActors(ctx, state),
      readRunActor(ctx, state, input.targetActorId)
    ])
    if (membership.role !== 'OWNER' && !target.public) rejectDomain('TARGET_UNAVAILABLE')
    const { descriptor, definition, targetCharacter } = await readNativeDisarmSelection(ctx, {
      state,
      actors,
      actor,
      target,
      command: input,
      campaignOwnerUserId: campaign.ownerUserId
    })
    const system = await requireSystem(ctx, state.gameSystemId)
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
})
