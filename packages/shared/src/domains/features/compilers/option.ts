import type { FeatureBaseAuthored } from '#authored'
import { CompiledFeatureBase, compileFeatureBase } from '#compilers'

export type CompiledFeatureOption = CompiledFeatureBase

export function compileFeatureOption(authored: FeatureBaseAuthored) {
  const base = compileFeatureBase(authored)

  return {
    ...base
  }
}
