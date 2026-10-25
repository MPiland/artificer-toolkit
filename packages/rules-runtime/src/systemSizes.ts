import type { AuthoredPublicationDocument } from '@artificer-toolkit/schema/api/authoredPublication'
import type { FeatureDto } from '@artificer-toolkit/schema/features/feature'
import { systemCoreCodeRegistry } from './platformSystemCoreCodes.js'

function attackSlotSizes(features: readonly FeatureDto[] | undefined) {
  return (features ?? []).flatMap((feature) =>
    (feature.attackSlots?.alternatives ?? []).flatMap(({ slots }) =>
      slots.flatMap(({ condition }) =>
        condition?.kind === 'TARGET_SIZE_AT_MOST' ? [condition.size] : []
      )
    )
  )
}

function authoredSizes(subject: AuthoredPublicationDocument): string[] {
  switch (subject.subjectKind) {
    case 'CREATURE':
      return [subject.document.size, ...attackSlotSizes(subject.document.features)]
    case 'VEHICLE':
      return [
        ...(subject.document.size === undefined ? [] : [subject.document.size]),
        ...attackSlotSizes(subject.document.features)
      ]
    case 'RACE': {
      const { document } = subject
      return document.category === 'BASE'
        ? [
            document.size,
            ...attackSlotSizes(document.features),
            ...(document.ancestry?.options ?? []).flatMap(({ features }) =>
              attackSlotSizes(features)
            )
          ]
        : attackSlotSizes(document.features)
    }
    default:
      return []
  }
}

/**
 * Refuses an authored Creature, Race or Vehicle whose size, or an attack-slot size condition of its
 * Features, is not in its System's size list. Authoring ingress calls it before node-map
 * normalization, which would otherwise clear the code instead of refusing it.
 */
export function requireAuthoredSizes(subject: AuthoredPublicationDocument) {
  for (const size of authoredSizes(subject))
    systemCoreCodeRegistry.requireCode(subject.document.systemId, 'size', size)
}

/** The size the System gives a new Creature or Race. */
export function defaultSize(gameSystemId: string): string {
  const size = systemCoreCodeRegistry.entries(gameSystemId, 'size').find((entry) => entry.isDefault)
  if (!size) throw new Error('The Game System does not define a default size.')
  return size.code
}

/** The sizes that fill a space a Scene models, smallest first: the ones guided authoring offers. */
export function sceneSizes(gameSystemId: string) {
  return systemCoreCodeRegistry
    .entries(gameSystemId, 'size')
    .filter((entry) => entry.spaceFeet !== undefined)
}

/** A size's step in its System's size list, smallest first; null for a missing or unknown size. */
export function sizeRank(gameSystemId: string, size: string | null | undefined): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  const rank = size == null ? -1 : sizes.findIndex(({ code }) => code === size)
  return rank === -1 ? null : rank
}

/** The edge in feet of the space a creature of `size` fills; null for a missing size or one with no modelled space. */
export function sizeSpaceFeet(
  gameSystemId: string,
  size: string | null | undefined
): number | null {
  const sizes = systemCoreCodeRegistry.entries(gameSystemId, 'size')
  return sizes.find(({ code }) => code === size)?.spaceFeet ?? null
}
