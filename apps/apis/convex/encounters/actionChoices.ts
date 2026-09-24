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
  type EncounterActionChoicesResponseDto,
  type EncounterOptionalActionChoicesDto,
  type GetEncounterActionChoicesInputDto
} from '@artificer-toolkit/schema/api/encounterActionChoices'
import { activeOptionalCombatDefinitions } from '@artificer-toolkit/schema/shared/optionalCombat'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { snapshotCreatureEquipmentSources } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import { query, type QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { requireSession } from '../campaigns/sessionDocuments'
import { requireSystem } from '../content/systemDocuments'
import { projectCharacterSheetFacts } from '../characters/sheetPreparation'
import { readRunActor, readRunActors, readRunProjection, readRunState } from './documents'
import { loadMovementTargets } from './movementTargets'
import { readNativeDisarmSelection } from './actionDisarmSelection'

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
  if (membership.role !== 'OWNER') throw new Error('Campaign not found.')
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  const session = await requireSession(ctx, campaign.id, state.sessionId)
  if (session.status !== 'OPEN') throw new Error('Finished Sessions cannot change Encounters.')
  if (
    state.status !== 'ACTIVE' ||
    state.automationMode === 'MANUAL' ||
    state.version !== input.expectedVersion ||
    state.currentActorId !== input.actorId
  )
    return null
  const actor = await readRunActor(ctx, state, input.actorId)
  return { state, actor, campaign }
}

export const get = query({
  args: zodToConvexFields(getEncounterActionChoicesInputDtoSchema.shape),
  returns: choicesValidator,
  handler: async (ctx, args): Promise<EncounterActionChoicesResponseDto> => {
    const input = getEncounterActionChoicesInputDtoSchema.parse(args)
    const current = await readActionChoicesRun(ctx, input)
    if (!current) return null
    const { state, actor } = current
    let actions: EncounterActionChoiceDto[] = []
    if (actor.kind === 'CHARACTER') {
      const target = (
        await loadMovementTargets(ctx, {
          encounterId: state.id,
          expectedEncounterVersion: state.version,
          targetActorIds: [actor.id],
          includeReactionSources: true
        })
      ).get(actor.id)
      const facts = target?.characterFacts
      const mechanics = target?.characterReactionSource?.mechanics
      if (!facts || !mechanics || !target.effectiveRulePolicyOutput)
        throw new Error('Encounter Character actions are unavailable.')
      const sheet = projectCharacterSheetFacts({
        ...facts,
        ruleEvaluation: { ...facts.ruleEvaluation, output: target.effectiveRulePolicyOutput }
      }).sheet
      actions = sheet.actions.items
        .filter(
          (action) =>
            action.availability.status === 'AVAILABLE' &&
            action.rollable &&
            action.mechanic &&
            mechanics.compiledActionEntryPoints.some(
              (entry) =>
                entry.kind === 'CHARACTER_ACTION' &&
                entry.actionId === action.id &&
                entry.compilation.kind === 'COMPILED'
            )
        )
        .map((action) => ({
          id: action.id,
          label: action.label,
          ...(action.sourceLabel ? { sourceLabel: action.sourceLabel } : {}),
          ...(action.mechanic?.rangeLabel ? { rangeLabel: action.mechanic.rangeLabel } : {}),
          ...(action.mechanic?.attackBonus === undefined
            ? {}
            : { attackBonus: action.mechanic.attackBonus })
        }))
    } else if (actor.kind === 'CREATURE') {
      const system = await requireSystem(ctx, state.gameSystemId)
      actions = discoverEncounterFeatureActionCapabilities({
        actor,
        conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
        abilityDefinitions:
          'abilities' in system ? system.abilities.map(({ id, code }) => ({ id, code })) : []
      }).map((action) => ({
        id: action.actionId,
        label: action.label,
        ...(action.attackMechanic ? { attackBonus: action.attackMechanic.attackBonus } : {})
      }))
    }
    return encounterActionChoicesDtoSchema.parse({
      encounterId: state.id,
      encounterVersion: state.version,
      actorId: actor.id,
      actions,
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
    const { state, actor, campaign } = current
    const [actors, target] = await Promise.all([
      readRunActors(ctx, state),
      readRunActor(ctx, state, input.targetActorId)
    ])
    const { descriptor, definition, defenderFacts } = await readNativeDisarmSelection(ctx, {
      state,
      actors,
      actor,
      target,
      command: input,
      campaignOwnerUserId: campaign.ownerUserId
    })
    const system = await requireSystem(ctx, state.gameSystemId)
    const heldItems =
      defenderFacts.ownerState === 'CHARACTER_SHEET'
        ? defenderFacts.character.prepared.character.state.equipment.inventory.map((item) => ({
            id: item.id,
            label:
              item.customName ??
              defenderFacts.character.prepared.resolution.registry.equipment.find(
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
