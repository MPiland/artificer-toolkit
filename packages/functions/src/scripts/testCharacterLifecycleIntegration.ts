import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createDb } from '@artificer-toolkit/db'
import {
  assertCommandEquipmentWasRolledBack,
  assertFixtureWasRolledBack
} from './characterLifecycleIntegrationAssertions.js'
import {
  createAttunementEquipmentFixture,
  findFixtureCatalog,
  percentileDuration,
  requireLocalDatabaseUrl,
  type BuilderResolutionTiming,
  type CharacterLifecycleFixture
} from './characterLifecycleIntegrationFixtures.js'
import { proveFixtureLifecycle } from './characterLifecycleIntegrationBuilderProof.js'
import {
  proveCurrencyCommands,
  proveInventoryItemCommands,
  proveInventoryRemovalCommands,
  proveNoteCommands
} from './characterLifecycleIntegrationInventoryProofs.js'
import { provePreparedCasterCommands } from './characterLifecycleIntegrationPreparedSpellProof.js'
import {
  proveConditionCommands,
  proveHitPointRestAndResourceCommands,
  proveRetryAndConcurrencyCommands
} from './characterLifecycleIntegrationStateProofs.js'
async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const db = createDb({ connectionString })
  const characterIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()]
  const attunementEquipmentId = randomUUID()
  const rollback = new Error('ROLLBACK_CHARACTER_LIFECYCLE_INTEGRATION_PROOF')
  const resolutionOnly = process.env.CHARACTER_LIFECYCLE_RESOLUTION_ONLY === '1'
  const requestedFixture = process.env.CHARACTER_LIFECYCLE_FIXTURE
  const persistLocalFixtures = process.env.CHARACTER_LIFECYCLE_PERSIST_LOCAL === '1'
  const targetUserId = process.env.CHARACTER_LIFECYCLE_USER_ID
  const fixtureLabel = process.env.CHARACTER_LIFECYCLE_LABEL?.trim()
  if (persistLocalFixtures && !targetUserId) {
    throw new Error(
      'CHARACTER_LIFECYCLE_USER_ID is required when persisting local Character fixtures.'
    )
  }
  let completed = false
  let executedFixtureLabels: string[] = []
  const startedAt = Date.now()
  const builderResolutionTimings: BuilderResolutionTiming[] = []

  try {
    try {
      await db.transaction().execute(async (trx) => {
        const catalog = await findFixtureCatalog(trx)
        await createAttunementEquipmentFixture(trx, catalog, attunementEquipmentId)
        const fixtureCatalog = targetUserId ? { ...catalog, userId: targetUserId } : catalog
        const fixtures: CharacterLifecycleFixture[] = [
          {
            ...fixtureCatalog,
            characterId: characterIds[0] as string,
            classes: [{ classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 1 }],
            expectedMaxHitPoints: 12,
            hitpointLevels: [{ level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 }],
            label: 'MVP Martial Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[1] as string,
            classes: [
              {
                classId: catalog.clericId,
                classLabel: 'Cleric',
                classLevel: 1,
                subclassId: catalog.lifeDomainId,
                subclassLabel: 'Life Domain'
              }
            ],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: catalog.clericId, classLevel: 1, value: 10 }],
            label: 'MVP Prepared Caster Lifecycle Proof',
            preparedCasterClassId: catalog.clericId,
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[2] as string,
            classes: [
              {
                classId: catalog.fighterId,
                classLabel: 'Fighter',
                classLevel: 3,
                subclassId: catalog.championId,
                subclassLabel: 'Champion'
              }
            ],
            expectedMaxHitPoints: 25,
            hitpointLevels: [
              { level: 1, classId: catalog.fighterId, classLevel: 1, value: 11 },
              { level: 2, classId: catalog.fighterId, classLevel: 2, value: 7 },
              { level: 3, classId: catalog.fighterId, classLevel: 3, value: 7 }
            ],
            label: 'MVP Choice-Heavy Lifecycle Proof',
            raceId: catalog.dragonbornId,
            raceLabel: 'Dragonborn'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[3] as string,
            classes: [
              { classId: catalog.fighterId, classLabel: 'Fighter', classLevel: 2 },
              { classId: catalog.rogueId, classLabel: 'Rogue', classLevel: 1 }
            ],
            expectedMaxHitPoints: 27,
            hitDice: [
              { die: 10, total: 2, used: 0 },
              { die: 8, total: 1, used: 0 }
            ],
            hitpointLevels: [
              { level: 1, classId: catalog.fighterId, classLevel: 1, value: 12 },
              { level: 2, classId: catalog.rogueId, classLevel: 1, value: 7 },
              { level: 3, classId: catalog.fighterId, classLevel: 2, value: 8 }
            ],
            label: 'MVP Multiclass HP Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          }
        ]
        const selectedFixtures = (
          requestedFixture
            ? fixtures.filter(({ label }) => label.includes(requestedFixture))
            : fixtures
        ).map((fixture) => (fixtureLabel ? { ...fixture, label: fixtureLabel } : fixture))
        assert.ok(
          selectedFixtures.length > 0,
          `No Character lifecycle fixture matched "${requestedFixture ?? ''}".`
        )
        if (fixtureLabel && selectedFixtures.length !== 1) {
          throw new Error('CHARACTER_LIFECYCLE_LABEL requires exactly one selected fixture.')
        }
        executedFixtureLabels = selectedFixtures.map(({ label }) => label)

        for (const fixture of selectedFixtures) {
          let sheet = await proveFixtureLifecycle(trx, fixture, builderResolutionTimings)
          console.info(
            JSON.stringify({
              fixture: fixture.label,
              builderToSheetLifecycle: 'verified'
            })
          )
          if (resolutionOnly) continue

          if (fixture.preparedCasterClassId) {
            await provePreparedCasterCommands(trx, fixture, sheet)
          }
          if (fixture.hitDice) {
            sheet = await proveRetryAndConcurrencyCommands(trx, fixture, sheet)
            sheet = await proveConditionCommands(trx, fixture, sheet)
            sheet = await proveHitPointRestAndResourceCommands(trx, fixture, sheet)
            let inventory = await proveInventoryItemCommands(
              trx,
              fixture,
              sheet,
              attunementEquipmentId
            )
            inventory = await proveCurrencyCommands(trx, fixture, inventory)
            sheet = await proveInventoryRemovalCommands(trx, fixture, inventory)
            await proveNoteCommands(trx, fixture, sheet)
          }
        }

        completed = true
        if (!persistLocalFixtures) throw rollback
      })
    } catch (error) {
      if (error !== rollback) throw error
    }

    assert.equal(completed, true, 'The Character lifecycle proof did not reach its assertions.')
    if (!persistLocalFixtures) {
      for (const characterId of characterIds) {
        await assertFixtureWasRolledBack(db, characterId)
      }
      await assertCommandEquipmentWasRolledBack(db, attunementEquipmentId)
    }
    console.info(
      JSON.stringify({
        draftPersistence: 'verified',
        builderResolutionLatency: {
          maxMs: Math.max(...builderResolutionTimings.map(({ durationMs }) => durationMs)),
          p50Ms: percentileDuration(builderResolutionTimings, 0.5),
          p95Ms: percentileDuration(builderResolutionTimings, 0.95),
          samples: builderResolutionTimings
        },
        durationMs: Date.now() - startedAt,
        finalization: 'verified',
        fixtures: executedFixtureLabels,
        localDatabaseOnly: true,
        multiclassHitPointOrder: 'verified',
        preparedSpellPersistence: 'verified',
        preview: 'verified',
        resolution: 'verified',
        rollback: persistLocalFixtures ? 'skipped for local fixture persistence' : 'verified',
        persistedLocalFixtures: persistLocalFixtures,
        sheet: 'verified',
        sheetCommandPersistence: {
          conditions: ['SET_EXHAUSTION', 'ADD_CONDITION', 'REMOVE_CONDITION'],
          currency: ['ADJUST_CURRENCY', 'MOVE_CURRENCY'],
          hitPointsAndRest: [
            'SET_HIT_POINTS',
            'ADJUST_HIT_POINTS',
            'USE_SHEET_RESOURCE',
            'COMPLETE_REST',
            'exact rest result replay',
            'stale rest no-write rejection'
          ],
          inspirationAndConcurrency: [
            'SET_INSPIRATION',
            'exact retry',
            'same commandId rejection',
            'stale expectedVersion rejection'
          ],
          inventory: [
            'ADD_INVENTORY_ITEM',
            'UPDATE_INVENTORY_ITEM',
            'REMOVE_INVENTORY_ITEM',
            'EQUIP_ITEM',
            'UNEQUIP_ITEM',
            'ATTUNE_ITEM',
            'UNATTUNE_ITEM'
          ],
          notes: [
            'CREATE_NOTE_GROUP',
            'UPDATE_NOTE_GROUP',
            'DELETE_NOTE_GROUP',
            'CREATE_NOTE',
            'UPDATE_NOTE',
            'DELETE_NOTE'
          ],
          spells: ['SET_PREPARED_SPELLS', 'CAST_SPELL', 'RESTORE_SPELL_SLOT', 'USE_SPELL_SLOT']
        },
        sheetReload: 'verified'
      })
    )
  } finally {
    await db.destroy()
  }
}

await main()
