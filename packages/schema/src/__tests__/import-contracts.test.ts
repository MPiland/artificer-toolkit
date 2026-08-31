import { describe, expect, it } from 'vitest'

import {
  IMPORT_MAX_PORTABLE_DEPTH,
  IMPORT_MAX_PORTABLE_NODES,
  IMPORT_MAX_PORTABLE_REFERENCES,
  IMPORT_MAX_ENTRY_BYTES,
  IMPORT_MAX_CUSTOM_CONTENT_CHOICES,
  artificerPortableContentDtoSchema,
  importBatchInputDtoSchema,
  importCommitRequestDtoSchema,
  importCollisionResolutionDtoSchema,
  importPreviewItemDtoSchema
} from '../api/imports.js'

describe('import contracts', () => {
  it('accepts normal source-shaped import batches', () => {
    expect(
      importBatchInputDtoSchema.parse({
        source: 'DND_BEYOND',
        systemId: '00000000-0000-4000-8000-000000000001',
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
        entries: [{ entryId: 'character-1', url: 'https://www.dndbeyond.com/characters/74476867' }]
      })
    ).toMatchObject({ source: 'DND_BEYOND' })

    expect(
      importBatchInputDtoSchema.parse({
        source: 'FOUNDRY_DND5E',
        systemId: '00000000-0000-4000-8000-000000000001',
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
        entries: [{ entryId: 'actor-1', name: 'actor.json', text: '{}' }]
      })
    ).toMatchObject({ source: 'FOUNDRY_DND5E' })
  })

  it('rejects duplicate entry ids and oversized files', () => {
    expect(() =>
      importBatchInputDtoSchema.parse({
        source: 'ARTIFICER_JSON',
        entries: [
          { entryId: 'same', name: 'one.json', text: '{}' },
          { entryId: 'same', name: 'two.json', text: 'x'.repeat(IMPORT_MAX_ENTRY_BYTES + 1) }
        ]
      })
    ).toThrow()
  })

  it('defaults collision handling to a non-destructive copy', () => {
    expect(importCollisionResolutionDtoSchema.parse({ entryId: 'one' })).toEqual({
      entryId: 'one',
      choice: 'COPY',
      confirmDraftReplacement: false
    })
  })

  it('requires selected entries to belong to the committed batch', () => {
    expect(() =>
      importCommitRequestDtoSchema.parse({
        batch: {
          source: 'DND_BEYOND',
          systemId: '00000000-0000-4000-8000-000000000001',
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/1' }]
        },
        selectedEntryIds: ['missing'],
        resolutions: []
      })
    ).toThrow()
  })

  it('rejects duplicate collision resolutions', () => {
    expect(() =>
      importCommitRequestDtoSchema.parse({
        batch: {
          source: 'DND_BEYOND',
          systemId: '00000000-0000-4000-8000-000000000001',
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/1' }]
        },
        selectedEntryIds: ['one'],
        resolutions: [
          { entryId: 'one', choice: 'COPY' },
          { entryId: 'one', choice: 'UPDATE_DRAFT' }
        ]
      })
    ).toThrow()
  })

  it('defaults custom content choices and rejects duplicate choices', () => {
    const request = {
      batch: {
        source: 'DND_BEYOND' as const,
        systemId: '00000000-0000-4000-8000-000000000001',
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
        entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/1' }]
      },
      selectedEntryIds: ['one'],
      resolutions: []
    }
    expect(importCommitRequestDtoSchema.parse(request).customContentChoices).toEqual([])
    expect(() =>
      importCommitRequestDtoSchema.parse({
        ...request,
        customContentChoices: [
          { entryId: 'one', subjectKind: 'FEAT', externalId: 'feat-1', choice: 'ACTIVE' },
          { entryId: 'one', subjectKind: 'FEAT', externalId: 'feat-1', choice: 'DRAFT' }
        ]
      })
    ).toThrow()
  })

  it('accepts custom content choices beyond the top-level import entry cap', () => {
    expect(
      importCommitRequestDtoSchema.parse({
        batch: {
          source: 'DND_BEYOND',
          systemId: '00000000-0000-4000-8000-000000000001',
          primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/1' }]
        },
        selectedEntryIds: ['one'],
        resolutions: [],
        customContentChoices: Array.from({ length: 48 }, (_, index) => ({
          entryId: 'one',
          subjectKind: 'EQUIPMENT',
          externalId: `custom-${index}`,
          choice: 'DRAFT'
        }))
      }).customContentChoices
    ).toHaveLength(48)
    expect(IMPORT_MAX_CUSTOM_CONTENT_CHOICES).toBeGreaterThanOrEqual(48)
  })

  it('accepts structured existing matches and omitted content summaries', () => {
    expect(
      importPreviewItemDtoSchema.parse({
        entryId: 'one',
        name: 'Aria',
        status: 'READY',
        issues: [],
        existingMatches: [
          { sourceLabel: 'wizard', matchedLabel: 'Wizard', subjectKind: 'CLASS', count: 1 }
        ],
        notImported: [{ label: 'Unknown item', subjectKind: 'EQUIPMENT', count: 2 }]
      })
    ).toMatchObject({ status: 'READY' })
  })

  it('parses versioned portable content without database metadata', () => {
    expect(
      artificerPortableContentDtoSchema.parse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data: { id: 'spell-1', label: 'Spark' } },
        references: [
          {
            kind: 'CLASS',
            id: 'class-1',
            label: 'Wizard',
            importSource: null,
            importId: null
          }
        ]
      })
    ).toMatchObject({ format: 'artificer-content', version: 1 })
  })

  it('caps portable references and nested array fanout', () => {
    const reference = { kind: 'CLASS' as const, label: 'Wizard' }
    expect(
      artificerPortableContentDtoSchema.safeParse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data: {} },
        references: Array.from({ length: IMPORT_MAX_PORTABLE_REFERENCES }, () => reference)
      }).success
    ).toBe(true)
    expect(
      artificerPortableContentDtoSchema.safeParse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data: { values: Array(IMPORT_MAX_PORTABLE_REFERENCES + 1) } },
        references: []
      }).success
    ).toBe(false)
    expect(
      artificerPortableContentDtoSchema.safeParse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data: {} },
        references: Array.from({ length: IMPORT_MAX_PORTABLE_REFERENCES + 1 }, () => reference)
      }).success
    ).toBe(false)
  })

  it('caps portable data depth without recursive validation', () => {
    const nested = (depth: number): Record<string, unknown> => {
      let value: unknown = 'leaf'
      for (let index = 0; index < depth; index += 1) value = { child: value }
      return value as Record<string, unknown>
    }
    const base = (data: Record<string, unknown>) => ({
      format: 'artificer-content' as const,
      version: 1 as const,
      item: { kind: 'SPELL' as const, data },
      references: []
    })

    expect(
      artificerPortableContentDtoSchema.safeParse(base(nested(IMPORT_MAX_PORTABLE_DEPTH))).success
    ).toBe(true)
    expect(
      artificerPortableContentDtoSchema.safeParse(base(nested(IMPORT_MAX_PORTABLE_DEPTH + 1)))
        .success
    ).toBe(false)
  })

  it('caps total portable data nodes', () => {
    const data = Object.fromEntries(
      Array.from({ length: IMPORT_MAX_PORTABLE_NODES - 1 }, (_, index) => [`key-${index}`, index])
    )
    const overLimit = Object.fromEntries(
      Array.from({ length: IMPORT_MAX_PORTABLE_NODES }, (_, index) => [`key-${index}`, index])
    )

    expect(
      artificerPortableContentDtoSchema.safeParse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data },
        references: []
      }).success
    ).toBe(true)
    expect(
      artificerPortableContentDtoSchema.safeParse({
        format: 'artificer-content',
        version: 1,
        item: { kind: 'SPELL', data: overLimit },
        references: []
      }).success
    ).toBe(false)
  })
})
