import type { CheckAuthored } from '@artificer-toolkit/shared/authored'
import { z, lazySchema } from '../zod.js'
import { authoredNestedCollectionSchema } from '../shared/authoredLimits.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

const sortedUniqueUuids = lazySchema(() =>
  authoredNestedCollectionSchema(postgresUuidSchema).check(
    z.superRefine((ids: string[], ctx) => {
      if (ids.some((id, index) => index > 0 && ids[index - 1]! >= id))
        ctx.addIssue({ code: 'custom', message: 'Check identities must be unique and sorted.' })
    })
  )
)

/** The checks a creature may choose from: any listed skill check or ability check (D105). */
export const checkChoiceDtoSchema = lazySchema(() =>
  z
    .object({ skillIds: sortedUniqueUuids, abilityDefinitionIds: sortedUniqueUuids })
    .check(
      z.refine(
        (value) => value.skillIds.length + value.abilityDefinitionIds.length > 0,
        'Name at least one allowed check.'
      )
    )
)

/** The DC kinds a check can roll against; see `CheckDcAuthored`. */
export const checkDcDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('FIXED'),
      value: z.number().check(z.int()).check(z.positive())
    }),
    z.object({ kind: z.literal('CONTEST'), checks: checkChoiceDtoSchema }),
    z.object({ kind: z.literal('PASSIVE'), passiveDefinitionId: postgresUuidSchema }),
    z.object({ kind: z.literal('CONCEALMENT') })
  ])
)

/** What the CHECK trigger rolls: the actor picks one listed check and rolls it against the DC. */
export const checkDtoSchema: z.ZodMiniType<CheckAuthored> = lazySchema(() =>
  z.object({ checks: checkChoiceDtoSchema, dc: checkDcDtoSchema })
)
