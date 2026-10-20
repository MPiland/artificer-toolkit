import { z, lazySchema } from '../zod.js'
import { authoredStoredCompilationSchema } from '../api/authoredPublication.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredVersionVectorEntrySchema } from './identity.js'

/** The prose a held item keeps reading after its source changes or is deleted (D163). */
const acquiredPresentationSchema = lazySchema(() =>
  z.strictObject({
    label: z.string().check(z.minLength(1)),
    // Equipment authors null for no prose; a Spell always has a description.
    description: z.optional(z.nullable(z.string())),
    quote: z.optional(z.string()),
    materialDescription: z.optional(z.string())
  })
)

const acquiredEquipmentSourceSchema = lazySchema(() =>
  z.extend(authoredVersionVectorEntrySchema, {
    subjectKind: z.enum(['EQUIPMENT', 'SPELL']),
    subjectId: postgresUuidSchema,
    version: z.number().check(z.int(), z.gte(1), z.lte(Number.MAX_SAFE_INTEGER)),
    /** The stored compilation row of this version: resolved Equipment or a CompiledSpell. */
    compilation: authoredStoredCompilationSchema,
    presentation: acquiredPresentationSchema
  })
)

/**
 * Pinned acquired rules are scoped to a held Equipment instance, never a catalogue publication:
 * the held Equipment's resolved compilation and the Spells it grants, each with its prose.
 */
export const acquiredEquipmentRulesSchema = lazySchema(() =>
  z.strictObject({
    equipmentId: postgresUuidSchema,
    systemId: postgresUuidSchema,
    sources: z.array(acquiredEquipmentSourceSchema).check(
      z.superRefine((sources, context) => {
        const seen = new Set<string>()
        for (const [index, source] of sources.entries()) {
          const identity = `${source.subjectKind}:${source.subjectId}`
          if (seen.has(identity))
            context.addIssue({
              code: 'custom',
              path: [index],
              message: 'Acquired source identities must be unique.'
            })
          seen.add(identity)
        }
        if (sources.filter((source) => source.subjectKind === 'EQUIPMENT').length !== 1)
          context.addIssue({
            code: 'custom',
            message: 'Acquired rules pin exactly one resolved Equipment.'
          })
        if (sources.filter((source) => source.subjectKind === 'SPELL').length > 500)
          context.addIssue({
            code: 'custom',
            message: 'Acquired SPELL dependencies exceed the complete authoring limit.'
          })
      })
    )
  })
)

export type AcquiredEquipmentRules = z.infer<typeof acquiredEquipmentRulesSchema>
export type AcquiredPresentation = AcquiredEquipmentRules['sources'][number]['presentation']
