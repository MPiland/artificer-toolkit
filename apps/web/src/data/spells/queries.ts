import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  spellResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getSpell(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'SPELL'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => spellResponseDtoSchema.parse(result)
  })
}

export function useGetSpell(input: DetailInput) {
  return useSuspenseQuery(getSpell(input))
}
