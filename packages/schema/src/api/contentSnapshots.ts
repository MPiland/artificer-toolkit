import { z, lazySchema } from '../zod.js'
import { authoredSubjectKindSchema, projectionChecksumSchema } from '../projections/identity.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  sizeCodeSchema
} from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { speedDtoSchema } from '../shared/speed.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { backgroundAuthoredDtoSchema } from '../subjects/background.js'
import { classAuthoredDtoSchema } from '../subjects/class.js'
import { creaturePublicationDtoSchema } from '../subjects/creature.js'
import { equipmentAuthoredDtoSchema } from '../subjects/equipment.js'
import { featAuthoredDtoSchema } from '../subjects/feat.js'
import { baseRaceAuthoredDtoSchema, raceAuthoredDtoSchema } from '../subjects/race.js'
import {
  classHitpointDtoSchema,
  classMulticlassRequirementGroupsDtoSchema
} from '../subjects/shared.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { vehicleAuthoredDtoSchema } from '../subjects/vehicle.js'

// ADR 0036: immutable, content-addressed published content. One object per scope x kind x part.
export const contentSnapshotScopeSchema = lazySchema(() => z.enum(['SYSTEM', 'SOURCE', 'CAMPAIGN']))
export const contentSnapshotKindSchema = authoredSubjectKindSchema
export const contentSnapshotPartSchema = lazySchema(() => z.enum(['index', 'documents']))

const headerShape = () => ({
  format: z.literal(1),
  scope: contentSnapshotScopeSchema,
  scopeId: postgresUuidSchema
})

/** Hashed with the roots, so identical roots in another scope, kind or part get another key. */
export const contentSnapshotHeaderSchema = lazySchema(() =>
  z.strictObject({
    ...headerShape(),
    kind: contentSnapshotKindSchema,
    part: contentSnapshotPartSchema
  })
)

const identityShape = () => ({ id: authoredIdentifierSchema, label: authoredShortTextSchema })

const abilityScoreIncreaseFactSchema = lazySchema(() =>
  z.strictObject({ label: z.string(), value: z.string() })
)

// Index entries hold each root's own picker facts. Labels resolved through the System vocabulary
// or another root (speed names, proficiency targets, a subrace's inherited facts) are joined by
// the reader, because they can change in another scope without this object changing.
export const contentSnapshotRaceIndexEntrySchema = lazySchema(() =>
  z.discriminatedUnion('category', [
    z.strictObject({
      ...identityShape(),
      category: z.literal('BASE'),
      description: z.optional(authoredRichTextSchema),
      selectionMode: baseRaceAuthoredDtoSchema.shape.selectionMode,
      size: sizeCodeSchema,
      speeds: authoredNestedCollectionSchema(speedDtoSchema),
      abilityScoreIncreaseFacts: z.array(abilityScoreIncreaseFactSchema)
    }),
    z.strictObject({
      ...identityShape(),
      category: z.literal('SUBRACE'),
      parentRaceId: authoredIdentifierSchema,
      description: z.optional(authoredRichTextSchema),
      abilityScoreIncreaseFacts: z.array(abilityScoreIncreaseFactSchema)
    })
  ])
)

export const contentSnapshotClassIndexEntrySchema = lazySchema(() =>
  z.discriminatedUnion('category', [
    z.strictObject({
      ...identityShape(),
      category: z.literal('BASE'),
      description: z.optional(authoredRichTextSchema),
      subclassSelectionLevel: z.optional(
        z.number().check(z.int()).check(z.gte(1)).check(z.lte(20))
      ),
      hitpoint: classHitpointDtoSchema,
      requirementGroups: classMulticlassRequirementGroupsDtoSchema,
      proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema))
    }),
    z.strictObject({
      ...identityShape(),
      category: z.literal('SUBCLASS'),
      parentClassId: authoredIdentifierSchema,
      description: z.optional(authoredRichTextSchema),
      proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema))
    })
  ])
)

export const contentSnapshotBackgroundIndexEntrySchema = lazySchema(() =>
  z.strictObject({
    ...identityShape(),
    description: z.optional(authoredRichTextSchema),
    proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
    featureLabels: z.array(authoredShortTextSchema)
  })
)

/** Effective facts after variant resolution, as stored in the root's Equipment option projection. */
export const contentSnapshotEquipmentIndexEntrySchema = lazySchema(() =>
  z.strictObject({
    ...identityShape(),
    parentEquipmentId: z.nullable(authoredIdentifierSchema),
    category: equipmentCategoryCodeSchema.check(z.refine((value) => value !== 'VARIANT')),
    isContainer: z.boolean(),
    maxStack: z.optional(z.number().check(z.int()).check(z.positive())),
    properties: authoredReferenceCollectionSchema(equipmentPropertyCodeSchema),
    requiresAttunement: z.boolean()
  })
)

export const contentSnapshotSpellIndexEntrySchema = lazySchema(() =>
  z.strictObject({
    ...identityShape(),
    attributes: spellAuthoredDtoSchema.shape.attributes,
    castingTime: spellAuthoredDtoSchema.shape.castingTime,
    classIds: spellAuthoredDtoSchema.shape.classIds,
    components: spellAuthoredDtoSchema.shape.components,
    description: spellAuthoredDtoSchema.shape.description,
    level: spellAuthoredDtoSchema.shape.level,
    magicSchoolId: spellAuthoredDtoSchema.shape.magicSchoolId,
    materialDescription: spellAuthoredDtoSchema.shape.materialDescription
  })
)

/** Feats, Creatures and Vehicles are picked or looked up by identity only. */
export const contentSnapshotIdentityIndexEntrySchema = lazySchema(() =>
  z.strictObject(identityShape())
)

const partShape = <Kind extends z.infer<typeof contentSnapshotKindSchema>, Roots>(
  kind: Kind,
  part: z.infer<typeof contentSnapshotPartSchema>,
  roots: Roots
) => ({ ...headerShape(), kind: z.literal(kind), part: z.literal(part), roots })

export const contentSnapshotIndexObjectSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject(
      partShape('BACKGROUND', 'index', z.array(contentSnapshotBackgroundIndexEntrySchema))
    ),
    z.strictObject(partShape('CLASS', 'index', z.array(contentSnapshotClassIndexEntrySchema))),
    z.strictObject(
      partShape('CREATURE', 'index', z.array(contentSnapshotIdentityIndexEntrySchema))
    ),
    z.strictObject(
      partShape('EQUIPMENT', 'index', z.array(contentSnapshotEquipmentIndexEntrySchema))
    ),
    z.strictObject(partShape('FEAT', 'index', z.array(contentSnapshotIdentityIndexEntrySchema))),
    z.strictObject(partShape('RACE', 'index', z.array(contentSnapshotRaceIndexEntrySchema))),
    z.strictObject(partShape('SPELL', 'index', z.array(contentSnapshotSpellIndexEntrySchema))),
    z.strictObject(partShape('VEHICLE', 'index', z.array(contentSnapshotIdentityIndexEntrySchema)))
  ])
)

/** Full published documents, fetched lazily per kind for evaluation and preview. */
export const contentSnapshotDocumentsObjectSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject(partShape('BACKGROUND', 'documents', z.array(backgroundAuthoredDtoSchema))),
    z.strictObject(partShape('CLASS', 'documents', z.array(classAuthoredDtoSchema))),
    z.strictObject(partShape('CREATURE', 'documents', z.array(creaturePublicationDtoSchema))),
    z.strictObject(partShape('EQUIPMENT', 'documents', z.array(equipmentAuthoredDtoSchema))),
    z.strictObject(partShape('FEAT', 'documents', z.array(featAuthoredDtoSchema))),
    z.strictObject(partShape('RACE', 'documents', z.array(raceAuthoredDtoSchema))),
    z.strictObject(partShape('SPELL', 'documents', z.array(spellAuthoredDtoSchema))),
    z.strictObject(partShape('VEHICLE', 'documents', z.array(vehicleAuthoredDtoSchema)))
  ])
)

export const contentSnapshotObjectRefSchema = lazySchema(() =>
  z.strictObject({
    sha256: projectionChecksumSchema,
    byteLength: z.number().check(z.int()).check(z.positive()),
    rootCount: z.number().check(z.int()).check(z.positive())
  })
)

/** A scope's current objects. A kind with no readable roots has no entry. */
export const contentSnapshotHeadSchema = lazySchema(() =>
  z.strictObject({
    scope: contentSnapshotScopeSchema,
    scopeId: postgresUuidSchema,
    revision: z.number().check(z.int()).check(z.gte(0)),
    builtRevision: z.number().check(z.int()).check(z.gte(0)),
    kinds: z.partialRecord(
      contentSnapshotKindSchema,
      z.strictObject({
        index: contentSnapshotObjectRefSchema,
        documents: contentSnapshotObjectRefSchema
      })
    )
  })
)

export type ContentSnapshotScope = z.infer<typeof contentSnapshotScopeSchema>
export type ContentSnapshotKind = z.infer<typeof contentSnapshotKindSchema>
export type ContentSnapshotPart = z.infer<typeof contentSnapshotPartSchema>
export type ContentSnapshotHeader = z.infer<typeof contentSnapshotHeaderSchema>
export type ContentSnapshotIndexObject = z.infer<typeof contentSnapshotIndexObjectSchema>
export type ContentSnapshotDocumentsObject = z.infer<typeof contentSnapshotDocumentsObjectSchema>
export type ContentSnapshotObject = ContentSnapshotIndexObject | ContentSnapshotDocumentsObject
export type ContentSnapshotIndexEntry<Kind extends ContentSnapshotKind = ContentSnapshotKind> =
  Extract<ContentSnapshotIndexObject, { kind: Kind }>['roots'][number]
export type ContentSnapshotDocument<Kind extends ContentSnapshotKind = ContentSnapshotKind> =
  Extract<ContentSnapshotDocumentsObject, { kind: Kind }>['roots'][number]
export type ContentSnapshotRoot<
  Kind extends ContentSnapshotKind,
  Part extends ContentSnapshotPart
> = Part extends 'index' ? ContentSnapshotIndexEntry<Kind> : ContentSnapshotDocument<Kind>
export type ContentSnapshotObjectRef = z.infer<typeof contentSnapshotObjectRefSchema>
export type ContentSnapshotHead = z.infer<typeof contentSnapshotHeadSchema>
