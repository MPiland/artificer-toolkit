import type { Feat } from '../../../../../../gql/types'

type MetaObject = { featIds: string[]; id: string | number }

export type MetaData = {
  features: MetaObject[]
}

export const metaData: MetaData = {
  features: [],
}

export const itemsToMeta = (items: Feat[]) => {
  items.map((item) => {
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature, item.id)
      })
    }
  })
}

export const addToMeta = <T extends Record<string, unknown>>(
  metaArray: (MetaObject & T)[],
  keyId: string | number,
  featId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add equipmentId to the existing entry with matching fields
      exactMatch.featIds.push(featId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        featIds: [featId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, featIds: [featId] } as MetaObject & T)
    } else {
      existing.featIds.push(featId)
    }
  }
}
