import { createEncounterRepository, type DBLike, type Json } from '@artificer-toolkit/db'
import {
  encounterCommandResultDtoSchema,
  encounterTimelineDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounters'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { RuleOutcomeKindDto } from '@artificer-toolkit/schema/api/rules'

import {
  assertActiveCampaignMember,
  resolveCampaignAuthority
} from '../campaign/campaignService.js'
import { EncounterNotFoundError } from './encounterErrors.js'

function eventVisibility(event: {
  commandType: string
  commandPayload: Json
}): 'PRIVATE' | 'TABLE' {
  if (
    (event.commandType === 'ROLL_ENEMY_ACTION' || event.commandType === 'RESOLVE_ACTION') &&
    typeof event.commandPayload === 'object' &&
    event.commandPayload !== null &&
    !Array.isArray(event.commandPayload) &&
    event.commandPayload.visibility === 'TABLE'
  )
    return 'TABLE'
  return 'PRIVATE'
}

function eventResult(resultPayload: Json): {
  roll: RollRecordDto | null
  resolution: {
    rolls: RollRecordDto[]
    outcomes: { kind: RuleOutcomeKindDto; status: 'APPLIED' | 'MANUAL' | 'OVERRIDDEN' }[]
    overridden: boolean
  } | null
} {
  const parsed = encounterCommandResultDtoSchema.safeParse(resultPayload)
  if (!parsed.success) return { roll: null, resolution: null }
  const evidence = parsed.data.resolution
  return {
    roll: parsed.data.roll,
    resolution: evidence
      ? {
          rolls: evidence.rolls,
          outcomes: evidence.appliedOutcomes.map(({ proposed, status }) => ({
            kind: proposed.kind,
            status
          })),
          overridden: evidence.override !== null
        }
      : null
  }
}

export async function getEncounterTimeline(
  db: DBLike,
  userId: string,
  input: { encounterId: string; cursor?: string; limit: number }
): Promise<EncounterTimelineDto> {
  const encounter = await createEncounterRepository(db).find(input.encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, encounter.campaignId, userId)
  assertActiveCampaignMember(authority)
  const events = await createEncounterRepository(db).listEventsPage(
    encounter.id,
    input.cursor,
    input.limit + 1,
    authority.membership.role === 'OWNER' ? 'ALL' : 'TABLE'
  )
  const entries = events.slice(0, input.limit).map((event) => {
    const result = eventResult(event.resultPayload)
    return {
      id: event.id,
      version: event.version,
      commandType: event.commandType,
      visibility: eventVisibility(event),
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
      roll: result.roll,
      resolution: result.resolution
    }
  })
  return encounterTimelineDtoSchema.parse({
    entries,
    nextCursor: events.length > input.limit ? (entries.at(-1)?.id ?? null) : null
  })
}
