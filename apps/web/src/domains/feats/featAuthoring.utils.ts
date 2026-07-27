import type { ChargeDto } from '@artificer-toolkit/schema/shared'
import type {
  FeatAuthoringInputDto,
  FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'

export interface CreateEmptyFeatInput {
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

export function createEmptyFeature(order: number): FeatureDto {
  return {
    id: crypto.randomUUID(),
    label: '',
    description: '',
    order
  }
}

export function createEmptyCharge(): ChargeDto {
  return {
    id: crypto.randomUUID(),
    resetKind: 'LONG_REST',
    limitKind: 'FIXED_AMOUNT',
    scalingKind: 'NONE',
    amount: 1
  }
}

export function createEmptyPrerequisites(): NonNullable<FeatAuthoredDto['prerequisites']> {
  return {
    id: crypto.randomUUID(),
    groups: []
  }
}

export function createEmptyGrants(): NonNullable<FeatAuthoredDto['grants']> {
  return {
    feats: [],
    modifiers: [],
    proficiencies: [],
    senses: [],
    spells: []
  }
}

export function upsertById<TItem extends { id: string }>(items: TItem[], item: TItem): TItem[] {
  const exists = items.some((current) => current.id === item.id)
  return exists
    ? items.map((current) => (current.id === item.id ? item : current))
    : [...items, item]
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
