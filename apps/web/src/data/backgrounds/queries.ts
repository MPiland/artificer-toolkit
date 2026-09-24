import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  backgroundResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getBackground(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'BACKGROUND'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => backgroundResponseDtoSchema.parse(result)
  })
}

export function useGetBackground(input: DetailInput) {
  return useSuspenseQuery(getBackground(input))
}
