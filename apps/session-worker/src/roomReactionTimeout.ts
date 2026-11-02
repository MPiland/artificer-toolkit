import { readPendingRunDecision } from '@artificer-toolkit/encounter-persistence/pendingReads'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { v5 as uuidV5 } from 'uuid'
import type { RoomCommandHost } from './roomCommandHost.js'
import { roomEncounterCommandFingerprint } from './roomEncounterCommands.js'
import {
  commitRoomEncounterCommand,
  type RoomEncounterExecutionHost
} from './roomEncounterExecution.js'
import { roomEncounterReadTransaction } from './roomEncounterReadPorts.js'
import { readRoomEncounterResponseRoute } from './roomEncounterResponseRouting.js'
import { commitMovementDecision } from './roomSceneCommit.js'

const reactionTimeoutNamespace = '5d0b8c3e-61f4-4f7a-9e2d-a8c41b7f3e90'

/** The room steps a reaction timeout reads and commits with. */
export type RoomReactionTimeoutHost = RoomEncounterExecutionHost &
  Pick<RoomCommandHost, 'roomCampaignId'>

/**
 * Declines each reaction offer of the room's ACTIVE Runs whose time ran out (D207), as the GM and
 * through the path a member's answer takes, and returns when the next one runs out. The decline's
 * command ID names the offer's version, so an answer that settled the offer first makes it stale.
 */
export async function settleRoomReactionTimeouts(
  host: RoomReactionTimeoutHost,
  epoch: string,
  now: number
): Promise<number | null> {
  const timeout = await readRoomReactionTimeout(host, epoch)
  if (!timeout || timeout.answerBy > now) return timeout?.answerBy ?? null
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const issuer = {
    socket: null,
    admission: { role: 'OWNER', userId: timeout.ownerUserId },
    value: { authorityEpoch: epoch, campaignId }
  } as const
  const fingerprint = roomEncounterCommandFingerprint(timeout.command)
  if ((await readRoomEncounterResponseRoute(host.store, timeout.command)) === 'MOVEMENT')
    await commitMovementDecision(host, issuer, timeout.command, fingerprint)
  else await commitRoomEncounterCommand(host, issuer, timeout.command, fingerprint)
  // The commit queues the room's post-commit steps, which settle the next offer it opened.
  return null
}

/** The reaction offer that runs out first, with the decline it issues; null when none is pending. */
async function readRoomReactionTimeout(host: RoomReactionTimeoutHost, epoch: string) {
  const pendingRuns = []
  for (const run of host.store.documents('encounterRuns'))
    if (
      run.status === 'ACTIVE' &&
      (
        await host.store.store
          .query('encounterRuleOccurrences')
          .withIndex('by_encounterId_state', (q) =>
            q.eq('encounterId', run.id).eq('state', 'PENDING')
          )
          .take(1)
      ).length
    )
      pendingRuns.push(run)
  if (!pendingRuns.length) return null
  const campaignId = host.roomCampaignId()
  if (!campaignId) throw new Error('Live Session Campaign is unavailable.')
  const authorization = await host.authorizationBoundary({ authorityEpoch: epoch })
  const ownerUserId = authorization.campaign.ownerUserId
  const ctx = await roomEncounterReadTransaction({
    store: host.store,
    inputs: host.inputs,
    authorization,
    campaignId,
    epoch,
    userId: ownerUserId,
    observed: host.inputs.revisions(campaignId, authorization.revisions)
  })
  const { campaign, membership } = await ctx.ports.requireCampaignAuthority(campaignId, ownerUserId)
  let next: {
    answerBy: number
    ownerUserId: string
    command: ResolveRuleOccurrenceInputDto
  } | null = null
  for (const run of pendingRuns) {
    const pending = await readPendingRunDecision(ctx, run, campaign, membership)
    if (!pending || !('answerBy' in pending) || !pending.answerBy) continue
    const answerBy = Date.parse(pending.answerBy)
    if (next && next.answerBy <= answerBy) continue
    next = {
      answerBy,
      ownerUserId,
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        encounterId: run.id,
        commandId: uuidV5(
          `${pending.occurrenceId}:${pending.occurrenceVersion}:timeout`,
          reactionTimeoutNamespace
        ),
        expectedVersion: pending.encounterVersion,
        correlationId: null,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        resolution:
          pending.kind === 'D20_WINDOW'
            ? { kind: 'D20_WINDOW_DECLINE', requestId: pending.requestId }
            : { kind: 'DECLINE' }
      }
    }
  }
  return next
}
