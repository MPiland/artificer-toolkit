import { v } from 'convex/values'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import { liveSessionEncounterBasicActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterBasicActionEffects,
  requireEncounterBasicActionDefinition,
  withEncounterBasicActionEffects
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { internalMutation } from '../lib/mutations'
import { readDefinitionRoot } from '../content/definitionStore'
import { readBasicActionAdmission } from '../encounters/basicActionAdmission'
import { readEncounterCharacterStates } from '../encounters/characterStates'
import { readRunActors, replaceRunActor } from '../encounters/documents'
import { readEncounterInitiativeRound } from '../encounters/initiativeStore'
import { presentEncounterResultForMember } from '../encounters/resultPresentation'
import { insertRunCommand } from '../encounters/timelineEntries'
import { recordTurnSpeedBonus } from '../encounters/turnMovement'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/**
 * Records the room's planned basic action (Q11): the allowance it spent, the effects its actor
 * gains and a movement bonus for the turn, checked against the current Run. It evaluates no rules.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterBasicActionCommitInputSchema.parse(args)
    const admission = await readBasicActionAdmission(ctx, input)
    // A lost acknowledgement replays before checking inputs its commit consumed.
    if (admission.kind === 'REPLAY') return admission.result
    const { run, state, campaign, membership, command, fingerprint } = admission
    if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
      throw new Error('Live Session basic action overrides were not acknowledged.')
    const actors = await readRunActors(ctx, state)
    await assertLiveSessionRulesRevisions(ctx, input.revisions, {
      systemId: state.gameSystemId,
      campaignId: state.campaignId,
      characterIds: actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
    })
    // The System's catalogue is its platform-published entries (user-authored Systems are deferred).
    const root = await readDefinitionRoot(ctx, command.definitionId, input.expectedUserId)
    const { definition, document } = requireEncounterBasicActionDefinition(
      state,
      root?.sourceKind === 'PLATFORM' ? root.current : null
    )
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
          effect.round !== state.round ||
          !document.mechanics.includes(effect.mechanic) ||
          effect.allyActorId !== (effect.mechanic === 'ALLY_ADVANTAGE' ? command.allyActorId : null)
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
      projectionJson: JSON.stringify(projection),
      projectionChecksum: checksumCanonicalJson(projection),
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
        commandFingerprint: fingerprint,
        actorUserId: input.expectedUserId,
        version: nextState.version,
        commandJson: JSON.stringify(command),
        resultJson: JSON.stringify(result),
        resultChecksum: checksumCanonicalJson(result),
        createdAt: input.occurredAt
      })
    )
    return presentEncounterResultForMember(ctx, { campaign, membership, result })
  }
})
