import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterCharacterRow } from './characterPlay.js'
import { readRunActor } from './documents.js'
import { listStateZones } from './maintainedStateZones.js'
import {
  readCharacterEffect,
  readEncounterEffect,
  readMaintainedStatesByDefinition
} from './effectStore.js'

/**
 * Reads each owner capture the command sealed (each from the source or the target, once) and adds
 * the Characters those owners name to `characterIds`, which the read fence then covers.
 */
export async function readMaintenanceOwnerRequests(input: {
  requests: LiveSessionEncounterActionCommitInput['maintenanceOwners']
  actorIds: readonly string[]
  characterIds: Set<string>
  read(
    request: LiveSessionEncounterActionCommitInput['maintenanceOwners'][number]
  ): Promise<unknown>
}) {
  const seen = new Set<string>()
  for (const request of input.requests) {
    const key = checksumCanonicalJson(request)
    if (!input.actorIds.includes(request.actorId) || seen.has(key))
      throw new Error('Live Session maintenance owner scope mismatch.')
    seen.add(key)
    await input.read(request)
    if (request.owner.kind === 'CHARACTER') input.characterIds.add(request.owner.characterId)
  }
}

/** The private caller authorizes the GM or an issued response/movement scope, Session epoch and exact Run. */
export async function readEncounterMaintenanceCapture(
  ctx: EncounterReadTransaction,
  state: EncounterRunState,
  request: Extract<
    LiveSessionEncounterRulesRequest,
    {
      kind:
        | 'MAINTENANCE_SLOT'
        | 'MAINTENANCE_STATES'
        | 'MAINTENANCE_DEPENDENTS'
        | 'MAINTENANCE_OWNER'
        | 'MAINTENANCE_OWNER_EFFECTS'
    }
  >,
  readDependentPage: (input: {
    encounterId: string
    maintainedStateId: string
    ownerKind: Extract<
      LiveSessionEncounterRulesRequest,
      { kind: 'MAINTENANCE_DEPENDENTS' }
    >['ownerKind']
    cursor: string | null
  }) => Promise<
    Omit<
      Extract<LiveSessionEncounterRulesResponse, { kind: 'MAINTENANCE_DEPENDENTS' }>,
      'kind' | 'revisions'
    >
  >
) {
  await readRunActor(ctx, state, request.actorId)
  const states = await readMaintainedStatesByDefinition(ctx, {
    encounterId: state.id,
    ownerActorId: request.actorId,
    maintenanceDefinitionId: request.definitionId
  })
  if (request.kind === 'MAINTENANCE_STATES') return { kind: request.kind, states }
  const maintained =
    request.stateId === undefined
      ? (states[0] ?? null)
      : (states.find(({ id }) => id === request.stateId) ?? null)
  if (request.kind === 'MAINTENANCE_SLOT') {
    const zones = maintained
      ? await listStateZones(ctx, { encounterId: state.id, stateId: maintained.id })
      : []
    return { kind: request.kind, state: maintained, zoneIds: zones.map((zone) => zone.id) }
  }
  if (!maintained || maintained.id !== request.stateId)
    throw new Error('Maintained effect slot changed during preparation.')

  if (request.kind === 'MAINTENANCE_DEPENDENTS') {
    return {
      kind: request.kind,
      ...(await readDependentPage({
        encounterId: state.id,
        maintainedStateId: maintained.id,
        ownerKind: request.ownerKind,
        cursor: request.cursor
      }))
    }
  }

  const { owner } = request
  let character: EncounterCharacterRow | null = null
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
    character = await ctx.ports.readCharacterRow(owner.characterId)
    if (
      !character ||
      character.status !== 'ACTIVE' ||
      ctx.ports.readCharacterRecord(character).systemId !== state.gameSystemId
    )
      throw new Error('Maintained-effect Character owner is unavailable.')
    ctx.ports.readCharacterSheetState(character)
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
