import type { Api, AuthoredDetailRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const creatureQueries = createAuthoredContentQueries(
  (client) => client.content.creatures,
  queryKeys.content.creatures
)

export function getCreatureList(client?: Api) {
  return creatureQueries.getList(client)
}

export function useGetCreatureList() {
  return creatureQueries.useList()
}

export function getCreature(input: DetailInput, client?: Api) {
  return creatureQueries.getDetail(input, client)
}

export function useGetCreature(input: DetailInput) {
  return creatureQueries.useDetail(input)
}

export function getCreatureDraft(id: string, client?: Api) {
  return creatureQueries.getDraft(id, client)
}
