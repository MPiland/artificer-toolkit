import type { FeatureAuthored } from '#authored'
import { type CompiledFeatureBase, compileFeatureBase } from '#compilers'
import { compileSuccess, unwrapCompileResult, type CompileResult } from '#utils'

export interface CompiledFeatureOptionChoice {
  level: number // int
  count: number // int
  replaceCount?: number | null // int
}

export type CompiledFeature = CompiledFeatureBase & {
  section?: FeatureAuthored['section']
  optionChoices?: CompiledFeatureOptionChoice[]
  options?: CompiledFeatureBase[]
  availableAtLevel?: number
}

export function compileFeatureResult(authored: FeatureAuthored): CompileResult<CompiledFeature> {
  const base = compileFeatureBase(authored)

  const options = authored.options?.length ? authored.options.map(compileFeatureBase) : undefined

  return compileSuccess({
    ...base,
    section: authored.section,
    optionChoices: authored.optionChoices,
    options,
    availableAtLevel: authored.availableAtLevel,
    order: authored.order
  })
}

export function compileFeature(authored: FeatureAuthored): CompiledFeature {
  return unwrapCompileResult(compileFeatureResult(authored))
}
