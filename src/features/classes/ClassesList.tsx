import List from '../../components/List/List'
import ICategory from '../../assets/Icons/ICategory'
import { ReactElement, Suspense } from 'react'
import { useListClassesQuery, useDeleteClassMutation } from './classesApi'
import Loading from '../../components/Loading/Loading'

const ClassList = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: 'category.value',
      value: 'Category',
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListClassesQuery} useDeleteItem={useDeleteClassMutation} footerText={footerText} />
    </Suspense>
  )
}
export default ClassList
