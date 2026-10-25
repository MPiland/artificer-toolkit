import { describe, expect, it } from 'vitest'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { applyEncounterMechanicsBatch } from '../../tests/fixtures/mechanicsBatch'
import { api } from '../_generated/api'
import { executeCharacterSheetCommand } from './sheetCommands'

/**
 * Measured 2026-10-03 with binary fields counted: the play record replace is about 460 B, the
 * command receipt about 470 B and its receipt-ledger row about 1160 B, about 2100 B in all; an
 * Encounter damage writes about 2140 B.
 */
const PLAY_RECORD_BYTES = 800
const SHEET_HP_CHANGE_BYTES = 2400
const ENCOUNTER_DAMAGE_BYTES = 2500

describe('Character play-state write budget', () => {
  it('writes only the small play record for a Sheet HP change and an Encounter damage', async () => {
    const fixture = await setupCharacterRun()
    const { player, character, actor, run } = fixture
    const sheet = await player.caller.query(api.characters.sheet.get, { id: character.id })
    if (!sheet) throw new Error('Expected Character Sheet.')

    const sheetTotals = createDatabaseIoTotals()
    await player.caller.run((ctx) =>
      executeCharacterSheetCommand(
        { ...ctx, db: countDatabaseIo(ctx.db, sheetTotals) },
        player.userId,
        {
          id: character.id,
          command: {
            type: 'ADJUST_HIT_POINTS',
            commandId: crypto.randomUUID(),
            expectedVersion: sheet.meta.streamVersion,
            mode: 'DAMAGE',
            amount: 1
          }
        }
      )
    )
    expect(sheetTotals.writes.byTable.replace.bytes).toBeLessThan(PLAY_RECORD_BYTES)
    expect(sheetTotals.writes.bytes).toBeLessThan(SHEET_HP_CHANGE_BYTES)

    const after = await player.caller.query(api.characters.sheet.get, { id: character.id })
    if (!after) throw new Error('Expected Character Sheet.')
    const encounterTotals = createDatabaseIoTotals()
    await fixture.owner.caller.run((ctx) =>
      applyEncounterMechanicsBatch(
        { ...ctx, db: countDatabaseIo(ctx.db, encounterTotals) },
        {
          encounterId: run.id,
          targetActorId: actor.id,
          expectedEncounterVersion: run.version,
          occurrenceId: crypto.randomUUID(),
          sourceCommandId: crypto.randomUUID(),
          commandId: crypto.randomUUID(),
          occurredAt: '2026-09-12T00:00:00.000Z',
          expectedCharacterStreamVersion: after.meta.streamVersion,
          effectiveMaximumHitPoints: actor.maxHitPoints,
          forceVersionAdvance: false,
          applications: [
            {
              sourceNodeId: 'native-test',
              sourceOperationKey: 'damage',
              authoredPath: null,
              resolvedPath: 'TEST',
              kind: 'DAMAGE',
              critical: false,
              targetActorId: actor.id,
              requestedAmount: 1,
              resolvedAmount: 1,
              appliedAmount: 1,
              beforeCurrentHitPoints: after.overview.currentHitPoints,
              afterCurrentHitPoints: after.overview.currentHitPoints - 1,
              beforeTemporaryHitPoints: after.overview.tempHitPoints,
              afterTemporaryHitPoints: after.overview.tempHitPoints,
              maximumHitPoints: actor.maxHitPoints,
              damageTypeId: crypto.randomUUID(),
              damageDisposition: 'NORMAL',
              incomingHalved: false
            }
          ]
        }
      )
    )
    // Before the split, both wrote the whole Character document (about 7.6 KB) plus the receipt.
    expect(encounterTotals.writes.byTable.replace.bytes).toBeLessThan(PLAY_RECORD_BYTES)
    expect(encounterTotals.writes.bytes).toBeLessThan(ENCOUNTER_DAMAGE_BYTES)
  })
})
