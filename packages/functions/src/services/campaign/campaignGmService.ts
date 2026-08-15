import {
  createCampaignAdjustmentsRepository,
  createCampaignRepository,
  createCharacterRepository,
  withTransaction,
  type CampaignAdjustment,
  type CampaignHistoryEvent,
  type DBLike
} from '@artificer-toolkit/db'
import {
  campaignAdjustmentDtoSchema,
  campaignAdjustmentsDtoSchema,
  campaignConditionDtoSchema,
  campaignConditionsDtoSchema,
  campaignConditionValueDtoSchema,
  campaignEventDtoSchema,
  campaignEventPageDtoSchema,
  deleteCampaignAdjustmentInputSchema,
  listCampaignAdjustmentsInputSchema,
  listCampaignEventsInputSchema,
  type CampaignAdjustmentDto,
  type CampaignAdjustmentInput,
  type CampaignConditionDto,
  type DeleteCampaignConditionInput,
  type CampaignEventDto,
  type CampaignEventPageDto,
  type SaveCampaignConditionInput
} from '@artificer-toolkit/schema/api/campaigns'
import { characterSheetAdjustmentCommandDtoSchema } from '@artificer-toolkit/schema/api/characterSheet'
import type { z } from 'zod'
import { resolveCharacterBuilder } from '../character/builderService.js'
import {
  validateCharacterConditionType,
  validateSheetAdjustmentTarget
} from '../character/sheetCommandValidation.js'
import { getCharacterSheetAdjustmentSlotKey } from '../character/campaignCharacterSheet.js'
import {
  CampaignAccessError,
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority,
  type CampaignAuthority
} from './campaignService.js'
import { broadcastCampaignInvalidation } from './realtimeService.js'

type DeleteCampaignAdjustmentInput = z.input<typeof deleteCampaignAdjustmentInputSchema>
type ListCampaignAdjustmentsInput = z.input<typeof listCampaignAdjustmentsInputSchema>
type ListCampaignEventsInput = z.input<typeof listCampaignEventsInputSchema>

function toAdjustmentDto(record: CampaignAdjustment): CampaignAdjustmentDto {
  return campaignAdjustmentDtoSchema.parse({
    id: record.id,
    campaignId: record.campaignId,
    characterId: record.characterId,
    adjustment: characterSheetAdjustmentCommandDtoSchema.parse(record.payload),
    visibility: record.visibility,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function toConditionDto(record: CampaignAdjustment): CampaignConditionDto {
  const condition = campaignConditionValueDtoSchema.parse(record.payload)
  return campaignConditionDtoSchema.parse({
    id: record.id,
    campaignId: record.campaignId,
    characterId: record.characterId,
    ...condition,
    visibility: record.visibility,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  })
}

function toEventDto(record: CampaignHistoryEvent): CampaignEventDto {
  return campaignEventDtoSchema.parse({
    id: record.id,
    campaignId: record.campaignId,
    type: record.kind,
    visibility: record.visibility,
    subjectCharacterId: record.subjectCharacterId,
    payload: record.payload,
    createdAt: record.createdAt
  })
}

async function assertAssignedCharacter(
  db: DBLike,
  authority: CampaignAuthority,
  characterId: string
): Promise<void> {
  assertActiveCampaignMember(authority)
  if (authority.membership.role === 'PLAYER' && authority.assignedCharacter?.id !== characterId) {
    throw new CampaignAccessError()
  }
  if (
    !(await createCampaignRepository(db).findAssignmentByCharacter(
      authority.campaign.id,
      characterId
    ))
  ) {
    throw new CampaignAccessError()
  }
}

async function lockCampaign(db: DBLike, campaignId: string): Promise<void> {
  if (!(await createCampaignRepository(db).lockCampaign(campaignId)))
    throw new CampaignNotFoundError()
}

async function broadcastAdjustment(
  db: DBLike,
  campaignId: string,
  characterId: string,
  eventId: string,
  visibility: 'VISIBLE' | 'SECRET',
  event: 'CREATED' | 'UPDATED' | 'DELETED'
): Promise<void> {
  try {
    await broadcastCampaignInvalidation(db, campaignId, {
      scope: visibility === 'VISIBLE' ? 'TABLE' : 'OWNER',
      entity: 'CHARACTER',
      entityId: characterId,
      event,
      eventId,
      cursor: eventId
    })
  } catch {
    // The committed adjustment remains valid if Realtime is temporarily unavailable.
  }
}

export async function listCampaignAdjustments(
  db: DBLike,
  userId: string,
  input: ListCampaignAdjustmentsInput
): Promise<CampaignAdjustmentDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  await assertAssignedCharacter(db, authority, input.characterId)
  const adjustments = await createCampaignAdjustmentsRepository(db).listAdjustments(
    input.campaignId,
    input.characterId
  )
  return campaignAdjustmentsDtoSchema.parse(
    adjustments
      .filter((adjustment) => adjustment.family !== 'CONDITION')
      .filter(
        (adjustment) => authority.membership.role === 'OWNER' || adjustment.visibility === 'VISIBLE'
      )
      .map(toAdjustmentDto)
  )
}

export async function saveCampaignAdjustment(
  db: DBLike,
  userId: string,
  input: CampaignAdjustmentInput
): Promise<CampaignAdjustmentDto> {
  const result = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await assertAssignedCharacter(trx, authority, input.characterId)

    const characterRepository = createCharacterRepository(trx)
    const [character, row] = await Promise.all([
      characterRepository.findAuthoredById(input.characterId),
      characterRepository.findById(input.characterId)
    ])
    if (!character || !row) {
      throw new CampaignValidationError('Assigned character is unavailable.')
    }
    if (!row.rule_pack_revision_id) {
      throw new CampaignValidationError('Assigned character has no pinned rule revision.')
    }
    const adjustment = characterSheetAdjustmentCommandDtoSchema.parse(input.adjustment)
    validateSheetAdjustmentTarget(
      adjustment,
      await resolveCharacterBuilder(
        trx,
        character,
        'edit',
        undefined,
        null,
        row.rule_pack_revision_id
      ),
      character
    )
    const { id: _commandId, ...payload } = adjustment
    const saved = await createCampaignAdjustmentsRepository(trx).saveAdjustment({
      campaignId: input.campaignId,
      characterId: input.characterId,
      family: adjustment.family,
      slotKey: getCharacterSheetAdjustmentSlotKey(adjustment),
      payload,
      visibility: input.visibility,
      createdBy: userId,
      expectedVersion: input.expectedVersion,
      updatedAt: new Date().toISOString()
    })
    if (!saved)
      throw new CampaignConflictError('Campaign adjustment changed before this save completed.')
    const event = await createCampaignAdjustmentsRepository(trx).insertCampaignEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      subjectCharacterId: input.characterId,
      kind: 'CAMPAIGN_ADJUSTMENT_SAVED',
      visibility: input.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'SAVED',
        adjustmentId: saved.id,
        family: saved.family,
        slotKey: saved.slotKey,
        version: saved.version
      }
    })
    return { adjustment: saved, event }
  })

  await broadcastAdjustment(
    db,
    input.campaignId,
    input.characterId,
    result.event.id,
    result.adjustment.visibility,
    result.adjustment.version === 0 ? 'CREATED' : 'UPDATED'
  )
  return toAdjustmentDto(result.adjustment)
}

export async function deleteCampaignAdjustment(
  db: DBLike,
  userId: string,
  input: DeleteCampaignAdjustmentInput
): Promise<void> {
  const result = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await assertAssignedCharacter(trx, authority, input.characterId)
    const adjustments = await createCampaignAdjustmentsRepository(trx).listAdjustments(
      input.campaignId,
      input.characterId
    )
    const adjustment = adjustments.find((candidate) => candidate.id === input.adjustmentId)
    if (!adjustment || adjustment.family === 'CONDITION') {
      throw new CampaignConflictError('Campaign adjustment changed before this delete completed.')
    }
    if (
      !(await createCampaignAdjustmentsRepository(trx).deleteAdjustmentById({
        campaignId: input.campaignId,
        id: adjustment.id,
        expectedVersion: input.expectedVersion
      }))
    ) {
      throw new CampaignConflictError('Campaign adjustment changed before this delete completed.')
    }
    const event = await createCampaignAdjustmentsRepository(trx).insertCampaignEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      subjectCharacterId: input.characterId,
      kind: 'CAMPAIGN_ADJUSTMENT_DELETED',
      visibility: adjustment.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'DELETED',
        adjustmentId: adjustment.id,
        family: adjustment.family,
        slotKey: adjustment.slotKey,
        version: adjustment.version
      }
    })
    return { adjustment, event }
  })

  await broadcastAdjustment(
    db,
    input.campaignId,
    input.characterId,
    result.event.id,
    result.adjustment.visibility,
    'DELETED'
  )
}

export async function listCampaignConditions(
  db: DBLike,
  userId: string,
  input: ListCampaignAdjustmentsInput
): Promise<CampaignConditionDto[]> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  await assertAssignedCharacter(db, authority, input.characterId)
  const conditions = await createCampaignAdjustmentsRepository(db).listAdjustments(
    input.campaignId,
    input.characterId
  )
  return campaignConditionsDtoSchema.parse(
    conditions
      .filter(
        (condition) =>
          condition.family === 'CONDITION' &&
          (authority.membership.role === 'OWNER' || condition.visibility === 'VISIBLE')
      )
      .map(toConditionDto)
  )
}

export async function saveCampaignCondition(
  db: DBLike,
  userId: string,
  input: SaveCampaignConditionInput
): Promise<CampaignConditionDto> {
  const result = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await assertAssignedCharacter(trx, authority, input.characterId)
    const character = await createCharacterRepository(trx).findAuthoredById(input.characterId)
    if (!character) throw new CampaignValidationError('Assigned character is unavailable.')
    await validateCharacterConditionType(trx, character.systemId, input.conditionTypeId)

    const saved = await createCampaignAdjustmentsRepository(trx).saveAdjustment({
      campaignId: input.campaignId,
      characterId: input.characterId,
      family: 'CONDITION',
      slotKey: input.conditionTypeId,
      payload: {
        conditionTypeId: input.conditionTypeId,
        ...(input.notes ? { notes: input.notes } : {})
      },
      visibility: input.visibility,
      createdBy: userId,
      expectedVersion: input.expectedVersion,
      updatedAt: new Date().toISOString()
    })
    if (!saved)
      throw new CampaignConflictError('Campaign condition changed before this save completed.')
    const event = await createCampaignAdjustmentsRepository(trx).insertCampaignEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      subjectCharacterId: input.characterId,
      kind: 'CAMPAIGN_CONDITION_SAVED',
      visibility: input.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'SAVED',
        conditionId: saved.id,
        conditionTypeId: input.conditionTypeId,
        version: saved.version
      }
    })
    return { condition: saved, event }
  })

  await broadcastAdjustment(
    db,
    input.campaignId,
    input.characterId,
    result.event.id,
    result.condition.visibility,
    result.condition.version === 0 ? 'CREATED' : 'UPDATED'
  )
  return toConditionDto(result.condition)
}

export async function deleteCampaignCondition(
  db: DBLike,
  userId: string,
  input: DeleteCampaignConditionInput
): Promise<void> {
  const result = await withTransaction(db, async (trx) => {
    await lockCampaign(trx, input.campaignId)
    const authority = await resolveCampaignAuthority(trx, input.campaignId, userId)
    assertCampaignOwner(authority)
    assertCampaignWritable(authority)
    await assertAssignedCharacter(trx, authority, input.characterId)
    const repository = createCampaignAdjustmentsRepository(trx)
    const condition = (await repository.listAdjustments(input.campaignId, input.characterId)).find(
      (candidate) => candidate.id === input.conditionId && candidate.family === 'CONDITION'
    )
    if (
      !condition ||
      !(await repository.deleteAdjustmentById({
        campaignId: input.campaignId,
        id: input.conditionId,
        expectedVersion: input.expectedVersion
      }))
    ) {
      throw new CampaignConflictError('Campaign condition changed before this delete completed.')
    }
    const event = await repository.insertCampaignEvent({
      campaignId: input.campaignId,
      actorUserId: userId,
      subjectCharacterId: input.characterId,
      kind: 'CAMPAIGN_CONDITION_DELETED',
      visibility: condition.visibility === 'VISIBLE' ? 'SUBJECT' : 'OWNER',
      payload: {
        action: 'DELETED',
        conditionId: condition.id,
        conditionTypeId: condition.slotKey,
        version: condition.version
      }
    })
    return { condition, event }
  })

  await broadcastAdjustment(
    db,
    input.campaignId,
    input.characterId,
    result.event.id,
    result.condition.visibility,
    'DELETED'
  )
}

export async function listCampaignEvents(
  db: DBLike,
  userId: string,
  input: ListCampaignEventsInput
): Promise<CampaignEventPageDto> {
  const authority = await resolveCampaignAuthority(db, input.campaignId, userId)
  await assertAssignedCharacter(db, authority, input.characterId)
  const events = await createCampaignAdjustmentsRepository(db).listVisibleEvents({
    campaignId: input.campaignId,
    viewer:
      authority.membership.role === 'OWNER'
        ? { kind: 'OWNER' }
        : { kind: 'SUBJECT', characterId: input.characterId },
    cursorId: input.cursor,
    limit: input.limit ?? 50
  })
  const limit = input.limit ?? 50
  return campaignEventPageDtoSchema.parse({
    events: events.slice(0, limit).map(toEventDto),
    nextCursor: events.length > limit ? (events[limit - 1]?.id ?? null) : null
  })
}
