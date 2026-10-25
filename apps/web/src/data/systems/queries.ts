import { type QueryClient } from '@tanstack/react-query'
import type {
  SystemListPageDto,
  SystemListResponseDto
} from '@artificer-toolkit/schema/api/systems'
import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { definitionReferences } from '@artificer-toolkit/apis/convex/definition-references'

export function getSystemListPage(cursor: string | null = null) {
  return convexQuery(convexApi.content.systems.list, { cursor, limit: 10 })
}

export async function loadSystemList(queryClient: QueryClient): Promise<SystemListResponseDto> {
  const systems: SystemListResponseDto = []
  const cursors = new Set<string | null>()
  let cursor: string | null = null
  for (;;) {
    cursors.add(cursor)
    const result: SystemListPageDto = await queryClient.ensureQueryData(getSystemListPage(cursor))
    systems.push(...result.page)
    if (result.isDone) return systems
    if (!result.continueCursor || cursors.has(result.continueCursor)) {
      throw new Error('Invalid System page continuation.')
    }
    cursor = result.continueCursor
  }
}

export function getSystem(id: string) {
  return convexQuery(convexApi.content.systems.get, { id })
}

export function getSystemSummary(id: string) {
  return convexQuery(convexApi.content.systems.summary, { id })
}

export function getSystemRuleCapability(id: string) {
  return convexQuery(convexApi.content.systems.capability, { id })
}

export function getSystemDefinitions(gameSystemId: string, cursor: string | null = null) {
  return convexQuery(convexApi.content.definitions.list, { gameSystemId, cursor, limit: 10 })
}

export function getSystemDefinition(definitionId: string) {
  return convexQuery(definitionReferences.get, { definitionId })
}
