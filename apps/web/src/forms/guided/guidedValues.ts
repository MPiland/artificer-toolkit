import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { sceneSizes } from '@artificer-toolkit/rules-runtime/systemSizes'
import { isRecord } from '#forms/utils/valueGuards'

/** The size choices a guided Creature or Race offers: the System's sizes a Scene models. */
export function guidedSizeOptions(systemId: string | undefined) {
  return systemId ? sceneSizes(systemId).map(({ code, label }) => ({ label, value: code })) : []
}

/**
 * The layout form is one object-typed form shared by every Authored domain, so each Guided screen
 * is built over it and reads its domain's values through the readers below.
 */
export const EMPTY_GUIDED_FORM_VALUES: object = {}

/** Reads one untrusted field off in-progress guided form values. */
export function readField(values: object, key: string): unknown {
  return isRecord(values) ? values[key] : undefined
}

export function readString(values: object, key: string): string {
  const value = readField(values, key)
  return typeof value === 'string' ? value : ''
}

export function toSelectOption(item: { id: string; label: string }) {
  return { label: item.label, value: item.id }
}

/** Guided drafts may be partial, so features are recognised shallowly rather than schema-parsed. */
export function toFeatures(value: unknown): FeatureDto[] {
  return Array.isArray(value)
    ? value.filter((item): item is FeatureDto => isRecord(item) && 'id' in item && 'order' in item)
    : []
}
