import type {
  ConfirmMoraleInputDto,
  MoraleSaveInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterActorMoraleDto } from '@artificer-toolkit/schema/shared/encounterMorale'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import {
  encounterMoraleRollers,
  rollEncounterMoraleSave
} from '@artificer-toolkit/rules-runtime/encounterMoraleSave'
import { moraleActorFacts } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { basicActionCheckRollRecord } from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import { optionalCombatPolicyCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import { campaignDefinitions } from './actionPreparationReads.js'
import { rejectDomain } from './domainRejections.js'
import { readRunActors, readRunState, replaceRunActor } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import type { EncounterWriteTransaction } from './ports.js'
import { encounterReplayReceipt, replayEncounterCommandResult } from './replayReceipts.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterDocument } from './store.js'
import { insertRunCommand, requireUnusedEvidenceCommandId } from './timelineEntries.js'

type MoraleChange = { before: EncounterRunActorState; after: EncounterRunActorState }
type MoraleSettlement = { changes: MoraleChange[]; roll: RollRecordDto | null; rollIsPrivate: boolean }

const MORALE_REFUSALS: Readonly<Record<string, string>> = {
  INERT: 'Morale is not on for this Encounter.',
  NOT_APPLICABLE: 'That morale trigger is not offered for this creature.',
  MORALE_LEADER_FOR_INDIVIDUAL_TRIGGER: 'Only a group morale trigger names a leader.',
  MORALE_ROLLER_UNAVAILABLE: 'No creature on that side can roll this morale save.',
  MORALE_OUTCOME_UNRESOLVED: 'The Morale rule has no outcome for this result.'
}

function withMorale(
  actor: EncounterRunActorState,
  morale: EncounterActorMoraleDto,
  updatedAt: string
): MoraleChange {
  return { before: actor, after: encounterRunActorStateSchema.parse({ ...actor, morale, updatedAt }) }
}

/**
 * Rolls the check a Morale trigger offers (ENCOUNTER-6.1): the System's policy picks the roller and
 * seals the DC, contributors and outcomes; the roller's own save settles on the one d20 path and
 * posts its card. Each creature the check covers records it with the proposed outcome, unconfirmed.
 */
async function settleMoraleSave(
  ctx: EncounterWriteTransaction,
  input: {
    command: MoraleSaveInputDto
    campaign: EncounterDocument<'campaigns'>
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    userId: string
    nextInt: (size: number) => number
    now: string
  }
): Promise<MoraleSettlement> {
  const { command, campaign, state, actors } = input
  const subject = actors.find((actor) => actor.id === command.actorId)
  if (!subject) rejectDomain('TARGET_UNAVAILABLE')
  if (subject.kind === 'CHARACTER')
    rejectDomain('TARGET_UNAVAILABLE', "Characters don't check morale; their players decide.")
  const facts = actors.map(moraleActorFacts)
  const members = facts.filter(
    (actor) => actor.sideId === subject.sideId && actor.kind !== 'CHARACTER' && !actor.removed
  )
  const rollers = await encounterMoraleRollers({
    gameSystemId: state.gameSystemId,
    targets: await Promise.all(
      members.map(async ({ actorId }) =>
        buildMovementTarget({
          actor: actors.find((actor) => actor.id === actorId)!,
          activeEffects: await listActiveRuleEffects(ctx, {
            kind: 'ENCOUNTER_ACTOR',
            encounterId: state.id,
            targetActorId: actorId
          }),
          gameSystemId: state.gameSystemId,
          campaignId: campaign.id,
          characterFacts: null
        })
      )
    ),
    definitions: campaignDefinitions(ctx, campaign)
  })
  const resolution = optionalCombatPolicyCapabilityRegistry
    .require(state.gameSystemId)
    .prepareMoraleSave({
      automationMode: state.automationMode,
      gameSystemId: state.gameSystemId,
      optionalCombatSnapshot: state.optionalCombatSnapshot,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum,
      actors: facts,
      subjectActorId: subject.id,
      triggerKind: command.triggerKind,
      leaderActorId: command.leaderActorId,
      overwhelmingOpposition: command.overwhelmingOpposition,
      escapePossible: command.escapePossible,
      rollers
    })
  if (resolution.kind !== 'PROPOSED')
    rejectDomain(
      'TARGET_UNAVAILABLE',
      MORALE_REFUSALS[resolution.kind === 'JUDGMENT_REQUIRED' ? resolution.reason : resolution.kind]
    )
  const { proposal } = resolution
  const roller = rollers.get(proposal.rollerActorId)!
  let roll: RollRecordDto | null = null
  let rollIsPrivate = false
  const save = proposal.automaticFailure
    ? null
    : rollEncounterMoraleSave({
        gameSystemId: state.gameSystemId,
        roller: roller.target,
        proposal,
        roll: command.roll,
        requestId: command.commandId,
        nextInt: input.nextInt
      })
  if (save) {
    const system = await ctx.ports.requireSystem(state.gameSystemId)
    roll = basicActionCheckRollRecord({
      occurrenceId: command.commandId,
      sourceKind: 'SAVING_THROW',
      d20: save,
      actionLabel: 'Morale',
      checkLabel: encounterBasicActionCheckLabel(system, proposal.abilityDefinitionId),
      rollerLabel: roller.target.actor.label,
      ruleset: { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion },
      createdAt: input.now
    })
    const card = await recordRuleRollCard(ctx, {
      campaign,
      encounterId: state.id,
      roller: actors.find((actor) => actor.id === proposal.rollerActorId)!,
      initiatorUserId: input.userId,
      visibility: command.visibility,
      clientNonce: command.commandId,
      roll
    })
    rollIsPrivate = card.audience === 'PRIVATE'
  }
  const proposed =
    save !== null && save.total >= save.dc
      ? proposal.successDisposition
      : proposal.failureDisposition
  const changes = proposal.memberActorIds.map((actorId) => {
    const actor = actors.find((candidate) => candidate.id === actorId)!
    const fired = new Set([...(actor.morale?.firedTriggerKinds ?? []), proposal.triggerKind])
    return withMorale(
      actor,
      {
        commandId: command.commandId,
        definitionId: proposal.pin.definitionId,
        triggerKind: proposal.triggerKind,
        scope: proposal.scope,
        rollerActorId: proposal.rollerActorId,
        groupLeaderActorId: proposal.groupLeaderActorId,
        save,
        proposed,
        disposition: null,
        firedTriggerKinds: [...fired].sort((left, right) =>
          left < right ? -1 : left > right ? 1 : 0
        )
      },
      input.now
    )
  })
  return { changes, roll, rollIsPrivate }
}

/**
 * The GM confirms a morale outcome (ENCOUNTER-6.2): the proposed one or another. A group check's
 * outcome is every creature's that the check covered.
 */
function confirmMorale(
  command: ConfirmMoraleInputDto,
  actors: readonly EncounterRunActorState[],
  now: string
): MoraleSettlement {
  const morale = actors.find((actor) => actor.id === command.actorId)?.morale
  if (!morale) rejectDomain('TARGET_UNAVAILABLE', 'That creature has no morale check to confirm.')
  const covered = actors.filter(
    (actor) =>
      actor.morale?.commandId === morale.commandId &&
      (morale.scope === 'GROUP' || actor.id === command.actorId)
  )
  if (covered.every((actor) => actor.morale!.disposition === command.disposition))
    rejectDomain('TARGET_UNAVAILABLE', 'That morale outcome is already confirmed.')
  return {
    changes: covered.map((actor) =>
      withMorale(actor, { ...actor.morale!, disposition: command.disposition }, now)
    ),
    roll: null,
    rollIsPrivate: false
  }
}

/** The GM's Morale commands: roll an offered check, then confirm its outcome. */
export async function recordMoraleCommand(
  ctx: EncounterWriteTransaction,
  command: MoraleSaveInputDto | ConfirmMoraleInputDto,
  userId: string,
  nextInt: (size: number) => number
): Promise<EncounterCommandResultDto> {
  const lower = (id: string) => id.toLowerCase()
  const ids = {
    encounterId: lower(command.encounterId),
    commandId: lower(command.commandId),
    actorId: lower(command.actorId)
  }
  const input =
    command.type === 'MORALE_SAVE'
      ? { ...command, ...ids, leaderActorId: command.leaderActorId && lower(command.leaderActorId) }
      : { ...command, ...ids }
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter is unavailable.')
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(run.campaignId, userId)
  if (membership.role !== 'OWNER') rejectDomain('GM_ONLY')
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  await requireUnusedEvidenceCommandId(ctx, campaign.id, input.commandId)
  const fingerprint = checksumCanonicalJson(input)
  const prior = await ctx.db
    .query('encounterRunCommands')
    .withIndex('by_campaignId_commandId', (q) =>
      q.eq('campaignId', campaign.id).eq('commandId', input.commandId)
    )
    .unique()
  if (prior) {
    if (
      prior.commandType !== input.type ||
      prior.encounterId !== run.id ||
      prior.actorUserId !== userId ||
      prior.commandFingerprint !== fingerprint
    )
      rejectDomain('COMMAND_ID_REUSED')
    return replayEncounterCommandResult(ctx, readRunState(run), prior)
  }
  if (run.version !== input.expectedVersion) rejectDomain('VERSION_STALE')
  const state = readRunState(run)
  if (state.status !== 'ACTIVE') rejectDomain('ENCOUNTER_NOT_ACTIVE')
  const pending = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_encounterId_state', (q) => q.eq('encounterId', run.id).eq('state', 'PENDING'))
    .first()
  if (pending) rejectDomain('PENDING_DECISION')

  const actors = await readRunActors(ctx, state)
  const now = new Date().toISOString()
  const { changes, roll, rollIsPrivate } =
    input.type === 'MORALE_SAVE'
      ? await settleMoraleSave(ctx, { command: input, campaign, state, actors, userId, nextInt, now })
      : confirmMorale(input, actors, now)
  for (const { before, after } of changes) await replaceRunActor(ctx, before, after)
  const version = run.version + 1
  const nextState = encounterRunStateSchema.parse({ ...state, version, updatedAt: now })
  await ctx.db.patch(run._id, {
    version,
    updatedAt: now,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, nextState),
    roll,
    occurrence: null
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.commandId,
      commandType: input.type,
      // A private morale roll stays off the table's timeline, like any private GM roll (D62).
      ...(rollIsPrivate ? { visibility: 'PRIVATE' as const } : {}),
      receipt: {
        actors: changes.map(({ before, after }) => ({
          actorId: after.id,
          before: before.morale ?? null,
          after: after.morale
        }))
      },
      commandFingerprint: fingerprint,
      actorUserId: userId,
      version,
      commandJson: JSON.stringify(input),
      ...encounterReplayReceipt(result),
      createdAt: now
    })
  )
  return result
}
