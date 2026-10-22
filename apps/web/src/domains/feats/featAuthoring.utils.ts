import type {
  FeatAuthoringInputDto,
  FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'

interface CreateEmptyFeatInput {
  systemId: string
}

export function createEmptyFeat({ systemId }: CreateEmptyFeatInput): FeatAuthoringInputDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    status: 'DRAFT',
    details: [],
    effects: [],
    features: [],
    systemId
  }
}

export function resolveCreateFeatSystemId(systems: readonly { id: string }[]): string | null {
  return systems[0]?.id ?? null
}

export function normalizeFeatForSubmit(
  feat: FeatAuthoringInputDto | FeatAuthoredDto
): FeatAuthoringInputDto {
  return {
    ...feat,
    label: feat.label.trim() || 'Untitled Feat',
    description: feat.description ?? '',
    details: feat.details ?? [],
    status: feat.status ?? 'DRAFT',
    effects: feat.effects ?? [],
    features: feat.features ?? [],
    grants: normalizeFeatGrants(feat.grants)
  }
}

function normalizeFeatGrants(grants: FeatAuthoredDto['grants']): FeatAuthoredDto['grants'] {
  if (!grants) return undefined

  const next = {
    feats: grants.feats?.length ? grants.feats : undefined,
    modifiers: grants.modifiers?.length ? grants.modifiers : undefined,
    proficiencies: grants.proficiencies?.length ? grants.proficiencies : undefined,
    senses: grants.senses?.length ? grants.senses : undefined,
    spells: grants.spells?.length ? grants.spells : undefined
  }

  return Object.values(next).some(Boolean) ? next : undefined
}
