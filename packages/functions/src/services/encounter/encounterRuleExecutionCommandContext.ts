import {
  createCampaignRepository,
  createEncounterRepository,
  type DBLike,
  type EncounterRecord
} from '@artificer-toolkit/db'
import { sql } from 'kysely'

import {
  assertActiveCampaignMember,
  assertCampaignOwner,
  assertCampaignWritable,
  resolveCampaignAuthority
} from '../campaign/campaignService.js'
import type { CampaignRole } from '@artificer-toolkit/db'
import {
  assertSessionLiveSessionCommandAuthority,
  type LiveSessionCommandAuthority
} from '../campaign/liveSessionCommandAuthority.js'
import { EncounterConflictError, EncounterNotFoundError } from './encounterErrors.js'
import type { RuleExecutionAggregatePort } from '../rules/ruleExecutionOccurrenceService.js'

const lockedEncounterRuleExecutionCommandContextBrand: unique symbol = Symbol(
  'lockedEncounterRuleExecutionCommandContext'
)

export interface LockedEncounterRuleExecutionCommandContext {
  readonly [lockedEncounterRuleExecutionCommandContextBrand]: true
  actorUserId: string
  assignedCharacterId: string | null
  attunementSlotOverride: number | null
  campaignId: string
  role: CampaignRole
  currentVersion: number
  encounterId: string
  advanceVersion(expectedVersion: number): Promise<number>
  /**
   * Root-occurrence capability for this exact locked Encounter transaction.
   * It reuses the existing authorization and may advance the Encounter.
   */
  createRootOccurrencePort(): RuleExecutionAggregatePort
  /**
   * Server-only child-occurrence capability for this exact locked Encounter
   * transaction. It cannot acquire roots, reauthorize, or advance the Encounter.
   */
  createReceiptOnlyChildOccurrencePort(): RuleExecutionAggregatePort
}

/**
 * Encounter-owned command context. It locates without authorizing, then locks
 * Campaign -> Session/lease -> Encounter and revalidates the relationship.
 */
export async function lockEncounterRuleExecutionCommandContext(
  db: DBLike,
  input: {
    actorUserId: string
    authority?: 'ACTIVE_MEMBER' | 'OWNER'
    encounterId: string
    liveSessionAuthority?: LiveSessionCommandAuthority
    readOnly?: boolean
  }
): Promise<{
  encounter: EncounterRecord
  context: LockedEncounterRuleExecutionCommandContext
}> {
  if (!db.isTransaction) {
    throw new EncounterConflictError('Encounter rule execution requires an active transaction.')
  }
  const located = await db
    .selectFrom('encounters')
    .select(['campaign_id', 'session_id'])
    .where('id', '=', input.encounterId)
    .executeTakeFirst()
  if (!located) throw new EncounterNotFoundError()

  const campaign = await createCampaignRepository(db).lockCampaign(located.campaign_id)
  if (!campaign) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, campaign.id, input.actorUserId)
  if (input.authority === 'ACTIVE_MEMBER') assertActiveCampaignMember(authority)
  else assertCampaignOwner(authority)
  assertCampaignWritable(authority)

  const session = await sql<{ id: string; status: string }>`
    SELECT id, status FROM public.campaign_sessions
    WHERE id = ${located.session_id} AND campaign_id = ${campaign.id}
    FOR UPDATE
  `.execute(db)
  if (session.rows[0]?.status !== 'OPEN') {
    throw new EncounterConflictError('Finished Sessions cannot change Encounters.')
  }
  if (!input.readOnly) {
    await assertSessionLiveSessionCommandAuthority(
      db,
      located.session_id,
      input.liveSessionAuthority
    )
  }

  const encounter = await createEncounterRepository(db).lock(input.encounterId)
  if (
    !encounter ||
    encounter.campaignId !== campaign.id ||
    encounter.sessionId !== located.session_id
  ) {
    throw new EncounterNotFoundError()
  }
  const encounterId = encounter.id
  const campaignId = campaign.id
  const actorUserId = input.actorUserId
  let effectiveVersion = encounter.version

  async function advanceVersion(expectedVersion: number): Promise<number> {
    if (input.readOnly) {
      throw new EncounterConflictError('Read-only Encounter access cannot change an Encounter.')
    }
    if (expectedVersion !== effectiveVersion) {
      throw new EncounterConflictError('Encounter changed before execution.')
    }
    const updated = await db
      .updateTable('encounters')
      .set({ version: effectiveVersion + 1 })
      .where('id', '=', encounterId)
      .where('campaign_id', '=', campaignId)
      .where('version', '=', expectedVersion)
      .returning('version')
      .executeTakeFirst()
    if (!updated) throw new EncounterConflictError('Encounter changed before execution.')
    effectiveVersion = updated.version
    return effectiveVersion
  }

  function createRootOccurrencePort(): RuleExecutionAggregatePort {
    if (input.readOnly) {
      throw new EncounterConflictError('Read-only Encounter access cannot create rule occurrences.')
    }
    return {
      async withLockedAuthorized(rootDb, run) {
        if (rootDb !== db) {
          throw new EncounterConflictError(
            'Encounter root occurrence escaped its owning transaction.'
          )
        }
        return run({
          aggregateKind: 'ENCOUNTER',
          aggregateId: encounterId,
          campaignId,
          actorUserId,
          get currentVersion() {
            return effectiveVersion
          },
          async advanceVersion(advanceDb, expectedVersion) {
            if (advanceDb !== db) {
              throw new EncounterConflictError(
                'Encounter root occurrence escaped its owning transaction.'
              )
            }
            return advanceVersion(expectedVersion)
          }
        })
      }
    }
  }

  function createReceiptOnlyChildOccurrencePort(): RuleExecutionAggregatePort {
    if (input.readOnly) {
      throw new EncounterConflictError('Read-only Encounter access cannot create rule occurrences.')
    }
    const childEffectiveVersion = effectiveVersion
    return {
      async withLockedAuthorized(childDb, run) {
        if (childDb !== db) {
          throw new EncounterConflictError(
            'Encounter child occurrence escaped its owning transaction.'
          )
        }
        if (childEffectiveVersion !== effectiveVersion) {
          throw new EncounterConflictError(
            'Encounter changed before its child occurrence could start.'
          )
        }
        return run({
          aggregateKind: 'ENCOUNTER',
          aggregateId: encounterId,
          campaignId,
          actorUserId,
          currentVersion: childEffectiveVersion,
          async advanceVersion() {
            throw new EncounterConflictError(
              'Receipt-only child occurrences cannot advance the Encounter.'
            )
          }
        })
      }
    }
  }

  return {
    encounter,
    context: {
      [lockedEncounterRuleExecutionCommandContextBrand]: true,
      actorUserId,
      assignedCharacterId: authority.assignedCharacter?.id ?? null,
      attunementSlotOverride: campaign.attunementSlotOverride,
      campaignId,
      role: authority.membership.role,
      get currentVersion() {
        return effectiveVersion
      },
      encounterId,
      advanceVersion,
      createRootOccurrencePort,
      createReceiptOnlyChildOccurrencePort
    }
  }
}
