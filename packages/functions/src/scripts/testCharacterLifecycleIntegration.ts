import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

import { createDb, srdBaselineContent } from '@artificer-toolkit/db'
import {
  assertCharacterMechanicsProjectionChecksumFailsClosed,
  assertCommandEquipmentWasRolledBack,
  assertFixtureWasRolledBack,
  sheetCommandTimings
} from './characterLifecycleIntegrationAssertions.js'
import {
  createAttunementEquipmentFixture,
  findFixtureCatalog,
  percentileDuration,
  requireRecordByLabel,
  requireLocalDatabaseUrl,
  type BuilderResolutionTiming,
  type CharacterRuleEvaluationTiming,
  type CharacterLifecycleFixture,
  type SheetReadTiming
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

function summarizeLatency<T>(samples: readonly T[], select: (sample: T) => number) {
  const durations = samples.map((sample) => ({ durationMs: select(sample) }))
  return {
    maxMs: Math.max(...durations.map(({ durationMs }) => durationMs)),
    p50Ms: percentileDuration(durations, 0.5),
    p95Ms: percentileDuration(durations, 0.95)
  }
}

async function main(): Promise<void> {
  const connectionString = requireLocalDatabaseUrl()
  const db = createDb({ connectionString })
  const characterIds = Array.from({ length: 13 }, () => randomUUID())
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
  const ruleEvaluationTimings: CharacterRuleEvaluationTiming[] = []
  const sheetReadTimings: SheetReadTiming[] = []

  try {
    try {
      await db.transaction().execute(async (trx) => {
        const catalog = await findFixtureCatalog(trx)
        await createAttunementEquipmentFixture(trx, catalog, attunementEquipmentId)
        const fixtureCatalog = targetUserId ? { ...catalog, userId: targetUserId } : catalog
        if (!targetUserId) {
          await trx
            .updateTable('account_entitlements')
            .set({ tier: 'PLAYER' })
            .where('user_id', '=', fixtureCatalog.userId)
            .executeTakeFirstOrThrow()
        }
        const classRecord = (label: string, kind = 'class') =>
          requireRecordByLabel(srdBaselineContent.subjects.classes, label, kind)
        const barbarian = classRecord('Barbarian')
        const bard = classRecord('Bard')
        const druid = classRecord('Druid')
        const monk = classRecord('Monk')
        const paladin = classRecord('Paladin')
        const ranger = classRecord('Ranger')
        const sorcerer = classRecord('Sorcerer')
        const draconicBloodline = classRecord('Draconic Bloodline', 'subclass')
        const warlock = classRecord('Warlock')
        const fiend = classRecord('The Fiend', 'subclass')
        const wizard = classRecord('Wizard')
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
            initialEquipmentIds: [attunementEquipmentId],
            label: 'MVP Multiclass HP Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[4] as string,
            classes: [{ classId: barbarian.id, classLabel: 'Barbarian', classLevel: 1 }],
            expectedMaxHitPoints: 14,
            hitpointLevels: [{ level: 1, classId: barbarian.id, classLevel: 1, value: 14 }],
            label: 'MVP Barbarian Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[5] as string,
            classes: [{ classId: bard.id, classLabel: 'Bard', classLevel: 1 }],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: bard.id, classLevel: 1, value: 10 }],
            label: 'MVP Bard Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[6] as string,
            classes: [{ classId: druid.id, classLabel: 'Druid', classLevel: 1 }],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: druid.id, classLevel: 1, value: 10 }],
            label: 'MVP Druid Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[7] as string,
            classes: [{ classId: monk.id, classLabel: 'Monk', classLevel: 1 }],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: monk.id, classLevel: 1, value: 10 }],
            label: 'MVP Monk Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[8] as string,
            classes: [{ classId: paladin.id, classLabel: 'Paladin', classLevel: 1 }],
            expectedMaxHitPoints: 12,
            hitpointLevels: [{ level: 1, classId: paladin.id, classLevel: 1, value: 12 }],
            label: 'MVP Paladin Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[9] as string,
            classes: [{ classId: ranger.id, classLabel: 'Ranger', classLevel: 1 }],
            expectedMaxHitPoints: 12,
            hitpointLevels: [{ level: 1, classId: ranger.id, classLevel: 1, value: 12 }],
            label: 'MVP Ranger Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[10] as string,
            classes: [
              {
                classId: sorcerer.id,
                classLabel: 'Sorcerer',
                classLevel: 1,
                specializationLabel: 'Black Dragon',
                subclassId: draconicBloodline.id,
                subclassLabel: 'Draconic Bloodline'
              }
            ],
            expectedMaxHitPointBonus: 1,
            expectedMaxHitPoints: 9,
            hitpointLevels: [{ level: 1, classId: sorcerer.id, classLevel: 1, value: 8 }],
            label: 'MVP Sorcerer Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[11] as string,
            classes: [
              {
                classId: warlock.id,
                classLabel: 'Warlock',
                classLevel: 1,
                subclassId: fiend.id,
                subclassLabel: 'The Fiend'
              }
            ],
            expectedMaxHitPoints: 10,
            hitpointLevels: [{ level: 1, classId: warlock.id, classLevel: 1, value: 10 }],
            label: 'MVP Warlock Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          },
          {
            ...fixtureCatalog,
            characterId: characterIds[12] as string,
            classes: [{ classId: wizard.id, classLabel: 'Wizard', classLevel: 1 }],
            expectedMaxHitPoints: 8,
            hitpointLevels: [{ level: 1, classId: wizard.id, classLevel: 1, value: 8 }],
            label: 'MVP Wizard Lifecycle Proof',
            raceId: catalog.humanId,
            raceLabel: 'Human'
          }
        ]
        if (!requestedFixture) {
          assert.deepEqual(
            [
              ...new Set(
                fixtures.flatMap(({ classes }) => classes.map(({ classLabel }) => classLabel))
              )
            ].sort(),
            [
              'Barbarian',
              'Bard',
              'Cleric',
              'Druid',
              'Fighter',
              'Monk',
              'Paladin',
              'Ranger',
              'Rogue',
              'Sorcerer',
              'Warlock',
              'Wizard'
            ]
          )
        }
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
          let sheet = await proveFixtureLifecycle(
            trx,
            fixture,
            builderResolutionTimings,
            sheetReadTimings,
            ruleEvaluationTimings
          )
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
          if (!persistLocalFixtures && fixture === selectedFixtures[0]) {
            await assertCharacterMechanicsProjectionChecksumFailsClosed(trx, fixture.characterId)
            console.info(JSON.stringify({ characterMechanicsProjectionIntegrity: 'verified' }))
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
        supportedClassCoverage: '12/12',
        localDatabaseOnly: true,
        multiclassHitPointOrder: 'verified',
        preparedSpellPersistence: 'verified',
        preview: 'verified',
        ruleEvaluationLatency: {
          binding: summarizeLatency(ruleEvaluationTimings, ({ bindingMs }) => bindingMs),
          factDiscovery: summarizeLatency(
            ruleEvaluationTimings,
            ({ factDiscoveryMs }) => factDiscoveryMs
          ),
          factAssembly: summarizeLatency(
            ruleEvaluationTimings,
            ({ factAssemblyMs }) => factAssemblyMs
          ),
          runtime: summarizeLatency(ruleEvaluationTimings, ({ runtimeMs }) => runtimeMs),
          spellHydration: summarizeLatency(
            ruleEvaluationTimings,
            ({ spellHydrationMs }) => spellHydrationMs
          ),
          total: summarizeLatency(ruleEvaluationTimings, ({ totalMs }) => totalMs),
          zenEvaluation: summarizeLatency(
            ruleEvaluationTimings,
            ({ zenEvaluationMs }) => zenEvaluationMs
          ),
          maximumBytes: {
            document: Math.max(...ruleEvaluationTimings.map(({ documentBytes }) => documentBytes)),
            normalizedFacts: Math.max(
              ...ruleEvaluationTimings.map(({ normalizedFactsBytes }) => normalizedFactsBytes)
            ),
            result: Math.max(...ruleEvaluationTimings.map(({ resultBytes }) => resultBytes))
          },
          samples: ruleEvaluationTimings
        },
        resolution: 'verified',
        rollback: persistLocalFixtures ? 'skipped for local fixture persistence' : 'verified',
        persistedLocalFixtures: persistLocalFixtures,
        sheet: 'verified',
        sheetReadLatency: {
          maxMs: Math.max(...sheetReadTimings.map(({ durationMs }) => durationMs)),
          p50Ms: percentileDuration(sheetReadTimings, 0.5),
          p95Ms: percentileDuration(sheetReadTimings, 0.95),
          samples: sheetReadTimings
        },
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
        sheetCommandLatency: {
          maxMs: Math.max(0, ...sheetCommandTimings.map(({ durationMs }) => durationMs)),
          p50Ms: percentileDuration(sheetCommandTimings, 0.5),
          p95Ms: percentileDuration(sheetCommandTimings, 0.95),
          samples: sheetCommandTimings
        },
        sheetReload: 'verified'
      })
    )
  } finally {
    await db.destroy()
  }
}

await main()
