import { describe, expect, it } from 'vitest'
import {
  authoredCatalogueMetadataSchema,
  authoredCatalogueOwnerCountsSchema,
  authoredCatalogueSummarySchema
} from '../api/authoredCatalogue.js'

describe('native catalogue metadata contract', () => {
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
  it('requires safe nonnegative summary counts and positive stored memberships', () => {
    const summary = {
      activeCount: 3,
      masterCount: 2,
      ownedCount: 1,
      categories: ['WEAPON']
    }
    expect(authoredCatalogueSummarySchema.parse(summary)).toEqual(summary)
    for (const count of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(
        authoredCatalogueSummarySchema.safeParse({ ...summary, activeCount: count }).success
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
