import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const raceQueries = createAuthoredContentQueries(
  (client) => client.content.races,
  queryKeys.content.races
)

export function getRaceList(client?: Api) {
  return raceQueries.getList(client)
}

export function useGetRaceList() {
  return raceQueries.useList()
}

export function getRace(input: DetailInput, client?: Api) {
  return raceQueries.getDetail(input, client)
}

export function useGetRace(input: DetailInput) {
  return raceQueries.useDetail(input)
}

export function getRaceDraft(id: string, client?: Api) {
  return raceQueries.getDraft(id, client)
}
