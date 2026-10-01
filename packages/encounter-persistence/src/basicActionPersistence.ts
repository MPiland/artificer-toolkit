import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterBasicActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunState,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { ReusableDefinitionCurrentDto } from '@artificer-toolkit/schema/shared/reusableDefinitions'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterBasicActionEffects,
  requireEncounterBasicActionDefinition,
  withEncounterBasicActionEffects
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { readBasicActionAdmission } from './basicActionAdmission.js'
import { readEncounterCharacterStates } from './characterStates.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { readEncounterInitiativeRound } from './initiativeStore.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { recordTurnSpeedBonus } from './turnMovement.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/**
 * Records the room's planned basic action (Q11): the allowance it spent, the effects its actor
 * gains and a movement bonus for the turn, checked against the current Run. It evaluates no rules.
 */
export async function persistEncounterBasicAction(
  ctx: EncounterCharacterWriteTransaction,
  input: LiveSessionEncounterBasicActionCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterBasicActionCommitInput
    ): Promise<void>
    readDefinition(id: string, userId: string): Promise<ReusableDefinitionCurrentDto | null>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readBasicActionAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session basic action overrides were not acknowledged.')
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  // The System's catalogue is its platform-published entries (user-authored Systems are deferred).
  const currentDefinition = await callbacks.readDefinition(
    command.definitionId,
    input.expectedUserId
  )
  const { definition, document } = requireEncounterBasicActionDefinition(state, currentDefinition)
  const actor = actors.find((entry) => entry.id === command.actorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !actor ||
    definition.version !== input.definition.version ||
    definition.checksum !== input.definition.checksum ||
    input.speedMovementBonus !== document.mechanics.includes('SPEED_MOVEMENT_BONUS') ||
    input.effects.some(
      (effect) =>
        effect.definitionId !== definition.id ||
        effect.turnSequence !== state.turnSequence ||
        !document.mechanics.includes(effect.mechanic) ||
        effect.allyActorId !==
          (effect.mechanic === 'ALLY_ADVANTAGE' ? command.allyActorId : null) ||
        effect.suspendedWhileUnableToActOrMove !== document.suspendedWhileUnableToActOrMove ||
        checksumCanonicalJson(effect.saveAbilityIds) !==
          checksumCanonicalJson(effect.mechanic === 'SAVE_ADVANTAGE' ? document.saveAbilityIds : [])
    ) ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session basic action scope mismatch.')
  const spent = input.actionEconomy
    ? consumeEncounterActionEconomy({
        actor,
        consumption: input.actionEconomy,
        overridden: overridesActionEconomy(input.ruleOverrides)
      })
    : actor
  const settled = withEncounterBasicActionEffects(spent, [
    ...encounterBasicActionEffects(spent),
    ...input.effects
  ])
  await replaceRunActor(ctx, actor, settled)
  if (input.speedMovementBonus) await recordTurnSpeedBonus(ctx, { state, actorId: actor.id })
  const nextActors = actors.map((entry) => (entry.id === settled.id ? settled : entry))
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const projection = projectCurrentEncounterGm({
    state: nextState,
    actors: nextActors,
    rules: input.rules,
    initiativeRoundState: await readEncounterInitiativeRound(ctx, {
      encounterId: state.id,
      round: state.round
    }),
    characterStates: await readEncounterCharacterStates(ctx, nextState, nextActors)
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: null
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt: input.occurredAt
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: command.commandId,
      commandType: 'USE_BASIC_ACTION',
      label: definition.label,
      ruleOverrides: input.ruleOverrides,
      receipt: {
        actorId: actor.id,
        actionEconomy: input.actionEconomy,
        effects: input.effects,
        speedBonusTurn: input.speedMovementBonus
          ? { round: state.round, turnActorId: actor.id }
          : null
      },
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
