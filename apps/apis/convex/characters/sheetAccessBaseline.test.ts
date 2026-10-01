import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import {
  characterSheetCommandResponseDtoSchema,
  type CharacterSheetExecuteInput
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import { cat } from '@artificer-toolkit/source-data/srd/creatures/cat.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { wizard } from '@artificer-toolkit/source-data/srd/classes/wizard.js'
import { magicMissile } from '@artificer-toolkit/source-data/srd/spells/magic-missile.js'
import { shield } from '@artificer-toolkit/source-data/srd/spells/shield.js'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { countDatabaseIo, createDatabaseIoTotals } from '../../tests/fixtures/databaseIo'
import { importedSubject } from '../../tests/fixtures/publication'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { api, internal } from '../_generated/api'
import {
  executeCharacterSheetCommand,
  executeCharacterSheetCommandAcknowledgement
} from './sheetCommands'
import { loadCharacterSheet } from './sheetPreparation'
import { loadCharacterSheetNotes } from './sheetSlices'

type CommandBody<Command = CharacterSheetExecuteInput['command']> = Command extends unknown
  ? Omit<Command, 'commandId' | 'expectedVersion'>
  : never

afterEach(() => vi.useRealTimers())

it('records local Sheet access for eight populated Character behaviors', async () => {
  // Keep the fixture's one-minute auth session valid; elapsed measurements use the real clock.
  vi.useFakeTimers({ toFake: ['Date'] })
  if (!wizard.spellcasting) throw new Error('Expected Wizard spellcasting.')
  const fixture = await readySheetFixture({
    spellcasting: {
      ...wizard.spellcasting,
      attributes: ['PREPARES_SPELLS', 'USES_SPELLBOOK'],
      spellLimits: [{ classLevel: 1, slots: [{ spellLevel: 1, slotCount: 2 }], cantripsLimit: 0 }]
    }
  })
  const { owner, character, baseClass } = fixture
  await fixture.t.mutation(internal.content.import.importSubjects, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [
      importedSubject({ subjectKind: 'EQUIPMENT', ...backpack, document: backpack }),
      importedSubject({ subjectKind: 'CREATURE', ...cat, document: cat }),
      ...[magicMissile, shield].map((spell) =>
        importedSubject({
          subjectKind: 'SPELL',
          ...spell,
          document: { ...spell, classIds: [baseClass.id] }
        })
      )
    ]
  })
  let version = fixture.committed.streamVersion
  const setupCommand = async (body: CommandBody) => {
    const response = await owner.caller.mutation(api.characters.sheetCommands.execute, {
      id: character.id,
      command: { ...body, commandId: crypto.randomUUID(), expectedVersion: version }
    })
    expect(response.streamVersion).toBe(version + 1)
    version = response.streamVersion
  }
  const readSheet = async () => {
    const sheet = await owner.caller.query(api.characters.sheet.get, { id: character.id })
    if (!sheet) throw new Error('Expected populated Character Sheet.')
    return sheet
  }
  await setupCommand({ type: 'ADD_INVENTORY_ITEM', equipmentId: backpack.id, quantity: 1 })
  const bag = (await readSheet()).inventory.containers?.[0]
  if (!bag) throw new Error('Expected baseline container.')
  const currencyId = baseClass.startingGold.currencyId
  await setupCommand({
    type: 'ADJUST_CURRENCY',
    kind: 'RULESET',
    currencyId,
    amount: 10,
    containerId: bag.id
  })
  await setupCommand({
    type: 'SET_KNOWN_SPELLS',
    classId: baseClass.id,
    spellIds: [magicMissile.id, shield.id]
  })
  await setupCommand({ type: 'SET_PREPARED_SPELLS', classId: baseClass.id, spellIds: [shield.id] })
  await setupCommand({
    type: 'ADD_SHEET_EXTRA',
    extra: { kind: 'COMPANION', creatureId: cat.id, originKind: 'WORLD' }
  })
  await setupCommand({
    type: 'CREATE_NOTE',
    title: 'Café 🐈',
    body: 'Préparer le voyage — 雪',
    groupId: 'session-notes'
  })
  const populated = await readSheet()
  const prone = populated.reference.conditionOptions.find(
    (condition) => condition.label === 'Prone'
  )
  const blinded = populated.reference.conditionOptions.find(
    (condition) => condition.label === 'Blinded'
  )
  const item = populated.inventory.items.find((entry) => entry.equipmentId !== backpack.id)
  const companion = populated.extras.items.find((entry) => entry.kind === 'COMPANION')
  const note = populated.notes.items?.[0]
  if (!prone || !blinded || !item || !companion || !note)
    throw new Error('Expected baseline conditions, inventory, companion and note.')
  await setupCommand({ type: 'ADD_CONDITION', conditionTypeId: prone.id, notes: 'Baseline prone' })

  const measurements: Array<
    ReturnType<typeof createDatabaseIoTotals> & {
      operation: string
      elapsedMs: number
      completeResultBytes: number
      compactAcknowledgementBytes: number | null
    }
  > = []
  const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength
  const openTotals = createDatabaseIoTotals()
  const openStart = performance.now()
  const loaded = await owner.caller.run(async (ctx) => {
    const result = await loadCharacterSheet(
      { ...ctx, db: countDatabaseIo(ctx.db, openTotals) },
      owner.userId,
      character.id
    )
    // Only the validated transport DTO crosses convex-test's transaction boundary.
    return result ? { sheet: result.sheet } : null
  })
  const openElapsedMs = performance.now() - openStart
  if (!loaded) throw new Error('Expected baseline Sheet open.')
  expect(loaded.sheet.meta.streamVersion).toBe(version)
  expect(loaded.sheet.inventory.items.length).toBeGreaterThanOrEqual(2)
  expect(loaded.sheet.overview.conditions).toContainEqual(
    expect.objectContaining({ conditionTypeId: prone.id })
  )
  expect(loaded.sheet.spells.preparationSources).toContainEqual(
    expect.objectContaining({ preparedSpellIds: [shield.id] })
  )
  expect(loaded.sheet.extras.items).toContainEqual(expect.objectContaining({ id: companion.id }))
  expect(loaded.sheet.notes.items).toContainEqual(
    expect.objectContaining({ title: 'Café 🐈', body: 'Préparer le voyage — 雪' })
  )
  measurements.push({
    operation: 'Sheet open',
    ...openTotals,
    elapsedMs: openElapsedMs,
    completeResultBytes: byteSize(loaded.sheet),
    compactAcknowledgementBytes: null
  })
  const measureCommand = async (operation: string, body: CommandBody) => {
    const totals = createDatabaseIoTotals()
    const started = performance.now()
    const result = await owner.caller.run((ctx) =>
      executeCharacterSheetCommand({ ...ctx, db: countDatabaseIo(ctx.db, totals) }, owner.userId, {
        id: character.id,
        command: { ...body, commandId: crypto.randomUUID(), expectedVersion: version }
      })
    )
    const elapsedMs = performance.now() - started
    expect(result.streamVersion).toBe(version + 1)
    expect(result.sheet.meta.streamVersion).toBe(result.streamVersion)
    const { sheet, ...fields } = result
    const acknowledgement = characterSheetCommandResponseDtoSchema.parse(fields)
    expect(acknowledgement).not.toHaveProperty('sheet')
    expect(acknowledgement).not.toHaveProperty('panels')
    measurements.push({
      operation,
      ...totals,
      elapsedMs,
      completeResultBytes: byteSize(result),
      compactAcknowledgementBytes: byteSize(acknowledgement)
    })
    version = result.streamVersion
    return sheet
  }
  const damaged = await measureCommand('HP', {
    type: 'ADJUST_HIT_POINTS',
    mode: 'DAMAGE',
    amount: 1
  })
  expect(damaged.overview.currentHitPoints).toBe(loaded.sheet.overview.currentHitPoints - 1)
  const conditioned = await measureCommand('Conditions', {
    type: 'ADD_CONDITION',
    conditionTypeId: blinded.id,
    notes: 'Baseline smoke'
  })
  expect(conditioned.overview.conditions).toContainEqual(
    expect.objectContaining({ conditionTypeId: blinded.id, notes: 'Baseline smoke' })
  )
  const inventory = await measureCommand('Inventory', {
    type: 'UPDATE_INVENTORY_ITEM',
    itemId: item.id,
    customName: 'Baseline club'
  })
  expect(inventory.inventory.items.find((entry) => entry.id === item.id)?.customName).toBe(
    'Baseline club'
  )
  const currency = await measureCommand('Currency', {
    type: 'ADJUST_CURRENCY',
    kind: 'RULESET',
    currencyId,
    amount: 1,
    containerId: bag.id
  })
  expect(currency.inventory.currencies).toContainEqual(
    expect.objectContaining({ currencyId, containerId: bag.id, amount: 11 })
  )
  const prepared = await measureCommand('Spell preparation', {
    type: 'SET_PREPARED_SPELLS',
    classId: baseClass.id,
    spellIds: [magicMissile.id]
  })
  expect(prepared.spells.preparationSources).toContainEqual(
    expect.objectContaining({ preparedSpellIds: [magicMissile.id] })
  )
  const companionHealth = await measureCommand('Companion health', {
    type: 'UPDATE_SHEET_EXTRA',
    extra: { kind: 'COMPANION', extraId: companion.id, currentHitPoints: 1, tempHitPoints: 1 }
  })
  expect(
    companionHealth.extras.items.find((entry) => entry.id === companion.id)?.hitPoints
  ).toMatchObject({ current: 1, temp: 1 })
  const notes = await measureCommand('Notes', {
    type: 'UPDATE_NOTE',
    noteId: note.id,
    title: 'Café 🐈 révisé',
    body: 'Voyage prêt — 雪',
    pinned: true
  })
  expect(notes.notes.items).toContainEqual(
    expect.objectContaining({
      id: note.id,
      title: 'Café 🐈 révisé',
      body: 'Voyage prêt — 雪',
      pinned: true
    })
  )
  expect(measurements).toHaveLength(8)
  const noteTotals = createDatabaseIoTotals()
  const noteStarted = performance.now()
  const noteAcknowledgement = await owner.caller.run((ctx) =>
    executeCharacterSheetCommandAcknowledgement(
      { ...ctx, db: countDatabaseIo(ctx.db, noteTotals) },
      owner.userId,
      {
        id: character.id,
        command: {
          type: 'UPDATE_NOTE',
          commandId: crypto.randomUUID(),
          expectedVersion: version,
          noteId: note.id,
          title: 'Café 🐈 sans mécanique'
        }
      }
    )
  )
  const noteElapsedMs = performance.now() - noteStarted
  expect(noteAcknowledgement.streamVersion).toBe(version + 1)
  expect(noteTotals.reads.bytes).toBeLessThan(measurements[7]!.reads.bytes)
  expect((await readSheet()).notes.items).toContainEqual(
    expect.objectContaining({ id: note.id, title: 'Café 🐈 sans mécanique', pinned: true })
  )
  const noteQueryTotals = createDatabaseIoTotals()
  const noteQueryStarted = performance.now()
  const noteSlice = await owner.caller.run((ctx) =>
    loadCharacterSheetNotes(
      { ...ctx, db: countDatabaseIo(ctx.db, noteQueryTotals) },
      owner.userId,
      character.id
    )
  )
  const noteQueryElapsedMs = performance.now() - noteQueryStarted
  expect(noteSlice?.meta.streamVersion).toBe(noteAcknowledgement.streamVersion)
  expect(noteSlice?.notes.items).toContainEqual(
    expect.objectContaining({ id: note.id, title: 'Café 🐈 sans mécanique', pinned: true })
  )
  for (const table of [
    'characterInventoryItems',
    'characterCurrencyGroups',
    'characterClassSpellStates',
    'characterSpellCustomizations',
    'characterCreatureInstances',
    'characterVehicleInstances',
    'characterExtraEquipment',
    'authoredRoots',
    'authoredVersions'
  ])
    expect(noteQueryTotals.reads.byTable[table]).toBeUndefined()
  const evidenceDirectory = resolve('local-validation/phase82-sheet-access')
  await mkdir(evidenceDirectory, { recursive: true })
  await writeFile(
    resolve(evidenceDirectory, 'baseline.json'),
    JSON.stringify(
      {
        sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
        measuredAt: new Date().toISOString(),
        scope:
          'convex-test internal transaction instrumentation; local personal Sheet; no hosted/native latency or SDK subscription invalidation measurement',
        byteMetric: 'UTF-8 JSON bytes; excludes Convex storage/billing/protocol overhead',
        resultShapes:
          'Sheet open: CharacterSheetResponseDto; commands: CharacterSheetCommandExecutionDto with transaction-local Sheet; compact acknowledgement: CharacterSheetCommandResponseDto. No acknowledgement applies to Sheet open.',
        grouping:
          'Indexed reads grouped by table; db.get reads under get; replace/patch/delete writes grouped by method. Distinct reads follow countDatabaseIo document-ID tracking.',
        subscriptionInvalidation: { status: 'pending native proof', counts: null },
        fixture: {
          inventoryItems: loaded.sheet.inventory.items.length,
          currencyBalances: loaded.sheet.inventory.currencies.length,
          conditions: loaded.sheet.overview.conditions.length,
          preparationSources: loaded.sheet.spells.preparationSources?.length ?? 0,
          extras: loaded.sheet.extras.items.length,
          notes: loaded.sheet.notes.items?.length ?? 0
        },
        measurements,
        focusedCommandMeasurements: [
          {
            operation: 'Notes acknowledgement without mechanics',
            ...noteTotals,
            elapsedMs: noteElapsedMs,
            compactAcknowledgementBytes: byteSize(noteAcknowledgement)
          }
        ],
        focusedQueryMeasurements: [
          {
            operation: 'Complete owner notebook without other families',
            ...noteQueryTotals,
            elapsedMs: noteQueryElapsedMs,
            completeResultBytes: byteSize(noteSlice)
          }
        ]
      },
      null,
      2
    ) + '\n',
    'utf8'
  )
}, 60_000)
