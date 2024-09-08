import List from '../../components/List/List'
import ICategory from '../../assets/Icons/ICategory'
import { ReactElement } from 'react'
import { useGetClassesQuery, useDeleteClassMutation } from './classesApi'

const ClassList = () => {
  const footerText: { name: string | any[]; value: string; display?: string; icon?: ReactElement }[] = [
    {
      icon: <ICategory />,
      name: 'category.value',
      value: 'Category',
    },
  ]

  return <List useGetItems={useGetClassesQuery} useDeleteItem={useDeleteClassMutation} footerText={footerText} />
}
export default ClassList
