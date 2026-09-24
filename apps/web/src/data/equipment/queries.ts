import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  equipmentResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getEquipment(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'EQUIPMENT'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => equipmentResponseDtoSchema.parse(result)
  })
}

export function useGetEquipment(input: DetailInput) {
  return useSuspenseQuery(getEquipment(input))
}
