import { createHash, randomUUID } from 'node:crypto'

import {
  createCampaignAdjustmentsRepository,
  createCampaignLivePlayRepository,
  createCampaignRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  withTransaction,
  type CampaignClock,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import {
  advanceCampaignClockInputSchema,
  campaignClockDtoSchema,
  configureCampaignClockInputSchema,
  initializeCampaignClockInputSchema,
  pauseCampaignClockInputSchema,
  reconcileCampaignClockInputSchema,
  rewindCampaignClockInputSchema,
  startCampaignClockInputSchema,
  type AdvanceCampaignClockInput,
  type CampaignClockDto,
  type ConfigureCampaignClockInput,
  type InitializeCampaignClockInput,
  type PauseCampaignClockInput,
  type ReconcileCampaignClockInput,
  type RewindCampaignClockInput,
  type StartCampaignClockInput
} from '@artificer-toolkit/schema/api/campaigns'
import {
  createCharacterResourceOwnerKey,
  toCharacterResourceOwnerKey,
  type CharacterResourceOwnerRef
} from '@artificer-toolkit/shared/character'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'
import { executeCharacterSheetCommand } from '../character/sheetService.js'
import { buildCharacterSheetResponse } from '../character/sheetProjection.js'
import { resolveCharacterBuilder } from '../character/builderService.js'
import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  resolveCampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

const MINUTE_MS = 60_000

type LivePlayCommandInput =
  | InitializeCampaignClockInput
  | ConfigureCampaignClockInput
  | StartCampaignClockInput
  | PauseCampaignClockInput
  | AdvanceCampaignClockInput
  | RewindCampaignClockInput
  | ReconcileCampaignClockInput

interface LivePlayResult {
  clock: CampaignClockDto | null
}

interface AssignedCharacter {
  characterId: string
  userId: string
}

interface CharacterInvalidation {
  characterId: string
  eventId: string
}

interface ClockTransactionResult {
  result: LivePlayResult
  characterInvalidations: CharacterInvalidation[]
}

function fingerprint(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(sortValue(value)))
    .digest('hex')
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

function absoluteMinute(day: number, minuteOfDay: number): number {
  return (day - 1) * 1440 + minuteOfDay
}

function splitAbsoluteMinute(value: number): { day: number; minuteOfDay: number } {
  return {
    day: Math.floor(value / 1440) + 1,
    minuteOfDay: value % 1440
  }
}

function now(): string {
  return new Date().toISOString()
}

function asClockDto(clock: CampaignClock): CampaignClockDto {
  return campaignClockDtoSchema.parse(clock)
}

function assertOwner(db: DBLike, campaignId: string, userId: string) {
  return resolveCampaignAuthority(db, campaignId, userId).then((authority) => {
    assertActiveCampaignMember(authority)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    return authority
  })
}

async function lockCampaignOwner(db: DBLike, campaignId: string, userId: string) {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId))) {
    throw new CampaignNotFoundError()
  }
  return assertOwner(db, campaignId, userId)
}

async function priorResult(
  db: DBLike,
  input: LivePlayCommandInput,
  commandType: string
): Promise<LivePlayResult | null> {
  const prior = await createCampaignLivePlayRepository(db).findCommand(
    input.campaignId,
    input.commandId
  )
  if (!prior) return null
  if (prior.commandType !== commandType || prior.inputFingerprint !== fingerprint(input)) {
    throw new CampaignConflictError('This command ID was already used with different input.')
  }
  return prior.resultPayload as unknown as LivePlayResult
}

async function storeResult(
  db: DBLike,
  input: LivePlayCommandInput,
  commandType: string,
  result: LivePlayResult
): Promise<void> {
  await createCampaignLivePlayRepository(db).insertCommand({
    campaignId: input.campaignId,
    commandId: input.commandId,
    commandType,
    inputFingerprint: fingerprint(input),
    resultPayload: result as unknown as Json
  })
}

// Clock commands are atomic, so no resource use can occur between repeated boundaries of the
// same kind. Processing only the latest occurrence preserves final state and bounds recovery work.
function latestBoundaryOccurrences(
  fromAbsolute: number,
  targetAbsolute: number,
  dawnMinute: number,
  duskMinute: number
): Array<{ absolute: number; kind: 'DAILY' | 'DAWN' | 'DUSK'; order: number }> {
  if (targetAbsolute < fromAbsolute) return []

  const targetDayStart = targetAbsolute - (targetAbsolute % 1440)
  return [
    { kind: 'DAILY' as const, minute: 0, order: 0 },
    { kind: 'DAWN' as const, minute: dawnMinute, order: 1 },
    { kind: 'DUSK' as const, minute: duskMinute, order: 2 }
  ]
    .map(({ kind, minute, order }) => {
      const currentDayOccurrence = targetDayStart + minute
      return {
        absolute:
          currentDayOccurrence <= targetAbsolute
            ? currentDayOccurrence
            : currentDayOccurrence - 1440,
        kind,
        order
      }
    })
    .filter(({ absolute }) => absolute >= fromAbsolute)
    .sort((left, right) => left.absolute - right.absolute || left.order - right.order)
}

async function lockAssignedCharacters(
  db: DBLike,
  campaignId: string
): Promise<AssignedCharacter[]> {
  const rows = await db
    .selectFrom('campaign_character_assignments as assignment')
    .innerJoin('characters as character_row', 'character_row.id', 'assignment.character_id')
    .select(['assignment.character_id as characterId', 'assignment.user_id as userId'])
    .where('assignment.campaign_id', '=', campaignId)
    .orderBy('assignment.character_id', 'asc')
    .forUpdate()
    .execute()
  return rows as AssignedCharacter[]
}

async function recoverBoundary(
  db: DBLike,
  campaignId: string,
  actorUserId: string,
  absolute: number,
  kind: 'DAWN' | 'DUSK' | 'DAILY',
  assignedCharacters: AssignedCharacter[]
): Promise<CharacterInvalidation[]> {
  const invalidations: CharacterInvalidation[] = []
  for (const assignment of assignedCharacters) {
    const characterRepository = createCharacterRepository(db)
    const authored = await characterRepository.findAuthoredById(assignment.characterId)
    const row = await characterRepository.findById(assignment.characterId)
    if (!authored || !row) continue
    const resolution = await resolveCharacterBuilder(db, authored, 'edit')
    const [adjustments, playState] = await Promise.all([
      // Campaign recovery only needs authoritative resource usage and does not expose the sheet.
      createCharacterSheetAdjustmentRepository(db).listByCharacter(assignment.characterId),
      createCharacterSheetPlayStateRepository(db).listResourceUsage(assignment.characterId)
    ])
    const sheet = await buildCharacterSheetResponse({
      db,
      character: authored,
      resolution,
      streamVersion: row.stream_version,
      adjustments,
      resourceUsage: playState
    })
    const trigger = kind
    for (const resource of sheet.resources.items) {
      if (resource.used <= 0 || !resource.recoveries.some((entry) => entry.trigger === trigger)) {
        continue
      }
      const owner = resource.owner as CharacterResourceOwnerRef
      const resourceKey = createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner))
      const repository = createCampaignLivePlayRepository(db)
      if (
        await repository.hasRecovery({
          campaignId,
          boundaryAbsoluteMinute: absolute,
          characterId: assignment.characterId,
          resourceKey
        })
      ) {
        continue
      }
      const latest = await characterRepository.findById(assignment.characterId)
      if (!latest) continue
      const command: CharacterSheetCommandInputDto = {
        type: 'RECOVER_SHEET_RESOURCE',
        commandId: randomUUID(),
        expectedVersion: latest.stream_version,
        owner,
        trigger
      }
      const result = await executeCharacterSheetCommand({
        db,
        characterId: assignment.characterId,
        command,
        userId: actorUserId
      })
      if (!result.historyEntry)
        throw new CampaignValidationError('Character recovery produced no history entry.')
      const event = await createCampaignAdjustmentsRepository(db).insertCampaignEvent({
        campaignId,
        actorUserId,
        subjectUserId: assignment.userId,
        subjectCharacterId: assignment.characterId,
        kind: 'CAMPAIGN_CLOCK_RESOURCE_RECOVERED',
        visibility: 'TABLE',
        payload: {
          boundaryAbsoluteMinute: absolute,
          boundaryKind: kind,
          characterId: assignment.characterId,
          resourceKey,
          characterEventId: result.historyEntry.eventId
        },
        idempotencyKey: randomUUID()
      })
      await repository.insertRecovery({
        campaignId,
        boundaryAbsoluteMinute: absolute,
        boundaryKind: kind,
        characterId: assignment.characterId,
        resourceKey,
        eventId: event.id
      })
      invalidations.push({ characterId: assignment.characterId, eventId: event.id })
    }
  }
  return invalidations
}

async function deriveClock(
  clock: CampaignClock,
  nowValue: string
): Promise<{ clock: CampaignClock; elapsedMinutes: number }> {
  if (!clock.running || !clock.runningSince) return { clock, elapsedMinutes: 0 }
  // ponytail: one real minute equals one game minute; add a speed setting only if play proves it necessary.
  const elapsedMinutes = Math.max(
    0,
    Math.floor((Date.parse(nowValue) - Date.parse(clock.runningSince)) / MINUTE_MS)
  )
  if (elapsedMinutes === 0) return { clock, elapsedMinutes: 0 }
  const nextAbsolute = absoluteMinute(clock.day, clock.minuteOfDay) + elapsedMinutes
  const next = splitAbsoluteMinute(nextAbsolute)
  return {
    clock: {
      ...clock,
      day: next.day,
      minuteOfDay: next.minuteOfDay,
      runningSince: nowValue,
      updatedAt: nowValue
    },
    elapsedMinutes
  }
}

async function advanceDerivedClock(
  db: DBLike,
  clock: CampaignClock,
  targetAbsolute: number,
  actorUserId: string
): Promise<{ clock: CampaignClock; characterInvalidations: CharacterInvalidation[] }> {
  const from = clock.processedBoundaryAbsoluteMinute + 1
  const boundaries = latestBoundaryOccurrences(
    from,
    targetAbsolute,
    clock.dawnMinute,
    clock.duskMinute
  )
  const assigned = boundaries.length > 0 ? await lockAssignedCharacters(db, clock.campaignId) : []
  const characterInvalidations: CharacterInvalidation[] = []
  for (const { absolute, kind } of boundaries) {
    characterInvalidations.push(
      ...(await recoverBoundary(db, clock.campaignId, actorUserId, absolute, kind, assigned))
    )
  }
  const next = splitAbsoluteMinute(targetAbsolute)
  return {
    clock: {
      ...clock,
      day: next.day,
      minuteOfDay: next.minuteOfDay,
      processedBoundaryAbsoluteMinute: Math.max(
        clock.processedBoundaryAbsoluteMinute,
        targetAbsolute
      )
    },
    characterInvalidations
  }
}

async function saveClock(
  db: DBLike,
  previous: CampaignClock,
  next: CampaignClock
): Promise<CampaignClock> {
  const saved = await createCampaignLivePlayRepository(db).updateClock({
    campaignId: next.campaignId,
    day: next.day,
    minuteOfDay: next.minuteOfDay,
    running: next.running,
    runningSince: next.runningSince,
    dawnMinute: next.dawnMinute,
    duskMinute: next.duskMinute,
    processedBoundaryAbsoluteMinute: next.processedBoundaryAbsoluteMinute,
    expectedVersion: previous.version
  })
  if (!saved)
    throw new CampaignConflictError('Campaign clock changed before this command completed.')
  return saved
}

async function runClockCommand(
  db: DBLike,
  userId: string,
  input: LivePlayCommandInput,
  commandType: string,
  apply: (
    db: DBLike,
    clock: CampaignClock | null
  ) => Promise<{ clock: CampaignClock; characterInvalidations: CharacterInvalidation[] }>
): Promise<CampaignClockDto> {
  const transactionResult = await withTransaction(
    db,
    async (trx): Promise<ClockTransactionResult> => {
      await lockCampaignOwner(trx, input.campaignId, userId)
      const previous = await priorResult(trx, input, commandType)
      if (previous) return { result: previous, characterInvalidations: [] }
      const clock = await createCampaignLivePlayRepository(trx).lockClock(input.campaignId)
      if (input.expectedVersion !== (clock?.version ?? 0)) {
        throw new CampaignConflictError('Campaign clock changed before this command completed.')
      }
      const applied = await apply(trx, clock)
      const saved = clock ? await saveClock(trx, clock, applied.clock) : applied.clock
      const commandResult: LivePlayResult = { clock: asClockDto(saved) }
      await storeResult(trx, input, commandType, commandResult)
      return { result: commandResult, characterInvalidations: applied.characterInvalidations }
    }
  )
  const result = transactionResult.result
  if (!result.clock) throw new CampaignValidationError('Campaign clock is unavailable.')
  for (const invalidation of transactionResult.characterInvalidations) {
    try {
      await broadcastCampaignInvalidation(db, input.campaignId, {
        scope: 'TABLE',
        entity: 'CHARACTER',
        entityId: invalidation.characterId,
        event: 'UPDATED',
        eventId: invalidation.eventId,
        cursor: invalidation.eventId
      })
    } catch {
      // Durable Character state remains valid if Realtime is unavailable.
    }
  }
  try {
    await broadcastCampaignInvalidation(db, input.campaignId, {
      scope: 'TABLE',
      entity: 'CLOCK',
      entityId: input.campaignId,
      event: 'UPDATED',
      eventId: input.commandId,
      cursor: input.commandId
    })
  } catch {
    // Durable clock state is already committed when Realtime is unavailable.
  }
  return result.clock
}

export async function getCampaignClock(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<CampaignClockDto | null> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const clock = await createCampaignLivePlayRepository(db).findClock(campaignId)
  return clock ? asClockDto((await deriveClock(clock, now())).clock) : null
}

export async function initializeCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: InitializeCampaignClockInput
): Promise<CampaignClockDto> {
  const input = initializeCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'INITIALIZE_CLOCK', async (trx, existing) => {
    if (existing) throw new CampaignValidationError('Campaign clock is already initialized.')
    const created = await createCampaignLivePlayRepository(trx).insertClock({
      campaignId: input.campaignId,
      day: input.day,
      minuteOfDay: input.minuteOfDay,
      dawnMinute: input.dawnMinute,
      duskMinute: input.duskMinute,
      processedBoundaryAbsoluteMinute: absoluteMinute(input.day, input.minuteOfDay)
    })
    return { clock: created, characterInvalidations: [] }
  })
}

export async function configureCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: ConfigureCampaignClockInput
): Promise<CampaignClockDto> {
  const input = configureCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'CONFIGURE_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    const derived = await deriveClock(existing, now())
    const day = input.day ?? derived.clock.day
    const minuteOfDay = input.minuteOfDay ?? derived.clock.minuteOfDay
    const target = absoluteMinute(day, minuteOfDay)
    const advanced = await advanceDerivedClock(
      trx,
      {
        ...derived.clock,
        dawnMinute: input.dawnMinute ?? derived.clock.dawnMinute,
        duskMinute: input.duskMinute ?? derived.clock.duskMinute
      },
      target,
      userId
    )
    return {
      clock: {
        ...advanced.clock,
        running: derived.clock.running,
        runningSince: derived.clock.running ? now() : null,
        dawnMinute: input.dawnMinute ?? derived.clock.dawnMinute,
        duskMinute: input.duskMinute ?? derived.clock.duskMinute
      },
      characterInvalidations: advanced.characterInvalidations
    }
  })
}

export async function startCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: StartCampaignClockInput
): Promise<CampaignClockDto> {
  const input = startCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'START_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    if (existing.running) throw new CampaignValidationError('Campaign clock is already running.')
    return {
      clock: { ...existing, running: true, runningSince: now() },
      characterInvalidations: []
    }
  })
}

export async function pauseCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: PauseCampaignClockInput
): Promise<CampaignClockDto> {
  const input = pauseCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'PAUSE_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    if (!existing.running) return { clock: existing, characterInvalidations: [] }
    const derived = await deriveClock(existing, now())
    const advanced = await advanceDerivedClock(
      trx,
      derived.clock,
      absoluteMinute(derived.clock.day, derived.clock.minuteOfDay),
      userId
    )
    return {
      clock: { ...advanced.clock, running: false, runningSince: null },
      characterInvalidations: advanced.characterInvalidations
    }
  })
}

export async function advanceCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: AdvanceCampaignClockInput
): Promise<CampaignClockDto> {
  const input = advanceCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'ADVANCE_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    const derived = await deriveClock(existing, now())
    const target = absoluteMinute(derived.clock.day, derived.clock.minuteOfDay) + input.minutes
    const advanced = await advanceDerivedClock(trx, derived.clock, target, userId)
    return { clock: advanced.clock, characterInvalidations: advanced.characterInvalidations }
  })
}

export async function rewindCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: RewindCampaignClockInput
): Promise<CampaignClockDto> {
  const input = rewindCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'REWIND_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    const derived = await deriveClock(existing, now())
    const target = absoluteMinute(derived.clock.day, derived.clock.minuteOfDay) - input.minutes
    if (target < 0)
      throw new CampaignValidationError('Campaign time cannot move before Day 1 · 00:00.')
    const next = splitAbsoluteMinute(target)
    return {
      clock: { ...derived.clock, day: next.day, minuteOfDay: next.minuteOfDay },
      characterInvalidations: []
    }
  })
}

export async function reconcileCampaignClock(
  db: DBLike,
  userId: string,
  rawInput: ReconcileCampaignClockInput
): Promise<CampaignClockDto> {
  const input = reconcileCampaignClockInputSchema.parse(rawInput)
  return runClockCommand(db, userId, input, 'RECONCILE_CLOCK', async (trx, existing) => {
    if (!existing) throw new CampaignValidationError('Campaign clock is not initialized.')
    const derived = await deriveClock(existing, now())
    const advanced = await advanceDerivedClock(
      trx,
      derived.clock,
      absoluteMinute(derived.clock.day, derived.clock.minuteOfDay),
      userId
    )
    return {
      clock: advanced.clock,
      characterInvalidations: advanced.characterInvalidations
    }
  })
}
