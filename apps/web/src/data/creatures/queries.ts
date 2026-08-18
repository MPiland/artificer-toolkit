import type { Api, AuthoredDetailRequestDto, CreatureListRequestDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import { createAuthoredContentQueries } from '#app/data/authoredContentQueries'

type DetailInput = string | AuthoredDetailRequestDto

const creatureQueries = createAuthoredContentQueries(
  (client) => client.content.creatures,
  queryKeys.content.creatures
)

export function getCreatureList(input: CreatureListRequestDto, client?: Api) {
  return creatureQueries.getList(input, client)
}

export function useGetCreatureList(input: CreatureListRequestDto) {
  return creatureQueries.useList(input)
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
