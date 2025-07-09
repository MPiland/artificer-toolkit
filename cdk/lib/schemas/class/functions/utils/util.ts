import type { Class } from '../../../../../../gql/types'

type MetaObject = { classIds: string[]; id: string | number }

type AbilityMetaObject = MetaObject & {
  amount: number
}

type MetaData = {
  categories: MetaObject[]
  parentClasses: MetaObject[]
  primaryAbilities: AbilityMetaObject[]
  secondaryAbilities: AbilityMetaObject[]
  optionalAbilities: AbilityMetaObject[]
  features: MetaObject[]
}

export const metaData: MetaData = {
  categories: [],
  parentClasses: [],
  primaryAbilities: [],
  secondaryAbilities: [],
  optionalAbilities: [],
  features: [],
}

export const itemsToMeta = (items: Class[]) =>
  items.map((item) => {
    if (item.category) {
      addToMeta(metaData.categories, item.category, item.id)
    }
    if (item.parentClass) {
      addToMeta(metaData.parentClasses, item.parentClass, item.id)
    }
    if (item.multiclass?.primaryAbility && item.multiclass?.primaryAbility?.id) {
      addToMeta(metaData.primaryAbilities, item.multiclass?.primaryAbility?.id, item.id, {
        amount: item.multiclass?.primaryAbility?.minAmount,
      })
    }
    if (item.multiclass?.secondaryAbility && item.multiclass?.secondaryAbility?.id) {
      addToMeta(metaData.secondaryAbilities, item.multiclass?.secondaryAbility?.id, item.id, {
        amount: item.multiclass?.secondaryAbility?.minAmount,
      })
    }
    if (item.multiclass?.optionalAbility && item.multiclass?.optionalAbility?.id) {
      addToMeta(metaData.optionalAbilities, item.multiclass?.optionalAbility?.id, item.id, {
        amount: item.multiclass?.optionalAbility?.minAmount,
      })
    }
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature, item.id)
      })
    }
  })

export const addToMeta = <T extends Record<string, unknown>>(
  metaArray: (MetaObject & T)[],
  keyId: string | number,
  classId: string,
  additionalFields?: T
) => {
  // If we have additional fields, we need to find an exact match
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    )

    if (exactMatch) {
      // Add equipmentId to the existing entry with matching fields
      exactMatch.classIds.push(classId)
    } else {
      // Create a new entry with the additional fields
      metaArray.push({
        id: keyId,
        classIds: [classId],
        ...additionalFields,
      } as MetaObject & T)
    }
  } else {
    // Original behavior for simple ID-only metadata
    const existing = metaArray.find((m) => m.id === keyId)
    if (!existing) {
      metaArray.push({ id: keyId, classIds: [classId] } as MetaObject & T)
    } else {
      existing.classIds.push(classId)
    }
  }
}
