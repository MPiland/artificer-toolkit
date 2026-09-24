import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  classResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getClass(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'CLASS'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => classResponseDtoSchema.parse(result)
  })
}

export function useGetClass(input: DetailInput) {
  return useSuspenseQuery(getClass(input))
}
