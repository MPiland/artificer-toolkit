import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query'
import { api, type Api, type InventoryOwnerRefDto } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'

export function getCampaignList(client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.list(),
    queryFn: () => client.campaigns.list(),
    refetchInterval: 60_000
  })
}

export function getCampaignRouteIdentity(publicId: string, client: Api = api) {
  const normalizedPublicId = publicId.toLowerCase()
  return queryOptions({
    queryKey: queryKeys.routeIds.resolve('CAMPAIGN', normalizedPublicId),
    queryFn: () =>
      client.routeIds.resolve({
        subjectKind: 'CAMPAIGN',
        publicId: normalizedPublicId
      })
  })
}

export function getCampaignDetail(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.detail(campaignId),
    queryFn: () => client.campaigns.get(campaignId),
    refetchInterval: 60_000
  })
}

export function getCampaignSettings(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: [...queryKeys.campaigns.detail(campaignId), 'settings'],
    queryFn: () => client.campaigns.getSettings(campaignId)
  })
}

export function getCampaignPlaySettings(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.playSettings(campaignId),
    queryFn: () => client.campaigns.playSettings.get(campaignId)
  })
}

export function getCampaignPlaySettingsOptions(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.playSettingsOptions(campaignId),
    queryFn: () => client.campaigns.playSettings.options(campaignId)
  })
}

export function getCampaignConversations(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.conversations(campaignId),
    queryFn: () => client.campaigns.conversations.list(campaignId),
    refetchInterval: 15_000
  })
}

export function getCampaignChat(
  campaignId: string,
  room: 'TABLE' | 'PARTY' | 'DIRECT',
  client: Api = api,
  directUserId?: string
) {
  return infiniteQueryOptions({
    queryKey: queryKeys.campaigns.chat(campaignId, room, directUserId),
    queryFn: ({ pageParam }) =>
      client.campaigns.chat.list(campaignId, room, pageParam, 50, directUserId),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 15_000
  })
}

export function getCampaignNotebook(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.notebook(campaignId),
    queryFn: () => client.campaigns.notebook.list(campaignId),
    refetchInterval: 30_000
  })
}

export function getCampaignSessions(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sessions(campaignId),
    queryFn: () => client.campaigns.sessions.list(campaignId),
    refetchInterval: 30_000
  })
}

export function getCampaignSession(campaignId: string, sessionNumber: number, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.session(campaignId, sessionNumber),
    queryFn: () => client.campaigns.sessions.get({ campaignId, sessionNumber }),
    refetchInterval: 30_000
  })
}

export function getCampaignSessionAttendance(
  campaignId: string,
  sessionId: string,
  client: Api = api
) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sessionAttendance(campaignId, sessionId),
    queryFn: () => client.campaigns.sessions.attendance.list({ campaignId, sessionId }),
    refetchInterval: 30_000
  })
}

export function getCampaignSessionRsvps(campaignId: string, sessionId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sessionRsvps(campaignId, sessionId),
    queryFn: () => client.campaigns.sessions.rsvps.list(campaignId, sessionId),
    refetchInterval: 30_000
  })
}

export function getCampaignSessionReferences(
  campaignId: string,
  sessionId: string,
  client: Api = api
) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sessionReferences(campaignId, sessionId),
    queryFn: () => client.campaigns.sessions.references.list(campaignId, sessionId),
    refetchInterval: 30_000
  })
}

export function getCampaignClock(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.clock(campaignId),
    queryFn: () => client.campaigns.clock.get(campaignId),
    refetchInterval: 30_000
  })
}

export function getCampaignSessionNotes(campaignId: string, sessionId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.sessionNotes(campaignId, sessionId),
    queryFn: () => client.campaigns.sessions.notes.list(campaignId, sessionId),
    refetchInterval: 30_000
  })
}

export function getCampaignCurrencySystems(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.currencySystems(campaignId),
    queryFn: () => client.campaigns.inventory.currencySystems(campaignId),
    refetchInterval: 60_000
  })
}

export function getCampaignInventory(
  campaignId: string,
  owner: InventoryOwnerRefDto,
  client: Api = api
) {
  const ownerKey =
    owner.kind === 'CAMPAIGN'
      ? 'party'
      : owner.kind === 'CHARACTER'
        ? `character:${owner.characterId}`
        : `vehicle:${owner.vehicleId}`
  return queryOptions({
    queryKey: queryKeys.campaigns.inventory(campaignId, ownerKey),
    queryFn: () => client.campaigns.inventory.get(campaignId, owner),
    refetchInterval: 30_000
  })
}

export function getCampaignInventoryAudit(campaignId: string, client: Api = api) {
  return infiniteQueryOptions({
    queryKey: queryKeys.campaigns.inventoryAudit(campaignId),
    queryFn: ({ pageParam }) => client.campaigns.inventory.audit({ campaignId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    refetchInterval: 30_000
  })
}

export function getCampaignContent(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.content(campaignId),
    queryFn: () => client.campaigns.content.list(campaignId),
    refetchInterval: 30_000
  })
}

export function getCampaignVehicles(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.vehicles(campaignId),
    queryFn: () => client.campaigns.vehicles.list(campaignId)
  })
}

export function getCampaignAttachments(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.attachments(campaignId),
    queryFn: () => client.campaigns.attachments.list(campaignId)
  })
}

export function getCampaignAnnouncements(campaignId: string, client: Api = api) {
  return queryOptions({
    queryKey: queryKeys.campaigns.announcements(campaignId),
    queryFn: () => client.campaigns.announcements.list(campaignId)
  })
}

export function getCampaignAnnouncement(
  campaignId: string,
  announcementPublicId: string,
  client: Api = api
) {
  return queryOptions({
    queryKey: queryKeys.campaigns.announcement(campaignId, announcementPublicId),
    queryFn: () => client.campaigns.announcements.get(campaignId, announcementPublicId)
  })
}
