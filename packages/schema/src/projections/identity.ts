import { z } from '../zod.js'

export const authoredSubjectKindSchema = z.enum([
  'BACKGROUND',
  'CLASS',
  'CREATURE',
  'EQUIPMENT',
  'FEAT',
  'RACE',
  'SPELL',
  'VEHICLE'
])

export type AuthoredSubjectKind = z.infer<typeof authoredSubjectKindSchema>

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export const jsonValueSchema: z.ZodMiniType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema)
  ])
)

export const projectionIdentifierSchema = z
  .string()
  .check(z.trim())
  .check(z.minLength(1))
  .check(z.maxLength(240))
export const projectionChecksumSchema = z
  .string()
  .check(z.regex(/^[a-f0-9]{64}$/, 'Expected a lowercase SHA-256 checksum'))
export const projectionSchemaVersionSchema = z.number().check(z.int()).check(z.positive())

export const authoredVersionVectorEntrySchema = z.strictObject({
  subjectKind: authoredSubjectKindSchema,
  subjectId: projectionIdentifierSchema,
  versionId: projectionIdentifierSchema,
  version: projectionSchemaVersionSchema,
  checksum: projectionChecksumSchema
})

export const authoredVersionVectorSchema = z.array(authoredVersionVectorEntrySchema).check(
  z.superRefine((entries, context) => {
    const seen = new Set<string>()
    entries.forEach((entry, index) => {
      const key = `${entry.subjectKind}:${entry.subjectId}`
      if (seen.has(key)) {
        context.addIssue({
          code: 'custom',
          message: 'Authored version vector entries must be unique',
          path: [index]
        })
      }
      seen.add(key)
    })
  })
)

export type AuthoredVersionVector = z.infer<typeof authoredVersionVectorSchema>
