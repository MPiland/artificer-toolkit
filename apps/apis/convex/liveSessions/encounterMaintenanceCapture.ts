import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readCharacterRecord, readCharacterSheetState } from '../characters/documents'
import { readRunActor } from '@artificer-toolkit/encounter-persistence/documents'
import { readCharacterEffect, readEncounterEffect, readMaintainedState } from '../rules/effectStore'

/** The private caller authorizes the GM or an issued response/movement scope, Session epoch and exact Run. */
export async function readEncounterMaintenanceCapture(
  ctx: QueryCtx,
  state: EncounterRunState,
  request: Extract<
    LiveSessionEncounterRulesRequest,
    {
      kind:
        | 'MAINTENANCE_SLOT'
        | 'MAINTENANCE_DEPENDENTS'
        | 'MAINTENANCE_OWNER'
        | 'MAINTENANCE_OWNER_EFFECTS'
    }
  >
) {
  await readRunActor(ctx, state, request.actorId)
  const row = await ctx.db
    .query('encounterMaintainedEffectStates')
    .withIndex('by_encounter_owner_definition', (q) =>
      q
        .eq('encounterId', state.id)
        .eq('ownerActorId', request.actorId)
        .eq('maintenanceDefinitionId', request.definitionId)
    )
    .unique()
  const maintained = row ? readMaintainedState(row) : null
  if (request.kind === 'MAINTENANCE_SLOT') return { kind: request.kind, state: maintained }
  if (!maintained || maintained.id !== request.stateId)
    throw new Error('Maintained effect slot changed during preparation.')

  if (request.kind === 'MAINTENANCE_DEPENDENTS') {
    // One native pagination call per capture; neither table is read in full.
    const page =
      request.ownerKind === 'CHARACTER'
        ? await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_state_source_owner_order', (q) =>
              q.eq('maintainedEffectStateId', maintained.id).eq('sourceEncounterId', state.id)
            )
            .paginate({ numItems: 4, cursor: request.cursor })
        : await ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_state_encounter_owner_order', (q) =>
              q.eq('maintainedEffectStateId', maintained.id).eq('encounterId', state.id)
            )
            .paginate({ numItems: 4, cursor: request.cursor })
    if (
      page.pageStatus === 'SplitRequired' ||
      (!page.isDone && page.continueCursor === request.cursor)
    )
      throw new Error('Maintained effect capture page is incomplete.')
    const effects = page.page.map((effect) =>
      'characterId' in effect ? readCharacterEffect(effect) : readEncounterEffect(effect)
    )
    return {
      kind: request.kind,
      effects,
      continueCursor: page.isDone ? null : page.continueCursor
    }
  }

  const { owner } = request
  let character: Doc<'characters'> | null = null
  if (owner.kind === 'CHARACTER') {
    const dependent = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_state_source_owner_order', (q) =>
        q
          .eq('maintainedEffectStateId', maintained.id)
          .eq('sourceEncounterId', state.id)
          .eq('characterId', owner.characterId)
      )
      .first()
    if (!dependent) throw new Error('Maintained effect owner is not a current dependent.')
    readCharacterEffect(dependent)
    // A detached owner is authorized through this live dependent, never an arbitrary Character ID.
    character = await ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', owner.characterId))
      .unique()
    if (
      !character ||
      character.status !== 'ACTIVE' ||
      readCharacterRecord(character).systemId !== state.gameSystemId
    )
      throw new Error('Maintained-effect Character owner is unavailable.')
    readCharacterSheetState(character)
  } else {
    if (owner.encounterId !== state.id)
      throw new Error('Maintained effect owner belongs to another Encounter.')
    const dependent = await ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_state_encounter_owner_order', (q) =>
        q
          .eq('maintainedEffectStateId', maintained.id)
          .eq('encounterId', state.id)
          .eq('targetActorId', owner.targetActorId)
      )
      .first()
    if (!dependent) throw new Error('Maintained effect owner is not a current dependent.')
    readEncounterEffect(dependent)
    await readRunActor(ctx, state, owner.targetActorId)
  }
  if (request.kind === 'MAINTENANCE_OWNER') return { kind: request.kind, owner, character }

  const after = request.afterEffectId
  const effects =
    owner.kind === 'CHARACTER'
      ? (
          await ctx.db
            .query('characterActiveRuleEffects')
            .withIndex('by_characterId_id', (q) =>
              after === null
                ? q.eq('characterId', owner.characterId)
                : q.eq('characterId', owner.characterId).gt('id', after)
            )
            .take(4)
        ).map(readCharacterEffect)
      : (
          await ctx.db
            .query('encounterActiveRuleEffects')
            .withIndex('by_encounterId_targetActorId_id', (q) =>
              after === null
                ? q.eq('encounterId', state.id).eq('targetActorId', owner.targetActorId)
                : q
                    .eq('encounterId', state.id)
                    .eq('targetActorId', owner.targetActorId)
                    .gt('id', after)
            )
            .take(4)
        ).map(readEncounterEffect)
  return {
    kind: request.kind,
    owner,
    effects,
    continueAfter: effects.length === 4 ? effects[3]!.id : null
  }
}
