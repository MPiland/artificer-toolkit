import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { isRecord } from '#forms/utils/valueGuards'

/** Reads one untrusted field off in-progress guided form values. */
export function readField(values: object, key: string): unknown {
  return isRecord(values) ? values[key] : undefined
}

/** Guided drafts may be partial, so features are recognised shallowly rather than schema-parsed. */
export function toFeatures(value: unknown): FeatureDto[] {
  return Array.isArray(value)
    ? value.filter((item): item is FeatureDto => isRecord(item) && 'id' in item && 'order' in item)
    : []
}
