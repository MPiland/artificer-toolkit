import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterReadTransaction } from './ports.js'
import { readLiveEncounterTurnAdmission } from './turnCommandAdmission.js'
import { readRunActors } from './documents.js'
import {
  readEncounterAutoRollByActorId,
  readEncounterControlledActorIds
} from './actorController.js'
import { readEncounterSettledAppRoll } from './evidenceRolls.js'
import { presentEncounterResultForMember } from './resultPresentation.js'

type TurnCommandResponse = Omit<
  Extract<LiveSessionEncounterRulesResponse, { kind: 'TURN_COMMAND' }>,
  'revisions'
>

/** The host stamps its revisions and canonical read checksum around this semantic response. */
export async function readEncounterTurnCommandCapture(
  ctx: EncounterReadTransaction,
  input: LiveSessionEncounterRulesInput
): Promise<{ response: TurnCommandResponse; state: EncounterRunState }> {
  if (input.request.kind !== 'TURN_COMMAND') throw new Error('Turn command capture is unavailable.')
  if (input.movement) throw new Error('Turn commands cannot use movement capture scope.')
  const admission = await readLiveEncounterTurnAdmission(ctx, input, input.request.command)
  const actors = await readRunActors(ctx, admission.state)
  const response: TurnCommandResponse = {
    kind: 'TURN_COMMAND',
    campaignOwnerUserId: admission.campaign.ownerUserId,
    autoRollDice: await ctx.ports.readAutoRollDice(admission.campaign.ownerUserId),
    // The GM initiates every turn, so each actor's saves go to its controllers.
    autoRollByActorId: await readEncounterAutoRollByActorId(ctx, {
      campaign: admission.campaign,
      initiatorUserId: admission.campaign.ownerUserId,
      actors
    }),
    responderControlledActorIds: [
      ...(await readEncounterControlledActorIds(ctx, {
        campaign: admission.campaign,
        membership: admission.membership,
        actors
      }))
    ].sort(),
    appRoll:
      admission.resume && admission.input.type === 'RESOLVE_RULE_OCCURRENCE'
        ? await readEncounterSettledAppRoll(ctx, {
            occurrence: admission.pending.occurrence,
            response: admission.input,
            userId: input.expectedUserId
          })
        : null,
    command: admission.input,
    fingerprint: admission.fingerprint,
    occurrenceVersion: admission.pending?.occurrence.version ?? null,
    snapshot: admission.pending?.snapshot ?? null,
    result:
      admission.result &&
      (await presentEncounterResultForMember(ctx, {
        campaign: admission.campaign,
        membership: admission.membership,
        result: admission.result
      }))
  }
  return { response, state: admission.state }
}
