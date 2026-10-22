/**
 * Centralized React Query key factory.
 *
 * Rules:
 * - All keys start with a top-level domain string (for invalidation).
 * - Lists use [..., 'list'] so invalidating the domain root sweeps lists too.
 * - Detail keys include the resource id so they cache independently.
 *
 * Usage:
 *   const q = useQuery({ queryKey: queryKeys.characters.list(), ... })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.characters.all() })
 */

import type { LootOwner } from '@artificer-toolkit/schema/api/lootTables'

type AuthoredDetailQueryOptions = {
  view?: 'active' | 'draft'
  meta?: readonly string[]
}

function authoredDetailSubjectKey(domain: string, id: string) {
  return ['content', domain, 'detail', id] as const
}

function authoredDetailVariantKey(options: AuthoredDetailQueryOptions = {}) {
  return [options.view ?? 'active', [...(options.meta ?? [])].sort().join(',')] as const
}

function authoredDetailKey(domain: string, id: string, options: AuthoredDetailQueryOptions = {}) {
  return [...authoredDetailSubjectKey(domain, id), ...authoredDetailVariantKey(options)] as const
}

export const queryKeys = {
  campaigns: {
    all: () => ['campaigns'] as const,
    list: () => ['campaigns', 'list'] as const,
    detail: (campaignId: string) => ['campaigns', 'detail', campaignId] as const,
    playSettings: (campaignId: string) => ['campaigns', campaignId, 'play-settings'] as const,
    playSettingsOptions: (campaignId: string) =>
      ['campaigns', campaignId, 'play-settings', 'options'] as const,
    conversations: (campaignId: string) => ['campaigns', campaignId, 'conversations'] as const,
    chat: (campaignId: string, room: 'TABLE' | 'PARTY' | 'DIRECT', directUserId?: string) =>
      ['campaigns', campaignId, 'chat', room, directUserId ?? null] as const,
    notebook: (campaignId: string) => ['campaigns', campaignId, 'notebook'] as const,
    sessions: (campaignId: string) => ['campaigns', campaignId, 'sessions'] as const,
    scenes: (campaignId: string) => ['campaigns', campaignId, 'scenes'] as const,
    sceneDefinition: (campaignId: string, sceneId: string | null) =>
      ['campaigns', campaignId, 'scenes', 'definition', sceneId] as const,
    loot: (owner: LootOwner) => ['campaigns', owner.campaignId, 'loot', owner] as const,
    liveScenes: (campaignId: string) => ['campaigns', campaignId, 'scenes', 'live'] as const,
    session: (campaignId: string, sessionNumber: number) =>
      ['campaigns', campaignId, 'sessions', sessionNumber] as const,
    sessionAttendance: (campaignId: string, sessionId: string) =>
      ['campaigns', campaignId, 'sessions', sessionId, 'attendance'] as const,
    sessionRsvps: (campaignId: string, sessionId: string) =>
      ['campaigns', campaignId, 'sessions', sessionId, 'rsvps'] as const,
    sessionReferences: (campaignId: string, sessionId: string) =>
      ['campaigns', campaignId, 'sessions', sessionId, 'references'] as const,
    clock: (campaignId: string) => ['campaigns', campaignId, 'clock'] as const,
    sessionNotes: (campaignId: string, sessionId: string) =>
      ['campaigns', campaignId, 'sessions', sessionId, 'notes'] as const,
    currencySystems: (campaignId: string) =>
      ['campaigns', campaignId, 'inventory', 'currency-systems'] as const,
    inventory: (campaignId: string, ownerKey: string) =>
      ['campaigns', campaignId, 'inventory', ownerKey] as const,
    inventoryAudit: (campaignId: string) =>
      ['campaigns', campaignId, 'inventory', 'audit'] as const,
    content: (campaignId: string) => ['campaigns', campaignId, 'content'] as const,
    vehicles: (campaignId: string) => ['campaigns', campaignId, 'vehicles'] as const,
    announcements: (campaignId: string) => ['campaigns', campaignId, 'announcements'] as const,
    announcement: (campaignId: string, announcementPublicId: string) =>
      ['campaigns', campaignId, 'announcements', announcementPublicId] as const
  },

  socialHub: {
    all: () => ['social-hub'] as const,
    eligibility: () => ['social-hub', 'eligibility'] as const,
    profile: (profilePublicId: string) => ['social-hub', 'profiles', profilePublicId] as const,
    discovery: (filters: object) => ['social-hub', 'discovery', filters] as const,
    listing: (listingPublicId: string) => ['social-hub', 'listings', listingPublicId] as const,
    listingsMine: () => ['social-hub', 'listings', 'mine'] as const,
    applicationsMine: () => ['social-hub', 'applications', 'mine'] as const,
    applicationsForListing: (listingPublicId: string) =>
      ['social-hub', 'applications', 'listing', listingPublicId] as const,
    invitationsReceived: () => ['social-hub', 'invitations', 'received'] as const,
    invitationsSent: (listingPublicId: string) =>
      ['social-hub', 'invitations', 'sent', listingPublicId] as const,
    blocks: () => ['social-hub', 'blocks'] as const,
    moderationQueue: () => ['social-hub', 'moderation', 'queue'] as const
  },

  media: {
    vttMap: (assetId: string) => ['media', 'vtt-map', assetId] as const
  },

  characters: {
    all: () => ['characters'] as const,
    actions: (id: string) => ['characters', 'actions', id] as const,
    list: () => ['characters', 'list'] as const,
    detail: (id: string) => ['characters', 'detail', id] as const,
    draft: (id: string) => ['characters', 'draft', id] as const,
    sheet: (id: string) => ['characters', 'sheet', id] as const,
    extraOptions: (id: string, input: object) =>
      ['characters', 'sheet', id, 'extra-options', input] as const,
    preparationOptions: (id: string) => ['characters', 'sheet', id, 'preparation-options'] as const,
    panels: (id: string) => ['characters', 'sheet', id, 'panel'] as const,
    panel: (id: string, target: object) => ['characters', 'sheet', id, 'panel', target] as const
  },

  routeIds: {
    resolve: (subjectKind: string, publicId: string) =>
      ['route-ids', 'resolve', subjectKind, publicId.toLowerCase()] as const
  },

  content: {
    referenceData: (systemId: string) => ['content', 'reference-data', systemId] as const,
    backgrounds: {
      all: () => ['content', 'backgrounds'] as const,
      list: () => ['content', 'backgrounds', 'list'] as const,
      listPage: (input: object) => ['content', 'backgrounds', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('backgrounds', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('backgrounds', id, options)] as const,
      draft: (id: string) => ['content', 'backgrounds', 'draft', id] as const
    },
    classes: {
      all: () => ['content', 'classes'] as const,
      list: () => ['content', 'classes', 'list'] as const,
      listPage: (input: object) => ['content', 'classes', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('classes', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('classes', id, options)] as const,
      draft: (id: string) => ['content', 'classes', 'draft', id] as const
    },
    equipment: {
      all: () => ['content', 'equipment'] as const,
      list: () => ['content', 'equipment', 'list'] as const,
      listPage: (input: object) => ['content', 'equipment', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('equipment', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('equipment', id, options)] as const,
      draft: (id: string) => ['content', 'equipment', 'draft', id] as const
    },
    feats: {
      all: () => ['content', 'feats'] as const,
      list: () => ['content', 'feats', 'list'] as const,
      listPage: (input: object) => ['content', 'feats', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('feats', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('feats', id, options)] as const,
      draft: (id: string) => ['content', 'feats', 'draft', id] as const
    },
    races: {
      all: () => ['content', 'races'] as const,
      list: () => ['content', 'races', 'list'] as const,
      listPage: (input: object) => ['content', 'races', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('races', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('races', id, options)] as const,
      draft: (id: string) => ['content', 'races', 'draft', id] as const
    },
    spells: {
      all: () => ['content', 'spells'] as const,
      list: () => ['content', 'spells', 'list'] as const,
      listPage: (input: object) => ['content', 'spells', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('spells', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('spells', id, options)] as const,
      draft: (id: string) => ['content', 'spells', 'draft', id] as const,
      detailReferenceData: () => ['content', 'spells', 'detail-reference-data'] as const,
      referenceData: () => ['content', 'spells', 'reference-data'] as const
    },
    effects: {
      referenceData: (systemId: string) =>
        ['content', 'effects', 'reference-data', systemId] as const
    },
    features: {
      all: () => ['content', 'features'] as const,
      list: () => ['content', 'features', 'list'] as const,
      detail: (id: string) => ['content', 'features', 'detail', id] as const
    },
    creatures: {
      all: () => ['content', 'creatures'] as const,
      list: () => ['content', 'creatures', 'list'] as const,
      listPage: (input: object) => ['content', 'creatures', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('creatures', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('creatures', id, options)] as const,
      draft: (id: string) => ['content', 'creatures', 'draft', id] as const
    },
    vehicles: {
      all: () => ['content', 'vehicles'] as const,
      list: () => ['content', 'vehicles', 'list'] as const,
      listPage: (input: object) => ['content', 'vehicles', 'list', input] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('vehicles', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('vehicles', id, options)] as const,
      draft: (id: string) => ['content', 'vehicles', 'draft', id] as const
    }
  },

  nodeRuntime: {
    all: () => ['node-runtime'] as const,
    resolve: (mapId: string, fingerprint: string) => ['node-runtime', mapId, fingerprint] as const,
    normalizeValues: (mapId: string, fingerprint: string) =>
      ['node-runtime', mapId, 'normalize-values', fingerprint] as const
  }
} as const
