import { describe, expect, it } from 'vitest'
import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueOwnerCountsSchema,
  authoredCatalogueReadInputSchema,
  authoredCatalogueSearchInputSchema,
  authoredCatalogueSummaryInputSchema,
  authoredCatalogueSummarySchema
} from '../api/authoredCatalogue.js'

const input = {
  subjectKind: 'BACKGROUND',
  systemId: '10000000-0000-4000-8000-000000000001',
  source: 'MASTER',
  query: '  ancient libr  ',
  paginationOpts: { cursor: null, numItems: 48 }
}

it('allows global or exact-System browse without caller-selected ownership', () => {
  const browse = { subjectKind: 'BACKGROUND', paginationOpts: input.paginationOpts }
  expect(authoredCatalogueReadInputSchema.parse(browse)).toEqual(browse)
  expect(
    authoredCatalogueReadInputSchema.parse({ ...browse, systemId: input.systemId }).systemId
  ).toBe(input.systemId)
  for (const invalid of [
    { ...browse, systemId: '' },
    { ...browse, ownerUserId: input.systemId },
    { ...browse, source: 'ALL' },
    { ...browse, paginationOpts: { cursor: null, numItems: 49 } }
  ]) {
    expect(authoredCatalogueReadInputSchema.safeParse(invalid).success).toBe(false)
  }
})

describe('native catalogue search contract', () => {
  it('requires an explicit authorized source group and bounded native search terms', () => {
    expect(authoredCatalogueSearchInputSchema.parse(input).query).toBe('ancient libr')
    for (const subjectKind of ['CREATURE', 'SPELL']) {
      expect(authoredCatalogueSearchInputSchema.parse({ ...input, subjectKind }).subjectKind).toBe(
        subjectKind
      )
    }
    expect(
      authoredCatalogueSearchInputSchema.safeParse({ ...input, systemId: undefined }).success
    ).toBe(true)
    for (const invalid of [
      { ...input, source: undefined },
      { ...input, source: 'ALL' },
      { ...input, query: '---' },
      { ...input, query: Array.from({ length: 17 }, () => 'word').join(' ') },
      { ...input, paginationOpts: { cursor: null, numItems: 49 } }
    ]) {
      expect(authoredCatalogueSearchInputSchema.safeParse(invalid).success).toBe(false)
    }
  })

  it('accepts only an absent or complete native search marker', () => {
    const metadata = {
      checksum: 'a'.repeat(64),
      publicId: 'item',
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      nameKey: 'item',
      description: null
    }
    expect(authoredCatalogueMetadataSchema.safeParse(metadata).success).toBe(true)
    expect(
      authoredCatalogueMetadataSchema.safeParse({
        ...metadata,
        search: { version: 1, text: 'item' }
      }).success
    ).toBe(true)
    expect(
      authoredCatalogueMetadataSchema.safeParse({ ...metadata, search: { version: 1 } }).success
    ).toBe(false)
    expect(
      authoredCatalogueMetadataSchema.safeParse({ ...metadata, search: { text: 'item' } }).success
    ).toBe(false)
  })
})

describe('native catalogue summary contract', () => {
  it('accepts global filters without caller-selected owner or System scope', () => {
    const summary = { subjectKind: 'EQUIPMENT', source: 'OWNED', category: 'WEAPON' }
    expect(authoredCatalogueSummaryInputSchema.parse(summary)).toEqual(summary)
    expect(authoredCatalogueSummaryInputSchema.parse({ subjectKind: 'CLASS' })).toEqual({
      subjectKind: 'CLASS'
    })
    for (const invalid of [
      { ...summary, systemId: input.systemId },
      { ...summary, ownerUserId: input.systemId },
      { ...summary, source: 'ALL' },
      { ...summary, paginationOpts: input.paginationOpts }
    ]) {
      expect(authoredCatalogueSummaryInputSchema.safeParse(invalid).success).toBe(false)
    }
  })

  it('requires safe nonnegative summary counts and positive stored memberships', () => {
    const summary = {
      activeCount: 3,
      masterCount: 2,
      ownedCount: 1,
      totalCount: 1,
      categories: ['WEAPON']
    }
    expect(authoredCatalogueSummarySchema.parse(summary)).toEqual(summary)
    for (const count of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        authoredCatalogueSummarySchema.safeParse({ ...summary, totalCount: count }).success
      ).toBe(false)
    }
    const membership = {
      subjectKind: 'EQUIPMENT',
      count: 1,
      categories: [{ category: 'WEAPON', count: 1 }]
    }
    expect(authoredCatalogueOwnerCountsSchema.parse(membership)).toEqual(membership)
    for (const invalid of [
      { ...membership, count: 0 },
      { ...membership, categories: [{ category: 'WEAPON', count: 0 }] },
      {
        ...membership,
        categories: [
          { category: 'A', count: 1 },
          { category: 'B', count: 1 }
        ]
      },
      {
        ...membership,
        count: 2,
        categories: [
          { category: 'A', count: 1 },
          { category: 'A', count: 1 }
        ]
      },
      {
        ...membership,
        count: 2,
        categories: [
          { category: 'B', count: 1 },
          { category: 'A', count: 1 }
        ]
      },
      { ...membership, ownerUserId: '' },
      { ...membership, _id: 'database-internal-id' }
    ]) {
      expect(authoredCatalogueOwnerCountsSchema.safeParse(invalid).success).toBe(false)
    }
  })
})
