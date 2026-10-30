import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto,
  type RevertLastEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounters'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { z } from 'zod'

import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { persistRevertedRunActors } from './revertedRunActors.js'
import type { EncounterDocument } from './store.js'
import { insertRunCommand } from './timelineEntries.js'

export type StoredCommand = z.infer<typeof encounterStoredRunCommandSchema>
/** The undone root and the Run it commits on. */
export type RevertScope = {
  run: EncounterDocument<'encounterRuns'>
  state: EncounterRunState
  campaign: EncounterDocument<'campaigns'>
  input: RevertLastEncounterActionInputDto
  fingerprint: string
  userId: string
  root: Extract<
    StoredCommand,
    {
      commandType:
        | 'RESOLVE_ACTION'
        | 'ESCAPE'
        | 'SET_CONCEALMENT_OBSERVERS'
        | 'PLACE_ZONE'
        | 'SET_ZONE_DCS'
        | 'DISMISS_ZONE_SIGHTING'
        | 'REVEAL_ZONE'
        | 'DISARM_ZONE'
        | 'CREATURE_REST'
        | 'MOVE_HELD_EFFECT'
        | 'CHANGE_FACING'
    }
  >
}

/** Writes the restored actors, the next Run version and the undo's own timeline entry. */
export async function commitRevert(
  ctx: EncounterCharacterWriteTransaction,
  input: RevertScope & {
    actors: readonly EncounterRunActorState[]
    nextActors: EncounterRunActorState[]
    updatedAt: string
  }
): Promise<EncounterCommandResultDto> {
  const { run, state, campaign, root, updatedAt } = input
  const nextActors = await persistRevertedRunActors(ctx, {
    ...input,
    revertedCommandId: root.commandId,
    ownerUserId: campaign.ownerUserId,
    gameSystemId: state.gameSystemId
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt
  })
  const facts = buildEncounterActorRuleFacts({ actors: nextActors })
  const rules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts }),
    facts
  )
  const projection = await projectNativeGm(ctx, nextState, nextActors, rules)
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: null
  })
  await ctx.db.patch(run._id, {
    version: nextState.version,
    stateJson: JSON.stringify(nextState),
    stateChecksum: checksumCanonicalJson(nextState),
    updatedAt
  })
  await insertRunCommand(
    ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      encounterId: run.id,
      commandId: input.input.commandId,
      commandType: 'REVERT_LAST_ACTION',
      revertedCommandId: root.commandId,
      ruleOccurrenceId:
        root.commandType === 'RESOLVE_ACTION' && root.root.kind === 'RULE_OCCURRENCE'
          ? root.root.ruleOccurrenceId
          : null,
      commandFingerprint: input.fingerprint,
      actorUserId: input.userId,
      version: nextState.version,
      commandJson: JSON.stringify(input.input),
      ...encounterReplayReceipt(result),
      createdAt: updatedAt
    })
  )
  return result
}
