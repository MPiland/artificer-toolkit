import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'

import { createDb, type DBLike } from '@artificer-toolkit/db'
import {
  type CharacterSheetCommandInputDto,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import { AUTHORED_RECORD_STATUS } from '@artificer-toolkit/shared/core'
import {
  dispatchCommandForUser,
  getCharacterSheetForUser
} from '../services/character/characterApplicationService.js'
import type { CharacterSheetCommandServiceTiming } from '../services/character/sheetService.js'
import {
  expectedClassSummary,
  expectedTotalLevel,
  type CharacterLifecycleFixture
} from './characterLifecycleIntegrationFixtures.js'

type CharacterSheetCommandPayload = CharacterSheetCommandInputDto extends infer Command
  ? Command extends CharacterSheetCommandInputDto
    ? Omit<Command, 'commandId' | 'expectedVersion'>
    : never
  : never

export interface SheetCommandTiming {
  command: CharacterSheetCommandPayload['type']
  durationMs: number
  fixture: string
  service: CharacterSheetCommandServiceTiming
}

export const sheetCommandTimings: SheetCommandTiming[] = []

export function canonicalize(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown
}

export async function dispatchAndReloadSheetCommand(
  db: DBLike,
  fixture: CharacterLifecycleFixture,
  sheet: CharacterSheetResponseDto,
  payload: CharacterSheetCommandPayload
): Promise<CharacterSheetResponseDto> {
  const command = {
    ...payload,
    commandId: randomUUID(),
    expectedVersion: sheet.meta.streamVersion
  } as CharacterSheetCommandInputDto
  let serviceTiming: CharacterSheetCommandServiceTiming | undefined
  const startedAt = performance.now()
  const result = await dispatchCommandForUser(db, fixture.characterId, command, fixture.userId, {
    onServiceTiming: (timing) => {
      serviceTiming = timing
    }
  })
  assert.ok(serviceTiming, `${fixture.label} ${payload.type} did not report service timing.`)
  const timing: SheetCommandTiming = {
    command: payload.type,
    durationMs: performance.now() - startedAt,
    fixture: fixture.label,
    service: serviceTiming
  }
  sheetCommandTimings.push(timing)
  assert.equal(
    result.streamVersion,
    sheet.meta.streamVersion + 1,
    `${fixture.label} ${payload.type} did not advance the stream exactly once.`
  )

  const reloaded = await getCharacterSheetForUser(db, fixture.characterId, fixture.userId)
  assert.ok(reloaded, `${fixture.label} could not be reloaded after ${payload.type}.`)
  assert.deepEqual(
    canonicalize(reloaded),
    canonicalize(result.sheet),
    `${fixture.label} ${payload.type} response did not match its persisted Sheet reload.`
  )
  console.info(
    JSON.stringify({
      command: payload.type,
      fixture: fixture.label,
      persistedReload: 'verified',
      sheetCommandTiming: timing
    })
  )

  return reloaded
}

export async function assertFixtureWasRolledBack(
  db: ReturnType<typeof createDb>,
  characterId: string
): Promise<void> {
  const [characters, drafts, events, routeIds] = await Promise.all([
    db.selectFrom('characters').select('id').where('id', '=', characterId).execute(),
    db
      .selectFrom('character_builder_drafts')
      .select('id')
      .where('character_id', '=', characterId)
      .execute(),
    db
      .selectFrom('character_events')
      .select('event_id')
      .where('character_id', '=', characterId)
      .execute(),
    db
      .selectFrom('authored_route_ids')
      .select('subject_id')
      .where('subject_kind', '=', 'CHARACTER')
      .where('subject_id', '=', characterId)
      .execute()
  ])

  assert.deepEqual(characters, [], 'The finalized Character escaped its rollback transaction.')
  assert.deepEqual(drafts, [], 'The Character Builder draft escaped its rollback transaction.')
  assert.deepEqual(
    events,
    [],
    'The Character Sheet command events escaped their rollback transaction.'
  )
  assert.deepEqual(
    routeIds,
    [],
    'The Character public route identity escaped its rollback transaction.'
  )
}

export async function assertCommandEquipmentWasRolledBack(
  db: ReturnType<typeof createDb>,
  equipmentId: string
): Promise<void> {
  const equipment = await db
    .selectFrom('equipment')
    .select('id')
    .where('id', '=', equipmentId)
    .execute()
  assert.deepEqual(
    equipment,
    [],
    'The Sheet command equipment fixture escaped its rollback transaction.'
  )
}

export function assertSheetMatchesFixture(
  sheet: CharacterSheetResponseDto,
  fixture: CharacterLifecycleFixture,
  stage: string
): void {
  assert.equal(sheet.meta.characterId, fixture.characterId)
  assert.equal(sheet.meta.status, AUTHORED_RECORD_STATUS.ACTIVE)
  assert.equal(sheet.identity.label, fixture.label)
  assert.equal(sheet.identity.raceLabel, fixture.raceLabel)
  assert.equal(sheet.identity.backgroundLabel, 'Acolyte')
  assert.equal(
    sheet.identity.classSummary,
    expectedClassSummary(fixture),
    `${fixture.label} ${stage} exposed the wrong class summary.`
  )
  assert.equal(
    sheet.identity.totalLevel,
    expectedTotalLevel(fixture),
    `${fixture.label} ${stage} exposed the wrong total level.`
  )
  assert.equal(sheet.overview.currentHitPoints, fixture.expectedMaxHitPoints)
  assert.equal(sheet.overview.maxHitPoints, fixture.expectedMaxHitPoints)

  if (fixture.hitDice) {
    for (const expected of fixture.hitDice) {
      const expectedSheetDie = { ...expected, remaining: expected.total - expected.used }
      assert.deepEqual(
        sheet.overview.hitDice.find(({ die }) => die === expected.die),
        expectedSheetDie,
        `${fixture.label} ${stage} overview did not preserve its d${expected.die} hit dice.`
      )
      assert.deepEqual(
        sheet.resources.hitDice.find(({ die }) => die === expected.die),
        expectedSheetDie,
        `${fixture.label} ${stage} resources did not preserve its d${expected.die} hit dice.`
      )
    }
    assert.equal(sheet.overview.hitDice.length, fixture.hitDice.length)
    assert.equal(sheet.resources.hitDice.length, fixture.hitDice.length)
  }
}
