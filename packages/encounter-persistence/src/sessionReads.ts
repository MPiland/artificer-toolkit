import {
  encounterActorSidesDtoSchema,
  type EncounterActorSidesDto,
  type EncounterDecisionSettlementDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type EncounterPreparedPendingListDto,
  type EncounterSessionStateDto,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/api/encounterData'
import { projectPlayerEncounterProjection } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { zoneConcealedFrom } from '@artificer-toolkit/rules-runtime/encounterZoneConcealment'
import { readEncounterControlledActorIds } from './actorController.js'
import { readRunProjectionFacts } from './actorProjectionFacts.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readCampaignRunState, readRunActors, readRunState } from './documents.js'
import { halfSpeedFieldsOf } from './halfSpeedFields.js'
import { readSceneSpatialRows } from './sceneSpatialRows.js'
import { readSessionAuras } from './sessionAuras.js'
import { readSessionMovementCostZones } from './sessionMovementCostZones.js'
import { projectEncounterFacts } from './nativeProjection.js'
import { readEncounterWaitingOn, readPendingRunDecision } from './pendingReads.js'
import { readEncounterProjectionViewer } from './playerViewer.js'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'
import { readTurnMovementView } from './turnMovement.js'

type EncounterProjection = EncounterGmProjectionDto | EncounterPlayerProjectionDto
type Run = EncounterDocument<'encounterRuns'>
type Campaign = EncounterDocument<'campaigns'>
type Membership = EncounterDocument<'campaignMemberships'>

/**
 * A Run as one member reads it: the GM projection for the GM, the player projection for everyone
 * else, with each live Character's Campaign conditions layered on. Conditions carry type IDs only;
 * web names them from the System vocabulary. Convex's reads and the room's pushed session share it, so both show a member the same
 * Run. The GM reads a completed Run's Characters as they were when it completed.
 */
export async function presentEncounterRun(
  ctx: EncounterReadTransaction,
  row: Run,
  campaign: Campaign,
  viewer: Pick<Membership, 'role' | 'userId'>
): Promise<EncounterProjection> {
  const { role } = viewer
  const state = readCampaignRunState(row, campaign)
  const facts = await readRunProjectionFacts(ctx, state)
  const { actors } = facts
  if (row.status === 'COMPLETED' && role === 'OWNER')
    return projectEncounterFacts(
      ctx,
      state,
      facts,
      await readEncounterCharacterStates(ctx, state, actors)
    )
  const characterStates = await readEncounterCharacterStates(ctx, state, actors, {
    viewer: role === 'OWNER' ? 'CAMPAIGN_OWNER' : 'CHARACTER_OWNER',
    read: (characterId) => ctx.ports.readCampaignCharacterConditions(campaign, characterId)
  })
  const projection = await projectEncounterFacts(ctx, state, facts, characterStates)
  if (role === 'OWNER') return projection
  return projectPlayerEncounterProjection(
    projection,
    await readEncounterProjectionViewer(ctx, projection, viewer)
  )
}

/**
 * The tabletop's snapshot for one member: the ACTIVE Run, its pending decision, whom the table
 * waits on and the member's turn movement. `row` is the ACTIVE Run, or null when there is none.
 */
export async function readEncounterSessionState(
  ctx: EncounterReadTransaction,
  input: { row: Run | null; campaign: Campaign; membership: Membership }
): Promise<EncounterSessionStateDto> {
  const { row, campaign, membership } = input
  if (!row)
    return {
      encounter: null,
      pending: null,
      waitingOn: null,
      turnMovement: [],
      halfSpeedFields: [],
      auras: [],
      movementCostZones: [],
      placedZones: [],
      pendingZoneSightings: []
    }
  const pending = await readPendingRunDecision(ctx, row, campaign, membership)
  const encounter = await presentEncounterRun(ctx, row, campaign, membership)
  const spatialRows = await readMemberSpatialRows(ctx, { row, campaign, membership })
  return {
    encounter,
    pending,
    waitingOn: pending ? null : await readEncounterWaitingOn(ctx, row, campaign),
    turnMovement: await readTurnMovementView(ctx, { row, campaign, membership }),
    halfSpeedFields: halfSpeedFieldsOf(spatialRows),
    auras: await readSessionAuras(ctx, {
      encounterId: row.id,
      rows: spatialRows,
      seenActorIds: new Set(encounter.actors.map((actor) => actor.id))
    }),
    movementCostZones: await readSessionMovementCostZones(ctx, {
      encounterId: row.id,
      rows: spatialRows,
      actors: encounter.actors
    }),
    placedZones: spatialRows.flatMap(({ id, placement, spatialState }) =>
      placement.anchorKind === 'FIXED' &&
      placement.geometry.frame === 'SCENE_ABSOLUTE' &&
      (placement.visibility === 'PUBLIC' || spatialState.revealed)
        ? [
            {
              id,
              label: placement.label ?? null,
              shape: placement.geometry.shape,
              spotDc: (membership.role === 'OWNER' && spatialState.concealment?.spotDc) || null,
              disarmDc: (membership.role === 'OWNER' && spatialState.disarmDc) || null
            }
          ]
        : []
    ),
    pendingZoneSightings:
      membership.role === 'OWNER'
        ? spatialRows.flatMap(({ id, spatialState }) =>
            (spatialState.concealment?.sightings ?? []).flatMap(({ actorId, status }) =>
              status === 'PROMPTED' ? [{ spatialEffectId: id, actorId }] : []
            )
          )
        : []
  }
}

/**
 * The bound Scene's placed zones the member may read: a zone concealed from the member is left
 * out (MOVE-3.3), so every zone read this session state makes redacts alike. The member's
 * controlled actors are read only when a zone is concealed.
 */
async function readMemberSpatialRows(
  ctx: EncounterReadTransaction,
  input: { row: Run; campaign: Campaign; membership: Membership }
) {
  const { row, membership } = input
  const rows = await readSceneSpatialRows(ctx, row.id)
  if (membership.role === 'OWNER' || !rows.some((zone) => zone.spatialState.concealment))
    return rows
  const controlledActorIds = await readEncounterControlledActorIds(ctx, {
    ...input,
    actors: await readRunActors(ctx, readRunState(row))
  })
  return rows.filter(
    (zone) => !zoneConcealedFrom(zone.spatialState, { kind: 'PLAYER', controlledActorIds })
  )
}

/** The decision kinds a paused START can wait on before the Run is ACTIVE. */
function isPreStartDecision(
  pending: PendingEncounterRuleOccurrenceSummaryDto | null
): pending is PendingEncounterRuleOccurrenceSummaryDto {
  return (
    pending?.kind === 'INITIATIVE_DECLARATION' ||
    pending?.kind === 'INITIATIVE_EVIDENCE' ||
    pending?.kind === 'INITIATIVE_ORDER' ||
    pending?.kind === 'RECHARGE_EVIDENCE'
  )
}

/**
 * D87: whether the member may read the Run by ID. The GM reads every Run; a player reads only the
 * ACTIVE Run, or a PREPARED Run paused on any START decision addressed to them (the pending read
 * returns a decision only to the member it is addressed to).
 */
export async function canMemberReadRun(
  ctx: EncounterReadTransaction,
  row: Run,
  campaign: Campaign,
  membership: Membership
): Promise<boolean> {
  if (membership.role === 'OWNER' || row.status === 'ACTIVE') return true
  return (
    row.status === 'PREPARED' &&
    (await readPendingRunDecision(ctx, row, campaign, membership)) !== null
  )
}

/** The PREPARED Runs paused on a START decision the member can see, each with that decision. */
export async function readEncounterPreparedPending(
  ctx: EncounterReadTransaction,
  input: { rows: readonly Run[]; campaign: Campaign; membership: Membership }
): Promise<EncounterPreparedPendingListDto> {
  const { rows, campaign, membership } = input
  const visible: EncounterPreparedPendingListDto = []
  for (const row of rows) {
    const pending = await readPendingRunDecision(ctx, row, campaign, membership)
    if (isPreStartDecision(pending))
      visible.push({
        encounter: await presentEncounterRun(ctx, row, campaign, membership),
        pending
      })
  }
  return visible
}

/** The GM's side bindings for the Run's actors. */
export async function readEncounterActorSides(
  ctx: EncounterReadTransaction,
  row: Run,
  campaign: Campaign
): Promise<EncounterActorSidesDto> {
  const state = readCampaignRunState(row, campaign)
  const { actors } = await readRunProjectionFacts(ctx, state)
  if (actors.some((actor) => !state.sides.some((side) => side.id === actor.sideId)))
    throw new Error('Encounter actor side is unavailable.')
  return encounterActorSidesDtoSchema.parse({
    encounterId: row.id,
    version: row.version,
    sides: state.sides,
    actors: actors.map((actor) => ({ id: actor.id, sideId: actor.sideId }))
  })
}

/**
 * Who settled a decision the member was shown (D39): the GM's skip or an answer. Null while that
 * occurrence version is still pending.
 */
export async function readEncounterDecisionSettlement(
  ctx: EncounterReadTransaction,
  input: { encounterId: string; occurrenceId: string; occurrenceVersion: number }
): Promise<EncounterDecisionSettlementDto> {
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', input.occurrenceId))
    .unique()
  if (!occurrence || occurrence.encounterId !== input.encounterId)
    throw new Error('Rule occurrence is unavailable.')
  if (occurrence.state === 'PENDING' && occurrence.version === input.occurrenceVersion) return null
  const skip = await ctx.db
    .query('encounterDecisionSkips')
    .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
      q
        .eq('encounterId', input.encounterId)
        .eq('occurrenceId', occurrence.id)
        .eq('occurrenceVersion', input.occurrenceVersion)
    )
    .unique()
  return skip ? 'GM_SKIP' : 'ANSWER'
}
