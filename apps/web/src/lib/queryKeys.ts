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
  characters: {
    all: () => ['characters'] as const,
    list: () => ['characters', 'list'] as const,
    detail: (id: string) => ['characters', 'detail', id] as const,
    draft: (id: string) => ['characters', 'draft', id] as const,
    sheet: (id: string) => ['characters', 'sheet', id] as const,
    panels: (id: string) => ['characters', 'sheet', id, 'panel'] as const,
    panel: (id: string, target: object) => ['characters', 'sheet', id, 'panel', target] as const
  },

  rolls: {
    history: () => ['rolls', 'history'] as const
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
      detailRoot: (id: string) => authoredDetailSubjectKey('backgrounds', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('backgrounds', id, options)] as const,
      draft: (id: string) => ['content', 'backgrounds', 'draft', id] as const
    },
    classes: {
      all: () => ['content', 'classes'] as const,
      list: () => ['content', 'classes', 'list'] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('classes', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('classes', id, options)] as const,
      draft: (id: string) => ['content', 'classes', 'draft', id] as const
    },
    equipment: {
      all: () => ['content', 'equipment'] as const,
      list: () => ['content', 'equipment', 'list'] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('equipment', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('equipment', id, options)] as const,
      draft: (id: string) => ['content', 'equipment', 'draft', id] as const
    },
    feats: {
      all: () => ['content', 'feats'] as const,
      list: () => ['content', 'feats', 'list'] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('feats', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('feats', id, options)] as const,
      draft: (id: string) => ['content', 'feats', 'draft', id] as const
    },
    races: {
      all: () => ['content', 'races'] as const,
      list: () => ['content', 'races', 'list'] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('races', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('races', id, options)] as const,
      draft: (id: string) => ['content', 'races', 'draft', id] as const
    },
    spells: {
      all: () => ['content', 'spells'] as const,
      list: () => ['content', 'spells', 'list'] as const,
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
      detailRoot: (id: string) => authoredDetailSubjectKey('creatures', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('creatures', id, options)] as const,
      draft: (id: string) => ['content', 'creatures', 'draft', id] as const
    },
    vehicles: {
      all: () => ['content', 'vehicles'] as const,
      list: () => ['content', 'vehicles', 'list'] as const,
      detailRoot: (id: string) => authoredDetailSubjectKey('vehicles', id),
      detail: (id: string, options?: AuthoredDetailQueryOptions) =>
        [...authoredDetailKey('vehicles', id, options)] as const,
      draft: (id: string) => ['content', 'vehicles', 'draft', id] as const
    }
  },

  systems: {
    all: () => ['systems'] as const,
    list: () => ['systems', 'list'] as const,
    detail: (id: string) => ['systems', 'detail', id] as const
  },

  nodeRuntime: {
    all: () => ['node-runtime'] as const,
    resolve: (mapId: string, fingerprint: string) => ['node-runtime', mapId, fingerprint] as const,
    normalizeValues: (mapId: string, fingerprint: string) =>
      ['node-runtime', mapId, 'normalize-values', fingerprint] as const
  }
} as const
