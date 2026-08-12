import { createHash } from 'node:crypto'

import { createCampaignLivePlayRepository, type DBLike, type Json } from '@artificer-toolkit/db'
import { CampaignConflictError } from './campaignService.js'

type CampaignCommandInput = {
  campaignId: string
  commandId: string
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue)
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, sortValue(entry)])
  )
}

export function campaignCommandFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex')
}

export async function findCampaignCommandResult<TResult>(
  db: DBLike,
  input: CampaignCommandInput,
  commandType: string
): Promise<TResult | null> {
  const prior = await createCampaignLivePlayRepository(db).findCommand(
    input.campaignId,
    input.commandId
  )
  if (!prior) return null
  if (
    prior.commandType !== commandType ||
    prior.inputFingerprint !== campaignCommandFingerprint(input)
  ) {
    throw new CampaignConflictError('This command ID was already used with different input.')
  }
  return prior.resultPayload as TResult
}

export async function storeCampaignCommandResult<TResult>(
  db: DBLike,
  input: CampaignCommandInput,
  commandType: string,
  result: TResult,
  correctionReason?: string
): Promise<void> {
  await createCampaignLivePlayRepository(db).insertCommand({
    campaignId: input.campaignId,
    commandId: input.commandId,
    commandType,
    inputFingerprint: campaignCommandFingerprint(input),
    resultPayload: result as Json,
    correctionReason
  })
}
