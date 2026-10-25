import { z, lazySchema } from '../zod.js'

import {
  backgroundAuthoredDtoSchema,
  classAuthoredDtoSchema,
  creatureAuthoredDtoSchema,
  equipmentAuthoredDtoSchema,
  featAuthoredDtoSchema,
  raceAuthoredDtoSchema,
  spellAuthoredDtoSchema,
  vehicleAuthoredDtoSchema
} from '../subjects/index.js'
import {
  authoredContentPermissionsDtoSchema,
  authoredContentProvenanceDtoSchema,
  authoredResourceResponseDtoSchema,
  listResponseDtoSchema,
  ownerContextDtoSchema
} from './common.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'
import { unknownObjectSchema } from '../shared/authoredLimits.js'
import {
  authoredDraftStateDtoSchema,
  authoredDraftSummaryDtoSchema,
  authoredDraftDtoSchema,
  authoredDraftSaveRequestDtoSchema
} from './authoredDrafts.js'
export {
  authoredDraftStateDtoSchema,
  authoredDraftSummaryDtoSchema,
  authoredDraftDtoSchema,
  authoredDraftSaveRequestDtoSchema
}

export const authoredSubjectKindDtoSchema = lazySchema(() =>
  z.enum(['BACKGROUND', 'CLASS', 'CREATURE', 'EQUIPMENT', 'FEAT', 'RACE', 'SPELL', 'VEHICLE'])
)

const authoredCatalogCursorValueDtoSchema = lazySchema(() =>
  z.union([
    z.string().check(z.minLength(1)).check(z.maxLength(256)),
    z.number().check(z.int()).check(z.gte(Number.MIN_SAFE_INTEGER), z.lte(Number.MAX_SAFE_INTEGER))
  ])
)

export const authoredCatalogCursorDtoSchema = lazySchema(() =>
  z.object({
    id: z.string().check(z.minLength(1)),
    values: z.array(authoredCatalogCursorValueDtoSchema).check(z.minLength(1)).check(z.maxLength(4))
  })
)

const authoredCatalogPageInputBaseDtoSchema = lazySchema(() =>
  z.object({
    cursor: z.optional(authoredCatalogCursorDtoSchema),
    direction: z._default(z.enum(['FORWARD', 'BACKWARD']), 'FORWARD'),
    limit: z._default(z.number().check(z.int()).check(z.gte(1)).check(z.lte(48)), 48),
    query: z.optional(z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(160)))
  })
)

const authoredCatalogSourceFilterDtoSchema = lazySchema(() => z.enum(['MASTER', 'OWNED']))

export const backgroundListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    sort: z._default(z.literal('name'), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const classListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    category: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(64))),
    sort: z._default(z.enum(['name', 'category']), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const creatureListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    category: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(64))),
    sort: z._default(z.enum(['name', 'category']), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const equipmentListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    category: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(64))),
    sort: z._default(z.enum(['name', 'category']), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const featListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    sort: z._default(z.literal('name'), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const raceListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    category: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(64))),
    sort: z._default(z.enum(['name', 'category']), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const spellListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    classId: z.optional(z.string().check(z.minLength(1))),
    level: z.optional(z.number().check(z.int()).check(z.gte(0)).check(z.lte(9))),
    magicSchoolId: z.optional(z.string().check(z.minLength(1))),
    sort: z._default(z.enum(['name', 'level', 'school']), 'name')
  })
)

export const vehicleListRequestDtoSchema = lazySchema(() =>
  z.extend(authoredCatalogPageInputBaseDtoSchema, {
    category: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(64))),
    sort: z._default(z.enum(['name', 'category']), 'name'),
    source: z.optional(authoredCatalogSourceFilterDtoSchema)
  })
)

export const authoredDetailViewDtoSchema = lazySchema(() => z.enum(['active', 'draft']))

export const authoredValidationIssueDtoSchema = lazySchema(() =>
  z.object({
    code: z.string(),
    message: z.string(),
    path: z.array(z.union([z.string(), z.number()]))
  })
)

export const authoredDetailRequestDtoSchema = lazySchema(() =>
  z.object({
    id: z.string().check(z.minLength(1)),
    view: z.optional(authoredDetailViewDtoSchema),
    meta: z.optional(z.array(z.string().check(z.minLength(1))))
  })
)

export const authoredDraftActivateRequestDtoSchema = lazySchema(() =>
  z.object({
    subjectKind: authoredSubjectKindDtoSchema,
    subjectId: z.string()
  })
)

const authoredContentListItemBaseDtoSchema = lazySchema(() =>
  z.extend(
    z.object({
      id: z.string(),
      publicId: z.string(),
      activeUpdatedAt: z.string(),
      label: z.string(),
      status: authoredRecordStatusSchema,
      description: z.optional(z.nullable(z.string())),
      draft: z.optional(z.nullable(authoredDraftSummaryDtoSchema)),
      provenance: authoredContentProvenanceDtoSchema,
      permissions: authoredContentPermissionsDtoSchema
    }),
    ownerContextDtoSchema.shape
  )
)

export const backgroundListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const classListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    category: z.optional(z.string()),
    parentClassId: z.optional(z.nullable(z.string())),
    parentClassLabel: z.optional(z.nullable(z.string()))
  })
)
export const equipmentListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    category: z.optional(z.string())
  })
)
export const featListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const raceListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    category: z.optional(z.string()),
    parentRaceId: z.optional(z.nullable(z.string())),
    parentRaceLabel: z.optional(z.nullable(z.string())),
    selectionMode: z.optional(z.nullable(z.string()))
  })
)
export const spellListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    classIds: z.optional(z.array(z.string())),
    classLabels: z.optional(z.array(z.string())),
    level: z.optional(z.number().check(z.int())),
    magicSchoolId: z.optional(z.nullable(z.string())),
    magicSchoolLabel: z.optional(z.nullable(z.string())),
    castingTimeUnit: z.optional(z.string()),
    castingTimeAmount: z.optional(z.number().check(z.int()))
  })
)
export const creatureListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    category: z.optional(z.string())
  })
)
export const vehicleListItemDtoSchema = lazySchema(() =>
  z.extend(authoredContentListItemBaseDtoSchema, {
    category: z.optional(z.string())
  })
)

const authoredCatalogSummaryDtoSchema = lazySchema(() =>
  z.object({
    activeCount: z.number().check(z.int()).check(z.nonnegative()),
    masterCount: z.number().check(z.int()).check(z.nonnegative()),
    ownedCount: z.number().check(z.int()).check(z.nonnegative())
  })
)

const authoredCatalogPageDtoSchema = lazySchema(() =>
  z.object({
    nextCursor: z.nullable(authoredCatalogCursorDtoSchema),
    previousCursor: z.nullable(authoredCatalogCursorDtoSchema),
    totalCount: z.number().check(z.int()).check(z.nonnegative())
  })
)

function authoredContentListResponseDtoSchema<TSchema extends z.ZodMiniType>(itemSchema: TSchema) {
  return z.extend(listResponseDtoSchema(itemSchema), {
    drafts: z.array(authoredDraftSummaryDtoSchema),
    page: authoredCatalogPageDtoSchema,
    summary: authoredCatalogSummaryDtoSchema
  })
}

export const backgroundListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(backgroundListItemDtoSchema)
)
export const classListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(classListItemDtoSchema)
)
export const equipmentListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(equipmentListItemDtoSchema)
)
export const featListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(featListItemDtoSchema)
)
export const raceListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(raceListItemDtoSchema)
)
export const spellListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(spellListItemDtoSchema)
)
export const creatureListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(creatureListItemDtoSchema)
)
export const vehicleListResponseDtoSchema = lazySchema(() =>
  authoredContentListResponseDtoSchema(vehicleListItemDtoSchema)
)

const detailReferenceOptionDtoSchema = lazySchema(() =>
  z.object({
    value: z.string(),
    label: z.string()
  })
)

const detailResponseExtrasDtoSchema = <TSchema extends z.ZodMiniType>(metaSchema: TSchema) =>
  z.object({
    activeUpdatedAt: z.nullable(z.string()),
    hasDraft: z.boolean(),
    draft: z.optional(z.nullable(authoredDraftDtoSchema)),
    meta: z.optional(metaSchema),
    validationIssues: z.optional(z.array(authoredValidationIssueDtoSchema))
  })

type AuthoredDetailResponseDtoSchema<
  TItemSchema extends z.ZodMiniType,
  TMetaSchema extends z.ZodMiniType,
  TExtraShape extends z.core.$ZodShape = Record<never, never>
> = z.ZodMiniNullable<
  z.ZodMiniObject<
    {
      item: z.ZodMiniNullable<TItemSchema>
      publicId: z.ZodMiniString
      activeUpdatedAt: z.ZodMiniNullable<z.ZodMiniString>
      hasDraft: z.ZodMiniBoolean
      provenance: typeof authoredContentProvenanceDtoSchema
      permissions: typeof authoredContentPermissionsDtoSchema
      draft: z.ZodMiniOptional<z.ZodMiniNullable<typeof authoredDraftDtoSchema>>
      meta: z.ZodMiniOptional<TMetaSchema>
      validationIssues: z.ZodMiniOptional<z.ZodMiniArray<typeof authoredValidationIssueDtoSchema>>
    } & TExtraShape
  >
>

export const emptyDetailMetaDtoSchema = lazySchema(() => z.object({}))

export const backgroundDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    currencies: z.optional(z.array(detailReferenceOptionDtoSchema)),
    equipment: z.optional(z.array(detailReferenceOptionDtoSchema)),
    languages: z.optional(z.array(detailReferenceOptionDtoSchema)),
    skills: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const classDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    classes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    currencies: z.optional(z.array(detailReferenceOptionDtoSchema)),
    equipment: z.optional(z.array(detailReferenceOptionDtoSchema)),
    languages: z.optional(z.array(detailReferenceOptionDtoSchema)),
    skills: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const equipmentDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    classes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    currencies: z.optional(z.array(detailReferenceOptionDtoSchema)),
    equipment: z.optional(z.array(detailReferenceOptionDtoSchema)),
    heritages: z.optional(z.array(detailReferenceOptionDtoSchema)),
    rarities: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const raceDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    heritages: z.optional(z.array(detailReferenceOptionDtoSchema)),
    races: z.optional(z.array(detailReferenceOptionDtoSchema)),
    speeds: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const spellDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    classes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    conditionTypes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    damageTypes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    magicSchools: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const creatureDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    /** Every System ability in System order, with the abbreviation the stat block shows. */
    abilities: z.optional(z.array(z.extend(detailReferenceOptionDtoSchema, { short: z.string() }))),
    challengeRatings: z.optional(z.array(detailReferenceOptionDtoSchema)),
    conditionTypes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    creatureTypes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    damageTypes: z.optional(z.array(detailReferenceOptionDtoSchema)),
    equipment: z.optional(z.array(detailReferenceOptionDtoSchema)),
    speeds: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const vehicleDetailMetaDtoSchema = lazySchema(() =>
  z.object({
    currencies: z.optional(z.array(detailReferenceOptionDtoSchema))
  })
)

export const backgroundResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof backgroundAuthoredDtoSchema,
  typeof backgroundDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    backgroundAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(backgroundDetailMetaDtoSchema)
  )
)
export const classResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof classAuthoredDtoSchema,
  typeof classDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    classAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(classDetailMetaDtoSchema)
  )
)
export const equipmentResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof equipmentAuthoredDtoSchema,
  typeof equipmentDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    equipmentAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(equipmentDetailMetaDtoSchema)
  )
)
export const featResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof featAuthoredDtoSchema,
  typeof emptyDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    featAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(emptyDetailMetaDtoSchema)
  )
)
export const raceResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof raceAuthoredDtoSchema,
  typeof raceDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    raceAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(raceDetailMetaDtoSchema)
  )
)
export const spellResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof spellAuthoredDtoSchema,
  typeof spellDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    spellAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(spellDetailMetaDtoSchema)
  )
)
/** A Creature's armor class is computed from its loadout Equipment; null while an item is unreadable. */
const creatureComputedArmorClassDtoSchema = lazySchema(() =>
  z.optional(z.nullable(z.number().check(z.int())))
)

export const creatureResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof creatureAuthoredDtoSchema,
  typeof creatureDetailMetaDtoSchema,
  { armorClass: typeof creatureComputedArmorClassDtoSchema }
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    creatureAuthoredDtoSchema,
    z.extend(detailResponseExtrasDtoSchema(creatureDetailMetaDtoSchema), {
      armorClass: creatureComputedArmorClassDtoSchema
    })
  )
)
export const vehicleResponseDtoSchema: AuthoredDetailResponseDtoSchema<
  typeof vehicleAuthoredDtoSchema,
  typeof vehicleDetailMetaDtoSchema
> = lazySchema(() =>
  authoredResourceResponseDtoSchema(
    vehicleAuthoredDtoSchema,
    detailResponseExtrasDtoSchema(vehicleDetailMetaDtoSchema)
  )
)

/** Native authored reads share the existing domain detail contracts. */
export const authoredDetailReadInputSchema = lazySchema(() =>
  z.strictObject(
    z.extend(authoredDetailRequestDtoSchema, {
      subjectKind: authoredSubjectKindDtoSchema,
      id: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(64)),
      meta: z.optional(
        z.array(z.string().check(z.minLength(1)).check(z.maxLength(64))).check(z.maxLength(16))
      )
    }).shape
  )
)

export const authoredDetailResponseSchemas: {
  BACKGROUND: typeof backgroundResponseDtoSchema
  CLASS: typeof classResponseDtoSchema
  CREATURE: typeof creatureResponseDtoSchema
  EQUIPMENT: typeof equipmentResponseDtoSchema
  FEAT: typeof featResponseDtoSchema
  RACE: typeof raceResponseDtoSchema
  SPELL: typeof spellResponseDtoSchema
  VEHICLE: typeof vehicleResponseDtoSchema
} = {
  BACKGROUND: backgroundResponseDtoSchema,
  CLASS: classResponseDtoSchema,
  CREATURE: creatureResponseDtoSchema,
  EQUIPMENT: equipmentResponseDtoSchema,
  FEAT: featResponseDtoSchema,
  RACE: raceResponseDtoSchema,
  SPELL: spellResponseDtoSchema,
  VEHICLE: vehicleResponseDtoSchema
}

// Convex cannot translate all authored Zod arms (for example forbidden/undefined
// fields). Validate the JSON envelope there, then parse the exact domain response
// in the handler before returning it; this does not replace domain validation.
export const authoredDetailReadEnvelopeSchema = lazySchema(() =>
  z.nullable(
    z.extend(z.omit(backgroundResponseDtoSchema._zod.def.innerType, { item: true, meta: true }), {
      item: z.nullable(unknownObjectSchema),
      armorClass: creatureComputedArmorClassDtoSchema,
      meta: z.optional(z.record(z.string(), z.array(detailReferenceOptionDtoSchema)))
    })
  )
)

export type AuthoredDetailReadInput = z.infer<typeof authoredDetailReadInputSchema>
export type AuthoredDetailReadResult = z.infer<
  (typeof authoredDetailResponseSchemas)[keyof typeof authoredDetailResponseSchemas]
>

// Named TypeScript types for list item DTOs
export type BackgroundListItemDto = z.infer<typeof backgroundListItemDtoSchema>
export type ClassListItemDto = z.infer<typeof classListItemDtoSchema>
export type EquipmentListItemDto = z.infer<typeof equipmentListItemDtoSchema>
export type FeatListItemDto = z.infer<typeof featListItemDtoSchema>
export type RaceListItemDto = z.infer<typeof raceListItemDtoSchema>
export type SpellListItemDto = z.infer<typeof spellListItemDtoSchema>
export type CreatureListItemDto = z.infer<typeof creatureListItemDtoSchema>
export type VehicleListItemDto = z.infer<typeof vehicleListItemDtoSchema>
export type AuthoredSubjectKindDto = z.infer<typeof authoredSubjectKindDtoSchema>
export type AuthoredCatalogCursorDto = z.infer<typeof authoredCatalogCursorDtoSchema>
export type BackgroundListRequestDto = z.infer<typeof backgroundListRequestDtoSchema>
export type ClassListRequestDto = z.infer<typeof classListRequestDtoSchema>
export type CreatureListRequestDto = z.infer<typeof creatureListRequestDtoSchema>
export type EquipmentListRequestDto = z.infer<typeof equipmentListRequestDtoSchema>
export type FeatListRequestDto = z.infer<typeof featListRequestDtoSchema>
export type RaceListRequestDto = z.infer<typeof raceListRequestDtoSchema>
export type SpellListRequestDto = z.infer<typeof spellListRequestDtoSchema>
export type VehicleListRequestDto = z.infer<typeof vehicleListRequestDtoSchema>
export type AuthoredDraftStateDto = z.infer<typeof authoredDraftStateDtoSchema>
export type AuthoredDraftSummaryDto = z.infer<typeof authoredDraftSummaryDtoSchema>
export type AuthoredDraftDto = z.infer<typeof authoredDraftDtoSchema>
export type AuthoredDraftSaveRequestDto = z.infer<typeof authoredDraftSaveRequestDtoSchema>
export type AuthoredDraftActivateRequestDto = z.infer<typeof authoredDraftActivateRequestDtoSchema>
export type AuthoredDetailViewDto = z.infer<typeof authoredDetailViewDtoSchema>
export type AuthoredDetailRequestDto = z.infer<typeof authoredDetailRequestDtoSchema>
export type AuthoredValidationIssueDto = z.infer<typeof authoredValidationIssueDtoSchema>

export function toAuthoredValidationIssues(
  issues: ReadonlyArray<{
    code: string
    message: string
    path: readonly PropertyKey[]
  }>
): AuthoredValidationIssueDto[] {
  return issues.map((issue) => ({
    code: issue.code,
    message: issue.message,
    path: issue.path.map((segment) => (typeof segment === 'symbol' ? String(segment) : segment))
  }))
}

export type BackgroundDetailMetaDto = z.infer<typeof backgroundDetailMetaDtoSchema>
export type ClassDetailMetaDto = z.infer<typeof classDetailMetaDtoSchema>
export type EquipmentDetailMetaDto = z.infer<typeof equipmentDetailMetaDtoSchema>
export type RaceDetailMetaDto = z.infer<typeof raceDetailMetaDtoSchema>
export type SpellDetailMetaDto = z.infer<typeof spellDetailMetaDtoSchema>
export type CreatureDetailMetaDto = z.infer<typeof creatureDetailMetaDtoSchema>
export type VehicleDetailMetaDto = z.infer<typeof vehicleDetailMetaDtoSchema>

// Named TypeScript types for response DTOs
export type BackgroundListResponseDto = z.infer<typeof backgroundListResponseDtoSchema>
export type ClassListResponseDto = z.infer<typeof classListResponseDtoSchema>
export type EquipmentListResponseDto = z.infer<typeof equipmentListResponseDtoSchema>
export type FeatListResponseDto = z.infer<typeof featListResponseDtoSchema>
export type RaceListResponseDto = z.infer<typeof raceListResponseDtoSchema>
export type SpellListResponseDto = z.infer<typeof spellListResponseDtoSchema>
export type CreatureListResponseDto = z.infer<typeof creatureListResponseDtoSchema>
export type VehicleListResponseDto = z.infer<typeof vehicleListResponseDtoSchema>

export type BackgroundResponseDto = z.infer<typeof backgroundResponseDtoSchema>
export type ClassResponseDto = z.infer<typeof classResponseDtoSchema>
export type EquipmentResponseDto = z.infer<typeof equipmentResponseDtoSchema>
export type FeatResponseDto = z.infer<typeof featResponseDtoSchema>
export type RaceResponseDto = z.infer<typeof raceResponseDtoSchema>
export type SpellResponseDto = z.infer<typeof spellResponseDtoSchema>
export type CreatureResponseDto = z.infer<typeof creatureResponseDtoSchema>
export type VehicleResponseDto = z.infer<typeof vehicleResponseDtoSchema>
