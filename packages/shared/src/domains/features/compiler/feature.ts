import type { FeatureAuthored } from '#authored'
import {
  compileFeatureOption,
  CompiledFeatureBase,
  CompiledFeatureOption,
  compileFeatureBase
} from '#compiler'

export interface CompiledOptionsByLevel {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type CompiledFeature = CompiledFeatureBase & {
  optionsPerLevel?: CompiledOptionsByLevel[]
  options?: CompiledFeatureOption[]
  levelAvailable?: string
}

export function compileFeature(authored: FeatureAuthored): CompiledFeature {
  const base = compileFeatureBase(authored)

  const options = authored.options?.length
    ? authored.options.map(compileFeatureOption)
    : undefined

  return {
    ...base,
    optionsPerLevel: authored.optionsPerLevel,
    options,
    levelAvailable: authored.levelAvailable,
    order: authored.order
  }
}
