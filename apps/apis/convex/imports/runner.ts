import * as core from 'zod/v4/core'
import { makeFunctionReference } from 'convex/server'
import { v } from 'convex/values'
import {
  buildPortableRootIdMap,
  getDeselectedPortableReferenceIssues,
  getUnavailablePortableReferenceIssues,
  issue,
  readString,
  toRelatedContent,
  validateCollisionResolution,
  type ImportedEquipmentTraits,
  type PreparedAuthoredItem,
  type PreparedBatch,
  type PreparedCharacterItem
} from '@artificer-toolkit/authoring/imports'
import { normalizeImportedAuthoredPayload } from '@artificer-toolkit/authoring/imports'
import { buildImportedCharacter } from '@artificer-toolkit/authoring/imports'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characterBuilder'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import type { ImportResultItemDto } from '@artificer-toolkit/schema/api/imports'
import type { ImportStoredJob } from '@artificer-toolkit/schema/projections/importJobPersistence'
import { backgroundAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/background'
import { classAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/class'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { featAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/feat'
import { raceAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { spellAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/spell'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import { EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'
import { internalAction, type ActionCtx } from '../_generated/server'
import { completeRef } from './finalize'
import { materializeRunnerSource, prepareWithNativeLookup, runnerLookupLoaders } from './preview'
import { loadPreflightRef, loadSourceRef, type ImportRunnerPreflight } from './runnerState'
import { stageAuthoredHeadRef, stageCharacterHeadRef } from './stageDrafts'
import { stageCustomAuthoredRef } from './stageCustomAuthored'
import {
  beginPlanRef,
  encodeImportResult,
  readPlanRef,
  stageResultRef,
  type ImportRunnerPlan
} from './stages'

const failRef = makeFunctionReference<'mutation', { jobId: string; failureReason: string }, null>(
  'imports/jobs:fail'
)

const FAILURE_REASON = 'Import could not be completed.'

const authoredSchemaByKind = {
  BACKGROUND: backgroundAuthoredDtoSchema,
  CLASS: classAuthoredDtoSchema,
  CREATURE: creatureAuthoredDtoSchema,
  EQUIPMENT: equipmentAuthoredDtoSchema,
  FEAT: featAuthoredDtoSchema,
  RACE: raceAuthoredDtoSchema,
  SPELL: spellAuthoredDtoSchema,
  VEHICLE: vehicleAuthoredDtoSchema
} satisfies Record<AuthoredSubjectKindDto, core.$ZodType>

type ImportCommand = ImportStoredJob['command']

type PlannedEntry =
  | { kind: 'RESULT'; result: ImportResultItemDto }
  | {
      kind: 'CHARACTER'
      item: PreparedCharacterItem
      issues: ImportResultItemDto['issues']
      systemId: string
      primaryRulesCatalogueId: string
      payloadJson: string
      customPayloads: Array<{
        payloadJson: string
        custom: PreparedCharacterItem['customContent'][number]
      }>
    }
  | {
      kind: 'AUTHORED'
      item: PreparedAuthoredItem
      issues: ImportResultItemDto['issues']
      payloadJson: string
      systemId: string
    }

function resultOnly(result: ImportResultItemDto): PlannedEntry {
  return { kind: 'RESULT', result }
}

function planEntries(
  prepared: PreparedBatch,
  command: ImportCommand,
  ownerUserId: string,
  preflight: ImportRunnerPreflight,
  createId: () => string
): PlannedEntry[] {
  const selectedEntryIds = new Set(command.selectedEntryIds)
  const availableSystemIds = new Set(preflight.availableSystemIds)
  const activeCharacters = new Map(
    preflight.activeCharacters.map((character) => [character.characterId, character])
  )
  const resolutionByEntryId = new Map(
    command.resolutions.map((resolution) => [resolution.entryId, resolution])
  )
  const allPortableRoots = new Set(
    prepared.items.flatMap((item) =>
      item.kind === 'AUTHORED' && item.externalId
        ? [`${item.envelope.item.kind}:${item.externalId}`]
        : []
    )
  )
  const selectedPortableRoots = new Set(
    prepared.items.flatMap((item) =>
      item.kind === 'AUTHORED' && item.externalId && selectedEntryIds.has(item.entryId)
        ? [`${item.envelope.item.kind}:${item.externalId}`]
        : []
    )
  )
  const committablePortableItems = prepared.items.filter((item): item is PreparedAuthoredItem => {
    if (item.kind !== 'AUTHORED' || !selectedEntryIds.has(item.entryId)) return false
    const resolution = resolutionByEntryId.get(item.entryId)
    return (
      !validateCollisionResolution(item, resolution?.choice ?? 'COPY', resolution) &&
      availableSystemIds.has(readString(item.envelope.item.data.systemId) ?? '')
    )
  })
  const rootIdMap = buildPortableRootIdMap(committablePortableItems)
  const committablePortableRoots = new Set(rootIdMap.keys())

  return prepared.items.map((item): PlannedEntry => {
    if (!selectedEntryIds.has(item.entryId)) {
      return resultOnly({
        entryId: item.entryId,
        name: item.name,
        outcome: 'SKIPPED',
        issues: item.issues
      })
    }
    if (item.kind === 'UNABLE') {
      return resultOnly({
        entryId: item.entryId,
        name: item.name,
        outcome: 'FAILED',
        issues: item.issues
      })
    }

    const resolution = resolutionByEntryId.get(item.entryId)
    const invalidResolution = validateCollisionResolution(
      item,
      resolution?.choice ?? 'COPY',
      resolution
    )
    if (invalidResolution) {
      return resultOnly({
        entryId: item.entryId,
        name: item.name,
        label: item.label,
        outcome: 'FAILED',
        issues: [...item.issues, invalidResolution]
      })
    }

    if (item.kind === 'CHARACTER') {
      const systemId = prepared.defaultSystemId
      const primaryRulesCatalogueId = prepared.primaryRulesCatalogueId
      if (!systemId || !primaryRulesCatalogueId) throw new Error('D&D 5e 2014 is not configured.')
      const activeCharacter = activeCharacters.get(item.targetId)
      if (
        activeCharacter &&
        (activeCharacter.systemId !== systemId ||
          (activeCharacter.primaryRulesCatalogueId !== null &&
            activeCharacter.primaryRulesCatalogueId !== primaryRulesCatalogueId))
      ) {
        return resultOnly({
          entryId: item.entryId,
          name: item.name,
          label: item.label,
          outcome: 'FAILED',
          issues: [
            ...item.issues,
            issue(
              'ERROR',
              'CHARACTER_RULE_BINDING_MISMATCH',
              'The imported Character does not match the existing Character System and Rules Catalogue.',
              [],
              true
            )
          ]
        })
      }
      const equipmentTraits = new Map<string, ImportedEquipmentTraits>(
        preflight.equipment.map(({ equipmentId, ...traits }) => [equipmentId, traits])
      )
      const customPayloads = item.customContent.map((custom) => {
        const normalized = normalizeImportedAuthoredPayload(
          custom.payload,
          custom.subjectKind,
          custom.targetId,
          custom.label,
          systemId,
          ownerUserId,
          createId,
          false,
          new Map()
        )
        const equipment =
          custom.subjectKind === 'EQUIPMENT'
            ? core.parse(equipmentAuthoredDtoSchema, normalized)
            : null
        // A custom variant's parent is not stored yet, so its hands stay unknown (carried).
        if (equipment && equipment.category !== 'VARIANT')
          equipmentTraits.set(custom.targetId, {
            category: equipment.category,
            twoHanded: equipment.properties.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED)
          })
        return {
          custom,
          payloadJson: JSON.stringify(
            equipment ?? core.parse(authoredSchemaByKind[custom.subjectKind], normalized)
          )
        }
      })
      const payload = characterBuilderDraftPayloadDtoSchema.parse({
        character: buildImportedCharacter(
          item,
          ownerUserId,
          systemId,
          primaryRulesCatalogueId,
          createId,
          (equipmentId) => equipmentTraits.get(equipmentId)
        )
      })
      return {
        kind: 'CHARACTER',
        item,
        issues: item.issues,
        systemId,
        primaryRulesCatalogueId,
        customPayloads,
        payloadJson: JSON.stringify(payload)
      }
    }

    const referenceIssues = [
      ...getDeselectedPortableReferenceIssues(
        item.envelope.references,
        allPortableRoots,
        selectedPortableRoots
      ),
      ...getUnavailablePortableReferenceIssues(
        item.envelope.references,
        selectedPortableRoots,
        committablePortableRoots
      )
    ]
    const issues = [...item.issues, ...referenceIssues]
    const systemId = readString(item.envelope.item.data.systemId)
    if (!systemId || !availableSystemIds.has(systemId)) {
      return resultOnly({
        entryId: item.entryId,
        name: item.name,
        label: item.label,
        outcome: 'FAILED',
        issues: [
          ...issues,
          issue(
            'ERROR',
            'UNKNOWN_RULES_SYSTEM',
            'The imported content does not identify an available Artificer rules system.',
            ['item', 'data', 'systemId'],
            true
          )
        ]
      })
    }

    const normalized = normalizeImportedAuthoredPayload(
      item.envelope.item.data,
      item.envelope.item.kind,
      item.targetId,
      item.label,
      systemId,
      ownerUserId,
      createId,
      Boolean(item.collision && item.targetId !== item.collision.subjectId),
      new Map([...rootIdMap, ...item.referenceIdMap])
    )
    const parsed = core.safeParse(authoredSchemaByKind[item.envelope.item.kind], normalized)
    if (!parsed.success) {
      return resultOnly({
        entryId: item.entryId,
        name: item.name,
        label: item.label,
        outcome: 'FAILED',
        issues: [
          ...issues,
          issue(
            'ERROR',
            'INVALID_AUTHORED_CONTENT',
            'The imported content needs correction before it can be saved.',
            ['item', 'data'],
            true
          )
        ]
      })
    }
    return {
      kind: 'AUTHORED',
      item,
      issues,
      systemId,
      payloadJson: JSON.stringify(parsed.data)
    }
  })
}

function expectedStageCount(entries: PlannedEntry[]) {
  return (
    1 +
    entries.length +
    entries.reduce(
      (count, entry) =>
        count +
        (entry.kind === 'RESULT'
          ? 0
          : entry.kind === 'AUTHORED'
            ? 1
            : 1 + entry.customPayloads.length),
      0
    )
  )
}

function publicIdFromStage(outputJson: string) {
  const output: unknown = JSON.parse(outputJson)
  if (
    !output ||
    typeof output !== 'object' ||
    !('draft' in output) ||
    !output.draft ||
    typeof output.draft !== 'object' ||
    !('publicId' in output.draft) ||
    typeof output.draft.publicId !== 'string' ||
    !output.draft.publicId
  )
    throw new Error('Imported draft stage output is invalid.')
  return output.draft.publicId
}

async function stageResult(
  ctx: Pick<ActionCtx, 'runMutation'>,
  jobId: string,
  sequence: number,
  result: ImportResultItemDto
) {
  await ctx.runMutation(stageResultRef, {
    jobId,
    sequence,
    entryId: result.entryId,
    resultJson: encodeImportResult(result)
  })
}

async function executePlan(
  ctx: Pick<ActionCtx, 'runMutation'>,
  jobId: string,
  entries: PlannedEntry[]
) {
  for (const [sequence, entry] of entries.entries()) {
    if (entry.kind === 'RESULT') {
      await stageResult(ctx, jobId, sequence, entry.result)
      continue
    }
    if (entry.kind === 'CHARACTER') {
      for (const [customSequence, { custom, payloadJson }] of entry.customPayloads.entries()) {
        await ctx.runMutation(stageCustomAuthoredRef, {
          jobId,
          sequence,
          customSequence,
          entryId: entry.item.entryId,
          source: entry.item.source,
          externalId: custom.externalId,
          subjectKind: custom.subjectKind,
          targetId: custom.targetId,
          systemId: entry.systemId,
          label: custom.label,
          payloadJson,
          activate: custom.activate
        })
      }
      const outputJson = await ctx.runMutation(stageCharacterHeadRef, {
        jobId,
        sequence,
        entryId: entry.item.entryId,
        source: entry.item.source,
        externalId: entry.item.externalId,
        targetId: entry.item.targetId,
        systemId: entry.systemId,
        primaryRulesCatalogueId: entry.primaryRulesCatalogueId,
        label: entry.item.label,
        payloadJson: entry.payloadJson
      })
      await stageResult(ctx, jobId, sequence, {
        entryId: entry.item.entryId,
        name: entry.item.name,
        label: entry.item.label,
        outcome:
          entry.item.collision && entry.item.targetId === entry.item.collision.subjectId
            ? 'UPDATED'
            : 'CREATED',
        issues: entry.issues,
        destination: { kind: 'CHARACTER_BUILDER_DRAFT', subjectId: entry.item.targetId },
        relatedContent: entry.item.customContent.map(toRelatedContent),
        publicId: publicIdFromStage(outputJson)
      })
      continue
    }

    const outputJson = await ctx.runMutation(stageAuthoredHeadRef, {
      jobId,
      sequence,
      entryId: entry.item.entryId,
      source: 'ARTIFICER_JSON',
      externalId: entry.item.externalId,
      subjectKind: entry.item.envelope.item.kind,
      targetId: entry.item.targetId,
      systemId: entry.systemId,
      label: entry.item.label,
      payloadJson: entry.payloadJson
    })
    await stageResult(ctx, jobId, sequence, {
      entryId: entry.item.entryId,
      name: entry.item.name,
      label: entry.item.label,
      outcome:
        entry.item.collision && entry.item.targetId === entry.item.collision.subjectId
          ? 'UPDATED'
          : 'CREATED',
      issues: entry.issues,
      destination: {
        kind: 'AUTHORED_DRAFT',
        subjectKind: entry.item.envelope.item.kind,
        subjectId: entry.item.targetId
      },
      publicId: publicIdFromStage(outputJson)
    })
  }
}

export async function runImportJob(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation' | 'storage'>,
  jobId: string
): Promise<null> {
  try {
    const storedPlan = await ctx.runQuery(readPlanRef, { jobId })
    const source = await ctx.runQuery(loadSourceRef, { jobId })
    const { batch, dependencies } = await materializeRunnerSource(ctx.storage, source)
    const generatedIds: string[] = storedPlan ? [...storedPlan.generatedIds] : []
    let generatedIdIndex = 0
    const createId = () => {
      if (storedPlan) {
        const generatedId = generatedIds[generatedIdIndex++]
        if (!generatedId) throw new Error('Stored import plan did not provide enough ids.')
        return generatedId
      }
      const generatedId = crypto.randomUUID()
      generatedIds.push(generatedId)
      generatedIdIndex++
      return generatedId
    }
    const resolutionByEntryId = new Map(
      source.command.resolutions.map((resolution) => [resolution.entryId, resolution])
    )
    const customContentChoiceByKey = new Map(
      source.command.customContentChoices.map((choice) => [
        `${choice.entryId}:${choice.subjectKind}:${choice.externalId}`,
        choice.choice
      ])
    )
    const prepared = await prepareWithNativeLookup(
      runnerLookupLoaders(ctx, jobId),
      batch,
      source.ownerUserId,
      { ...dependencies, createId },
      resolutionByEntryId,
      customContentChoiceByKey
    )
    if (
      prepared.items.length !== source.descriptor.entries.length ||
      prepared.items.some(
        (item, sequence) => item.entryId !== source.descriptor.entries[sequence]?.entryId
      )
    )
      throw new Error('Prepared import entries do not match their source descriptor.')
    const selectedEntryIds = new Set(source.command.selectedEntryIds)
    const systemIds = [
      ...new Set(
        prepared.items.flatMap((item) => {
          if (!selectedEntryIds.has(item.entryId)) return []
          if (item.kind !== 'AUTHORED') return []
          const itemSystemId = readString(item.envelope.item.data.systemId)
          return itemSystemId ? [itemSystemId] : []
        })
      )
    ]
    const characterIds = [
      ...new Set(
        prepared.items.flatMap((item) =>
          item.kind === 'CHARACTER' && selectedEntryIds.has(item.entryId) ? [item.targetId] : []
        )
      )
    ]
    // Equipment created by this same import is not stored yet; planEntries reads it from its payload.
    const equipmentIds = [
      ...new Set(
        prepared.items.flatMap((item) => {
          if (item.kind !== 'CHARACTER' || !selectedEntryIds.has(item.entryId)) return []
          const customTargetIds = new Set(item.customContent.map((custom) => custom.targetId))
          return item.references.flatMap((reference) =>
            reference.role === 'EQUIPMENT' &&
            reference.equipped &&
            reference.subjectId &&
            !customTargetIds.has(reference.subjectId)
              ? [reference.subjectId]
              : []
          )
        })
      )
    ]
    const preflight = await ctx.runQuery(loadPreflightRef, {
      jobId,
      systemIds,
      characterIds,
      equipmentIds
    })
    const entries = planEntries(prepared, source.command, source.ownerUserId, preflight, createId)
    const stageCount = expectedStageCount(entries)
    if (storedPlan) {
      if (generatedIdIndex !== generatedIds.length)
        throw new Error('Stored import plan contains unused ids.')
      if (storedPlan.expectedStageCount !== stageCount)
        throw new Error('Stored import plan stage count does not match this replay.')
    }
    const plan: ImportRunnerPlan = await ctx.runMutation(beginPlanRef, {
      jobId,
      entryId: source.descriptor.entries[0]!.entryId,
      generatedIds,
      expectedStageCount: stageCount
    })
    if (
      plan.expectedStageCount !== stageCount ||
      plan.generatedIds.length !== generatedIds.length ||
      plan.generatedIds.some((generatedId, index) => generatedId !== generatedIds[index])
    )
      throw new Error('Stored import plan does not match the prepared import.')

    await executePlan(ctx, jobId, entries)
    await ctx.runMutation(completeRef, { jobId })
  } catch {
    try {
      await ctx.runMutation(failRef, { jobId, failureReason: FAILURE_REASON })
    } catch {
      // A terminal or concurrently cancelled job needs no second failure transition.
    }
  }
  return null
}

export const run = internalAction({
  args: { jobId: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId }) => runImportJob(ctx, jobId)
})
