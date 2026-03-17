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

export interface CompiledFeatureOptionChoice {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type CompiledFeature = CompiledFeatureBase & {
  optionChoices?: CompiledFeatureOptionChoice[]
  options?: CompiledFeatureOption[] 
  availableAtLevel?: number
}

export function compileFeatureResult(authored: FeatureAuthored): CompileResult<CompiledFeature> {
  const base = compileFeatureBase(authored)

  const options = authored.options?.length
    ? authored.options.map(compileFeatureOption)
    : undefined

  return compileSuccess({
    ...base,
    optionChoices: authored.optionChoices,
    options,
    availableAtLevel: authored.availableAtLevel,
    order: authored.order
  })
}

export function compileFeature(authored: FeatureAuthored): CompiledFeature {
  return unwrapCompileResult(compileFeatureResult(authored))
}
