import type { Race } from '../../../../../../gql/types'

type MetaObject = { raceIds: string[]; id: string | number }

type MetaData = {
  categories: MetaObject[]
  playable: MetaObject[]
  lineages: MetaObject[]
  features: MetaObject[]
}

export const metaData: MetaData = {
  categories: [],
  playable: [],
  lineages: [],
  features: [],
}

export const itemsToMeta = (items: Race[]) => {
  items.map((item) => {
    if (item.playable) {
      addToMeta(metaData.playable, item.playable, item.id)
    }
    if (item.category) {
      addToMeta(metaData.categories, item.category, item.id)
    }
    if (item.lineages?.length) {
      item.lineages.forEach((lineage) => {
        addToMeta(metaData.lineages, lineage, item.id)
      })
    }
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature, item.id)
      })
    }
    if (item.ancestry?.options?.length) {
      item.ancestry.options.forEach((option) => {
        if (option.features?.length) {
          option.features.forEach((feature) => {
            addToMeta(metaData.features, feature, option.id)
          })
        }
      })
    }
  })
}

export const addToMeta = <T extends Record<string, unknown>>(
  metaArray: (MetaObject & T)[],
  keyId: string | number,
  raceId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add equipmentId to the existing entry with matching fields
      exactMatch.raceIds.push(raceId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        raceIds: [raceId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, raceIds: [raceId] } as MetaObject & T)
    } else {
      existing.raceIds.push(raceId)
    }
  }
}
