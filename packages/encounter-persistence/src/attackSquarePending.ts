import {
  actionAreaSceneRequestDtoSchema,
  resolveEncounterActionInputDtoSchema,
  type ActionAreaSceneRequestDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  attackSquareCandidates,
  attackSquareChildCommand
} from '@artificer-toolkit/rules-runtime/encounterAttackSquare'
import { defeatedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readDeadCharacterIds } from './characterStates.js'
import { rejectDomain } from './domainRejections.js'
import { closePendingOccurrence } from './occurrenceClosing.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterPersistenceTransaction } from './ports.js'

type AreaSceneContext = Extract<
  LiveSessionEncounterRulesResponse,
  { kind: 'ACTION_AREA_SCENE' }
>['context']
type SquareCommand = Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }> & {
  target: Extract<
    Extract<ResolveEncounterActionInputDto, { type: 'RESOLVE_ACTION' }>['target'],
    { kind: 'SQUARE' }
  >
}

/** The occurrence's own snapshot narrowed to its square-attack context. */
export function attackSquarePendingContext(snapshot: ServerRuleExecutionPendingSnapshotDto) {
  return snapshot.snapshotKind === 'AGGREGATE_CHOICE' &&
    snapshot.applicationContext.kind === 'ENCOUNTER_ATTACK_SQUARE'
    ? snapshot.applicationContext
    : null
}

/** Reads the square-attack root and checks it against its occurrence and root command. */
export async function readNativeAttackSquarePending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  const context = snapshot && attackSquarePendingContext(snapshot)
  if (!snapshot || !context || snapshot.occurrenceId !== occurrence.id)
    throw new Error('Stored Encounter square attack pending snapshot mismatch.')
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.target.kind !== 'SQUARE' ||
    command.commandId !== occurrence.rootCommandId ||
    command.encounterId !== occurrence.encounterId ||
    command.expectedVersion !== occurrence.expectedEncounterVersion ||
    command.actorId !== context.attackerActorId ||
    checksumCanonicalJson(command) !== context.commandFingerprint
  )
    throw new Error('Stored Encounter square attack root mismatch.')
  return { snapshot, context, command }
}

/** The decision belongs to the GM alone: who stands on the square is theirs to say. */
export function projectNativeAttackSquarePending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  pending: Awaited<ReturnType<typeof readNativeAttackSquarePending>>,
  isOwner: boolean
): PendingEncounterRuleOccurrenceSummaryDto | null {
  if (!isOwner) return null
  return {
    kind: 'ATTACK_SQUARE_RESOLUTION',
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    attackerActorId: pending.context.attackerActorId,
    candidateActorIds: pending.context.candidates.map(({ actorId }) => actorId),
    allowedResponses: ['ATTACK_SQUARE_OCCUPANT']
  }
}

/**
 * Verifies a freshly planned square root before it is stored: it belongs to the admitted command,
 * and the Scene and the Encounter's facts still hold exactly the creatures it was sealed with.
 */
export async function requireAttackSquarePendingRoot(
  ctx: EncounterPersistenceTransaction,
  input: {
    snapshot: ServerRuleExecutionPendingSnapshotDto
    command: SquareCommand
    fingerprint: string
    initiatorUserId: string
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
  },
  readAreaSceneInputs: (
    state: EncounterRunState,
    request: ActionAreaSceneRequestDto
  ) => Promise<AreaSceneContext>
) {
  const { snapshot, command, state } = input
  const context = attackSquarePendingContext(snapshot)
  if (
    !context ||
    context.initiatorUserId !== input.initiatorUserId ||
    context.commandFingerprint !== input.fingerprint ||
    checksumCanonicalJson(JSON.parse(context.commandJson)) !== input.fingerprint ||
    context.attackerActorId !== command.actorId ||
    context.scene.sceneId !== command.target.sceneId ||
    context.scene.sceneVersion !== command.target.expectedSceneVersion ||
    snapshot.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
    !state.actorIds.includes(context.attackerActorId)
  )
    throw new Error('Live Session pending square attack root mismatch.')
  const scene = await readAreaSceneInputs(
    state,
    actionAreaSceneRequestDtoSchema.parse({
      actorId: command.actorId,
      sceneId: command.target.sceneId,
      expectedSceneVersion: command.target.expectedSceneVersion
    })
  )
  const candidates = attackSquareCandidates({
    point: command.target.point,
    attackerActorId: command.actorId,
    defeatedActorIds: defeatedEncounterActorIds(
      input.actors,
      await readDeadCharacterIds(ctx, input.actors)
    ),
    tokens: scene.tokens
  })
  if (
    scene.sceneId !== context.scene.sceneId ||
    scene.sceneVersion !== context.scene.sceneVersion ||
    scene.sourceToken.tokenId !== context.sourceTokenId ||
    checksumCanonicalJson(candidates) !== checksumCanonicalJson(context.candidates)
  )
    throw new Error('Live Session pending square attack Scene mismatch.')
}

/**
 * The GM's ruling on who stands on the square. Closes the square occurrence and returns the
 * ordinary attack on that creature, which the caller runs in the same write set.
 */
export async function answerAttackSquare(
  ctx: EncounterPersistenceTransaction,
  command: ResolveRuleOccurrenceInputDto,
  userId: string
): Promise<ResolveEncounterActionInputDto> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const { membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  const occurrence = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', command.occurrenceId.toLowerCase()))
    .unique()
  if (!occurrence || occurrence.encounterId !== run.id || occurrence.campaignId !== run.campaignId)
    throw new Error('Rule occurrence is unavailable.')
  if (occurrence.state !== 'PENDING') rejectDomain('DECISION_NOT_PENDING')
  if (
    run.version !== command.expectedVersion ||
    occurrence.version !== command.expectedOccurrenceVersion
  )
    rejectDomain('VERSION_STALE')
  const { context, command: root } = await readNativeAttackSquarePending(ctx, occurrence)
  if (command.resolution.kind !== 'ATTACK_SQUARE_OCCUPANT')
    throw new Error('The square attack requires the creature standing on it.')
  const child = attackSquareChildCommand({
    command: root,
    context,
    occurrenceId: occurrence.id,
    occupantActorId: command.resolution.actorId.toLowerCase(),
    expectedVersion: run.version
  })
  await closePendingOccurrence(ctx, occurrence, 'COMPLETED')
  return child
}
