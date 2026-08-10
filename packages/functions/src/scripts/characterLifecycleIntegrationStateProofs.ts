import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { type DBLike } from '@artificer-toolkit/db'
import { type CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { executeRollForUser } from '../services/rolls/rollService.js'
import {
  dispatchCommandForUser,
  getCharacterHistoryForUser,
  getCharacterSheetForUser,
  previewCharacterRestForUser
} from '../services/character/characterApplicationService.js'
import {
  canonicalize,
  dispatchAndReloadSheetCommand
} from './characterLifecycleIntegrationAssertions.js'
import {
  requireRecordByLabel,
  type CharacterLifecycleFixture
} from './characterLifecycleIntegrationFixtures.js'
export async function proveRetryAndConcurrencyCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const historyBefore = await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId)
  const command = {
    commandId: randomUUID(),
    expectedVersion: sheet.meta.streamVersion,
    type: 'SET_INSPIRATION' as const,
    inspired: true
  }
  const applied = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId)
  assert.equal(applied.streamVersion, sheet.meta.streamVersion + 1)
  assert.equal(applied.sheet.overview.inspiration, true)

  const persisted = await getCharacterSheetForUser(db, fixture.characterId, fixture.userId)
  assert.ok(persisted, `${fixture.label} could not be reloaded after SET_INSPIRATION.`)
  assert.deepEqual(canonicalize(persisted), canonicalize(applied.sheet))
  const historyAfterApply = await getCharacterHistoryForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  assert.equal(historyAfterApply.entries.length, historyBefore.entries.length + 1)

  const retried = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId)
  assert.equal(retried.streamVersion, applied.streamVersion)
  assert.equal(retried.historyEntry?.eventId, applied.historyEntry?.eventId)
  assert.deepEqual(canonicalize(retried.sheet), canonicalize(persisted))
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'An exact command retry appended a duplicate event.'
  )

  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      { ...command, inspired: false },
      fixture.userId
    ),
    /already used with different input/u
  )
  assert.deepEqual(
    canonicalize(await getCharacterSheetForUser(db, fixture.characterId, fixture.userId)),
    canonicalize(persisted),
    'Reusing a command id with different input mutated Sheet state.'
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'Reusing a command id with different input appended an event.'
  )

  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      {
        commandId: randomUUID(),
        expectedVersion: command.expectedVersion,
        type: 'SET_INSPIRATION',
        inspired: false
      },
      fixture.userId
    ),
    /stream_version conflict/u
  )
  const afterStaleRejection = await getCharacterSheetForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  assert.ok(afterStaleRejection, `${fixture.label} disappeared after the stale command rejection.`)
  assert.deepEqual(
    canonicalize(afterStaleRejection),
    canonicalize(persisted),
    'A stale expectedVersion mutated Sheet state.'
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyAfterApply,
    'A stale expectedVersion appended an event.'
  )

  return afterStaleRejection
}

export async function proveConditionCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_EXHAUSTION',
    level: 2,
    notes: 'Lifecycle exhaustion'
  })
  assert.equal(current.overview.exhaustion.level, 2)
  assert.equal(current.overview.exhaustion.notes, 'Lifecycle exhaustion')

  const condition = requireRecordByLabel(
    current.reference.conditionOptions,
    'Blinded',
    'condition option'
  )
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADD_CONDITION',
    conditionTypeId: condition.id,
    notes: 'Lifecycle condition'
  })
  assert.deepEqual(
    current.overview.conditions.find(({ conditionTypeId }) => conditionTypeId === condition.id),
    {
      conditionTypeId: condition.id,
      label: condition.label,
      description: condition.description,
      notes: 'Lifecycle condition'
    }
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'REMOVE_CONDITION',
    conditionTypeId: condition.id
  })
  assert.equal(
    current.overview.conditions.some(({ conditionTypeId }) => conditionTypeId === condition.id),
    false
  )

  return current
}

export async function proveHitPointRestAndResourceCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<CharacterSheetResponseDto> {
  const hitDie = sheet.overview.hitDice.find(({ remaining }) => remaining > 0)
  assert.ok(hitDie, `${fixture.label} did not expose an available hit die.`)
  const resource = requireRecordByLabel(sheet.resources.items, 'Second Wind', 'Sheet resource')
  assert.ok(resource.max > 0, 'Second Wind must expose at least one use.')

  const setCurrentHitPoints = Math.max(sheet.overview.maxHitPoints - 5, 1)
  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_HIT_POINTS',
    current: setCurrentHitPoints,
    temp: 5
  })
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints)
  assert.equal(current.overview.tempHitPoints, 5)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_HIT_POINTS',
    mode: 'DAMAGE',
    amount: 7
  })
  assert.equal(current.overview.tempHitPoints, 0)
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints - 2)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'ADJUST_HIT_POINTS',
    mode: 'HEAL',
    amount: 3
  })
  assert.equal(current.overview.currentHitPoints, setCurrentHitPoints + 1)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'UPSERT_SHEET_ADJUSTMENT',
    adjustment: {
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: 2,
      sourceNote: 'Lifecycle rest reset'
    }
  })
  assert.equal(current.overview.maxHitPointsModifier, 2)
  assert.ok(current.overview.maxHitPointsModifierAdjustmentId)

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SHEET_RESOURCE',
    owner: resource.owner
  })
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 1)
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_HIT_POINTS',
    current: current.overview.currentHitPoints,
    temp: 4
  })

  const shortRestSelection = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'SHORT',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [{ die: hitDie.die, count: 1 }],
      resetMaximumHitPointModifier: true,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false
    },
    fixture.userId
  )
  assert.ok(shortRestSelection.canonicalExpression, 'Short rest did not expose a roll expression.')
  const hitDieRoll = await executeRollForUser(
    db,
    {
      characterId: fixture.characterId,
      expression: shortRestSelection.canonicalExpression,
      source: { kind: 'HIT_DIE', label: 'Short rest hit dice' }
    },
    fixture.userId
  )
  const selectedPool = shortRestSelection.hitDice.find(({ die }) => die === hitDie.die)
  assert.ok(selectedPool, 'Short rest did not expose the selected hit-die pool.')
  const rolledTerm = hitDieRoll.evidence.terms.find(({ die }) => die === hitDie.die)
  assert.ok(rolledTerm, 'Short-rest roll did not return the selected hit die.')
  const rollEvidence = {
    expression: hitDieRoll.normalizedExpression,
    terms: [
      {
        die: hitDie.die,
        count: 1,
        modifierPerDie: selectedPool.constitutionModifier,
        rolls: rolledTerm.rolls
      }
    ],
    total: hitDieRoll.evidence.total
  }
  const shortRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'SHORT',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [{ die: hitDie.die, count: 1 }],
      resetMaximumHitPointModifier: true,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollId: hitDieRoll.id,
      rollEvidence,
      requestRoll: false
    },
    fixture.userId
  )
  assert.equal(shortRestPreview.canApply, true)
  const shortRestCommandId = randomUUID()
  const shortRestResult = await dispatchCommandForUser(
    db,
    fixture.characterId,
    {
      type: 'COMPLETE_REST',
      commandId: shortRestCommandId,
      expectedVersion: current.meta.streamVersion,
      restKind: 'SHORT',
      previewFingerprint: shortRestPreview.previewFingerprint,
      selectedHitDice: [{ die: hitDie.die, count: 1 }],
      resetMaximumHitPointModifier: true,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      rollId: hitDieRoll.id,
      rollEvidence
    },
    fixture.userId
  )
  assert.equal(shortRestResult.streamVersion, current.meta.streamVersion + 1)
  assert.equal(shortRestResult.result?.type, 'COMPLETE_REST')
  assert.deepEqual(
    shortRestResult.result?.rest.rollEvidence,
    shortRestPreview.rollEvidence,
    'Completed rest did not preserve the exact accepted dice evidence.'
  )
  current = shortRestResult.sheet
  assert.equal(current.overview.tempHitPoints, 4)
  assert.equal(current.overview.maxHitPointsModifier, 0)
  assert.equal(current.overview.maxHitPointsModifierAdjustmentId, null)
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 0)
  assert.equal(
    current.overview.hitDice.find(({ die }) => die === hitDie.die)?.used,
    hitDie.used + 1
  )
  const shortRestHistory = await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId)
  assert.deepEqual(
    shortRestHistory.entries.at(-1)?.result,
    shortRestResult.result,
    'Completed-rest event did not round-trip its exact result.'
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_HIT_POINTS',
    current: 1,
    temp: 4
  })
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SHEET_RESOURCE',
    owner: resource.owner
  })
  const recoverableSlot = current.spells.slots.find((slot) => slot.remaining > 0)
  if (recoverableSlot) {
    current = await dispatchAndReloadSheetCommand(db, fixture, current, {
      type: 'USE_SPELL_SLOT',
      slotKey: recoverableSlot.slotKey
    })
  }
  const staleLongRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'LONG',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false
    },
    fixture.userId
  )
  const staleVersion = current.meta.streamVersion
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'SET_INSPIRATION',
    inspired: !current.overview.inspiration
  })
  const beforeStaleRest = canonicalize(current)
  const historyBeforeStaleRest = await getCharacterHistoryForUser(
    db,
    fixture.characterId,
    fixture.userId
  )
  await assert.rejects(
    dispatchCommandForUser(
      db,
      fixture.characterId,
      {
        type: 'COMPLETE_REST',
        commandId: randomUUID(),
        expectedVersion: staleVersion,
        restKind: 'LONG',
        previewFingerprint: staleLongRestPreview.previewFingerprint,
        selectedHitDice: [],
        resetMaximumHitPointModifier: false,
        healingMode: 'AUTOMATIC',
        manualHealingAccepted: false,
        selectedCompanionInstanceIds: []
      },
      fixture.userId
    ),
    /stream_version conflict/u
  )
  assert.deepEqual(
    canonicalize(await getCharacterSheetForUser(db, fixture.characterId, fixture.userId)),
    beforeStaleRest
  )
  assert.deepEqual(
    await getCharacterHistoryForUser(db, fixture.characterId, fixture.userId),
    historyBeforeStaleRest,
    'A stale completed rest appended an event.'
  )

  const longRestPreview = await previewCharacterRestForUser(
    db,
    fixture.characterId,
    {
      restKind: 'LONG',
      expectedVersion: current.meta.streamVersion,
      selectedHitDice: [],
      resetMaximumHitPointModifier: false,
      healingMode: 'AUTOMATIC',
      manualHealingAccepted: false,
      selectedCompanionInstanceIds: [],
      requestRoll: false
    },
    fixture.userId
  )
  const hitDiceUsedBeforeLongRest = current.overview.hitDice.reduce((sum, die) => sum + die.used, 0)
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'COMPLETE_REST',
    restKind: 'LONG',
    previewFingerprint: longRestPreview.previewFingerprint,
    selectedHitDice: [],
    resetMaximumHitPointModifier: false,
    healingMode: 'AUTOMATIC',
    manualHealingAccepted: false,
    selectedCompanionInstanceIds: []
  })
  assert.equal(current.overview.currentHitPoints, current.overview.maxHitPoints)
  assert.equal(current.overview.tempHitPoints, 0)
  assert.equal(current.overview.exhaustion.level, 1)
  assert.equal(current.resources.items.find(({ id }) => id === resource.id)?.used, 0)
  assert.ok(
    current.overview.hitDice.reduce((sum, die) => sum + die.used, 0) < hitDiceUsedBeforeLongRest,
    'A long rest did not restore any used hit dice.'
  )

  return current
}
