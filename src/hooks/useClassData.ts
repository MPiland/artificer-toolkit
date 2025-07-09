import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { fetchClass, fetchClasses } from '@/apis/classes.api'
import { Categories } from '@/enums'
import { createArrayWithMethods } from '@/utils'

const useClassData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries

  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchClasses(systemPref))
  const { classes, metaData } = data

  const subclasses = data.classes.filter((c) =>
    metaData.categories?.find((cat) => cat.id === Categories.SUBCLASS)?.classIds?.includes(c.id)
  )

  const baseClasses = data.classes.filter((c) =>
    metaData.categories?.find((cat) => cat.id === Categories.BASE)?.classIds?.includes(c.id)
  )

  return {
    classes: createArrayWithMethods(classes, {
      findListClass: (id?: string | null) => {
        if (!id) return null
        return classes.find((c) => c.id === id)
      },
      findClass: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchClass(id)).data
      },
      findClasses: (ids?: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchClass(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
    }),
    baseClasses,
    subclasses: createArrayWithMethods(subclasses, {
      findSubclass: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchClass(id)).data
      },
      findParent: (id?: string) => {
        if (!id) return null
        const parentId = metaData.parentClasses?.find((p) => p.classIds?.includes(id))?.id
        if (!parentId) return null
        return classes.find((c) => c.id === parentId)
      },
      findByParent: (id?: string) => {
        if (!id) return null
        return subclasses.filter((c) => metaData.parentClasses?.find((p) => p.classIds?.includes(c.id))?.id === id)
      },
    }),
    metaData,
  }
}
export default useClassData
