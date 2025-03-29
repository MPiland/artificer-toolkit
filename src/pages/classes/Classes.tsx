import List from '../../components/List/List'
import ICategory from '../../assets/Icons/ICategory'
import { ReactElement, Suspense } from 'react'
import { useListClassesQuery, useDeleteClassMutation } from '../../apis/classesApi'
import Loading from '../../components/Loading/Loading'

const Classes = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: [{ path: 'category', source: { type: 'system', field: 'categories' } }],
      value: 'Category',
    },
  ]

  return (
    <Suspense fallback={<Loading />}>
      <List useListItems={useListClassesQuery} useDeleteItem={useDeleteClassMutation} footerText={footerText} />
    </Suspense>
  )
}
export default Classes
