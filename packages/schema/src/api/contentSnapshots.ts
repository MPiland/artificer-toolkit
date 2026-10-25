import { z, lazySchema } from '../zod.js'
import { authoredSubjectKindSchema, projectionChecksumSchema } from '../projections/identity.js'
import { campaignContentMaturityDtoSchema } from './campaignCore.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import {
  creatureCategoryCodeSchema,
  equipmentCategoryCodeSchema,
  equipmentPropertyCodeSchema,
  vehicleCategoryCodeSchema
} from '../shared/enums.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'
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
import { castingTimeDtoSchema } from '../subjects/castingTime.js'
import { spellAuthoredDtoSchema } from '../subjects/spell.js'
import { vehicleAuthoredDtoSchema } from '../subjects/vehicle.js'
import {
  authoredCurrentSourceIdentitySchema,
  authoredStoredCompilationSchema,
  type AuthoredStoredCompilation
} from './authoredPublication.js'

// ADR 0036: immutable, content-addressed published content. One object per scope x kind x part.
export const contentSnapshotScopeSchema = lazySchema(() => z.enum(['SYSTEM', 'SOURCE', 'CAMPAIGN']))
export const contentSnapshotKindSchema = authoredSubjectKindSchema
export const contentSnapshotPartSchema = lazySchema(() => z.enum(['index', 'list', 'documents']))

const headerShape = () => ({
  format: z.literal(3),
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

/** `v3/{scope}/{scopeId}/{kind}/{part}/{sha256}.json`: the R2 key and Worker path of one object. */
export function contentSnapshotObjectKey(header: ContentSnapshotHeader, sha256: string): string {
  const { scope, scopeId, kind, part } = contentSnapshotHeaderSchema.parse(header)
  return `v3/${scope.toLowerCase()}/${scopeId}/${kind.toLowerCase()}/${part}/${projectionChecksumSchema.parse(sha256)}.json`
}

/** The inverse of `contentSnapshotObjectKey`; null for anything that is not a canonical key. */
export function parseContentSnapshotObjectKey(
  key: string
): { header: ContentSnapshotHeader; sha256: string } | null {
  const [, scope = '', scopeId, kind = '', part, hash] =
    /^v3\/([a-z]+)\/([^/]+)\/([a-z]+)\/([a-z]+)\/([^/]+)\.json$/.exec(key) ?? []
  const header = contentSnapshotHeaderSchema.safeParse({
    format: 3,
    scope: scope.toUpperCase(),
    scopeId,
    kind: kind.toUpperCase(),
    part
  })
  const sha256 = projectionChecksumSchema.safeParse(hash)
  if (!header.success || !sha256.success) return null
  return contentSnapshotObjectKey(header.data, sha256.data) === key
    ? { header: header.data, sha256: sha256.data }
    : null
}

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
      size: systemCoreCodeSchema,
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
const contentSnapshotEquipmentIndexEntrySchema = lazySchema(() =>
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

const contentSnapshotSpellIndexEntrySchema = lazySchema(() =>
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
const contentSnapshotIdentityIndexEntrySchema = lazySchema(() => z.strictObject(identityShape()))

// List entries hold what a catalogue page shows and filters on. They are a separate part so the
// Builder's index stays small and neither reads `documents`. Labels of other roots (a parent,
// a Spell's Classes) are joined by the reader from the visible entries of that kind.
const listIdentityShape = () => ({
  ...identityShape(),
  publicId: z.string().check(z.minLength(1)),
  description: z.optional(authoredRichTextSchema)
})

const contentSnapshotRaceListEntrySchema = lazySchema(() =>
  z.discriminatedUnion('category', [
    z.strictObject({
      ...listIdentityShape(),
      category: z.literal('BASE'),
      selectionMode: baseRaceAuthoredDtoSchema.shape.selectionMode
    }),
    z.strictObject({
      ...listIdentityShape(),
      category: z.literal('SUBRACE'),
      parentRaceId: authoredIdentifierSchema
    })
  ])
)

const contentSnapshotClassListEntrySchema = lazySchema(() =>
  z.discriminatedUnion('category', [
    z.strictObject({ ...listIdentityShape(), category: z.literal('BASE') }),
    z.strictObject({
      ...listIdentityShape(),
      category: z.literal('SUBCLASS'),
      parentClassId: authoredIdentifierSchema
    })
  ])
)

const contentSnapshotEquipmentListEntrySchema = lazySchema(() =>
  z.strictObject({ ...listIdentityShape(), category: equipmentCategoryCodeSchema })
)

const contentSnapshotCreatureListEntrySchema = lazySchema(() =>
  z.strictObject({ ...listIdentityShape(), category: creatureCategoryCodeSchema })
)

const contentSnapshotVehicleListEntrySchema = lazySchema(() =>
  z.strictObject({ ...listIdentityShape(), category: vehicleCategoryCodeSchema })
)

/** Backgrounds and Feats have no category. */
const contentSnapshotPlainListEntrySchema = lazySchema(() => z.strictObject(listIdentityShape()))

const contentSnapshotSpellListEntrySchema = lazySchema(() =>
  z.strictObject({
    ...listIdentityShape(),
    level: spellAuthoredDtoSchema.shape.level,
    magicSchoolId: spellAuthoredDtoSchema.shape.magicSchoolId,
    // Denormalized from the System vocabulary at build time; System rows are insert-only.
    magicSchoolLabel: authoredShortTextSchema,
    // Lowercased, deduplicated and sorted, as the Convex catalogue projection stored them.
    classIds: z.array(postgresUuidSchema),
    castingTime: castingTimeDtoSchema
  })
)

const partShape = <
  Kind extends z.infer<typeof contentSnapshotKindSchema>,
  Part extends z.infer<typeof contentSnapshotPartSchema>,
  Roots
>(
  kind: Kind,
  part: Part,
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

/** What the authored-content list pages read: the only part they fetch. */
export const contentSnapshotListObjectSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject(partShape('BACKGROUND', 'list', z.array(contentSnapshotPlainListEntrySchema))),
    z.strictObject(partShape('CLASS', 'list', z.array(contentSnapshotClassListEntrySchema))),
    z.strictObject(partShape('CREATURE', 'list', z.array(contentSnapshotCreatureListEntrySchema))),
    z.strictObject(
      partShape('EQUIPMENT', 'list', z.array(contentSnapshotEquipmentListEntrySchema))
    ),
    z.strictObject(partShape('FEAT', 'list', z.array(contentSnapshotPlainListEntrySchema))),
    z.strictObject(partShape('RACE', 'list', z.array(contentSnapshotRaceListEntrySchema))),
    z.strictObject(partShape('SPELL', 'list', z.array(contentSnapshotSpellListEntrySchema))),
    z.strictObject(partShape('VEHICLE', 'list', z.array(contentSnapshotVehicleListEntrySchema)))
  ])
)

/** Original storage identity; a normalized DTO's checksum cannot replace a source pin. */
export const contentSnapshotPublicationVersionSchema = lazySchema(() =>
  z.strictObject({
    identity: authoredCurrentSourceIdentitySchema,
    version: z.number().check(z.int()).check(z.positive()),
    storedParentId: z.optional(z.nullable(postgresUuidSchema))
  })
)

const documentsShape = <Kind extends z.infer<typeof contentSnapshotKindSchema>, Roots>(
  kind: Kind,
  roots: Roots
) => ({
  ...partShape(kind, 'documents', roots),
  versions: z.array(contentSnapshotPublicationVersionSchema),
  compilations: z.array(authoredStoredCompilationSchema)
})

type ContentSnapshotDocumentsOf<
  Kind extends z.infer<typeof contentSnapshotKindSchema>,
  Root
> = Omit<ContentSnapshotHeader, 'kind' | 'part'> & {
  kind: Kind
  part: 'documents'
  roots: Root[]
  versions: ContentSnapshotPublicationVersion[]
  compilations: AuthoredStoredCompilation[]
}

/**
 * Written out because the inferred union of every authored aggregate exceeds what declaration
 * emit can serialize (TS7056). The assignment below checks it against the schema it describes.
 */
export type ContentSnapshotDocumentsObject =
  | ContentSnapshotDocumentsOf<'BACKGROUND', z.infer<typeof backgroundAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'CLASS', z.infer<typeof classAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'CREATURE', z.infer<typeof creaturePublicationDtoSchema>>
  | ContentSnapshotDocumentsOf<'EQUIPMENT', z.infer<typeof equipmentAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'FEAT', z.infer<typeof featAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'RACE', z.infer<typeof raceAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'SPELL', z.infer<typeof spellAuthoredDtoSchema>>
  | ContentSnapshotDocumentsOf<'VEHICLE', z.infer<typeof vehicleAuthoredDtoSchema>>

/** Full published documents, their original versions and stored compilations, in matching root order. */
export const contentSnapshotDocumentsObjectSchema: z.ZodMiniType<ContentSnapshotDocumentsObject> =
  lazySchema(() =>
    z
      .discriminatedUnion('kind', [
        z.strictObject(documentsShape('BACKGROUND', z.array(backgroundAuthoredDtoSchema))),
        z.strictObject(documentsShape('CLASS', z.array(classAuthoredDtoSchema))),
        z.strictObject(documentsShape('CREATURE', z.array(creaturePublicationDtoSchema))),
        z.strictObject(documentsShape('EQUIPMENT', z.array(equipmentAuthoredDtoSchema))),
        z.strictObject(documentsShape('FEAT', z.array(featAuthoredDtoSchema))),
        z.strictObject(documentsShape('RACE', z.array(raceAuthoredDtoSchema))),
        z.strictObject(documentsShape('SPELL', z.array(spellAuthoredDtoSchema))),
        z.strictObject(documentsShape('VEHICLE', z.array(vehicleAuthoredDtoSchema)))
      ])
      .check(
        z.refine(
          (object) =>
            object.versions.length === object.roots.length &&
            object.compilations.length === object.roots.length &&
            object.roots.every((root, index) => {
              const pin = object.versions[index]!
              return (
                object.compilations[index]!.authoredChecksum === pin.identity.checksum &&
                pin.identity.subjectId === root.id &&
                pin.identity.subjectKind === object.kind &&
                pin.identity.systemId === root.systemId &&
                (object.scope !== 'SOURCE' || pin.identity.contentSourceId === object.scopeId)
              )
            }),
          {
            message:
              'Content snapshot publication versions or compilations do not match their documents.'
          }
        )
      )
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
        list: contentSnapshotObjectRefSchema,
        documents: contentSnapshotObjectRefSchema
      })
    )
  })
)

// Delivery (S3). The session Worker serves `GET {prefix}{object key}`.
export const CONTENT_SNAPSHOT_PATH_PREFIX = '/content/'
export const CONTENT_SNAPSHOT_TOKEN_AUDIENCE = 'artificer-content'
export const CONTENT_SNAPSHOT_TOKEN_ISSUER = 'artificer-convex'
export const CONTENT_SNAPSHOT_TOKEN_TTL_SECONDS = 600
/**
 * R2 custom metadata the build writes on PLATFORM source objects only. A content source's kind
 * never changes and every key names its scope, so a key's metadata stays true; the Worker treats
 * any object without it as private.
 */
export const CONTENT_SNAPSHOT_PUBLIC_METADATA = { access: 'public' } as const
// The Builder's bound of 100 visible sources per System; also keeps the header small.
const MAX_CONTENT_SNAPSHOT_TOKEN_SCOPES = 100

const tokenScopeIdsSchema = () =>
  z.array(postgresUuidSchema).check(z.maxLength(MAX_CONTENT_SNAPSHOT_TOKEN_SCOPES))

/** Names the private scopes a caller may read: their own USER sources and active Campaigns. */
export const contentSnapshotTokenClaimsSchema = lazySchema(() =>
  z.strictObject({
    aud: z.literal(CONTENT_SNAPSHOT_TOKEN_AUDIENCE),
    iss: z.literal(CONTENT_SNAPSHOT_TOKEN_ISSUER),
    exp: z.number().check(z.int()).check(z.positive()),
    iat: z.number().check(z.int()).check(z.positive()),
    jti: postgresUuidSchema,
    sub: postgresUuidSchema,
    userSourceIds: tokenScopeIdsSchema(),
    campaignIds: tokenScopeIdsSchema()
  })
)

export const contentSnapshotTokenGrantSchema = lazySchema(() =>
  z.pick(contentSnapshotTokenClaimsSchema, { sub: true, userSourceIds: true, campaignIds: true })
)

export const contentSnapshotAccessDtoSchema = lazySchema(() =>
  z.strictObject({
    expiresAt: z.iso.datetime({ offset: true }),
    token: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(8192))
  })
)

// Manifest (S4): the heads of the scopes a Character's Builder may read.
export const contentSnapshotManifestInputSchema = lazySchema(() =>
  z.strictObject({
    systemId: postgresUuidSchema,
    characterId: z.optional(z.string().check(z.minLength(1)).check(z.maxLength(240)))
  })
)

/**
 * A null head means the scope has no built content yet. A head whose `revision` exceeds
 * `builtRevision` is still rebuilding; its objects are the previous build's.
 */
export const contentSnapshotManifestDtoSchema = lazySchema(() =>
  z.strictObject({
    systemId: postgresUuidSchema,
    sources: z.array(
      z.strictObject({
        contentSourceId: postgresUuidSchema,
        kind: z.enum(['PLATFORM', 'USER']),
        head: z.nullable(contentSnapshotHeadSchema)
      })
    ),
    campaign: z.nullable(
      z.strictObject({
        id: postgresUuidSchema,
        contentMaturity: campaignContentMaturityDtoSchema,
        head: z.nullable(contentSnapshotHeadSchema)
      })
    )
  })
)

/**
 * The scopes the authored-content lists read (no Character, no Campaign): every PLATFORM source
 * and the caller's own Homebrew sources across Systems, as the Convex catalogue listed them.
 */
export const contentSnapshotCatalogueManifestDtoSchema = lazySchema(() =>
  z.strictObject({
    userId: z.string().check(z.minLength(1)),
    sources: z.array(
      z.strictObject({
        contentSourceId: postgresUuidSchema,
        systemId: postgresUuidSchema,
        kind: z.enum(['PLATFORM', 'USER']),
        head: z.nullable(contentSnapshotHeadSchema)
      })
    )
  })
)

export type ContentSnapshotScope = z.infer<typeof contentSnapshotScopeSchema>
export type ContentSnapshotKind = z.infer<typeof contentSnapshotKindSchema>
export type ContentSnapshotPart = z.infer<typeof contentSnapshotPartSchema>
export type ContentSnapshotHeader = z.infer<typeof contentSnapshotHeaderSchema>
export type ContentSnapshotIndexObject = z.infer<typeof contentSnapshotIndexObjectSchema>
export type ContentSnapshotListObject = z.infer<typeof contentSnapshotListObjectSchema>
export type ContentSnapshotPublicationVersion = z.infer<
  typeof contentSnapshotPublicationVersionSchema
>
export type ContentSnapshotObject =
  | ContentSnapshotIndexObject
  | ContentSnapshotListObject
  | ContentSnapshotDocumentsObject
export type ContentSnapshotIndexEntry<Kind extends ContentSnapshotKind = ContentSnapshotKind> =
  Extract<ContentSnapshotIndexObject, { kind: Kind }>['roots'][number]
export type ContentSnapshotListEntry<Kind extends ContentSnapshotKind = ContentSnapshotKind> =
  Extract<ContentSnapshotListObject, { kind: Kind }>['roots'][number]
export type ContentSnapshotDocument<Kind extends ContentSnapshotKind = ContentSnapshotKind> =
  Extract<ContentSnapshotDocumentsObject, { kind: Kind }>['roots'][number]
export type ContentSnapshotRoot<
  Kind extends ContentSnapshotKind,
  Part extends ContentSnapshotPart
> = Part extends 'index'
  ? ContentSnapshotIndexEntry<Kind>
  : Part extends 'list'
    ? ContentSnapshotListEntry<Kind>
    : ContentSnapshotDocument<Kind>
export type ContentSnapshotObjectRef = z.infer<typeof contentSnapshotObjectRefSchema>
export type ContentSnapshotHead = z.infer<typeof contentSnapshotHeadSchema>
export type ContentSnapshotTokenClaims = z.infer<typeof contentSnapshotTokenClaimsSchema>
export type ContentSnapshotTokenGrant = z.infer<typeof contentSnapshotTokenGrantSchema>
export type ContentSnapshotAccessDto = z.infer<typeof contentSnapshotAccessDtoSchema>
export type ContentSnapshotManifestInput = z.infer<typeof contentSnapshotManifestInputSchema>
export type ContentSnapshotManifestDto = z.infer<typeof contentSnapshotManifestDtoSchema>
export type ContentSnapshotCatalogueManifestDto = z.infer<
  typeof contentSnapshotCatalogueManifestDtoSchema
>
