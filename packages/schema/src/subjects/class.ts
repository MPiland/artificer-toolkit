import { z, lazySchema } from '../zod.js'

import {
  classHitpointDtoSchema,
  classMulticlassDtoSchema,
  classPrepareLimitDtoSchema,
  classResourceDtoSchema,
  classSpellLimitDtoSchema,
  classStartingGoldDtoSchema,
  classSpecializationDtoSchema
} from './shared.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { chargeDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import {
  authoredRecordStatusSchema,
  classAttributeSchema,
  spellcastingAttributeSchema,
  subclassAttributeSchema
} from '../shared/enums.js'
import { featureDtoSchema } from '../features/feature.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const classBaseDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    label: authoredShortTextSchema,
    description: z.optional(authoredRichTextSchema),
    status: z.optional(authoredRecordStatusSchema),
    details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
    proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
    spellcasting: z.optional(
      z.object({
        spellLimits: authoredNestedCollectionSchema(classSpellLimitDtoSchema),
        availableAtLevel: z.optional(z.number().check(z.int())),
        order: z.optional(z.number().check(z.int())),
        details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
        magicName: z.optional(authoredShortTextSchema),
        availableSpellIds: z.optional(authoredReferenceCollectionSchema(authoredIdentifierSchema)),
        ability: z.optional(systemCoreCodeSchema),
        maxSpellLevel: z.number().check(z.int()),
        attributes: z.optional(authoredReferenceCollectionSchema(spellcastingAttributeSchema)),
        charges: chargeDtoSchema,
        prepareLimit: z.optional(classPrepareLimitDtoSchema)
      })
    ),
    resources: z.optional(classResourceDtoSchema),
    features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
    userId: authoredIdentifierSchema,
    systemId: authoredIdentifierSchema
  })
)

const parentClassAuthoredDtoSchemaRaw = lazySchema(() =>
  z.extend(classBaseDtoSchema, {
    category: z.literal('BASE'),
    attributes: z.optional(authoredReferenceCollectionSchema(classAttributeSchema)),
    subclassSelectionLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))),
    startingGold: classStartingGoldDtoSchema,
    startingEquipment: startingEquipmentDtoSchema,
    hitpoint: classHitpointDtoSchema,
    multiclass: classMulticlassDtoSchema
  })
)

const subclassAuthoredDtoSchemaRaw = lazySchema(() =>
  z.extend(classBaseDtoSchema, {
    category: z.literal('SUBCLASS'),
    attributes: z.optional(authoredReferenceCollectionSchema(subclassAttributeSchema)),
    subclassSelectionLevel: z.optional(z.never()),
    parentClassId: authoredIdentifierSchema,
    specializations: z.optional(authoredNestedCollectionSchema(classSpecializationDtoSchema))
  })
)

const classAuthoredDtoSchemaRaw = lazySchema(() =>
  z.union([parentClassAuthoredDtoSchemaRaw, subclassAuthoredDtoSchemaRaw])
)

const classAuthoringInputDtoSchemaCommon = lazySchema(() =>
  z.extend(classBaseDtoSchema, {
    userId: z.optional(authoredIdentifierSchema),
    startingGold: z.optional(classStartingGoldDtoSchema),
    startingEquipment: z.optional(startingEquipmentDtoSchema),
    hitpoint: z.optional(classHitpointDtoSchema),
    multiclass: z.optional(classMulticlassDtoSchema),
    parentClassId: z.optional(authoredIdentifierSchema),
    specializations: z.optional(authoredNestedCollectionSchema(classSpecializationDtoSchema))
  })
)

export type ClassAuthoringInputDto = Omit<
  ParentClassAuthoredDto,
  | 'category'
  | 'attributes'
  | 'userId'
  | 'subclassSelectionLevel'
  | 'startingGold'
  | 'startingEquipment'
  | 'hitpoint'
  | 'multiclass'
> & {
  userId?: string
  startingGold?: ParentClassAuthoredDto['startingGold']
  startingEquipment?: ParentClassAuthoredDto['startingEquipment']
  hitpoint?: ParentClassAuthoredDto['hitpoint']
  multiclass?: ParentClassAuthoredDto['multiclass']
  parentClassId?: SubclassAuthoredDto['parentClassId']
  specializations?: SubclassAuthoredDto['specializations']
} & (
    | {
        category: 'BASE'
        attributes?: ParentClassAuthoredDto['attributes']
        subclassSelectionLevel?: ParentClassAuthoredDto['subclassSelectionLevel']
      }
    | {
        category: 'SUBCLASS'
        attributes?: SubclassAuthoredDto['attributes']
        subclassSelectionLevel?: never
      }
    | {
        category?: undefined
        attributes?: ParentClassAuthoredDto['attributes']
        subclassSelectionLevel?: ParentClassAuthoredDto['subclassSelectionLevel']
      }
  )

const classAuthoringInputDtoSchemaRaw: z.ZodMiniType<ClassAuthoringInputDto> = lazySchema(() =>
  z.union([
    z.extend(classAuthoringInputDtoSchemaCommon, {
      category: z.literal('BASE'),
      attributes: z.optional(authoredReferenceCollectionSchema(classAttributeSchema)),
      subclassSelectionLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
    }),
    z.extend(classAuthoringInputDtoSchemaCommon, {
      category: z.literal('SUBCLASS'),
      attributes: z.optional(authoredReferenceCollectionSchema(subclassAttributeSchema)),
      subclassSelectionLevel: z.optional(z.never())
    }),
    z.extend(classAuthoringInputDtoSchemaCommon, {
      category: z.optional(z.undefined()),
      attributes: z.optional(authoredReferenceCollectionSchema(classAttributeSchema)),
      subclassSelectionLevel: z.optional(z.number().check(z.int()).check(z.gte(1)).check(z.lte(20)))
    })
  ])
)

export type ParentClassAuthoredDto = z.infer<typeof parentClassAuthoredDtoSchemaRaw>
export type SubclassAuthoredDto = z.infer<typeof subclassAuthoredDtoSchemaRaw>
export type ClassAuthoredDto = ParentClassAuthoredDto | SubclassAuthoredDto
export type ClassSpellcastingDto = NonNullable<ClassAuthoredDto['spellcasting']>
export const parentClassAuthoredDtoSchema: z.ZodMiniType<ParentClassAuthoredDto> =
  parentClassAuthoredDtoSchemaRaw
export const subclassAuthoredDtoSchema: z.ZodMiniType<SubclassAuthoredDto> =
  subclassAuthoredDtoSchemaRaw
export const classAuthoredDtoSchema: z.ZodMiniType<ClassAuthoredDto> = classAuthoredDtoSchemaRaw
export const classAuthoringInputDtoSchema: z.ZodMiniType<ClassAuthoringInputDto> =
  classAuthoringInputDtoSchemaRaw
