import type { Equipment } from '../../../../../../gql/types'

type MetaObject = { equipmentIds: string[]; id: string | number }

type CostMetaObject = MetaObject & {
  amount: number | null
}

type WeightMetaObject = MetaObject & {
  amount: number | null
}

export type MetaData = {
  categories: MetaObject[]
  properties: MetaObject[]
  primaryDamages: MetaObject[]
  secondaryDamages: MetaObject[]
  versatileDamages: MetaObject[]
  armorClasses: MetaObject[]
  cost: CostMetaObject[]
  weight: WeightMetaObject[]
  features: MetaObject[]
}

export const metaData: MetaData = {
  primaryDamages: [],
  secondaryDamages: [],
  versatileDamages: [],
  armorClasses: [],
  properties: [],
  categories: [],
  cost: [],
  weight: [],
  features: [],
}

export const itemsToMeta = (items: Equipment[]) => {
  items.map((item) => {
    if (item.damage?.primary?.id) {
      addToMeta(metaData.primaryDamages, item.damage.primary.id, item.id)
    }
    if (item.damage?.secondary?.id) {
      addToMeta(metaData.secondaryDamages, item.damage.secondary.id, item.id)
    }
    if (item.damage?.versatile?.id) {
      addToMeta(metaData.versatileDamages, item.damage.versatile.id, item.id)
    }
    if (item.properties?.length) {
      item.properties.forEach((property: string) => {
        addToMeta(metaData.properties, property, item.id)
      })
    }
    if (item.armorClass) {
      addToMeta(metaData.armorClasses, item.armorClass, item.id)
    }
    if (item.category) {
      addToMeta(metaData.categories, item.category, item.id)
    }
    if (item.cost) {
      addToMeta(metaData.cost, item.cost.currency, item.id, {
        amount: item.cost.amount,
      })
    }
    if (item.weight) {
      addToMeta(metaData.weight, item.weight.unit, item.id, {
        amount: item.weight.amount,
      })
    }
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
  equipmentId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add equipmentId to the existing entry with matching fields
      exactMatch.equipmentIds.push(equipmentId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        equipmentIds: [equipmentId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, equipmentIds: [equipmentId] } as MetaObject & T)
    } else {
      existing.equipmentIds.push(equipmentId)
    }
  }
}
