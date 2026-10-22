import { describe, expect, it } from 'vitest'
import {
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '../projections/encounterRunPersistence.js'
import { characterStoredCommandReceiptSchema } from '../projections/characterPersistence.js'
import { encounterStoreIndexes } from '../projections/encounterStore.js'
import {
  characterCommandReceiptHeaderSchema,
  encounterRuleReceiptHeaderSchema,
  encounterRunCommandHeaderSchema,
  receiptHeaderSchemas
} from '../projections/receiptHeaderPersistence.js'

const id = '00000000-0000-4000-8000-000000000001'
const commandId = '00000000-0000-4000-8000-000000000002'
const actorId = '00000000-0000-4000-8000-000000000003'
const checksum = 'a'.repeat(64)
const createdAt = '2026-09-29T12:00:00.000Z'
const pointer = { ledgerId: id, entryIndex: 0, entryChecksum: checksum }
const runMetadata = {
  campaignId: id,
  encounterId: id,
  commandId,
  commandFingerprint: checksum,
  actorUserId: actorId,
  createdAt,
  visibility: 'TABLE' as const
}

const cases = [
  {
    table: 'encounterRunCommands',
    logicalSchema: encounterStoredRunCommandSchema,
    metadata: { ...runMetadata, commandType: 'COMPLETE', id: commandId, version: 2 },
    body: { commandJson: '{}', replayReceiptJson: '{}', replayReceiptChecksum: checksum }
  },
  {
    table: 'encounterRuleReceipts',
    logicalSchema: encounterStoredRuleReceiptSchema,
    metadata: {
      id,
      campaignId: id,
      encounterId: id,
      occurrenceId: id,
      commandId,
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      commandFingerprint: checksum,
      encounterVersion: 0,
      actorUserId: actorId,
      createdAt
    },
    body: {
      commandMetadataJson: '{}',
      resultJson: '{}',
      resultChecksum: checksum,
      correlationId: null
    }
  },
  {
    table: 'characterCommandReceipts',
    logicalSchema: characterStoredCommandReceiptSchema,
    metadata: {
      id,
      characterId: id,
      commandId,
      actorId,
      commandFingerprint: checksum,
      occurredAt: createdAt
    },
    body: { historyJson: '{}', historyChecksum: checksum }
  }
] as const

describe('receipt persistence headers', () => {
  it('maps exactly the three physical receipt tables', () => {
    expect(Object.keys(receiptHeaderSchemas).sort()).toEqual(cases.map(({ table }) => table).sort())
  })

  it.each(cases)('$table retains logical scalar metadata and every indexed field', (fixture) => {
    const logical = fixture.logicalSchema.parse({ ...fixture.metadata, ...fixture.body })
    const header = receiptHeaderSchemas[fixture.table].parse({ ...fixture.metadata, ...pointer })

    expect(logical).toMatchObject(fixture.metadata)
    expect(header).toEqual({ ...fixture.metadata, ...pointer })
    for (const fields of Object.values(encounterStoreIndexes[fixture.table])) {
      for (const field of fields) {
        expect(Object.hasOwn(header, field), `${fixture.table}.${field}`).toBe(true)
      }
    }
  })

  it('roots a RESOLVE_ACTION in a rule occurrence or in a check receipt, never both or neither', () => {
    const occurrenceRoot = {
      kind: 'RULE_OCCURRENCE' as const,
      ruleOccurrenceId: id,
      ruleResultChecksum: checksum,
      optionalCombatSnapshotChecksum: checksum
    }
    const checkRoot = {
      kind: 'CHECK' as const,
      checkReceipt: {
        actorId,
        actionEconomy: null,
        featureResourceConsumption: null,
        checkOccurrenceId: null
      }
    }
    const root = {
      ...runMetadata,
      id,
      version: 1,
      commandJson: '{}',
      replayReceiptJson: '{}',
      replayReceiptChecksum: checksum,
      commandType: 'RESOLVE_ACTION' as const,
      label: 'First Aid',
      ruleOverrides: [],
      consumedGrants: [],
      endedMaintainedStates: [],
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      turnUses: null
    }
    const parses = (rooted: object) =>
      encounterStoredRunCommandSchema.safeParse({ ...root, root: rooted }).success
    expect(parses(occurrenceRoot)).toBe(true)
    expect(parses(checkRoot)).toBe(true)
    expect(parses({ ...occurrenceRoot, checkReceipt: checkRoot.checkReceipt })).toBe(false)
    expect(parses({ ...checkRoot, ruleOccurrenceId: id })).toBe(false)
    expect(parses({ kind: 'CHECK' })).toBe(false)
    expect(parses({ kind: 'RULE_OCCURRENCE', ruleOccurrenceId: id })).toBe(false)
  })

  it('accepts exactly the logical Run command discriminants without their branch bodies', () => {
    const commandTypes = encounterStoredRunCommandSchema.def.options.flatMap((option) => {
      const discriminator = option.shape.commandType.def
      return discriminator.type === 'literal'
        ? discriminator.values
        : Object.values(discriminator.entries)
    })
    const headerCommandTypes = encounterRunCommandHeaderSchema.def.options.flatMap((option) => {
      const discriminator = option.shape.commandType.def
      return discriminator.type === 'literal'
        ? discriminator.values
        : Object.values(discriminator.entries)
    })

    expect(new Set(headerCommandTypes)).toEqual(new Set(commandTypes))
    for (const commandType of commandTypes) {
      expect(
        encounterRunCommandHeaderSchema.safeParse({
          ...runMetadata,
          ...pointer,
          commandType,
          ...(commandType === 'CREATE' ? {} : { id: commandId, version: 1 })
        }).success
      ).toBe(true)
    }
  })

  it('preserves CREATE backfill identity/version and requires settled command identity/version', () => {
    const create = { ...runMetadata, commandType: 'CREATE' }
    const settled = { ...runMetadata, commandType: 'COMPLETE', id: commandId, version: 1 }
    for (const metadata of [create, { ...create, id: commandId, version: 0 }]) {
      expect(encounterStoredRunCommandSchema.parse(metadata)).toEqual(metadata)
      expect(encounterRunCommandHeaderSchema.parse({ ...metadata, ...pointer })).toEqual({
        ...metadata,
        ...pointer
      })
    }
    for (const invalid of [
      { ...create, version: 1 },
      { ...create, id: 'invalid' },
      { ...settled, id: undefined },
      { ...settled, version: undefined },
      { ...settled, version: 0 },
      { ...settled, version: -1 },
      { ...settled, version: 1.5 }
    ]) {
      expect(encounterRunCommandHeaderSchema.safeParse({ ...invalid, ...pointer }).success).toBe(
        false
      )
    }
    expect(
      encounterRunCommandHeaderSchema.safeParse({ ...settled, ...pointer, visibility: undefined })
        .success
    ).toBe(true)
    expect(
      encounterRunCommandHeaderSchema.safeParse({ ...settled, ...pointer, visibility: 'PUBLIC' })
        .success
    ).toBe(false)
  })

  it.each(cases)(
    '$table refuses removed bodies, nested gameplay, and invalid pointers',
    (fixture) => {
      const schema = receiptHeaderSchemas[fixture.table]
      const header = { ...fixture.metadata, ...pointer }
      for (const [field, value] of Object.entries(fixture.body)) {
        expect(schema.safeParse({ ...header, [field]: value }).success, field).toBe(false)
      }
      for (const extra of [
        { commandJson: '{}' },
        { historyJson: '{}' },
        { replayReceiptJson: '{}' },
        { receipt: { actorId, effects: [] } }
      ]) {
        expect(schema.safeParse({ ...header, ...extra }).success).toBe(false)
      }
      for (const invalid of [
        { entryIndex: -1 },
        { entryIndex: 0.5 },
        { entryIndex: Number.MAX_SAFE_INTEGER + 1 },
        { entryChecksum: 'invalid' },
        { entryChecksum: 'A'.repeat(64) },
        { commandFingerprint: 'invalid' },
        { ledgerId: 'invalid' }
      ]) {
        expect(schema.safeParse({ ...header, ...invalid }).success).toBe(false)
      }
    }
  )

  it('preserves Character RFC UUID validation and lowercase normalization', () => {
    const fixture = cases[2]
    const uppercaseId = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'
    const metadata = { ...fixture.metadata, actorId: uppercaseId }
    expect(characterCommandReceiptHeaderSchema.parse({ ...metadata, ...pointer }).actorId).toBe(
      characterStoredCommandReceiptSchema.parse({ ...metadata, ...fixture.body }).actorId
    )
    expect(characterCommandReceiptHeaderSchema.parse({ ...metadata, ...pointer }).actorId).toBe(
      uppercaseId.toLowerCase()
    )
    const nonRfcId = '00000000-0000-0000-0000-000000000001'
    expect(
      characterStoredCommandReceiptSchema.safeParse({
        ...fixture.metadata,
        ...fixture.body,
        actorId: nonRfcId
      }).success
    ).toBe(false)
    expect(
      characterCommandReceiptHeaderSchema.safeParse({
        ...fixture.metadata,
        ...pointer,
        actorId: nonRfcId
      }).success
    ).toBe(false)
  })

  it('preserves rule command labels', () => {
    const rule = { ...cases[1].metadata, ...pointer }
    expect(
      encounterRuleReceiptHeaderSchema.parse({ ...rule, commandType: ' START ' }).commandType
    ).toBe('START')
    for (const invalid of [
      { commandType: ' ' },
      { commandType: 'a'.repeat(81) },
      { encounterVersion: -1 }
    ]) {
      expect(encounterRuleReceiptHeaderSchema.safeParse({ ...rule, ...invalid }).success).toBe(
        false
      )
    }
  })
})
