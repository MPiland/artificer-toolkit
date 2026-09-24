import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  raceResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getRace(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'RACE'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => raceResponseDtoSchema.parse(result)
  })
}

export function useGetRace(input: DetailInput) {
  return useSuspenseQuery(getRace(input))
}
