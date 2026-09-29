import { queryOptions } from '@tanstack/react-query'
import type { ConvexReactClient } from 'convex/react'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { encounterBlueprintPageSchema } from '@artificer-toolkit/schema/api/encounterBlueprintPages'
import type { EncounterBlueprintDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterProjectionDtoSchema,
  encounterSummaryListDtoSchema,
  encounterTimelineDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import { queryKeys } from '#app/lib/queryKeys'

export function getEncounter(encounterId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.detail(encounterId),
    queryFn: async () =>
      encounterProjectionDtoSchema.parse(
        await client.query(convexApi.encounters.projectionReads.get, { encounterId })
      ),
    refetchInterval: 5_000
  })
}

export function getActiveEncounter(campaignId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.active(campaignId),
    queryFn: async () => {
      const encounter = await client.query(convexApi.encounters.projectionReads.active, {
        campaignId
      })
      return encounter === null ? null : encounterProjectionDtoSchema.parse(encounter)
    },
    refetchInterval: 5_000
  })
}

export function getCampaignEncounters(campaignId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.list(campaignId),
    queryFn: async () =>
      encounterSummaryListDtoSchema.parse(
        await client.query(convexApi.encounters.projectionReads.list, { campaignId })
      ),
    refetchInterval: 5_000
  })
}

export function getPendingEncounterRuleOccurrence(encounterId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.pendingOccurrence(encounterId),
    queryFn: async () => {
      const occurrence = await client.query(
        convexApi.encounters.pendingReads.pendingRuleOccurrence,
        {
          encounterId
        }
      )
      return occurrence === null
        ? null
        : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(occurrence)
    },
    refetchInterval: 5_000,
    retry: false
  })
}

export function getEncounterBlueprints(gameSystemId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.blueprints(gameSystemId),
    queryFn: async () => {
      const blueprints: EncounterBlueprintDto[] = []
      let cursor: string | null = null
      const seen = new Set<string | null>()
      for (;;) {
        if (seen.has(cursor)) throw new Error('Encounter Blueprint pagination did not advance.')
        seen.add(cursor)
        const page = encounterBlueprintPageSchema.parse(
          await client.query(convexApi.encounters.blueprints.list, {
            gameSystemId,
            paginationOpts: { cursor, numItems: 48 }
          })
        )
        blueprints.push(...page.page)
        if (page.isDone) return blueprints
        if (page.continueCursor === cursor)
          throw new Error('Encounter Blueprint pagination did not advance.')
        cursor = page.continueCursor
      }
    },
    refetchInterval: 30_000
  })
}

export function getEncounterTimeline(encounterId: string, client: ConvexReactClient) {
  return queryOptions({
    queryKey: queryKeys.encounters.timeline(encounterId),
    queryFn: async () =>
      encounterTimelineDtoSchema.parse(
        await client.query(convexApi.encounters.timelineReads.timeline, { encounterId, limit: 50 })
      ),
    refetchInterval: 5_000
  })
}
