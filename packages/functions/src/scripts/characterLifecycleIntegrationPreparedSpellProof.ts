import assert from 'node:assert/strict'

import { type DBLike } from '@artificer-toolkit/db'
import { type CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import { dispatchAndReloadSheetCommand } from './characterLifecycleIntegrationAssertions.js'
import { type CharacterLifecycleFixture } from './characterLifecycleIntegrationFixtures.js'
export async function provePreparedCasterCommands(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto
): Promise<void> {
  const preparedCasterClassId = fixture.preparedCasterClassId
  assert.ok(preparedCasterClassId, `${fixture.label} has no prepared caster class.`)
  const preparedCasterClass = fixture.classes.find(
    ({ classId }) => classId === preparedCasterClassId
  )
  assert.ok(preparedCasterClass, `${fixture.label} prepared caster class is not in the fixture.`)
  const preparationSource = sheet.spells.preparationSources?.find(
    (source) => source.classId === preparedCasterClassId
  )
  assert.ok(
    preparationSource,
    `${preparedCasterClass.classLabel} did not expose a preparation source.`
  )
  const spell = sheet.spells.spells.find(
    (candidate) =>
      candidate.level === 1 &&
      candidate.sources?.some(
        (source) =>
          source.classId === preparedCasterClassId &&
          source.canPrepare &&
          source.acquisition !== 'ALWAYS_PREPARED' &&
          source.acquisition !== 'GRANTED'
      )
  )
  assert.ok(spell, `${preparedCasterClass.classLabel} did not expose a preparable 1st-level spell.`)

  let current = await dispatchAndReloadSheetCommand(db, fixture, sheet, {
    type: 'SET_PREPARED_SPELLS',
    classId: preparedCasterClassId,
    spellIds: [spell.id]
  })
  assert.equal(current.meta.streamVersion, 2)
  const preparedSpell = current.spells.spells.find((candidate) => candidate.id === spell.id)
  const preparedSource = preparedSpell?.sources?.find(
    (source) => source.classId === preparedCasterClassId && source.canPrepare
  )
  assert.equal(preparedSource?.prepared, true)

  const slot = current.spells.slots.find(
    (candidate) => candidate.level === 1 && candidate.remaining > 0
  )
  assert.ok(
    slot,
    `${preparedCasterClass.classLabel} did not expose an available 1st-level spell slot.`
  )
  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'CAST_SPELL',
    spellId: spell.id,
    ...(preparedSource?.id ? { sourceId: preparedSource.id } : {}),
    slotKey: slot.slotKey
  })
  assert.equal(current.meta.streamVersion, 3)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    slot.used + 1
  )

  const reloadedSpell = current.spells.spells.find((candidate) => candidate.id === spell.id)
  assert.equal(
    reloadedSpell?.sources?.find((source) => source.classId === preparedCasterClassId)?.prepared,
    true
  )
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    slot.used + 1
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'RESTORE_SPELL_SLOT',
    slotKey: slot.slotKey,
    all: true
  })
  assert.equal(current.meta.streamVersion, 4)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    0
  )

  current = await dispatchAndReloadSheetCommand(db, fixture, current, {
    type: 'USE_SPELL_SLOT',
    slotKey: slot.slotKey
  })
  assert.equal(current.meta.streamVersion, 5)
  assert.equal(
    current.spells.slots.find((candidate) => candidate.slotKey === slot.slotKey)?.used,
    1
  )
}
