import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { characterStoredDraftSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  reconcileCharacterAuthoredSourceLoss,
  type CharacterSourceLossTarget
} from '@artificer-toolkit/rules-runtime/character/characterSourceLoss'
import { evaluateCharacterRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import {
  equalCharacterPlayRecordStats,
  resolveCharacterPlayRecordStats,
  type CharacterPlayRecordStats
} from '@artificer-toolkit/rules-runtime/character/characterRecordStats'
import { mergeCampaignSheetAdjustments } from '@artificer-toolkit/rules-runtime/character/campaignCharacterSheet'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  insertCharacterDraftPayload,
  readCharacterDraft,
  readCharacterRecord,
  readCharacterSheetState,
  replaceCharacterDraftPayload
} from './documents'
import { prepareCharacterBuilder } from './builderPreparation'
import { readCampaignCharacterState } from '../campaigns/characterState'
import { readCharacterCampaign } from './context'
import { readCharacterAuthoredChoiceKinds } from './sourceAccessLoss'
import { readVisibleAuthoredRouteId } from '../content/routeIds'
import { writeCharacterRecord } from './characterWrites'
import type { CharacterRow } from './stateDocuments'

export interface CharacterSourceLossResult {
  characterId: string
  status: 'ACTIVE' | 'DRAFT'
  streamVersion: number
  draftOnly: boolean
  removedSources: CharacterSourceLossTarget[]
  campaign: Doc<'campaigns'> | null
}

function targetKey(target: CharacterSourceLossTarget): string {
  return `${target.subjectKind}:${target.subjectId}`
}

function canonicalTargets(targets: readonly CharacterSourceLossTarget[]) {
  return [...new Map(targets.map((target) => [targetKey(target), target])).values()].sort(
    (left, right) => targetKey(left).localeCompare(targetKey(right))
  )
}

function removeSources(
  character: CharacterAuthored,
  targets: readonly CharacterSourceLossTarget[],
  chosenGrantKinds: ReadonlyMap<string, CharacterSourceLossTarget['subjectKind']>
): CharacterAuthored {
  return targets.reduce(
    (current, target) => reconcileCharacterAuthoredSourceLoss(current, target, chosenGrantKinds),
    character
  )
}

function referencedTargets(
  character: CharacterAuthored,
  targets: readonly CharacterSourceLossTarget[],
  chosenGrantKinds: ReadonlyMap<string, CharacterSourceLossTarget['subjectKind']>
) {
  return targets.filter(
    (target) =>
      JSON.stringify(reconcileCharacterAuthoredSourceLoss(character, target, chosenGrantKinds)) !==
      JSON.stringify(character)
  )
}

function nextTimestamp(...timestamps: Array<string | undefined>): string {
  return new Date(
    Math.max(Date.now(), ...timestamps.flatMap((value) => (value ? [Date.parse(value) + 1] : [])))
  ).toISOString()
}

function draftHead(draft: Doc<'characterDrafts'>) {
  return {
    id: draft.id,
    characterId: draft.characterId,
    userId: draft.userId,
    systemId: draft.systemId,
    publicId: draft.publicId,
    status: draft.status,
    mode: draft.mode,
    baseActiveUpdatedAt: draft.baseActiveUpdatedAt,
    createdAt: draft.createdAt
  }
}

async function saveDraft(input: {
  ctx: MutationCtx
  active: CharacterRow
  draft: Doc<'characterDrafts'> | null
  character: CharacterAuthored
  builderIntent?: unknown
  baseActiveUpdatedAt: string
}) {
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    character: { ...input.character, status: 'DRAFT' },
    ...(input.builderIntent ? { builderIntent: input.builderIntent } : {})
  })
  const now = nextTimestamp(input.active.updatedAt, input.draft?.updatedAt)
  if (input.draft) {
    const payloadRecord = await replaceCharacterDraftPayload(input.ctx, input.draft, payload, now)
    await input.ctx.db.replace(
      input.draft._id,
      characterStoredDraftSchema.parse({
        ...draftHead(input.draft),
        label: payload.character.label || 'Untitled Character',
        baseActiveUpdatedAt: input.baseActiveUpdatedAt,
        updatedAt: now,
        payloadId: payloadRecord.payloadId,
        payloadDocumentId: payloadRecord.payloadDocumentId,
        checksum: payloadRecord.checksum
      })
    )
    return
  }
  const payloadRecord = await insertCharacterDraftPayload(input.ctx, input.active.id, payload, now)
  const route = await readVisibleAuthoredRouteId(input.ctx, { subjectId: input.active.id })
  if (!route || route.subjectKind !== 'CHARACTER' || route.ownerUserId !== input.active.userId)
    throw new Error('Stored Character route identity mismatch.')
  await input.ctx.db.insert(
    'characterDrafts',
    characterStoredDraftSchema.parse({
      id: crypto.randomUUID(),
      characterId: input.active.id,
      userId: input.active.userId,
      systemId: input.active.systemId,
      publicId: route.publicId,
      label: payload.character.label || 'Untitled Character',
      status: 'DRAFT',
      mode: 'edit',
      baseActiveUpdatedAt: input.baseActiveUpdatedAt,
      createdAt: now,
      updatedAt: now,
      payloadId: payloadRecord.payloadId,
      payloadDocumentId: payloadRecord.payloadDocumentId,
      checksum: payloadRecord.checksum
    })
  )
}

/** The draft Character carrying the held rules the active Character retained for the same items. */
function withHeldRules(draft: CharacterAuthored, current: CharacterAuthored): CharacterAuthored {
  const retainedByItemId = new Map(current.state.equipment.inventory.map((item) => [item.id, item]))
  return {
    ...draft,
    state: {
      ...draft.state,
      equipment: {
        ...draft.state.equipment,
        inventory: draft.state.equipment.inventory.map((item) => {
          const held = retainedByItemId.get(item.id)
          return held?.equipmentId === item.equipmentId && held.retainedRulesJson
            ? { ...item, retainedRulesJson: held.retainedRulesJson }
            : item
        })
      }
    }
  }
}

/** The Character's draft, carrying the held rules its active record retained, and both choice maps. */
async function readSourceLossSubjects(
  ctx: MutationCtx,
  record: CharacterRow,
  current: CharacterAuthored
) {
  const draftRecord = await ctx.db
    .query('characterDrafts')
    .withIndex('by_characterId', (q) => q.eq('characterId', current.id))
    .unique()
  if (draftRecord && draftRecord.userId !== current.userId)
    throw new Error('Stored Character draft ownership mismatch.')
  const draft = draftRecord ? await readCharacterDraft(ctx, draftRecord, record) : null
  const draftCharacterWithRetainedRules = draft
    ? withHeldRules(draft.payload.character as CharacterAuthored, current)
    : null
  const currentChoiceKinds = await readCharacterAuthoredChoiceKinds(ctx, current)
  const draftChoiceKinds = draft
    ? await readCharacterAuthoredChoiceKinds(ctx, draftCharacterWithRetainedRules!)
    : new Map<string, CharacterSourceLossTarget['subjectKind']>()
  return {
    draftRecord,
    draft,
    draftCharacterWithRetainedRules,
    currentChoiceKinds,
    draftChoiceKinds
  }
}

/**
 * Whether removing these sources reaches the Character's build or its draft: the test a Campaign
 * removal runs before it queues the Character's reconcile. It reads no Builder inputs.
 */
export async function characterReferencesSourceLoss(
  ctx: MutationCtx,
  record: CharacterRow,
  targets: readonly CharacterSourceLossTarget[]
): Promise<boolean> {
  const current = readCharacterRecord(record) as CharacterAuthored
  const subjects = await readSourceLossSubjects(ctx, record, current)
  return (
    referencedTargets(current, targets, subjects.currentChoiceKinds).length > 0 ||
    (subjects.draftCharacterWithRetainedRules !== null &&
      referencedTargets(
        subjects.draftCharacterWithRetainedRules,
        targets,
        subjects.draftChoiceKinds
      ).length > 0)
  )
}

/**
 * Writes a Campaign context change that must commit with the authority change (held rules retained
 * before a source goes, currency returned at departure) ahead of the Character's scheduled
 * reconcile. Both are structure, so a live hold does not refuse it. Play and the stream version
 * stay; the reconcile counts this write as its change (`persistedContextChange`). Returns whether
 * anything was written.
 */
export async function persistCharacterContextChange(
  ctx: MutationCtx,
  record: CharacterRow,
  state: CharacterAuthored['state']
): Promise<boolean> {
  const document = readCharacterRecord(record) as CharacterAuthored
  const next = { ...document, state }
  if (
    checksumRuleDocument(JSON.parse(JSON.stringify(next))) ===
    checksumRuleDocument(JSON.parse(JSON.stringify(document)))
  )
    return false
  const { maximumHitPoints, speeds, classSummary, totalLevel } = record.play
  const written = await writeCharacterRecord(ctx, {
    current: record,
    fields: {
      streamVersion: record.play.streamVersion,
      updatedAt: nextTimestamp(record.updatedAt)
    },
    document: next,
    stats: { maximumHitPoints, speeds, classSummary, totalLevel }
  })
  // An open draft moves with the Character, as the reconcile moves it, so it stays committable
  // while the reconcile is queued: it takes the retained rules and the server-owned currency.
  const draftRecord = await ctx.db
    .query('characterDrafts')
    .withIndex('by_characterId', (q) => q.eq('characterId', record.id))
    .unique()
  if (draftRecord) {
    const draft = await readCharacterDraft(ctx, draftRecord, record)
    const carried = withHeldRules(draft.payload.character as CharacterAuthored, next)
    await saveDraft({
      ctx,
      active: { ...record, updatedAt: written.row.updatedAt },
      draft: draftRecord,
      character: { ...carried, state: { ...carried.state, currency: state.currency } },
      builderIntent: draft.payload.builderIntent,
      baseActiveUpdatedAt: written.row.updatedAt
    })
  }
  return true
}

/** Reconciles one owned Character after its sources or its Campaign context changed. */
export async function reconcileCharacterSourceLoss(input: {
  ctx: MutationCtx
  record: CharacterRow
  targets: readonly CharacterSourceLossTarget[]
  /** Departure changes source/overlay authority even when no authored root was lost. */
  stateAfterContextChange?: CharacterAuthored['state']
  /** An earlier transaction wrote the context change (`persistCharacterContextChange`). */
  persistedContextChange?: boolean
}): Promise<CharacterSourceLossResult | null> {
  const targets = canonicalTargets(input.targets)
  const original = readCharacterRecord(input.record) as CharacterAuthored
  const current = input.stateAfterContextChange
    ? { ...original, state: input.stateAfterContextChange }
    : original
  const campaign = await readCharacterCampaign(input.ctx, current, current.userId)
  const {
    draftRecord,
    draft,
    draftCharacterWithRetainedRules,
    currentChoiceKinds,
    draftChoiceKinds
  } = await readSourceLossSubjects(input.ctx, input.record, current)
  const canonicalLosses = referencedTargets(current, targets, currentChoiceKinds)
  const draftLosses = draft
    ? referencedTargets(draftCharacterWithRetainedRules!, targets, draftChoiceKinds)
    : []
  if (canonicalLosses.length === 0 && draftLosses.length === 0 && !input.stateAfterContextChange)
    return null

  if (canonicalLosses.length === 0 && !input.stateAfterContextChange) {
    await saveDraft({
      ctx: input.ctx,
      active: input.record,
      draft: draftRecord,
      character: removeSources(draftCharacterWithRetainedRules!, draftLosses, draftChoiceKinds),
      builderIntent: draft!.payload.builderIntent,
      baseActiveUpdatedAt: draftRecord!.baseActiveUpdatedAt ?? input.record.updatedAt
    })
    return {
      characterId: current.id,
      status: input.record.status,
      streamVersion: input.record.play.streamVersion,
      draftOnly: true,
      removedSources: canonicalTargets(draftLosses),
      campaign
    }
  }

  const pruned = removeSources(
    input.stateAfterContextChange ? { ...current, state: input.stateAfterContextChange } : current,
    canonicalLosses,
    currentChoiceKinds
  )
  let character: CharacterAuthored = { ...pruned, status: 'DRAFT' }
  let stats: CharacterPlayRecordStats | undefined
  if (input.record.status === 'ACTIVE') {
    const prepared = await prepareCharacterBuilder(input.ctx, {
      character,
      current: { ...pruned, status: 'ACTIVE' },
      mode: 'edit'
    })
    if (prepared.resolution.readiness.ready) {
      const sheetState = readCharacterSheetState(input.record)
      const campaignState = campaign
        ? (await readCampaignCharacterState(input.ctx, campaign.id, current.id)).state
        : null
      const adjustments = campaignState
        ? mergeCampaignSheetAdjustments(
            sheetState.adjustments,
            campaignState.adjustments.map((record) => ({
              ...record.adjustment,
              id: record.id,
              characterId: current.id,
              createdBy: record.createdBy,
              updatedBy: record.createdBy,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt
            }))
          )
        : sheetState.adjustments
      const evaluation = evaluateCharacterRules({
        character: prepared.character,
        context: prepared.context,
        spellsById: prepared.context.spellsById,
        creaturesById: prepared.context.creaturesById,
        adjustments,
        attunementSlotOverride:
          prepared.context.sourceAccess.campaign?.attunementSlotOverride ?? null,
        resourceUsage: sheetState.resourceUsage,
        movementDisplayPreference: sheetState.movementDisplayPreference
      })
      stats = resolveCharacterPlayRecordStats({ ruleEvaluation: evaluation, prepared })
      character = {
        ...prepared.character,
        status: 'ACTIVE',
        state: {
          ...prepared.character.state,
          // Slots a departed Campaign granted end with it; the earliest attunements keep theirs.
          equipment: {
            ...prepared.character.state.equipment,
            attuned: prepared.character.state.equipment.attuned.slice(
              0,
              evaluation.output.rest.attunementSlotLimit
            )
          },
          hitpoints: {
            ...prepared.character.state.hitpoints,
            current: Math.min(
              Math.max(prepared.character.state.hitpoints.current, 0),
              stats.maximumHitPoints
            )
          }
        }
      }
    } else character = { ...prepared.character, status: 'DRAFT' }
  }
  const status: 'ACTIVE' | 'DRAFT' = character.status === 'ACTIVE' ? 'ACTIVE' : 'DRAFT'
  const committed = characterAuthoredDtoSchema.parse({ ...character, status })
  const encoded: unknown = JSON.parse(JSON.stringify(committed))
  const checksum = checksumRuleDocument(encoded)
  const changed =
    input.persistedContextChange === true ||
    checksum !== checksumRuleDocument(JSON.parse(JSON.stringify(original)))
  const streamVersion = input.record.play.streamVersion + (changed ? 1 : 0)
  // Departed Campaign adjustments and attunement can move the stored maximums alone.
  const statsChanged =
    stats !== undefined && !equalCharacterPlayRecordStats(stats, input.record.play)
  const written =
    changed || statsChanged
      ? await writeCharacterRecord(input.ctx, {
          current: input.record,
          fields: {
            label: committed.label,
            status,
            streamVersion,
            updatedAt: nextTimestamp(input.record.updatedAt)
          },
          document: committed,
          ...(stats === undefined ? {} : { stats })
        })
      : null
  // The structure clock moves only when the structure does (a play-only change leaves it).
  const updatedAt = written?.row.updatedAt ?? input.record.updatedAt

  let draftChanged = false
  if (draftRecord) {
    const draftCharacter = removeSources(
      draftCharacterWithRetainedRules!,
      targets,
      draftChoiceKinds
    )
    if (input.stateAfterContextChange) {
      // Currency is Sheet-owned; departure refreshes the draft from current server state.
      draftCharacter.state.currency = input.stateAfterContextChange.currency
    }
    draftChanged =
      checksumRuleDocument(JSON.parse(JSON.stringify(draftCharacter))) !==
      checksumRuleDocument(JSON.parse(JSON.stringify(draft!.payload.character)))
    if (changed || draftChanged)
      await saveDraft({
        ctx: input.ctx,
        active: { ...input.record, updatedAt },
        draft: draftRecord,
        character: draftCharacter,
        builderIntent: draft!.payload.builderIntent,
        baseActiveUpdatedAt: changed ? updatedAt : (draftRecord.baseActiveUpdatedAt ?? updatedAt)
      })
  } else if (status === 'DRAFT' && changed) {
    await saveDraft({
      ctx: input.ctx,
      active: { ...input.record, updatedAt },
      draft: null,
      character: committed as CharacterAuthored,
      baseActiveUpdatedAt: updatedAt
    })
  }
  if (!changed && !draftChanged) return null
  return {
    characterId: current.id,
    status,
    streamVersion,
    draftOnly: !changed,
    removedSources: canonicalTargets([...canonicalLosses, ...draftLosses]),
    campaign
  }
}

/** Directly prunes an owned create-only draft without creating an active Character. */
export async function reconcileCreateOnlyCharacterDraftSourceLoss(input: {
  ctx: MutationCtx
  draft: Doc<'characterDrafts'>
  targets: readonly CharacterSourceLossTarget[]
}): Promise<CharacterSourceLossTarget[] | null> {
  const targets = canonicalTargets(input.targets)
  const draft = await readCharacterDraft(input.ctx, input.draft, null)
  const character = draft.payload.character as CharacterAuthored
  const choiceKinds = await readCharacterAuthoredChoiceKinds(input.ctx, character)
  const losses = referencedTargets(character, targets, choiceKinds)
  if (losses.length === 0) return null
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    character: { ...removeSources(character, losses, choiceKinds), status: 'DRAFT' },
    ...(draft.payload.builderIntent ? { builderIntent: draft.payload.builderIntent } : {})
  })
  const now = nextTimestamp(input.draft.updatedAt)
  const payloadRecord = await replaceCharacterDraftPayload(input.ctx, input.draft, payload, now)
  await input.ctx.db.replace(
    input.draft._id,
    characterStoredDraftSchema.parse({
      ...draftHead(input.draft),
      label: payload.character.label || 'Untitled Character',
      updatedAt: now,
      payloadId: payloadRecord.payloadId,
      payloadDocumentId: payloadRecord.payloadDocumentId,
      checksum: payloadRecord.checksum
    })
  )
  return canonicalTargets(losses)
}
