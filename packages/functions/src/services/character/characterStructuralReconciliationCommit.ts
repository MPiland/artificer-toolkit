import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterBuilderDraftRepository,
  createCharacterMechanicsProjectionRepository,
  createCharacterRepository,
  createCharacterSheetAdjustmentRepository,
  createCharacterSheetPlayStateRepository,
  type CharacterBuilderDraft,
  type DBLike,
  type Json
} from '@artificer-toolkit/db'
import { characterBuilderDraftPayloadDtoSchema } from '@artificer-toolkit/schema/api/characters'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'

import {
  reconcileCharacterAuthoredSourceLoss,
  reconcileCharacterBuilderCharacter,
  type CharacterSourceLossTarget
} from './builderReconciliation.js'
import {
  createCharacterCommittedSheetReconciliationContext,
  createCharacterCommittedSheetExtras,
  loadCharacterCommittedSheetSources,
  removeCharacterCommittedSheetSourceLoss,
  retainCharacterCommittedSheetRuleSources
} from './characterCommittedSheetSources.js'
import { resolveCharacterBuilder } from './builderService.js'
import {
  carryPinnedCharacterSenseDefinitions,
  compileCharacterMechanicsProjection
} from './characterMechanicsCompiler.js'
import { evaluateCharacterRulePolicy } from './characterRuleEvaluation.js'

export type CharacterStructuralReconciliationResult =
  | {
      kind: 'ACTIVE'
      character: CharacterAuthored
      streamVersion: number
      mechanics: CharacterMechanicsProjection
    }
  | {
      kind: 'DRAFT'
      character: CharacterAuthored
      streamVersion: number
    }

function sortTargets(targets: readonly CharacterSourceLossTarget[]): CharacterSourceLossTarget[] {
  return [
    ...new Map(
      targets.map((target) => [`${target.subjectKind}:${target.subjectId}`, target] as const)
    ).values()
  ].sort((left, right) =>
    `${left.subjectKind}:${left.subjectId}`.localeCompare(`${right.subjectKind}:${right.subjectId}`)
  )
}

function removeSources(
  character: CharacterAuthored,
  targets: readonly CharacterSourceLossTarget[]
): CharacterAuthored {
  return targets.reduce(
    (current, target) => reconcileCharacterAuthoredSourceLoss(current, target),
    character
  )
}

function parseDraft(draft: CharacterBuilderDraft): {
  builderIntent?: ReturnType<typeof characterBuilderDraftPayloadDtoSchema.parse>['builderIntent']
  character: CharacterAuthored
} {
  return characterBuilderDraftPayloadDtoSchema.parse(draft.payload)
}

async function saveDraft(input: {
  db: DBLike
  draft: CharacterBuilderDraft | null
  character: CharacterAuthored
  baseActiveUpdatedAt: string | null
}): Promise<void> {
  const parsed = input.draft ? parseDraft(input.draft) : null
  const payload = characterBuilderDraftPayloadDtoSchema.parse({
    character: input.character,
    ...(parsed?.builderIntent ? { builderIntent: parsed.builderIntent } : {})
  })
  await createCharacterBuilderDraftRepository(input.db).save({
    characterId: input.character.id,
    userId: input.character.userId,
    systemId: input.character.systemId,
    label: input.character.label,
    mode: input.draft?.mode ?? 'edit',
    payload: payload as unknown as Json,
    baseActiveUpdatedAt: input.baseActiveUpdatedAt
  })
}

async function saveExistingDraftAfterSourceLoss(input: {
  db: DBLike
  draft: CharacterBuilderDraft | null
  sourceLossTargets: readonly CharacterSourceLossTarget[]
  baseActiveUpdatedAt: string | null
}): Promise<void> {
  if (!input.draft) return
  const parsed = parseDraft(input.draft)
  await saveDraft({
    db: input.db,
    draft: input.draft,
    character: removeSources(parsed.character, sortTargets(input.sourceLossTargets)),
    baseActiveUpdatedAt: input.baseActiveUpdatedAt
  })
}

async function persistDraftReconciliation(input: {
  character: CharacterAuthored
  db: DBLike
  draft: CharacterBuilderDraft | null
  expectedRuleRevisionId: string
  expectedStreamVersion: number
  sourceLossTargets: readonly CharacterSourceLossTarget[]
}): Promise<CharacterStructuralReconciliationResult> {
  const characters = createCharacterRepository(input.db)
  const character = {
    ...input.character,
    status: AUTHORED_RECORD_STATUS.DRAFT
  }
  const streamVersion = await characters.upsertAuthored(character, {
    expectedStreamVersion: input.expectedStreamVersion,
    incrementStreamVersion: true,
    rulePackRevisionId: input.expectedRuleRevisionId
  })
  await createCampaignCharacterMechanicsProjectionRepository(input.db).deleteForDraft({
    characterId: character.id,
    expectedCharacterStreamVersion: streamVersion
  })
  await createCharacterMechanicsProjectionRepository(input.db).deleteForDraft({
    characterId: character.id,
    expectedCharacterStreamVersion: streamVersion
  })
  const updatedAt = await characters.findUpdatedAtById(character.id)
  if (!updatedAt) throw new Error(`Character "${character.id}" has no updated timestamp.`)
  if (input.draft) {
    await saveExistingDraftAfterSourceLoss({
      db: input.db,
      draft: input.draft,
      sourceLossTargets: input.sourceLossTargets,
      baseActiveUpdatedAt: updatedAt
    })
  } else {
    await saveDraft({
      db: input.db,
      draft: null,
      character,
      baseActiveUpdatedAt: updatedAt
    })
  }
  return { kind: 'DRAFT', character, streamVersion }
}

export async function commitCharacterStructuralReconciliation(input: {
  db: DBLike
  expectedRuleRevisionId: string
  expectedStreamVersion: number
  snapshot: CharacterAuthored
  sourceLossTargets: readonly CharacterSourceLossTarget[]
}): Promise<CharacterStructuralReconciliationResult> {
  const targets = sortTargets(input.sourceLossTargets)
  const characters = createCharacterRepository(input.db)
  const drafts = createCharacterBuilderDraftRepository(input.db)
  const draft = await drafts.findByCharacter({
    characterId: input.snapshot.id,
    userId: input.snapshot.userId
  })
  const candidate = removeSources(input.snapshot, targets)
  const mechanicsRepository = createCharacterMechanicsProjectionRepository(input.db)
  const priorMechanics = await mechanicsRepository.requireCurrent({
    characterId: input.snapshot.id,
    expectedRuleRevisionId: input.expectedRuleRevisionId,
    expectedStreamVersion: input.expectedStreamVersion
  })
  const priorSources = await loadCharacterCommittedSheetSources({
    db: input.db,
    mechanics: priorMechanics
  })
  const sourceLoss = removeCharacterCommittedSheetSourceLoss({
    roots: targets,
    sources: priorSources
  })
  if (sourceLoss.kind === 'TRANSITIVE_DEPENDENCY_LOST') {
    return persistDraftReconciliation({
      character: candidate,
      db: input.db,
      draft,
      expectedRuleRevisionId: input.expectedRuleRevisionId,
      expectedStreamVersion: input.expectedStreamVersion,
      sourceLossTargets: targets
    })
  }
  const context = await createCharacterCommittedSheetReconciliationContext({
    character: candidate,
    db: input.db,
    sources: sourceLoss.sources
  })
  const reconciled = await reconcileCharacterBuilderCharacter(
    input.db,
    candidate,
    input.snapshot,
    context,
    input.expectedRuleRevisionId
  )
  const resolution = await resolveCharacterBuilder(
    input.db,
    { ...reconciled, status: AUTHORED_RECORD_STATUS.DRAFT },
    'edit',
    context,
    input.snapshot,
    input.expectedRuleRevisionId
  )

  if (!resolution.readiness.ready) {
    return persistDraftReconciliation({
      character: reconciled,
      db: input.db,
      draft,
      expectedRuleRevisionId: input.expectedRuleRevisionId,
      expectedStreamVersion: input.expectedStreamVersion,
      sourceLossTargets: targets
    })
  }

  const [adjustments, resourceUsage] = await Promise.all([
    createCharacterSheetAdjustmentRepository(input.db).listByCharacter(reconciled.id),
    createCharacterSheetPlayStateRepository(input.db).listResourceUsage(reconciled.id)
  ])
  const { creaturesById } = createCharacterCommittedSheetExtras({
    character: reconciled,
    sources: sourceLoss.sources
  })
  const evaluation = await evaluateCharacterRulePolicy({
    db: input.db,
    character: reconciled,
    context,
    existingRevisionId: input.expectedRuleRevisionId,
    expectedRevisionId: input.expectedRuleRevisionId,
    adjustments,
    creaturesById,
    resourceUsage
  })
  const maximumHitPoints = Math.max(evaluation.output.derivedStats.maxHitPoints.effective, 0)
  const character: CharacterAuthored = {
    ...reconciled,
    status: AUTHORED_RECORD_STATUS.ACTIVE,
    state: {
      ...reconciled.state,
      hitpoints: {
        ...reconciled.state.hitpoints,
        current: Math.min(Math.max(reconciled.state.hitpoints.current, 0), maximumHitPoints)
      }
    }
  }
  const retainedSources = retainCharacterCommittedSheetRuleSources({
    character,
    rulePolicyOutput: evaluation.output,
    ruleRegistry: evaluation.registry,
    sources: sourceLoss.sources
  })
  const streamVersion = await characters.upsertAuthored(character, {
    expectedStreamVersion: input.expectedStreamVersion,
    incrementStreamVersion: true,
    rulePackRevisionId: evaluation.binding.revisionId
  })
  const mechanics = await mechanicsRepository.publish(
    compileCharacterMechanicsProjection({
      characterId: character.id,
      characterCommandState: character,
      characterStreamVersion: streamVersion,
      vocabularySnapshot: retainedSources.vocabularySnapshot,
      ruleBinding: evaluation.binding,
      rulePolicyInput: evaluation.facts,
      rulePolicyOutput: evaluation.output,
      pinnedSenseDefinitions: carryPinnedCharacterSenseDefinitions({
        prior: priorMechanics.pinnedSenseDefinitions,
        senses: evaluation.output.senses
      }),
      compiledActionEntryPoints: evaluation.compiledActionEntryPoints,
      ruleRegistry: evaluation.registry,
      ruleSnapshot: evaluation.snapshot,
      authoredVersionVector: retainedSources.mechanics.authoredVersionVector
    })
  )
  const updatedAt = await characters.findUpdatedAtById(character.id)
  if (!updatedAt) throw new Error(`Character "${character.id}" has no updated timestamp.`)
  await saveExistingDraftAfterSourceLoss({
    db: input.db,
    draft,
    sourceLossTargets: targets,
    baseActiveUpdatedAt: updatedAt
  })
  return { kind: 'ACTIVE', character, streamVersion, mechanics }
}

export async function commitCharacterDraftSourceLoss(input: {
  db: DBLike
  expectedStreamVersion: number
  snapshot: CharacterAuthored
  sourceLossTargets: readonly CharacterSourceLossTarget[]
}): Promise<{ character: CharacterAuthored; streamVersion: number }> {
  const characters = createCharacterRepository(input.db)
  const drafts = createCharacterBuilderDraftRepository(input.db)
  const existingDraft = await drafts.findByCharacter({
    characterId: input.snapshot.id,
    userId: input.snapshot.userId
  })
  const character = {
    ...removeSources(input.snapshot, sortTargets(input.sourceLossTargets)),
    status: AUTHORED_RECORD_STATUS.DRAFT
  }
  const streamVersion = await characters.upsertAuthored(character, {
    expectedStreamVersion: input.expectedStreamVersion,
    incrementStreamVersion: true
  })
  await createCampaignCharacterMechanicsProjectionRepository(input.db).deleteForDraft({
    characterId: character.id,
    expectedCharacterStreamVersion: streamVersion
  })
  await createCharacterMechanicsProjectionRepository(input.db).deleteForDraft({
    characterId: character.id,
    expectedCharacterStreamVersion: streamVersion
  })
  const updatedAt = await characters.findUpdatedAtById(character.id)
  if (!updatedAt) throw new Error(`Character "${character.id}" has no updated timestamp.`)
  if (existingDraft) {
    await saveExistingDraftAfterSourceLoss({
      db: input.db,
      draft: existingDraft,
      sourceLossTargets: input.sourceLossTargets,
      baseActiveUpdatedAt: updatedAt
    })
  } else {
    await saveDraft({
      db: input.db,
      draft: null,
      character,
      baseActiveUpdatedAt: updatedAt
    })
  }
  return { character, streamVersion }
}

export async function commitCharacterDraftOnlySourceLoss(input: {
  db: DBLike
  characterId: string
  userId: string
  sourceLossTargets: readonly CharacterSourceLossTarget[]
}): Promise<void> {
  const draft = await createCharacterBuilderDraftRepository(input.db).findByCharacter({
    characterId: input.characterId,
    userId: input.userId
  })
  if (!draft) throw new Error(`Character "${input.characterId}" draft is unavailable.`)
  await saveExistingDraftAfterSourceLoss({
    db: input.db,
    draft,
    sourceLossTargets: input.sourceLossTargets,
    baseActiveUpdatedAt: draft.baseActiveUpdatedAt
  })
}
