import { z } from 'zod'

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
import { unknownObjectSchema } from '../shared/facet.js'

export const authoredSubjectKindDtoSchema = z.enum([
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
])

export const authoredDraftStateDtoSchema = z.enum([
  'DRAFT_ONLY',
  'ACTIVE_WITH_DRAFT'
])

export const authoredDraftSummaryDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string(),
  publicId: z.string(),
  userId: z.string(),
  systemId: z.string(),
  label: z.string(),
  description: z.string().nullable().optional(),
  status: z.literal('DRAFT'),
  category: z.string().optional(),
  level: z.number().int().optional(),
  magicSchoolId: z.string().nullable().optional(),
  castingTimeUnit: z.string().optional(),
  castingTimeAmount: z.number().int().optional(),
  draftState: authoredDraftStateDtoSchema,
  revisionId: z.string(),
  revisionNumber: z.number().int().positive(),
  activeRevisionId: z.string().nullable(),
  baseActiveRevisionId: z.string().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
})

export const authoredDraftDtoSchema = authoredDraftSummaryDtoSchema.extend({
  payload: unknownObjectSchema
})

export const authoredDetailViewDtoSchema = z.enum(['active', 'draft'])

export const authoredValidationIssueDtoSchema = z.object({
  code: z.string(),
  message: z.string(),
  path: z.array(z.union([z.string(), z.number()]))
})

export const authoredDetailRequestDtoSchema = z.object({
  id: z.string().min(1),
  view: authoredDetailViewDtoSchema.optional(),
  meta: z.array(z.string().min(1)).optional()
})

export const authoredDraftSaveRequestDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string(),
  systemId: z.string(),
  label: z.string(),
  payload: unknownObjectSchema
})

export const authoredDraftActivateRequestDtoSchema = z.object({
  subjectKind: authoredSubjectKindDtoSchema,
  subjectId: z.string()
})

const authoredContentListItemBaseDtoSchema = z.object({
  id: z.string(),
  publicId: z.string(),
  activeRevisionId: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema,
  description: z.string().nullable()
    .optional(),
  draft: authoredDraftSummaryDtoSchema.nullable().optional(),
  provenance: authoredContentProvenanceDtoSchema,
  permissions: authoredContentPermissionsDtoSchema
}).merge(ownerContextDtoSchema)

export const backgroundListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const classListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional(),
  parentClassId: z.string().nullable()
    .optional()
})
export const equipmentListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const featListItemDtoSchema = authoredContentListItemBaseDtoSchema
export const raceListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional(),
  parentRaceId: z.string().nullable()
    .optional(),
  selectionMode: z.string().nullable()
    .optional()
})
export const spellListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  level: z.number().int()
    .optional(),
  magicSchoolId: z.string().nullable()
    .optional(),
  castingTimeUnit: z.string().optional(),
  castingTimeAmount: z.number().int()
    .optional()
})
export const creatureListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})
export const vehicleListItemDtoSchema = authoredContentListItemBaseDtoSchema.extend({
  category: z.string().optional()
})

function authoredContentListResponseDtoSchema<TSchema extends z.ZodTypeAny>(itemSchema: TSchema) {
  return listResponseDtoSchema(itemSchema).extend({
    drafts: z.array(authoredDraftSummaryDtoSchema)
  })
}

export const backgroundListResponseDtoSchema = authoredContentListResponseDtoSchema(backgroundListItemDtoSchema)
export const classListResponseDtoSchema = authoredContentListResponseDtoSchema(classListItemDtoSchema)
export const equipmentListResponseDtoSchema = authoredContentListResponseDtoSchema(equipmentListItemDtoSchema)
export const featListResponseDtoSchema = authoredContentListResponseDtoSchema(featListItemDtoSchema)
export const raceListResponseDtoSchema = authoredContentListResponseDtoSchema(raceListItemDtoSchema)
export const spellListResponseDtoSchema = authoredContentListResponseDtoSchema(spellListItemDtoSchema)
export const creatureListResponseDtoSchema = authoredContentListResponseDtoSchema(creatureListItemDtoSchema)
export const vehicleListResponseDtoSchema = authoredContentListResponseDtoSchema(vehicleListItemDtoSchema)

const detailReferenceOptionDtoSchema = z.object({
  value: z.string(),
  label: z.string()
})

const detailResponseExtrasDtoSchema = <TSchema extends z.ZodTypeAny>(metaSchema: TSchema) => z.object({
  activeRevisionId: z.string().nullable(),
  hasDraft: z.boolean(),
  draft: authoredDraftDtoSchema.nullable().optional(),
  meta: metaSchema.optional(),
  validationIssues: z.array(authoredValidationIssueDtoSchema).optional()
})

type AuthoredDetailResponseDtoSchema<
  TItemSchema extends z.ZodTypeAny,
  TMetaSchema extends z.ZodTypeAny
> = z.ZodNullable<z.ZodObject<{
  item: z.ZodNullable<TItemSchema>
  publicId: z.ZodString
  activeRevisionId: z.ZodNullable<z.ZodString>
  hasDraft: z.ZodBoolean
  provenance: typeof authoredContentProvenanceDtoSchema
  permissions: typeof authoredContentPermissionsDtoSchema
  draft: z.ZodOptional<z.ZodNullable<typeof authoredDraftDtoSchema>>
  meta: z.ZodOptional<TMetaSchema>
  validationIssues: z.ZodOptional<z.ZodArray<typeof authoredValidationIssueDtoSchema>>
}>>

export const emptyDetailMetaDtoSchema = z.object({})

export const backgroundDetailMetaDtoSchema = z.object({
  currencies: z.array(detailReferenceOptionDtoSchema).optional(),
  equipment: z.array(detailReferenceOptionDtoSchema).optional(),
  languages: z.array(detailReferenceOptionDtoSchema).optional(),
  skills: z.array(detailReferenceOptionDtoSchema).optional()
})

export const classDetailMetaDtoSchema = z.object({
  classes: z.array(detailReferenceOptionDtoSchema).optional(),
  currencies: z.array(detailReferenceOptionDtoSchema).optional(),
  equipment: z.array(detailReferenceOptionDtoSchema).optional(),
  languages: z.array(detailReferenceOptionDtoSchema).optional(),
  skills: z.array(detailReferenceOptionDtoSchema).optional()
})

export const equipmentDetailMetaDtoSchema = z.object({
  equipment: z.array(detailReferenceOptionDtoSchema).optional(),
  rarities: z.array(detailReferenceOptionDtoSchema).optional()
})

export const raceDetailMetaDtoSchema = z.object({
  heritages: z.array(detailReferenceOptionDtoSchema).optional(),
  races: z.array(detailReferenceOptionDtoSchema).optional(),
  speeds: z.array(detailReferenceOptionDtoSchema).optional()
})

export const spellDetailMetaDtoSchema = z.object({
  classes: z.array(detailReferenceOptionDtoSchema).optional(),
  conditionTypes: z.array(detailReferenceOptionDtoSchema).optional(),
  damageTypes: z.array(detailReferenceOptionDtoSchema).optional(),
  magicSchools: z.array(detailReferenceOptionDtoSchema).optional()
})

export const creatureDetailMetaDtoSchema = z.object({
  challengeRatings: z.array(detailReferenceOptionDtoSchema).optional(),
  conditionTypes: z.array(detailReferenceOptionDtoSchema).optional(),
  creatureTypes: z.array(detailReferenceOptionDtoSchema).optional(),
  damageTypes: z.array(detailReferenceOptionDtoSchema).optional(),
  speeds: z.array(detailReferenceOptionDtoSchema).optional()
})

export const vehicleDetailMetaDtoSchema = z.object({
  currencies: z.array(detailReferenceOptionDtoSchema).optional()
})

export const backgroundResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof backgroundAuthoredDtoSchema, typeof backgroundDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(backgroundAuthoredDtoSchema, detailResponseExtrasDtoSchema(backgroundDetailMetaDtoSchema))
export const classResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof classAuthoredDtoSchema, typeof classDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(classAuthoredDtoSchema, detailResponseExtrasDtoSchema(classDetailMetaDtoSchema))
export const equipmentResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof equipmentAuthoredDtoSchema, typeof equipmentDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(equipmentAuthoredDtoSchema, detailResponseExtrasDtoSchema(equipmentDetailMetaDtoSchema))
export const featResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof featAuthoredDtoSchema, typeof emptyDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(featAuthoredDtoSchema, detailResponseExtrasDtoSchema(emptyDetailMetaDtoSchema))
export const raceResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof raceAuthoredDtoSchema, typeof raceDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(raceAuthoredDtoSchema, detailResponseExtrasDtoSchema(raceDetailMetaDtoSchema))
export const spellResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof spellAuthoredDtoSchema, typeof spellDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(spellAuthoredDtoSchema, detailResponseExtrasDtoSchema(spellDetailMetaDtoSchema))
export const creatureResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof creatureAuthoredDtoSchema, typeof creatureDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(creatureAuthoredDtoSchema, detailResponseExtrasDtoSchema(creatureDetailMetaDtoSchema))
export const vehicleResponseDtoSchema: AuthoredDetailResponseDtoSchema<typeof vehicleAuthoredDtoSchema, typeof vehicleDetailMetaDtoSchema> = authoredResourceResponseDtoSchema(vehicleAuthoredDtoSchema, detailResponseExtrasDtoSchema(vehicleDetailMetaDtoSchema))

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
    path: issue.path.map((segment) => typeof segment === 'symbol' ? String(segment) : segment)
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
