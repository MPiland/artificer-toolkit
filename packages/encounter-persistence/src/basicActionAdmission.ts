import type {
  ChangeFacingInputDto,
  EndHeldGrantInputDto,
  EscapeRelationshipInputDto,
  MoveHeldEffectInputDto,
  ReleaseRelationshipInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type { ResolveCheckActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorDefeated } from './characterStates.js'
import { rejectDomain } from './domainRejections.js'
import { requireEncounterActorControl } from './actorController.js'
import { readRunActor, readRunState } from './documents.js'
import { presentStoredCommandReplay } from './resultPresentation.js'
import { requireTargetSeenByMember } from './targetVisibility.js'
import { presentTimelineEntry, requireUnusedEvidenceCommandId } from './timelineEntries.js'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

type BasicActionRootCommand =
  | ResolveCheckActionInputDto
  | EscapeRelationshipInputDto
  | EndHeldGrantInputDto
  | MoveHeldEffectInputDto
  | ChangeFacingInputDto
  | ReleaseRelationshipInputDto
type BasicActionScopeInput = Omit<LiveSessionEncounterRulesInput, 'request'>

/**
 * Admits a command an actor takes alone (a basic action, an Escape) for the room: the caller
 * controls the actor, which must hold the turn unless `anyTurn`, `checkTarget` vets any actor it
 * names, and a stored result replays before any currentness check. It reads no rules inputs and
 * writes nothing.
 */
async function admitCurrentActorCommand<TCommand extends BasicActionRootCommand>(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput,
  command: TCommand,
  options: {
    anyTurn?: boolean
    checkTarget?: (scope: {
      state: ReturnType<typeof readRunState>
      membership: EncounterDocument<'campaignMemberships'>
    }) => Promise<void>
  } = {}
) {
  const { userId } = await ctx.ports.requireIdentity()
  if (
    userId !== input.expectedUserId ||
    command.encounterId !== input.encounterId ||
    command.expectedVersion !== input.expectedVersion
  )
    throw new Error('Live Session current-actor command scope mismatch.')
  await ctx.ports.requireActiveLiveAuthority({
    campaignId: input.campaignId,
    epoch: input.authorityEpoch
  })
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run was not found.')
  const state = readRunState(run)
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(
    state.campaignId,
    userId
  )
  if (campaign.id !== input.campaignId || membership.role !== input.expectedRole)
    throw new Error('Live Session current-actor command scope mismatch.')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  const scope = { run, state, campaign, membership }
  await requireUnusedEvidenceCommandId(ctx, campaign.id, command.commandId)
  const fingerprint = checksumCanonicalJson(command)
  const stored = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', command.commandId)
    )
    .unique()
  if (stored) {
    presentTimelineEntry(stored)
    if (
      stored.commandType !== command.type ||
      stored.encounterId !== run.id ||
      stored.actorUserId !== userId ||
      stored.version !== command.expectedVersion + 1 ||
      stored.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return {
      ...scope,
      kind: 'REPLAY' as const,
      result: await presentStoredCommandReplay(ctx, { state, campaign, membership, stored })
    }
  }
  const actor = await readRunActor(ctx, state, command.actorId)
  await requireEncounterActorControl(ctx, { campaign, membership, actor })
  if (await readEncounterActorDefeated(ctx, actor)) rejectDomain('ACTOR_DEFEATED')
  await options.checkTarget?.({ state, membership })
  if (state.version !== command.expectedVersion) rejectDomain('VERSION_STALE')
  if (state.status !== 'ACTIVE')
    rejectDomain('ENCOUNTER_NOT_ACTIVE', 'Actions require an active Encounter.')
  if (state.automationMode === 'MANUAL') rejectDomain('ASSISTED_ONLY')
  if (!options.anyTurn && state.currentActorId !== command.actorId)
    rejectDomain('NOT_CURRENT_ACTOR')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .first()
  if (pending) rejectDomain('PENDING_DECISION')
  return { ...scope, kind: 'READY' as const, command, fingerprint }
}

/**
 * Admits a CHECK action (a basic action resolved through RESOLVE_ACTION) for the room: the caller
 * controls the current actor and a player's target is visible to them.
 */
export async function readBasicActionAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: ResolveCheckActionInputDto }
) {
  const command: ResolveCheckActionInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase(),
    target: { ...input.command.target, actorId: input.command.target.actorId.toLowerCase() }
  }
  return admitCurrentActorCommand(ctx, input, command, {
    checkTarget: async ({ state, membership }) => {
      const target = await readRunActor(ctx, state, command.target.actorId)
      // Players aim only at actors in their projection; a hidden actor reads as unavailable.
      await requireTargetSeenByMember(ctx, { encounterId: state.id, target, membership })
      if (await readEncounterActorDefeated(ctx, target))
        rejectDomain('TARGET_UNAVAILABLE', "A defeated actor can't be helped.")
    }
  })
}

/** Admits an Escape (D105) for the room: the caller controls the current, escaping actor. */
export async function readEscapeAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: EscapeRelationshipInputDto }
) {
  const command: EscapeRelationshipInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase()
  }
  return admitCurrentActorCommand(ctx, input, command)
}

/** Admits ending a held grant (D113) for the room: the caller controls the current actor, which holds it. */
export async function readEndHeldGrantAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: EndHeldGrantInputDto }
) {
  const command: EndHeldGrantInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase()
  }
  return admitCurrentActorCommand(ctx, input, command)
}

/**
 * Admits moving a held effect (D160) for the room: the caller controls the current actor, which takes
 * the offer, and the new holder is an actor the caller sees that is not defeated.
 */
export async function readMoveHeldEffectAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: MoveHeldEffectInputDto }
) {
  const command: MoveHeldEffectInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase(),
    effectId: input.command.effectId.toLowerCase(),
    target: { ...input.command.target, actorId: input.command.target.actorId.toLowerCase() }
  }
  return admitCurrentActorCommand(ctx, input, command, {
    checkTarget: async ({ state, membership }) => {
      const target = await readRunActor(ctx, state, command.target.actorId)
      await requireTargetSeenByMember(ctx, { encounterId: state.id, target, membership })
      if (await readEncounterActorDefeated(ctx, target))
        rejectDomain('TARGET_UNAVAILABLE', "A defeated actor can't take the effect.")
    }
  })
}

/**
 * Admits a facing change (ATTACK-12) for the room: the caller controls the actor, which turns as a
 * reaction on any turn.
 */
export async function readChangeFacingAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: ChangeFacingInputDto }
) {
  const command: ChangeFacingInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase()
  }
  return admitCurrentActorCommand(ctx, input, command, { anyTurn: true })
}

/**
 * Admits a source releasing a relationship it holds (D152) for the room: the caller controls the
 * source, which may let go whenever it likes, on any turn.
 */
export async function readReleaseRelationshipAdmission(
  ctx: EncounterReadTransaction,
  input: BasicActionScopeInput & { command: ReleaseRelationshipInputDto }
) {
  const command: ReleaseRelationshipInputDto = {
    ...input.command,
    encounterId: input.command.encounterId.toLowerCase(),
    commandId: input.command.commandId.toLowerCase(),
    actorId: input.command.actorId.toLowerCase(),
    heldActorId: input.command.heldActorId.toLowerCase(),
    activeEffectId: input.command.activeEffectId.toLowerCase()
  }
  return admitCurrentActorCommand(ctx, input, command, { anyTurn: true })
}
