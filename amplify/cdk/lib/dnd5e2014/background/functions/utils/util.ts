import type { Background } from '../../../../../../gql/types'

type MetaObject = { backgroundIds: string[]; id: string | number }

type FeatureMetaObject = MetaObject & {
  label: string
}

export type MetaData = {
  features: FeatureMetaObject[]
}

export const metaData: MetaData = {
  features: [],
}

export const itemsToMeta = (items: Background[]) => {
  items.map((item) => {
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature.id, item.id, {
          label: feature.label,
        })
      })
    }
  })
}

export const addToMeta = <T extends Record<string, any>>(
  metaArray: (MetaObject & T)[],
  keyId: string | number,
  backgroundId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add equipmentId to the existing entry with matching fields
      exactMatch.backgroundIds.push(backgroundId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        backgroundIds: [backgroundId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, backgroundIds: [backgroundId] } as MetaObject & T)
    } else {
      existing.backgroundIds.push(backgroundId)
    }
  }
}
