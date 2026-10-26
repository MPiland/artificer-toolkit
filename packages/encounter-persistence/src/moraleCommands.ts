import type {
  ConfirmMoraleInputDto,
  MoraleSaveInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterActorMoraleDto } from '@artificer-toolkit/schema/shared/encounterMorale'
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
import { readRunActors } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import { admitGmEncounterCommand, commitGmEncounterCommand } from './gmEncounterCommands.js'
import type { EncounterWriteTransaction } from './ports.js'
import { recordRuleRollCard } from './ruleRollCards.js'
import type { EncounterDocument } from './store.js'

type MoraleChange = { before: EncounterRunActorState; after: EncounterRunActorState }
type MoraleSettlement = {
  changes: MoraleChange[]
  roll: RollRecordDto | null
  rollIsPrivate: boolean
}

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
  return {
    before: actor,
    after: encounterRunActorStateSchema.parse({ ...actor, morale, updatedAt })
  }
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
  const admitted = await admitGmEncounterCommand(ctx, input, userId)
  if (admitted.replay) return admitted.replay
  const { campaign, state } = admitted
  const actors = await readRunActors(ctx, state)
  const now = new Date().toISOString()
  const { changes, roll, rollIsPrivate } =
    input.type === 'MORALE_SAVE'
      ? await settleMoraleSave(ctx, {
          command: input,
          campaign,
          state,
          actors,
          userId,
          nextInt,
          now
        })
      : confirmMorale(input, actors, now)
  return commitGmEncounterCommand(ctx, admitted, {
    input,
    userId,
    now,
    changes,
    roll,
    rollIsPrivate,
    receipt: {
      actors: changes.map(({ before, after }) => ({
        actorId: after.id,
        before: before.morale ?? null,
        after: after.morale
      }))
    }
  })
}
