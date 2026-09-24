import { convexQuery } from '@convex-dev/react-query'
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import {
  authoredDetailReadInputSchema,
  vehicleResponseDtoSchema,
  type AuthoredDetailRequestDto
} from '@artificer-toolkit/schema/api/content'

type DetailInput = string | AuthoredDetailRequestDto

export function getVehicle(input: DetailInput) {
  const args = authoredDetailReadInputSchema.parse({
    ...(typeof input === 'string' ? { id: input } : input),
    subjectKind: 'VEHICLE'
  })
  return queryOptions({
    ...convexQuery(convexApi.content.details.get, args),
    select: (result) => vehicleResponseDtoSchema.parse(result)
  })
}

export function useGetVehicle(input: DetailInput) {
  return useSuspenseQuery(getVehicle(input))
}
