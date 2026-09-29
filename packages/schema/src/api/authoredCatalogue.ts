import { z, lazySchema } from '../zod.js'
import { authoredSubjectKindSchema, projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { castingTimeDtoSchema } from '../subjects/castingTime.js'
import { RACE_SELECTION_MODE } from '@artificer-toolkit/shared/subjects/core'
import {
  authoredContentPermissionsDtoSchema,
  authoredContentProvenanceDtoSchema
} from './common.js'

// Derived list data, never a second authored document or an execution input.
export const authoredCatalogueFamilySchema = lazySchema(() =>
  z.strictObject({
    // UUID establishes the group; the label key only orders groups alphabetically.
    id: postgresUuidSchema,
    nameKey: z.string()
  })
)

export const authoredDeletedReferenceSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: z.enum(['CLASS', 'RACE', 'EQUIPMENT']),
    subjectId: postgresUuidSchema,
    label: z.string().check(z.minLength(1))
  })
)

export const authoredCatalogueMetadataSchema = lazySchema(() =>
  z.strictObject({
    // Server-retained labels keep an existing dependent readable after owner source deletion.
    deletedReferences: z.optional(z.array(authoredDeletedReferenceSchema)),
    checksum: projectionChecksumSchema,
    publicId: z.string().check(z.minLength(1)),
    activeUpdatedAt: z.iso.datetime(),
    nameKey: z.string(),
    description: z.nullable(z.string()),
    category: z.optional(z.string()),
    selectionMode: z.optional(z.enum(RACE_SELECTION_MODE)),
    spell: z.optional(
      z.strictObject({
        level: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)),
        magicSchoolId: z.string().check(z.minLength(1)),
        magicSchoolNameKey: z.string().check(z.minLength(1)),
        classIds: z.array(postgresUuidSchema).check(z.maxLength(500)),
        castingTime: castingTimeDtoSchema
      })
    ),
    // Tracks membership in the owner-wide browse totals during exact backfill.
    countsVersion: z.optional(z.literal(1)),
    // Optional during the exact metadata backfill. The small marker is indexed separately
    // so search can reject an incomplete source without indexing the full text twice.
    search: z.optional(z.strictObject({ version: z.literal(1), text: z.string() }))
  })
)

export const authoredCatalogueScopeSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: z.enum([
      'BACKGROUND',
      'CLASS',
      'CREATURE',
      'EQUIPMENT',
      'FEAT',
      'RACE',
      'SPELL',
      'VEHICLE'
    ]),
    systemId: z.pipe(
      postgresUuidSchema,
      z.transform((value) => value.toLowerCase())
    ),
    source: z.optional(z.enum(['MASTER', 'OWNED']))
  })
)

export const authoredCatalogueSearchBackfillInputSchema = lazySchema(() =>
  z.strictObject({
    paginationOpts: z.strictObject({
      cursor: z.nullable(z.string()),
      numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(8)),
      endCursor: z.optional(z.nullable(z.string())),
      id: z.optional(z.number())
    })
  })
)

export const authoredCatalogueSearchBackfillResultSchema = lazySchema(() =>
  z.strictObject({
    processed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(8)),
    continueCursor: z.string(),
    isDone: z.boolean()
  })
)

export const authoredCatalogueItemSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    publicId: z.string(),
    systemId: postgresUuidSchema,
    label: z.string(),
    description: z.nullable(z.string()),
    category: z.optional(z.string()),
    parentClassId: z.optional(z.nullable(postgresUuidSchema)),
    parentClassLabel: z.optional(z.nullable(z.string())),
    parentRaceId: z.optional(z.nullable(postgresUuidSchema)),
    parentRaceLabel: z.optional(z.nullable(z.string())),
    selectionMode: authoredCatalogueMetadataSchema.shape.selectionMode,
    classIds: z.optional(z.array(postgresUuidSchema)),
    classLabels: z.optional(z.array(z.string())),
    level: z.optional(z.number().check(z.int()).check(z.gte(0)).check(z.lte(9))),
    magicSchoolId: z.optional(z.string().check(z.minLength(1))),
    magicSchoolLabel: z.optional(z.string().check(z.minLength(1))),
    castingTimeUnit: z.optional(castingTimeDtoSchema.shape.unit),
    castingTimeAmount: z.optional(castingTimeDtoSchema.shape.amount),
    provenance: authoredContentProvenanceDtoSchema,
    permissions: authoredContentPermissionsDtoSchema
  })
)

// The Campaign and Character option readers still page Convex reads and carry the revision.
export const authoredCatalogueOptionSchema = lazySchema(() =>
  z.extend(authoredCatalogueItemSchema, {
    activeUpdatedAt: z.iso.datetime(),
    status: z.literal('ACTIVE')
  })
)

export const authoredCataloguePageSchema = lazySchema(() =>
  z.strictObject({
    page: z.array(authoredCatalogueOptionSchema),
    isDone: z.boolean(),
    continueCursor: z.string(),
    splitCursor: z.optional(z.nullable(z.string())),
    pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
  })
)

export const authoredCatalogueCountsSchema = lazySchema(() =>
  z.strictObject({
    activeCount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.nonnegative()),
    masterCount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.nonnegative()),
    ownedCount: z
      .number()
      .check(z.int())
      .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
      .check(z.nonnegative())
  })
)

const authoredCatalogueSpellFacetSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.minLength(1)),
    label: z.string().check(z.minLength(1))
  })
)

export const authoredCatalogueSummarySchema = lazySchema(() =>
  z.extend(authoredCatalogueCountsSchema, {
    // Facets cover every visible row, independently of the selected filters.
    categories: z.array(z.string()),
    spellFacets: z.optional(
      z.strictObject({
        classes: z.array(authoredCatalogueSpellFacetSchema),
        schools: z.array(authoredCatalogueSpellFacetSchema),
        levels: z.array(
          z.strictObject({ id: z.number().check(z.int()).check(z.gte(0)).check(z.lte(9)) })
        )
      })
    )
  })
)

export const authoredCatalogueOwnerCountsSchema = lazySchema(() =>
  z
    .strictObject({
      subjectKind: authoredSubjectKindSchema,
      ownerUserId: z.optional(z.string().check(z.minLength(1))),
      count: z
        .number()
        .check(z.int())
        .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
        .check(z.positive()),
      categories: z.array(
        z.strictObject({
          category: z.string().check(z.minLength(1)),
          count: z
            .number()
            .check(z.int())
            .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
            .check(z.positive())
        })
      )
    })
    .check(
      z.refine(
        ({ count, categories }) =>
          categories.reduce((total, entry) => total + entry.count, 0) <= count &&
          categories.every(
            (entry, index) => index === 0 || categories[index - 1]!.category < entry.category
          ),
        'Catalogue owner count integrity mismatch.'
      )
    )
)

export const authoredCatalogueSourceCountsSchema = lazySchema(() =>
  z
    .array(
      z.strictObject({
        subjectKind: authoredSubjectKindSchema,
        count: z
          .number()
          .check(z.int())
          .check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
          .check(z.nonnegative())
      })
    )
    .check(z.maxLength(8))
)

export type AuthoredCatalogueMetadata = z.infer<typeof authoredCatalogueMetadataSchema>
export type AuthoredCatalogueSearchBackfillInput = z.infer<
  typeof authoredCatalogueSearchBackfillInputSchema
>
export type AuthoredCatalogueSearchBackfillResult = z.infer<
  typeof authoredCatalogueSearchBackfillResultSchema
>
export type AuthoredCatalogueScope = z.infer<typeof authoredCatalogueScopeSchema>
export type AuthoredCatalogueItem = z.infer<typeof authoredCatalogueItemSchema>
export type AuthoredCataloguePage = z.infer<typeof authoredCataloguePageSchema>
export type AuthoredCatalogueCounts = z.infer<typeof authoredCatalogueCountsSchema>
export type AuthoredCatalogueSummary = z.infer<typeof authoredCatalogueSummarySchema>
export type AuthoredCatalogueOwnerCounts = z.infer<typeof authoredCatalogueOwnerCountsSchema>
