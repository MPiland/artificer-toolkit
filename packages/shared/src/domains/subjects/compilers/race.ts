import { assertNever } from '#utils'

import type {
  BaseRaceAuthored,
  DetailAuthored,
  FeatureAuthored,
  RaceAncestryAuthored,
  RaceAncestryOptionAuthored,
  RaceAuthored,
  SpeedAuthored,
  SubraceAuthored
} from '#authored'
import { RACE_CATEGORY_CODE, type RaceSelectionMode } from '#core'
import { compileFeature, type CompiledFeature } from '#compilers'

export interface CompiledRaceCharacteristics {
  sizeId: string
  speeds: SpeedAuthored[]
}

export interface CompiledRaceAncestry {
  id: string
  label: string
  options: CompiledRaceAncestryOption[]
}

export interface CompiledRaceAncestryOption {
  id: string
  label: string
  order: number // int
  features?: CompiledFeature[]
}

export interface ResolvedSubraceInherited {
  ancestry?: RaceAncestryAuthored
  size: string
  speeds: SpeedAuthored[]
  heritageIds?: string[]
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
}

export interface ResolvedSubraceMeta {
  parentRaceId: string
  parentLabel: string
  inherited: ResolvedSubraceInherited
}

export type ResolvedBaseRace = BaseRaceAuthored

export type ResolvedSubrace = Omit<SubraceAuthored, 'details' | 'features'> & {
  heritageIds?: string[]
  details?: DetailAuthored[]
  features?: FeatureAuthored[]
  ancestry?: RaceAncestryAuthored
  size: string
  speeds: SpeedAuthored[]
  subrace: ResolvedSubraceMeta
}

export type ResolvedRace = ResolvedBaseRace | ResolvedSubrace

export type CompiledRaceBase = {
  id: string
  label: string
  heritageIds?: string[]
  features?: CompiledFeature[]
}

export type CompiledRace = (
  | {
      category: typeof RACE_CATEGORY_CODE.BASE
      selectionMode: RaceSelectionMode
      ancestry?: CompiledRaceAncestry
      size: string
      speeds: SpeedAuthored[]
    }
  | {
      category: typeof RACE_CATEGORY_CODE.SUBRACE
      parentRaceId: string
      /** Features inherited from the parent race; they keep RACE provenance. */
      inheritedFeatureIds?: string[]
      ancestry?: CompiledRaceAncestry
      size: string
      speeds: SpeedAuthored[]
    }
) &
  CompiledRaceBase

/**
 * Child-authored mechanics only. This deliberately excludes the parent projection so source
 * auditing can pin a subrace's own mechanics without duplicating inherited mechanics.
 */
export type CompiledSubraceSource = {
  id: string
  category: typeof RACE_CATEGORY_CODE.SUBRACE
  parentRaceId: string
  heritageIds?: string[]
  features?: CompiledFeature[]
}

export function compileSubraceSource(authored: SubraceAuthored): CompiledSubraceSource {
  return {
    id: authored.id,
    category: authored.category,
    parentRaceId: authored.parentRaceId,
    features: authored.features?.length
      ? authored.features.map((feature) => compileFeature(feature))
      : undefined
  }
}

function mergeOrderedValues<T>(parent?: readonly T[], child?: readonly T[]): T[] | undefined {
  const merged = [...(parent ?? []), ...(child ?? [])]

  return merged.length > 0 ? [...merged] : undefined
}

function mergeUniqueValues<T extends string>(
  parent?: readonly T[],
  child?: readonly T[]
): T[] | undefined {
  const merged = [...(parent ?? []), ...(child ?? [])]

  return merged.length > 0 ? [...new Set(merged)] : undefined
}

function cloneAncestryOption(authored: RaceAncestryOptionAuthored): RaceAncestryOptionAuthored {
  return {
    id: authored.id,
    label: authored.label,
    description: authored.description,
    order: authored.order,
    features: authored.features?.length ? [...authored.features] : undefined
  }
}

function cloneAncestry(authored: RaceAncestryAuthored): RaceAncestryAuthored {
  return {
    id: authored.id,
    label: authored.label,
    description: authored.description,
    options: authored.options.map(cloneAncestryOption)
  }
}

export function compileAncestryOption(
  authored: RaceAncestryOptionAuthored
): CompiledRaceAncestryOption {
  const features =
    authored.features && authored.features.length
      ? authored.features.map((feature) => compileFeature(feature))
      : undefined

  return {
    id: authored.id,
    label: authored.label,
    order: authored.order,
    features
  }
}

export function compileAncestry(authored: RaceAncestryAuthored): CompiledRaceAncestry {
  return {
    id: authored.id,
    label: authored.label,
    options: authored.options.map((option) => compileAncestryOption(option))
  }
}

export function resolveRaceAuthored(
  authored: RaceAuthored,
  lookupParent: (id: string) => RaceAuthored | null | undefined,
  lineage: string[] = []
): ResolvedRace {
  if (authored.category === RACE_CATEGORY_CODE.BASE) {
    return {
      ...authored,
      heritageIds: authored.heritageIds?.length ? [...authored.heritageIds] : undefined,
      details: authored.details?.length ? [...authored.details] : undefined,
      features: authored.features?.length ? [...authored.features] : undefined,
      ancestry: authored.ancestry ? cloneAncestry(authored.ancestry) : undefined,
      speeds: [...authored.speeds]
    }
  }

  if (lineage.includes(authored.id)) {
    throw new Error(`Race cycle detected for "${authored.id}".`)
  }

  const parent = lookupParent(authored.parentRaceId)

  if (!parent) {
    throw new Error(`Subrace "${authored.id}" is missing parent race "${authored.parentRaceId}".`)
  }

  const resolvedParent = resolveRaceAuthored(parent, lookupParent, [...lineage, authored.id])

  if (resolvedParent.category !== RACE_CATEGORY_CODE.BASE) {
    throw new Error(`Subrace "${authored.id}" resolved to non-base parent "${resolvedParent.id}".`)
  }

  return {
    id: authored.id,
    label: authored.label,
    quote: authored.quote,
    description: authored.description,
    status: authored.status,
    category: authored.category,
    parentRaceId: authored.parentRaceId,
    heritageIds: resolvedParent.heritageIds?.length ? [...resolvedParent.heritageIds] : undefined,
    details: mergeOrderedValues(resolvedParent.details, authored.details),
    features: mergeOrderedValues(resolvedParent.features, authored.features),
    ancestry: resolvedParent.ancestry ? cloneAncestry(resolvedParent.ancestry) : undefined,
    size: resolvedParent.size,
    speeds: [...resolvedParent.speeds],
    userId: authored.userId,
    systemId: authored.systemId,
    subrace: {
      parentRaceId: authored.parentRaceId,
      parentLabel: resolvedParent.label,
      inherited: {
        ancestry: resolvedParent.ancestry ? cloneAncestry(resolvedParent.ancestry) : undefined,
        size: resolvedParent.size,
        speeds: [...resolvedParent.speeds],
        heritageIds: resolvedParent.heritageIds?.length
          ? [...resolvedParent.heritageIds]
          : undefined,
        details: resolvedParent.details?.length ? [...resolvedParent.details] : undefined,
        features: resolvedParent.features?.length ? [...resolvedParent.features] : undefined
      }
    }
  }
}

export function compileRace(authored: ResolvedRace): CompiledRace {
  const features =
    authored.features && authored.features.length
      ? authored.features.map((feature) => compileFeature(feature))
      : undefined

  const base: CompiledRaceBase = {
    id: authored.id,
    label: authored.label,
    heritageIds: authored.heritageIds?.length ? mergeUniqueValues(authored.heritageIds) : undefined,
    features
  }

  switch (authored.category) {
    case RACE_CATEGORY_CODE.BASE: {
      const ancestry = authored.ancestry ? compileAncestry(authored.ancestry) : undefined

      return {
        ...base,
        category: authored.category,
        selectionMode: authored.selectionMode,
        ancestry,
        size: authored.size,
        speeds: authored.speeds
      }
    }

    case RACE_CATEGORY_CODE.SUBRACE: {
      const ancestry = authored.ancestry ? compileAncestry(authored.ancestry) : undefined

      return {
        ...base,
        category: authored.category,
        parentRaceId: authored.parentRaceId,
        inheritedFeatureIds: authored.subrace.inherited.features?.map((feature) => feature.id),
        ancestry,
        size: authored.size,
        speeds: authored.speeds
      }
    }

    default:
      return assertNever(authored)
  }
}
