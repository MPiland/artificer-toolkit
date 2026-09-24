import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { authoredVersionVectorEntrySchema } from './identity.js'

const acquiredEquipmentSourceSchema = z.extend(authoredVersionVectorEntrySchema, {
  subjectKind: z.enum(['EQUIPMENT', 'SPELL']),
  subjectId: postgresUuidSchema,
  version: z.number().check(z.int(), z.gte(1), z.lte(Number.MAX_SAFE_INTEGER)),
  documentJson: z.string()
})

/** Raw acquired rules are scoped to a held Equipment instance, never a catalogue publication. */
export const acquiredEquipmentRulesSchema = z.strictObject({
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
      for (const kind of ['EQUIPMENT', 'SPELL'] as const) {
        if (sources.filter((source) => source.subjectKind === kind).length > 500)
          context.addIssue({
            code: 'custom',
            message: `Acquired ${kind} dependencies exceed the complete authoring limit.`
          })
      }
    })
  )
})
export type AcquiredEquipmentRules = z.infer<typeof acquiredEquipmentRulesSchema>
