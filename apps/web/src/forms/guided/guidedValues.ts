import type { DetailDto } from '@artificer-toolkit/schema/shared'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import type { authoredFormFactories } from '#forms/factories/authoredFormFactories'
import { toTypedAuthoringFieldName } from '#forms/utils/pathUtils'
import { isRecord } from '#forms/utils/valueGuards'

/**
 * The layout form is one object-typed form shared by every Authored domain, so each Guided screen
 * is built over it. Its in-progress values are typed by the owning domain's form values through
 * `readGuidedValues`, and its fields are addressed through `guidedField`.
 */
export const EMPTY_GUIDED_FORM_VALUES = {}

export type GuidedDomain = keyof typeof authoredFormFactories

/** The domain's own form values; a Guided draft may not have filled every field yet. */
export type GuidedValues<TDomain extends GuidedDomain> = Partial<
  ReturnType<(typeof authoredFormFactories)[TDomain]['toFormValues']>
>

function isGuidedValues<TDomain extends GuidedDomain>(
  _domain: TDomain,
  values: object
): values is GuidedValues<TDomain> {
  return isRecord(values)
}

/**
 * The one place the object-typed layout form is read as a domain's values: the layout form is
 * created from that domain's `createEmptyValues`/`toFormValues`, so `domain` names its shape.
 */
export function readGuidedValues<TDomain extends GuidedDomain>(
  domain: TDomain,
  values: object
): GuidedValues<TDomain> {
  return isGuidedValues(domain, values) ? values : {}
}

/** A field of the domain's values, checked against its top-level keys. */
export function guidedField<TDomain extends GuidedDomain>(
  _domain: TDomain,
  key: keyof GuidedValues<TDomain> & string,
  ...nested: (string | number)[]
) {
  return toTypedAuthoringFieldName<object>(undefined, [key, ...nested])
}

export function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function toSelectOption(item: { id: string; label: string }) {
  return { label: item.label, value: item.id }
}

/** Invalid drafts may hold malformed rows, so rows are recognised shallowly rather than schema-parsed. */
export function toFeatures(value: unknown): FeatureDto[] {
  return Array.isArray(value)
    ? value.filter((item): item is FeatureDto => isRecord(item) && 'id' in item && 'order' in item)
    : []
}

export function toDetails(value: unknown): DetailDto[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is DetailDto => isRecord(item) && 'id' in item && 'description' in item
      )
    : []
}
