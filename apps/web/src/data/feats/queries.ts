import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  featResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getFeat(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'FEAT'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => featResponseDtoSchema.parse(result)
  })
}

export function useGetFeat(input: DetailInput) {
  return useSuspenseQuery(getFeat(input))
}
