import type { FeatureAuthored } from '#authored'
import {
  compileFeatureOption,
  CompiledFeatureBase,
  CompiledFeatureOption,
  compileFeatureBase
} from '#compilers'
import {
  compileSuccess,
  unwrapCompileResult,
  type CompileResult
} from '#utils'

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

export function compileFeatureResult(authored: FeatureAuthored): CompileResult<CompiledFeature> {
  const base = compileFeatureBase(authored)

  const options = authored.options?.length
    ? authored.options.map(compileFeatureOption)
    : undefined

  return compileSuccess({
    ...base,
    optionsPerLevel: authored.optionsPerLevel,
    options,
    levelAvailable: authored.levelAvailable,
    order: authored.order
  })
}

export function compileFeature(authored: FeatureAuthored): CompiledFeature {
  return unwrapCompileResult(compileFeatureResult(authored))
}
