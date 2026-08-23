import assert from 'node:assert/strict'

import { createCharacterRepository, type DBLike } from '@artificer-toolkit/db'
import {
  characterBuilderDraftPayloadDtoSchema,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import {
  getCharacterBuilderDraftForUser,
  getCharacterSheetForUser,
  previewCharacterSaveForUser,
  resolveCharacterForUser,
  saveCharacterBuilderDraftForUser,
  upsertCharacterBuilderForUser
} from '../services/character/characterApplicationService.js'
import { loadCharacterBuilderContext } from '../services/character/builderService.js'
import { evaluateCharacterRulePolicy } from '../services/character/characterRuleEvaluation.js'
import {
  assertSheetMatchesFixture,
  canonicalize
} from './characterLifecycleIntegrationAssertions.js'
import {
  allSpellChoices,
  applySpecializationChoices,
  applyStructuralChoices,
  assertCharacterProgression,
  assertResolvedClassLevels,
  completeBuilderChoices,
  createFixtureCharacter,
  measureBuilderResolution,
  measureSheetRead,
  type BuilderResolutionTiming,
  type CharacterRuleEvaluationTiming,
  type CharacterLifecycleFixture,
  type SheetReadTiming
} from './characterLifecycleIntegrationFixtures.js'
export async function proveFixtureLifecycle(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  resolutionTimings: BuilderResolutionTiming[],
  sheetReadTimings: SheetReadTiming[],
  ruleEvaluationTimings: CharacterRuleEvaluationTiming[]
): Promise<CharacterSheetResponseDto> {
  const initialCharacter = createFixtureCharacter(fixture)
  assertCharacterProgression(initialCharacter, fixture, 'create input', false)
  const initialPayload = await measureBuilderResolution(resolutionTimings, fixture, 'initial', () =>
    resolveCharacterForUser(
      db,
      {
        character: initialCharacter,
        mode: 'create'
      },
      fixture.userId
    )
  )

  assert.equal(initialPayload.resolution.readiness.ready, false)
  assert.ok(
    initialPayload.resolution.readiness.outstandingRequiredChoices.length > 0,
    `${fixture.label} should expose unresolved required Builder choices.`
  )
  for (const classFixture of fixture.classes.filter(({ subclassId }) => subclassId)) {
    assert.ok(
      initialPayload.resolution.outstandingChoices.some(
        (choice) => choice.code === 'SUBCLASS_SELECTION_REQUIRED'
      ),
      `${classFixture.classLabel} ${classFixture.classLevel} did not require its eligible subclass choice.`
    )
  }
  if (fixture.raceLabel === 'Dragonborn') {
    assert.ok(
      initialPayload.resolution.outstandingChoices.some(
        (choice) => choice.code === 'ANCESTRY_SELECTION_REQUIRED'
      ),
      'Dragonborn did not require a draconic ancestry choice.'
    )
  }

  const structuralCharacter = applyStructuralChoices(
    initialPayload.character,
    initialPayload,
    fixture
  )
  const structuralPayload = await measureBuilderResolution(
    resolutionTimings,
    fixture,
    'structural',
    () =>
      resolveCharacterForUser(
        db,
        {
          character: structuralCharacter,
          mode: 'create'
        },
        fixture.userId
      )
  )
  assertCharacterProgression(structuralPayload.character, fixture, 'structural resolution')
  if (fixture.preparedCasterClassId) {
    assert.ok(
      allSpellChoices(structuralPayload).some(
        (choice) =>
          choice.source.kind === 'CLASS' && choice.source.classId === fixture.preparedCasterClassId
      ),
      `${fixture.label} did not expose its required Builder spell choices.`
    )
  }
  let resolvedPayload = structuralPayload
  if (fixture.classes.some(({ specializationLabel }) => specializationLabel)) {
    const specializationCharacter = applySpecializationChoices(
      structuralPayload.character,
      structuralPayload,
      fixture
    )
    resolvedPayload = await measureBuilderResolution(
      resolutionTimings,
      fixture,
      'specialization',
      () =>
        resolveCharacterForUser(
          db,
          {
            character: specializationCharacter,
            mode: 'create'
          },
          fixture.userId
        )
    )
  }
  for (let pass = 0; pass < 4 && !resolvedPayload.resolution.readiness.ready; pass += 1) {
    const completedCharacter = completeBuilderChoices(resolvedPayload.character, resolvedPayload)
    resolvedPayload = await measureBuilderResolution(resolutionTimings, fixture, 'completed', () =>
      resolveCharacterForUser(
        db,
        {
          character: completedCharacter,
          mode: 'create'
        },
        fixture.userId
      )
    )
  }
  assert.deepEqual(resolvedPayload.resolution.validations, [])
  assert.deepEqual(resolvedPayload.resolution.outstandingChoices, [])
  assert.equal(resolvedPayload.resolution.readiness.ready, true)
  assertCharacterProgression(resolvedPayload.character, fixture, 'resolved character')
  assertResolvedClassLevels(resolvedPayload.resolution, fixture, 'resolved Builder payload')

  const savedDraft = await saveCharacterBuilderDraftForUser(
    db,
    fixture.characterId,
    {
      character: resolvedPayload.character,
      mode: 'create'
    },
    fixture.userId
  )
  assert.equal(savedDraft.characterId, fixture.characterId)
  assert.equal(savedDraft.status, AUTHORED_RECORD_STATUS.DRAFT)

  const reloadedDraft = await getCharacterBuilderDraftForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  assert.ok(reloadedDraft, `${fixture.label} Builder draft could not be reloaded.`)
  const reloadedPayload = characterBuilderDraftPayloadDtoSchema.parse(reloadedDraft.payload)
  assert.deepEqual(
    canonicalize(reloadedPayload.character),
    canonicalize({
      ...resolvedPayload.character,
      status: AUTHORED_RECORD_STATUS.DRAFT
    }),
    `${fixture.label} draft did not preserve the resolved character.`
  )
  assertCharacterProgression(reloadedPayload.character, fixture, 'reloaded draft')

  const reloadedResolution = await measureBuilderResolution(
    resolutionTimings,
    fixture,
    'reloaded',
    () =>
      resolveCharacterForUser(
        db,
        {
          character: reloadedPayload.character,
          mode: 'create'
        },
        fixture.userId
      )
  )
  assert.equal(reloadedResolution.resolution.readiness.ready, true)
  assertCharacterProgression(reloadedResolution.character, fixture, 'reloaded resolution')
  assertResolvedClassLevels(reloadedResolution.resolution, fixture, 'reloaded Builder resolution')

  const preview = await previewCharacterSaveForUser(
    db,
    {
      character: reloadedResolution.character,
      mode: 'create',
      targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
    },
    fixture.userId
  )
  assert.equal(preview.preview.predictedStatus, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.equal(preview.resolution.readiness.ready, true)
  assert.equal(preview.preview.destructive, false)
  assertCharacterProgression(preview.character, fixture, 'save preview')
  assertResolvedClassLevels(preview.resolution, fixture, 'save preview')

  const finalized = await upsertCharacterBuilderForUser(
    db,
    {
      character: preview.character,
      mode: 'create',
      targetStatus: AUTHORED_RECORD_STATUS.ACTIVE
    },
    fixture.userId
  )
  assert.equal(finalized.character.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.ok(finalized.publicId, `${fixture.label} finalization did not create a public route id.`)
  assert.ok(finalized.streamVersion > 0, `${fixture.label} finalization did not publish a stream.`)
  assert.ok(
    finalized.mechanicsProjectionChecksum,
    `${fixture.label} finalization did not publish mechanics.`
  )
  assertCharacterProgression(finalized.character, fixture, 'finalized character')

  const persisted = await createCharacterRepository(db).findAuthoredById(fixture.characterId)
  assert.ok(persisted, `${fixture.label} finalization did not persist the aggregate.`)
  assert.equal(persisted.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assertCharacterProgression(persisted, fixture, 'repository reload')
  assert.equal(
    await getCharacterBuilderDraftForUser(db, fixture.characterId, fixture.userId),
    null,
    `${fixture.label} finalization did not remove the Builder draft.`
  )

  const persistedRow = await createCharacterRepository(db).findById(fixture.characterId)
  assert.ok(persistedRow?.rule_pack_revision_id, `${fixture.label} has no pinned rule revision.`)
  const evaluationContext = await loadCharacterBuilderContext(db, persisted, [], {
    includeEffects: true
  })
  const measuredRuleEvaluation = await evaluateCharacterRulePolicy({
    db,
    character: persisted,
    context: evaluationContext,
    existingRevisionId: persistedRow.rule_pack_revision_id,
    expectedRevisionId: persistedRow.rule_pack_revision_id
  })
  const ruleEvaluationTiming: CharacterRuleEvaluationTiming = {
    fixture: fixture.label,
    ...measuredRuleEvaluation.evaluation.timing
  }
  ruleEvaluationTimings.push(ruleEvaluationTiming)
  console.info(JSON.stringify({ characterRuleEvaluationTiming: ruleEvaluationTiming }))

  const sheet = await measureSheetRead(sheetReadTimings, fixture, 'cold', () =>
    getCharacterSheetForUser(db, fixture.characterId, fixture.userId)
  )
  assert.ok(sheet, `${fixture.label} could not be loaded through the Sheet service.`)
  assert.equal(sheet.meta.streamVersion, 1)
  assertSheetMatchesFixture(sheet, fixture, 'Sheet load')

  const reloadedSheet = await measureSheetRead(sheetReadTimings, fixture, 'warm', () =>
    getCharacterSheetForUser(db, fixture.characterId, fixture.userId)
  )
  assert.ok(reloadedSheet, `${fixture.label} could not be reloaded through the Sheet service.`)
  assert.equal(reloadedSheet.meta.streamVersion, 1)
  assertSheetMatchesFixture(reloadedSheet, fixture, 'Sheet reload')

  return reloadedSheet
}
