import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionEncounterReleaseRelationshipCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterBasicAction'
import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { encounterStoredRunCommandSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { encounterSourceRelationships } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { readReleaseRelationshipAdmission } from './basicActionAdmission.js'
import { readRunActors } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { projectNativeGm } from './nativeProjection.js'
import { endEncounterRelationshipEffect } from './relationshipEndPersistence.js'
import { encounterReplayReceipt } from './replayReceipts.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
import { insertRunCommand } from './timelineEntries.js'
import type { EncounterWriteTransaction } from './ports.js'

const RELEASE_LABEL = 'Release'
const RELEASE_MISMATCH = "Live Session release differs from the source's relationship."

/**
 * Records a source letting go of the creature it holds (D152): free, so it spends nothing. The
 * held creature's stored effect must still name the source; its deletion strips the conditions
 * only it held. It evaluates no rules, and a released hold is not restored by an undo.
 */
export async function persistEncounterReleaseRelationship(
  ctx: EncounterWriteTransaction,
  input: LiveSessionEncounterReleaseRelationshipCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      actors: readonly EncounterRunActorState[],
      input: LiveSessionEncounterReleaseRelationshipCommitInput
    ): Promise<void>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await readReleaseRelationshipAdmission(ctx, input)
  // A lost acknowledgement replays before checking inputs its commit consumed.
  if (admission.kind === 'REPLAY') return admission.result
  const { run, state, campaign, membership, command, fingerprint } = admission
  const actors = await readRunActors(ctx, state)
  await callbacks.validateReadFence(state, actors, input)
  const held = actors.find((entry) => entry.id === command.heldActorId)
  const ruleActors = actors.filter((entry) => entry.kind !== 'CHARACTER')
  if (
    !held ||
    input.rules.actors.length !== ruleActors.length ||
    input.rules.actors.some((entry) => !ruleActors.some((rule) => rule.id === entry.actorId))
  )
    throw new Error('Live Session release scope mismatch.')
  const effect = await createActiveRuleEffectStore(ctx).findById(
    turnEffectOwner(held, state.id),
    command.activeEffectId
  )
  if (
    !effect ||
    encounterSourceRelationships(new Map([[held.id, [effect]]]), command.actorId).length === 0
  )
    throw new Error(RELEASE_MISMATCH)
  const ended = await endEncounterRelationshipEffect(ctx, {
    encounterId: state.id,
    actors,
    holderActorId: held.id,
    activeEffectId: effect.id,
    occurredAt: input.occurredAt
  })
  if (!ended) throw new Error(RELEASE_MISMATCH)
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection: await projectNativeGm(ctx, nextState, ended.actors, input.rules),
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
      commandType: 'RELEASE_RELATIONSHIP',
      label: RELEASE_LABEL,
      receipt: {
        actorId: command.actorId,
        relationshipEnds: [
          {
            heldActorId: held.id,
            activeEffectId: effect.id,
            removedConditionIds: ended.endedConditionIds
          }
        ]
      },
      commandFingerprint: fingerprint,
      actorUserId: input.expectedUserId,
      version: nextState.version,
      commandJson: JSON.stringify(command),
      ...encounterReplayReceipt(result),
      createdAt: input.occurredAt
    })
  )
  return presentEncounterResultForMember(ctx, { campaign, membership, result })
}
