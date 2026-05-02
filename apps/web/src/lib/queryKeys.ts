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

export const queryKeys = {
  characters: {
    all: () => ['characters'] as const,
    list: () => ['characters', 'list'] as const,
    detail: (id: string) => ['characters', 'detail', id] as const,
    history: (id: string) => ['characters', 'history', id] as const
  },

  content: {
    backgrounds: {
      all: () => ['content', 'backgrounds'] as const,
      list: () => ['content', 'backgrounds', 'list'] as const,
      detail: (id: string) => [
        'content', 'backgrounds', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'backgrounds', 'draft', id
      ] as const
    },
    classes: {
      all: () => ['content', 'classes'] as const,
      list: () => ['content', 'classes', 'list'] as const,
      detail: (id: string) => [
        'content', 'classes', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'classes', 'draft', id
      ] as const
    },
    equipment: {
      all: () => ['content', 'equipment'] as const,
      list: () => ['content', 'equipment', 'list'] as const,
      detail: (id: string) => [
        'content', 'equipment', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'equipment', 'draft', id
      ] as const
    },
    feats: {
      all: () => ['content', 'feats'] as const,
      list: () => ['content', 'feats', 'list'] as const,
      detail: (id: string) => [
        'content', 'feats', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'feats', 'draft', id
      ] as const
    },
    races: {
      all: () => ['content', 'races'] as const,
      list: () => ['content', 'races', 'list'] as const,
      detail: (id: string) => [
        'content', 'races', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'races', 'draft', id
      ] as const
    },
    spells: {
      all: () => ['content', 'spells'] as const,
      list: () => ['content', 'spells', 'list'] as const,
      detail: (id: string) => [
        'content', 'spells', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'spells', 'draft', id
      ] as const,
      referenceData: () => ['content', 'spells', 'reference-data'] as const
    },
    effects: {
      referenceData: (systemId: string) => [
        'content', 'effects', 'reference-data', systemId
      ] as const
    },
    features: {
      all: () => ['content', 'features'] as const,
      list: () => ['content', 'features', 'list'] as const,
      detail: (id: string) => [
        'content', 'features', 'detail', id
      ] as const
    },
    creatures: {
      all: () => ['content', 'creatures'] as const,
      list: () => ['content', 'creatures', 'list'] as const,
      detail: (id: string) => [
        'content', 'creatures', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'creatures', 'draft', id
      ] as const
    },
    vehicles: {
      all: () => ['content', 'vehicles'] as const,
      list: () => ['content', 'vehicles', 'list'] as const,
      detail: (id: string) => [
        'content', 'vehicles', 'detail', id
      ] as const,
      draft: (id: string) => [
        'content', 'vehicles', 'draft', id
      ] as const
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
    normalizeValues: (mapId: string, fingerprint: string) => [
      'node-runtime', mapId, 'normalize-values', fingerprint
    ] as const
  }
} as const
