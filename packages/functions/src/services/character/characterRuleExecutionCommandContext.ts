import {
  createCampaignRepository,
  createCampaignCharacterMechanicsProjectionRepository,
  createCampaignContentShareRepository,
  type DBLike
} from '@artificer-toolkit/db'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'

import {
  assertCharacterLiveSessionCommandAuthority,
  type LiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import { lockCharacterAssignmentAuthority } from './characterAssignmentAuthority.js'
import { resolveCharacterSheetCampaignContext } from './campaignCharacterSheet.js'
import { CharacterSheetCommandError, createNamedError } from './sheetCommandReducer.js'

export interface LockedCharacterRuleExecutionCommandContext {
  actorUserId: string
  campaignId?: string
  characterId: string
  currentVersion: number
  advanceVersion(expectedVersion: number): Promise<number>
}

export async function lockAssignedCharacterSheetCampaignCommandAccess(
  db: DBLike,
  input: { campaignId: string; characterId: string; userId: string }
): Promise<void> {
  const access = await createCampaignContentShareRepository(db).lockCampaignMemberForContentRead({
    campaignId: input.campaignId,
    userId: input.userId
  })
  if (!access.campaignExists || !access.memberActive) {
    throw createNamedError(
      'CampaignContentShareUnavailableError',
      `Campaign access is unavailable for Character "${input.characterId}".`
    )
  }
  await createCampaignCharacterMechanicsProjectionRepository(db).lockAssignment({
    campaignId: input.campaignId,
    characterId: input.characterId
  })
}

/**
 * Sheet-owned command context. Assigned Characters take the established
 * Campaign/member/assignment/lease lane before the Character root lock.
 */
export async function withLockedCharacterRuleExecutionCommandContext<T>(
  db: DBLike,
  input: {
    actorUserId: string
    characterId: string
    liveSessionAuthority?: LiveSessionCommandAuthority
  },
  run: (context: LockedCharacterRuleExecutionCommandContext) => Promise<T>
): Promise<T> {
  await lockCharacterAssignmentAuthority(db, input.characterId)
  const located = await db
    .selectFrom('characters')
    .select(['id', 'user_id'])
    .where('id', '=', input.characterId)
    .executeTakeFirst()
  if (!located) throw new CharacterSheetCommandError('Character rule execution is unavailable.')

  const locatedAssignment = await createCampaignRepository(db).findCampaignByCharacter(located.id)
  let currentCampaignContext: Awaited<
    ReturnType<typeof resolveCharacterSheetCampaignContext>
  > | null = null
  if (locatedAssignment) {
    await lockAssignedCharacterSheetCampaignCommandAccess(db, {
      campaignId: locatedAssignment.campaignId,
      characterId: located.id,
      userId: input.actorUserId
    })
    await assertCharacterLiveSessionCommandAuthority(db, located.id, input.liveSessionAuthority)
    currentCampaignContext = await resolveCharacterSheetCampaignContext(
      db,
      { id: located.id, userId: located.user_id },
      input.actorUserId
    )
    if (currentCampaignContext.campaignId !== locatedAssignment.campaignId) {
      throw new CharacterSheetCommandError(
        'Character Campaign assignment changed before execution.'
      )
    }
    if (currentCampaignContext.campaignStatus !== 'ACTIVE') {
      throw new CharacterSheetCommandError('Archived Campaigns are read-only.')
    }
  } else {
    await assertCharacterLiveSessionCommandAuthority(db, located.id, input.liveSessionAuthority)
  }

  const character = await db
    .selectFrom('characters')
    .select(['id', 'user_id', 'status', 'rule_pack_revision_id', 'stream_version'])
    .where('id', '=', located.id)
    .forUpdate()
    .executeTakeFirst()
  if (
    !character ||
    character.status !== AUTHORED_RECORD_STATUS.ACTIVE ||
    !character.rule_pack_revision_id
  ) {
    throw new CharacterSheetCommandError('Character is not finalized with a pinned rule revision.')
  }
  if (!currentCampaignContext && character.user_id !== input.actorUserId) {
    throw new CharacterSheetCommandError('Character rule execution is unavailable.')
  }

  return run({
    actorUserId: input.actorUserId,
    ...(currentCampaignContext?.campaignId
      ? { campaignId: currentCampaignContext.campaignId }
      : {}),
    characterId: character.id,
    currentVersion: character.stream_version,
    async advanceVersion(expectedVersion) {
      const updated = await db
        .updateTable('characters')
        .set({ stream_version: expectedVersion + 1 })
        .where('id', '=', character.id)
        .where('stream_version', '=', expectedVersion)
        .returning('stream_version')
        .executeTakeFirst()
      if (!updated) throw new CharacterSheetCommandError('Character changed before execution.')
      return updated.stream_version
    }
  })
}
