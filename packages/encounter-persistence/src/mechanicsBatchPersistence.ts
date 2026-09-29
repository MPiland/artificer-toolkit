import { characterHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/characterHistory'
import { characterStoredCommandReceiptSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type {
  ReceiptApplications,
  TargetState
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { readRunActor, readRunState, writeRunActor } from './documents.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { z } from 'zod'
import type {
  EncounterMechanicsBatchInput,
  EncounterMechanicsBatchPlan
} from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { rejectDomain } from './domainRejections.js'
import type { EncounterDocument } from './store.js'
import type { EncounterWriteTransaction } from './ports.js'

export type EncounterMechanicsBatchResult = {
  updatedActor: Awaited<ReturnType<typeof readRunActor>>
  receiptApplications: ReceiptApplications
  targetTransition: {
    checksum: string
    before: TargetState
    after: TargetState
  }
  characterStreamVersion: number | null
  itemUseStateTransition: EncounterMechanicsBatchPlan['itemUseStateTransition']
  characterReceiptId: string | null
}

function validateInput(input: EncounterMechanicsBatchInput): EncounterMechanicsBatchInput {
  const [encounterId, targetActorId, occurrenceId, sourceCommandId, commandId] = [
    input.encounterId,
    input.targetActorId,
    input.occurrenceId,
    input.sourceCommandId,
    input.commandId
  ].map((id) => postgresUuidSchema.parse(id))
  if (!Number.isSafeInteger(input.expectedEncounterVersion) || input.expectedEncounterVersion < 0)
    throw new Error('Encounter version is invalid.')
  if (!Number.isSafeInteger(input.effectiveMaximumHitPoints) || input.effectiveMaximumHitPoints < 0)
    throw new Error('Effective maximum hit points are invalid.')
  if (
    input.expectedCharacterStreamVersion !== null &&
    (!Number.isSafeInteger(input.expectedCharacterStreamVersion) ||
      input.expectedCharacterStreamVersion < 0)
  )
    throw new Error('Expected Character stream version is invalid.')
  return {
    ...input,
    encounterId,
    targetActorId,
    occurrenceId,
    sourceCommandId,
    commandId,
    occurredAt: z.iso.datetime().parse(input.occurredAt)
  }
}

/** Authorizes current Run and actor state without evaluating Character rules. */
export async function readEncounterMechanicsBatchTarget<CharacterSources>(
  ctx: EncounterWriteTransaction<CharacterSources>,
  input: EncounterMechanicsBatchInput
) {
  input = validateInput(input)
  const { userId } = await ctx.ports.requireIdentity()
  const runRow = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (query) => query.eq('id', input.encounterId.toLowerCase()))
    .unique()
  if (!runRow) throw new Error('Encounter Run was not found.')
  const state = readRunState(runRow)
  const { campaign } = await ctx.ports.requireCampaignAuthority(state.campaignId, userId)
  if (campaign.status !== 'ACTIVE') rejectDomain('CAMPAIGN_NOT_ACTIVE')
  if (campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign System is stale.')
  if (state.version !== input.expectedEncounterVersion) rejectDomain('VERSION_STALE')

  const actor = await readRunActor(ctx, state, input.targetActorId.toLowerCase())
  const actorRow = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (query) => query.eq('encounterId', state.id).eq('id', actor.id))
    .unique()
  if (!actorRow) throw new Error('Encounter actor was not found.')
  // Rules evaluate a Character's effective maximum live; only Run-owned maxima are compared.
  if (actor.kind !== 'CHARACTER' && actor.maxHitPoints !== input.effectiveMaximumHitPoints)
    throw new Error('Encounter actor maximum hit points are stale.')
  return { ctx, input, userId, runRow, state, campaign, actor, actorRow }
}

/**
 * Writes a trusted domain plan after current authority and exact aggregate checks. The caller
 * owns source/effect freshness and root command replay in the same transaction. This helper is
 * not a remote-plan authorization boundary and does not evaluate rules or rebuild Sheet facts.
 */
export async function persistEncounterMechanicsBatchPlan<CharacterSources>(
  ctx: EncounterWriteTransaction<CharacterSources>,
  target: Awaited<ReturnType<typeof readEncounterMechanicsBatchTarget>>,
  prepared: {
    actor: Awaited<ReturnType<typeof readRunActor>>
    character: EncounterDocument<'characters'> | null
    plan: EncounterMechanicsBatchPlan
    /** Authored sources already loaded for this Character, reused to evaluate its written state. */
    sourceContext?: CharacterSources
  }
): Promise<EncounterMechanicsBatchResult> {
  if (target.ctx !== ctx)
    throw new Error('Encounter mechanics target belongs to another transaction.')
  const { input, userId, actor, actorRow, campaign } = target
  const { plan, character } = prepared
  const [currentRun, currentActor] = await Promise.all([
    ctx.db.get(target.runRow._id),
    ctx.db.get(actorRow._id)
  ])
  if (
    !currentRun ||
    currentRun.version !== input.expectedEncounterVersion ||
    currentRun.stateChecksum !== target.runRow.stateChecksum
  )
    rejectDomain('VERSION_STALE')
  if (
    checksumCanonicalJson(prepared.actor) !== checksumCanonicalJson(actor) ||
    !currentActor ||
    currentActor.stateChecksum !== actorRow.stateChecksum ||
    currentActor.stateJson !== actorRow.stateJson ||
    plan.updatedActor.id !== actor.id ||
    plan.updatedActor.encounterId !== actor.encounterId ||
    plan.updatedActor.systemId !== actor.systemId ||
    plan.updatedActor.kind !== actor.kind ||
    plan.updatedActor.sourceId !== actor.sourceId
  )
    throw new Error('Encounter mechanics target changed before settlement.')
  if (actor.kind !== 'CHARACTER') {
    if (
      character ||
      plan.characterUpdate ||
      plan.characterStreamVersion !== null ||
      plan.itemUseStateTransition
    )
      throw new Error('Encounter non-Character plan contains Character state.')
    if (plan.stateChanged) await writeRunActor(ctx, actorRow._id, plan.updatedActor)
    return {
      updatedActor: plan.updatedActor,
      receiptApplications: plan.receiptApplications,
      targetTransition: plan.targetTransition,
      characterStreamVersion: null,
      itemUseStateTransition: null,
      characterReceiptId: null
    }
  }
  if (
    !character ||
    character.id !== actor.sourceId ||
    character.systemId !== actor.systemId ||
    character.status !== 'ACTIVE'
  )
    throw new Error('Encounter Character source is unavailable.')
  if (character.streamVersion !== input.expectedCharacterStreamVersion)
    throw new Error('Encounter Character changed after the outcome was planned.')
  const { assignment } = await ctx.ports.requireCampaignCharacterAuthority(
    campaign.id,
    character.id,
    campaign.ownerUserId
  )
  const currentCharacter = await ctx.db.get(character._id)
  if (
    !currentCharacter ||
    assignment.userId !== character.userId ||
    checksumCanonicalJson(currentCharacter) !== checksumCanonicalJson(character)
  )
    throw new Error('Encounter Character changed before settlement.')
  if (
    plan.shouldAdvance !== (plan.characterUpdate !== null) ||
    plan.characterStreamVersion !== (plan.shouldAdvance ? character.streamVersion + 1 : null) ||
    (plan.itemUseStateTransition &&
      (!plan.shouldAdvance ||
        plan.itemUseStateTransition.characterId !== character.id ||
        plan.itemUseStateTransition.beforeStreamVersion !== character.streamVersion)) ||
    (plan.characterUpdate &&
      (plan.characterUpdate.character.id !== character.id ||
        plan.characterUpdate.character.systemId !== character.systemId ||
        plan.characterUpdate.character.userId !== character.userId))
  )
    throw new Error('Encounter Character plan is invalid.')
  const priorReceipt = await ctx.db
    .query('characterCommandReceipts')
    .withIndex('by_characterId_commandId', (query) =>
      query.eq('characterId', character.id).eq('commandId', input.commandId.toLowerCase())
    )
    .unique()
  if (priorReceipt) throw new Error('Encounter Character outcome command already exists.')

  let characterReceiptId: string | null = null
  if (plan.characterUpdate) {
    const characterStreamVersion = plan.characterStreamVersion
    if (characterStreamVersion === null) throw new Error('Encounter Character plan is invalid.')
    await ctx.ports.writeCharacterRecord({
      current: character,
      fields: { streamVersion: characterStreamVersion, updatedAt: input.occurredAt },
      document: JSON.parse(JSON.stringify(plan.characterUpdate.character)),
      ...(plan.characterUpdate.sheetState ? { sheetState: plan.characterUpdate.sheetState } : {}),
      sourceContext: prepared.sourceContext
    })
  }
  const stow = plan.itemUseStateTransition
  if (plan.stateChanged || stow) {
    characterReceiptId = crypto.randomUUID()
    const outcomeCount = plan.receiptApplications.filter(
      (application) =>
        application.kind !== 'HIT_POINT_MAXIMUM_REDUCTION' &&
        application.kind !== 'SCALAR_REDUCTION'
    ).length
    const history = characterHistoryEntryDtoSchema.parse({
      eventId: characterReceiptId,
      occurredAt: input.occurredAt,
      actorId: userId,
      ...(plan.stateChanged
        ? {
            eventType: 'CHARACTER_RULE_OUTCOME_APPLIED',
            summary: `Rule outcomes applied: ${outcomeCount} result${outcomeCount === 1 ? '' : 's'}`
          }
        : {
            eventType: 'CHARACTER_RULE_EQUIPMENT_STATE_APPLIED',
            summary: 'Rule equipment state applied'
          })
    })
    const fingerprint = checksumRuleDocument({
      encounterId: input.encounterId,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.sourceCommandId,
      targetActorId: input.targetActorId,
      applications: plan.receiptApplications,
      ...(stow ? { itemUseStateTransition: stow } : {})
    })
    await ctx.db.insert(
      'characterCommandReceipts',
      characterStoredCommandReceiptSchema.parse({
        id: characterReceiptId,
        characterId: character.id,
        commandId: input.commandId,
        actorId: userId,
        commandFingerprint: fingerprint,
        occurredAt: input.occurredAt,
        historyJson: canonicalizeRuleDocument(history),
        historyChecksum: checksumRuleDocument(history)
      })
    )
  }
  if (checksumCanonicalJson(plan.updatedActor) !== actorRow.stateChecksum)
    await writeRunActor(ctx, actorRow._id, plan.updatedActor)
  return {
    updatedActor: plan.updatedActor,
    receiptApplications: plan.receiptApplications,
    targetTransition: plan.targetTransition,
    characterStreamVersion: plan.characterStreamVersion,
    itemUseStateTransition: stow,
    characterReceiptId
  }
}
