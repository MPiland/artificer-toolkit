import { z, lazySchema } from '../zod.js'
import { authoredSubjectKindSchema, projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredDraftLookupInputSchema } from './authoredDrafts.js'
import type { BackgroundAuthoredDto } from '../subjects/background.js'
import type { ClassAuthoredDto } from '../subjects/class.js'
import type { CreatureAuthoredDto } from '../subjects/creature.js'
import type { EquipmentAuthoredDto } from '../subjects/equipment.js'
import type { FeatAuthoredDto } from '../subjects/feat.js'
import type { RaceAuthoredDto } from '../subjects/race.js'
import type { SpellAuthoredDto } from '../subjects/spell.js'
import type { VehicleAuthoredDto } from '../subjects/vehicle.js'

export type AuthoredPublicationDocument =
  | { subjectKind: 'BACKGROUND'; document: BackgroundAuthoredDto }
  | { subjectKind: 'CLASS'; document: ClassAuthoredDto }
  | { subjectKind: 'CREATURE'; document: CreatureAuthoredDto }
  | { subjectKind: 'FEAT'; document: FeatAuthoredDto }
  | { subjectKind: 'EQUIPMENT'; document: EquipmentAuthoredDto }
  | { subjectKind: 'RACE'; document: RaceAuthoredDto }
  | { subjectKind: 'SPELL'; document: SpellAuthoredDto }
  | { subjectKind: 'VEHICLE'; document: VehicleAuthoredDto }

export const authoredPublishDraftInputSchema = lazySchema(() =>
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
    subjectId: z.pipe(
      z.uuid(),
      z.transform((value) => value.toLowerCase())
    ),
    expectedDraftUpdatedAt: z.iso.datetime()
  })
)

export const authoredDeleteActiveInputSchema = lazySchema(() =>
  z.extend(authoredDraftLookupInputSchema, {
    subjectKind: authoredPublishDraftInputSchema.shape.subjectKind
  })
)

export const authoredPublicationNameErrorSchema = lazySchema(() =>
  z.discriminatedUnion('code', [
    z.strictObject({
      code: z.literal('ACTIVE_NAME_CONFLICT'),
      scope: z.enum(['DOMAIN', 'PARENT_CLASS'])
    }),
    z.strictObject({ code: z.literal('ACTIVE_NAME_INDEX_INCOMPLETE') })
  ])
)

export const authoredPublicationNameBackfillInputSchema = lazySchema(() =>
  z.strictObject({
    ownerUserId: z.pipe(
      z.uuid(),
      z.transform((value) => value.toLowerCase())
    ),
    systemId: postgresUuidSchema,
    subjectKind: authoredPublishDraftInputSchema.shape.subjectKind,
    cursor: z.nullable(z.string())
  })
)

export const authoredPublicationNameBackfillResultSchema = lazySchema(() =>
  z.strictObject({
    processed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(2)),
    continueCursor: z.string(),
    isDone: z.boolean()
  })
)

export const authoredPublicationResultSchema = lazySchema(() =>
  z.strictObject({
    subjectKind: authoredSubjectKindSchema,
    subjectId: z.uuid(),
    publicId: z.string().check(z.minLength(1)),
    checksum: projectionChecksumSchema,
    activeUpdatedAt: z.iso.datetime()
  })
)

/** The only stored compilation version evaluation reads; older rows are recompiled by migration. */
export const SUBJECT_COMPILER_VERSION = 'subject-compiler-v2'

// Server-produced current compilation, not source history or a client-editable plan.
export const authoredStoredCompilationSchema = lazySchema(() =>
  z.strictObject({
    compilerVersion: z.literal(SUBJECT_COMPILER_VERSION),
    projectionSchemaVersion: z.literal(1),
    authoredChecksum: projectionChecksumSchema,
    projectionChecksum: projectionChecksumSchema,
    projectionJson: z.string()
  })
)

/**
 * Transitional (PLATFORM-21.T1a): the table also admits a superseded compiler version until
 * `content/compilationMigration` recompiles it; PLATFORM-21.T1b narrows it to the current version.
 */
export const authoredStoredCompilationRowSchema = lazySchema(() =>
  z.extend(authoredStoredCompilationSchema, {
    compilerVersion: z.enum(['subject-compiler-v1', SUBJECT_COMPILER_VERSION])
  })
)

/** Current read dependency; this does not pin future Character invocations to a publication. */
export const authoredCurrentSourceIdentitySchema = lazySchema(() =>
  z.strictObject({
    subjectKind: authoredPublishDraftInputSchema.shape.subjectKind,
    subjectId: postgresUuidSchema,
    systemId: postgresUuidSchema,
    contentSourceId: postgresUuidSchema,
    versionId: z.string().check(z.minLength(1)),
    checksum: projectionChecksumSchema
  })
)

export type AuthoredCurrentSourceIdentity = z.infer<typeof authoredCurrentSourceIdentitySchema>

export type AuthoredPublicationResult = z.infer<typeof authoredPublicationResultSchema>
export type AuthoredPublishDraftInput = z.infer<typeof authoredPublishDraftInputSchema>
export type AuthoredDeleteActiveInput = z.infer<typeof authoredDeleteActiveInputSchema>
export type AuthoredStoredCompilation = z.infer<typeof authoredStoredCompilationSchema>
export type AuthoredPublicationNameBackfillInput = z.infer<
  typeof authoredPublicationNameBackfillInputSchema
>
export type AuthoredPublicationNameBackfillResult = z.infer<
  typeof authoredPublicationNameBackfillResultSchema
>
