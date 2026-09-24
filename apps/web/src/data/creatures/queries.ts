import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  creatureResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getCreature(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'CREATURE'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => creatureResponseDtoSchema.parse(result)
  })
}

export function useGetCreature(input: DetailInput) {
  return useSuspenseQuery(getCreature(input))
}
