import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { hydrateStagedState } from '@artificer-toolkit/rules-runtime/encounterInitiativeStaging'
import { isSettledEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { skippedEncounterActorIds } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import type { EncounterReadPorts } from './ports.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'
import { readDeadCharacterIds } from './characterStates.js'
import { readRunActors } from './documents.js'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import { rejectDomain } from './domainRejections.js'

/** Validates the current normalized turn before either native or DO terminal persistence. */
export async function readNativeTurnSettlement(input: {
  ctx: EncounterWriteContext & { readonly ports: Pick<EncounterReadPorts, 'readCharacterPlay'> }
  encounter: EncounterDocument<'encounterRuns'>
  state: EncounterRunState
  campaign: EncounterDocument<'campaigns'>
  root: TurnCoordinatorRootDto
}) {
  const { ctx, state, campaign, encounter } = input
  const root = input.root
  const rootCommand =
    root.commandType === 'START'
      ? {
          type: 'START' as const,
          encounterId: state.id,
          commandId: root.rootCommandId,
          expectedVersion: root.expectedEncounterVersion,
          ...(root.startSystemId ? { systemId: root.startSystemId } : {})
        }
      : {
          type: 'ADVANCE_TURN' as const,
          encounterId: state.id,
          commandId: root.rootCommandId,
          expectedVersion: root.expectedEncounterVersion
        }
  if (
    root.expectedEncounterVersion !== encounter.version ||
    checksumCanonicalJson(rootCommand) !== root.commandFingerprint ||
    root.initiatorUserId !== campaign.ownerUserId ||
    root.proposedTerminalTransition.status !== 'ACTIVE' ||
    (root.commandType === 'START' && root.proposedTerminalTransition.round !== 1) ||
    (root.proposedTerminalTransition.currentActorId === null &&
      !(
        root.commandType === 'ADVANCE_TURN' &&
        root.initiative === null &&
        root.initiativeAdvance?.kind === 'ROUND_WRAP' &&
        root.initiativeAdvance.cadence === 'EACH_ROUND'
      )) ||
    (root.commandType === 'START' ? state.status !== 'PREPARED' : state.status !== 'ACTIVE') ||
    (root.outgoingTurn !== undefined && root.commandType !== 'ADVANCE_TURN')
  )
    throw new Error('Stored Encounter turn root is stale.')

  if (root.commandType === 'START') {
    // The indexed read also fences concurrent starts, including resumed pending initiative.
    const active = await ctx.db
      .query('encounterRuns')
      .withIndex('by_campaignId_status', (q) =>
        q.eq('campaignId', campaign.id).eq('status', 'ACTIVE')
      )
      .first()
    if (active) rejectDomain('ACTIVE_ENCOUNTER_EXISTS')
  }

  const durableActors = await readRunActors(ctx, state)
  const initiative = createEncounterInitiativeStore(ctx)
  const original =
    root.commandType === 'ADVANCE_TURN'
      ? await initiative.lockInitiativeRound({ encounterId: state.id, round: state.round })
      : null
  if (root.commandType === 'ADVANCE_TURN') {
    if (!original || !state.currentActorId || !root.initiativeAdvance)
      throw new Error('The normalized initiative round is unavailable.')
    validateInitiativeCursor({
      state: original,
      currentActorId: state.currentActorId,
      actors: durableActors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    // The room may also skip actors its turn transition defeats; the commit checks them (D63).
    if (
      !isSettledEncounterInitiativeAdvance({
        state: original,
        currentActorId: state.currentActorId,
        defeatedActorIds: skippedEncounterActorIds(
          durableActors,
          await readDeadCharacterIds(ctx, durableActors)
        ),
        plan: root.initiativeAdvance
      })
    )
      throw new Error('Encounter initiative advancement is stale.')
  } else if (root.initiativeAdvance !== null || !root.initiative)
    throw new Error('Initial initiative settlement is unavailable.')

  const staged = root.stagedInitiative
  if (root.initiative) {
    if (
      !staged ||
      root.initiative.round !== root.proposedTerminalTransition.round ||
      root.initiative.policySnapshotChecksum !==
        (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum) ||
      staged.stagedRoundState.round.encounterId !== state.id ||
      staged.stagedRoundState.round.round !== root.initiative.round ||
      checksumCanonicalJson([...staged.beforePin.actorIds].sort()) !==
        checksumCanonicalJson([...state.actorIds].sort()) ||
      staged.stagedRoundState.participants.some(
        (participant) =>
          durableActors.find((actor) => actor.id === participant.actorId)?.sideId !==
          participant.sideId
      ) ||
      (root.commandType === 'START'
        ? staged.beforePin.kind !== 'INITIAL_START'
        : staged.beforePin.kind !== 'EACH_ROUND' ||
          staged.beforePin.version !== state.version ||
          staged.beforePin.round !== state.round ||
          staged.beforePin.checksum !== root.initiativeAdvance?.stateChecksum)
    )
      throw new Error('Staged initiative settlement is stale.')
    validateInitiativeCursor({
      state: hydrateStagedState(staged.stagedRoundState),
      currentActorId: root.proposedTerminalTransition.currentActorId,
      actors: durableActors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    // The room opens the round past actors defeated by then (D63), so it may skip the first ones.
    if (
      root.proposedTerminalTransition.currentActorId === null ||
      !root.initiative.orderedActorIds.includes(root.proposedTerminalTransition.currentActorId)
    )
      throw new Error('Staged initiative current actor is stale.')
  } else if (staged) throw new Error('Unexpected staged initiative settlement.')
  const advance = root.initiativeAdvance
  if (advance) {
    const nextActorId =
      advance.kind === 'SAME_ROUND'
        ? advance.nextActorId
        : advance.cadence === 'EACH_ROUND' && root.initiative
          ? root.proposedTerminalTransition.currentActorId
          : advance.firstActorId
    const nextRound = advance.kind === 'SAME_ROUND' ? state.round : advance.nextRound
    if (
      root.proposedTerminalTransition.currentActorId !== nextActorId ||
      root.proposedTerminalTransition.round !== nextRound
    )
      throw new Error('Proposed Encounter turn is stale.')
  }
  return { rootCommand, initiative, original, durableActors, staged, advance }
}
