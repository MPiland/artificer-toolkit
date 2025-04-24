import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchSingleEquipment, fetchAllEquipment } from '@/apis/equipmentApi'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import type { EquipmentListItem, Equipment } from '@/types'

type FilteredEquipment = EquipmentListItem[] & EquipmentMethods

type EquipmentMethods = {
  findEquipment: (id?: string | null) => Equipment | undefined | null
  findEquipments: (ids?: string[] | null) => (Equipment | undefined | null)[] | null
  filterByCategory: (categoryId?: string | null) => FilteredEquipment
  filterByProperties: (propertyIds?: string[] | null) => FilteredEquipment
  filterByEveryProperty: (propertyIds?: string[] | null) => FilteredEquipment
}

const useEquipmentData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchAllEquipment(systemPref))
  const { equipment, metaData } = data

  const methods: EquipmentMethods = {
    findEquipment: (id) => {
      if (!id) return null
      return suspenseQuery(fetchSingleEquipment(id)).data
    },
    findEquipments: (ids) => {
      if (!ids || !ids.length) return null
      return suspenseQueries({
        queries: ids.map((id) => fetchSingleEquipment(id)),
        combine: (results) => results.map((result) => result.data),
      })
    },
    filterByCategory(this: EquipmentListItem[], categoryId) {
      if (!categoryId) return createArrayWithMethods(this, methods)
      const filtered = this.filter((e) =>
        metaData.categories?.find((c) => c.id === categoryId)?.equipmentIds?.includes(e.id)
      )
      return createArrayWithMethods(filtered, methods)
    },
    filterByProperties(this: EquipmentListItem[], propertyIds) {
      if (!propertyIds || !propertyIds.length) return createArrayWithMethods(this, methods)
      const filtered = this.filter((e) => {
        // Check if the equipment has ANY of the specified properties
        return propertyIds.some((propId) =>
          metaData.properties?.some((p) => p.id === propId && p.equipmentIds?.includes(e.id))
        )
      })
      return createArrayWithMethods(filtered, methods)
    },
    filterByEveryProperty(this: EquipmentListItem[], propertyIds) {
      if (!propertyIds || !propertyIds.length) return createArrayWithMethods(this, methods)
      const filtered = this.filter((e) => {
        // Check if the equipment has EVERY specified property
        return propertyIds.every((propId) =>
          metaData.properties?.some((p) => p.id === propId && p.equipmentIds?.includes(e.id))
        )
      })
      return createArrayWithMethods(filtered, methods)
    },
  }
  return {
    equipment: createArrayWithMethods(equipment, methods),
    metaData: metaData,
  }
}
export default useEquipmentData
